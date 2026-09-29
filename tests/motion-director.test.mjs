import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// motion-director.js is a classic script (browser <script src>) with a CommonJS export guard.
const require = createRequire(import.meta.url);
const MD = require("../assets/motion-director.js");

test("planWords flags a single keyword ignoring case and punctuation", () => {
  const plan = MD.planWords("Every business runs on Systems.", { keyword: "systems" });
  assert.deepEqual(plan.map((w) => w.isKeyword), [false, false, false, false, true]);
  assert.equal(plan[4].word, "Systems.");
});

test("planWords flags a multi-word keyword phrase and delays it onto its own micro-beat", () => {
  const plan = MD.planWords("It's how it works today", { keyword: "how it works", stagger: 0.1, keywordDelay: 0.2 });
  assert.deepEqual(plan.map((w) => w.isKeyword), [false, true, true, true, false]);
  assert.equal(plan[0].at, 0);
  assert.equal(plan[1].at, 0.3);
  assert.equal(plan[4].at, 0.6);
});

test("planWords with no keyword is a plain stagger from start", () => {
  const plan = MD.planWords("one two three", { start: 1, stagger: 0.05 });
  assert.deepEqual(plan.map((w) => w.at), [1, 1.05, 1.1]);
  assert.ok(plan.every((w) => !w.isKeyword));
});

test("planWords uses measured voice times when given, and rejects a count mismatch", () => {
  const plan = MD.planWords("Ready to grow?", { keyword: "grow", times: [0, 0.32, 0.54], start: 18.6 });
  assert.deepEqual(plan.map((w) => w.at), [18.6, 18.92, 19.14]);
  assert.ok(plan[2].isKeyword);
  assert.throws(() => MD.planWords("two words", { times: [0] }), RangeError);
});

test("planWords rejects a non-finite stagger", () => {
  assert.throws(() => MD.planWords("a b", { stagger: Number.NaN }), /stagger/);
});

test("planType is deterministic and strictly increasing", () => {
  const a = MD.planType("hello world", { cps: 20, start: 2 });
  const b = MD.planType("hello world", { cps: 20, start: 2 });
  assert.deepEqual(a, b);
  assert.equal(a.chars.length, 11);
  assert.equal(a.chars[0].at, 2);
  for (let i = 1; i < a.chars.length; i += 1) assert.ok(a.chars[i].at > a.chars[i - 1].at);
  assert.ok(a.end > a.chars.at(-1).at);
});

test("planType without jitter types at exactly cps", () => {
  const { chars, end } = MD.planType("abcd", { cps: 10, jitter: 0 });
  assert.deepEqual(chars.map((c) => c.at), [0, 0.1, 0.2, 0.3]);
  assert.equal(end, 0.4);
});

test("planType rejects a zero cps", () => {
  assert.throws(() => MD.planType("x", { cps: 0 }), RangeError);
});

test("readHold scales with word count and clamps", () => {
  assert.equal(MD.readHold(1), 0.9);
  assert.equal(MD.readHold(4), 1.2);
  assert.equal(MD.readHold(6), 1.6);
  assert.equal(MD.readHold(40), 3.5);
});

test("snapToBeat lands on the nearest beat and respects phase and subdivision", () => {
  assert.equal(MD.snapToBeat(1.0, { bpm: 120 }), 1.0);
  assert.equal(MD.snapToBeat(1.2, { bpm: 120 }), 1.0);
  assert.equal(MD.snapToBeat(1.3, { bpm: 120 }), 1.5);
  assert.equal(MD.snapToBeat(1.3, { bpm: 120, subdivision: 2 }), 1.25);
  assert.equal(MD.snapToBeat(0.6, { bpm: 120, phase: 0.1 }), 0.6);
});

test("beatGrid produces evenly spaced beats", () => {
  assert.deepEqual(MD.beatGrid({ bpm: 120, count: 4 }), [0, 0.5, 1, 1.5]);
  assert.throws(() => MD.beatGrid({ bpm: 0 }), RangeError);
});

test("repeatCount floors and never goes negative (negative repeat = infinite in GSAP)", () => {
  assert.equal(MD.repeatCount(10, 3), 2);
  assert.equal(MD.repeatCount(1, 3), 0);
  assert.equal(MD.repeatCount(5, 0), 0);
});

test("seededRandom is reproducible, in [0,1), and seed-sensitive", () => {
  const a = MD.seededRandom(42);
  const b = MD.seededRandom(42);
  const c = MD.seededRandom(43);
  const seqA = Array.from({ length: 5 }, a);
  assert.deepEqual(seqA, Array.from({ length: 5 }, b));
  assert.notDeepEqual(seqA, Array.from({ length: 5 }, c));
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
});

test("planEcho is symmetric with opacity falling off per rank", () => {
  const ghosts = MD.planEcho(2, { gap: 1, falloff: 0.5 });
  assert.deepEqual(ghosts, [
    { yPercent: -100, opacity: 0.5, rank: 1 },
    { yPercent: 100, opacity: 0.5, rank: 1 },
    { yPercent: -200, opacity: 0.25, rank: 2 },
    { yPercent: 200, opacity: 0.25, rank: 2 },
  ]);
});

test("normalizeWord strips punctuation but keeps letters and digits", () => {
  assert.equal(MD.normalizeWord("24/7!"), "247");
  assert.equal(MD.normalizeWord("Cafés,"), "cafés");
});

test("formatTimecode renders HH:MM:SS:FF and never rounds up into the next second", () => {
  assert.equal(MD.formatTimecode(0), "00:00:00:00");
  assert.equal(MD.formatTimecode(12.5, 30), "00:00:12:15");
  assert.equal(MD.formatTimecode(3725.999, 30), "01:02:05:29");
  assert.equal(MD.formatTimecode(1, 24), "00:00:01:00");
  assert.throws(() => MD.formatTimecode(-1), /seconds/);
});

test("planSpin lands on the chosen item after whole laps", () => {
  assert.deepEqual(MD.planSpin(10, 3, { laps: 3 }), { total: 34, landIndex: 33 });
  assert.deepEqual(MD.planSpin(5, 0, { laps: 1 }), { total: 6, landIndex: 5 });
  assert.throws(() => MD.planSpin(5, 5), /land/);
  assert.throws(() => MD.planSpin(0, 0), /count/);
});

test("planEaseCurve samples an ease into an SVG path inside the box, y flipped", () => {
  const linear = MD.planEaseCurve((t) => t, { width: 100, height: 50, samples: 4 });
  assert.equal(linear, "M0,50 L25,37.5 L50,25 L75,12.5 L100,0");
  const overshoot = MD.planEaseCurve((t) => (t === 1 ? 1 : t * 1.2), { width: 100, height: 50, samples: 2 });
  assert.equal(overshoot, "M0,50 L50,20 L100,0");
});
