import { test } from "node:test";
import assert from "node:assert/strict";
import { beatTimes, sheetGrid, parseArgs } from "../scripts/beat-frames.mjs";

test("beatTimes lists every beat inside the video, stepping by `every`", () => {
  assert.deepEqual(beatTimes(2, 120), [0, 0.5, 1, 1.5]);
  assert.deepEqual(beatTimes(2, 120, { every: 2 }), [0, 1]);
  assert.deepEqual(beatTimes(1.6, 120, { offset: 0.25 }), [0.25, 0.75, 1.25]);
  assert.throws(() => beatTimes(2, 0), /bpm/);
  assert.throws(() => beatTimes(0, 120), /duration/);
});

test("sheetGrid picks a near-square grid that fits every frame", () => {
  assert.deepEqual(sheetGrid(32), { cols: 8, rows: 4 });
  assert.deepEqual(sheetGrid(5), { cols: 3, rows: 2 });
  assert.deepEqual(sheetGrid(1), { cols: 1, rows: 1 });
  assert.deepEqual(sheetGrid(10, 4), { cols: 4, rows: 3 });
});

test("parseArgs reads the video, bpm and options", () => {
  assert.deepEqual(parseArgs(["out.mp4", "--bpm", "124", "--every", "2", "--out", "s.png"]), {
    video: "out.mp4", bpm: 124, offset: 0, every: 2, out: "s.png", cols: undefined, width: 320,
  });
  assert.throws(() => parseArgs(["out.mp4"]), /--bpm/);
});
