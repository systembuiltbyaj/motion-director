import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaReferences } from "../scripts/scaffold.mjs";
import { parseTargets } from "../scripts/capture-site.mjs";

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
