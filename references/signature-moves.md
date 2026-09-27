# Signature Moves

Sixteen moves that recur across the references. Each move lists its intent, when to use it, and the
call. "Deeper" points to a `hyperframes-animation` rule (`~/.claude/skills/hyperframes-animation/rules/`)
for richer variants. Read that rule rather than improvising.

A 30 s piece typically uses 6–9 moves, with the first two appearing in almost every beat.

## Contents
Type: 1 Build-a-sentence · 2 Keyword highlight · 3 Typewriter prompt · 4 Word swap · 5 Echo stack · 6 Stat punch
Structure: 7 Flash card · 8 Panel push · 9 Bento reconfigure · 10 Slot-list focus
Product: 11 Tilted UI float · 12 Prompt → chips → selection · 13 Node canvas + pull-back
Camera: 14 Whip · 15 Zoom-through · 16 Guide motif

---

## Type

### 1. Build-a-sentence
- **Intent:** make the viewer read at the speed the idea lands.
- **When:** every spoken or written line. This is the default text entrance.
- **Call:** `buildSentence(tl, "#line", t, { keyword })` → then `readHold(words)` → `exitSentence(tl, "#line", tEnd)`.
- **Variants:** a slower stagger (0.1) for gravitas; left-anchored vs. centered; a two-line build where
  line 2 starts as line 1's keyword lands.
- **Deeper:** `waterfall-entry`, `kinetic-beat-slam`.

### 2. Keyword highlight
- **Intent:** name the point. One per line.
- **Modes:** `fill` (accent pill, dark text: the loudest option, for hooks and CTAs) · `sweep` (marker
  underline: explanatory lines) · `bracket` (selection box with corner handles: UI and tech stories) ·
  `color` (accent + weight only: the quietest option, for dense lines).
- **Rule:** the highlight lands after the word does (a built-in 0.12 s delay plus 55% of the word's rise).
- **Deeper:** `css-marker-patterns`, `asr-keyword-glow` (sync to voiceover word timestamps).

### 3. Typewriter prompt
- **Intent:** show a human or AI "asking". It makes product demos feel live.
- **When:** prompt boxes, search bars, chat UIs, terminal lines.
- **Call:** `typeOn(tl, "#prompt-text", t, { cps: 24, blinkUntil })`. The caret is the accent color.
- **Deeper:** `discrete-text-sequence` (typos, backspaces), `context-sensitive-cursor`, `camera-cursor-tracking`.

### 4. Word swap
- **Intent:** "we do X… and Y… and Z". One frame carries many ideas.
- **When:** services lists, "for your ___" lines, problem stacks.
- **Call:** `swapWord(tl, "#slot", ["websites.", "campaigns.", "brands."], t, { hold: 0.5 })`.
- **Rule:** keep the stem line static; only the last word cycles. Max 4 swaps.

### 5. Echo stack
- **Intent:** amplify a single hero word into a graphic element.
- **When:** section titles, flash cards, one-word slams ("AUTOMATED.", "Brand Strategy").
- **Call:** `echoStack(tl, "#word", t, { count: 2, outline: true })`.
- **Deeper:** `3d-text-depth-layers` (extruded variant).

### 6. Stat punch
- **Intent:** a number as a headline.
- **When:** any quantified claim (real numbers only).
- **Call:** `countUp(tl, "#stat", 75, t, { suffix: "%" })`. Pair it with a one-line context build under it.
- **Deeper:** `counting-dynamic-scale`, `stat-bars-and-fills`, blueprint `dataviz-countup`.

## Structure

### 7. Flash card
- **Intent:** punctuation. It resets attention between acts.
- **When:** 1–2 times per minute, never back to back.
- **Call:** a full-bleed `.aj-flash` element + `flashCard(tl, "#flash", t, { hold })`. Put one hero word
  inside (move 5).

### 8. Panel push
- **Intent:** systematic, "next item" energy.
- **When:** 50/50 split layouts, feature sequences, before/after.
- **Call:** `panelPush(tl, "#panelOut", "#panelIn", t, { dir: "left" | "up" })`.
- **Deeper:** `split-tilt-cards`, blueprint `comparison-split`.

### 9. Bento reconfigure
- **Intent:** "look how much there is", shown without cutting.
- **When:** portfolio montages, feature overviews, team or client walls.
- **How:** a CSS grid of tiles. Tween tile `x/y/scale` (FLIP style: measure before and after at build
  time) so the mosaic re-lays out on the beat, and only the image inside each tile changes. End on a
  pull-back.
- **Deeper:** `center-outward-expansion`, `depth-scatter-assemble`, blueprint `zoom-out-workspace-reveal`.

### 10. Slot-list focus
- **Intent:** choosing. Options scroll past and one locks in.
- **When:** model or voice pickers, service menus, "which plan".
- **Call:** `slotFocus(tl, "#list", t, { from: 0, to: 3 })`.
- **Deeper:** `vertical-spring-ticker`.

## Product

### 11. Tilted UI float
- **Intent:** a premium product shot without 3D software.
- **When:** any dashboard, app screen, or workflow card.
- **Call:** wrap it in `.aj-stage` and call `tiltFloat(tl, "#card", t, { until })`. Stagger inner rows with `arrive`.
- **Deeper:** `3d-page-scroll`, `orbit-3d-entry`, blueprint `device-surface-showcase`.

### 12. Prompt → chips → selection
- **Intent:** demonstrate a decision flow in 3 seconds.
- **When:** AI tools, configurators, onboarding.
- **Call:** `typeOn` the prompt → `chipPop(tl, ".chip", t, { select: n })` → the chosen option morphs into the next beat.
- **Deeper:** blueprint `prompt-type-submit-generate`, `agent-progress-theater`, `cursor-click-ripple`.

### 13. Node canvas + pull-back
- **Intent:** show a system. This one is on-brand for AJ's automation work.
- **When:** workflows, integrations, "how it works".
- **How:** nodes are cards connected by SVG curves (draw them with `svg-path-draw`). The camera pans
  node to node (`viewport-change` / `multi-phase-camera`), then pulls back to reveal the whole graph.
- **Deeper:** `avatar-cloud-network`, `coordinate-target-zoom`.

## Camera

### 14. Whip
- **Intent:** energy between two same-weight beats.
- **Call:** `whip(tl, "#out", "#in", t, { dir })`. Motion blur is built in.
- **Deeper:** `motion-blur-streak`.

### 15. Zoom-through
- **Intent:** go *into* an idea. A stat, a word, or a UI element becomes the doorway.
- **Call:** `zoomThrough(tl, "#el", t)`, with the next scene arriving from a slight scale-down.
- **Deeper:** `3d-camera-flight`, `scale-swap-transition`.

### 16. Guide motif
- **Intent:** continuity. A small accent element leads the eye to what reveals next.
- **Call:** `.aj-motif` + `motifPath(tl, "#motif", [{ x, y }, …, { to: "#next-thing" }], t)`. Land it
  on the target as the target reveals, then burst it out (scale 3, opacity 0).
- **Rule:** one motif per video. It's a signature, so repeat it at the start, once mid-piece, and at the lockup.

---

## More moves from the layout demos

Each is used in a demo under `assets/demos/`; copy the snippet from there.

| Move | Where | How |
|---|---|---|
| **Slam on the beat** | Brand System tiles, Agency caps | `slam(tl, el, t, { from: 1.2 })`: already big, settles, no fade |
| **Image-filled giant word** | Brand System | `background: url(img) center/cover; background-clip: text; -webkit-text-fill-color: transparent;` + an x crawl. Use a text-free crop |
| **Easing curve + riding dot** | Brand System | `drawPath` the curve, then tween `{ t: 0→1 }` with `onUpdate` placing the dot on the Bézier |
| **Pins constellation** | Brand System | pin SVG + serif name; one big pin, then `camera` pulls back as others pop |
| **3D billboard** | Brand System | `perspective` hall + board with `rotationY` dolly (-38° → -4°) |
| **Voice-synced build** | Narrated Journey | `buildSentence(tl, el, lineStart, { times: whisperWordStarts })` |
| **Text riding a path** | Narrated Journey | SVG `<textPath>`; tween `attr: { startOffset }` |
| **Scatter → order** | Narrated Journey | seeded random scatter positions, then tween chips to slots; `drawPath` the connectors |
| **Coin flip reveal** | Launch Hype | glass disc with logo; `rotationY: 200 → 0` + scale + de-blur, staggered |
| **Neon button cycle** | Launch Hype | stacked states; each rises in, icon spins in, previous lifts out on 2-beat steps |
| **Title → card morph** | AI Canvas | tween `width/height/borderRadius` from a dot; center with `xPercent/yPercent` (not CSS translate) |
| **Caret-tracking camera** | AI Canvas | measure text width with canvas `measureText`, slide the track so the caret stays in frame |
| **Canvas collapse to orb** | AI Canvas | `clipPath: circle(80%) → circle(3%)` + background to accent, then fade |
| **Top split + typed strip** | Agency Split | `wipeIn` panels from opposite sides, caps `slam` per line, `typeOn` below, panels push up |
| **Hopping highlight box** | Agency Split | an outlined box tweening `x` tile to tile on half-beats over a logo row |
