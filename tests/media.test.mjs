import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyShape, contrast, fitFor, quantize, slugName, suggestTokens } from "../scripts/prep-media.mjs";
import { chromeFromDoctor, nodeMajor, verdict } from "../scripts/doctor.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("classifyShape sorts images by the move they suit", () => {
  assert.equal(classifyShape(1440, 3600), "tall-page");
  assert.equal(classifyShape(1080, 1350), "portrait");
  assert.equal(classifyShape(512, 512), "square");
  assert.equal(classifyShape(1920, 1080), "screen");
  assert.equal(classifyShape(1472, 520), "wide-strip");
});

test("fitFor grades resolution per aspect", () => {
  assert.deepEqual(fitFor(1920), { "16:9": "full-frame", "9:16": "full-frame" });
  assert.deepEqual(fitFor(1200), { "16:9": "card", "9:16": "full-frame" });
  assert.deepEqual(fitFor(700), { "16:9": "small", "9:16": "card" });
});

test("quantize finds dominant opaque colors with shares that add up", () => {
  // 100 opaque pixels (80 dark, 20 yellow) plus 50 transparent ones that must not count.
  const bytes = Buffer.alloc(150 * 4);
  for (let i = 0; i < 150; i += 1) {
    const color = i < 80 ? [10, 10, 20, 255] : i < 100 ? [247, 203, 30, 255] : [0, 0, 0, 0];
    bytes.set(color, i * 4);
  }
  const palette = quantize(bytes);
  assert.equal(palette.length, 2);
  assert.equal(palette[0].share, 80);
  assert.equal(palette[1].hex, "#f7cb1e");
});

test("suggestTokens picks a saturated accent and readable text on it", () => {
  const tokens = suggestTokens([
    { hex: "#0a0a14", rgb: [10, 10, 20], share: 80 },
    { hex: "#f7cb1e", rgb: [247, 203, 30], share: 12 },
    { hex: "#808080", rgb: [128, 128, 128], share: 8 },
  ]);
  assert.equal(tokens.base, "#0a0a14");
  assert.equal(tokens.baseIsDark, true);
  assert.equal(tokens.accent, "#f7cb1e");
  assert.equal(tokens.onAccent, "#000000");
  assert.ok(contrast([247, 203, 30], [0, 0, 0]) >= 4.5);
});

test("suggestTokens says so when an image has no usable accent", () => {
  const tokens = suggestTokens([{ hex: "#ffffff", rgb: [255, 255, 255], share: 90 }, { hex: "#222222", rgb: [34, 34, 34], share: 10 }]);
  assert.equal(tokens.accent, null);
  assert.match(tokens.note, /monochrome/);
});

test("slugName makes safe, stable file names", () => {
  assert.equal(slugName("C:/x/Screen Shot 2026-09-28 at 3.41 PM.png"), "screen-shot-2026-09-28-at-3-41-pm");
  assert.equal(slugName("!!!.png"), "image");
});

test("prep-media converts a real image and writes a report", async () => {
  const work = await mkdtemp(join(tmpdir(), "prep-media-"));
  const source = join(ROOT, "assets/demos/_placeholders/revenue-dashboard.webp");
  execFileSync(process.execPath, [join(ROOT, "scripts/prep-media.mjs"), source, "--out", work], { encoding: "utf8" });
  assert.ok(existsSync(join(work, "revenue-dashboard.webp")));
  const [entry] = JSON.parse(await readFile(join(work, "media-report.json"), "utf8"));
  assert.equal(entry.width, 1100);
  assert.equal(entry.shape, "wide-strip");
  assert.equal(entry.fit["16:9"], "card");
  assert.ok(entry.palette.length > 0);
});

test("doctor helpers parse versions, the Chrome row and the verdict", () => {
  assert.equal(nodeMajor("v22.16.0"), 22);
  assert.equal(nodeMajor("garbage"), 0);
  assert.deepEqual(chromeFromDoctor("  ✓ FFmpeg  x\n  ✓ Chrome           cache: /c/chrome\n"), { ok: true, detail: "cache: /c/chrome" });
  assert.equal(chromeFromDoctor("  ✗ Chrome  Not found").ok, false);
  assert.equal(chromeFromDoctor("nothing"), undefined);
  assert.equal(verdict([{ required: true, ok: false }]).code, 1);
  assert.match(verdict([{ required: false, ok: false }]).text, /optional/);
  assert.equal(verdict([{ required: true, ok: true }]).code, 0);
});
