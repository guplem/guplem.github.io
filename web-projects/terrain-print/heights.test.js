// Ground heights to print heights: the vertical scale, the sea and the curve
// of the globe. A wrong rule here prints a wrong landscape with no error, so
// each rule has its own small grid.
import { describe, expect, test } from "bun:test";
import { buildHeights, edgeHeights, fillGaps, floodSea } from "./heights.js";

const all = (n) => new Uint8Array(n).fill(1);

describe("fillGaps", () => {
  test("fills a hole from its neighbours", () => {
    const h = Float32Array.from([10, 10, 10, 10, NaN, 30, 10, 10, 10]);
    expect(fillGaps(h, 3, 3)).toBe(1);
    expect(h[4]).toBeCloseTo(15, 6);
  });
  test("fills a wide hole from the outside in", () => {
    const h = Float32Array.from([5, NaN, NaN, NaN]);
    fillGaps(h, 4, 1);
    expect(Array.from(h)).toEqual([5, 5, 5, 5]);
  });
  test("refuses a grid with no data at all", () => {
    expect(() => fillGaps(Float32Array.from([NaN, NaN]), 2, 1)).toThrow(/No height data/);
  });
});

describe("floodSea", () => {
  // A row: open sea on the left, a hill, then a basin below sea level.
  const h = Float32Array.from([-50, -10, 20, 40, 20, -30, -40, -30, 20]);
  const inside = Uint8Array.from([0, 1, 1, 1, 1, 1, 1, 1, 1]);
  test('"all" floods every point below the level', () => {
    expect(Array.from(floodSea(h, 9, 1, inside, 0, "all"))).toEqual([1, 1, 0, 0, 0, 1, 1, 1, 0]);
  });
  test('"connected" leaves a basin the sea cannot reach dry', () => {
    // On a one-row grid every point is on the grid edge, so use 9 x 3 with a
    // dry frame row above and below.
    const nx = 9;
    const grid = new Float32Array(nx * 3).fill(100);
    grid.set(h, nx);
    const ins = new Uint8Array(nx * 3).fill(1);
    ins[nx] = 0; // the open sea point sits outside the outline
    const water = floodSea(grid, nx, 3, ins, 0, "connected");
    expect(Array.from(water.subarray(nx, 2 * nx))).toEqual([1, 1, 0, 0, 0, 0, 0, 0, 0]);
  });
  test('"connected" also floods across a diagonal gap in a coastline', () => {
    // 3 x 3: open sea in the corner (outside), land on the edges, a sea point
    // in the middle that touches the corner only diagonally.
    const grid = Float32Array.from([-50, 10, 10, 10, -20, 10, 10, 10, 10]);
    const ins = Uint8Array.from([0, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(floodSea(grid, 3, 3, ins, 0, "connected")[4]).toBe(1);
  });
  test('"connected" floods a small enclosed pocket, but keeps a large basin dry', () => {
    const nx = 7;
    const ny = 7;
    const grid = new Float32Array(nx * ny).fill(100);
    const ins = new Uint8Array(nx * ny).fill(1);
    grid[1 * nx + 1] = -80; // a one-point pit: data noise
    for (let j = 3; j <= 5; j++) for (let i = 3; i <= 5; i++) grid[j * nx + i] = -300; // a 9-point basin
    const water = floodSea(grid, nx, ny, ins, 0, "connected", 4);
    expect(water[1 * nx + 1]).toBe(1);
    expect(water[4 * nx + 4]).toBe(0);
  });
  test("a higher sea level reaches farther inland", () => {
    expect(Array.from(floodSea(h, 9, 1, inside, 25, "all"))).toEqual([1, 1, 1, 0, 1, 1, 1, 1, 1]);
  });
});

describe("buildHeights", () => {
  const base = { nx: 4, ny: 1, mmPerMetre: 0.001, baseMm: 3, sea: null, groundDistance: null };
  test("relief mode maps the lowest point to the base and the highest to base + relief", () => {
    const r = buildHeights({ ...base, elev: Float32Array.from([100, 200, 300, 500]), inside: all(4), mode: "relief", reliefMm: 8 });
    expect(Array.from(r.z)).toEqual([3, 5, 7, 11]);
    expect(r.stats.reliefMm).toBeCloseTo(8, 6);
    // 8 mm for 400 m at 0.001 mm per metre is 20 times true scale.
    expect(r.stats.exaggeration).toBeCloseTo(20, 6);
  });
  test("exaggeration mode scales from the horizontal scale", () => {
    const r = buildHeights({ ...base, elev: Float32Array.from([0, 1000, 0, 0]), inside: all(4), mode: "exaggeration", exaggeration: 2 });
    expect(r.z[1]).toBeCloseTo(5, 6);
  });
  test("points outside the outline do not change the scale", () => {
    const inside = Uint8Array.from([1, 1, 0, 1]);
    const r = buildHeights({ ...base, elev: Float32Array.from([0, 100, 99999, 100]), inside, mode: "relief", reliefMm: 10 });
    expect(r.z[1]).toBeCloseTo(13, 6);
  });
  test("a flat area stays flat at the base", () => {
    const r = buildHeights({ ...base, elev: new Float32Array(4).fill(7), inside: all(4), mode: "relief", reliefMm: 10 });
    expect(Array.from(r.z)).toEqual([3, 3, 3, 3]);
  });
  test("the sea is flat at its level, and the land stands one step above it", () => {
    const sea = { on: true, level: 0, flood: "all", stepMm: 0.4 };
    const r = buildHeights({ ...base, elev: Float32Array.from([-4000, -10, 10, 1000]), inside: all(4), mode: "relief", reliefMm: 10, sea });
    expect(r.z[0]).toBe(3);
    expect(r.z[1]).toBe(3);
    expect(r.z[2]).toBeCloseTo(3 + 0.1 + 0.4, 6);
    expect(r.z[3]).toBeCloseTo(3 + 10 + 0.4, 6);
    expect(r.stats.seaZ).toBe(3);
    expect(Array.from(r.water)).toEqual([1, 1, 0, 0]);
  });
  test("with the sea off, the sea floor is printed", () => {
    const r = buildHeights({ ...base, elev: Float32Array.from([-4000, -10, 10, 1000]), inside: all(4), mode: "relief", reliefMm: 10 });
    expect(r.z[0]).toBe(3);
    expect(r.z[3]).toBeCloseTo(13, 6);
    expect(r.water).toBeNull();
  });
  test("no water in the area means no step", () => {
    const sea = { on: true, level: -500, flood: "all", stepMm: 0.4 };
    const r = buildHeights({ ...base, elev: Float32Array.from([0, 100, 200, 300]), inside: all(4), mode: "relief", reliefMm: 3, sea });
    expect(r.z[0]).toBe(3);
    expect(r.stats.seaStepMm).toBe(0);
  });
  test("the curve of the globe lowers the edges and keeps the base under the lowest point", () => {
    const radius = 1000;
    const r = buildHeights({
      ...base,
      nx: 3,
      mmPerMetre: 1,
      elev: new Float32Array(3).fill(0),
      inside: all(3),
      mode: "relief",
      reliefMm: 5,
      radius,
      groundDistance: Float32Array.from([100, 0, 100]),
    });
    const drop = radius * (1 - Math.cos(0.1));
    expect(r.z[0]).toBeCloseTo(3, 6);
    expect(r.z[1]).toBeCloseTo(3 + drop, 4);
    expect(r.stats.seaZ).toBeNull();
  });
});

describe("edgeHeights", () => {
  test("reads the points on the rim of the outline only", () => {
    const nx = 5;
    const ny = 5;
    const inside = new Uint8Array(25);
    const z = new Float32Array(25);
    for (let j = 1; j < 4; j++) for (let i = 1; i < 4; i++) inside[j * nx + i] = 1;
    z.fill(4);
    z[12] = 99; // the centre is not on the edge
    z[6] = 2;
    z[8] = 6;
    expect(edgeHeights(z, inside, nx, ny)).toEqual({ min: 2, max: 6 });
  });
});
