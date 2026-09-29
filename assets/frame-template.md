---
version: alpha
name: "<Project> — AJ Motion Style (<flavor>)"
description: >
  Frame-scale spec for <project>, built on the aj-motion-style skill. One base, one ink, ONE accent.
  Kinetic grotesk type with a single highlighted keyword per line, tilted glass UI cards, blurred
  atmosphere orbs, and continuous camera transitions on a 128 BPM grid. Replace every <placeholder>;
  the defaults below are the Glow Dark flavor.
unit: the frame — 1920×1080 primary; 9:16 and 4:5 documented
principle: atoms are sacred · composition is free · one accent · one keyword per line · numbers come from the client
flavor: glow-dark   # glow-dark | electric-system | warm-canvas | bold-split | <custom>

colors:
  bg: "#05110f"
  bg-2: "#0a2621"
  surface: "rgba(255,255,255,0.05)"
  surface-border: "rgba(61,245,176,0.35)"
  text: "#eafaf4"
  text-muted: "#8fb3a8"
  accent: "#3df5b0"
  on-accent: "#03120d"
  orb-1: "rgba(61,245,176,0.32)"
  orb-2: "rgba(22,160,133,0.35)"
  orb-3: "rgba(180,255,90,0.18)"

radii:
  card: "22px"
  node: "16px"
  pill: "999px"
  key: "0.16em"

typography:
  sentence: { fontFamily: "Inter", px: 92, weight: 500, lineHeight: 1.12, tracking: "-0.03em", color: "text" }
  keyword:  { fontFamily: "Inter", weight: 800, color: "on-accent", fill: "accent" }
  hero:     { fontFamily: "Inter", px: 230, weight: 900, lineHeight: 0.9, tracking: "-0.05em", upper: true }
  stat:     { fontFamily: "Inter", px: 300, weight: 900, tabular: true, color: "accent" }
  swap:     { fontFamily: "Inter", px: 150, weight: 800, color: "accent" }
  label:    { fontFamily: "Inter", px: 26, weight: 600, tracking: "0.08em", upper: true, color: "text-muted" }
  chip:     { fontFamily: "Inter", px: 30, weight: 600 }

spacing:
  safe-x: "8%"
  safe-y: "8%"
  line-max: "1500px"
  gap-cards: "16px"

motion:
  bpm: 128
  ease-enter: "expo.out"
  ease-move: "expo.inOut"
  ease-exit: "power3.in"
  ease-pop: "back.out(2.2)"
  word-stagger: 0.07
  word-duration: 0.6
  keyword-delay: 0.12
  keyword-highlight: "fill"      # fill | sweep | bracket | color
  type-cps: 24
  cut-budget-per-10s: 2
  transitions: ["sentence-exit-build", "whip", "flash-card", "zoom-through"]   # pick ≤ 4
  motif: "accent dot"            # dot | spark | caret | orb

components:
  keyword-pill:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{radii.key}"
    description: "The one loud element in every line. Wipes in left→right after the word lands."
  card:
    backgroundColor: "{colors.surface}"
    border: "1.5px solid {colors.surface-border}"
    rounded: "{radii.card}"
    shadow: "long soft drop + accent glow on dark flavors"
    description: "UI proof surface; rests in 3D tilt (rx 10°, ry -14°) and floats ±10px."
  chip:
    rounded: "{radii.pill}"
    description: "Tool/option pills. Pop in staggered; the selected one fills with accent."
  flash-card:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    description: "Full-bleed punctuation, 1–2 per minute, with one hero word (optionally echoed)."
---

## Overview

<One paragraph: what this video is, who it's for, and why this flavor fits them.>

This project uses the **aj-motion-style** language: kinetic type as the lead actor, one accent,
continuous camera, product proof on screen, atmosphere always present. Motion rules live in
`~/.claude/skills/aj-motion-style/references/motion-grammar.md`; this file holds the brand truth.

## The Frame

- **Squint:** one line or one hero element dominates; the keyword pill is the brightest thing on screen.
- **Silence:** atmosphere + one idea. Never a paragraph, never two competing highlights.
- **Restraint:** the accent appears only on the keyword, caret, selected chip, stat, flash card, and motif.
- Primary 1920×1080; safe margins `{spacing.safe-x}` / `{spacing.safe-y}`.

## Colors

`{colors.bg}` ground with an atmosphere gradient to `{colors.bg-2}` and 2–3 blurred orbs.
`{colors.accent}` is the only accent. `{colors.text}` for ink, `{colors.text-muted}` for secondary.

## Typography

One grotesk family. Sentences at `{typography.sentence}`; the keyword jumps to weight 800 inside an
accent pill. Hero words are uppercase and tight. Stats use tabular numerals in accent.

## Composition Rules

- One keyword per line, ≤ 8 words per line, ≤ 2 lines per beat.
- Proof beats pair a line (left ~55%) with a tilted UI card (right ~45%).
- Transitions limited to the `motion.transitions` list above.

## Approved Entities

<Logos, product names, client names, screenshots the client approved.>

## Numerals & Claims (hard rule)

Every number on screen comes from the user or the client, with its source noted here: <stat — source>.

## Known Gaps

<Missing assets, open questions.>
