// Brand identity for scaffolded films: who the video is for (name, person, credentials, URL, handle).
// Demos carry {{brand.<key>}} tokens instead of a hardcoded brand; scaffold.mjs fills them from a brand.json.
//
// Lookup order: --brand <file> → <project>/brand.json → <skill>/brand.json → SAMPLE_BRAND.
// A client film keeps its own brand.json in the project folder, so it never picks up the user's own brand.
import { readFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Neutral sample identity so a fresh install renders a finished-looking demo. */
export const SAMPLE_BRAND = Object.freeze({
  name: "Your Studio",
  firstName: "Alex",
  lastName: "Rivera",
  role: "Designer & Developer",
  tagline: "I design the front and build what runs behind it.",
  credentials: ["Certified Developer", "+ Systems Specialist"],
  url: "example.com",
  handle: "@yourhandle",
});

const TEXT_LIMITS = { name: 40, firstName: 24, lastName: 24, initials: 3, role: 80, tagline: 80, url: 60, handle: 40 };
const TOKEN = /\{\{brand\.([A-Za-z0-9]+)\}\}/g;

/** Throws a readable error listing every invalid field; returns a normalized copy. */
export function validateBrand(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("brand.json must be a JSON object");
  const errors = [];
  const out = {};
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    const value = input[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string") errors.push(`${key} must be a string`);
    else if (value.trim().length > max) errors.push(`${key} is longer than ${max} characters`);
    else out[key] = value.trim();
  }
  if (!out.name) errors.push("name is required (your brand or business name)");
  if (out.url && !/^[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(out.url)) errors.push("url must look like yourdomain.com (no https://)");
  if (out.handle && !/^@[A-Za-z0-9._]{1,39}$/.test(out.handle)) errors.push("handle must look like @yourhandle");
  if (input.credentials !== undefined) {
    const list = input.credentials;
    if (!Array.isArray(list) || list.length > 2 || list.some((c) => typeof c !== "string" || c.length > 60)) {
      errors.push("credentials must be a list of up to 2 short strings (60 characters each)");
    } else out.credentials = list.map((c) => c.trim());
  }
  for (const key of ["logo", "portrait"]) {
    // Blank means "not set yet", so a freshly copied brand.example.json validates.
    if (input[key] === undefined || input[key] === "") continue;
    if (typeof input[key] !== "string" || !/\.(png|jpe?g|webp)$/i.test(input[key])) errors.push(`${key} must be a path to a .png, .jpg or .webp file`);
    else out[key] = input[key];
  }
  if (input.accent !== undefined) {
    if (typeof input.accent !== "string" || !/^#[0-9a-f]{6}$/i.test(input.accent)) errors.push("accent must be a hex colour like #FF5A1F");
    else out.accent = input.accent;
  }
  if (errors.length) throw new Error(`brand.json is invalid:\n  - ${errors.join("\n  - ")}`);
  return out;
}

/** Splits a phrase into two lines with the most even lengths ("Northwind Design Studio" → "Northwind" / "Design Studio"). */
export function splitLines(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] ?? "", ""];
  let best = 1;
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const width = Math.max(words.slice(0, i).join(" ").length, words.slice(i).join(" ").length);
    if (width < bestWidth) {
      best = i;
      bestWidth = width;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/** Token values for a validated brand; missing optional fields fall back to the sample brand. */
export function brandTokens(brand) {
  const merged = { ...SAMPLE_BRAND, ...brand };
  // A brand with its own name but no person should not inherit the sample person.
  if (brand.name && brand.name !== SAMPLE_BRAND.name && !brand.firstName) {
    merged.firstName = splitLines(brand.name)[0];
    merged.lastName = brand.lastName ?? "";
  }
  const [line1, line2] = splitLines(merged.name);
  const [cred1 = "", cred2 = ""] = merged.credentials ?? [];
  const [cred1Line1, cred1Line2] = splitLines(cred1);
  const initials = merged.initials?.toUpperCase() || ((merged.firstName?.[0] ?? "") + (merged.lastName?.[0] ?? "")).toUpperCase() || line1.slice(0, 2).toUpperCase();
  return {
    name: merged.name, line1, line2,
    first: merged.firstName ?? "", last: merged.lastName ?? "", initials,
    role: merged.role ?? "", tagline: merged.tagline ?? "",
    cred1, cred1Line1, cred1Line2, cred2,
    url: merged.url ?? "", handle: merged.handle ?? "",
  };
}

const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const escapeJson = (value) => JSON.stringify(value).slice(1, -1);

/** Replaces {{brand.key}} tokens, escaped for the file type. Unknown keys throw so typos surface. */
export function fillTemplate(text, tokens, format = "html") {
  const escape = format === "json" ? escapeJson : escapeHtml;
  return text.replace(TOKEN, (match, key) => {
    if (!(key in tokens)) throw new Error(`unknown brand token ${match}. Known: ${Object.keys(tokens).join(", ")}`);
    return escape(tokens[key]);
  });
}

export const hasBrandTokens = (text) => new RegExp(TOKEN.source).test(text);

async function readJson(path) {
  try {
    await access(path);
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

/** Finds and validates the brand for a project. `source` is the file used, or "sample". */
export async function loadBrand({ explicit, projectDir, skillRoot }) {
  const candidates = explicit ? [resolve(explicit)] : [join(projectDir, "brand.json"), join(skillRoot, "brand.json")];
  for (const path of candidates) {
    const raw = await readJson(path);
    if (raw !== undefined) return { brand: validateBrand(raw), source: path };
    if (explicit) throw new Error(`brand file not found: ${path}`);
  }
  return { brand: { ...SAMPLE_BRAND }, source: "sample" };
}
