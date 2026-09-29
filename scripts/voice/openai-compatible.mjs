// Any server that speaks OpenAI's speech API (POST {base}/audio/speech): VoiceStudio, a local Chatterbox or
// VoxCPM2 wrapper, or OpenAI itself. Needs VOICE_API_BASE_URL; VOICE_API_KEY only if the server wants one.
// Server-specific fields (seed, instruct, language …) go in "extra" and are passed through untouched.
import { isWav } from "./audio.mjs";
import { fetchWithRetry, httpBase } from "./http.mjs";

// Local servers on a CPU or small GPU can take minutes per line.
const DEFAULT_TIMEOUT_S = 300;
const LABEL = "Voice server";

function config(env) {
  if (!env.VOICE_API_BASE_URL) throw new Error("VOICE_API_BASE_URL is not set (add it to .env; see .env.example)");
  const headers = env.VOICE_API_KEY ? { Authorization: `Bearer ${env.VOICE_API_KEY}` } : {};
  return { base: httpBase(env.VOICE_API_BASE_URL, "VOICE_API_BASE_URL"), headers };
}

export default {
  name: "openai-compatible",
  remote: true,

  request(spec, line) {
    const model = line.model ?? spec.model;
    const voice = line.voice ?? spec.voice;
    if (!model) throw new Error("openai-compatible needs a \"model\" in vo.json (the server's model name, e.g. omnivoice or tts-1)");
    if (!voice) throw new Error("openai-compatible needs a \"voice\" in vo.json (a voice or profile ID on the server)");
    const request = { provider: "openai-compatible", model, voice, text: line.text };
    const speed = line.speed ?? spec.speed;
    if (speed !== undefined) request.speed = speed;
    const extra = { ...spec.extra, ...line.extra };
    if (Object.keys(extra).length) request.extra = extra;
    if (spec.timeoutSec !== undefined) request.timeoutSec = spec.timeoutSec;
    return request;
  },

  async synthesize(request, env) {
    const { base, headers } = config(env);
    // Extras go first so they can never replace the core fields.
    const body = { ...request.extra, model: request.model, voice: request.voice, input: request.text, response_format: "wav" };
    if (request.speed !== undefined) body.speed = request.speed;
    const response = await fetchWithRetry(
      `${base}/audio/speech`,
      { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) },
      { label: LABEL, timeoutMs: (request.timeoutSec ?? DEFAULT_TIMEOUT_S) * 1000 },
    );
    const audio = Buffer.from(await response.arrayBuffer());
    if (!isWav(audio)) throw new Error(`${LABEL} returned ${response.headers.get("content-type") ?? "unknown content"}, not a WAV file`);
    return audio;
  },

  async listVoices(env) {
    const { base, headers } = config(env);
    let response;
    try {
      response = await fetchWithRetry(`${base}/audio/voices`, { headers }, { label: LABEL });
    } catch (error) {
      if (error.status === 404) throw new Error("this server has no voice list (GET /audio/voices); find voice IDs in its own UI or docs");
      throw error;
    }
    const data = await response.json();
    const voices = Array.isArray(data) ? data : data.voices ?? data.data ?? [];
    return voices.map((voice) => (typeof voice === "string" ? voice : `${voice.id ?? voice.voice_id ?? voice.name}\t${voice.name ?? ""}`));
  },
};
