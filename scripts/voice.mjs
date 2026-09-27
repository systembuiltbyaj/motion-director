#!/usr/bin/env node
// Generate voiceover lines locally with HyperFrames' Kokoro TTS (free, offline after first model
// download), one WAV per line, then print each line's duration so the timeline can be built around
// real speech instead of guesses. Existing WAVs are reused unless --force.
//
// Usage: node voice.mjs <vo.json> [--force] [--dry-run]
// vo.json: { "voice": "am_michael", "speed": 1.0, "dir": "vo", "lines": [{ "id": "l1", "text": "..." }] }
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeWavMono, SAMPLE_RATE } from "./sound.mjs";

const HYPERFRAMES = "hyperframes@0.8.77";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const specPath = args.find((arg) => !arg.startsWith("--"));
  if (!specPath) {
    console.error("Usage: node voice.mjs <vo.json> [--force] [--dry-run]");
    process.exit(1);
  }
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const baseDir = dirname(resolve(specPath));
  const spec = JSON.parse(await readFile(specPath, "utf8"));
  if (!Array.isArray(spec.lines) || spec.lines.length === 0) throw new Error("vo.json needs a non-empty lines array");
  const outDir = join(baseDir, spec.dir ?? "vo");
  if (!dryRun) await mkdir(outDir, { recursive: true });

  let total = 0;
  for (const line of spec.lines) {
    if (!line.id || !line.text) throw new Error("each line needs an id and text");
    const out = join(outDir, `${line.id}.wav`);
    if (dryRun) {
      console.log(`[dry-run] ${line.id}: "${line.text}" -> ${out}`);
      continue;
    }
    if (force || !(await exists(out))) {
      // Text goes through a .txt file: on Windows npx needs a shell, which would split raw text on spaces.
      const textFile = join(outDir, `${line.id}.txt`);
      await writeFile(textFile, line.text, "utf8");
      const quote = (value) => (process.platform === "win32" ? `"${value}"` : value);
      const result = spawnSync(
        "npx",
        ["--yes", HYPERFRAMES, "tts", quote(textFile), "--voice", spec.voice ?? "am_michael", "--speed", String(line.speed ?? spec.speed ?? 1), "--output", quote(out)],
        { encoding: "utf8", shell: process.platform === "win32" },
      );
      if (result.status !== 0) throw new Error(`tts failed for ${line.id}: ${(result.stderr || result.stdout).slice(-400)}`);
    }
    const seconds = decodeWavMono(await readFile(out)).length / SAMPLE_RATE;
    total += seconds;
    console.log(`${line.id}\t${seconds.toFixed(2)}s\t${line.text}`);
  }
  if (!dryRun) console.log(`total speech ${total.toFixed(2)}s`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`voice.mjs failed: ${error.message}`);
    process.exit(1);
  });
}
