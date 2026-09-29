#!/usr/bin/env node
// Copy the motion-director runtime (helpers, flavor CSS, fonts) into a HyperFrames project's assets/.
// With --demo <name>, it also seeds the project from one of the layout demos: index.html, cues.json and
// vo.json go to the project root, and only the media that demo references goes to assets/media/.
// Brand tokens ({{brand.name}} …) in index.html and vo.json are filled from brand.json (see brand.mjs).
// Existing files are never overwritten, so it is safe to re-run on a live project.
//
// Media for each file the demo references, first match wins: the project's own assets/media/ → the brand's
// logo/portrait → the skill's private assets/demos/_media/ → the committed SAMPLE placeholders.
//
// --sample-media skips the private _media folder, so the result is exactly what a fresh install produces.
//
// Usage: node scaffold.mjs <project-dir> [--demo <name>] [--aspect 16:9|9:16] [--brand <file>] [--sample-media] [--dry-run]
//        node scaffold.mjs --list
import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, writeFile, access, stat } from "node:fs/promises";
import { dirname, extname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { brandTokens, fillTemplate, loadBrand } from "./brand.mjs";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demosDir = join(skillRoot, "assets", "demos");
const ASPECTS = { "16:9": "", "9:16": "-9x16", "4:5": "-4x5" };
const BRAND_MEDIA = { logo: "logo-mark.webp", portrait: "portrait-cutout.webp" };

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Demo folders grouped by layout: { "launch-hype": ["16:9", "9:16"], … }. */
export function groupDemos(folderNames) {
  const groups = {};
  for (const name of folderNames.filter((n) => !n.startsWith("_")).sort()) {
    const match = /^(.*?)(-9x16|-4x5)?$/.exec(name);
    const aspect = Object.entries(ASPECTS).find(([, suffix]) => suffix === (match[2] ?? ""))[0];
    (groups[match[1]] ??= []).push(aspect);
  }
  return groups;
}

/** Folder name for a demo at an aspect, or a helpful error. */
export function demoFolder(groups, demo, aspect = "16:9") {
  if (!(aspect in ASPECTS)) throw new Error(`unknown aspect "${aspect}". Use one of: ${Object.keys(ASPECTS).join(", ")}`);
  if (!groups[demo]) throw new Error(`unknown demo "${demo}". Available: ${Object.keys(groups).join(", ")}`);
  if (!groups[demo].includes(aspect)) {
    const has = Object.entries(groups).filter(([, list]) => list.includes(aspect)).map(([name]) => name);
    throw new Error(
      `"${demo}" has no ${aspect} version yet${has.length ? ` (ready-made ${aspect}: ${has.join(", ")})` : ""}. ` +
        `Scaffold it at 16:9 and re-layout per references/story-structures.md ("Aspect ratios").`,
    );
  }
  return demo + ASPECTS[aspect];
}

/** Unique `assets/media/<file>` names a composition references (src, url(), mask images). */
export function mediaReferences(html) {
  return [...new Set([...html.matchAll(/assets\/media\/([A-Za-z0-9._-]+)/g)].map((m) => m[1]))].sort();
}

/** First existing source for a media file, in priority order, with where it came from. */
export async function pickMediaSource(name, { projectDir, brandMedia = {}, has = exists, ownMedia = true }) {
  if (await has(join(projectDir, "assets/media", name))) return { kind: "project" };
  if (brandMedia[name]) return { kind: "brand", path: brandMedia[name] };
  if (ownMedia && (await has(join(demosDir, "_media", name)))) return { kind: "own", path: join(demosDir, "_media", name) };
  if (await has(join(demosDir, "_placeholders", name))) return { kind: "sample", path: join(demosDir, "_placeholders", name) };
  return { kind: "missing" };
}

async function listFiles(dir) {
  if (!(await exists(dir))) return [];
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else out.push(full);
  }
  return out;
}

export function parseArgs(argv) {
  const valueFlags = ["--demo", "--aspect", "--brand"];
  const opts = { dryRun: argv.includes("--dry-run"), list: argv.includes("--list"), sampleMedia: argv.includes("--sample-media") };
  const consumed = new Set();
  for (const flag of valueFlags) {
    const i = argv.indexOf(flag);
    if (i < 0) continue;
    if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error(`${flag} needs a value`);
    opts[flag.slice(2)] = argv[i + 1];
    consumed.add(i + 1);
  }
  opts.target = argv.find((arg, i) => !arg.startsWith("--") && !consumed.has(i));
  return opts;
}

/** Writes a brand logo/portrait as WebP (FFmpeg converts PNG/JPG; WebP is copied as-is). */
async function convertToWebp(from, to) {
  if (extname(from).toLowerCase() === ".webp") return cp(from, to);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", from, "-c:v", "libwebp", "-quality", "90", "-pix_fmt", "yuva420p", to]);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const groups = groupDemos((await readdir(demosDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name));
  if (opts.list) {
    for (const [name, aspects] of Object.entries(groups)) console.log(`${name.padEnd(18)} ${aspects.join(", ")}`);
    return;
  }
  if (!opts.target) {
    console.error("Usage: node scaffold.mjs <project-dir> [--demo <name>] [--aspect 16:9|9:16] [--brand <file>] [--sample-media] [--dry-run] | --list");
    process.exit(1);
  }
  if (!opts.demo && opts.aspect) throw new Error("--aspect only applies together with --demo");
  const folder = opts.demo ? demoFolder(groups, opts.demo, opts.aspect) : null;

  const projectDir = resolve(opts.target);
  const { brand, source: brandSource } = await loadBrand({ explicit: opts.brand, projectDir, skillRoot });
  const tokens = brandTokens(brand);
  // Logo/portrait paths in brand.json are relative to the brand.json file itself.
  const brandDir = brandSource === "sample" ? skillRoot : dirname(brandSource);
  const brandMedia = {};
  for (const [field, name] of Object.entries(BRAND_MEDIA)) {
    if (!brand[field]) continue;
    const path = resolve(brandDir, brand[field]);
    if (!(await exists(path))) throw new Error(`brand ${field} not found: ${path}`);
    brandMedia[name] = path;
  }

  // [source, destination, transform?]
  const plan = [
    [join(skillRoot, "assets/motion-director.js"), join(projectDir, "assets/motion-director.js")],
    [join(skillRoot, "assets/motion-director.css"), join(projectDir, "assets/motion-director.css")],
  ];
  for (const file of await listFiles(join(skillRoot, "assets/fonts"))) {
    plan.push([file, join(projectDir, "assets/fonts", relative(join(skillRoot, "assets/fonts"), file))]);
  }
  const media = { sample: [], missing: [], brand: [] };
  if (folder) {
    const demoDir = join(demosDir, folder);
    for (const file of await listFiles(demoDir)) {
      const rel = relative(demoDir, file);
      // vo/ holds generated speech; voice.mjs rebuilds it from the brand-filled vo.json.
      if (rel.split(/[\\/]/)[0] === "vo") continue;
      const format = rel === "index.html" ? "html" : rel === "vo.json" ? "json" : null;
      plan.push([file, join(projectDir, rel), format && ((text) => fillTemplate(text, tokens, format))]);
    }
    for (const name of mediaReferences(await readFile(join(demoDir, "index.html"), "utf8"))) {
      const pick = await pickMediaSource(name, { projectDir, brandMedia, ownMedia: !opts.sampleMedia });
      if (pick.kind in media) media[pick.kind].push(name);
      if (pick.path) plan.push([pick.path, join(projectDir, "assets/media", name), pick.kind === "brand" ? "webp" : null]);
    }
  }

  let written = 0;
  for (const [from, to, transform] of plan) {
    const shown = relative(projectDir, to);
    if (await exists(to)) {
      console.log(`skip   ${shown} (already exists)`);
      continue;
    }
    if (opts.dryRun) {
      console.log(`would  write ${shown}`);
      continue;
    }
    await mkdir(dirname(to), { recursive: true });
    if (transform === "webp") await convertToWebp(from, to);
    else if (typeof transform === "function") await writeFile(to, transform(await readFile(from, "utf8")));
    else await cp(from, to, { force: false, errorOnExist: false });
    if ((await stat(to)).isFile()) written += 1;
  }

  console.log(opts.dryRun ? "Dry run: nothing written." : `Done: ${written} file(s) written into ${projectDir}`);
  if (folder) {
    console.log(brandSource === "sample"
      ? `Brand: SAMPLE ("${brand.name}"). Copy brand.example.json to brand.json (in the skill folder for your own brand, or in the project folder for a client), then scaffold into a fresh folder.`
      : `Brand: ${brand.name} (from ${brandSource})`);
  }
  if (media.brand.length) console.log(`Brand media: ${media.brand.join(", ")}`);
  if (media.sample.length) {
    console.log(`\nSample media (${media.sample.length}), tagged SAMPLE. Replace these in assets/media/ before publishing`);
    console.log("(assets/demos/MEDIA.md says what each should show):");
    for (const name of media.sample) console.log(`  - ${name}`);
  }
  if (media.missing.length) {
    console.log(`\nMissing media (${media.missing.length}). Add images under assets/media/ with these names:`);
    for (const name of media.missing) console.log(`  - ${name}`);
  }
  if (folder && !opts.dryRun) {
    if (await exists(join(demosDir, folder, "vo.json"))) {
      console.log(`Voice: node ${join(skillRoot, "scripts/voice.mjs")} ${join(projectDir, "vo.json")}   (regenerates vo/*.wav if missing)`);
    }
    console.log(`Sound: node ${join(skillRoot, "scripts/sound.mjs")} ${join(projectDir, "cues.json")}   (renders assets/audio/mix.wav)`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`scaffold failed: ${error.message}`);
    process.exit(1);
  });
}
