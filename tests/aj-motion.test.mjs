import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// aj-motion.js is a classic script (browser <script src>) with a CommonJS export guard.
const require = createRequire(import.meta.url);
const AJ = require("../assets/aj-motion.js");

test("planWords flags a single keyword ignoring case and punctuation", () => {
  const plan = AJ.planWords("Every business runs on Systems.", { keyword: "systems" });
  assert.deepEqual(plan.map((w) => w.isKeyword), [false, false, false, false, true]);
  assert.equal(plan[4].word, "Systems.");
});

test("planWords flags a multi-word keyword phrase and delays it onto its own micro-beat", () => {
  const plan = AJ.planWords("It's how it works today", { keyword: "how it works", stagger: 0.1, keywordDelay: 0.2 });
  assert.deepEqual(plan.map((w) => w.isKeyword), [false, true, true, true, false]);
  assert.equal(plan[0].at, 0);
  assert.equal(plan[1].at, 0.3);
  assert.equal(plan[4].at, 0.6);
});

test("planWords with no keyword is a plain stagger from start", () => {
  const plan = AJ.planWords("one two three", { start: 1, stagger: 0.05 });
  assert.deepEqual(plan.map((w) => w.at), [1, 1.05, 1.1]);
  assert.ok(plan.every((w) => !w.isKeyword));
});

test("planWords uses measured voice times when given, and rejects a count mismatch", () => {
  const plan = AJ.planWords("Ready to grow?", { keyword: "grow", times: [0, 0.32, 0.54], start: 18.6 });
  assert.deepEqual(plan.map((w) => w.at), [18.6, 18.92, 19.14]);
  assert.ok(plan[2].isKeyword);
  assert.throws(() => AJ.planWords("two words", { times: [0] }), RangeError);
});

test("planWords rejects a non-finite stagger", () => {
  assert.throws(() => AJ.planWords("a b", { stagger: Number.NaN }), /stagger/);
});

test("planType is deterministic and strictly increasing", () => {
  const a = AJ.planType("hello world", { cps: 20, start: 2 });
  const b = AJ.planType("hello world", { cps: 20, start: 2 });
  assert.deepEqual(a, b);
  assert.equal(a.chars.length, 11);
  assert.equal(a.chars[0].at, 2);
  for (let i = 1; i < a.chars.length; i += 1) assert.ok(a.chars[i].at > a.chars[i - 1].at);
  assert.ok(a.end > a.chars.at(-1).at);
});

test("planType without jitter types at exactly cps", () => {
  const { chars, end } = AJ.planType("abcd", { cps: 10, jitter: 0 });
  assert.deepEqual(chars.map((c) => c.at), [0, 0.1, 0.2, 0.3]);
  assert.equal(end, 0.4);
});

test("planType rejects a zero cps", () => {
  assert.throws(() => AJ.planType("x", { cps: 0 }), RangeError);
});

test("readHold scales with word count and clamps", () => {
  assert.equal(AJ.readHold(1), 0.9);
  assert.equal(AJ.readHold(4), 1.2);
  assert.equal(AJ.readHold(6), 1.6);
  assert.equal(AJ.readHold(40), 3.5);
});

test("snapToBeat lands on the nearest beat and respects phase and subdivision", () => {
  assert.equal(AJ.snapToBeat(1.0, { bpm: 120 }), 1.0);
  assert.equal(AJ.snapToBeat(1.2, { bpm: 120 }), 1.0);
  assert.equal(AJ.snapToBeat(1.3, { bpm: 120 }), 1.5);
  assert.equal(AJ.snapToBeat(1.3, { bpm: 120, subdivision: 2 }), 1.25);
  assert.equal(AJ.snapToBeat(0.6, { bpm: 120, phase: 0.1 }), 0.6);
});

test("beatGrid produces evenly spaced beats", () => {
  assert.deepEqual(AJ.beatGrid({ bpm: 120, count: 4 }), [0, 0.5, 1, 1.5]);
  assert.throws(() => AJ.beatGrid({ bpm: 0 }), RangeError);
});

test("repeatCount floors and never goes negative (negative repeat = infinite in GSAP)", () => {
  assert.equal(AJ.repeatCount(10, 3), 2);
  assert.equal(AJ.repeatCount(1, 3), 0);
  assert.equal(AJ.repeatCount(5, 0), 0);
});

test("seededRandom is reproducible, in [0,1), and seed-sensitive", () => {
  const a = AJ.seededRandom(42);
  const b = AJ.seededRandom(42);
  const c = AJ.seededRandom(43);
  const seqA = Array.from({ length: 5 }, a);
  assert.deepEqual(seqA, Array.from({ length: 5 }, b));
  assert.notDeepEqual(seqA, Array.from({ length: 5 }, c));
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
});

test("planEcho is symmetric with opacity falling off per rank", () => {
  const ghosts = AJ.planEcho(2, { gap: 1, falloff: 0.5 });
  assert.deepEqual(ghosts, [
    { yPercent: -100, opacity: 0.5, rank: 1 },
    { yPercent: 100, opacity: 0.5, rank: 1 },
    { yPercent: -200, opacity: 0.25, rank: 2 },
    { yPercent: 200, opacity: 0.25, rank: 2 },
  ]);
});

test("normalizeWord strips punctuation but keeps letters and digits", () => {
  assert.equal(AJ.normalizeWord("24/7!"), "247");
  assert.equal(AJ.normalizeWord("Cafés,"), "cafés");
});
