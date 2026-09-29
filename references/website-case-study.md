# Website Case-Study Films

A short film (45–60 s) that presents one website you built: commercial, product showcase and case study at
once. The live site is the hero asset. This is the proven recipe; follow it before inventing a new one.

## Contents
1. Deliverables before building
2. Verify the site (capture rules)
3. Honesty rules
4. Structure and layout choice
5. Build and sound
6. Gotchas

## 1. Deliverables before building
Write `STORYBOARD.md` with: website analysis · the most important information · story angle · scene-by-scene
storyboard · exact on-screen copy · motion direction · assets · transitions · timing · final CTA · total duration.
Hook in the first 1–3 s. End on the live site, then the closing card
(CUSTOM WEBSITE / Designed. Built. *Automated.* / brand lockup / services / URL / socials).

## 2. Verify the site (capture rules)
- **Read every page first**: text, links, controls, fonts, colors (`getComputedStyle` + `:root` tokens), scripts,
  requests. The footer usually says whether the brand is real.
- **Verify each feature live before the film claims it.** Anything you could not verify (e.g. hover effects gated to
  real pointers) is left out of the film, not implied.
- **One chained session.** Capture consecutive states (select → next step → confirm) in a single browser session so
  every frame is a real consequence of the previous one. Re-capturing a step later gives a different reference
  number, date or state.
- **Network guard for anything that submits.** Route every request; abort and log anything non-GET or off-site:
  ```js
  await context.route("**/*", (route) => {
    const request = route.request();
    if (request.method() !== "GET" || !request.url().startsWith(SITE)) { blocked.push(request.url()); return route.abort(); }
    return route.continue();
  });
  ```
  Only use a submit flow in the film if it completes with 0 requests sent (local-only demo). Never send data to a
  live site; a script that must submit for real belongs behind an explicit flag.
- **Real motion, frame by frame.** Typing: one screenshot per keystroke. Sliders: one per keyboard step. Scroll
  effects: scroll in fixed steps (10–20 px) with a short wait, screenshot each; then time-remap the frames into
  clips with knots `(film_time, frame)` so key moments land on voice lines. Probe determinism by comparing a
  stepped frame with a jumped-to frame at the same offset; smoothing libraries (lerp) can often be disabled
  via a data attribute.
- **Warm reveals first.** Scroll the whole page once before element crops, or reveal-on-scroll content crops faded.
  Hide sticky headers while cropping elements. Crop by "smallest element containing text A and text B".
- **Resolve Playwright with `scripts/playwright.mjs`** (`loadPlaywright()`, `launchOptions()`), never a hardcoded
  npx-cache path or Chromium revision.
- Keep the capture and prep scripts **in the project** (`<film>/tools/`) and name them in `frame.md`, so the
  footage can be rebuilt in a later session.

## 3. Honesty rules
- Do not invent features, statistics or clients. Demo sites label their figures as fictional/illustrative: show
  those numbers only as on-site UI, never as claims, and tag the finale "Concept … · Fully working build".
- Skip testimonials and headline stats on demo sites.

## 4. Structure and layout choice
Pick a layout that fits the niche and that the series hasn't used recently; variety means a different layout,
not a recolor. Derive the flavor from the site's own fonts and colors (copy its woff2 files, check variable
axes like `font-stretch` render). Proven shape: hook question → the site's key flow as real states
(cursor on the real targets) → what the flow produces (reference, calendar file, saved lead) → the rest of the
site in a bento or stack → end on the live homepage footage → question + closing card.

## 5. Build and sound
- Voice: write `vo.json`, run `scripts/voice.mjs --force`, measure word times with `transcribe.py --words`, land
  keywords with `buildSentence(..., { times })`. Re-voice lines Whisper mishears in isolation.
- Sound: `cues.json` at the tween timestamps; loudness target −14 to −16 LUFS, peak ≤ −1 dBFS. Fix loudness with
  `targetDb` and remux the new `mix.wav` onto the render instead of re-rendering.
- Verify: `npx hyperframes lint` and `check` (0 errors), draft render, contact sheets at every beat, then
  `transcribe.py` on the final render and fix any word an SFX masks (move or soften that SFX).

## 6. Gotchas
- Scaffolding copies the demo's `vo/*.wav`; `voice.mjs` reuses existing WAVs, so use `--force` on a new project.
- A `<video class="clip">` must not sit inside a timed section: put it in an untimed host div and set the host's
  opacity/clip-path on the timeline. Encode clips with `-g 30 -keyint_min 30`.
- Initial hidden states go in `gsap.set(...)`, not `tl.set(..., 0)` (a set at 0 does not render frame 0).
- Several `fromTo` on the same elements need a `gsap.set` baseline plus `to`.
- `drawPath` wants a selector string or elements, not an array of selector strings.
- Typed text wraps at spaces (`.md-ch` is pre-wrap); set `white-space: pre` for single-line giant type.
- Tween transforms (`x`, `y`, `scale`), not `left`/`top`, or motion snaps to whole pixels.
- `check` flags transparent-fill outline text as unpainted; give it a faint fill.
- Tall serif display fonts trigger `content_overlap` false positives; verify visually.
- Whisper hears homophones ("patients"→"patience", "Built square"→"Build square"); if the isolated line reads
  back right and the words are on screen, it's fine.
