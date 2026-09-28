// Finds Playwright and a Chromium binary without machine-specific paths, for capture-site.mjs and any
// project capture script.
//
// Playwright: PLAYWRIGHT_FROM (a package.json whose node_modules has playwright), then the current project,
// then any npx cache entry that holds playwright (newest first).
// Chromium: PLAYWRIGHT_CHROMIUM (an executable), then the newest installed ms-playwright chromium-<rev>.
// Falling back to the newest revision matters because an npx-cached Playwright often expects a revision that
// isn't installed, and chromium.launch() then fails even though a working Chromium is on disk.
import { existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const localAppData = (env) => env.LOCALAPPDATA || join(homedir(), "AppData", "Local");

/** Ordered package.json paths to try when resolving playwright. `npxEntries` are npx cache dirs, newest first. */
export function playwrightBases({ cwd, env = {}, npxEntries = [] }) {
  return [env.PLAYWRIGHT_FROM, join(cwd, "package.json"), ...npxEntries.map((dir) => join(dir, "package.json"))]
    .filter(Boolean)
    .map((base) => resolve(base));
}

/** Picks the newest chromium-<rev> dir name (ignores headless_shell and other browsers). */
export function newestChromiumDir(names) {
  return names
    .map((name) => /^chromium-(\d+)$/.exec(name))
    .filter(Boolean)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map((match) => match[0])[0];
}

const EXECUTABLES = [["chrome-win64", "chrome.exe"], ["chrome-win", "chrome.exe"], ["chrome-linux", "chrome"], ["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"]];

export function findChromium(env = process.env) {
  if (env.PLAYWRIGHT_CHROMIUM) return env.PLAYWRIGHT_CHROMIUM;
  const root = env.PLAYWRIGHT_BROWSERS_PATH || join(localAppData(env), "ms-playwright");
  if (!existsSync(root)) return undefined;
  const dir = newestChromiumDir(readdirSync(root));
  if (!dir) return undefined;
  return EXECUTABLES.map((parts) => join(root, dir, ...parts)).find((path) => existsSync(path));
}

function npxEntriesWithPlaywright(env) {
  const npx = join(localAppData(env), "npm-cache", "_npx");
  if (!existsSync(npx)) return [];
  return readdirSync(npx)
    .map((name) => join(npx, name))
    .filter((dir) => existsSync(join(dir, "node_modules", "playwright")))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

export function loadPlaywright(env = process.env, cwd = process.cwd()) {
  for (const base of playwrightBases({ cwd, env, npxEntries: npxEntriesWithPlaywright(env) })) {
    try {
      return createRequire(base)("playwright");
    } catch {
      // try the next location
    }
  }
  throw new Error("Playwright not found. Run `npm i -D playwright && npx playwright install chromium`, or set PLAYWRIGHT_FROM to a package.json that has it.");
}

/** chromium.launch() options: the found executable (if any) merged with `extra`. */
export function launchOptions(extra = {}, env = process.env) {
  const executablePath = findChromium(env);
  return executablePath ? { executablePath, ...extra } : { ...extra };
}
