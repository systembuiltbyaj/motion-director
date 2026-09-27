# Design Language

The static half of the style: what a single frame looks like. Motion is covered in
`motion-grammar.md`.

## Contents
1. Palette logic
2. Typography
3. Layout grammar
4. Depth, surface, and texture
5. What this style is not

## 1. Palette logic

Every reference uses the same structure: **base + ink + one accent**.

| Role | Rule | Why |
|---|---|---|
| Base | Tinted near-black (teal-black, charcoal, pure black) **or** a warm light neutral (#EEE–#F2F0EC). Never mid-gray. | Dark bases make the accent glow. Light bases read as "clean product canvas". |
| Ink | White on dark, near-black on light. A muted tone (~55% contrast) for secondary copy. | Keeps hierarchy to two steps, so the accent stays the only loud thing. |
| Accent | ONE saturated color: electric blue, neon mint, lime, warm orange, amber. It fills the keyword, the caret, the chip selection, stat numbers, the flash card, and the motif. | A single accent trains the eye: "accent = the point". A second accent dilutes that. |
| On-accent | The text color inside accent fills (dark ink on bright accents, white on deep accents). | Keyword pills must pass contrast. |
| Atmosphere | 2–3 blurred orbs in accent-adjacent hues at 15–55% alpha. | They add depth without adding a second accent. |

- Accent share: ~10% of pixels, with one deliberate exception: the **flash card**, a full-bleed accent
  frame used 1–2 times per minute as punctuation.
- Status colors (green/red) only appear *inside* UI mockups, never in the motion layer.
- Photography and footage can bring their own colors. Grade them toward the base (a slight tint and
  lifted blacks) so they sit inside the palette.

## 2. Typography

- **Primary:** a clean grotesk or geometric sans (Inter is bundled; Inter Tight, Manrope, General
  Sans, Space Grotesk, and Plus Jakarta Sans all fit). One family carries almost everything.
- **Weight contrast inside a line:** body 400–500, keyword 700–900. The weight jump matters as much
  as the color.
- **Hero words:** a single word at 180–300 px (1080p), all caps, tracking −0.04 to −0.05em,
  line-height 0.9. Used for flash cards, echo stacks, and section slams.
- **Sentences:** 80–100 px (1080p), sentence case, tracking −0.03em, line-height 1.1, max 2 lines
  and ~8 words. Longer thoughts split across beats.
- **Narration serif (optional, Electric System flavor):** a light serif at ~40 px for calm
  statements between loud beats. Its contrast with the grotesk reads as editorial and confident.
- **Stats:** tabular numerals, black weight, accent color, glow on dark flavors.
- **Chrome/labels:** 20–30 px, 600 weight, uppercase with +0.08em tracking, muted. Use sparingly.
- Text never touches the frame edge: 8% safe margin horizontally, 10% vertically on 9:16.

## 3. Layout grammar

| Pattern | Use for | Notes |
|---|---|---|
| **Centered line** | Hooks, payoffs, CTAs | Line at optical center (slightly above). Nothing else on screen but atmosphere. |
| **Left-anchored stack** | Explanations, 2–3 line builds | Left edge at 8–10%. Ragged right. Keyword may sit on its own line. |
| **50/50 split** | Promo beats that pair a claim with footage | A solid accent or base panel with type on one side, footage or UI on the other. Panels push, never fade. |
| **Copy + tilted card** | Product proof | Text column ~55%, 3D-tilted UI card ~45%, chips under the copy. |
| **Bento mosaic** | Montage, "everything we do" | 3–6 tiles on a grid with a 12–16 px gutter. Tiles reconfigure (push/scale) instead of cutting. |
| **Canvas / node graph** | Workflow, AI, automation stories | Nodes connected by curved hairlines. The camera pans across, then pulls back to reveal the whole. |
| **Full-bleed flash** | Punctuation between acts | Accent color fills the frame, with one oversized word, optionally echoed. |
| **Lockup** | Ending | Logo/wordmark center, role line muted, CTA question built with a keyword. |

Composition is free inside these patterns. The atoms (palette, type ramp, card style) are fixed.

## 4. Depth, surface, and texture

- **Cards:** 20–24 px radius. A 1.5 px border at accent- or ink-tinted alpha. Dark flavors get a soft
  outer glow; light flavors get a long soft shadow. Glass (`backdrop-filter: blur`) only over atmosphere.
- **3D:** one perspective stage (~1600 px). Cards rest at rotateX ≈ 10°, rotateY ≈ −14° and float
  ±10 px. Never spin anything a full rotation.
- **Glow:** accent-colored bloom on keywords, stats, and the motif, on dark flavors only.
- **Grain:** static SVG noise at 15–25% overlay on warm and light flavors. It is never animated
  (determinism) and never on pure-black flavors.
- **Vignette:** subtle, always. It pulls focus to center.
- **Motion blur:** faked with `filter: blur()` peaking mid-move on whips and fast entrances.

## 5. What this style is not

- Not a slideshow. If a frame holds more than ~1.5 s with nothing moving, it's dead.
- Not multi-accent, rainbow gradient, or purple-to-blue "AI" gradients.
- Not stock-template swooshes, lens flares, or 3D logo spins.
- Not paragraph text on screen. One idea per beat.
- Not hard-cut slide decks. Beats connect.
