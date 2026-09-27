# Flavors

A flavor is the **palette and texture**: color, surface, glow, grain. Structure, pacing, camera, and
sound belong to the **layout** (`layouts.md`). Pick the layout first, then the flavor. Each layout
has a default flavor, but any combination works. Switch with `data-aj-flavor` on the composition
root (tokens live in `assets/aj-motion.css`), or expose it as a HyperFrames enum variable
(`data-composition-variables` + `render --variables '{"flavor":"warm-canvas"}'`) when a client wants
to compare looks.

## The four flavors

| | **Glow Dark** | **Electric System** | **Warm Canvas** | **Bold Split** |
|---|---|---|---|---|
| Base | Teal-black `#05110F` | Near-black `#0A0A0D` | Warm light `#F1EFEC` | Charcoal `#1E2026` |
| Accent | Neon mint `#3DF5B0` | Electric blue `#1F5BFF` | Hot orange `#FF5A1F` | Amber `#FFB400` |
| On-accent | Dark ink | White | White | Charcoal |
| Surface | Glass cards, accent glow border | White cards on dark | White cards, soft shadow | Accent-filled cards |
| Texture | Bloom glow, orbs | Crisp, minimal orbs | Heavy grain, painterly orbs | Flat, faint orbs |
| Default for layout | Launch Hype (and Narrated Journey as a green/lime variant) | Brand System | AI Canvas | Agency Split |
| Energy | Medium-high | High, fast cuts in montage | Calm, fluid | High, punchy |
| Best for | AI, SaaS, fintech, launches, **AJ's automation work** | Brand systems, agencies, bold identities | AI creative tools, product demos, wellness, premium services | Agencies, services, events, social promos |

**Default for AJ's own brand work:** Glow Dark, with his real brand accent swapped in if it's defined.

## Choosing

1. **Client brand exists?** Keep the flavor structure that matches their base (dark or light) and set
   `--aj-accent` to their primary. Pick `--aj-on-accent` by contrast (≥ 4.5:1 against the accent).
   If the brand has two colors, the second becomes an orb tint, never a second accent.
2. **No brand:** pick by audience and energy (table above) and state the choice.
3. **Mixing:** don't mix flavors within one video. The exception is a single "world change" beat
   (e.g., dark → warm canvas when the product appears), done as one continuous morph.

## Deriving a custom flavor

Override only these tokens in the project's `frame.md` and CSS:

```css
[data-aj-flavor="client-x"] {
  --aj-bg: #...;          /* base: dark tinted toward the accent, or a warm or cool light neutral */
  --aj-bg-2: #...;        /* 1 step lighter/darker than bg, for the atmosphere gradient */
  --aj-surface: ...;      /* card fill */
  --aj-surface-border: ...;
  --aj-fg: #...;          /* ink */
  --aj-muted: #...;       /* ~55% contrast ink */
  --aj-accent: #...;      /* the ONE color */
  --aj-on-accent: #...;   /* text on accent */
  --aj-orb-1: ...; --aj-orb-2: ...; --aj-orb-3: ...;  /* accent-adjacent, 15–55% alpha */
  --aj-glow-strength: 0 | 1;   /* 1 on dark bases only */
  --aj-grain-opacity: 0–0.25;  /* light and warm bases */
}
```

Checks: the accent must pop against the base (a big luminance or saturation gap), keyword pills must
pass contrast, and orbs must never read as a second accent.
