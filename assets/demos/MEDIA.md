# Demo media

The demos reference images under `assets/media/`. `scaffold.mjs --demo <name>` fills each one from the first
place it finds it:

1. the project's own `assets/media/` (anything you already put there),
2. your `brand.json` `logo` / `portrait` (for `logo-mark.webp` and `portrait-cutout.webp`),
3. `assets/demos/_media/` in the skill folder: your own portfolio images, **never committed** (it's in
   `.gitignore`), so you can keep real work there for every demo,
4. `assets/demos/_placeholders/`: neutral mock UIs tagged **SAMPLE**, committed so every demo renders complete
   frames on a fresh install.

The scaffold output lists every SAMPLE file it used. Replace them before you publish anything: the table below
says what each should show. `--sample-media` skips step 3, to preview exactly what a fresh install renders.

Tool logos (`gohighlevel.png`, `n8n.svg`, `zapier.svg`, `claude.svg`, `openai.svg`, `trigger.svg`) ship as
neutral labeled tiles. To show the real marks, download them from each company's press kit under the same
names.

Maintainers: `node scripts/make-placeholders.mjs` regenerates the SAMPLE set (Playwright + FFmpeg).

## By file

| File | What it should show | Shape | Used by |
|---|---|---|---|
| `logo-mark.webp` | Your logo mark, single color on transparent (used as a CSS mask, so only its alpha matters) | square | all |
| `portrait-cutout.webp` | Your portrait, background removed (transparent PNG/WebP) | ~4:5 portrait | portfolio-reveal |
| `funnel-1.webp`, `funnel-2.webp`, `funnel-3.webp` | Full-page captures of three funnels you built (`scripts/capture-site.mjs`) | 1440 × up to 3600 | portfolio-reveal |
| `website-1.webp`, `website-2.webp`, `website-3.webp` | Full-page captures of three websites in different styles | 1440 × up to 3600 | portfolio-reveal |
| `course-access.webp`, `post-purchase-router.webp`, `zapier-paths.webp` | Real automation workflow canvases (GHL, Zapier, Make…) | any, wide works best | portfolio-reveal |
| `n8n-ugc-approval.webp` | A real n8n workflow canvas | wide (~3:1) | portfolio-reveal |
| `trigger-tasks.webp` | A task/job runner screen (Trigger.dev or similar) | wide | portfolio-reveal |
| `revenue-dashboard.webp`, `sales-dashboard.webp` | Real CRM or reporting dashboards | ~2:1 | portfolio-reveal, launch-hype, ai-canvas, narrated-journey, agency-split |
| `funnel-analytics.webp`, `workflow-library.webp` | Funnel stats; a list of workflows | ~2:1 | ai-canvas |
| `sb-ai-lead-qualifier.webp`, `sb-smart-lead-router.webp`, `sb-deal-won.webp`, `rag-knowledge-bot.webp` | Thumbnails of automation builds | ~16:10 | ai-canvas, agency-split |
| `ghl-full-system-build.webp` | A build/case-study thumbnail with a screen in it | 16:9 | brand-system, agency-split |
| `ocean-texture.webp` | A text-free photographic texture (fills giant type and backgrounds) | portrait crop | brand-system |
| `coach-gym-funnel.webp`, `casa-lume-hotel.webp`, `ai-learning-hub.webp`, `funnel-builder.webp`, `slack-agent.webp` | Website/app screenshots for the work mosaic | 16:10 | agency-split |
| `credential-badge.webp` | A certification badge (transparent) | square | agency-split |

The 9:16 demos use the same files.
