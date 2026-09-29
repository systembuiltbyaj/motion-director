// ElevenLabs: stock voices or your own voice clone, with stability/similarity/style control. Paid per
// character; voice.mjs only calls it for lines whose request changed. Needs ELEVENLABS_API_KEY and
// ELEVENLABS_BASE_URL (see .env.example).
import { pcmToWav } from "./audio.mjs";
import { fetchWithRetry, httpBase } from "./http.mjs";

const DEFAULT_MODEL = "eleven_multilingual_v2";
// 24 kHz PCM is available on every plan (44.1 kHz PCM is Pro-only).
const PCM_RATE = 24000;
const LABEL = "ElevenLabs";

function config(env) {
  if (!env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not set (add it to .env; see .env.example)");
  if (!env.ELEVENLABS_BASE_URL) throw new Error("ELEVENLABS_BASE_URL is not set (add it to .env; see .env.example)");
  return { key: env.ELEVENLABS_API_KEY, base: httpBase(env.ELEVENLABS_BASE_URL, "ELEVENLABS_BASE_URL") };
}

export default {
  name: "elevenlabs",
  remote: true,

  request(spec, line) {
    const voice = line.voice ?? spec.voice;
    if (!voice) throw new Error("elevenlabs needs a voice ID in vo.json \"voice\" (see voice.mjs --list-voices)");
    // Unset settings are left to the voice's own defaults in ElevenLabs.
    const settings = { ...spec.settings, ...line.settings };
    return { provider: "elevenlabs", voice, model: line.model ?? spec.model ?? DEFAULT_MODEL, settings, text: line.text };
  },

  async synthesize(request, env) {
    const { key, base } = config(env);
    const body = { text: request.text, model_id: request.model };
    if (Object.keys(request.settings).length) body.voice_settings = request.settings;
    const response = await fetchWithRetry(
      `${base}/v1/text-to-speech/${encodeURIComponent(request.voice)}?output_format=pcm_${PCM_RATE}`,
      { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/pcm" }, body: JSON.stringify(body) },
      { label: LABEL },
    );
    return pcmToWav(Buffer.from(await response.arrayBuffer()), PCM_RATE);
  },

  async listVoices(env) {
    const { key, base } = config(env);
    const response = await fetchWithRetry(`${base}/v1/voices`, { headers: { "xi-api-key": key } }, { label: LABEL });
    const { voices = [] } = await response.json();
    return voices.map((voice) => `${voice.voice_id}\t${voice.name}\t${Object.values(voice.labels ?? {}).join(", ")}`);
  },
};
