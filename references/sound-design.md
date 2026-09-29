# Sound Design

Every reference is scored: music plus sound effects synced to the motion, and in two of five, a
voiceover. Sound is half of why the motion feels premium, so no piece ships silent.

By default everything is free and local: SFX and music are synthesized by `scripts/sound.mjs` (zero
dependencies, deterministic), and the voice comes from HyperFrames' bundled Kokoro TTS via
`scripts/voice.mjs`. The same script can voice with ElevenLabs or any OpenAI-compatible speech server
instead, including a cloned voice (§5).

## Contents
1. Workflow
2. Cue sheet (`cues.json`)
3. SFX palette and when to use each
4. Music styles
5. Voiceover
6. Levels
7. Upgrading for final delivery

## 1. Workflow

1. **(Voice layouts only)** Write `vo.json` (one line per phrase), then run
   `node ~/.claude/skills/motion-director/scripts/voice.mjs vo.json`. It prints each line's real
   duration. For word-level sync:
   `python ~/.claude/skills/motion-director/scripts/transcribe.py --words vo/*.wav`
   and feed the word starts to `buildSentence(..., { times: [...] })`, or offset each clip so its
   key word lands on its visual.
2. Build the timeline, then write `cues.json` using the **same timestamps** as the tweens: an SFX
   lands where its motion lands.
3. `node ~/.claude/skills/motion-director/scripts/sound.mjs cues.json` → `assets/audio/mix.wav`.
4. Reference it once in the composition:
   `<audio id="mix" src="assets/audio/mix.wav" data-start="0" data-duration="<total>" data-volume="1"></audio>`
   (an `id` is required, or HyperFrames renders silent).
5. After rendering, **verify the voice is intelligible** (you can't listen, Whisper can):
   `python ~/.claude/skills/motion-director/scripts/transcribe.py renders/final.mp4`
   Every line must come back at its time. A missing or garbled line means the mix buries it.
6. Check loudness:
   `ffmpeg -i out.mp4 -af ebur128=peak=true -f null -` → aim for **I ≈ −14 to −16 LUFS, peak ≤ −1 dBFS**.

## 2. Cue sheet

```json
{
  "duration": 18.5, "bpm": 128, "seed": 33,
  "music": { "style": "drive", "gain": 0.55, "drop": [[4.7, 5.2]], "fadeOut": 1.4 },
  "duckDb": -10,
  "targetDb": -17,
  "vo":  [{ "t": 12.9, "file": "vo/a1.wav", "gain": 1 }],
  "sfx": [{ "t": 0.7, "type": "impact", "gain": 0.7 }, { "t": 2.6, "type": "type", "count": 44, "cps": 22 }]
}
```

- `t` is the moment of impact. Pre-roll sounds (`riser`, `whoosh`, `shimmer`) shift themselves so
  their peak lands on `t`: a riser *ends* at `t`.
- `music.drop` mutes drums (pad keeps going) for tension right before a big hit. Drop 0.3–0.6 s
  before an impact or flash card.
- `duckDb` lowers music while voice plays. `targetDb` is the RMS loudness target (−17 ≈ −15 LUFS).

## 3. SFX palette

| Type | Sound | Use for | Typical gain |
|---|---|---|---|
| `whoosh` | swept noise, pans L→R, peak at `t` (`dur` 0.4–1.2) | wipes, camera moves, scene entrances | 0.4–0.6 |
| `swish` | short fast whoosh | whips, list scrolls, panel pushes | 0.4–0.6 |
| `riser` | rising noise + tone, ends at `t` (`dur` 0.5–1.5) | into flash cards, world changes, lockups | 0.4–0.5 |
| `impact` | low boom + click | slams, stat punches, title hits, logo lands | 0.5–0.8 |
| `subdrop` | falling sub tone | hard cut to black, "silence" moments | 0.4–0.6 |
| `pop` | short pitched blip (`pitch`) | chips, coins, tiles, pins. **Ladder the pitch up** (1.0 → 1.15 → 1.3) for sequences | 0.3–0.5 |
| `click` | tick | button presses, cursor clicks, highlight hops | 0.4–0.7 |
| `type` | keyboard burst (`count`, `cps`) | every typing moment: count ≈ characters, cps = the typeOn cps | 0.35–0.5 |
| `chime` | bright 4-note bell | keyword lands, reveals, lockups | 0.35–0.5 |
| `shimmer` | airy hiss swell | glow, sparkle, the motif appearing | 0.3–0.45 |

Rules: at most one "big" sound (impact/riser) per 1.5 s; ladders on sequences; everything the
viewer sees land should have *some* sound, but ambient drift should not.

## 4. Music styles

All styles use the same Am–F–C–G progression at the cue sheet's BPM, so any style locks to the beat
grid used for the visuals.

| Style | Feel | Layouts |
|---|---|---|
| `drive` | four-on-the-floor kick, off-beat hats, 8th-note bass | Launch Hype, Agency Split |
| `pulse` | half-time kick, claps, 16th hats, plucked arp | Brand System, AI Canvas |
| `ambient` | pads, soft sub, slow arp, one kick per bar | Narrated Journey, any voice-led piece |
| `none` | SFX only | when the user supplies a licensed track |

## 5. Voiceover

- `voice.mjs` defaults to Kokoro `am_michael` at speed 0.95–1.0. Other voices: `am_adam`,
  `bm_george`, `af_heart`, `af_nova`, `bf_emma` (`voice.mjs --list-voices`). State the pick and
  offer to swap.
- Write for the ear: short phrases, ≤ 12 words per line, one idea per line. The screen shows the
  keyword phrase, not the full sentence.
- Place each line at a beat and leave a 0.3–0.6 s gap between lines for SFX to breathe.
- **Sparse voiceover over kinetic type** (Portfolio Reveal, and any piece where the type carries the
  story): one short line per scene, never narrating everything on screen. Place each clip so its
  **key word** lands on the matching visual (`clip start = visual time − word offset`).
- **One clip per slammed word.** A spoken list ("trigger, route, automate") comes out ~0.4 s apart,
  faster than slams on a 2-beat grid. Generate each word as its own line and place each on its slam.
- Under a voice, scale all SFX gains by ~0.8 and duck music −9 dB.
- A human recording can replace any line: keep the file name and re-run `sound.mjs`.

### Voice providers

`"provider"` in `vo.json` picks the engine. File names stay the same across providers, so `cues.json`
never changes, and every line is level-matched to the same voiced loudness (−20.5 dBFS; `"targetDb"`
changes it, `"normalize": false` turns it off). Only lines whose request changed are re-voiced, and
`--dry-run` shows what would be sent without calling anything.

| Provider | Use when | Setup (`.env`, see `.env.example`) | Controls in `vo.json` |
|---|---|---|---|
| `kokoro` (default) | Drafts, and anything that must stay free and offline | none | `voice`, `speed` |
| `elevenlabs` | A premium stock voice or the user's own ElevenLabs voice clone | `ELEVENLABS_API_KEY`, `ELEVENLABS_BASE_URL` | `voice` (ID), `model`, `settings` (`stability`, `similarity_boost`, `style`, `use_speaker_boost`) |
| `openai-compatible` | A local cloning server (VoiceStudio, a Chatterbox or VoxCPM2 wrapper) or OpenAI | `VOICE_API_BASE_URL`, `VOICE_API_KEY` if required | `model`, `voice`, `speed`, `extra` (passed through: `seed`, `instruct`, `language` …), `timeoutSec` |

```json
{ "provider": "elevenlabs", "voice": "<voice id>", "settings": { "stability": 0.35, "style": 0.5 },
  "lines": [{ "id": "l1", "text": "..." }] }
```

Any of these can also be set per line (`"voice"`, `"settings"`, `"extra"`…) to vary one read.
`voice.mjs --list-voices <vo.json>` lists what the spec's provider offers.

**Before using a cloned or paid voice:**
- **Consent.** Clone only a voice whose owner gave written permission, which in practice means the user's
  own voice. Never clone a client, a public figure or a voice from found audio.
- **Licence of the output.** Check that the plan or model allows commercial use before client work.
  ElevenLabs depends on the plan. For local models, check the weights licence: VoiceStudio's default
  OmniVoice weights are non-commercial (CC-BY-NC), Chatterbox is MIT, VoxCPM2 is Apache-2.0. Say which
  applies when you hand over the film.
- **Cost.** ElevenLabs bills per character: run `--dry-run` first and state the count.
- **Hardware.** Local cloning servers want an NVIDIA GPU with about 6 GB+ of VRAM; on less they fall back
  to CPU and take minutes per line (raise `timeoutSec`).
- A masked voice under music is a mix problem, not a level problem: raise that clip's `gain` in `cues.json`
  and check it with `transcribe.py` rather than changing `targetDb` for every line.

## 6. Levels

Voice ≈ 1.0, SFX 0.3–0.8, music 0.45–0.55 (before ducking). If a mix feels busy, lower SFX first,
then music. Never lower the voice.

## 7. Upgrading for final delivery

The synthesized bed is a solid draft. For client work, swap in a licensed track (or a
kie.ai-generated one via the student kit's `motion-showreel/scripts/kie.mjs`, which needs
`KIE_API_KEY`): set `music.style` to `none`, add the track as its own `<audio id="music">` with a
`data-automation` volume lane for ducking, and keep the SFX mix.
