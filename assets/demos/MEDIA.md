# Demo media

The demos reference images under `assets/media/`. Those files are **not in this repository**: the
originals are AJ's client builds, dashboards with real revenue figures, and his portrait. To run a
demo, supply your own images with the same file names (any content works; the listed intent is what
makes the demo read well). `scaffold.mjs --demo <name>` prints exactly which names are missing.

Tool logos (`gohighlevel.png`, `n8n.svg`, `zapier.svg`, `claude.svg`, `openai.svg`, `trigger.svg`)
are the respective companies' marks. Download them from each brand's press kit.

## By file

| File | What it should show | Shape | Used by |
|---|---|---|---|
| `aj-mark-dark.webp` | Your logo mark, single color on transparent (used as a CSS mask, so only its alpha matters) | square | all |
| `aj-hero-cutout.webp` | Your portrait, background removed (transparent PNG/WebP) | ~4:5 portrait | portfolio-reveal |
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
| `certified-admin-badge.webp` | A certification badge (transparent) | square | agency-split |
