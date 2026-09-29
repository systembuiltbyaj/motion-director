// Provider settings (API keys, server URLs) come from the environment or .env files, never from code or
// vo.json, so a spec can be shared without leaking a key.
//
// Lookup, strongest first: process environment → the closest .env walking up from the project folder →
// the skill folder's .env. Values are returned, never printed.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SEARCH_DEPTH = 5;

/** Parse KEY=value lines of a .env file (quotes stripped, comments and blanks ignored). */
export function parseEnv(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    values[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

function readEnvFile(dir) {
  try {
    return parseEnv(readFileSync(join(dir, ".env"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error(`could not read ${join(dir, ".env")}: ${error.message}`);
  }
}

/** Merged settings for `from` (a project folder). Empty process variables don't mask a .env value. */
export function loadEnv({ from = process.cwd(), skillDir, env = process.env } = {}) {
  const dirs = [];
  let dir = resolve(from);
  for (let depth = 0; depth < SEARCH_DEPTH; depth += 1) {
    dirs.push(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (skillDir) dirs.push(resolve(skillDir));
  const merged = {};
  // Weakest first, so closer files overwrite farther ones.
  for (const source of dirs.reverse()) Object.assign(merged, readEnvFile(source));
  for (const [key, value] of Object.entries(env)) if (value) merged[key] = value;
  return merged;
}
