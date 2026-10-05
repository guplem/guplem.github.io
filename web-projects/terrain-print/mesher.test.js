// The mesher must give closed solids, or a slicer will refuse or "repair"
// them in its own way. Every test checks that each edge is used exactly
// twice in opposite directions, and that the volume is what the shape holds.
import { describe, expect, test } from "bun:test";
import { isWatertight, meshBounds, meshFrame, meshSolid, meshVolume } from "./mesher.js";
import { outlineDistance, outlinePolygon, polygonArea } from "./outline.js";
import { cutDistance, planPieces } from "./pieces.js";

function gridOf(size, d) {
  const n = Math.ceil(size / d) + 5;
  const x0 = -((n - 1) * d) / 2;
  return { nx: n, ny: n, x0, y0: x0, d };
}
const whole = (g) => ({ i0: 0, j0: 0, i1: g.nx - 1, j1: g.ny - 1 });
const fieldOf = (g, fn) => (k) => fn(g.x0 + (k % g.nx) * g.d, g.y0 + Math.floor(k / g.nx) * g.d);

describe("meshSolid", () => {
  test("a flat square slab is closed and holds its volume", () => {
    const g = gridOf(20, 0.7);
    const sd = outlineDistance("square", 20);
    const m = meshSolid({ grid: g, window: whole(g), field: fieldOf(g, sd), top: null, flatTop: 2 });
    expect(isWatertight(m)).toBe(true);
    // The corners are cut by at most one cell, so allow a little loss.
    expect(meshVolume(m)).toBeGreaterThan(400 * 2 * 0.99);
    expect(meshVolume(m)).toBeLessThanOrEqual(400 * 2 + 1e-6);
  });

  test("a square on the grid lines (collinear outline points) is still closed", () => {
    // d = 1 and an odd point count put grid points exactly on x = ±5.5, so the
    // crossings along each side line up exactly and earcut skips them.
    const g = { nx: 21, ny: 21, x0: -10, y0: -10, d: 1 };
    const m = meshSolid({ grid: g, window: whole(g), field: fieldOf(g, outlineDistance("square", 11)), top: null, flatTop: 1 });
    expect(isWatertight(m)).toBe(true);
    // 121 less the four corners, each cut by a half-cell triangle (0.125 mm²).
    expect(meshVolume(m)).toBeCloseTo(120.5, 3);
  });

  test("a round terrain tile follows its heights", () => {
    const g = gridOf(40, 0.5);
    const top = new Float32Array(g.nx * g.ny);
    for (let k = 0; k < top.length; k++) top[k] = 3 + 0.05 * (g.x0 + (k % g.nx) * g.d) + 2;
    const m = meshSolid({ grid: g, window: whole(g), field: fieldOf(g, outlineDistance("circle", 40)), top, flatTop: null });
    expect(isWatertight(m)).toBe(true);
    // Mean height over a centred disc is the height at the centre: 5 mm.
    expect(meshVolume(m) / (Math.PI * 400 * 5)).toBeCloseTo(1, 2);
    const b = meshBounds(m);
    expect(b[2]).toBe(0);
    expect(b[5]).toBeCloseTo(6, 1);
  });

  test("a ring (a solid with a hole) is closed", () => {
    const g = gridOf(30, 0.6);
    const ring = (x, y) => Math.min(15 - Math.hypot(x, y), Math.hypot(x, y) - 8);
    const m = meshSolid({ grid: g, window: whole(g), field: fieldOf(g, ring), top: null, flatTop: 1.5 });
    expect(isWatertight(m)).toBe(true);
    expect(meshVolume(m) / (Math.PI * (225 - 64) * 1.5)).toBeCloseTo(1, 2);
  });

  test("an empty field gives no mesh", () => {
    const g = gridOf(10, 1);
    expect(meshSolid({ grid: g, window: whole(g), field: () => -1, top: null, flatTop: 1 })).toBeNull();
  });
});

describe("jigsaw pieces", () => {
  test("every piece is closed, and the pieces together fill the tile less the gaps", () => {
    const size = 60;
    const g = gridOf(size, 0.4);
    const sd = outlineDistance("square", size);
    const plan = planPieces({ width: size, height: size, cols: 3, rows: 3, joint: "knob", seed: 7, outlineDistance: sd });
    expect(plan.pieceCount).toBe(9);
    const gap = 0.3;
    const dist = cutDistance(plan.cuts, g, gap + 4 * g.d);
    const label = new Int32Array(g.nx * g.ny);
    const outD = new Float32Array(g.nx * g.ny);
    for (let k = 0; k < label.length; k++) {
      const x = g.x0 + (k % g.nx) * g.d;
      const y = g.y0 + Math.floor(k / g.nx) * g.d;
      label[k] = plan.pieceAt(x, y);
      outD[k] = sd(x, y);
    }
    let total = 0;
    for (let p = 0; p < plan.pieceCount; p++) {
      const field = (k) => Math.min(outD[k], (label[k] === p ? dist[k] : -dist[k]) - gap / 2);
      const m = meshSolid({ grid: g, window: whole(g), field, top: null, flatTop: 2 });
      expect(isWatertight(m)).toBe(true);
      total += meshVolume(m);
    }
    // The gaps take the cut length times the gap width, times the height.
    const cutLength = plan.cuts.reduce((s, c) => s + c.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - c[i][0], p[1] - c[i][1]), 0), 0);
    const expected = size * size * 2 - cutLength * gap * 2;
    expect(total / expected).toBeCloseTo(1, 2);
  });

  test("the knobs lock: each inner cut is longer than a straight line", () => {
    const sd = outlineDistance("square", 90);
    const plan = planPieces({ width: 90, height: 90, cols: 3, rows: 3, joint: "knob", seed: 3, outlineDistance: sd });
    const lengths = plan.cuts.map((c) => c.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - c[i][0], p[1] - c[i][1]), 0));
    for (const L of lengths) expect(L).toBeGreaterThan(31);
  });

  test("the same seed gives the same puzzle, another seed another", () => {
    const sd = outlineDistance("circle", 100);
    const a = planPieces({ width: 100, height: 100, cols: 4, rows: 4, joint: "knob", seed: 11, outlineDistance: sd });
    const b = planPieces({ width: 100, height: 100, cols: 4, rows: 4, joint: "knob", seed: 11, outlineDistance: sd });
    const c = planPieces({ width: 100, height: 100, cols: 4, rows: 4, joint: "knob", seed: 12, outlineDistance: sd });
    expect(JSON.stringify(a.cuts)).toBe(JSON.stringify(b.cuts));
    expect(JSON.stringify(a.cuts)).not.toBe(JSON.stringify(c.cuts));
  });
});

describe("meshFrame", () => {
  test("a frame tray is closed and holds its volume", () => {
    const inner = outlinePolygon("hexagon", 100, 0.3);
    const outer = outlinePolygon("hexagon", 100, 6.3);
    const m = meshFrame(outer, inner, 2, 6);
    expect(isWatertight(m)).toBe(true);
    const expected = polygonArea(outer) * 6 - polygonArea(inner) * 4;
    expect(meshVolume(m) / expected).toBeCloseTo(1, 6);
  });
});
