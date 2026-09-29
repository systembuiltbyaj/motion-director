#!/usr/bin/env node
// Preflight for motion-director: checks everything the skill needs and prints the fix for anything missing.
// Required items fail the run (exit 1); optional ones only unlock extras (voice sync, site capture).
// Chrome detection is delegated to `hyperframes doctor`, which owns the render browser.
//
// Usage: node doctor.mjs [--json]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBrand } from "./brand.mjs";
import { findChromium, loadPlaywright } from "./playwright.mjs";
import { HYPERFRAMES } from "./voice.mjs";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const byOs = (fixes) => fixes[process.platform] ?? fixes.default;

/** Runs a command and returns { ok, out }. Only npx needs a shell on Windows (it is a .cmd shim); a shell
 * would split any other argument that contains spaces. */
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: isWindows && command === "npx", timeout: 180000 });
  return { ok: result.status === 0, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

export const nodeMajor = (version) => Number(/^v?(\d+)/.exec(version)?.[1] ?? 0);

/** Pulls the Chrome row out of `hyperframes doctor` output: { ok, detail } or undefined. */
export function chromeFromDoctor(output) {
  const line = output.split(/\r?\n/).find((l) => /^\s*[✓✗]\s+Chrome\b/.test(l));
  if (!line) return undefined;
  return { ok: line.trim().startsWith("✓"), detail: line.replace(/^\s*[✓✗]\s+Chrome\s*/, "").trim() };
}

/** Exit code and one-line verdict for a list of { required, ok } checks. */
export function verdict(checks) {
  const failed = checks.filter((c) => c.required && !c.ok);
  const optional = checks.filter((c) => !c.required && !c.ok);
  if (failed.length) return { code: 1, text: `${failed.length} required item(s) missing. Fix those, then run doctor again.` };
  if (optional.length) return { code: 0, text: `Ready. ${optional.length} optional extra(s) not set up (see above).` };
  return { code: 0, text: "Ready. Everything is set up." };
}

function checks() {
  const list = [];
  const add = (required, name, ok, detail, fix) => list.push({ required, name, ok, detail, fix });

  const major = nodeMajor(process.version);
  add(true, "Node.js 22+", major >= 22, process.version, "Install Node 22 LTS or newer: https://nodejs.org");

  const ffmpeg = run("ffmpeg", ["-hide_banner", "-encoders"]);
  add(true, "FFmpeg", ffmpeg.ok, ffmpeg.ok ? "on PATH" : "not found", byOs({
    win32: "winget install Gyan.FFmpeg   (then open a new terminal)",
    darwin: "brew install ffmpeg",
    default: "sudo apt install ffmpeg   (or your distro's package)",
  }));
  if (ffmpeg.ok) add(true, "FFmpeg WebP encoder", /libwebp/.test(ffmpeg.out), /libwebp/.test(ffmpeg.out) ? "libwebp" : "missing", "Install a full FFmpeg build (the winget/brew builds include libwebp).");
  const ffprobe = run("ffprobe", ["-version"]);
  add(true, "FFprobe", ffprobe.ok, ffprobe.ok ? "on PATH" : "not found", "Ships with FFmpeg; reinstall FFmpeg if it's missing.");

  const cli = run("npx", ["--yes", HYPERFRAMES, "--version"]);
  add(true, "HyperFrames CLI", cli.ok, cli.ok ? HYPERFRAMES : "npx could not run it", "Check your internet connection and npm, then: npx hyperframes@latest --version");
  if (cli.ok) {
    const chrome = chromeFromDoctor(run("npx", ["--yes", HYPERFRAMES, "doctor"]).out);
    add(true, "Chrome (render)", chrome?.ok ?? false, chrome?.detail ?? "not reported", `npx ${HYPERFRAMES} browser ensure`);
  }

  const skillsDir = join(homedir(), ".claude", "skills");
  const hyperframesSkill = existsSync(join(skillsDir, "hyperframes", "SKILL.md"));
  add(true, "HyperFrames skills", hyperframesSkill, hyperframesSkill ? "~/.claude/skills/hyperframes" : "not installed", "npx skills add heygen-com/hyperframes --all");
  const expected = join(skillsDir, "motion-director");
  add(true, "Skill location", resolve(skillRoot) === resolve(expected), skillRoot, `Clone into ${expected} so Claude Code finds it.`);

  const brandPath = join(skillRoot, "brand.json");
  let brandOk = false;
  let brandDetail = "not set (demos use the sample brand)";
  if (existsSync(brandPath)) {
    try {
      brandDetail = validateBrand(JSON.parse(readFileSync(brandPath, "utf8"))).name;
      brandOk = true;
    } catch (error) {
      brandDetail = error.message.split("\n")[0];
    }
  }
  add(false, "Your brand.json", brandOk, brandDetail, `Copy ${join(skillRoot, "brand.example.json")} to ${brandPath} and fill it in (or ask Claude to).`);

  const python = run(isWindows ? "python" : "python3", ["-c", "import whisper, sys; print(sys.version.split()[0])"]);
  add(false, "Whisper (voice sync)", python.ok, python.ok ? `python ${python.out.trim()}` : "not installed", "pip install openai-whisper   (needs Python 3.9+)");

  let playwrightOk = false;
  try {
    loadPlaywright();
    playwrightOk = Boolean(findChromium());
  } catch {
    playwrightOk = false;
  }
  add(false, "Playwright (site capture)", playwrightOk, playwrightOk ? "found with Chromium" : "not found", "npm i -D playwright && npx playwright install chromium   (in your project folder)");
  return list;
}

function main() {
  const results = checks();
  const result = verdict(results);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ ...result, checks: results }, null, 2));
    process.exit(result.code);
  }
  console.log("motion-director doctor\n");
  for (const check of results) {
    const mark = check.ok ? "ok  " : check.required ? "FAIL" : "opt ";
    console.log(`  ${mark}  ${check.name.padEnd(26)} ${check.detail}`);
    if (!check.ok) console.log(`        fix: ${check.fix}`);
  }
  console.log(`\n${result.text}`);
  process.exit(result.code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
