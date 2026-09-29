# Changelog

## Unreleased

### Added
- **Voice providers.** `voice.mjs` takes `"provider"` in `vo.json`: `kokoro` (default, unchanged), `elevenlabs`
  (stock or cloned voices) or `openai-compatible` (any `POST /audio/speech` server: VoiceStudio, a Chatterbox or
  VoxCPM2 wrapper, OpenAI). Keys come from the environment or `.env` (`.env.example`), never from `vo.json`.
- Every generated line is level-matched to one voiced loudness (−20.5 dBFS, measured from Kokoro), so
  switching provider doesn't change the mix. `"normalize": false` or `"targetDb"` to change it.
- `voice.mjs --list-voices`, `--dry-run` reports characters that would be sent to a paid provider, and
  `doctor.mjs` shows which providers are configured.
- Consent, licence, cost and hardware checks for cloned voices in `references/sound-design.md` §5.

### Changed
- Each voice line's cache is now `<id>.json` (the full request) instead of `<id>.txt` (text only), so a
  change of provider, voice or settings re-voices the line. Old `.txt` files are removed on the next run;
  Kokoro lines regenerate once, for free.

## 1.0.0 — unreleased

First community release.

### Renamed (breaking)
- The skill is now **motion-director** (was `aj-motion-style`) and carries no personal branding; the
  author is credited in the README and LICENSE.
- Runtime: `assets/aj-motion.js` / `.css` → `assets/motion-director.js` / `.css`, global `AJMotion` →
  `MotionDirector` (demos alias it as `MD`), CSS `--aj-*` / `.aj-*` / `data-aj-flavor` → `--md-*` /
  `.md-*` / `data-md-flavor`. Compositions built on the old names keep working from their own copy of the
  runtime; copy the new files in to upgrade.
- Portfolio Reveal's `reveal` flavor uses neutral defaults (system `#1F5BFF`, impact `#FF5A1F`) via the
  `--md-system` and `--md-accent` tokens.

### Added
- **Brand setup:** `brand.example.json` → `brand.json` (git-ignored). Demos carry `{{brand.*}}` tokens that
  `scaffold.mjs` fills in, so nobody's first render shows someone else's name. A client video gets its own
  `brand.json` in the project folder.
- **SAMPLE media:** neutral, license-free mock UIs in `assets/demos/_placeholders/`, so every demo renders
  complete frames on a fresh install. Scaffold lists each one to replace; `--sample-media` previews exactly
  what a fresh install renders.
- **Vertical video:** ready-made 9:16 versions of Launch Hype and Agency Split (`scaffold.mjs --aspect 9:16`).
- **Any input, not just URLs:** `references/intake.md` routes URLs, local apps, screenshots, Figma, PDFs,
  screen recordings, logo-only and brief-only requests, and requires an asset inventory before building.
- `scripts/doctor.mjs`: setup check with platform-specific fixes.
- `scripts/prep-media.mjs`: converts any images to WebP and reports shape, on-screen size and palette.
- `PROMPTS.md`: copy-paste prompts for every kind of input.

### Changed
- Skill description rewritten as trigger conditions, and under the 1,024-character limit (it was 1,355).
- Instructions address "the user" instead of the author.
- `voice.mjs` re-voices a line when its text changes, instead of reusing stale audio.
- `scaffold.mjs` no longer copies generated voice audio from the demo folders.
- Demo media renamed: `aj-mark-dark` → `logo-mark`, `aj-hero-cutout` → `portrait-cutout`,
  `certified-admin-badge` → `credential-badge`. The Portfolio Reveal flavor `aj-brand` is now `reveal`.

## 0.1.0

Initial release: six layouts, four flavors, runtime helpers, sound engine, Kokoro voice, site capture.
