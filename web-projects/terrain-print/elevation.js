// Reading heights for a model: which source and level to use, which tiles or
// file rows to fetch, and how to sample them at every model point.
//
// Everything here is pure. The worker passes in the fetched tiles; nothing in
// this file touches the network, so the planning rules are all tested.
//
// The rule for resolution: a model point is `spacing` metres from the next
// one on the ground. The source level is the coarsest one whose samples are
// no farther apart than that. A finer level would download detail the printer
// cannot draw; a coarser one would blur detail it can.

import { esriResolution } from "./bodies.js";
import { mercatorPixel, mercatorPixelMetres, wrapLon } from "./geo.js";

const DEG = Math.PI / 180;

/** Coarsest Esri level whose sample spacing is at most `spacing` metres. */
export function chooseEsriLevel(spacing, radius, maxLevel) {
  const perDeg = radius * DEG;
  for (let level = 0; level <= maxLevel; level++) {
    if (esriResolution(level) * perDeg <= spacing) return level;
  }
  return maxLevel;
}

/** Coarsest Terrarium zoom whose pixel at `lat` is at most `spacing` metres. */
export function chooseTerrariumZoom(spacing, lat, radius, maxZoom) {
  for (let z = 0; z <= maxZoom; z++) {
    if (mercatorPixelMetres(lat, z, radius) <= spacing) return z;
  }
  return maxZoom;
}

/** How many file pixels to step over per sample (1 = every pixel). */
export function chooseStripStep(spacing, source, radius) {
  const pixel = (radius * DEG) / source.ppd;
  return Math.max(1, Math.floor(spacing / pixel));
}

/** Ground size in metres (north-south) of one sample of a planned read. */
export function planResolution(plan, radius, lat = 0) {
  if (plan.kind === "esri") return esriResolution(plan.level) * radius * DEG;
  if (plan.kind === "strip") return ((radius * DEG) / plan.source.ppd) * plan.step;
  if (plan.kind === "terrarium") return mercatorPixelMetres(lat, plan.level, radius);
  return Infinity;
}

// ---------------------------------------------------------------------------
// Sample positions. Each kind maps (lat, lon) to continuous sample
// coordinates (x, y), with samples at whole numbers, and reads one sample by
// its whole-number index. Longitudes are kept unwrapped next to the centre,
// so a selection across the date line reads one continuous run.

function esriGrid(level) {
  const res = esriResolution(level);
  const cols = 2 ** (level + 1);
  const rows = 2 ** level;
  return { res, cols, rows, worldX: cols * 512, worldY: rows * 512 };
}

function makeXY(kind, opts) {
  const { centreLon } = opts;
  if (kind === "esri") {
    const { res, worldX } = esriGrid(opts.level);
    const xc = (centreLon + 180) / res;
    return (lat, lon) => {
      let x = (lon + 180) / res;
      if (x - xc > worldX / 2) x -= worldX;
      else if (xc - x > worldX / 2) x += worldX;
      return [x, (90 - lat) / res];
    };
  }
  if (kind === "terrarium") {
    const world = 256 * 2 ** opts.level;
    const [xc] = mercatorPixel(0, centreLon, opts.level);
    return (lat, lon) => {
      let [x, y] = mercatorPixel(lat, lon, opts.level);
      if (x - xc > world / 2) x -= world;
      else if (xc - x > world / 2) x += world;
      return [x - 0.5, y - 0.5];
    };
  }
  if (kind === "strip") {
    const { source, step } = opts;
    const worldX = source.width / step;
    const xc = ((centreLon + 180) * source.ppd - 0.5) / step;
    return (lat, lon) => {
      let x = ((lon + 180) * source.ppd - 0.5) / step;
      if (x - xc > worldX / 2) x -= worldX;
      else if (xc - x > worldX / 2) x += worldX;
      return [x, ((source.latTop - lat) * source.ppd - 0.5) / step];
    };
  }
  throw new Error(`Unknown kind ${kind}`);
}

function mod(a, n) {
  return ((a % n) + n) % n;
}

/** The tile (or strip row) key and local index of one whole-number sample. */
function locate(kind, opts, ix, iy) {
  if (kind === "esri") {
    const g = esriGrid(opts.level);
    const gx = mod(ix, g.worldX);
    const gy = Math.max(0, Math.min(g.worldY, iy));
    const col = Math.floor(gx / 512);
    const row = Math.min(g.rows - 1, Math.floor(gy / 512));
    return { key: `${opts.level}/${row}/${col}`, z: opts.level, row, col, index: (gy - row * 512) * 513 + (gx - col * 512) };
  }
  if (kind === "terrarium") {
    const world = 256 * 2 ** opts.level;
    const gx = mod(ix, world);
    const gy = Math.max(0, Math.min(world - 1, iy));
    const col = Math.floor(gx / 256);
    const row = Math.floor(gy / 256);
    return { key: `${opts.level}/${col}/${row}`, z: opts.level, row, col, index: (gy - row * 256) * 256 + (gx - col * 256) };
  }
  throw new Error(`locate does not handle ${kind}`);
}

/**
 * Plan the tiles a set of points needs.
 * @param {"esri"|"terrarium"} kind
 * @param {{lats:Float64Array, lons:Float64Array, centreLon:number, level:number}} opts
 * @returns {{z:number,row:number,col:number,key:string}[]} unique tiles
 */
export function planTiles(kind, { lats, lons, centreLon, level }) {
  const xy = makeXY(kind, { centreLon, level });
  const seen = new Map();
  for (let k = 0; k < lats.length; k++) {
    if (Number.isNaN(lats[k])) continue;
    const [x, y] = xy(lats[k], lons[k]);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    for (const [ix, iy] of [
      [x0, y0],
      [x0 + 1, y0],
      [x0, y0 + 1],
      [x0 + 1, y0 + 1],
    ]) {
      const t = locate(kind, { level }, ix, iy);
      if (!seen.has(t.key)) seen.set(t.key, { z: t.z, row: t.row, col: t.col, key: t.key });
    }
  }
  return [...seen.values()];
}

function bilinear(lats, lons, xy, get) {
  const out = new Float32Array(lats.length);
  for (let k = 0; k < lats.length; k++) {
    if (Number.isNaN(lats[k])) {
      out[k] = NaN;
      continue;
    }
    const [x, y] = xy(lats[k], lons[k]);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const a = get(x0, y0);
    const b = get(x0 + 1, y0);
    const c = get(x0, y0 + 1);
    const d = get(x0 + 1, y0 + 1);
    out[k] = mixFour(a, b, c, d, fx, fy);
  }
  return out;
}

// Bilinear mix that survives missing corners: it averages the corners it has,
// weighted the same way, so a single hole in the data does not spread.
function mixFour(a, b, c, d, fx, fy) {
  const w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  const v = [a, b, c, d];
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < 4; i++) {
    if (Number.isFinite(v[i])) {
      sum += v[i] * w[i];
      wsum += w[i];
    }
  }
  return wsum > 1e-9 ? sum / wsum : NaN;
}

/**
 * Sample tiles at every point.
 * @param {(key:string) => (Float32Array|null)} tileData decoded tile, by key
 * @param {number} [scale=1] multiply every height by this (a calibrated copy)
 */
export function sampleTiles(kind, { lats, lons, centreLon, level }, tileData, scale = 1) {
  const xy = makeXY(kind, { centreLon, level });
  const get = (ix, iy) => {
    const t = locate(kind, { level }, ix, iy);
    const data = tileData(t.key);
    return data ? data[t.index] * scale : NaN;
  };
  return bilinear(lats, lons, xy, get);
}

// ---------------------------------------------------------------------------
// USGS strip files: one HTTP range request per needed row.

/**
 * Plan the file rows a set of points needs.
 * @returns {{reads:{row:number,first:number,count:number,offset:number,bytes:number,start:number}[],
 *   rows:number, bytes:number, covered:boolean}}
 *   Each read covers `count` file pixels from file column `first`; `start` is
 *   the unwrapped sample column of its first kept sample.
 */
export function planStrips({ lats, lons, centreLon, source, step }) {
  const xy = makeXY("strip", { centreLon, source, step });
  const rowsTotal = Math.floor(source.height / step);
  const span = new Map(); // virtual row -> [minX, maxX]
  let covered = true;
  const latBottom = source.latTop - source.height / source.ppd;
  for (let k = 0; k < lats.length; k++) {
    const lat = lats[k];
    if (Number.isNaN(lat)) continue;
    if (lat > source.latTop || lat < latBottom) covered = false;
    const [x, y] = xy(lat, lons[k]);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    for (const iy of [y0, y0 + 1]) {
      const r = Math.max(0, Math.min(rowsTotal - 1, iy));
      const s = span.get(r);
      if (!s) span.set(r, [x0, x0 + 1]);
      else {
        if (x0 < s[0]) s[0] = x0;
        if (x0 + 1 > s[1]) s[1] = x0 + 1;
      }
    }
  }
  const reads = [];
  const rowBytes = source.width * 2;
  const virtualWidth = Math.floor(source.width / step);
  for (const [r, [a, b]] of [...span.entries()].sort((p, q) => p[0] - q[0])) {
    // Split the unwrapped run [a, b] where it crosses the edge of the file.
    let x = a;
    while (x <= b) {
      const wrapped = mod(x, virtualWidth);
      const runEnd = Math.min(b, x + (virtualWidth - 1 - wrapped));
      const first = wrapped * step;
      const last = (wrapped + (runEnd - x)) * step;
      const count = last - first + 1;
      const row = r * step;
      reads.push({ row: r, first, count, start: x, offset: source.dataOffset + row * rowBytes + first * 2, bytes: count * 2 });
      x = runEnd + 1;
    }
  }
  const merged = step === 1 ? mergeWideRows(reads, source) : reads;
  return { reads: merged, rows: span.size, bytes: merged.reduce((s, r) => s + r.bytes, 0), covered };
}

/** A row read is "wide" when it needs this share of the row or more. */
const WIDE_ROW = 0.4;
/** Largest block read, bytes. */
const MAX_BLOCK = 4 * 1024 * 1024;

// Near a pole a row of the file spans most longitudes, and one request per
// row is slow. Consecutive wide rows sit next to each other in the file, so
// they are read in one request as whole rows: at most 2.5 times the bytes,
// for a fraction of the requests.
function mergeWideRows(reads, source) {
  const rowBytes = source.width * 2;
  const perRow = new Map();
  for (const r of reads) perRow.set(r.row, (perRow.get(r.row) ?? 0) + r.count);
  const wide = (row) => (perRow.get(row) ?? 0) >= WIDE_ROW * source.width;
  const out = [];
  let i = 0;
  while (i < reads.length) {
    const row = reads[i].row;
    if (!wide(row)) {
      out.push(reads[i++]);
      continue;
    }
    let last = row;
    while (wide(last + 1) && (last + 2 - row) * rowBytes <= MAX_BLOCK) last++;
    const rowCount = last - row + 1;
    out.push({ block: true, row, rowCount, first: 0, count: source.width, start: 0, offset: source.dataOffset + row * rowBytes, bytes: rowCount * rowBytes });
    while (i < reads.length && reads[i].row <= last) i++;
  }
  return out;
}

/** Turn the bytes of a block read (whole rows) into one entry per row. */
export function decodeStripBlock(buffer, block, source) {
  const out = [];
  for (let r = 0; r < block.rowCount; r++) {
    const slice = buffer.slice(r * source.width * 2, (r + 1) * source.width * 2);
    const read = { row: block.row + r, first: 0, count: source.width, start: 0, full: true };
    out.push({ read, values: decodeStripRead(slice, read, source, 1) });
  }
  return out;
}

/**
 * Turn the bytes of one planned read into the samples it holds.
 * @param {ArrayBuffer} buffer exactly `read.bytes` bytes
 */
export function decodeStripRead(buffer, read, source, step) {
  const view = new DataView(buffer);
  const n = Math.floor((read.count - 1) / step) + 1;
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const raw = view.getInt16(k * step * 2, true);
    out[k] = source.noData !== null && raw === source.noData ? NaN : raw * source.scale;
  }
  return out;
}

/**
 * Sample the decoded reads at every point.
 * @param {{read:object, values:Float32Array}[]} decoded
 */
export function sampleStrips({ lats, lons, centreLon, source, step }, decoded) {
  const xy = makeXY("strip", { centreLon, source, step });
  const rowsTotal = Math.floor(source.height / step);
  const byRow = new Map();
  for (const d of decoded) {
    if (!byRow.has(d.read.row)) byRow.set(d.read.row, []);
    byRow.get(d.read.row).push(d);
  }
  const get = (ix, iy) => {
    const r = Math.max(0, Math.min(rowsTotal - 1, iy));
    const parts = byRow.get(r);
    if (!parts) return NaN;
    for (const p of parts) {
      const k = p.read.full ? mod(ix, p.values.length) : ix - p.read.start;
      if (k >= 0 && k < p.values.length) return p.values[k];
    }
    return NaN;
  };
  return bilinear(lats, lons, xy, get);
}

// ---------------------------------------------------------------------------
// Terrarium PNG pixels to metres.

/** @param {Uint8ClampedArray|Uint8Array} rgba 4 bytes per pixel */
export function decodeTerrarium(rgba) {
  const n = rgba.length / 4;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = rgba[4 * i] * 256 + rgba[4 * i + 1] + rgba[4 * i + 2] / 256 - 32768;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Calibration of a tiled copy against the NASA file.

/**
 * The ratio copy / original when every pair agrees on it within 3 %.
 * @param {[number, number][]} pairs [copy value, original value]
 * @returns {number|null}
 */
export function ratioFromPairs(pairs) {
  const ratios = pairs.filter(([, ref]) => Math.abs(ref) >= 200).map(([copy, ref]) => copy / ref);
  if (ratios.length < 3) return null;
  const sorted = [...ratios].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (!(median > 0)) return null;
  return ratios.every((r) => Math.abs(r / median - 1) <= 0.03) ? median : null;
}

/**
 * Pick points in a decoded Esri tile that suit a calibration: far from the
 * datum (so the ratio is clear) and on smooth ground (so a half-pixel offset
 * between the two grids cannot change the value much).
 * @returns {{lat:number, lon:number, value:number}[]}
 */
export function calibrationPoints(data, tile, count = 7) {
  const res = esriResolution(tile.z);
  const candidates = [];
  for (let j = 8; j < 505; j += 12) {
    for (let i = 8; i < 505; i += 12) {
      const v = data[j * 513 + i];
      if (!Number.isFinite(v) || Math.abs(v) < 600) continue;
      let lo = Infinity;
      let hi = -Infinity;
      for (let dj = -2; dj <= 2; dj++) {
        for (let di = -2; di <= 2; di++) {
          const w = data[(j + dj) * 513 + i + di];
          if (w < lo) lo = w;
          if (w > hi) hi = w;
        }
      }
      if (hi - lo > Math.abs(v) * 0.01) continue;
      candidates.push({
        lat: 90 - (tile.row * 512 + j) * res,
        lon: wrapLon(-180 + (tile.col * 512 + i) * res),
        value: v,
        score: Math.abs(v),
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  // Spread the picks: take every few of the best candidates.
  const picks = [];
  const stride = Math.max(1, Math.floor(candidates.length / (count * 3)));
  for (let k = 0; k < candidates.length && picks.length < count; k += stride) picks.push(candidates[k]);
  return picks.map(({ lat, lon, value }) => ({ lat, lon, value }));
}

/** File byte offset of the pixel nearest to (lat, lon) in a strip source. */
export function stripPixelOffset(source, lat, lon) {
  const col = mod(Math.round((lon + 180) * source.ppd - 0.5), source.width);
  const row = Math.max(0, Math.min(source.height - 1, Math.round((source.latTop - lat) * source.ppd - 0.5)));
  return source.dataOffset + row * source.width * 2 + col * 2;
}

// ---------------------------------------------------------------------------
// Choosing a source.

/** Limits for the per-row file reads: past them, a tile source is used. */
export const STRIP_LIMITS = { maxRequests: 2500, maxBytes: 64 * 1024 * 1024 };

/**
 * Plan a read with every usable source and choose one.
 * A source listed later wins only when it is at least 20 % finer, because
 * tiles download far faster than file rows.
 * @param {object} body from BODIES
 * @param {{lats, lons, centreLat, centreLon, spacing}} grid
 * @param {(id:string) => boolean} usable false for a source that failed
 * @returns {object|null} the plan: {kind, source, level|step, resolution, ...}
 */
export function chooseSource(body, grid, usable = () => true) {
  const { lats, lons, centreLat, centreLon, spacing } = grid;
  let best = null;
  for (const source of body.sources) {
    if (!usable(source.id)) continue;
    let plan;
    if (source.kind === "esri") {
      const level = chooseEsriLevel(spacing, body.radius, source.maxLevel);
      plan = { kind: "esri", source, level };
      plan.tiles = planTiles("esri", { lats, lons, centreLon, level });
    } else if (source.kind === "terrarium") {
      const level = chooseTerrariumZoom(spacing, centreLat, body.radius, source.maxZoom);
      plan = { kind: "terrarium", source, level };
      plan.tiles = planTiles("terrarium", { lats, lons, centreLon, level });
    } else if (source.kind === "strip") {
      const step = chooseStripStep(spacing, source, body.radius);
      const strips = planStrips({ lats, lons, centreLon, source, step });
      if (!strips.covered) continue;
      if (strips.reads.length > STRIP_LIMITS.maxRequests || strips.bytes > STRIP_LIMITS.maxBytes) continue;
      plan = { kind: "strip", source, step, strips };
    } else continue;
    plan.resolution = planResolution(plan, body.radius, centreLat);
    if (!best || plan.resolution < best.resolution * 0.8) best = plan;
  }
  return best;
}

// ---------------------------------------------------------------------------

/**
 * Run `task` over `items` with at most `limit` at once.
 * @returns {Promise<any[]>} results in item order
 */
export async function runPool(items, limit, task, onDone = () => {}) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i], i);
      done++;
      onDone(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
