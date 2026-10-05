// From ground heights in metres to print heights in mm.
//
// The grid is `nx` x `ny` points, row by row from the south-west corner.
// `inside` marks the points inside the print outline; only those decide the
// lowest and highest point, so the margin around the outline cannot change
// the scale of the model.

import { curvatureDrop } from "./geo.js";

/**
 * Fill missing heights (NaN) from their neighbours, in place.
 * @returns {number} how many points were filled
 */
export function fillGaps(h, nx, ny) {
  let missing = 0;
  for (let i = 0; i < h.length; i++) if (Number.isNaN(h[i])) missing++;
  if (missing === 0) return 0;
  if (missing === h.length) throw new Error("No height data for this area");
  const filled = missing;
  while (missing > 0) {
    const next = Float32Array.from(h);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!Number.isNaN(h[k])) continue;
        let sum = 0;
        let n = 0;
        if (i > 0 && !Number.isNaN(h[k - 1])) (sum += h[k - 1]), n++;
        if (i < nx - 1 && !Number.isNaN(h[k + 1])) (sum += h[k + 1]), n++;
        if (j > 0 && !Number.isNaN(h[k - nx])) (sum += h[k - nx]), n++;
        if (j < ny - 1 && !Number.isNaN(h[k + nx])) (sum += h[k + nx]), n++;
        if (n > 0) {
          next[k] = sum / n;
          missing--;
        }
      }
    }
    h.set(next);
  }
  return filled;
}

/**
 * Which points are under water at sea level `level`.
 * "all" floods every point below the level. "connected" floods only water
 * that reaches the edge of the print (diagonal steps count, so a coastline
 * one pixel thin does not wall off the sea), so a basin below sea level that
 * the sea cannot reach (the Dead Sea, the Caspian depression) stays dry.
 * In "connected" mode, an enclosed pocket of fewer than `minPocket` points is
 * flooded too: at that size it is noise in the data at the coast, not a basin.
 * @returns {Uint8Array} 1 for water
 */
export function floodSea(h, nx, ny, inside, level, mode = "all", minPocket = 0) {
  const water = new Uint8Array(h.length);
  if (mode === "all") {
    for (let k = 0; k < h.length; k++) water[k] = h[k] < level ? 1 : 0;
    return water;
  }
  const queue = new Int32Array(h.length);
  const spread = (seeds, mark) => {
    let head = 0;
    let tail = 0;
    for (const k of seeds) queue[tail++] = k;
    while (head < tail) {
      const k = queue[head++];
      const i = k % nx;
      const j = (k - i) / nx;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= ny) continue;
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          if ((di === 0 && dj === 0) || ii < 0 || ii >= nx) continue;
          const m = jj * nx + ii;
          if (!mark[m] && h[m] < level) {
            mark[m] = 1;
            queue[tail++] = m;
          }
        }
      }
    }
    return tail;
  };
  const seeds = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const edge = !inside[k] || i === 0 || j === 0 || i === nx - 1 || j === ny - 1;
      if (edge && h[k] < level) {
        water[k] = 1;
        seeds.push(k);
      }
    }
  }
  spread(seeds, water);
  if (minPocket > 0) {
    const seen = new Uint8Array(h.length);
    for (let k = 0; k < h.length; k++) {
      if (water[k] || seen[k] || !(h[k] < level)) continue;
      seen[k] = 1;
      const size = spread([k], seen);
      if (size < minPocket) for (let q = 0; q < size; q++) water[queue[q]] = 1;
    }
  }
  return water;
}

/**
 * Print heights in mm.
 * @param {object} o
 * @param {Float32Array} o.elev ground heights, metres
 * @param {Uint8Array} o.inside 1 inside the outline
 * @param {number} o.mmPerMetre the horizontal scale of the model
 * @param {"relief"|"exaggeration"} o.mode how the vertical scale is set
 * @param {number} o.reliefMm in relief mode: lowest to highest point, in mm
 * @param {number} o.exaggeration in exaggeration mode: vertical / horizontal scale
 * @param {number} o.baseMm solid thickness under the lowest point
 * @param {{on:boolean, level:number, flood:string, stepMm:number, minPocket?:number}|null} o.sea
 * @param {Float32Array|null} o.groundDistance metres from the centre, when the
 *   model keeps the curve of the globe
 * @param {number} o.radius body radius, metres
 */
export function buildHeights(o) {
  const { elev, nx, ny, inside, mmPerMetre, baseMm } = o;
  const n = elev.length;
  const sea = o.sea?.on ? o.sea : null;
  const water = sea ? floodSea(elev, nx, ny, inside, sea.level, sea.flood, sea.minPocket ?? 0) : null;
  const eff = new Float32Array(n);
  let lo = Infinity;
  let hi = -Infinity;
  let minM = Infinity;
  let maxM = -Infinity;
  let anyWater = false;
  for (let k = 0; k < n; k++) {
    eff[k] = water && water[k] ? sea.level : elev[k];
    if (!inside[k]) continue;
    if (eff[k] < lo) lo = eff[k];
    if (eff[k] > hi) hi = eff[k];
    if (elev[k] < minM) minM = elev[k];
    if (elev[k] > maxM) maxM = elev[k];
    if (water && water[k]) anyWater = true;
  }
  const range = hi - lo;
  let k = 0;
  if (o.mode === "exaggeration") k = o.exaggeration * mmPerMetre;
  else k = range > 1e-6 ? o.reliefMm / range : 0;
  const step = anyWater ? Math.max(0, sea.stepMm ?? 0) : 0;
  const z = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    z[p] = baseMm + (eff[p] - lo) * k + (water && !water[p] ? step : 0);
  }
  let curved = false;
  if (o.groundDistance) {
    curved = true;
    let low = Infinity;
    for (let p = 0; p < n; p++) {
      z[p] -= curvatureDrop(o.groundDistance[p], o.radius) * mmPerMetre;
      if (inside[p] && z[p] < low) low = z[p];
    }
    const lift = baseMm - low;
    for (let p = 0; p < n; p++) z[p] += lift;
  }
  let top = -Infinity;
  let bottom = Infinity;
  for (let p = 0; p < n; p++) {
    if (!inside[p]) continue;
    if (z[p] > top) top = z[p];
    if (z[p] < bottom) bottom = z[p];
  }
  return {
    z,
    water,
    stats: {
      minM,
      maxM,
      exaggeration: mmPerMetre > 0 ? k / mmPerMetre : 0,
      reliefMm: top - bottom,
      topMm: top,
      seaZ: anyWater && !curved ? baseMm + (sea.level - lo) * k : null,
      seaStepMm: step,
      lowM: lo,
      verticalMmPerMetre: k,
      anyWater,
      curved,
    },
  };
}

/** Lowest and highest print height along the outline. */
export function edgeHeights(z, inside, nx, ny) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 1; j < ny - 1; j++) {
    for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i;
      if (!inside[k]) continue;
      if (inside[k - 1] && inside[k + 1] && inside[k - nx] && inside[k + nx]) continue;
      if (z[k] < lo) lo = z[k];
      if (z[k] > hi) hi = z[k];
    }
  }
  return { min: lo, max: hi };
}
