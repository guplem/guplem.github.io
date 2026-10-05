// The cut plan: how many pieces, which piece each point is in, and how the
// slivers at a round rim are handled.
import { describe, expect, test } from "bun:test";
import { outlineDistance } from "./outline.js";
import { cutDistance, gridForBed, gridForCount, KNOB_REACH, knobShape, planPieces, seededRandom } from "./pieces.js";

describe("grid sizes", () => {
  test("about the asked count, in nearly square pieces", () => {
    expect(gridForCount(200, 200, 25)).toEqual({ cols: 5, rows: 5 });
    expect(gridForCount(300, 200, 24)).toEqual({ cols: 6, rows: 4 });
    expect(gridForCount(100, 100, 1)).toEqual({ cols: 1, rows: 1 });
  });
  test("the fewest pieces that fit the bed, turned if that helps", () => {
    const bed = { width: 256, height: 256 };
    expect(gridForBed(200, 200, bed)).toEqual({ cols: 1, rows: 1 });
    expect(gridForBed(400, 200, bed)).toEqual({ cols: 2, rows: 1 });
    expect(gridForBed(480, 480, bed)).toEqual({ cols: 2, rows: 2 });
    // 300 x 200 on a 210 x 250 bed fits as two 150 x 200 pieces.
    expect(gridForBed(300, 200, { width: 250, height: 210 })).toEqual({ cols: 2, rows: 1 });
  });
  test("knobs that reach past the cell count against the bed", () => {
    expect(gridForBed(490, 240, { width: 256, height: 256 }, 5, 0)).toEqual({ cols: 2, rows: 1 });
    expect(gridForBed(490, 240, { width: 256, height: 256 }, 5, 10)).toEqual({ cols: 3, rows: 1 });
  });
});

describe("seededRandom", () => {
  test("repeats for one seed", () => {
    const a = seededRandom(5);
    const b = seededRandom(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("knobShape", () => {
  test("stays inside its band: 0.34 to 0.66 along the edge, at most 0.33 deep", () => {
    for (let s = 1; s < 40; s++) {
      const rand = seededRandom(s);
      const knob = knobShape([0, 0], [30, 0], [0, 1], 30, rand);
      for (const [x, y] of knob.region) {
        expect(x).toBeGreaterThanOrEqual(30 * 0.34 - 1e-9);
        expect(x).toBeLessThanOrEqual(30 * 0.66 + 1e-9);
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeLessThanOrEqual(30 * KNOB_REACH + 1e-9);
      }
    }
  });
  test("has a head wider than its neck, so it locks", () => {
    const knob = knobShape([0, 0], [30, 0], [0, 1], 30, () => 0.5);
    const xs = knob.region.map((p) => p[0]);
    const head = Math.max(...xs) - Math.min(...xs);
    const neck = knob.curve[knob.curve.length - 1][0] - knob.curve[0][0];
    expect(head).toBeGreaterThan(neck * 1.3);
  });
});

describe("planPieces", () => {
  test("one cell is one piece with no cuts", () => {
    const p = planPieces({ width: 100, height: 100, cols: 1, rows: 1, joint: "knob", seed: 1, outlineDistance: outlineDistance("circle", 100) });
    expect(p.pieceCount).toBe(1);
    expect(p.cuts).toEqual([]);
    expect(p.pieceAt(0, 0)).toBe(0);
  });
  test("slivers at a round rim join a neighbour", () => {
    const p = planPieces({ width: 100, height: 100, cols: 5, rows: 5, joint: "straight", seed: 1, outlineDistance: outlineDistance("circle", 100) });
    // The four corner cells of a 5 x 5 grid over a circle are almost empty.
    expect(p.pieceCount).toBeLessThan(25 - 4 + 1);
    for (let i = 0; i < 25; i++) {
      if (p.fraction[i] > 0) expect(p.cellPiece[i]).toBeGreaterThanOrEqual(0);
    }
  });
  test("pieces are numbered in reading order, top left first", () => {
    const p = planPieces({ width: 90, height: 60, cols: 3, rows: 2, joint: "straight", seed: 1, outlineDistance: outlineDistance("landscape", 90) });
    expect(p.pieceAt(-40, 25)).toBe(0);
    expect(p.pieceAt(40, 25)).toBe(2);
    expect(p.pieceAt(-40, -25)).toBe(3);
  });
  test("a point inside a knob belongs to the piece the knob grows from", () => {
    const sd = outlineDistance("square", 60);
    const p = planPieces({ width: 60, height: 60, cols: 2, rows: 1, joint: "knob", seed: 4, outlineDistance: sd });
    expect(p.cuts.length).toBe(1);
    // Take the knob point farthest from the cut line, then step back toward the line.
    const cut = p.cuts[0];
    const far = cut.reduce((best, q) => (Math.abs(q[0]) > Math.abs(best[0]) ? q : best));
    const inside = [far[0] * 0.92, far[1]];
    const giver = far[0] > 0 ? p.pieceAt(-10, 0) : p.pieceAt(10, 0);
    expect(p.pieceAt(...inside)).toBe(giver);
  });
  test("no knob is cut in half by the rim", () => {
    const sd = outlineDistance("circle", 80);
    const p = planPieces({ width: 80, height: 80, cols: 4, rows: 4, joint: "knob", seed: 9, outlineDistance: sd });
    for (const cut of p.cuts) {
      if (cut.length > 2) for (const [x, y] of cut.slice(1, -1)) expect(sd(x, y)).toBeGreaterThan(0);
    }
  });
});

describe("cutDistance", () => {
  test("measures the distance to the nearest cut, capped at the band", () => {
    const grid = { nx: 11, ny: 1, x0: 0, y0: 0, d: 1 };
    const d = cutDistance([[[5, -5], [5, 5]]], grid, 3);
    expect(Array.from(d)).toEqual([3, 3, 3, 2, 1, 0, 1, 2, 3, 3, 3]);
  });
});
