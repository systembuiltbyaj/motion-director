import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { demoFolder, groupDemos, mediaReferences, parseArgs, pickMediaSource } from "../scripts/scaffold.mjs";
import { parseTargets } from "../scripts/capture-site.mjs";
import { findChromium, launchOptions, newestChromiumDir, playwrightBases } from "../scripts/playwright.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMOS = join(ROOT, "assets/demos");
const SCAFFOLD = join(ROOT, "scripts/scaffold.mjs");

test("mediaReferences finds src, url() and mask references once each, sorted", () => {
  const html = `
    <img src="assets/media/w-convert.webp" />
    <div style="mask: url('assets/media/brand-mark.webp') center"></div>
    <img src="assets/media/w-convert.webp" />
    <img src="assets/media/gohighlevel.png" />`;
  assert.deepEqual(mediaReferences(html), ["brand-mark.webp", "gohighlevel.png", "w-convert.webp"]);
});

test("mediaReferences ignores non-media assets", () => {
  assert.deepEqual(mediaReferences('<script src="assets/motion-director.js"></script>'), []);
});

test("parseTargets splits name=url pairs and skips flags", () => {
  assert.deepEqual(parseTargets(["site=https://example.com/a=b", "--width", "1440"]), [
    { name: "site", url: "https://example.com/a=b" },
  ]);
});

test("parseTargets rejects bad names and non-http URLs", () => {
  assert.throws(() => parseTargets(["../x=https://example.com"]), /slug/);
  assert.throws(() => parseTargets(["site=ftp://example.com"]), /http/);
});

test("playwrightBases tries PLAYWRIGHT_FROM, then the project, then npx cache entries in order", () => {
  const bases = playwrightBases({ cwd: "/proj", env: { PLAYWRIGHT_FROM: "/pw/package.json" }, npxEntries: ["/npx/a", "/npx/b"] });
  assert.equal(bases.length, 4);
  assert.match(bases[0], /pw[\\/]package\.json$/);
  assert.match(bases[1], /proj[\\/]package\.json$/);
  assert.match(bases[3], /npx[\\/]b[\\/]package\.json$/);
});

test("playwrightBases skips an unset PLAYWRIGHT_FROM", () => {
  assert.equal(playwrightBases({ cwd: "/proj", env: {} }).length, 1);
});

test("newestChromiumDir picks the highest chromium revision and ignores other browsers", () => {
  assert.equal(newestChromiumDir(["chromium-1187", "chromium_headless_shell-1243", "chromium-1243", "firefox-1490"]), "chromium-1243");
  assert.equal(newestChromiumDir(["firefox-1490"]), undefined);
});

test("findChromium and launchOptions honour PLAYWRIGHT_CHROMIUM", () => {
  const env = { PLAYWRIGHT_CHROMIUM: "/opt/chrome" };
  assert.equal(findChromium(env), "/opt/chrome");
  assert.deepEqual(launchOptions({ headless: true }, env), { executablePath: "/opt/chrome", headless: true });
});

test("findChromium returns undefined when no browsers folder exists", () => {
  assert.equal(findChromium({ PLAYWRIGHT_BROWSERS_PATH: "/definitely/not/here" }), undefined);
});

test("groupDemos groups aspect variants under their layout", () => {
  assert.deepEqual(groupDemos(["_media", "launch-hype", "launch-hype-9x16", "brand-system", "_placeholders"]), {
    "brand-system": ["16:9"],
    "launch-hype": ["16:9", "9:16"],
  });
});

test("demoFolder resolves aspects and explains what is missing", () => {
  const groups = { "launch-hype": ["16:9", "9:16"], "brand-system": ["16:9"] };
  assert.equal(demoFolder(groups, "launch-hype"), "launch-hype");
  assert.equal(demoFolder(groups, "launch-hype", "9:16"), "launch-hype-9x16");
  assert.throws(() => demoFolder(groups, "brand-system", "9:16"), /no 9:16 version yet \(ready-made 9:16: launch-hype\)/);
  assert.throws(() => demoFolder(groups, "nope"), /unknown demo/);
  assert.throws(() => demoFolder(groups, "launch-hype", "3:2"), /unknown aspect/);
});

test("demoFolder defaults to 16:9, or to a demo's only aspect", () => {
  const groups = { "ui-morph-loop": ["1:1"], "launch-hype": ["16:9", "9:16"] };
  assert.deepEqual(groupDemos(["ui-morph-loop-1x1", "launch-hype", "launch-hype-9x16"]), groups);
  assert.equal(demoFolder(groups, "ui-morph-loop"), "ui-morph-loop-1x1");
  assert.equal(demoFolder(groups, "launch-hype"), "launch-hype");
  assert.throws(() => demoFolder(groups, "ui-morph-loop", "16:9"), /no 16:9 version yet/);
});

test("parseArgs reads value flags and the target in any order", () => {
  assert.deepEqual(parseArgs(["--demo", "launch-hype", "out", "--aspect", "9:16", "--dry-run"]), {
    dryRun: true, list: false, sampleMedia: false, demo: "launch-hype", aspect: "9:16", target: "out",
  });
  assert.throws(() => parseArgs(["out", "--demo"]), /--demo needs a value/);
});

test("pickMediaSource prefers project, then brand, then own media, then samples", async () => {
  const only = (...suffixes) => async (path) => suffixes.some((s) => path.replace(/\\/g, "/").endsWith(s));
  const opts = { projectDir: "/proj", brandMedia: { "logo-mark.webp": "/brand/logo.png" } };
  assert.equal((await pickMediaSource("a.webp", { ...opts, has: only("proj/assets/media/a.webp") })).kind, "project");
  assert.equal((await pickMediaSource("logo-mark.webp", { ...opts, has: only("_placeholders/logo-mark.webp") })).kind, "brand");
  assert.equal((await pickMediaSource("a.webp", { ...opts, has: only("_media/a.webp", "_placeholders/a.webp") })).kind, "own");
  assert.equal((await pickMediaSource("a.webp", { ...opts, has: only("_placeholders/a.webp") })).kind, "sample");
  assert.equal((await pickMediaSource("a.webp", { ...opts, ownMedia: false, has: only("_media/a.webp", "_placeholders/a.webp") })).kind, "sample");
  assert.equal((await pickMediaSource("a.webp", { ...opts, has: only() })).kind, "missing");
});

test("every demo has a SAMPLE placeholder for each media file it references", async () => {
  const demos = (await readdir(DEMOS, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith("_"));
  const samples = new Set(await readdir(join(DEMOS, "_placeholders")));
  for (const demo of demos) {
    const missing = mediaReferences(await readFile(join(DEMOS, demo.name, "index.html"), "utf8")).filter((name) => !samples.has(name));
    assert.deepEqual(missing, [], `${demo.name} references media with no placeholder`);
  }
});

test("scaffolding every demo fills all brand tokens and skips generated voice", async () => {
  const work = await mkdtemp(join(tmpdir(), "scaffold-e2e-"));
  const brandFile = join(work, "brand.json");
  await writeFile(brandFile, JSON.stringify({ name: "Acme <Dental>", firstName: "Sam", url: "acme.test", handle: "@acme" }));
  const groups = groupDemos((await readdir(DEMOS, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name));
  for (const [demo, aspects] of Object.entries(groups)) {
    for (const aspect of aspects) {
      const project = join(work, `${demo}-${aspect.replace(":", "x")}`);
      execFileSync(process.execPath, [SCAFFOLD, project, "--demo", demo, "--aspect", aspect, "--brand", brandFile, "--sample-media"], { encoding: "utf8" });
      const html = await readFile(join(project, "index.html"), "utf8");
      assert.doesNotMatch(html, /\{\{brand\./, `${demo} ${aspect} left a brand token`);
      assert.doesNotMatch(html, /System Built by AJ|workwithaj|Bactad/, `${demo} ${aspect} still carries the author's brand`);
      assert.equal(existsSync(join(project, "vo")), false, `${demo} ${aspect} copied generated voice`);
      for (const name of mediaReferences(html)) assert.ok(existsSync(join(project, "assets/media", name)), `${demo} ${aspect} is missing ${name}`);
      if (existsSync(join(project, "vo.json"))) assert.doesNotMatch(await readFile(join(project, "vo.json"), "utf8"), /\{\{brand\./);
    }
  }
  const reveal = await readFile(join(work, "portfolio-reveal-16x9", "index.html"), "utf8");
  assert.match(reveal, /Acme &lt;Dental&gt;|Acme/);
  assert.match(reveal, />Sam</);
});
