// The build runs here, off the page's thread: fetch the heights, then mesh.
// This file is glue. The rules live in elevation.js and model.js, which are
// tested; this file only fetches, caches and passes messages.
//
// Messages in:  { type: "build", id, settings, bed }
// Messages out: { type: "progress", id, stage, done, total }
//               { type: "result", id, ... } or { type: "error", id, message }

import { BODIES } from "./bodies.js";
import {
  calibrationPoints,
  chooseSource,
  decodeStripBlock,
  decodeStripRead,
  decodeTerrarium,
  ratioFromPairs,
  runPool,
  sampleStrips,
  sampleTiles,
  stripPixelOffset,
} from "./elevation.js";
import { decodeLerc1 } from "./lerc1.js";
import { buildModel, groundPoints, modelGeometry } from "./model.js";

const TIMEOUT_MS = 20000;
const tileCache = new Map(); // url -> Promise<Float32Array|null>
const failed = new Set(); // source ids that failed in this session
const calibration = new Map(); // source id -> scale factor
let lastHeights = null; // { key, elev, distance, source }
let current = 0;

class Cancelled extends Error {}

self.onmessage = async (event) => {
  const msg = event.data;
  if (msg.type !== "build") return;
  current = msg.id;
  try {
    const result = await build(msg);
    if (result) self.postMessage(result.message, result.transfer);
  } catch (err) {
    if (err instanceof Cancelled) return;
    self.postMessage({ type: "error", id: msg.id, message: err?.message ?? String(err) });
  }
};

function progress(id, stage, done = 0, total = 0) {
  if (id === current) self.postMessage({ type: "progress", id, stage, done, total });
}

function checkCurrent(id) {
  if (id !== current) throw new Cancelled();
}

async function build({ id, settings: s, bed }) {
  const geom = modelGeometry(s);
  const key = JSON.stringify([s.body, s.lat, s.lon, s.km, s.shape, s.rotation, s.sizeMm, s.detail]);
  if (!lastHeights || lastHeights.key !== key) {
    progress(id, "plan");
    const pts = groundPoints(geom, s);
    const { elev, source } = await readHeights(id, s, geom, pts);
    checkCurrent(id);
    lastHeights = { key, elev, distance: pts.distance, source };
  }
  checkCurrent(id);
  progress(id, "mesh", 0, 1);
  const out = buildModel({
    settings: s,
    geom,
    elev: Float32Array.from(lastHeights.elev),
    distance: lastHeights.distance,
    bed,
    onPiece: (done, total) => progress(id, "mesh", done, total),
  });
  checkCurrent(id);
  const transfer = [];
  const parts = out.parts.map((p) => {
    transfer.push(p.mesh.positions.buffer, p.mesh.indices.buffer);
    return { name: p.name, kind: p.kind, colour: p.colour, bounds: p.bounds, positions: p.mesh.positions, indices: p.mesh.indices };
  });
  return {
    message: {
      type: "result",
      id,
      parts,
      stats: out.stats,
      grid: out.grid,
      pieceCount: out.pieceCount,
      colours: out.colours,
      warnings: out.warnings,
      source: lastHeights.source,
      geom: { width: geom.width, height: geom.height, d: geom.d, groundSpacing: geom.groundSpacing },
    },
    transfer,
  };
}

async function readHeights(id, s, geom, pts) {
  const body = BODIES[s.body];
  const grid = { lats: pts.lats, lons: pts.lons, centreLat: s.lat, centreLon: s.lon, spacing: geom.groundSpacing };
  const errors = [];
  for (;;) {
    checkCurrent(id);
    const plan = chooseSource(body, grid, (sid) => !failed.has(sid));
    if (!plan) {
      throw new Error(`No height source answered for the ${body.name}. ${errors.join(" ")} Check the connection and try again.`);
    }
    try {
      const elev = await readPlan(id, plan, grid, body);
      let missing = 0;
      for (let k = 0; k < elev.length; k++) if (Number.isNaN(elev[k])) missing++;
      if (missing > elev.length * 0.5) throw new Error("the source has no data for most of this area");
      return {
        elev,
        source: {
          id: plan.source.id,
          label: plan.source.label,
          kind: plan.kind,
          resolution: plan.resolution,
          level: plan.level ?? null,
          step: plan.step ?? null,
          scale: calibration.get(plan.source.id) ?? 1,
          requests: plan.tiles ? plan.tiles.length : plan.strips.reads.length,
        },
      };
    } catch (err) {
      if (err instanceof Cancelled) throw err;
      failed.add(plan.source.id);
      errors.push(`${plan.source.label}: ${err.message}.`);
    }
  }
}

async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function tileUrl(template, t) {
  return template.replace("{z}", t.z).replace("{y}", t.row).replace("{x}", t.col);
}

async function fetchEsriTile(url) {
  const res = await fetchWithTimeout(url);
  if (res.status === 404) return null; // no data there
  if (!res.ok) throw new Error(`tile answered ${res.status}`);
  return decodeLerc1(await res.arrayBuffer()).data;
}

async function fetchTerrariumTile(url) {
  const res = await fetchWithTimeout(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`tile answered ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return decodeTerrarium(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data);
}

function cachedTile(url, fetcher) {
  if (!tileCache.has(url)) {
    const p = fetcher(url).catch((err) => {
      tileCache.delete(url);
      throw err;
    });
    tileCache.set(url, p);
    // Keep the cache to about 80 tiles (an Esri tile decodes to 1 MB).
    if (tileCache.size > 80) tileCache.delete(tileCache.keys().next().value);
  }
  return tileCache.get(url);
}

async function readPlan(id, plan, grid, body) {
  if (plan.kind === "esri" || plan.kind === "terrarium") {
    const fetcher = plan.kind === "esri" ? fetchEsriTile : fetchTerrariumTile;
    const data = new Map();
    await runPool(
      plan.tiles,
      8,
      async (t) => {
        checkCurrent(id);
        data.set(t.key, await cachedTile(tileUrl(plan.source.url, t), fetcher));
      },
      (done, total) => progress(id, "tiles", done, total),
    );
    let scale = plan.source.scale ?? 1;
    if (plan.source.calibrateAgainst) scale = await calibrate(plan, data, body);
    return sampleTiles(plan.kind, { lats: grid.lats, lons: grid.lons, centreLon: grid.centreLon, level: plan.level }, (k) => data.get(k), scale);
  }
  const { source, step, strips } = plan;
  const decoded = await runPool(
    strips.reads,
    12,
    async (read) => {
      checkCurrent(id);
      const res = await fetchWithTimeout(source.url, { headers: { Range: `bytes=${read.offset}-${read.offset + read.bytes - 1}` } });
      // A server that ignores the range would send the whole file: gigabytes.
      if (res.status !== 206) {
        res.body?.cancel();
        throw new Error(`the file server answered ${res.status} to a range request`);
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength !== read.bytes) throw new Error("a row came back short");
      return read.block ? decodeStripBlock(buf, read, source) : [{ read, values: decodeStripRead(buf, read, source, step) }];
    },
    (done, total) => progress(id, "rows", done, total),
  );
  return sampleStrips({ lats: grid.lats, lons: grid.lons, centreLon: grid.centreLon, source, step }, decoded.flat());
}

// Measure a tiled copy against the NASA file once per session (see bodies.js).
async function calibrate(plan, data, body) {
  const id = plan.source.id;
  if (calibration.has(id)) return calibration.get(id);
  const ref = body.sources.find((s) => s.id === plan.source.calibrateAgainst);
  let points = [];
  for (const t of plan.tiles) {
    const d = data.get(t.key);
    if (!d) continue;
    points = points.concat(calibrationPoints(d, t, 5));
    if (points.length >= 5) break;
  }
  if (points.length < 3) {
    // Too flat or too close to the datum to measure here: try a known rugged tile.
    const probe = { z: 4, row: 11, col: 2, key: "probe" };
    const d = await cachedTile(tileUrl(plan.source.url, probe), fetchEsriTile);
    if (d) points = calibrationPoints(d, probe, 5);
  }
  const pairs = await Promise.all(
    points.map(async (p) => {
      const offset = stripPixelOffset(ref, p.lat, p.lon);
      const res = await fetchWithTimeout(ref.url, { headers: { Range: `bytes=${offset}-${offset + 1}` } });
      if (res.status !== 206) throw new Error("the reference file refused a range request");
      const raw = new DataView(await res.arrayBuffer()).getInt16(0, true);
      return [p.value, raw * ref.scale];
    }),
  );
  const ratio = ratioFromPairs(pairs);
  if (!ratio) throw new Error("its heights do not match the NASA file");
  const scale = 1 / ratio;
  calibration.set(id, scale);
  return scale;
}
