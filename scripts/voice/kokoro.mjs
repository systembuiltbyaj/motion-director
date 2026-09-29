// Kokoro via HyperFrames' bundled TTS: free and offline after the first model download. The default provider.
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const HYPERFRAMES = "hyperframes@0.8.77";
const DEFAULT_VOICE = "am_michael";

function runHyperframes(args) {
  // npx is a .cmd shim on Windows and needs a shell, which splits unquoted paths on spaces.
  const quote = (value) => (process.platform === "win32" && /\s/.test(value) ? `"${value}"` : value);
  const result = spawnSync("npx", ["--yes", HYPERFRAMES, ...args.map(quote)], { encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`hyperframes ${args[0]} failed: ${(result.stderr || result.stdout || "").slice(-400)}`);
  return result.stdout;
}

export default {
  name: "kokoro",
  remote: false,

  request(spec, line) {
    return { provider: "kokoro", voice: line.voice ?? spec.voice ?? DEFAULT_VOICE, speed: line.speed ?? spec.speed ?? 1, text: line.text };
  },

  async synthesize(request) {
    const work = await mkdtemp(join(tmpdir(), "md-kokoro-"));
    try {
      // Text goes through a file: passed inline, the Windows shell would split it on spaces.
      const textFile = join(work, "line.txt");
      const out = join(work, "line.wav");
      await writeFile(textFile, request.text, "utf8");
      runHyperframes(["tts", textFile, "--voice", request.voice, "--speed", String(request.speed), "--output", out]);
      return await readFile(out);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  },

  async listVoices() {
    return runHyperframes(["tts", "--list"]).trim().split(/\r?\n/);
  },
};
