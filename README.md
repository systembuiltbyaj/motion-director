# aj-motion-style

A [Claude Code](https://claude.com/claude-code) skill that gives Claude a complete motion-design system
for [HyperFrames](https://hyperframes.heygen.com) videos: six presentation layouts, a shared
kinetic-typography language, color flavors, deterministic GSAP helpers, and a free local sound engine
(music bed, motion-synced sound effects, and voiceover).

Built by **AJ Bactad** ([System Built by AJ](https://workwithaj.ajautomate.co)) from five reference
motion films plus his own brand reel. Instead of re-deriving a style for every video, Claude starts
from this system: pick a layout, pick a flavor, drop in real assets, render.

## What's inside

| Layout | Feels like | Sound |
|---|---|---|
| **Brand System** | Brand-guideline film: tiles slam on the beat, easing curves, 3D billboard | Music + SFX |
| **Narrated Journey** | Voice-led story; words land exactly as they're spoken; dark → light world change | Voiceover + ambient bed |
| **Launch Hype** | Neon product launch: stat splits, coin flips, button stacks, 3D dashboards | Music + SFX |
| **AI Canvas** | AI product demo: prompt types, agent plans, node canvas with a camera pull-back | SFX, voice in the second half |
| **Agency Split** | Fast promo: amber panels, typed copy, image splits, logo wall | Music + SFX |
| **Portfolio Reveal** | Personal brand reel: show the work → reveal the system behind it → reveal the builder | Sparse voiceover + SFX |

- `assets/aj-motion.js`: 25+ timeline helpers (`buildSentence`, `typeOn`, `slam`, `whip`,
  `zoomThrough`, `tiltFloat`, `drawPath`, `camera`, …), all seek-safe for frame-by-frame rendering.
- `assets/aj-motion.css`: flavor tokens (Glow Dark, Electric System, Warm Canvas, Bold Split).
- `scripts/sound.mjs`: synthesizes a beat-locked music bed plus 10 SFX types from a cue sheet and
  ducks music under voice. Zero dependencies, deterministic.
- `scripts/voice.mjs`: voiceover with HyperFrames' bundled Kokoro TTS (free, offline).
- `scripts/transcribe.py`: word timings for sync, plus a check that every voice line is audible
  in the final mix.
- `scripts/capture-site.mjs`: full-page captures of live funnels and websites for browser-frame shots.
- `scripts/scaffold.mjs`: seeds a HyperFrames project from any layout demo.
- `references/`: the design language, motion grammar, layouts, sound design, and a pre-render audit.

## Install

```sh
git clone https://github.com/systembuiltbyaj/aj-motion-style.git ~/.claude/skills/aj-motion-style
```

Claude Code picks it up automatically. Ask for a motion video ("make a 20-second portfolio reel from
my website", "product launch video for …") and the skill loads alongside `/hyperframes`.

**Requirements:** Node 22+, FFmpeg, Chrome/Chromium, and the HyperFrames skills for Claude Code (the
CLI runs via `npx hyperframes`).
**Optional:** `pip install openai-whisper` (voice sync and mix checks) and Playwright (site capture:
`npm i -D playwright && npx playwright install chromium`).

## Try a demo

```sh
node ~/.claude/skills/aj-motion-style/scripts/scaffold.mjs my-reel --demo portfolio-reveal
cd my-reel
node ~/.claude/skills/aj-motion-style/scripts/voice.mjs vo.json      # voiced demos only
node ~/.claude/skills/aj-motion-style/scripts/sound.mjs cues.json
npx hyperframes preview
```

Demo images aren't included (the originals are client work). The scaffold lists which image files
each demo expects, and [`assets/demos/MEDIA.md`](assets/demos/MEDIA.md) describes what each should
show. Drop your own images into `assets/media/` with those names.

## Tests

```sh
node --test tests/aj-motion.test.mjs tests/sound.test.mjs tests/scripts.test.mjs
```

## License

Code and docs: [MIT](LICENSE). Bundled fonts (Inter, Instrument Serif, Dancing Script) are under the
SIL Open Font License; see `assets/fonts/OFL-*.txt`. Tool logos referenced by the demos belong to
their owners and are not included.
