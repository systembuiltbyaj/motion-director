#!/usr/bin/env node
// One frame per beat of a render, tiled into a contact sheet, so "look at every beat" is one command.
// Read the sheet before the final render: a beat where nothing changed, a half-built frame or a
// collision shows up at a glance.
//
// Usage: node beat-frames.mjs <video.mp4> --bpm <n> [--offset <s>] [--every <beats>] [--out <sheet.png>]
//                             [--cols <n>] [--width <px per frame>]
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

/** Beat times (s) from `offset` to the end of the video, every `every` beats. */
export function beatTimes(duration, bpm, { offset = 0, every = 1 } = {}) {
  if (!(bpm > 0)) throw new RangeError("bpm must be greater than 0");
  if (!(duration > 0)) throw new RangeError("duration must be greater than 0");
  const step = (60 / bpm) * every;
  const times = [];
  for (let t = offset; t < duration - 1e-6; t += step) times.push(Math.round(t * 1000) / 1000);
  return times;
}

/** Near-square grid for `count` frames (or a fixed column count). */
export function sheetGrid(count, cols) {
  if (cols) return { cols: Math.min(cols, count), rows: Math.ceil(count / Math.min(cols, count)) };
  // About twice as wide as tall, which suits a wall of 16:9 frames.
  const rows = Math.ceil(Math.sqrt(count / 2));
  return { cols: Math.ceil(count / rows), rows };
}

export function parseArgs(args) {
  const value = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const flags = new Set(["--bpm", "--offset", "--every", "--out", "--cols", "--width"]);
  const video = args.find((arg, i) => !arg.startsWith("--") && !flags.has(args[i - 1]));
  const bpm = Number(value("--bpm"));
  if (!video) throw new Error("give the rendered video as the first argument");
  if (!(bpm > 0)) throw new Error("--bpm is required (the cue sheet's bpm)");
  return {
    video,
    bpm,
    offset: Number(value("--offset") ?? 0),
    every: Number(value("--every") ?? 1),
    out: value("--out"),
    cols: value("--cols") ? Number(value("--cols")) : undefined,
    width: Number(value("--width") ?? 320),
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || "").slice(-300)}`);
  return result.stdout;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const duration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", opts.video]).trim());
  const times = beatTimes(duration, opts.bpm, opts);
  const { cols, rows } = sheetGrid(times.length, opts.cols);
  const out = resolve(opts.out ?? join(dirname(opts.video), `${basename(opts.video, extname(opts.video))}-beats.png`));
  const work = await mkdtemp(join(tmpdir(), "md-beats-"));
  try {
    times.forEach((t, i) => {
      run("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", opts.video, "-frames:v", "1", "-vf", `scale=${opts.width}:-2`, join(work, `f${String(i).padStart(3, "0")}.png`)]);
    });
    run("ffmpeg", ["-v", "error", "-y", "-i", join(work, "f%03d.png"), "-vf", `tile=${cols}x${rows}:padding=4:color=black`, "-frames:v", "1", out]);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  console.log(`${times.length} beats at ${opts.bpm} BPM → ${out} (${cols}×${rows}, left to right)`);
  times.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}  ${t.toFixed(2)}s`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`beat-frames.mjs failed: ${error.message}`);
    process.exit(1);
  });
}
