import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv, loadEnv } from "../scripts/env.mjs";
import { pcmToWav, floatToWav, voicedRmsDb, peakDb, levelGainDb, normalizeWav, VOICE_TARGET_DB } from "../scripts/voice/audio.mjs";
import { fetchWithRetry } from "../scripts/voice/http.mjs";
import { PROVIDERS, providerFor, lineRecord, needsVoicing, voiceSpec } from "../scripts/voice.mjs";
import { decodeWavMono, SAMPLE_RATE } from "../scripts/sound.mjs";

const scratch = () => mkdtempSync(join(tmpdir(), "md-voice-test-"));

/** A 1 s 220 Hz tone at the given amplitude, as 16-bit mono PCM at `rate`. */
function tonePcm(amplitude, rate = 24000, seconds = 1) {
  const pcm = Buffer.alloc(rate * seconds * 2);
  for (let i = 0; i < rate * seconds; i += 1) pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * amplitude * 32767), i * 2);
  return pcm;
}

/** Local stand-in for the ElevenLabs and OpenAI-compatible endpoints; records every request. */
async function stubServer(handler) {
  const calls = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      calls.push({ method: req.method, url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
      handler(req, res, calls.length);
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { base: `http://127.0.0.1:${server.address().port}`, calls, close: () => new Promise((done) => server.close(done)) };
}

test("parseEnv reads keys, strips quotes, skips comments and blanks", () => {
  assert.deepEqual(parseEnv("# c\n\nA=1\nB = \"two\"\nC='3'\nnot a line\n"), { A: "1", B: "two", C: "3" });
});

test("loadEnv: process env beats the closest .env, which beats parents and the skill folder", () => {
  const root = scratch();
  const project = join(root, "a", "project");
  const skill = join(root, "skill");
  mkdirSync(project, { recursive: true });
  mkdirSync(skill);
  writeFileSync(join(skill, ".env"), "K1=skill\nK2=skill\nK3=skill\nK4=skill\n");
  writeFileSync(join(root, "a", ".env"), "K2=parent\nK3=parent\nK4=parent\n");
  writeFileSync(join(project, ".env"), "K3=project\nK4=project\n");
  const env = loadEnv({ from: project, skillDir: skill, env: { K4: "process", EMPTY: "" } });
  assert.deepEqual([env.K1, env.K2, env.K3, env.K4], ["skill", "parent", "project", "process"]);
});

test("pcmToWav and floatToWav write mono 16-bit files that decode back", () => {
  const wav = pcmToWav(tonePcm(0.5), 24000);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(22), 1);
  const decoded = decodeWavMono(wav);
  assert.ok(Math.abs(decoded.length - SAMPLE_RATE) < 2);
  assert.equal(decodeWavMono(floatToWav(decoded)).length, decoded.length);
});

test("voiced RMS ignores silence and the level gain respects the peak ceiling", () => {
  const half = new Float32Array(2000).fill(0);
  half.fill(0.1, 0, 1000);
  assert.ok(Math.abs(voicedRmsDb(half) - -20) < 0.01, "silence must not lower the voiced level");
  assert.ok(Math.abs(peakDb(half) - -20) < 0.01);
  // Quiet steady signal: raise to target.
  assert.ok(Math.abs(levelGainDb(new Float32Array(100).fill(0.01)) - (VOICE_TARGET_DB + 40)) < 0.01);
  // Spiky signal: the ceiling wins over the RMS target.
  const spiky = new Float32Array(1000).fill(0.01);
  spiky[0] = 0.9;
  assert.ok(Math.abs(levelGainDb(spiky, { ceilingDb: -1 }) - (-1 - peakDb(spiky))) < 0.01);
  assert.throws(() => levelGainDb(new Float32Array(100)), /silent/);
});

test("normalizeWav lands a quiet line on the target level", () => {
  const { wav, gainDb } = normalizeWav(pcmToWav(tonePcm(0.02), 24000));
  assert.ok(gainDb > 0);
  assert.ok(Math.abs(voicedRmsDb(decodeWavMono(wav)) - VOICE_TARGET_DB) < 0.2);
});

test("providerFor defaults to kokoro and rejects unknown providers", () => {
  assert.equal(providerFor({}).name, "kokoro");
  assert.deepEqual(Object.keys(PROVIDERS), ["kokoro", "elevenlabs", "openai-compatible"]);
  assert.throws(() => providerFor({ provider: "nope" }), /unknown provider "nope"/);
});

test("lineRecord builds each provider's request and guards line ids", () => {
  const kokoro = lineRecord({ voice: "am_adam", speed: 0.95 }, { id: "l1", text: "Hi" });
  assert.deepEqual(kokoro.request, { provider: "kokoro", voice: "am_adam", speed: 0.95, text: "Hi" });
  assert.deepEqual(kokoro.normalize, { targetDb: VOICE_TARGET_DB });

  const eleven = lineRecord({ provider: "elevenlabs", voice: "v1", settings: { stability: 0.4 } }, { id: "l1", text: "Hi", settings: { style: 0.5 } });
  assert.deepEqual(eleven.request, { provider: "elevenlabs", voice: "v1", model: "eleven_multilingual_v2", settings: { stability: 0.4, style: 0.5 }, text: "Hi" });
  assert.throws(() => lineRecord({ provider: "elevenlabs" }, { id: "l1", text: "Hi" }), /voice ID/);

  const open = lineRecord({ provider: "openai-compatible", model: "omnivoice", voice: "me", extra: { seed: 7 }, normalize: false }, { id: "l1", text: "Hi", extra: { language: "en" } });
  assert.deepEqual(open.request, { provider: "openai-compatible", model: "omnivoice", voice: "me", text: "Hi", extra: { seed: 7, language: "en" } });
  assert.equal(open.normalize, false);
  assert.throws(() => lineRecord({ provider: "openai-compatible", voice: "me" }, { id: "l1", text: "Hi" }), /model/);

  assert.throws(() => lineRecord({}, { id: "../evil", text: "Hi" }), /line id/);
  assert.throws(() => lineRecord({}, { id: "l1" }), /id and text/);
});

test("needsVoicing is false only for an identical record", () => {
  const record = lineRecord({}, { id: "l1", text: "Hi" });
  assert.equal(needsVoicing(null, record), true);
  assert.equal(needsVoicing(JSON.parse(JSON.stringify(record)), record), false);
  assert.equal(needsVoicing({ ...record, normalize: false }, record), true);
});

test("fetchWithRetry retries 5xx, fails fast on other 4xx", async () => {
  const flaky = await stubServer((req, res, n) => (n < 3 ? res.writeHead(503).end("busy") : res.writeHead(200).end("ok")));
  const noSleep = async () => {};
  const response = await fetchWithRetry(`${flaky.base}/x`, {}, { label: "Stub", sleep: noSleep });
  assert.equal(await response.text(), "ok");
  assert.equal(flaky.calls.length, 3);
  await flaky.close();

  const denied = await stubServer((req, res) => res.writeHead(401).end("bad key"));
  await assert.rejects(fetchWithRetry(`${denied.base}/x`, {}, { label: "Stub", sleep: noSleep }), /Stub 401: bad key/);
  assert.equal(denied.calls.length, 1);
  await denied.close();
});

test("elevenlabs: voices each line once, caches, re-voices only what changed", async () => {
  const server = await stubServer((req, res) => res.writeHead(200, { "Content-Type": "audio/pcm" }).end(tonePcm(0.05)));
  const dir = scratch();
  const spec = { provider: "elevenlabs", voice: "voice-1", dir: "vo", lines: [{ id: "a", text: "One." }, { id: "b", text: "Two." }] };
  writeFileSync(join(dir, "vo.json"), JSON.stringify(spec));
  const env = { ELEVENLABS_API_KEY: "test-key", ELEVENLABS_BASE_URL: server.base };
  const quiet = () => {};

  const first = await voiceSpec(join(dir, "vo.json"), { env, log: quiet });
  assert.equal(server.calls.length, 2);
  assert.equal(server.calls[0].url, "/v1/text-to-speech/voice-1?output_format=pcm_24000");
  assert.equal(server.calls[0].headers["xi-api-key"], "test-key");
  assert.deepEqual(server.calls[0].body, { text: "One.", model_id: "eleven_multilingual_v2" });
  assert.equal(first.characters, 8);
  assert.ok(Math.abs(voicedRmsDb(decodeWavMono(readFileSync(join(dir, "vo", "a.wav")))) - VOICE_TARGET_DB) < 0.2);
  const sidecar = JSON.parse(readFileSync(join(dir, "vo", "a.json"), "utf8"));
  assert.equal(JSON.stringify(sidecar).includes("test-key"), false, "the key must never be written to disk");

  await voiceSpec(join(dir, "vo.json"), { env, log: quiet });
  assert.equal(server.calls.length, 2, "an unchanged spec must not call the API again");

  spec.lines[1].text = "Two, changed.";
  writeFileSync(join(dir, "vo.json"), JSON.stringify(spec));
  const dry = await voiceSpec(join(dir, "vo.json"), { dryRun: true, log: quiet });
  assert.equal(dry.characters, 13);
  assert.equal(server.calls.length, 2, "a dry run must not call the API");
  await voiceSpec(join(dir, "vo.json"), { env, log: quiet });
  assert.equal(server.calls.length, 3);
  assert.equal(server.calls[2].body.text, "Two, changed.");
  await server.close();
});

test("elevenlabs: a missing key fails with a setup hint, only when a line needs voicing", async () => {
  const dir = scratch();
  writeFileSync(join(dir, "vo.json"), JSON.stringify({ provider: "elevenlabs", voice: "v", lines: [{ id: "a", text: "Hi" }] }));
  await assert.rejects(voiceSpec(join(dir, "vo.json"), { env: {}, log: () => {} }), /ELEVENLABS_API_KEY is not set.*\.env\.example/);
  await voiceSpec(join(dir, "vo.json"), { env: {}, dryRun: true, log: () => {} });
});

test("openai-compatible: posts the OpenAI speech shape, passes extras through, rejects non-WAV", async () => {
  let reply = pcmToWav(tonePcm(0.3, 48000), 48000);
  const server = await stubServer((req, res) => res.writeHead(200, { "Content-Type": "audio/wav" }).end(reply));
  const dir = scratch();
  const spec = { provider: "openai-compatible", model: "omnivoice", voice: "my-clone", speed: 1.1, extra: { seed: 42, model: "ignored" }, lines: [{ id: "a", text: "Hello." }] };
  writeFileSync(join(dir, "vo.json"), JSON.stringify(spec));
  const env = { VOICE_API_BASE_URL: `${server.base}/v1`, VOICE_API_KEY: "local-key" };

  await voiceSpec(join(dir, "vo.json"), { env, log: () => {} });
  assert.equal(server.calls[0].url, "/v1/audio/speech");
  assert.equal(server.calls[0].headers.authorization, "Bearer local-key");
  assert.deepEqual(server.calls[0].body, { seed: 42, model: "omnivoice", voice: "my-clone", input: "Hello.", response_format: "wav", speed: 1.1 });
  assert.ok(existsSync(join(dir, "vo", "a.wav")));

  reply = Buffer.from("ID3 not a wav");
  await assert.rejects(voiceSpec(join(dir, "vo.json"), { env, force: true, log: () => {} }), /not a WAV/);
  await server.close();
});

test("openai-compatible: base URL must be http(s) and set", async () => {
  const dir = scratch();
  writeFileSync(join(dir, "vo.json"), JSON.stringify({ provider: "openai-compatible", model: "m", voice: "v", lines: [{ id: "a", text: "Hi" }] }));
  await assert.rejects(voiceSpec(join(dir, "vo.json"), { env: {}, log: () => {} }), /VOICE_API_BASE_URL is not set/);
  await assert.rejects(voiceSpec(join(dir, "vo.json"), { env: { VOICE_API_BASE_URL: "file:///etc" }, log: () => {} }), /http/);
});

test("voiceSpec rejects duplicate line ids", async () => {
  const dir = scratch();
  writeFileSync(join(dir, "vo.json"), JSON.stringify({ lines: [{ id: "a", text: "1" }, { id: "a", text: "2" }] }));
  await assert.rejects(voiceSpec(join(dir, "vo.json"), { dryRun: true, log: () => {} }), /duplicate line id "a"/);
});
