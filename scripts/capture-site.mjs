#!/usr/bin/env node
// Capture live pages (funnels, websites, portfolios) as tall full-page screenshots for browser-frame
// scroll shots. Lazy content is triggered by scrolling first. Pages whose tracking scripts never go
// network-idle (GHL funnels do this often) fall back to the load event plus a fixed settle wait.
//
// Usage: node capture-site.mjs <out-dir> <name>=<url> [<name>=<url> ...] [--width 1440] [--max-height 3600] [--dry-run]
//
// Needs Playwright; see playwright.mjs for how it and Chromium are found (PLAYWRIGHT_FROM, PLAYWRIGHT_CHROMIUM,
// the current project, the npx cache). Install with: npm i -D playwright && npx playwright install chromium
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchOptions, loadPlaywright } from "./playwright.mjs";

export function parseTargets(args) {
  return args
    .filter((arg) => !arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const index = arg.indexOf("=");
      const name = arg.slice(0, index);
      const url = arg.slice(index + 1);
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) throw new Error(`capture name "${name}" must be a simple slug`);
      if (!/^https?:\/\//i.test(url)) throw new Error(`"${url}" is not an http(s) URL`);
      return { name, url };
    });
}

function option(args, name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? Number(args[index + 1]) : fallback;
}

async function capture(browser, { name, url }, outDir, width, maxHeight) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    } catch {
      await page.goto(url, { waitUntil: "load", timeout: 90000 });
    }
    for (let y = 0; y < maxHeight * 2; y += 700) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2500);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const path = join(outDir, `${name}.png`);
    await page.screenshot({ path, fullPage: true, clip: { x: 0, y: 0, width, height: Math.min(height, maxHeight) } });
    console.log(`ok    ${name}  ${width}x${Math.min(height, maxHeight)}  ${url}`);
  } catch (error) {
    console.log(`FAIL  ${name}  ${url}  ${error.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const outDir = args[0];
  const targets = parseTargets(args.slice(1));
  if (!outDir || outDir.includes("=") || targets.length === 0) {
    console.error("Usage: node capture-site.mjs <out-dir> <name>=<url> [...] [--width 1440] [--max-height 3600] [--dry-run]");
    process.exit(1);
  }
  const width = option(args, "width", 1440);
  const maxHeight = option(args, "max-height", 3600);
  if (args.includes("--dry-run")) {
    for (const target of targets) console.log(`[dry-run] ${target.name} <- ${target.url}`);
    return;
  }
  const { chromium } = loadPlaywright();
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch(launchOptions());
  try {
    for (const target of targets) await capture(browser, target, outDir, width, maxHeight);
  } finally {
    await browser.close();
  }
  console.log("Convert to webp for the project, e.g. with Pillow: Image.open(p).convert('RGB').save(q, quality=84)");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`capture-site failed: ${error.message}`);
    process.exit(1);
  });
}
