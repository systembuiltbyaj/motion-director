// WAV helpers and level matching for voiceover lines. Every provider's output is brought to the same
// voiced level, so switching Kokoro → ElevenLabs → a cloned voice doesn't change the mix.
import { decodeWavMono, SAMPLE_RATE } from "../sound.mjs";

// Voiced RMS of Kokoro lines (measured 2026-09-29 over 24 lines: -20.4 and -20.7 dBFS averages, -22..-19
// range). Raw ElevenLabs lines measured -20.5, so this is a sane shared level for any provider.
export const VOICE_TARGET_DB = -20.5;
export const VOICE_CEILING_DB = -1;
// Samples more than 45 dB below the line's peak are pauses; counting them would make a line with gaps read
// as quiet. The gate is relative to the peak so the measure moves exactly with gain.
const VOICED_GATE_DB = -45;

/** Wrap raw 16-bit little-endian mono PCM in a WAV header. */
export function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Float samples (-1..1) to a 16-bit mono WAV. */
export function floatToWav(samples, sampleRate = SAMPLE_RATE) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  return pcmToWav(pcm, sampleRate);
}

export const isWav = (buffer) => buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE";

/** RMS of the voiced samples only, in dBFS; -Infinity for silence. */
export function voicedRmsDb(samples) {
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const gate = peak * 10 ** (VOICED_GATE_DB / 20);
  let sum = 0;
  let count = 0;
  for (const value of samples) {
    if (peak > 0 && Math.abs(value) > gate) {
      sum += value * value;
      count += 1;
    }
  }
  return count ? 10 * Math.log10(sum / count) : -Infinity;
}

export function peakDb(samples) {
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  return 20 * Math.log10(peak);
}

/** Gain (dB) that brings a line to the target level without pushing its peak past the ceiling. */
export function levelGainDb(samples, { targetDb = VOICE_TARGET_DB, ceilingDb = VOICE_CEILING_DB } = {}) {
  const level = voicedRmsDb(samples);
  if (!Number.isFinite(level)) throw new Error("the line is silent: the provider returned no speech");
  return Math.min(targetDb - level, ceilingDb - peakDb(samples));
}

/** Level-match one WAV (any rate/depth) and return it as 44.1 kHz 16-bit mono. */
export function normalizeWav(wav, options) {
  const samples = decodeWavMono(wav);
  const gainDb = levelGainDb(samples, options);
  const gain = 10 ** (gainDb / 20);
  return { wav: floatToWav(samples.map((value) => value * gain)), gainDb };
}
