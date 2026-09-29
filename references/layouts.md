# Presentation Layouts

Eight distinct ways to present: five from the reference films, Portfolio Reveal from a personal
brand reel, and UI Morph Loop and Stage Film from a study of prompted AI motion films. A **layout**
decides structure, pacing, camera, and audio. A **flavor** (`flavors.md`) decides palette. They're
independent: any layout can take any flavor, but each has a default that matches its source.

Pick the layout first, based on the message and the assets you have, then the flavor. Every layout
has a runnable demo: `node scripts/scaffold.mjs <project> --demo <name>`.

## Contents
1. Choosing
2. Brand System
3. Narrated Journey
4. Launch Hype
5. AI Canvas
6. Agency Split
7. Portfolio Reveal
8. UI Morph Loop
9. Stage Film
10. HUD frame (add-on for any layout)
11. Mixing layouts

## 1. Choosing

| If the piece is… | Use | Why |
|---|---|---|
| An identity, brand guideline, "who we are", or a portfolio that should feel designed | **Brand System** | Shows the system itself (tiles, type, grid), so the brand reads as deliberate |
| A story, founder message, or explainer that needs a voice | **Narrated Journey** | Voice carries the meaning; visuals illustrate each phrase in sync |
| A product or feature launch, a stat-driven claim, social hype | **Launch Hype** | Fast, neon, stat-first; every beat is a claim plus proof |
| An AI, SaaS, or workflow product demo; "how it works" | **AI Canvas** | Shows the product thinking and building, prompt to result |
| A service, agency, or personal-brand promo with real photos or screens | **Agency Split** | Typed copy + image panels move fast and carry a lot of real material |
| A personal brand or portfolio reel: "here's my work, here's what runs behind it, here's me" | **Portfolio Reveal** | Earns the reveal of the person by showing the work first; the "front vs. system" twist sells technical depth |
| A short UI sting, feature teaser or social loop: "look how smooth this product feels" | **UI Morph Loop** | One element never cuts, so the product's craft is the whole story; loops seamlessly in a feed |
| A calm, premium product or feature film for a SaaS or app | **Stage Film** | The product sits on a stage with lots of space around it; restrained, one idea per second, quieter than Launch Hype |

Automation and systems work usually wants **AI Canvas** (how a system works) or **Launch Hype** (what it
achieves). Personal brand and portfolio reels want **Portfolio Reveal**. Client promos with footage usually want **Agency Split**.
A capability or "how we work" reel for a studio or freelancer takes any layout plus the **HUD frame** (§10).

## 2. Brand System  ·  demo `brand-system`  ·  source: brand-guideline film

- **Default flavor:** Electric System (black / white / one electric color). Serif + grotesk pair.
- **Pacing:** 118–124 BPM `pulse`. Tight: 3–5 hard cuts per 10 s, all on the beat. Cuts are the
  style here, so it's allowed to break the ≤ 2 cut budget.
- **Structure:** cinematic image + huge caps title → hard cut to black serif statement → giant
  image-filled word crawl → **brand tiles slam in on consecutive beats** (logo, colour, type,
  timing, easing, claim) → camera dives into a tile → easing curve with a dot riding it → blueprint
  "motion grid" that tilts away → type spec sheet → pins for tools/places, pulling back →
  **3D billboard in a dark hall** → blue lockup.
- **Signature moves:** `slam` on beats, `drawPath` (curves, grids), image-filled type
  (`background-clip: text`), pins constellation, billboard in perspective, serif narration lines.
- **Audio:** music + SFX, no voice. Impacts on slams, pops per tile, a sub-drop into the black
  interlude (music drums drop there), whoosh on camera dives.

## 3. Narrated Journey  ·  demo `narrated-journey`  ·  source: glow studio promo

- **Default flavor:** a custom Glow Dark (deep green + lime), with **one world change** to a light
  canvas halfway through.
- **Pacing:** voice-led. Each phrase gets a visual; on-screen words land on the **measured word
  timestamps** (`buildSentence(..., { times })`). Almost no hard cuts: the camera pushes through one
  continuous world.
- **Structure:** spark motif + cursor "click" → key words placed around orbit rings, one per spoken
  word → text rides a curved path → glass tile holding the spark → light streak wipes into the light
  world → chaos-to-workflow (scattered chips snap into a connected flow) → echoed hero word →
  **ribbon with text on it wraps a real screenshot** → spark + question close.
- **Signature moves:** guide motif hopping between words, SVG `textPath` riding (animate
  `startOffset`), world-change wipe, scatter → order, echo stack.
- **Audio:** Kokoro voiceover (`scripts/voice.mjs`), `ambient` music ducked under it, soft SFX
  (chimes, pops, swishes). Keep SFX quieter than in the other layouts so the voice leads.

## 4. Launch Hype  ·  demo `launch-hype`  ·  source: trading-app launch

- **Default flavor:** Glow Dark (mint neon on teal-black).
- **Pacing:** 128 BPM `drive`. A new beat every 0.9–1.5 s. Continuous transitions (whip,
  fly-through, flash) rather than cuts.
- **Structure:** **50/50 split: line left, accent panel with a huge stat right** → whip → glass coins
  flip in to reveal the stack → fly through a coin → accent flash question → **neon button stack
  cycling** (Capture → Qualify → Book, 2 beats each) → highlighted claim + real dashboard swinging
  up in 3D, camera push → **connected pill row on a light line** → feature stack scrolling up →
  tagline → brand strokes + mark lockup.
- **Signature moves:** `slam` stat, coin flip (`rotationY`), `whip`, `zoomThrough`, `flashCard`,
  neon borders/glow, `chipPop` rows, glint along a line.
- **Audio:** music + SFX, no voice. Impacts on stat and flash, pop ladders (rising pitch) on
  sequences, risers into big moments with a short drum drop before them.

## 5. AI Canvas  ·  demo `ai-canvas`  ·  source: AI agent product demo

- **Default flavor:** Warm Canvas (painterly orange cloud + light UI canvas).
- **Pacing:** calm and fluid, 100–110 BPM `pulse`. Voice in the **second half only** (the first
  half lets the UI speak). No hard cuts: morphs, circle reveals, camera pans, pull-backs.
- **Structure:** title in the cloud **morphs into a prompt card** → prompt types, send pressed →
  canvas opens from the card (circle reveal) → **giant type-on with the camera tracking the caret**
  → agent plan list + "Working" shimmer → created tags → **slot pickers** lock on tools → **node
  canvas with real screenshots, wires drawing, camera pan then pull-back** → channel chips with a
  selection + bento results → canvas collapses into an orb that blooms back into the cloud → question
  + lockup.
- **Signature moves:** card morph (width/height/radius), `typeOn`, `slotFocus`, `drawPath` wires,
  `camera` pan/pull-back, `chipPop` with `select`, shimmer text, clip-path circle reveal/collapse.
- **Audio:** keyboard `type` SFX under every typing moment, clicks on presses, swishes on picker
  moves, voiceover (2–3 lines) from the node canvas on, ducked music.

## 6. Agency Split  ·  demo `agency-split`  ·  source: agency promo template

- **Default flavor:** Bold Split (charcoal + amber).
- **Pacing:** fastest layout: 124 BPM `drive`, 3–5 cuts per 10 s. A scene every 1.5–2.5 s.
- **Structure:** mark + **typed wordmark whose second line swaps** → **top 50/50 split (amber caps
  panel | image) with a typed strip below** → panels push away → full-frame line with a big
  **amber word typing / erasing / retyping** → image panel + typed claim → full-bleed image with a
  one-word slam → proof split (Certified panel + badge) → full-amber **echo** title → typed line +
  **logo wall with a hopping highlight box** → work mosaic pull-back → mark + typed CTA + URL.
- **Signature moves:** `typeOn` / `swapWord` with the amber caret everywhere, `wipeIn` panels from
  opposite sides, `slam` caps on half-beats, ken-burns on images, echo title, hopping highlight.
- **Audio:** music + SFX, no voice. `type` SFX follows every typed line (count ≈ characters),
  impacts on slams, whooshes on panel wipes.

## 7. Portfolio Reveal  ·  demo `portfolio-reveal`  ·  source: a personal brand reel (not a reference film)

- **Default flavor:** `reveal`, the one flavor with two color roles: near-black `#0A0A0D`, white
  type, a **system** color `--md-system` (`#1F5BFF`) for grid, glows, wires and borders, and the
  **impact** accent `--md-accent` (`#FF5A1F`) only for impact words and active states. Black and
  white dominate. Swap both roles for the brand's colors; the system color stays the quieter one.
- **Pacing:** 124 BPM `drive`, speed-ramped. Scene lengths vary on purpose: hook 2 s, work 3–4 s
  each, twist 2 s, system 4 s, person 3 s, CTA 3 s. Transitions are 0.3–0.5 s (8–15 frames).
- **Structure:** *show the work → reveal the system → reveal the builder.*
  small line types → **huge masked headline flies through into the first build** → browser frames
  rise in a parallax stack and scroll the real pages (cursor tap) → **the stack whips off, new builds
  arrive from the other side** in a three-browser composition → **camera pushes into the front page,
  it splits in two and the workflows appear behind it** ("But that's just the front.") → dark
  workspace of real workflow screenshots: **TRIGGER** (node fires) → **ROUTE** (wires branch with
  pulses riding them) → **AUTOMATE** (every card lights) → headline over the dimmed workspace →
  **everything collapses to one point that blooms into the portrait** → script "Hello, I'm" + huge
  name + giant system-color background initials → brand lockup, services, socials held long enough to read.
- **Signature moves:** mask-up headlines (`yPercent 112 → 0` inside `overflow: hidden`), browser
  frames with real URL bars, parallax stacks, split-open reveal (two `clip-path` halves of the same
  page), `drawPath` wires with a pulse riding each wire (`getPointAtLength` keyframes), `slam` words
  that each *trigger a visual action*, collapse-to-point transition.
- **Assets:** real captured pages (`scripts/capture-site.mjs`), real workflow canvases, a portrait
  cutout with transparency. Never generate a person or fake a dashboard.
- **Audio:** sparse voiceover, **one short line per scene**, placed so its key word hits the matching
  visual (see sound-design.md §5). Music drops for the twist and the collapse; strongest impact on
  the name reveal.

## 8. UI Morph Loop  ·  demo `ui-morph-loop` (1:1)  ·  source: prompted "one shape, never cut" UI films

- **Default flavor:** Warm Canvas with the grain turned down (warm light gray, near-black components,
  one accent). Pure black-and-white plus one accent also works.
- **Pacing:** 120 BPM `pulse`, **something changes on every beat**, 16 s = 8 bars. Zero cuts: the whole
  film is one element.
- **Structure:** button → clicked → loader → check → stretches into a notification island → slider
  card (the cursor drags it) → toggle flipped on the beat → tabs (indicator slides) → opens into a chart
  (bars grow, hover tooltip) → collapses into ⌘K (types a query) → toast → **back to the button, so the
  last frame is the first**. Swap the states for the product's real components.
- **Signature moves:** `morphTo` (size, radius, fill on a spring with a tiny overshoot at most),
  `contentSwap` (blur swap, exit and entry timed separately), `cursor` with click ripples and drags,
  `camera` re-framing so each state fills the frame. The cursor lives outside the camera's world so it
  keeps one size; convert its targets from shape offsets to screen space.
- **Loop rule:** every property ends at its first-frame value before the last frame. Check it: the first
  and last frames should compare at PSNR ≥ 40 dB
  (`ffmpeg -i first.png -i last.png -lavfi psnr -f null -`).
- **Banned:** bouncy or elastic easing, glows, gradients on UI chrome, particle bursts, dead beats.
- **Audio:** music + SFX, no voice. A click on every press, pops laddered up on sequences, swishes on
  morphs, `type` under typing, one impact on the payoff state.

## 9. Stage Film  ·  demo `stage-film`  ·  source: prompted product films on a "stage in a canvas"

- **Default flavor:** Electric System. Outside the stage: the accent as soft light from one corner,
  fading to near-black. Inside: near-black, white type, muted gray, the accent for emphasis only.
- **Pacing:** 110 BPM `pulse`, about **one idea per second**, compact type (no giant headings) with a
  lot of negative space. Continuous transitions; the only hard change is the brand-color flood.
- **Structure:** a rounded **stage** covering ~80% × 75% of the frame, a little below center, holds
  everything. A **persistent element** (here a stories-style progress rail; a player bar or nav works
  too) stays put across every shot and advances with each scene. Intro (kicker + name + tagline) → the
  pain as a **too-fast list that lands** on one word, "?" pops 0.2 s later → "Not *more tools*. Just *one
  system*." with the **strike dropping into the underline** → **brand-color flood** interstitial → the
  product UI, a cursor runs it, rows resolve one by one → **word portal**: "It's LIVE." with the end
  scene showing through the letters, then the camera dives through a letter's stem → end card with a
  micro-breath.
- **Signature moves:** `listSpin`, `strikeToUnderline`, `wipeIn` flood, `cursor`, `textPortal`, `breathe`.
- **Rules:** outgoing titles leave before incoming titles take the same space; oversized moves stay
  clipped to the stage; no outer captions, watermarks or counters outside the stage.
- **Audio:** music + SFX (a sparse voice line per scene also works). Ticks under the spin, a pop on the
  "?", riser + impact into the flood and the portal.

## 10. HUD frame (add-on for any layout)

Not a layout: frame chrome that turns any layout into a craft or capability reel, the film annotating
itself. `hudFrame(tl, "#hud", 0, duration, { bpm, chapters: sceneStarts, label })` adds corner brackets,
a running timecode, a label + BPM readout and a chapter counter (01/07) to an empty full-frame layer.
Pair it with `selectBox` (a Figma-style selection frame with handles and a W × H label around a real
element) and `easeGraph` (the ease being used, drawn with a dot riding it). Use it when the audience
buys the craft (studios, freelancers, agencies pitching motion or design); skip it for end customers,
who read chrome as clutter.

## 11. Mixing layouts

A longer piece can chain two layouts. For example, Narrated Journey for the story and AI Canvas for
the demo, joined by one world-change transition. Keep one flavor across the whole piece, and never
more than two layouts: past that it stops feeling like one film.
