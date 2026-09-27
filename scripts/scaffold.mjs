#!/usr/bin/env node
// Copy the aj-motion-style runtime (helpers, flavor CSS, fonts) into a HyperFrames project's assets/.
// With --demo <name>, it also seeds the project from one of the layout demos: index.html, cues.json,
// vo.json and vo/ go to the project root, and only the media that demo references goes to assets/media/.
// Existing files are never overwritten, so it is safe to re-run on a live project.
//
// Usage: node scaffold.mjs <project-dir> [--demo <name>] [--dry-run]
//        node scaffold.mjs --list
import { cp, readdir, readFile, access, stat } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demosDir = join(skillRoot, "assets", "demos");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listDemos() {
  const entries = await readdir(demosDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && !e.name.startsWith("_")).map((e) => e.name);
}

/** Unique `assets/media/<file>` names a composition references (src, url(), mask images). */
export function mediaReferences(html) {
  return [...new Set([...html.matchAll(/assets\/media\/([A-Za-z0-9._-]+)/g)].map((m) => m[1]))].sort();
}

async function referencedMedia(indexPath) {
  return mediaReferences(await readFile(indexPath, "utf8"));
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

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    console.log((await listDemos()).join("\n"));
    return;
  }
  const dryRun = args.includes("--dry-run");
  const demoFlag = args.indexOf("--demo");
  const demo = demoFlag >= 0 ? args[demoFlag + 1] : null;
  const target = args.find((arg, i) => !arg.startsWith("--") && !(demoFlag >= 0 && i === demoFlag + 1));
  if (!target) {
    console.error("Usage: node scaffold.mjs <project-dir> [--demo <name>] [--dry-run] | --list");
    process.exit(1);
  }
  if (demo && !(await listDemos()).includes(demo)) {
    throw new Error(`unknown demo "${demo}". Available: ${(await listDemos()).join(", ")}`);
  }

  const projectDir = resolve(target);
  // [source file, destination file]
  const plan = [
    [join(skillRoot, "assets/aj-motion.js"), join(projectDir, "assets/aj-motion.js")],
    [join(skillRoot, "assets/aj-motion.css"), join(projectDir, "assets/aj-motion.css")],
  ];
  for (const file of await listFiles(join(skillRoot, "assets/fonts"))) {
    plan.push([file, join(projectDir, "assets/fonts", relative(join(skillRoot, "assets/fonts"), file))]);
  }
  const missingMedia = [];
  if (demo) {
    const demoDir = join(demosDir, demo);
    for (const file of await listFiles(demoDir)) plan.push([file, join(projectDir, relative(demoDir, file))]);
    // Copy only the media this demo references. _media is not in git, so on a fresh clone it may be
    // empty; list what's missing so the user knows exactly which images to supply.
    for (const name of await referencedMedia(join(demoDir, "index.html"))) {
      const source = join(demosDir, "_media", name);
      if (await exists(source)) plan.push([source, join(projectDir, "assets/media", name)]);
      else if (!(await exists(join(projectDir, "assets/media", name)))) missingMedia.push(name);
    }
  }

  let copied = 0;
  for (const [from, to] of plan) {
    const shown = relative(projectDir, to);
    if (await exists(to)) {
      console.log(`skip   ${shown} (already exists)`);
      continue;
    }
    if (dryRun) {
      console.log(`would  copy ${shown}`);
      continue;
    }
    await cp(from, to, { force: false, errorOnExist: false });
    if ((await stat(to)).isFile()) copied += 1;
  }
  console.log(dryRun ? "Dry run: nothing written." : `Done: ${copied} file(s) copied into ${projectDir}`);
  if (missingMedia.length) {
    console.log(`\nMissing media (${missingMedia.length}). Add your own images under assets/media/ with these names`);
    console.log("(see assets/demos/MEDIA.md for what each one should show):");
    for (const name of missingMedia) console.log(`  - ${name}`);
  }
  if (demo && !dryRun) {
    if (await exists(join(demosDir, demo, "vo.json"))) {
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
