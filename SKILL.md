---
name: aj-motion-style
description: >
  AJ's signature motion design system, distilled from his five reference films and his own brand
  reel, and the starting point for every motion presentation, promo, explainer, product or brand
  video, launch video, portfolio piece or reel he makes. It offers six distinct presentation layouts
  (Brand System, Narrated Journey, Launch Hype, AI Canvas, Agency Split, Portfolio Reveal), each with
  its own structure, pacing, camera, and sound, plus four color flavors, a shared kinetic-type language (word builds with one
  highlighted keyword, typewriter swaps, echo type), deterministic GSAP helpers, a free local sound
  engine (synthesized music bed + motion-synced SFX + Kokoro voiceover), live-site capture for real
  portfolio assets, and six runnable demos for HyperFrames. Use this skill whenever AJ asks to make, design, style, storyboard, score, or animate
  any motion graphic, video presentation, promo, ad, reel, or animated deck: "make a video for my
  client", "motion presentation", "promo in my style", "animate this", "product launch video",
  "portfolio reel", "personal brand video", "showreel from my website", "explainer", "add sound
  effects / voiceover". Use it even when he doesn't say "my
  style", and use it alongside /hyperframes (which stays the render engine), never instead of it.
  Also use it when adding new reference videos to evolve the style.
---

# AJ Motion Style

This is AJ's motion system, distilled from five reference films plus his own brand reel. It is
**not one template.** Each presents differently, so the skill keeps six **layouts** (different
structures, pacing, camera, and audio) on top of one shared type-and-motion language, with
interchangeable color **flavors**.

**Division of labor.** This skill decides *how it looks, moves, and sounds*. HyperFrames
(`/hyperframes` → `/general-video`, `/motion-graphics`, `/product-launch-video` …) builds, checks, and
renders. The handoff is the project's `frame.md` (read first by HyperFrames, per
`hyperframes-creative/references/design-spec.md`), the runtime in `assets/`, and `assets/audio/mix.wav`.

## The shared language: ten laws

Every layout follows these. They're what all five references have in common.

1. **Type is the lead actor.** Lines build word by word (rise + de-blur) or type on behind an accent
   caret. Text *arrives*; it never just appears. That's what makes the viewer read.
2. **One keyword per line.** The payoff word gets the accent: a filled pill, marker sweep, selection
   brackets, or accent color with a heavier weight. Two highlights cancel each other out.
3. **One accent, full stop.** Base (dark or light-neutral) + ink + ONE saturated color. The accent is
   ~10% of the pixels, except for full-bleed accent panels used as punctuation.
4. **Weight contrast inside a line.** Regular body with a bold/black keyword; single-word hero hits go
   oversized, all-caps, tight. Serif narration lines are available where the layout calls for them.
5. **Transitions carry continuity.** Morphs, push/pull-throughs, whips, panel wipes, and camera moves.
   Hard cuts only on the beat; how many is a *layout* decision (see layouts.md).
6. **Ride the beat grid.** Music BPM (96–128) sets the grid: something changes every beat, a new idea
   every 1.5–3 s, one breathing hold before the end. Voice layouts follow word timestamps instead.
7. **Show the real thing.** UI cards in 3D, prompts typing, chips popping, real screenshots and
   dashboards. Proof beats show the work, not stock.
8. **Atmosphere, never flat.** Blurred orbs, grain, glow, vignette. Depth even behind one sentence.
9. **Every visible landing has a sound.** Impacts on slams, pops on chips, keyboard ticks on typing,
   risers into big moments, a music bed on the grid, voice where the layout is narrated.
10. **Thread a motif, end on a question.** A guide element (spark, dot, caret, mark) leads the eye;
    close with a brand lockup and a question or call to action.

## Workflow

1. **Intake.** If `/hyperframes` already wrote `BRIEF.md`, read it and ask nothing it answers. Get
   the message, audience, length, aspect, brand, and real assets (screens, footage, numbers).
   **Never invent stats or client names.** Given a URL, capture the real pages yourself:
   `node ~/.claude/skills/aj-motion-style/scripts/capture-site.mjs <out> name=https://… [...]`.
   Portfolio sites often hide their work behind buttons or galleries, so open those with a short
   Playwright script and collect the image URLs before settling for the landing page.
2. **Pick the layout** with [references/layouts.md](references/layouts.md) (the choosing table), then
   the **flavor** with [references/flavors.md](references/flavors.md) (layout default, a different
   flavor, or one derived from the client brand). State both picks in one line each.
3. **Scaffold** from the matching demo, which is the fastest way to a working piece:
   `node ~/.claude/skills/aj-motion-style/scripts/scaffold.mjs <project-dir> --demo <layout> [--dry-run]`
   (`--list` shows demos; never overwrites existing files). Then write `frame.md` from
   [assets/frame-template.md](assets/frame-template.md).
4. **Beat sheet.** Use the layout's structure and [references/story-structures.md](references/story-structures.md)
   for durations; assign moves from [references/signature-moves.md](references/signature-moves.md).
   Motion numbers are in [references/motion-grammar.md](references/motion-grammar.md).
5. **Voice.** Narrated layouts, or a sparse line per scene when AJ asks for voice. Write `vo.json`,
   run `scripts/voice.mjs`, get word times with `scripts/transcribe.py --words`, and land each key
   word on its visual. See [references/sound-design.md](references/sound-design.md).
6. **Build** the composition: replace the demo copy and media with the project's, keep the move
   structure, keep the helpers' determinism rules.
7. **Sound.** Write `cues.json` at the same timestamps as the tweens, run `scripts/sound.mjs`, and
   reference `assets/audio/mix.wav` with an `<audio id>`.
8. **Audit and verify.** Run [references/audit.md](references/audit.md), then `npx hyperframes lint`
   and `check` (0 errors), render a draft, **look at frames at each beat**, run
   `scripts/transcribe.py <render>.mp4` to confirm every voice line is intelligible, and check
   loudness. Fix, then do the final render.

## Runtime (`assets/aj-motion.js`, global `AJMotion`)

Every applier is `fn(tl, target, at, opts)`: it adds tweens to your paused timeline at an absolute
time and returns the time its move settles.

| Move | Call |
|---|---|
| Build a line + keyword | `buildSentence(tl, "#line", 0.4, { keyword, highlight: "fill"\|"sweep"\|"bracket"\|"color", times? })` |
| Exit a line (incl. highlight) | `exitSentence(tl, "#line", 2.9)` |
| Typewriter / cycling word | `typeOn(tl, el, t, { cps, caret, blinkUntil })` · `swapWord(tl, el, ["a.", "b."], t)` |
| Echo type | `echoStack(tl, "#hero-word", t, { count: 2 })` (call before tweening the source) |
| Accent flash / wipes | `flashCard(tl, "#flash", t, { hold })` · `wipeIn(tl, el, t, { from })` |
| Hard-cut hit | `slam(tl, el, t, { from: 1.2 })` |
| Transitions | `panelPush` · `whip` · `zoomThrough` · `camera(tl, world, t, { scale, x, y })` |
| UI / product | `tiltFloat` · `chipPop(…, { select })` · `slotFocus` · `countUp` · `drawPath` |
| Motif / atmosphere | `motifPath(tl, el, [{ x, y } \| { to, dx, dy }], t)` · `ambientDrift` |
| Generic in/out | `arrive` · `leave` |
| Timing math | `snapToBeat` · `beatGrid` · `readHold(words)` · `seededRandom` · `repeatCount` |

Determinism (HyperFrames): no clocks, seeded randomness only, finite repeats, `set`-based typing,
tween transforms/opacity (not `letter-spacing`), never tween a `.clip` element's visibility, and
register `window.__timelines[id]` after the build. Measure elements only in clips active at build
time; otherwise pass coordinates.

## Evolving the style

To add a reference, make contact sheets and a cut report (the HyperFrames student kit's
`motion-showreel/scripts/analyze-reference.mjs <video> <out-dir> --fps 4` does both; plain
`ffmpeg -i ref.mp4 -vf "fps=4,scale=480:270,tile=4x4" sheet_%02d.png` covers the sheets), read every
sheet, and run `scripts/transcribe.py ref.mp4` to see whether it has voiceover. A new *presentation* becomes a new layout (plus a demo); a pattern shared
by most references becomes a law.

## Files

- [references/layouts.md](references/layouts.md): the six layouts (structure, pacing, moves, audio) and how to choose
- [references/sound-design.md](references/sound-design.md): cue sheets, SFX palette, music styles, voiceover, loudness
- [references/flavors.md](references/flavors.md): palettes and deriving one from a client brand
- [references/design-language.md](references/design-language.md) · [references/motion-grammar.md](references/motion-grammar.md) · [references/signature-moves.md](references/signature-moves.md) · [references/story-structures.md](references/story-structures.md) · [references/audit.md](references/audit.md)
- `assets/aj-motion.js` · `assets/aj-motion.css` · `assets/fonts/` (Inter, Instrument Serif, Dancing Script; OFL) · `assets/frame-template.md`
- `assets/demos/<layout>/` (index.html, cues.json, vo.json for voiced ones) · `assets/demos/MEDIA.md` (what each demo image should show) · `assets/demos/_media/` (local only, never committed: AJ's portfolio images)
- `scripts/scaffold.mjs` · `scripts/sound.mjs` · `scripts/voice.mjs` · `scripts/capture-site.mjs` · `scripts/transcribe.py`
- Tests: `node --test tests/aj-motion.test.mjs tests/sound.test.mjs tests/scripts.test.mjs`
