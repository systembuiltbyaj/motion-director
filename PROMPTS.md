# Prompts

Copy these into Claude Code. You don't need to name the skill: asking for a motion video loads it. Replace
everything in `[brackets]`.

## 1. First time only: set up

```
Set up motion-director for me. Run its doctor and fix what's missing, then create my brand.json.
My brand: [business name]. Me: [first and last name], [one-line role].
Tagline: [one line about what you do]. Credentials: [up to two, e.g. "Certified HubSpot Partner"].
Website: [yourdomain.com]. Handle: [@yourhandle]. Brand color: [#hex, or "take it from my logo"].
Logo: [path to a transparent PNG]. Portrait: [path to a photo with the background removed, optional].
```

## 2. The starter prompt (any video)

The more of these lines you fill in, the fewer questions Claude asks.

```
Make a [15 / 30 / 60]-second [16:9 / 9:16] motion video about [what it's about].
Audience: [who watches it]. Goal: [what they should do after watching].
Assets: [a URL / the attached screenshots / a folder path / none yet].
Brand: [mine / my client's: name, color, logo path]. Voiceover: [yes / no].
Only use numbers I give you. Don't invent stats, clients or testimonials.
```

**The detailed version**, for when you know exactly what you want. Sections you leave out are Claude's call.

```
<inputs>      What I'm giving you: [files, URL, brand color, a song and its BPM]. Ask me for anything missing.
<direction>   The feel: [e.g. "Dribbble-level UI motion, one clean font, springs with a tiny overshoot at most"].
              Layout: [a layout name, or "you pick and tell me why"].
<structure>   The beats, in order: [hook → problem → product → proof → call to action], [length], [BPM].
<banned>      Never: [e.g. bouncy easing, glows, stock footage, a second accent color, dead beats].
<verify>      Before the final render: show me one frame per beat, confirm it works muted,
              and [for loops] that the last frame matches the first.
```

## 3. By what you have

**A website URL**
```
Make a 45-second 16:9 case-study video of https://[yoursite.com]. Show the real pages and how it works.
It's a site I built for [client]. End on my brand card.
```

**Screenshots**
```
Make a 30-second 9:16 promo from these screenshots [attach them, or give the folder path].
It's my [coaching funnel / SaaS dashboard / booking app]. The main point: [one sentence].
```

**An app running on your computer**
```
My app runs on localhost:3000. Make a 20-second launch video showing the dashboard and the signup flow.
Use the demo account [email] / [password]. Don't show any real customer data.
```

**A Figma design**
```
Here's my Figma design: [link]. Make a 20-second concept launch video from it. It isn't built yet,
so tag it "Concept".
```

**A PDF or pitch deck**
```
Turn this deck [path to PDF] into a 60-second explainer with voiceover. Keep my numbers exactly as written.
```

**A screen recording**
```
Here's a screen recording of my automation running [path to .mp4]. Cut the best moments into a 30-second
9:16 reel with captions-style type and sound effects.
```

**Nothing but an idea**
```
No assets yet. Make a 20-second brand reel for [business name], a [what you do] for [who you serve].
Brand color [#hex]. Use placeholders for any numbers and list what you need from me.
```

**A client video (not your own brand)**
```
This one is for my client [client name], not my brand. Their color is [#hex], logo at [path],
website [clientsite.com]. Make a 30-second 16:9 promo for their [offer].
```

## 4. Picking a look

Say the layout by name if you already know which one you want:

| Say | You get |
|---|---|
| "in the **Launch Hype** layout" | Neon product launch: stat splits, coin flips, button stacks, a 3D dashboard |
| "in the **Agency Split** layout" | Fast promo: split panels, typed copy, image splits, a logo wall |
| "in the **Narrated Journey** layout" | Voice-led story; words land as they're spoken |
| "in the **AI Canvas** layout" | AI product demo: a prompt types, an agent plans, a node canvas |
| "in the **Brand System** layout" | Brand-guideline film: tiles slam on the beat, type and color |
| "in the **Portfolio Reveal** layout" | Personal brand reel: the work, the system behind it, then you |
| "in the **UI Morph Loop** layout" | One UI element morphing through states, cursor-driven, square, loops seamlessly |
| "in the **Stage Film** layout" | Calm premium product film on a rounded stage, one idea per second |
| "add the **HUD frame**" | Timecode, BPM and chapter counter over any layout: a craft or capability reel |

Launch Hype and Agency Split have ready-made 9:16 versions and UI Morph Loop is square; the others get
re-laid-out for vertical.

## 5. After the first draft

```
Make it faster: cut it to [15] seconds and keep the best beats.
Swap the color to [#hex] and use a light background.
Make a 9:16 version of this for Reels.
Replace the SAMPLE images with these [files].
The voice line at [0:08] is too fast. Slow it down and re-sync the words.
Show me frames at every beat before the final render.
```

**Changing the voice** (Kokoro is the free default; the others need a key or server in `.env`, see `.env.example`):

```
Re-voice it with ElevenLabs, voice ID [id]. Show me the character count before you spend credits.
Use my cloned voice from my local voice server: model [omnivoice], voice [profile id].
Audition three Kokoro voices on the first two lines and tell me which one fits.
```

## Tips

- **Give real assets.** A real screenshot beats anything Claude can mock up.
- **Numbers only come from you.** Claude leaves placeholders (`--%`) until you give a figure.
- **SAMPLE images** are there so the demo renders. The final video shouldn't have any. Ask Claude to list the
  ones that are left.
- **Client work:** say it's for a client. Claude then keeps a separate `brand.json` in that project folder, so
  your own brand never shows up in their video.
