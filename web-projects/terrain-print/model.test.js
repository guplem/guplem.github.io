// The whole pipeline after the download, on made-up heights: geometry,
// ground points, pieces, frame, warnings and the colour plan.
import { describe, expect, test } from "bun:test";
import { BODIES } from "./bodies.js";
import { colourAt, colourPlan } from "./colourPlan.js";
import { distanceOnSphere } from "./geo.js";
import { isWatertight } from "./mesher.js";
import { buildModel, fitsBed, footprint, groundPoints, layoutOffsets, modelGeometry, splitGrid } from "./model.js";
import { defaultSettings } from "./settings.js";

const BED = { width: 256, height: 256 };

function design(over) {
  return { ...defaultSettings("moon"), sizeMm: 60, detail: "draft", ...over };
}

// A cone-shaped mountain: 2000 m at the centre, 0 m at 30 mm out.
function coneHeights(geom) {
  const elev = new Float32Array(geom.nx * geom.ny);
  for (let j = 0; j < geom.ny; j++) {
    for (let i = 0; i < geom.nx; i++) {
      const r = Math.hypot(geom.x0 + i * geom.d, geom.y0 + j * geom.d);
      elev[j * geom.nx + i] = Math.max(0, 2000 * (1 - r / 30));
    }
  }
  return elev;
}

describe("modelGeometry", () => {
  test("sizes the grid from the detail and the scale from the selection", () => {
    const g = modelGeometry(design({ sizeMm: 150, km: 300, detail: "fine" }));
    expect(g.width).toBe(150);
    expect(g.d).toBe(0.3);
    expect(g.nx).toBe(505);
    expect(g.metresPerMm).toBe(2000);
    expect(g.groundSpacing).toBeCloseTo(600, 9);
    // The grid reaches past the outline on both sides.
    expect(g.x0).toBeLessThan(-75);
  });
});

describe("groundPoints and footprint", () => {
  test("the grid point at the model's edge is half the selection away from the centre", () => {
    const s = design({ lat: 10, lon: 20, km: 100, sizeMm: 100, detail: "standard" });
    const g = modelGeometry(s);
    const { lats, lons, distance } = groundPoints(g, s);
    const mid = Math.floor(g.ny / 2) * g.nx;
    let k = mid;
    while (g.x0 + (k - mid) * g.d < 50 - 1e-9) k++;
    const along = distanceOnSphere(10, 20, lats[k], lons[k], BODIES.moon.radius);
    expect(along / 1000).toBeCloseTo(50, 3);
    expect(distance[k] / 1000).toBeCloseTo(50, 3);
  });
  test("a rotated rectangle turns its footprint on the map", () => {
    const s = design({ lat: 0, lon: 0, km: 100, sizeMm: 100, shape: "landscape" });
    const flat = footprint(s, 8);
    const turned = footprint({ ...s, rotation: 90 }, 8);
    const spanLon = (pts) => Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
    expect(spanLon(turned)).toBeLessThan(spanLon(flat));
  });
});

describe("splitGrid and fitsBed", () => {
  test("a puzzle follows the piece count; a big model splits to fit the bed", () => {
    const g = modelGeometry(design({ sizeMm: 400, shape: "square" }));
    expect(splitGrid(design({ split: "puzzle", pieces: 16 }), g, BED)).toEqual({ cols: 4, rows: 4 });
    expect(splitGrid(design({ split: "bed", joint: "straight" }), g, BED)).toEqual({ cols: 2, rows: 2 });
    expect(splitGrid(design({ split: "single" }), g, BED)).toEqual({ cols: 1, rows: 1 });
  });
  test("the bed keeps a margin free, and a part may turn", () => {
    expect(fitsBed(246, 100, BED)).toBe(true);
    expect(fitsBed(247, 100, BED)).toBe(false);
    expect(fitsBed(200, 240, { width: 250, height: 210 })).toBe(true);
  });
});

describe("buildModel", () => {
  test("one closed tile with the relief that was asked", () => {
    const s = design({ reliefMm: 8 });
    const geom = modelGeometry(s);
    const out = buildModel({ settings: s, geom, elev: coneHeights(geom), distance: null, bed: BED });
    expect(out.parts.length).toBe(1);
    expect(isWatertight(out.parts[0].mesh)).toBe(true);
    const b = out.parts[0].bounds;
    expect(b[2]).toBe(0);
    expect(b[5]).toBeCloseTo(3 + 8, 0);
    expect(out.warnings).toEqual([]);
  });
  test("a puzzle in a frame: closed pieces, a frame around them, and the rim flush with the lowest edge", () => {
    const s = design({ split: "puzzle", pieces: 4, frame: "tray", sizeMm: 80 });
    const geom = modelGeometry(s);
    const out = buildModel({ settings: s, geom, elev: coneHeights(geom), distance: null, bed: BED });
    const pieces = out.parts.filter((p) => p.kind === "piece");
    const frame = out.parts.find((p) => p.kind === "frame");
    expect(pieces.length).toBe(4);
    for (const p of pieces) expect(isWatertight(p.mesh)).toBe(true);
    expect(isWatertight(frame.mesh)).toBe(true);
    expect(frame.bounds[5]).toBeCloseTo(s.floorMm + out.stats.edgeMinMm, 6);
    expect(frame.bounds[3] - frame.bounds[0]).toBeCloseTo(80 + 2 * (0.3 + 6), 0);
  });
  test("warns when a part does not fit the bed, and about tiny pieces", () => {
    const s = design({ sizeMm: 300, split: "single" });
    const geom = modelGeometry(s);
    const out = buildModel({ settings: s, geom, elev: coneHeights(geom), distance: null, bed: { width: 180, height: 180 } });
    expect(out.warnings.some((w) => w.includes("bigger than the printer bed"))).toBe(true);
    const tiny = design({ sizeMm: 60, split: "puzzle", pieces: 25 });
    const g2 = modelGeometry(tiny);
    const out2 = buildModel({ settings: tiny, geom: g2, elev: coneHeights(g2), distance: null, bed: BED });
    expect(out2.warnings.some((w) => w.includes("hard to print"))).toBe(true);
  });
  test("layoutOffsets spreads pieces apart and moves the frame aside", () => {
    const parts = [
      { kind: "piece", bounds: [-40, -40, 0, 0, 0, 5] },
      { kind: "piece", bounds: [0, 0, 0, 40, 40, 5] },
      { kind: "frame", bounds: [-46, -46, 0, 46, 46, 6] },
    ];
    const off = layoutOffsets(parts, 40, 4);
    expect(off[1][0] - off[0][0]).toBeCloseTo(4, 9);
    expect(off[2][0] + parts[2].bounds[0]).toBeGreaterThan(40);
  });
});

describe("colourPlan", () => {
  const stats = { anyWater: true, seaZ: 3.1, seaStepMm: 0.4, lowM: 0, verticalMmPerMetre: 0.01, topMm: 15, curved: false };
  const s = { ...defaultSettings("earth"), baseMm: 3, seaOn: true, snowOn: false };
  test("one swap at the first layer above the sea", () => {
    const plan = colourPlan({ stats, settings: s });
    expect(plan.bands.map((b) => b.label)).toEqual(["Sea", "Land"]);
    // The sea surface at 3.1 mm lies in the layer from 3.0 to 3.2 mm, which
    // stays blue; land starts with the layer from 3.2 mm.
    expect(plan.swaps[0].atMm).toBe(3.2);
    expect(plan.swaps[0].layer).toBe(17);
  });
  test("a snow line adds a second swap at its height", () => {
    const plan = colourPlan({ stats, settings: { ...s, snowOn: true, snowLine: 1000 } });
    expect(plan.bands.map((b) => b.label)).toEqual(["Sea", "Land", "Snow"]);
    // 3 + 1000 * 0.01 + 0.4 = 13.4 mm
    expect(plan.swaps[1].atMm).toBeCloseTo(13.4, 6);
  });
  test("no water: one colour", () => {
    const plan = colourPlan({ stats: { ...stats, anyWater: false, seaZ: null }, settings: s });
    expect(plan.bands.length).toBe(1);
    expect(plan.swaps).toEqual([]);
  });
  test("colourAt reads the band at a height", () => {
    const plan = colourPlan({ stats, settings: s });
    expect(colourAt(plan.bands, 1)).toBe(s.seaColour);
    expect(colourAt(plan.bands, 5)).toBe(s.terrainColour);
  });
  test("the flat sea surface, exactly at the swap height, is still sea", () => {
    const plan = colourPlan({ stats: { ...stats, seaZ: 3 }, settings: s });
    expect(plan.swaps[0].atMm).toBe(3);
    expect(colourAt(plan.bands, 3)).toBe(s.seaColour);
    expect(colourAt(plan.bands, 3.4)).toBe(s.terrainColour);
  });
});
