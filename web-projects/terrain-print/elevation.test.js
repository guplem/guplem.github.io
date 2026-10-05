// Reading heights: level choice, tile and row planning, and sampling. The
// synthetic tiles below store their own sample position as the value, so a
// test can tell exactly which sample a point landed on.
import { describe, expect, test } from "bun:test";
import { BODIES, esriResolution } from "./bodies.js";
import {
  calibrationPoints,
  chooseEsriLevel,
  chooseSource,
  chooseStripStep,
  chooseTerrariumZoom,
  decodeStripBlock,
  decodeStripRead,
  decodeTerrarium,
  planStrips,
  planTiles,
  ratioFromPairs,
  runPool,
  sampleStrips,
  sampleTiles,
  stripPixelOffset,
} from "./elevation.js";

const MARS = BODIES.mars.radius;

function points(list) {
  return { lats: Float64Array.from(list.map((p) => p[0])), lons: Float64Array.from(list.map((p) => p[1])) };
}

// An Esri tile whose value at (i, j) is the global column index of the sample.
function esriColumnTile(level, row, col) {
  const data = new Float32Array(513 * 513);
  for (let j = 0; j < 513; j++) for (let i = 0; i < 513; i++) data[j * 513 + i] = col * 512 + i;
  return data;
}

describe("level choice", () => {
  test("Esri: the coarsest level that is still fine enough", () => {
    // Mars: level 5 is 651 m, level 4 is 1302 m.
    expect(chooseEsriLevel(1000, MARS, 7)).toBe(5);
    expect(chooseEsriLevel(652, MARS, 7)).toBe(5);
    expect(chooseEsriLevel(10, MARS, 7)).toBe(7);
    expect(chooseEsriLevel(1e9, MARS, 7)).toBe(0);
  });
  test("Terrarium: pixels shrink with latitude, so a higher latitude needs a lower zoom", () => {
    const r = BODIES.earth.radius;
    expect(chooseTerrariumZoom(100, 0, r, 15)).toBe(11);
    expect(chooseTerrariumZoom(100, 60, r, 15)).toBe(10);
    expect(chooseTerrariumZoom(0.1, 0, r, 15)).toBe(15);
  });
  test("strip files step over pixels when the model is coarser than the data", () => {
    const src = BODIES.moon.sources.find((s) => s.id === "usgs-lola-118m");
    expect(chooseStripStep(50, src, BODIES.moon.radius)).toBe(1);
    expect(chooseStripStep(360, src, BODIES.moon.radius)).toBe(3);
  });
});

describe("Esri tiles", () => {
  test("a point on the date line needs the first and the last column", () => {
    const tiles = planTiles("esri", { ...points([[10, 179.99], [10, -179.99]]), centreLon: 180, level: 0 });
    const cols = new Set(tiles.map((t) => t.col));
    expect(cols).toEqual(new Set([0, 1]));
  });
  test("sample positions match the documented corner-sample grid", () => {
    const level = 2;
    const res = esriResolution(level);
    const lon = -180 + 700.25 * res; // between global columns 700 and 701
    const { lats, lons } = points([[45, lon]]);
    const tiles = planTiles("esri", { lats, lons, centreLon: lon, level });
    expect(tiles.map((t) => t.col)).toEqual([1]);
    const data = new Map(tiles.map((t) => [t.key, esriColumnTile(level, t.row, t.col)]));
    const out = sampleTiles("esri", { lats, lons, centreLon: lon, level }, (k) => data.get(k));
    expect(out[0]).toBeCloseTo(700.25, 3);
  });
  test("a missing tile gives no number rather than a wrong one", () => {
    const { lats, lons } = points([[0, 0]]);
    const out = sampleTiles("esri", { lats, lons, centreLon: 0, level: 1 }, () => null);
    expect(Number.isNaN(out[0])).toBe(true);
  });
  test("a calibrated copy is scaled back to the original", () => {
    const { lats, lons } = points([[0, -170]]);
    const out = sampleTiles("esri", { lats, lons, centreLon: -170, level: 0 }, () => new Float32Array(513 * 513).fill(2000), 0.5);
    expect(out[0]).toBe(1000);
  });
});

describe("Terrarium tiles", () => {
  test("pixel centres: a point in the middle of a pixel reads that pixel alone", () => {
    // zoom 0: one tile; pixel (10, 20) has its centre at (10.5, 20.5).
    const data = new Float32Array(256 * 256);
    data[20 * 256 + 10] = 1234;
    const lon = (10.5 / 256) * 360 - 180;
    const yMerc = 20.5 / 256;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * yMerc))) * 180) / Math.PI;
    const { lats, lons } = points([[lat, lon]]);
    const out = sampleTiles("terrarium", { lats, lons, centreLon: lon, level: 0 }, () => data);
    expect(out[0]).toBeCloseTo(1234, 3);
  });
  test("decodes red, green and blue into metres", () => {
    // 8848 m: 8848 + 32768 = 41616 = 162 * 256 + 144
    const rgba = Uint8Array.from([162, 144, 0, 255, 128, 0, 128, 255]);
    expect(Array.from(decodeTerrarium(rgba))).toEqual([8848, 0.5]);
  });
});

// A small strip file: 1 pixel per degree, value = column + 100 * row.
const SMALL = { kind: "strip", width: 360, height: 180, ppd: 1, latTop: 90, dataOffset: 100, scale: 1, noData: -32768 };
function readBlockBytes(block) {
  const buf = new ArrayBuffer(block.bytes);
  const view = new DataView(buf);
  for (let r = 0; r < block.rowCount; r++) {
    for (let c = 0; c < SMALL.width; c++) view.setInt16((r * SMALL.width + c) * 2, c + 100 * (block.row + r), true);
  }
  return buf;
}
function readBytes(read) {
  const buf = new ArrayBuffer(read.bytes);
  const view = new DataView(buf);
  const row = read.row; // step 1 in these tests unless given
  for (let k = 0; k < read.count; k++) view.setInt16(k * 2, read.first + k + 100 * row, true);
  return buf;
}

describe("USGS strip files", () => {
  test("plan one read per row, with the right byte offset", () => {
    // Pixel (col 190, row 79) is centred at lon 10.5, lat 10.5.
    const { lats, lons } = points([[10.5, 10.5]]);
    const plan = planStrips({ lats, lons, centreLon: 10.5, source: SMALL, step: 1 });
    expect(plan.covered).toBe(true);
    expect(plan.reads.map((r) => r.row)).toEqual([79, 80]);
    const r = plan.reads[0];
    expect(r.first).toBe(190);
    expect(r.count).toBe(2);
    expect(r.offset).toBe(100 + 79 * 720 + 190 * 2);
  });
  test("a run across the date line splits into two reads", () => {
    const { lats, lons } = points([[0.5, 179.6], [0.5, -179.6]]);
    const plan = planStrips({ lats, lons, centreLon: 180, source: SMALL, step: 1 });
    const row = plan.reads.filter((r) => r.row === 89);
    expect(row.map((r) => [r.first, r.count])).toEqual([
      [359, 1],
      [0, 1],
    ]);
  });
  test("samples land on the right pixel, on both sides of the date line", () => {
    const { lats, lons } = points([[0.5, 179.5], [0.5, -179.5], [-30.5, 45.5]]);
    for (const centreLon of [180, 0]) {
      const plan = planStrips({ lats, lons, centreLon, source: SMALL, step: 1 });
      const decoded = plan.reads.map((read) => ({ read, values: decodeStripRead(readBytes(read), read, SMALL, 1) }));
      const out = sampleStrips({ lats, lons, centreLon, source: SMALL, step: 1 }, decoded);
      expect(out[0]).toBeCloseTo(359 + 8900, 3);
      expect(out[1]).toBeCloseTo(0 + 8900, 3);
      expect(out[2]).toBeCloseTo(225 + 12000, 3);
    }
  });
  test("near a pole, rows that span most of the file merge into block reads", () => {
    // Points in a ring round the north pole: each row spans every longitude.
    const list = [];
    for (let lat = 87.5; lat < 90; lat += 0.5) for (let lon = -179.5; lon < 180; lon += 7) list.push([lat, lon]);
    const { lats, lons } = points(list);
    const plan = planStrips({ lats, lons, centreLon: 0, source: SMALL, step: 1 });
    expect(plan.reads.length).toBe(1);
    const block = plan.reads[0];
    expect(block.block).toBe(true);
    expect(block.offset).toBe(100);
    expect(block.bytes).toBe(block.rowCount * 720);
    const decoded = decodeStripBlock(readBlockBytes(block), block, SMALL);
    const out = sampleStrips({ lats, lons, centreLon: 0, source: SMALL, step: 1 }, decoded);
    // (89.5, -179.5) is pixel (0, 0): value 0. (87.5, 2.5) is pixel (182, 2).
    expect(out[list.findIndex(([a, b]) => a === 89.5 && b === -179.5)]).toBeCloseTo(0, 3);
    expect(out[list.findIndex(([a, b]) => a === 87.5 && b === 2.5)]).toBeCloseTo(382, 3);
  });
  test("narrow rows are never merged", () => {
    const { lats, lons } = points([[10.5, 10.5], [11.5, 10.5]]);
    const plan = planStrips({ lats, lons, centreLon: 10.5, source: SMALL, step: 1 });
    expect(plan.reads.every((r) => !r.block)).toBe(true);
  });
  test("a step keeps every n-th pixel", () => {
    const read = { row: 0, first: 4, count: 7, start: 2 };
    const buf = new ArrayBuffer(14);
    const v = new DataView(buf);
    for (let k = 0; k < 7; k++) v.setInt16(2 * k, 10 + k, true);
    expect(Array.from(decodeStripRead(buf, read, SMALL, 3))).toEqual([10, 13, 16]);
  });
  test("the no-data value becomes no number", () => {
    const buf = new ArrayBuffer(2);
    new DataView(buf).setInt16(0, -32768, true);
    expect(Number.isNaN(decodeStripRead(buf, { count: 1 }, SMALL, 1)[0])).toBe(true);
  });
  test("a file that stops at 60 degrees does not cover a polar point", () => {
    const src = { ...SMALL, height: 120, latTop: 60 };
    const { lats, lons } = points([[75, 0]]);
    expect(planStrips({ lats, lons, centreLon: 0, source: src, step: 1 }).covered).toBe(false);
  });
  test("finds the byte of the pixel nearest a point", () => {
    expect(stripPixelOffset(SMALL, 89.5, -179.5)).toBe(100);
    expect(stripPixelOffset(SMALL, 88.5, -178.5)).toBe(100 + 720 + 2);
  });
});

describe("calibrating a tiled copy", () => {
  test("finds the doubling of the ArcGIS Online Moon copy", () => {
    expect(ratioFromPairs([[-2227.7, -1113.5], [-1893.6, -945.5], [-2258.5, -1129.5], [-1746.9, -874]])).toBeCloseTo(2, 2);
  });
  test("refuses pairs that disagree, and pairs too close to the datum", () => {
    expect(ratioFromPairs([[2000, 1000], [1000, 1000], [3000, 1000]])).toBeNull();
    expect(ratioFromPairs([[20, 10], [40, 20], [60, 30]])).toBeNull();
  });
  test("picks smooth points far from the datum, with their position", () => {
    const data = new Float32Array(513 * 513).fill(-3000);
    const picks = calibrationPoints(data, { z: 3, row: 2, col: 5 }, 5);
    expect(picks.length).toBe(5);
    const res = esriResolution(3);
    for (const p of picks) {
      expect(p.value).toBe(-3000);
      expect(p.lat).toBeLessThanOrEqual(90 - 2 * 512 * res);
      expect(p.lon).toBeGreaterThanOrEqual(-180 + 5 * 512 * res);
    }
  });
});

describe("choosing a source", () => {
  const grid = (spacing, lat = 0, lon = 0) => ({ ...points([[lat, lon]]), centreLat: lat, centreLon: lon, spacing });
  test("the Moon uses the official tiles first", () => {
    expect(chooseSource(BODIES.moon, grid(2000)).source.id).toBe("esri-lola-kaguya");
  });
  test("without the official tiles, a coarse model takes the tiled copy", () => {
    const plan = chooseSource(BODIES.moon, grid(2000), (id) => id !== "esri-lola-kaguya");
    expect(plan.source.id).toBe("lola-tile-copy");
  });
  test("a fine model past the copy's last level reads the 59 m file inside 60 degrees", () => {
    const plan = chooseSource(BODIES.moon, grid(60), (id) => id !== "esri-lola-kaguya");
    expect(plan.source.id).toBe("usgs-lola-kaguya-59m");
    expect(plan.resolution).toBeCloseTo(59.2, 0);
  });
  test("and the 118 m file near a pole", () => {
    const plan = chooseSource(BODIES.moon, grid(60, -80, 20), (id) => id !== "esri-lola-kaguya");
    expect(plan.source.id).toBe("usgs-lola-118m");
  });
  test("Mars falls back to the MOLA file when the tiles fail", () => {
    expect(chooseSource(BODIES.mars, grid(500)).source.id).toBe("esri-hrsc-mola");
    expect(chooseSource(BODIES.mars, grid(500), (id) => id !== "esri-hrsc-mola").source.id).toBe("usgs-mola-463m");
  });
  test("returns nothing when no source is left", () => {
    expect(chooseSource(BODIES.earth, grid(100), () => false)).toBeNull();
  });
});

describe("runPool", () => {
  test("keeps the order and never runs more than the limit", async () => {
    let running = 0;
    let peak = 0;
    const out = await runPool([1, 2, 3, 4, 5], 2, async (x) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return x * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });
});
