#!/usr/bin/env node
// Generate voiceover lines, one WAV per line, from any provider, then print each line's duration so the
// timeline is built around real speech instead of guesses.
//
//   provider "kokoro" (default)   free, offline, via HyperFrames
//   provider "elevenlabs"         stock or cloned voices; ELEVENLABS_API_KEY + ELEVENLABS_BASE_URL
//   provider "openai-compatible"  any POST /audio/speech server (VoiceStudio, Chatterbox, VoxCPM2, OpenAI);
//                                 VOICE_API_BASE_URL (+ VOICE_API_KEY if the server wants one)
//
// Keys live in the environment or a .env file (see .env.example), never in vo.json. Every line is
// level-matched to the same voiced loudness, so switching provider doesn't change the mix. Each WAV keeps
// the exact request it was made from in <id>.json, and a line is only re-voiced when that request changes,
// so reruns are free.
//
// Usage: node voice.mjs <vo.json> [--force] [--dry-run]
//        node voice.mjs --list-voices [<vo.json> | --provider <name>]
// vo.json: { "provider": "kokoro", "voice": "am_michael", "speed": 1.0, "dir": "vo",
//            "lines": [{ "id": "l1", "text": "..." }] }
import { mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeWavMono, SAMPLE_RATE } from "./sound.mjs";
import { loadEnv } from "./env.mjs";
import { normalizeWav, VOICE_TARGET_DB } from "./voice/audio.mjs";
import kokoro from "./voice/kokoro.mjs";
import elevenlabs from "./voice/elevenlabs.mjs";
import openaiCompatible from "./voice/openai-compatible.mjs";

export const PROVIDERS = { kokoro, elevenlabs, "openai-compatible": openaiCompatible };
const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

export function providerFor(spec) {
  const name = spec.provider ?? "kokoro";
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`unknown provider "${name}". Use one of: ${Object.keys(PROVIDERS).join(", ")}`);
  return provider;
}

/** Everything a line's audio depends on; stored beside the WAV and compared on the next run. No secrets. */
export function lineRecord(spec, line) {
  if (!line.id || !line.text) throw new Error("each line needs an id and text");
  // The id becomes a file name, so it must not be able to leave the output folder.
  if (!SAFE_ID.test(line.id) || line.id.startsWith(".")) throw new Error(`line id "${line.id}" must use only letters, digits, . _ -`);
  const normalize = spec.normalize === false ? false : { targetDb: spec.targetDb ?? VOICE_TARGET_DB };
  return { request: providerFor(spec).request(spec, line), normalize };
}

export function needsVoicing(sidecar, record) {
  return !sidecar || JSON.stringify(sidecar) !== JSON.stringify(record);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Voices every stale line of a spec. `env` overrides the .env lookup (tests); it's only read when a line needs voicing. */
export async function voiceSpec(specPath, { force = false, dryRun = false, env, log = console.log } = {}) {
  const baseDir = dirname(resolve(specPath));
  const spec = JSON.parse(await readFile(specPath, "utf8"));
  if (!Array.isArray(spec.lines) || spec.lines.length === 0) throw new Error("vo.json needs a non-empty lines array");
  const seen = new Set();
  for (const line of spec.lines) {
    if (seen.has(line.id)) throw new Error(`duplicate line id "${line.id}"`);
    seen.add(line.id);
  }
  const provider = providerFor(spec);
  const outDir = join(baseDir, spec.dir ?? "vo");
  if (!dryRun) await mkdir(outDir, { recursive: true });
  let settings = env;

  let total = 0;
  let characters = 0;
  for (const line of spec.lines) {
    const record = lineRecord(spec, line);
    const wavPath = join(outDir, `${line.id}.wav`);
    const sidecarPath = join(outDir, `${line.id}.json`);
    const stale = force || needsVoicing(await readJson(sidecarPath), record) || !(await exists(wavPath));
    if (dryRun) {
      log(`[dry-run] ${line.id}: ${stale ? "would voice" : "up to date"} "${line.text}"`);
      if (stale && provider.remote) characters += line.text.length;
      continue;
    }
    let note = "";
    if (stale) {
      settings ??= loadEnv({ from: baseDir, skillDir: skillRoot });
      let wav = await provider.synthesize(record.request, settings);
      if (record.normalize) {
        const leveled = normalizeWav(wav, record.normalize);
        wav = leveled.wav;
        note = `\t(${leveled.gainDb >= 0 ? "+" : ""}${leveled.gainDb.toFixed(1)} dB)`;
      }
      // Sidecar last: if synthesis fails, the line stays stale and is retried next run.
      await writeFile(wavPath, wav);
      await writeFile(sidecarPath, `${JSON.stringify(record, null, 2)}\n`);
      // Older versions kept only the text, in <id>.txt.
      await rm(join(outDir, `${line.id}.txt`), { force: true });
      if (provider.remote) characters += line.text.length;
    }
    const seconds = decodeWavMono(await readFile(wavPath)).length / SAMPLE_RATE;
    total += seconds;
    log(`${line.id}\t${seconds.toFixed(2)}s\t${line.text}${note}`);
  }
  const sent = provider.remote ? ` · ${characters} characters ${dryRun ? "would be sent" : "sent"} to ${provider.name}` : "";
  log(dryRun ? `[dry-run] provider ${provider.name}${sent}` : `total speech ${total.toFixed(2)}s · provider ${provider.name}${sent}`);
  return { total, characters };
}

async function listVoices(args) {
  const flag = args.indexOf("--provider");
  const specPath = args.find((arg, i) => !arg.startsWith("--") && (flag < 0 || i !== flag + 1));
  const spec = flag >= 0 ? { provider: args[flag + 1] } : specPath ? JSON.parse(await readFile(specPath, "utf8")) : {};
  const from = specPath ? dirname(resolve(specPath)) : process.cwd();
  const voices = await providerFor(spec).listVoices(loadEnv({ from, skillDir: skillRoot }));
  for (const voice of voices) console.log(voice);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list-voices")) return listVoices(args.filter((arg) => arg !== "--list-voices"));
  const specPath = args.find((arg) => !arg.startsWith("--"));
  if (!specPath) {
    console.error("Usage: node voice.mjs <vo.json> [--force] [--dry-run]\n       node voice.mjs --list-voices [<vo.json> | --provider <name>]");
    process.exit(1);
  }
  await voiceSpec(specPath, { force: args.includes("--force"), dryRun: args.includes("--dry-run") });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`voice.mjs failed: ${error.message}`);
    process.exit(1);
  });
}
