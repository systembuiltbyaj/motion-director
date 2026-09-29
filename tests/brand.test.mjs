import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SAMPLE_BRAND, brandTokens, fillTemplate, loadBrand, splitLines, validateBrand } from "../scripts/brand.mjs";

test("splitLines balances two lines and keeps single words whole", () => {
  assert.deepEqual(splitLines("Northwind Design Studio"), ["Northwind", "Design Studio"]);
  assert.deepEqual(splitLines("Certified GHL Admin"), ["Certified", "GHL Admin"]);
  assert.deepEqual(splitLines("Acme"), ["Acme", ""]);
  assert.deepEqual(splitLines("  "), ["", ""]);
});

test("validateBrand requires a name and reports every bad field at once", () => {
  assert.throws(() => validateBrand({}), /name is required/);
  const error = (() => {
    try {
      validateBrand({ name: "X", url: "https://x.com", handle: "nope", accent: "red", credentials: ["a", "b", "c"] });
    } catch (e) {
      return e.message;
    }
  })();
  assert.match(error, /url must look like/);
  assert.match(error, /handle must look like/);
  assert.match(error, /accent must be a hex/);
  assert.match(error, /credentials must be/);
});

test("brand.example.json validates as shipped", async () => {
  const { readFile } = await import("node:fs/promises");
  const example = JSON.parse(await readFile(new URL("../brand.example.json", import.meta.url), "utf8"));
  assert.equal(validateBrand(example).name, SAMPLE_BRAND.name);
});

test("validateBrand rejects non-objects and non-image logo paths", () => {
  assert.throws(() => validateBrand([]), /JSON object/);
  assert.throws(() => validateBrand({ name: "X", logo: "logo.svg" }), /logo must be a path/);
});

test("brandTokens derives lines, initials and credential lines", () => {
  const tokens = brandTokens(validateBrand({ name: "Northwind Design Studio", firstName: "Jordan", lastName: "Lee", credentials: ["Certified GHL Admin"] }));
  assert.equal(tokens.line1, "Northwind");
  assert.equal(tokens.line2, "Design Studio");
  assert.equal(tokens.initials, "JL");
  assert.equal(tokens.cred1Line1, "Certified");
  assert.equal(tokens.cred1Line2, "GHL Admin");
  assert.equal(tokens.cred2, "");
  assert.equal(brandTokens(validateBrand({ name: "X", firstName: "Jordan", lastName: "Lee", initials: "jl" })).initials, "JL");
});

test("brandTokens does not give a business brand the sample person", () => {
  const tokens = brandTokens(validateBrand({ name: "Acme Dental" }));
  assert.equal(tokens.first, "Acme");
  assert.notEqual(tokens.last, SAMPLE_BRAND.lastName);
});

test("fillTemplate escapes for HTML and JSON and rejects unknown tokens", () => {
  const tokens = brandTokens(validateBrand({ name: 'Tom & "Co"', firstName: "Tom" }));
  assert.equal(fillTemplate("<b>{{brand.name}}</b>", tokens), "<b>Tom &amp; &quot;Co&quot;</b>");
  assert.equal(fillTemplate('{"t":"I\'m {{brand.name}}"}', tokens, "json"), '{"t":"I\'m Tom & \\"Co\\""}');
  assert.throws(() => fillTemplate("{{brand.nmae}}", tokens), /unknown brand token/);
});

test("loadBrand prefers the project file, then the skill file, then the sample", async () => {
  const project = await mkdtemp(join(tmpdir(), "brand-proj-"));
  const skill = await mkdtemp(join(tmpdir(), "brand-skill-"));
  assert.equal((await loadBrand({ projectDir: project, skillRoot: skill })).source, "sample");
  await writeFile(join(skill, "brand.json"), JSON.stringify({ name: "Skill Brand" }));
  assert.equal((await loadBrand({ projectDir: project, skillRoot: skill })).brand.name, "Skill Brand");
  await writeFile(join(project, "brand.json"), JSON.stringify({ name: "Client Brand" }));
  assert.equal((await loadBrand({ projectDir: project, skillRoot: skill })).brand.name, "Client Brand");
  await assert.rejects(loadBrand({ explicit: join(project, "missing.json"), projectDir: project, skillRoot: skill }), /not found/);
  await writeFile(join(project, "bad.json"), "{nope");
  await assert.rejects(loadBrand({ explicit: join(project, "bad.json"), projectDir: project, skillRoot: skill }), /not valid JSON/);
});
