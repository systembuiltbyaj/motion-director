# Pre-Render Audit

Run this before every draft render, then run `npx hyperframes lint` and `npx hyperframes check`
(0 errors). Snapshot the beats with `npx hyperframes snapshot` or by extracting frames from a draft
render (`ffmpeg -ss <t> -i draft.mp4 -frames:v 1 f.png`) and **look at them**. Most style failures
only show up in pixels.

## Style

- [ ] **One accent.** No second saturated color outside footage or UI mockups.
- [ ] **One keyword per line**, and each keyword is the actual point of its line.
- [ ] **Weight contrast.** Keywords are visibly heavier than their line.
- [ ] **No SAMPLE media left** in the final render (`scaffold.mjs` lists them); every image is the user's or rebuilt in HTML.
- [ ] **Brand is right:** the lockup, URL and handle match this film's `brand.json` (client films use the client's).
- [ ] **Flavor is consistent.** A single `data-aj-flavor`; custom tokens only through CSS variables.
- [ ] Text sits inside the safe margins at its **largest** animated size (overshoot, echo, zoom).

## Motion

- [ ] **No dead frames.** Nothing on screen is fully static for more than ~1.2 s, except the final hold.
- [ ] **Entrances use y + blur + opacity.** No bare fades on text.
- [ ] **Easing.** Entrances `expo.out`, moves `expo.inOut`, exits shorter than entrances. No `linear`,
      `elastic`, or `bounce` on anything visible.
- [ ] **Cut budget.** ≤ 2 hard cuts per 10 s outside montage sections. Cuts land on beats.
- [ ] **Read time.** Each line holds at least `readHold(words)` after it finishes building.
- [ ] **Transition vocabulary.** ≤ 4 transition types, repeated deliberately.
- [ ] **Motif** appears at the start and at the lockup.
- [ ] Scene starts, flash cards, and stat punches sit on the beat grid (`snapToBeat`).

## Sound

- [ ] `assets/audio/mix.wav` exists, is referenced by an `<audio id>` (no id = silent render), and
      `cues.json` timestamps match the tweens.
- [ ] Every visible landing (slam, chip, typing, reveal) has a cue; ambient drift has none.
- [ ] Voice layouts: on-screen words use measured `times`; music is ducked under the voice.
- [ ] Loudness after render: I ≈ −14 to −16 LUFS, peak ≤ −1 dBFS
      (`ffmpeg -i out.mp4 -af ebur128=peak=true -f null -`).

## Layout

- [ ] The piece follows one layout's structure from `layouts.md` (at most two, joined by one world change).
- [ ] The cut rate matches the layout (Brand System / Agency Split fast; AI Canvas / Narrated
      Journey near-zero hard cuts).

## Determinism (HyperFrames)

- [ ] One `gsap.timeline({ paused: true })`, registered on `window.__timelines[<id>]` **after** the build.
- [ ] Build runs after `document.fonts.ready` (the helpers split and measure text).
- [ ] No `Date.now()`, no unseeded `Math.random()` (use `AJMotion.seededRandom`), no `repeat: -1`
      (use `AJMotion.repeatCount`).
- [ ] No tweens on `.clip` elements' visibility. Animate inner wrappers.
- [ ] Decorative overflow (orbs, zooming stats) carries `data-layout-allow-overflow`.

## Content

- [ ] Every stat, logo, and client name is real and approved.
- [ ] The CTA is a question or a direct action, with its keyword highlighted.
- [ ] Brand marks are used only with the right to use them.
