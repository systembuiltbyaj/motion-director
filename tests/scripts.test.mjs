import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaReferences } from "../scripts/scaffold.mjs";
import { parseTargets } from "../scripts/capture-site.mjs";
import { findChromium, launchOptions, newestChromiumDir, playwrightBases } from "../scripts/playwright.mjs";

test("mediaReferences finds src, url() and mask references once each, sorted", () => {
  const html = `
    <img src="assets/media/w-convert.webp" />
    <div style="mask: url('assets/media/aj-mark-dark.webp') center"></div>
    <img src="assets/media/w-convert.webp" />
    <img src="assets/media/gohighlevel.png" />`;
  assert.deepEqual(mediaReferences(html), ["aj-mark-dark.webp", "gohighlevel.png", "w-convert.webp"]);
});

test("mediaReferences ignores non-media assets", () => {
  assert.deepEqual(mediaReferences('<script src="assets/aj-motion.js"></script>'), []);
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
