#!/usr/bin/env node
// Sound engine for motion-director: synthesizes a beat-locked music bed and motion-synced SFX, places
// voiceover clips with ducking, and writes one stereo 16-bit WAV per composition. Zero dependencies
// and fully deterministic (seeded noise), so the same cue sheet always yields the same bytes.
//
// Usage: node sound.mjs <cues.json> [--out <file.wav>] [--dry-run]
//
// Cue sheet (paths resolve relative to the cue file):
// {
//   "duration": 18, "bpm": 128, "seed": 7,
//   "music": { "style": "drive" | "pulse" | "ambient" | "none", "gain": 0.5, "drop": [[from, to]], "fadeOut": 1.2 },
//   "sfx": [ { "t": 1.2, "type": "whoosh", "gain": 0.8, "dur": 0.5, "pan": 0 } ],
//   "vo":  [ { "t": 2.0, "file": "vo/line1.wav", "gain": 1 } ],
//   "duckDb": -10, "out": "assets/audio/mix.wav"
// }
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SAMPLE_RATE = 44100;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- primitives

export function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dbToGain = (db) => Math.pow(10, db / 20);
const secondsToSamples = (seconds) => Math.max(0, Math.round(seconds * SAMPLE_RATE));

function stereo(length) {
  return { l: new Float32Array(length), r: new Float32Array(length) };
}

function noise(length, random) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = random() * 2 - 1;
  return out;
}

/** RBJ biquad. `freq` may be a number or a function of the sample index (for sweeps). */
function biquad(input, { type, freq, q = 0.707 }) {
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0, b1, b2, a1, a2;
  const compute = (f) => {
    const w0 = (TAU * Math.min(Math.max(f, 20), SAMPLE_RATE * 0.45)) / SAMPLE_RATE;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    if (type === "lowpass") { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
    else if (type === "highpass") { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    a1 = (-2 * cos) / a0; a2 = (1 - alpha) / a0; b0 /= a0; b1 /= a0; b2 /= a0;
  };
  const sweep = typeof freq === "function";
  if (!sweep) compute(freq);
  for (let i = 0; i < input.length; i += 1) {
    if (sweep && i % 32 === 0) compute(freq(i));
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** Exponential-decay envelope with a short linear attack. */
function decayEnv(length, attackSeconds, decaySeconds) {
  const out = new Float32Array(length);
  const attack = Math.max(1, secondsToSamples(attackSeconds));
  const k = 1 / Math.max(1, secondsToSamples(decaySeconds));
  for (let i = 0; i < length; i += 1) out[i] = i < attack ? i / attack : Math.exp(-(i - attack) * k * 4.6);
  return out;
}

function multiply(a, b, gain = 1) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i += 1) out[i] = a[i] * b[i] * gain;
  return out;
}

/** Oscillator with an optional frequency function; shape: sine | triangle | saw (3-harmonic). */
function osc(length, freq, shape = "sine") {
  const out = new Float32Array(length);
  let phase = 0;
  for (let i = 0; i < length; i += 1) {
    const f = typeof freq === "function" ? freq(i) : freq;
    phase += f / SAMPLE_RATE;
    const p = phase % 1;
    if (shape === "triangle") out[i] = 1 - 4 * Math.abs(p - 0.5);
    else if (shape === "saw") out[i] = (Math.sin(TAU * p) + Math.sin(TAU * 2 * p) / 2 + Math.sin(TAU * 3 * p) / 3) * 0.6;
    else out[i] = Math.sin(TAU * p);
  }
  return out;
}

function pan(mono, position = 0) {
  const angle = ((Math.max(-1, Math.min(1, position)) + 1) * Math.PI) / 4;
  const out = stereo(mono.length);
  const gl = Math.cos(angle), gr = Math.sin(angle);
  for (let i = 0; i < mono.length; i += 1) { out.l[i] = mono[i] * gl; out.r[i] = mono[i] * gr; }
  return out;
}

function mixInto(bus, source, startSample, gain = 1) {
  const end = Math.min(bus.l.length, startSample + source.l.length);
  for (let i = Math.max(0, startSample); i < end; i += 1) {
    bus.l[i] += source.l[i - startSample] * gain;
    bus.r[i] += source.r[i - startSample] * gain;
  }
}

// ---------------------------------------------------------------- SFX
// Each returns { buffer: {l, r}, offset } where offset (seconds, ≤ 0) shifts the sound so its
// perceptual hit lands on the cue time (e.g. a riser ends exactly at t).

const SFX = {
  whoosh({ dur = 0.55, random, panFrom = -0.6, panTo = 0.6 }) {
    const n = secondsToSamples(dur);
    const bell = new Float32Array(n);
    for (let i = 0; i < n; i += 1) bell[i] = Math.pow(Math.sin((Math.PI * i) / n), 2);
    const swept = biquad(noise(n, random), { type: "bandpass", q: 1.2, freq: (i) => 300 + 3200 * Math.sin((Math.PI * i) / n) });
    const mono = multiply(swept, bell, 2.2);
    const out = stereo(n);
    for (let i = 0; i < n; i += 1) {
      const p = panFrom + (panTo - panFrom) * (i / n);
      const angle = ((p + 1) * Math.PI) / 4;
      out.l[i] = mono[i] * Math.cos(angle); out.r[i] = mono[i] * Math.sin(angle);
    }
    return { buffer: out, offset: -dur * 0.5 };
  },
  swish({ dur = 0.22, random }) {
    return SFX.whoosh({ dur, random, panFrom: 0.4, panTo: -0.4 });
  },
  riser({ dur = 1.4, random }) {
    const n = secondsToSamples(dur);
    const ramp = new Float32Array(n);
    for (let i = 0; i < n; i += 1) ramp[i] = Math.pow(i / n, 2.2);
    const hiss = biquad(noise(n, random), { type: "bandpass", q: 0.9, freq: (i) => 400 + 6000 * (i / n) });
    const tone = osc(n, (i) => 180 + 700 * Math.pow(i / n, 1.5), "saw");
    const mono = new Float32Array(n);
    for (let i = 0; i < n; i += 1) mono[i] = (hiss[i] * 1.4 + tone[i] * 0.18) * ramp[i];
    return { buffer: pan(mono, 0), offset: -dur };
  },
  impact({ random }) {
    const n = secondsToSamples(1.1);
    const body = osc(n, (i) => 38 + 110 * Math.exp(-i / secondsToSamples(0.05)), "sine");
    const click = biquad(noise(n, random), { type: "lowpass", freq: 2500 });
    const envBody = decayEnv(n, 0.002, 0.9);
    const envClick = decayEnv(n, 0.001, 0.06);
    const mono = new Float32Array(n);
    for (let i = 0; i < n; i += 1) mono[i] = body[i] * envBody[i] * 1.1 + click[i] * envClick[i] * 0.8;
    return { buffer: pan(mono, 0), offset: 0 };
  },
  pop({ random, pitch = 1 }) {
    const n = secondsToSamples(0.12);
    const tone = osc(n, (i) => (700 - 350 * (i / n)) * pitch, "sine");
    const env = decayEnv(n, 0.001, 0.09);
    const air = biquad(noise(n, random), { type: "highpass", freq: 3000 });
    const mono = new Float32Array(n);
    for (let i = 0; i < n; i += 1) mono[i] = (tone[i] * 0.9 + air[i] * 0.15) * env[i];
    return { buffer: pan(mono, 0), offset: 0 };
  },
  click({ random }) {
    const n = secondsToSamples(0.04);
    const tick = biquad(noise(n, random), { type: "bandpass", freq: 3200, q: 2 });
    const env = decayEnv(n, 0.0005, 0.02);
    return { buffer: pan(multiply(tick, env, 2.5), 0.1), offset: 0 };
  },
  // A burst of keyboard ticks: `count` keys at `cps`, seeded variation in timing, pitch and level.
  type({ random, count = 12, cps = 22 }) {
    const step = 1 / cps;
    const n = secondsToSamples(count * step + 0.06);
    const out = stereo(n);
    for (let k = 0; k < count; k += 1) {
      const start = secondsToSamples(k * step * (0.8 + random() * 0.4));
      const len = secondsToSamples(0.03);
      const key = biquad(noise(len, random), { type: "bandpass", freq: 1800 + random() * 2200, q: 1.8 });
      const env = decayEnv(len, 0.0005, 0.018);
      mixInto(out, pan(multiply(key, env, 1.6 + random() * 0.6), random() * 0.4 - 0.2), start);
    }
    return { buffer: out, offset: 0 };
  },
  chime({ random }) {
    const n = secondsToSamples(1.6);
    const notes = [1318.5, 1661.2, 1975.5, 2637];
    const mono = new Float32Array(n);
    notes.forEach((f, k) => {
      const start = secondsToSamples(k * 0.045);
      const tone = osc(n - start, f * (1 + (random() - 0.5) * 0.002), "sine");
      const env = decayEnv(n - start, 0.002, 1.2);
      for (let i = 0; i < tone.length; i += 1) mono[start + i] += tone[i] * env[i] * 0.22;
    });
    return { buffer: pan(mono, 0.15), offset: 0 };
  },
  shimmer({ random }) {
    const n = secondsToSamples(0.9);
    const hiss = biquad(noise(n, random), { type: "highpass", freq: 6500 });
    const bell = new Float32Array(n);
    for (let i = 0; i < n; i += 1) bell[i] = Math.sin((Math.PI * i) / n);
    return { buffer: pan(multiply(hiss, bell, 0.9), -0.2), offset: -0.3 };
  },
  subdrop() {
    const n = secondsToSamples(1.2);
    const tone = osc(n, (i) => 70 - 40 * (i / n), "sine");
    return { buffer: pan(multiply(tone, decayEnv(n, 0.01, 1.1), 1.2), 0), offset: 0 };
  },
};

export const SFX_TYPES = Object.keys(SFX);

// ---------------------------------------------------------------- music

const PROGRESSION = [
  { root: 110.0, triad: [220.0, 261.63, 329.63] },   // Am
  { root: 87.31, triad: [174.61, 220.0, 261.63] },   // F
  { root: 130.81, triad: [261.63, 329.63, 392.0] },  // C
  { root: 98.0, triad: [196.0, 246.94, 293.66] },    // G
];

const STYLES = {
  drive: { kick: [0, 1, 2, 3], clap: [1, 3], hat: "offbeat", bass: "eighths", pad: 0.25, arp: 0 },
  pulse: { kick: [0, 2], clap: [1, 3], hat: "sixteenths", bass: "quarters", pad: 0.3, arp: 0.35 },
  ambient: { kick: [0], clap: [], hat: "none", bass: "whole", pad: 0.6, arp: 0.22 },
};

function drumKick() {
  const n = secondsToSamples(0.4);
  const body = osc(n, (i) => 45 + 110 * Math.exp(-i / secondsToSamples(0.03)), "sine");
  return pan(multiply(body, decayEnv(n, 0.001, 0.35), 1.0), 0);
}

function drumClap(random) {
  const n = secondsToSamples(0.25);
  const burst = biquad(noise(n, random), { type: "bandpass", freq: 1400, q: 0.9 });
  const env = new Float32Array(n);
  [0, 0.012, 0.024].forEach((start) => {
    const s = secondsToSamples(start);
    for (let i = s; i < n; i += 1) env[i] = Math.max(env[i], Math.exp(-(i - s) / secondsToSamples(0.03)));
  });
  return pan(multiply(burst, env, 0.9), 0.05);
}

function drumHat(random) {
  const n = secondsToSamples(0.06);
  const hiss = biquad(noise(n, random), { type: "highpass", freq: 7500 });
  return pan(multiply(hiss, decayEnv(n, 0.0005, 0.04), 0.5), 0.25);
}

function note(freq, seconds, shape, decay, lowpass) {
  const n = secondsToSamples(seconds);
  let tone = osc(n, freq, shape);
  if (lowpass) tone = biquad(tone, { type: "lowpass", freq: lowpass });
  return multiply(tone, decayEnv(n, 0.005, decay));
}

function padChord(triad, seconds) {
  const n = secondsToSamples(seconds);
  const mono = new Float32Array(n);
  triad.forEach((f) => {
    [0.997, 1.003].forEach((detune) => {
      const tone = osc(n, f * detune, "triangle");
      for (let i = 0; i < n; i += 1) mono[i] += tone[i] * 0.12;
    });
  });
  const attack = secondsToSamples(Math.min(0.6, seconds * 0.3));
  const release = secondsToSamples(Math.min(0.5, seconds * 0.25));
  for (let i = 0; i < n; i += 1) {
    const a = Math.min(1, i / attack);
    const r = Math.min(1, (n - i) / release);
    mono[i] *= a * r;
  }
  return biquad(mono, { type: "lowpass", freq: 2200 });
}

export function inRanges(seconds, ranges = []) {
  return ranges.some(([from, to]) => seconds >= from && seconds < to);
}

function renderMusic(length, { bpm, style, drop = [], seed }) {
  const bus = stereo(length);
  const spec = STYLES[style];
  if (!spec) return bus;
  const random = seededRandom(seed + 101);
  const beat = 60 / bpm;
  const bar = beat * 4;
  const totalBars = Math.ceil(length / SAMPLE_RATE / bar);
  const kick = drumKick();
  const clap = drumClap(random);
  const hats = Array.from({ length: 4 }, () => drumHat(random));
  for (let b = 0; b < totalBars; b += 1) {
    const chord = PROGRESSION[b % PROGRESSION.length];
    const barStart = b * bar;
    if (spec.pad) mixInto(bus, pan(padChord(chord.triad, bar), 0), secondsToSamples(barStart), spec.pad);
    for (let q = 0; q < 4; q += 1) {
      const t = barStart + q * beat;
      const drums = !inRanges(t, drop);
      if (drums && spec.kick.includes(q)) mixInto(bus, kick, secondsToSamples(t), 0.9);
      if (drums && spec.clap.includes(q)) mixInto(bus, clap, secondsToSamples(t), 0.55);
      if (drums && spec.hat === "offbeat") mixInto(bus, hats[q], secondsToSamples(t + beat / 2), 0.7);
      if (drums && spec.hat === "sixteenths") {
        for (let s = 0; s < 4; s += 1) mixInto(bus, hats[s], secondsToSamples(t + (s * beat) / 4), s % 2 ? 0.35 : 0.6);
      }
      if (spec.bass === "eighths") {
        for (let e = 0; e < 2; e += 1) mixInto(bus, pan(note(chord.root, beat / 2, "saw", beat / 2, 500), 0), secondsToSamples(t + (e * beat) / 2), 0.55);
      } else if (spec.bass === "quarters") {
        mixInto(bus, pan(note(chord.root, beat, "saw", beat * 0.8, 450), 0), secondsToSamples(t), 0.5);
      }
      if (spec.arp) {
        for (let e = 0; e < 2; e += 1) {
          const tone = chord.triad[(q * 2 + e) % 3] * 2;
          mixInto(bus, pan(note(tone, 0.3, "triangle", 0.22, 3000), e ? 0.3 : -0.3), secondsToSamples(t + (e * beat) / 2), spec.arp);
        }
      }
    }
    if (spec.bass === "whole") mixInto(bus, pan(note(chord.root / 2, bar, "sine", bar, 200), 0), secondsToSamples(barStart), 0.7);
  }
  return bus;
}

// ---------------------------------------------------------------- WAV io

export function encodeWav({ l, r }) {
  const frames = l.length;
  const buffer = Buffer.alloc(44 + frames * 4);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + frames * 4, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24); buffer.writeUInt32LE(SAMPLE_RATE * 4, 28); buffer.writeUInt16LE(4, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i += 1) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i])) * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i])) * 32767), 46 + i * 4);
  }
  return buffer;
}

/** Decode PCM 16/24/32-bit or float32 WAV to mono Float32 at SAMPLE_RATE (linear resample). */
export function decodeWavMono(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a RIFF/WAVE file");
  }
  let offset = 12, fmt = null, data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "fmt ") fmt = { format: buffer.readUInt16LE(offset + 8), channels: buffer.readUInt16LE(offset + 10), rate: buffer.readUInt32LE(offset + 12), bits: buffer.readUInt16LE(offset + 22) };
    if (id === "data") data = { start: offset + 8, size: Math.min(size, buffer.length - offset - 8) };
    offset += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error("WAV missing fmt or data chunk");
  const bytes = fmt.bits / 8;
  const frames = Math.floor(data.size / (bytes * fmt.channels));
  const read = (pos) => {
    if (fmt.format === 3) return buffer.readFloatLE(pos);
    if (fmt.bits === 16) return buffer.readInt16LE(pos) / 32768;
    if (fmt.bits === 24) return buffer.readIntLE(pos, 3) / 8388608;
    if (fmt.bits === 32) return buffer.readInt32LE(pos) / 2147483648;
    throw new Error(`unsupported WAV bit depth ${fmt.bits}`);
  };
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c += 1) sum += read(data.start + (i * fmt.channels + c) * bytes);
    mono[i] = sum / fmt.channels;
  }
  if (fmt.rate === SAMPLE_RATE) return mono;
  const ratio = fmt.rate / SAMPLE_RATE;
  const out = new Float32Array(Math.round((frames * SAMPLE_RATE) / fmt.rate));
  for (let i = 0; i < out.length; i += 1) {
    const pos = i * ratio;
    const j = Math.floor(pos);
    const frac = pos - j;
    out[i] = mono[j] * (1 - frac) + (mono[Math.min(j + 1, frames - 1)] || 0) * frac;
  }
  return out;
}

// ---------------------------------------------------------------- render

/** Gain curve for the music bus: dips by `duckDb` while any VO clip plays (smooth attack/release). */
export function duckCurve(length, spans, duckDb = -10) {
  const curve = new Float32Array(length).fill(1);
  if (!spans.length) return curve;
  const target = new Float32Array(length).fill(1);
  const low = dbToGain(duckDb);
  spans.forEach(([start, end]) => {
    for (let i = Math.max(0, start); i < Math.min(length, end); i += 1) target[i] = low;
  });
  const attack = 1 / secondsToSamples(0.12);
  const release = 1 / secondsToSamples(0.45);
  let value = 1;
  for (let i = 0; i < length; i += 1) {
    value += (target[i] - value) * (target[i] < value ? attack : release) * 4;
    curve[i] = value;
  }
  return curve;
}

/**
 * Render a cue sheet. `voClips` maps each vo cue's file to decoded mono samples (the CLI loads them;
 * tests can inject them).
 */
export function renderMix(cues, voClips = {}) {
  const duration = Number(cues.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("cues.duration must be a positive number");
  const bpm = Number(cues.bpm ?? 128);
  const seed = Number(cues.seed ?? 7);
  const length = secondsToSamples(duration);
  const music = cues.music ?? { style: "none" };

  const musicBus = renderMusic(length, { bpm, style: music.style, drop: music.drop, seed });
  const sfxBus = stereo(length);
  const voBus = stereo(length);
  const random = seededRandom(seed);

  for (const cue of cues.sfx ?? []) {
    const make = SFX[cue.type];
    if (!make) throw new Error(`unknown sfx type "${cue.type}" (known: ${SFX_TYPES.join(", ")})`);
    const { buffer, offset } = make({ ...cue, random });
    mixInto(sfxBus, buffer, secondsToSamples(cue.t + offset), cue.gain ?? 0.8);
  }

  const spans = [];
  for (const cue of cues.vo ?? []) {
    const clip = voClips[cue.file];
    if (!clip) throw new Error(`missing decoded VO clip for "${cue.file}"`);
    const start = secondsToSamples(cue.t);
    mixInto(voBus, pan(clip, 0), start, cue.gain ?? 1);
    spans.push([start, start + clip.length]);
  }

  const duck = duckCurve(length, spans, cues.duckDb ?? -10);
  const fadeOut = secondsToSamples(music.fadeOut ?? 1.2);
  const fadeIn = secondsToSamples(0.05);
  const musicGain = music.gain ?? 0.5;
  const sum = stereo(length);
  let energy = 0;
  for (let i = 0; i < length; i += 1) {
    const edge = Math.min(1, i / fadeIn, (length - i) / Math.max(1, fadeOut));
    const m = musicGain * duck[i] * edge;
    sum.l[i] = musicBus.l[i] * m + sfxBus.l[i] + voBus.l[i];
    sum.r[i] = musicBus.r[i] * m + sfxBus.r[i] + voBus.r[i];
    energy += sum.l[i] * sum.l[i] + sum.r[i] * sum.r[i];
  }
  // Loudness: scale the whole mix to a target RMS (≈ -14 LUFS for social), then tanh soft-clips the
  // peaks without a lookahead limiter. Capped so a near-silent mix isn't blown up.
  const rms = Math.sqrt(energy / Math.max(1, length * 2));
  const master = rms > 0 ? Math.min(6, dbToGain(cues.targetDb ?? -17) / rms) : 1;
  const out = stereo(length);
  for (let i = 0; i < length; i += 1) {
    out.l[i] = Math.tanh(sum.l[i] * master);
    out.r[i] = Math.tanh(sum.r[i] * master);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const cuesPath = args.find((arg) => !arg.startsWith("--"));
  if (!cuesPath) {
    console.error("Usage: node sound.mjs <cues.json> [--out <file.wav>] [--dry-run]");
    process.exit(1);
  }
  const outFlag = args.indexOf("--out");
  const baseDir = dirname(resolve(cuesPath));
  const cues = JSON.parse(await readFile(cuesPath, "utf8"));
  const outPath = resolve(baseDir, outFlag >= 0 ? args[outFlag + 1] : cues.out ?? "assets/audio/mix.wav");

  const voClips = {};
  for (const cue of cues.vo ?? []) {
    voClips[cue.file] = decodeWavMono(await readFile(resolve(baseDir, cue.file)));
  }
  const summary = `${cues.duration}s · ${cues.bpm ?? 128} BPM · music ${cues.music?.style ?? "none"} · ${(cues.sfx ?? []).length} sfx · ${(cues.vo ?? []).length} vo`;
  if (args.includes("--dry-run")) {
    console.log(`[dry-run] would write ${outPath} (${summary})`);
    return;
  }
  const wav = encodeWav(renderMix(cues, voClips));
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, wav);
  console.log(`wrote ${outPath} (${summary})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`sound.mjs failed: ${error.message}`);
    process.exit(1);
  });
}
