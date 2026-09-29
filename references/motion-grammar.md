# Motion Grammar

The numbers behind the feel. They were measured from the references (cut detection plus audio
onsets across 246 s of footage) and tuned for 30/60 fps HyperFrames renders. `AJMotion.EASE` and
`AJMotion.TIMING` hold the defaults.

## Contents
1. Easing
2. Durations and staggers
3. Reading time
4. Beat grid and pacing
5. Cut budget
6. Transition catalog
7. Entrances and exits

## 1. Easing — "dynamic out, extended in"

Things leave fast and settle long. That one curve is most of the premium feel.

| Use | Ease | Note |
|---|---|---|
| Entrances, text builds, arrivals | `expo.out` | Snappy first 20%, silky last 60%. |
| Moves between two on-screen states (panels, highlights, scroll, camera) | `expo.inOut` | Symmetric. Feels like a camera operator. |
| Exits | `power3.in` | Accelerate away. Exits are ~40% shorter than entrances. |
| Pops (chips, icons, stat punch) | `back.out(2.2)` | One overshoot, never a wobble. |
| Whips | `power4.in` out → `power4.out` in | Blur peaks at the seam. |
| Ambient (orbs, float) | `sine.inOut` | Finite yoyo only. |
| Never | `linear` on anything visible, `elastic`, `bounce` | They read as template motion. |

## 2. Durations and staggers

| Element | Duration | Stagger |
|---|---|---|
| Word build | 0.55–0.65 s | 0.06–0.08 s per word |
| Keyword delay | +0.12 s after the previous word | n/a |
| Keyword highlight wipe | 0.45 s | n/a |
| Char typewriter | 20–26 cps (prompts); 18 cps (big swap words) | seeded ±25% jitter |
| Backspace | 40–55 cps | n/a |
| Line exit | 0.35 s | 0.025 s per word |
| Card / panel entrance | 0.8–1.1 s | 0.1–0.12 s between siblings |
| Chip pop | 0.45 s | 0.07 s |
| Flash card wipe | 0.4 s in, 0.8–1.2 s hold, 0.4 s out | n/a |
| Whip | 0.28 s out, 0.5 s in, 0.2 s overlap | n/a |
| Zoom-through | 0.6–0.75 s `expo.in` | n/a |
| Count-up | 0.9–1.2 s | punch at 70% |

## 3. Reading time

`readHold(words)` = max(0.9, 0.4 + 0.2 × words) s, capped at 3.5 s. That's the hold *after* a line
finishes building. In the references a 4-word line holds ~1.2–1.3 s. If the voiceover or music needs
the line longer, keep something alive during the hold (orb drift, caret blink, card float).

## 4. Beat grid and pacing

- Music sits at **120–130 BPM** (reference onsets: 0.44–0.62 s apart). The default grid is 128 BPM =
  0.469 s/beat. Use `beatGrid({ bpm, count })` / `snapToBeat(t, { bpm })`.
- **Micro-change every beat (~0.5 s):** a word lands, a chip pops, a highlight wipes, the camera
  eases. Nothing sits fully still for more than ~1.2 s, except the final hold.
- **New idea every 3–6 beats (1.5–3 s).** Openers run faster (1.2–2 s per idea). The middle
  breathes (2–3 s). The ending holds (2.5–3.5 s on the lockup).
- Scene starts and flash cards land **on** a beat. Keywords land a hair after (the keyword delay), so
  they feel like the answer to the beat.
- If the user supplies music, measure it first (`analyze-reference.mjs` onsets, or the student kit's
  `music-grid.mjs`) and retime to its real BPM and phase.

## 5. Cut budget

Measured per 10 s: brand-system film 4.5, agency promo 3.9, launch 1.7, AI demo 1.5, glow promo 0.8.

- **Default: ≤ 2 hard cuts per 10 s.** Everything else is a continuous transition.
- Montage sections (bento, logo walls, "and more…") may run 3–5 cuts per 10 s, on the beat only.
- Never cut mid-word-build. Cut on a highlight landing or a flash-card peak.

## 6. Transition catalog

| Transition | Feel | When | Helper / rule |
|---|---|---|---|
| **Sentence exit → build** | Calm, editorial | Between two lines on the same background | `exitSentence` → `buildSentence` |
| **Whip** | Energy, "next!" | Changing topic at the same energy | `whip` · rule `motion-blur-streak` |
| **Flash card** | Punctuation, reset | Act breaks, a big claim | `flashCard` |
| **Panel push** | Structured, systematic | Split layouts, feature lists | `panelPush` |
| **Zoom-through** | Depth, "go deeper" | From a stat/word/UI element into the next world | `zoomThrough` · rule `3d-camera-flight` |
| **Pull-back reveal** | Scale, "look at all of it" | Ending a UI or canvas sequence | rules `multi-phase-camera`, `zoom-out-workspace-reveal` blueprint |
| **Morph** | Magic, continuity | Text → UI element, card → orb, logo → CTA | rules `scale-swap-transition`, `card-morph-anchor` |
| **Motif hand-off** | Guided, playful | The dot/spark flies to where the next thing appears | `motifPath` |
| **Mask wipe / light streak** | Cinematic | Revealing footage | clip-path tween, rule `css-marker-patterns` for sweep shapes |

Pick ≤ 4 transition types per video and repeat them. Consistency reads as a system.

## 7. Entrances and exits

- Everything enters with **y offset + opacity + blur** (never opacity alone). Default: y 40 px,
  blur 12 px → 0, `expo.out` 0.7 s (`arrive`).
- Exits go up and out with blur (`leave`, `exitSentence`), except whips, which exit sideways.
- UI elements pop (`chipPop`) or swing in from depth (`tiltFloat`). Text never pops, it rises.
- Stagger groups top-to-bottom, left-to-right: the order someone would read them.
