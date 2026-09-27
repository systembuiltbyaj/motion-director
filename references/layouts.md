# Presentation Layouts

Six distinct ways to present: five from the reference films, plus Portfolio Reveal, built for AJ's
own brand reel. A **layout** decides structure, pacing,
camera, and audio. A **flavor** (`flavors.md`) decides palette. They're independent: any layout can
take any flavor, but each has a default that matches its source.

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
8. Mixing layouts

## 1. Choosing

| If the piece is… | Use | Why |
|---|---|---|
| An identity, brand guideline, "who we are", or a portfolio that should feel designed | **Brand System** | Shows the system itself (tiles, type, grid), so the brand reads as deliberate |
| A story, founder message, or explainer that needs a voice | **Narrated Journey** | Voice carries the meaning; visuals illustrate each phrase in sync |
| A product or feature launch, a stat-driven claim, social hype | **Launch Hype** | Fast, neon, stat-first; every beat is a claim plus proof |
| An AI, SaaS, or workflow product demo; "how it works" | **AI Canvas** | Shows the product thinking and building, prompt to result |
| A service, agency, or personal-brand promo with real photos or screens | **Agency Split** | Typed copy + image panels move fast and carry a lot of real material |
| A personal brand or portfolio reel: "here's my work, here's what runs behind it, here's me" | **Portfolio Reveal** | Earns the reveal of the person by showing the work first; the "front vs. system" twist sells technical depth |

AJ's automation work usually wants **AI Canvas** (how a system works) or **Launch Hype** (what it
achieves). His own brand and portfolio reels want **Portfolio Reveal**. Client promos with footage usually want **Agency Split**.

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

## 7. Portfolio Reveal  ·  demo `portfolio-reveal`  ·  source: AJ's own brand reel (not a reference film)

- **Default flavor:** a custom brand flavor: near-black `#07050D`, white type, violet `#6C20FF`
  for systems (grid, glows, wires, borders), yellow `#F7CB1E` only for impact words and active
  states. Black and white dominate.
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
  name + giant violet background initials → brand lockup, services, socials held long enough to read.
- **Signature moves:** mask-up headlines (`yPercent 112 → 0` inside `overflow: hidden`), browser
  frames with real URL bars, parallax stacks, split-open reveal (two `clip-path` halves of the same
  page), `drawPath` wires with a pulse riding each wire (`getPointAtLength` keyframes), `slam` words
  that each *trigger a visual action*, collapse-to-point transition.
- **Assets:** real captured pages (`scripts/capture-site.mjs`), real workflow canvases, a portrait
  cutout with transparency. Never generate a person or fake a dashboard.
- **Audio:** sparse voiceover, **one short line per scene**, placed so its key word hits the matching
  visual (see sound-design.md §5). Music drops for the twist and the collapse; strongest impact on
  the name reveal.

## 8. Mixing layouts

A longer piece can chain two layouts. For example, Narrated Journey for the story and AI Canvas for
the demo, joined by one world-change transition. Keep one flavor across the whole piece, and never
more than two layouts: past that it stops feeling like one film.
