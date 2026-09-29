# Intake: from whatever the user gives you to a real asset list

Users rarely hand over a clean brief. They paste a URL, drop four screenshots, share a Figma link, attach a
pitch deck, or type one sentence. Route each input below, then write the **asset inventory** before you pick a
layout. The inventory is what keeps the film honest: every frame is either a real asset, something rebuilt in
HTML and labeled as concept, or a placeholder the user still owes you.

## Contents
1. Route by input
2. Screenshots in depth
3. No assets at all
4. The asset inventory
5. Honesty and permission rules

## 1. Route by input

| Input | Do this | Hand-off |
|---|---|---|
| **Live URL** | `scripts/capture-site.mjs <out> name=https://…`; open hidden galleries/tabs with a short Playwright script; read colors and fonts from the page. Only capture sites the user owns or has permission to show. | A site case study follows [website-case-study.md](website-case-study.md) |
| **Local app** (localhost / staging) | Same capture script against the local URL. Best for unreleased products: every state is real and nothing is public yet. Ask for a seeded demo account rather than real customer data. | Launch Hype or AI Canvas |
| **Screenshots** (1 to many) | `node scripts/prep-media.mjs <files or folder> --out <project>/assets/media`, then read each image yourself. See section 2. | Any layout; the report says how big each can go |
| **Figma link** | With a Figma connector, export the frames at 2×. Without one, ask for PNG exports at 2× (File → Export). Then treat them as screenshots. If it isn't built yet, the film says "Concept". | Brand System or Launch Hype |
| **PDF / pitch deck / slides** | Use the `pdf` skill (or ask for PNG exports of the slides) to get page images and text. Take the copy from the text, and the visuals from the pages. Rebuild charts in HTML so they can animate. | Narrated Journey or AI Canvas |
| **Screen recording / footage** | `ffmpeg -i in.mp4 -vf "fps=2,scale=480:-1,tile=4x4" sheet_%02d.png`, read the sheets, pick the hero moments, then trim with `ffmpeg -ss <t> -to <t> -c:v libx264 -crf 18 -an clip.mp4`. Real motion beats a still. | Any; clips replace the matching demo image |
| **Logo / brand guide only** | Run `prep-media.mjs` on the logo for its accent and to check it has a transparent background; derive the flavor with [flavors.md](flavors.md). | Brand System |
| **GitHub repo or PR** | For a PR, hand off to `/pr-to-video` if it is installed. For a repo, read the README for copy and run the app locally, then capture it. | Launch Hype |
| **Text brief only** | See section 3. | Narrated Journey, Brand System |
| **A mix** | Handle each piece, then merge them in one inventory; say which input supplies which scene. | |

Asked for a vertical reel (Reels, Shorts, TikTok)? `scaffold.mjs --list` shows which layouts have a ready-made
9:16 version (`--aspect 9:16`). For the others, scaffold at 16:9 and re-layout per
[story-structures.md](story-structures.md) ("Aspect ratios"): stack the splits, keep the timings.

## 2. Screenshots in depth

- **Read every image**, not just the report: note the product name, headline copy, visible numbers, colors,
  and which UI states are shown. On-screen copy should come from the screenshot, not from you.
- **Size decides placement.** `media-report.json` grades each file per aspect: `full-frame` can fill the
  frame, `card` goes in a tilted card or browser frame at up to about 60% of the width, `small` is a chip,
  thumbnail or mosaic tile. Never upscale a `small` image to full frame; ask for a bigger export instead.
- **Shape decides the move.** `tall-page` → scroll-pan inside a browser frame; `screen` → `tiltFloat` card or
  camera push; `wide-strip` → a horizontal pan along a workflow canvas; `square`/`portrait` → chips, badges,
  phone mockups.
- **Only animate states you were shown.** If the story needs "after the form is submitted" and nobody gave you
  that screenshot, list it under Missing and ask. Do not paint a success state that may not exist.
- **Crop out private data** (emails, names, phone numbers, revenue the user didn't approve) before building,
  with an FFmpeg crop or a CSS mask. Say what you removed.
- **Brand from screenshots:** `tokens.accent` in the report is a suggestion from the pixels. Confirm it
  against the logo before building a flavor on it.

## 3. No assets at all

A text brief can still make a strong film, because type is the lead actor (law 1):

- Prefer layouts carried by type: **Narrated Journey** (voice + words) or **Brand System** (tiles, type,
  color). Launch Hype also works if the UI is rebuilt in HTML.
- **Rebuild UI as HTML**, not as fake screenshots: simple cards, a pipeline, a chat bubble. Label the film
  "Concept" if the product doesn't exist yet.
- **Every number is a placeholder** (`--%`, `$--k`) until the user supplies it. List each one under Numbers.
- Ask for exactly one thing that would lift the film most: usually a logo, or one real screenshot.

## 4. The asset inventory

Show this to the user before choosing a layout, and keep it in `frame.md`:

```
Asset inventory
Have:          dashboard.webp · screen · 16:9 card, 9:16 full-frame
               logo.webp · square · transparent
Missing:       the booking confirmation state (story beat 4), a customer quote
Build in HTML: the lead pipeline diagram (concept, no real data)
Numbers:       "3× more bookings" (user, 2026-09-28 message); everything else is a placeholder
```

If **Missing** blocks the story, ask before building. If it doesn't, build with placeholders and repeat the
list when you hand over the draft.

## 5. Honesty and permission rules

- Never invent stats, client names, testimonials or logos. A figure appears only if the user gave it or it
  is visible in their asset, and the inventory says which.
- Capture and show only sites and apps the user owns or has permission to use. Never submit a form on a
  live site (see the network guard in [website-case-study.md](website-case-study.md)).
- A fictional or unbuilt product is tagged "Concept" in the film.
- SAMPLE placeholders from `scaffold.mjs` never ship: the final render has none.
