#!/usr/bin/env node
// Maintainer tool: renders the license-free sample media in assets/demos/_placeholders/ so every demo
// renders complete frames on a fresh install. Each image is a neutral mock UI at the exact size the demos
// were designed around, tagged SAMPLE so it is never mistaken for real work. Re-run after changing a demo's
// media list; users never need to run it (the output is committed).
//
// Usage: node scripts/make-placeholders.mjs [--only name1,name2] [--dry-run]
// Needs Playwright + Chromium (see scripts/playwright.mjs) and FFmpeg with libwebp.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { launchOptions, loadPlaywright } from "./playwright.mjs";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(skillRoot, "assets/demos/_placeholders");

const ACCENTS = ["#6c5ce7", "#00b894", "#e17055", "#0984e3", "#fdcb6e", "#e84393", "#00cec9", "#a29bfe"];
const pick = (seed, list) => list[seed % list.length];
const tag = `<div style="position:absolute;right:18px;bottom:14px;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font:700 14px Inter,Arial,sans-serif;letter-spacing:.18em">SAMPLE</div>`;
const page = (body, { bg = "#f5f6fa", transparent = false } = {}) =>
  `<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:Inter,"Segoe UI",Arial,sans-serif;${transparent ? "background:transparent" : `background:${bg}`}}</style></head><body style="position:relative">${body}</body></html>`;
const bars = (n, seed, color) => Array.from({ length: n }, (_, i) => `<div style="flex:1;height:${30 + ((seed * 37 + i * 53) % 65)}%;background:${color};opacity:${0.35 + (i % 3) * 0.2};border-radius:6px 6px 0 0"></div>`).join("");
const lines = (n, width = 100) => Array.from({ length: n }, (_, i) => `<div style="height:14px;margin:10px 0;border-radius:7px;background:#dfe3ec;width:${width - (i * 13) % 40}%"></div>`).join("");

function dashboard(seed, title) {
  const accent = pick(seed, ACCENTS);
  const kpis = ["Revenue", "Leads", "Booked", "Win rate"].map((label, i) => `<div style="flex:1;background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 10px rgba(20,30,60,.06)"><div style="font-size:13px;color:#8a90a6;font-weight:600">${label}</div><div style="font-size:30px;font-weight:800;color:#1b1f33;margin-top:6px">${["$--.-k", "---", "--", "--%"][i]}</div></div>`).join("");
  return page(`<div style="position:absolute;inset:0;display:flex">
    <div style="width:13%;background:#1b1f33;padding:22px 16px">${Array.from({ length: 6 }, (_, i) => `<div style="height:12px;margin:18px 0;border-radius:6px;background:${i === 1 ? accent : "#3a3f5c"}"></div>`).join("")}</div>
    <div style="flex:1;padding:24px 28px;display:flex;flex-direction:column;gap:18px">
      <div style="font-size:22px;font-weight:800;color:#1b1f33">${title}</div>
      <div style="display:flex;gap:14px">${kpis}</div>
      <div style="flex:1;background:#fff;border-radius:14px;padding:18px;display:flex;align-items:flex-end;gap:10px;box-shadow:0 2px 10px rgba(20,30,60,.06)">${bars(18, seed, accent)}</div>
    </div></div>${tag}`);
}

function list(seed, title) {
  const accent = pick(seed, ACCENTS);
  const rows = Array.from({ length: 7 }, (_, i) => `<div style="display:flex;align-items:center;gap:16px;padding:12px 18px;border-bottom:1px solid #eceff5"><div style="width:14px;height:14px;border-radius:50%;background:${i % 3 === 2 ? "#fdcb6e" : accent}"></div><div style="flex:1;height:12px;border-radius:6px;background:#dfe3ec;max-width:${40 + ((i * 17) % 35)}%"></div><div style="width:90px;height:22px;border-radius:11px;background:${accent}22"></div></div>`).join("");
  return page(`<div style="position:absolute;inset:0;padding:20px 26px"><div style="font-size:20px;font-weight:800;color:#1b1f33;margin-bottom:12px">${title}</div><div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(20,30,60,.06)">${rows}</div></div>${tag}`);
}

function workflow(seed, width, height) {
  const accent = pick(seed, ACCENTS);
  const columns = Math.max(3, Math.round(width / 260));
  const nodes = [];
  const wires = [];
  for (let c = 0; c < columns; c += 1) {
    const branches = c === 0 || c === columns - 1 ? 1 : 1 + ((seed + c) % 2);
    for (let b = 0; b < branches; b += 1) {
      const x = 40 + c * ((width - 280) / (columns - 1));
      const y = height / 2 - 34 + (branches === 2 ? (b === 0 ? -height * 0.22 : height * 0.22) : 0);
      nodes.push({ x, y, c });
    }
  }
  for (const node of nodes) for (const next of nodes.filter((n) => n.c === node.c + 1)) {
    wires.push(`<path d="M${node.x + 200} ${node.y + 34} C ${node.x + 240} ${node.y + 34}, ${next.x - 40} ${next.y + 34}, ${next.x} ${next.y + 34}" stroke="#b7bdd0" stroke-width="3" fill="none"/>`);
  }
  const boxes = nodes.map((n, i) => `<div style="position:absolute;left:${n.x}px;top:${n.y}px;width:200px;height:68px;border-radius:14px;background:#fff;box-shadow:0 4px 16px rgba(20,30,60,.12);display:flex;align-items:center;gap:12px;padding:0 14px"><div style="width:38px;height:38px;border-radius:10px;background:${i === 0 ? accent : pick(seed + i, ACCENTS)}"></div><div style="flex:1"><div style="height:10px;border-radius:5px;background:#c9cedd;width:80%"></div><div style="height:8px;margin-top:8px;border-radius:4px;background:#e3e6ef;width:55%"></div></div></div>`).join("");
  return page(`<div style="position:absolute;inset:0;background-image:radial-gradient(#d5d9e6 1.5px,transparent 1.5px);background-size:22px 22px"></div><svg style="position:absolute;inset:0" width="${width}" height="${height}">${wires.join("")}</svg>${boxes}${tag}`, { bg: "#f0f2f7" });
}

function site(seed) {
  const accent = pick(seed, ACCENTS);
  const dark = seed % 2 === 0;
  const ink = dark ? "#f5f6fa" : "#1b1f33";
  const surface = dark ? "#1d2033" : "#ffffff";
  const bg = dark ? "#11131f" : "#f7f5f0";
  const card = `<div style="flex:1;background:${surface};border-radius:22px;padding:34px;min-height:300px;box-shadow:0 6px 24px rgba(0,0,0,.08)"><div style="width:64px;height:64px;border-radius:16px;background:${accent}"></div>${lines(4)}</div>`;
  const section = (heading, inner) => `<section style="padding:110px 120px"><div style="font-size:54px;font-weight:800;color:${ink};letter-spacing:-.02em;margin-bottom:40px">${heading}</div>${inner}</section>`;
  return page(`<nav style="display:flex;justify-content:space-between;align-items:center;padding:34px 120px"><div style="width:150px;height:30px;border-radius:8px;background:${accent}"></div><div style="display:flex;gap:30px">${"<div style='width:80px;height:12px;border-radius:6px;background:#9aa0b8'></div>".repeat(4)}</div></nav>
    <header style="padding:120px 120px 160px;display:flex;gap:80px;align-items:center"><div style="flex:1"><div style="font-size:96px;font-weight:900;line-height:1;color:${ink};letter-spacing:-.04em">Sample<br/>landing page</div><div style="margin-top:40px">${lines(3, 80)}</div><div style="margin-top:44px;display:inline-block;padding:24px 44px;border-radius:14px;background:${accent};color:#fff;font-size:24px;font-weight:800">Book a call</div></div><div style="flex:1;height:560px;border-radius:28px;background:linear-gradient(135deg,${accent},${pick(seed + 3, ACCENTS)})"></div></header>
    ${section("How it works", `<div style="display:flex;gap:28px">${card}${card}${card}</div>`)}
    ${section("Results", `<div style="display:flex;gap:28px">${["--%", "--x", "--k"].map((v) => `<div style="flex:1;background:${surface};border-radius:22px;padding:44px;font-size:80px;font-weight:900;color:${accent}">${v}</div>`).join("")}</div>`)}
    ${section("What clients say", `<div style="display:flex;gap:28px">${card}${card}</div>`)}
    ${section("Pricing", `<div style="display:flex;gap:28px">${card}${card}${card}</div>`)}
    <footer style="padding:90px 120px;background:${dark ? "#0b0c15" : "#1b1f33"}">${lines(3, 40)}</footer>${tag}`, { bg });
}

function appScreen(seed, kind) {
  const accent = pick(seed, ACCENTS);
  if (kind === "chat") {
    const bubbles = Array.from({ length: 5 }, (_, i) => `<div style="display:flex;gap:14px;margin:18px 0;${i % 2 ? "flex-direction:row-reverse" : ""}"><div style="width:44px;height:44px;border-radius:12px;background:${i % 2 ? "#9aa0b8" : accent}"></div><div style="width:${46 + (i % 3) * 8}%;background:#fff;border-radius:14px;padding:16px 20px;box-shadow:0 2px 10px rgba(20,30,60,.06)">${lines(2 + (i % 2), 100)}</div></div>`).join("");
    return page(`<div style="position:absolute;inset:0;display:flex"><div style="width:22%;background:#2b1f3a;padding:26px">${lines(8, 90)}</div><div style="flex:1;padding:26px 36px">${bubbles}</div></div>${tag}`);
  }
  return page(`<div style="position:absolute;inset:0;display:flex;flex-direction:column"><div style="height:9%;display:flex;align-items:center;justify-content:space-between;padding:0 5%;background:#fff"><div style="width:14%;height:34%;border-radius:8px;background:${accent}"></div><div style="width:12%;height:40%;border-radius:10px;background:#1b1f33"></div></div>
    <div style="flex:1;display:flex;align-items:center;gap:5%;padding:0 6%;background:linear-gradient(120deg,${accent}22,#fff)"><div style="flex:1"><div style="font-size:5.4vw;font-weight:900;line-height:1;color:#1b1f33;letter-spacing:-.04em">Sample<br/>product</div><div style="margin-top:4%">${lines(3, 85)}</div><div style="margin-top:5%;display:inline-block;padding:1.4vw 2.6vw;border-radius:12px;background:${accent};color:#fff;font-size:1.4vw;font-weight:800">Get started</div></div><div style="flex:1;height:70%;border-radius:22px;background:linear-gradient(135deg,${accent},${pick(seed + 2, ACCENTS)});box-shadow:0 20px 50px rgba(0,0,0,.15)"></div></div></div>${tag}`);
}

function thumb(seed, title) {
  const accent = pick(seed, ACCENTS);
  return page(`<div style="position:absolute;inset:0;background:linear-gradient(135deg,#141627,${accent}66);display:flex;align-items:center;gap:5%;padding:0 6%"><div style="flex:1;color:#fff"><div style="font-size:3.6vw;font-weight:900;line-height:1.05;letter-spacing:-.03em">${title}</div><div style="margin-top:5%;width:40%;height:1.2vw;border-radius:1vw;background:${accent}"></div></div><div style="flex:1.2;aspect-ratio:16/10;border-radius:18px;background:#fff;box-shadow:0 24px 60px rgba(0,0,0,.35);padding:3%;display:flex;flex-direction:column;gap:6%"><div style="height:10%;width:45%;border-radius:8px;background:#1b1f33"></div><div style="flex:1;display:flex;align-items:flex-end;gap:4%">${bars(9, seed, accent)}</div></div></div>${tag}`);
}

const texture = () => page(`<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c3b5e"/><stop offset=".55" stop-color="#1c7c8c"/><stop offset="1" stop-color="#9fd9d6"/></linearGradient><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".012 .05" numOctaves="4" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .35 0"/></filter></defs><rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
const logoMark = () => page(`<svg width="100%" height="100%" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M256 40 L456 156 L456 356 L256 472 L56 356 L56 156 Z M256 150 L160 206 L160 306 L256 362 L352 306 L352 206 Z" fill="#000" fill-rule="evenodd"/><circle cx="256" cy="256" r="46" fill="#000"/></svg>`, { transparent: true });
const portrait = () => page(`<svg width="100%" height="100%" viewBox="0 0 1089 1329" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f86b8"/><stop offset="1" stop-color="#3b3458"/></linearGradient></defs><circle cx="545" cy="420" r="230" fill="url(#p)"/><path d="M110 1329 C 130 930, 330 760, 545 760 C 760 760, 960 930, 980 1329 Z" fill="url(#p)"/><text x="545" y="1200" text-anchor="middle" font-family="Arial" font-weight="700" font-size="44" letter-spacing="10" fill="rgba(255,255,255,.7)">SAMPLE</text></svg>`, { transparent: true });
const badge = () => page(`<svg width="100%" height="100%" viewBox="0 0 800 779" xmlns="http://www.w3.org/2000/svg"><g transform="translate(400 380)">${Array.from({ length: 24 }, (_, i) => `<rect x="-26" y="-350" width="52" height="90" rx="10" fill="#f0b429" transform="rotate(${i * 15})"/>`).join("")}<circle r="290" fill="#f0b429"/><circle r="250" fill="#1b1f33"/><circle r="232" fill="none" stroke="#f0b429" stroke-width="6"/><text y="-30" text-anchor="middle" font-family="Arial" font-weight="900" font-size="74" fill="#fff">CERTIFIED</text><text y="50" text-anchor="middle" font-family="Arial" font-weight="700" font-size="48" fill="#f0b429">SAMPLE</text></g></svg>`, { transparent: true });
const toolSvg = (label, color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="4" y="4" width="120" height="120" rx="28" fill="${color}"/><text x="64" y="${label.length > 3 ? 76 : 82}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${label.length > 3 ? 30 : 48}" fill="#fff">${label}</text></svg>\n`;

/** name → [width, height, html, transparent?]. Sizes match the media the demos were designed around. */
function catalog() {
  return {
    "revenue-dashboard.webp": [1100, 492, dashboard(1, "Revenue")],
    "sales-dashboard.webp": [1100, 574, dashboard(2, "Sales pipeline")],
    "funnel-analytics.webp": [1100, 462, dashboard(3, "Funnel analytics")],
    "workflow-library.webp": [1100, 558, list(4, "Workflows")],
    "trigger-tasks.webp": [1100, 242, list(5, "Task runs")],
    "course-access.webp": [811, 746, workflow(1, 811, 746)],
    "post-purchase-router.webp": [1100, 412, workflow(2, 1100, 412)],
    "zapier-paths.webp": [1100, 282, workflow(3, 1100, 282)],
    "n8n-ugc-approval.webp": [1472, 520, workflow(4, 1472, 520)],
    "funnel-1.webp": [1440, 3600, site(0)], "funnel-2.webp": [1440, 3600, site(1)], "funnel-3.webp": [1440, 3600, site(2)],
    "website-1.webp": [1440, 3600, site(3)], "website-2.webp": [1440, 3600, site(4)], "website-3.webp": [1440, 3600, site(5)],
    "sb-ai-lead-qualifier.webp": [1456, 971, thumb(1, "AI lead<br/>qualifier")],
    "sb-deal-won.webp": [1456, 971, thumb(2, "Deal won<br/>automation")],
    "sb-smart-lead-router.webp": [1456, 971, thumb(3, "Smart lead<br/>router")],
    "rag-knowledge-bot.webp": [1200, 675, thumb(4, "Knowledge<br/>bot")],
    "ghl-full-system-build.webp": [1400, 788, thumb(5, "Full system<br/>build")],
    "coach-gym-funnel.webp": [1920, 1200, appScreen(1, "site")],
    "casa-lume-hotel.webp": [1920, 1200, appScreen(2, "site")],
    "ai-learning-hub.webp": [1200, 800, appScreen(3, "site")],
    "funnel-builder.webp": [1200, 800, appScreen(4, "site")],
    "slack-agent.webp": [1200, 800, appScreen(5, "chat")],
    "ocean-texture.webp": [430, 940, texture()],
    "logo-mark.webp": [512, 512, logoMark(), true],
    "portrait-cutout.webp": [1089, 1329, portrait(), true],
    "credential-badge.webp": [800, 779, badge(), true],
  };
}

const TOOLS = { "n8n.svg": ["n8n", "#ea4b71"], "zapier.svg": ["Zap", "#ff4f00"], "claude.svg": ["AI", "#d97757"], "openai.svg": ["LLM", "#10a37f"], "trigger.svg": ["Jobs", "#6d28d9"] };

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const onlyFlag = args.indexOf("--only");
  const only = onlyFlag >= 0 ? new Set(args[onlyFlag + 1].split(",")) : null;
  const items = Object.entries(catalog()).filter(([name]) => !only || only.has(name));
  if (dryRun) {
    for (const [name, [w, h]] of items) console.log(`would render ${name} ${w}x${h}`);
    return;
  }
  await mkdir(outDir, { recursive: true });
  for (const [name, [label, color]] of Object.entries(TOOLS)) if (!only || only.has(name)) await writeFile(join(outDir, name), toolSvg(label, color));

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(launchOptions({ headless: true }));
  const scratch = join(tmpdir(), `md-placeholders-${process.pid}.png`);
  try {
    const tab = await browser.newPage();
    // The one PNG in the demos (a tool logo) is rendered from its SVG tile.
    if (!only || only.has("gohighlevel.png")) {
      await tab.setViewportSize({ width: 128, height: 128 });
      await tab.setContent(page(toolSvg("CRM", "#1d4ed8"), { transparent: true }));
      await tab.screenshot({ path: join(outDir, "gohighlevel.png"), omitBackground: true });
    }
    for (const [name, [width, height, html, transparent]] of items) {
      await tab.setViewportSize({ width, height });
      await tab.setContent(html);
      await tab.screenshot({ path: scratch, omitBackground: Boolean(transparent), fullPage: false });
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", scratch, "-c:v", "libwebp", "-quality", "78", ...(transparent ? ["-pix_fmt", "yuva420p"] : []), join(outDir, name)]);
      console.log(`rendered ${name} ${width}x${height}`);
    }
  } finally {
    await browser.close();
    await rm(scratch, { force: true });
  }
}

main().catch((error) => {
  console.error(`make-placeholders failed: ${error.message}`);
  process.exit(1);
});
