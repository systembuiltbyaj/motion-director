#!/usr/bin/env node
// Prepares user-supplied images (screenshots, exports, photos, logos) for a composition: converts each to
// WebP in the project's assets/media/, reports its shape and how large it can appear on screen, and extracts
// a palette with a suggested accent so a flavor can be derived from a brand the user only showed as images.
// Writes media-report.json next to the output so the asset inventory is grounded in real numbers.
//
// Usage: node prep-media.mjs <file|folder> [...] [--out assets/media] [--max-width 2880] [--dry-run]
// Needs FFmpeg + FFprobe (no npm dependencies).
import { execFileSync } from "node:child_process";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".avif"]);
const WEBP_MAX_SIDE = 16383;

/** Shape of an image, which decides the move it suits. */
export function classifyShape(width, height) {
  const ratio = width / height;
  if (ratio <= 0.62) return "tall-page";      // full-page capture: scroll-pan or browser-frame shot
  if (ratio < 0.9) return "portrait";          // phone screen, person, poster
  if (ratio <= 1.1) return "square";           // logo, badge, avatar, post
  if (ratio <= 2.0) return "screen";           // app or site screen, dashboard, slide
  return "wide-strip";                         // workflow canvas, banner: pan along it
}

/** How big the image can be shown without looking soft, for 16:9 (1920 wide) and 9:16 (1080 wide). */
export function fitFor(width) {
  const size = (frameWidth) => (width >= frameWidth * 0.95 ? "full-frame" : width >= frameWidth * 0.5 ? "card" : "small");
  return { "16:9": size(1920), "9:16": size(1080) };
}

const channelLight = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]) => 0.2126 * channelLight(r) + 0.7152 * channelLight(g) + 0.0722 * channelLight(b);
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

function hsl([r, g, b]) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const light = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  return { sat, light };
}

/** Dominant colors from raw RGBA bytes: 4-bit buckets, merged when close, sorted by share of the opaque
 * pixels. Transparent pixels (a logo's background) are ignored. */
export function quantize(bytes, maxColors = 6) {
  const buckets = new Map();
  let pixels = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    if (bytes[i + 3] < 128) continue;
    pixels += 1;
    const key = ((bytes[i] >> 4) << 8) | ((bytes[i + 1] >> 4) << 4) | (bytes[i + 2] >> 4);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += bytes[i];
    bucket.g += bytes[i + 1];
    bucket.b += bytes[i + 2];
    bucket.n += 1;
    buckets.set(key, bucket);
  }
  const merged = [];
  for (const bucket of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const rgb = [bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n];
    const near = merged.find((m) => Math.hypot(m.rgb[0] - rgb[0], m.rgb[1] - rgb[1], m.rgb[2] - rgb[2]) < 32);
    if (near) {
      near.rgb = near.rgb.map((c, i) => (c * near.n + rgb[i] * bucket.n) / (near.n + bucket.n));
      near.n += bucket.n;
    } else merged.push({ rgb, n: bucket.n });
  }
  return merged
    .sort((a, b) => b.n - a.n)
    .slice(0, maxColors)
    .map(({ rgb, n }) => ({ hex: hex(rgb), rgb: rgb.map(Math.round), share: Math.round((n / pixels) * 1000) / 10 }));
}

/** Base (most common), accent (most saturated color with real coverage) and readable text on the accent. */
export function suggestTokens(palette) {
  if (!palette.length) return null;
  const base = palette[0];
  const candidates = palette.filter((c) => c.share >= 1.5).map((c) => ({ ...c, ...hsl(c.rgb) })).filter((c) => c.sat >= 0.35 && c.light >= 0.2 && c.light <= 0.82);
  const accent = candidates.sort((a, b) => b.sat * Math.sqrt(b.share) - a.sat * Math.sqrt(a.share))[0];
  const onAccent = accent ? (contrast(accent.rgb, [0, 0, 0]) >= contrast(accent.rgb, [255, 255, 255]) ? "#000000" : "#ffffff") : null;
  return {
    base: base.hex,
    baseIsDark: luminance(base.rgb) < 0.18,
    accent: accent?.hex ?? null,
    onAccent,
    note: accent ? null : "No saturated color with real coverage; the brand may be monochrome. Pick the accent from the logo or ask.",
  };
}

export const slugName = (file) =>
  basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "image";

function probe(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,pix_fmt", "-of", "csv=p=0", file], { encoding: "utf8" }).trim();
  const [width, height, pixFmt] = out.split(",");
  // pal8 (palette PNG/GIF) may carry transparency, so it is kept as alpha to be safe.
  return { width: Number(width), height: Number(height), alpha: /^(rgba|argb|bgra|abgr|yuva|ya|gbrap|pal8)/.test(pixFmt ?? "") };
}

function paletteOf(file) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-frames:v", "1", "-vf", "scale=64:64:flags=area", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 20 });
  return quantize(raw);
}

async function collect(inputs) {
  const files = [];
  for (const input of inputs) {
    const path = resolve(input);
    if ((await stat(path)).isDirectory()) {
      for (const name of (await readdir(path)).sort()) if (IMAGE_EXT.has(extname(name).toLowerCase())) files.push(join(path, name));
    } else if (IMAGE_EXT.has(extname(path).toLowerCase())) files.push(path);
    else throw new Error(`not an image: ${input} (supported: ${[...IMAGE_EXT].join(" ")})`);
  }
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const valueOf = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  const outDir = resolve(valueOf("--out", "assets/media"));
  const maxWidth = Number(valueOf("--max-width", 2880));
  const dryRun = args.includes("--dry-run");
  const inputs = args.filter((arg, i) => !arg.startsWith("--") && !["--out", "--max-width"].includes(args[i - 1]));
  if (!inputs.length) {
    console.error("Usage: node prep-media.mjs <file|folder> [...] [--out assets/media] [--max-width 2880] [--dry-run]");
    process.exit(1);
  }
  const files = await collect(inputs);
  if (!files.length) throw new Error("no images found in the inputs");
  if (!dryRun) await mkdir(outDir, { recursive: true });

  const report = [];
  const used = new Set();
  for (const file of files) {
    const info = probe(file);
    let name = `${slugName(file)}.webp`;
    for (let n = 2; used.has(name); n += 1) name = `${slugName(file)}-${n}.webp`;
    used.add(name);
    const filters = [];
    if (info.width > maxWidth) filters.push(`scale=${maxWidth}:-2:flags=lanczos`);
    const outWidth = Math.min(info.width, maxWidth);
    const outHeight = Math.round((info.height * outWidth) / info.width);
    const warnings = [];
    if (outHeight > WEBP_MAX_SIDE) {
      filters.push(`crop=iw:${WEBP_MAX_SIDE}:0:0`);
      warnings.push(`taller than WebP allows; kept the top ${WEBP_MAX_SIDE}px`);
    }
    const fit = fitFor(info.width);
    const shape = classifyShape(info.width, info.height);
    // Logos, badges and portraits are never meant to fill the frame, so only screens get the warning.
    if (fit["16:9"] === "small" && !["square", "portrait"].includes(shape)) warnings.push("low resolution: use it small (chip, thumbnail) or ask for a bigger export");
    const palette = paletteOf(file);
    const entry = { file: name, source: file, width: info.width, height: info.height, alpha: info.alpha, shape, fit, palette, tokens: suggestTokens(palette), warnings };
    report.push(entry);
    if (!dryRun) {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-frames:v", "1", ...(filters.length ? ["-vf", filters.join(",")] : []), "-c:v", "libwebp", "-quality", "88", ...(info.alpha ? ["-pix_fmt", "yuva420p"] : []), join(outDir, name)]);
    }
    console.log(`${dryRun ? "would write" : "wrote"} ${name}  ${info.width}x${info.height}  ${entry.shape}  16:9 ${fit["16:9"]} · 9:16 ${fit["9:16"]}  accent ${entry.tokens?.accent ?? "none"}${warnings.length ? `  ! ${warnings.join("; ")}` : ""}`);
  }
  if (!dryRun) {
    await writeFile(join(outDir, "media-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nReport: ${join(outDir, "media-report.json")}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`prep-media failed: ${error.message}`);
    process.exit(1);
  });
}
