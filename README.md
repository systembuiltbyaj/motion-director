# motion-director

A [Claude Code](https://claude.com/claude-code) skill that gives Claude a complete motion-design system
for [HyperFrames](https://hyperframes.heygen.com) videos: six presentation layouts, a shared
kinetic-typography language, color flavors, deterministic GSAP helpers, and a free local sound engine
(music bed, motion-synced sound effects, and voiceover). No API keys or subscriptions needed: everything
renders on your machine, with ElevenLabs or your own cloned voice as optional voice upgrades.

Distilled from five reference motion films plus a personal portfolio reel. Instead of re-deriving a
style for every video, Claude starts from this system: pick a layout, pick a flavor, drop in real
assets, render.

## What's inside

| Layout | Feels like | Sound | Aspects |
|---|---|---|---|
| **Brand System** | Brand-guideline film: tiles slam on the beat, easing curves, 3D billboard | Music + SFX | 16:9 |
| **Narrated Journey** | Voice-led story; words land exactly as they're spoken; dark → light world change | Voiceover + ambient bed | 16:9 |
| **Launch Hype** | Neon product launch: stat splits, coin flips, button stacks, 3D dashboards | Music + SFX | 16:9 · **9:16** |
| **AI Canvas** | AI product demo: prompt types, agent plans, node canvas with a camera pull-back | SFX, voice in the second half | 16:9 |
| **Agency Split** | Fast promo: amber panels, typed copy, image splits, logo wall | Music + SFX | 16:9 · **9:16** |
| **Portfolio Reveal** | Personal brand reel: show the work → reveal the system behind it → reveal the builder | Sparse voiceover + SFX | 16:9 |

Layouts without a ready-made 9:16 version are re-laid-out for vertical by Claude, keeping the same timings.

**Bring whatever you have.** A website URL, a local app, screenshots, a Figma export, a PDF deck, a screen
recording, or just a one-line idea: [references/intake.md](references/intake.md) tells Claude what to do with
each, and it lists what it has and what's missing before it builds anything.

## Quick start

**1. Install**

```sh
git clone https://github.com/systembuiltbyaj/motion-director.git ~/.claude/skills/motion-director
npx skills add heygen-com/hyperframes --all      # the HyperFrames skills (render engine), if you don't have them
```

On Windows, run these in Git Bash, or replace `~` with `%USERPROFILE%` in Command Prompt.

**2. Check your setup**

```sh
node ~/.claude/skills/motion-director/scripts/doctor.mjs
```

It checks Node 22+, FFmpeg, Chrome, HyperFrames, and the optional extras, and prints the fix for anything
missing.

**3. Tell it who you are**

Copy `brand.example.json` to `brand.json` in the same folder and fill it in (name, role, URL, handle, logo),
or paste the setup prompt from [PROMPTS.md](PROMPTS.md) and let Claude do it. Your `brand.json` is
git-ignored, so it stays on your machine. Client videos get their own `brand.json` in the project folder.

**4. Ask for a video**

```
Make a 30-second 9:16 promo from these screenshots. It's my booking app for dentists.
Brand color #0EA5E9. Only use numbers I give you.
```

More in [PROMPTS.md](PROMPTS.md): one prompt for each kind of input, layout names, and follow-ups.

**Requirements:** Node 22+, FFmpeg (with FFprobe), Chrome/Chromium (HyperFrames installs its own with
`npx hyperframes browser ensure`), and the HyperFrames skills for Claude Code.
**Optional:** `pip install openai-whisper` (voice sync and mix checks) and Playwright (site capture:
`npm i -D playwright && npx playwright install chromium`).

## Try a demo without Claude

```sh
node ~/.claude/skills/motion-director/scripts/scaffold.mjs --list                 # layouts and their aspects
node ~/.claude/skills/motion-director/scripts/scaffold.mjs my-reel --demo launch-hype --aspect 9:16
cd my-reel
node ~/.claude/skills/motion-director/scripts/voice.mjs vo.json      # voiced demos only
node ~/.claude/skills/motion-director/scripts/sound.mjs cues.json
npx hyperframes preview
```

Every demo renders complete out of the box: your `brand.json` fills the names and URLs, and any image you
haven't supplied is a neutral mock-up tagged **SAMPLE**. The scaffold lists each SAMPLE file, and
[`assets/demos/MEDIA.md`](assets/demos/MEDIA.md) says what each one should show. Swap in your own before you
publish.

## Tools

- `assets/motion-director.js`: 25+ timeline helpers (`buildSentence`, `typeOn`, `slam`, `whip`,
  `zoomThrough`, `tiltFloat`, `drawPath`, `camera`, …), all seek-safe for frame-by-frame rendering.
- `assets/motion-director.css`: flavor tokens (Glow Dark, Electric System, Warm Canvas, Bold Split).
- `scripts/doctor.mjs`: setup check with a fix for each missing piece.
- `scripts/scaffold.mjs`: seeds a HyperFrames project from any demo, with your brand and SAMPLE media.
- `scripts/prep-media.mjs`: turns any screenshots or images into WebP and reports each one's shape, how big it
  can appear on screen, and its colors (with a suggested accent).
- `scripts/sound.mjs`: synthesizes a beat-locked music bed plus 10 SFX types from a cue sheet and
  ducks music under voice. Zero dependencies, deterministic.
- `scripts/voice.mjs`: voiceover, one WAV per line. Kokoro via HyperFrames by default (free, offline), or
  set `"provider"` in `vo.json` to `elevenlabs` or `openai-compatible` (VoiceStudio, a Chatterbox or VoxCPM2
  server, OpenAI) for a premium or cloned voice; keys go in `.env` (see `.env.example`). Every line is
  level-matched, and a line is re-voiced only when its request changes.
- `scripts/transcribe.py`: word timings for sync, plus a check that every voice line is audible
  in the final mix.
- `scripts/capture-site.mjs`: full-page captures of live funnels and websites for browser-frame shots.
- `references/`: intake, the design language, motion grammar, layouts, sound design, and a pre-render audit.

## Troubleshooting

| Problem | Fix |
|---|---|
| `ffmpeg` not found | Windows: `winget install Gyan.FFmpeg`, then open a new terminal. macOS: `brew install ffmpeg`. |
| Render can't find Chrome | `npx hyperframes browser ensure` |
| First voiceover is slow | Kokoro downloads its voice model the first time; later lines are fast. |
| The video shows "Your Studio" / "Alex Rivera" | No `brand.json` was found. Create one (step 3), then scaffold into a fresh folder. |
| SAMPLE images in the video | Replace them in the project's `assets/media/` with the same file names. |
| Site capture fails | Install Playwright (see Optional above), or set `PLAYWRIGHT_CHROMIUM` to a Chrome executable. |

Run `doctor.mjs` first for anything else. If it still fails,
[open an issue](https://github.com/systembuiltbyaj/motion-director/issues) and include its output.

## Tests

```sh
node --test tests/*.test.mjs
```

## Credits

Created by AJ Bactad · [System Built by AJ](https://workwithaj.ajautomate.co).

## License

Code and docs: [MIT](LICENSE). Bundled fonts (Inter, Instrument Serif, Dancing Script) are under the
SIL Open Font License; see `assets/fonts/OFL-*.txt`. The SAMPLE images are generated by
`scripts/make-placeholders.mjs` and are MIT like the code. Tool names on the sample logo tiles belong to their
owners.
