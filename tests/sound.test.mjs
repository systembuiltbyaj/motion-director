import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SAMPLE_RATE, SFX_TYPES, renderMix, encodeWav, decodeWavMono, duckCurve, inRanges, dbToGain,
} from "../scripts/sound.mjs";

const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
const peakBetween = (channel, fromSec, toSec) => {
  let peak = 0;
  for (let i = Math.floor(fromSec * SAMPLE_RATE); i < Math.floor(toSec * SAMPLE_RATE); i += 1) peak = Math.max(peak, Math.abs(channel[i]));
  return peak;
};

test("renderMix is deterministic for the same cue sheet", () => {
  const cues = { duration: 2, bpm: 128, music: { style: "drive" }, sfx: [{ t: 0.5, type: "whoosh" }, { t: 1, type: "type", count: 6 }] };
  assert.equal(hash(encodeWav(renderMix(cues))), hash(encodeWav(renderMix(cues))));
});

test("renderMix output length matches duration and stays within full scale", () => {
  const mix = renderMix({ duration: 1.5, music: { style: "pulse", gain: 1 }, sfx: [{ t: 0.2, type: "impact", gain: 2 }] });
  assert.equal(mix.l.length, Math.round(1.5 * SAMPLE_RATE));
  assert.ok(peakBetween(mix.l, 0, 1.5) <= 1);
});

test("every SFX type renders without error", () => {
  for (const type of SFX_TYPES) {
    const mix = renderMix({ duration: 2.5, music: { style: "none" }, sfx: [{ t: 1.6, type }] });
    assert.ok(peakBetween(mix.l, 0, 2.5) > 0.001, `${type} produced silence`);
  }
});

test("a riser ends on its cue time instead of starting there", () => {
  const mix = renderMix({ duration: 3, music: { style: "none" }, sfx: [{ t: 2, type: "riser", dur: 1 }] });
  assert.ok(peakBetween(mix.l, 1.6, 2.0) > 0.05, "riser should be loud just before t");
  assert.ok(peakBetween(mix.l, 2.05, 3.0) < 0.001, "riser should be silent after t");
});

test("unknown sfx types and bad durations fail loudly", () => {
  assert.throws(() => renderMix({ duration: 1, sfx: [{ t: 0, type: "laser" }] }), /unknown sfx type/);
  assert.throws(() => renderMix({ duration: 0 }), /duration/);
  assert.throws(() => renderMix({ duration: 1, vo: [{ t: 0, file: "missing.wav" }] }), /missing decoded VO/);
});

test("music is ducked under voiceover", () => {
  const curve = duckCurve(SAMPLE_RATE * 2, [[SAMPLE_RATE * 0.5, SAMPLE_RATE * 1.5]], -12);
  assert.equal(curve[0], 1);
  assert.ok(Math.abs(curve[SAMPLE_RATE] - dbToGain(-12)) < 0.01);
  assert.ok(curve[SAMPLE_RATE * 2 - 1] > 0.9);
});

test("drop ranges mute drums", () => {
  assert.ok(inRanges(1.2, [[1, 2]]));
  assert.ok(!inRanges(2, [[1, 2]]));
});

test("WAV encode/decode round-trips and resamples foreign rates", () => {
  const mix = renderMix({ duration: 0.5, music: { style: "none" }, sfx: [{ t: 0.1, type: "pop" }] });
  const decoded = decodeWavMono(encodeWav(mix));
  assert.equal(decoded.length, mix.l.length);
  const i = Math.floor(0.12 * SAMPLE_RATE);
  assert.ok(Math.abs(decoded[i] - (mix.l[i] + mix.r[i]) / 2) < 1e-3);

  // 24 kHz mono 16-bit (Kokoro's format) → resampled to 44.1 kHz.
  const frames = 24000;
  const foreign = Buffer.alloc(44 + frames * 2);
  foreign.write("RIFF", 0); foreign.writeUInt32LE(36 + frames * 2, 4); foreign.write("WAVE", 8);
  foreign.write("fmt ", 12); foreign.writeUInt32LE(16, 16); foreign.writeUInt16LE(1, 20); foreign.writeUInt16LE(1, 22);
  foreign.writeUInt32LE(24000, 24); foreign.writeUInt32LE(48000, 28); foreign.writeUInt16LE(2, 32); foreign.writeUInt16LE(16, 34);
  foreign.write("data", 36); foreign.writeUInt32LE(frames * 2, 40);
  assert.equal(decodeWavMono(foreign).length, SAMPLE_RATE);
  assert.throws(() => decodeWavMono(Buffer.from("nope")), /RIFF/);
});
