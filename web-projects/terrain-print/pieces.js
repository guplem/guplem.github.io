// Splitting a model into pieces: a jigsaw puzzle, or a few large pieces that
// each fit the printer bed.
//
// The model is cut along a grid of `cols` x `rows` cells. Each cut between
// two cells is straight, or carries one classic jigsaw knob that locks the
// two pieces together. A knob is a region of one cell that belongs to its
// neighbour; so the piece a point belongs to is "its grid cell, unless it
// sits inside a knob". The mesher then reads, for every grid point, which
// piece it belongs to and how far it is from the nearest cut.
//
// Cells at the rim of a round or hexagonal outline can be slivers. A cell
// with less than `minFraction` of a full cell inside the outline joins its
// largest neighbour, so no piece is too small to print or to hold.
//
// The random choices (which way each knob points, its exact size and place)
// come from a seeded generator, so the same seed gives the same puzzle.

import { pointInPolygon } from "./outline.js";

/** mulberry32: a small, fast, seeded random generator. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Columns and rows for about `count` pieces of a nearly square shape. */
export function gridForCount(width, height, count) {
  const cols = Math.max(1, Math.round(Math.sqrt((count * width) / height)));
  const rows = Math.max(1, Math.round(count / cols));
  return { cols, rows };
}

/**
 * The fewest pieces that each fit the bed (turned 90 degrees if that helps).
 * @param {number} reach extra mm a piece may reach past its cell (its knobs)
 */
export function gridForBed(width, height, bed, margin = 5, reach = 0) {
  const bw = bed.width - 2 * margin;
  const bh = bed.height - 2 * margin;
  const fits = (w, h) => (w <= bw && h <= bh) || (w <= bh && h <= bw);
  let best = null;
  for (let cols = 1; cols <= 24; cols++) {
    for (let rows = 1; rows <= 24; rows++) {
      const cw = width / cols + (cols > 1 ? 2 * reach : 0);
      const ch = height / rows + (rows > 1 ? 2 * reach : 0);
      if (!fits(cw, ch)) continue;
      const n = cols * rows;
      const squareness = Math.abs(Math.log(cw / ch));
      if (!best || n < best.n || (n === best.n && squareness < best.squareness)) best = { cols, rows, n, squareness };
    }
  }
  return best ? { cols: best.cols, rows: best.rows } : null;
}

// Knob proportions, in units of the knob scale S (the shorter cell side).
// The limits keep any two knobs of one cell apart: a knob spans at most
// 0.34..0.66 along its edge and reaches at most 0.33 into the next cell.
const KNOB = { neckBase: 0.09, neckTop: 0.075, radius: [0.115, 0.13], height: [0.19, 0.2], shift: 0.03 };

/** How far (in units of S) a knob reaches into the next cell, at most. */
export const KNOB_REACH = KNOB.height[1] + KNOB.radius[1];

/**
 * The knob of one edge, from P to Q, pushing towards `normal`.
 * @returns {{curve:number[][], region:number[][]}} the cut from the left base
 *   point to the right one, and the knob's own closed region
 */
export function knobShape(P, Q, normal, S, rand) {
  const dx = Q[0] - P[0];
  const dy = Q[1] - P[1];
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const centre = L / 2 + (rand() * 2 - 1) * KNOB.shift * S;
  const r = (KNOB.radius[0] + rand() * (KNOB.radius[1] - KNOB.radius[0])) * S;
  const hc = (KNOB.height[0] + rand() * (KNOB.height[1] - KNOB.height[0])) * S;
  const wb = KNOB.neckBase * S;
  const wt = KNOB.neckTop * S;
  const at = (u, v) => [P[0] + ux * u + normal[0] * v, P[1] + uy * u + normal[1] * v];
  const a = Math.acos(wt / r);
  const curve = [at(centre - wb, 0)];
  // From the lower-left point of the head, over the top, to the lower right.
  const from = a - Math.PI;
  const to = -a - 2 * Math.PI;
  const steps = Math.max(24, Math.ceil(((from - to) * r) / 0.25));
  for (let s = 0; s <= steps; s++) {
    const t = from + ((to - from) * s) / steps;
    curve.push(at(centre + r * Math.cos(t), hc + r * Math.sin(t)));
  }
  curve.push(at(centre + wb, 0));
  return { curve, region: curve.map((p) => [...p]) };
}

/**
 * Build the cut plan.
 * @param {object} o
 * @param {number} o.width, o.height model size, mm (centred on 0, 0)
 * @param {number} o.cols, o.rows
 * @param {"knob"|"straight"} o.joint
 * @param {number} o.seed
 * @param {(x:number, y:number) => number} o.outlineDistance positive inside
 * @param {number} [o.maxKnob=Infinity] largest knob scale, mm
 * @param {number} [o.minFraction=0.3]
 */
export function planPieces(o) {
  const { width, height, cols, rows } = o;
  const cw = width / cols;
  const ch = height / rows;
  const x0 = -width / 2;
  const y0 = -height / 2;
  const n = cols * rows;
  const cellIndex = (c, r) => r * cols + c;
  const rect = (c, r) => [x0 + c * cw, y0 + r * ch, x0 + (c + 1) * cw, y0 + (r + 1) * ch];

  // How much of each cell lies inside the outline (sampled).
  const SAMPLES = 16;
  const fraction = new Float64Array(n);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [ax, ay] = rect(c, r);
      let count = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          if (o.outlineDistance(ax + ((sx + 0.5) * cw) / SAMPLES, ay + ((sy + 0.5) * ch) / SAMPLES) > 0) count++;
        }
      }
      fraction[cellIndex(c, r)] = count / (SAMPLES * SAMPLES);
    }
  }

  // Merge small cells into their largest neighbour (union-find).
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const groupArea = Float64Array.from(fraction);
  const neighbours = (i) => {
    const c = i % cols;
    const r = (i - c) / cols;
    const out = [];
    if (c > 0) out.push(i - 1);
    if (c < cols - 1) out.push(i + 1);
    if (r > 0) out.push(i - cols);
    if (r < rows - 1) out.push(i + cols);
    return out;
  };
  const minFraction = o.minFraction ?? 0.3;
  const order = [...Array(n).keys()].filter((i) => fraction[i] > 0).sort((a, b) => fraction[a] - fraction[b]);
  for (const i of order) {
    if (groupArea[find(i)] >= minFraction) continue;
    let best = -1;
    for (const m of neighbours(i)) {
      if (fraction[m] <= 0 || find(m) === find(i)) continue;
      if (best < 0 || groupArea[find(m)] > groupArea[find(best)]) best = m;
    }
    if (best < 0) continue;
    const a = find(i);
    const b = find(best);
    parent[a] = b;
    groupArea[b] += groupArea[a];
  }
  // Cells with nothing inside join any neighbour that has something, so a
  // sliver the sampling missed still belongs to a piece.
  const empty = [...Array(n).keys()].filter((i) => fraction[i] <= 0);
  for (let pass = 0; pass < 3; pass++) {
    for (const i of empty) {
      if (find(i) !== i || groupArea[i] > 0) continue;
      const m = neighbours(i).find((k) => groupArea[find(k)] > 0);
      if (m !== undefined) parent[i] = find(m);
    }
  }

  // Number the pieces in reading order: top row first, left to right.
  const pieceOfRoot = new Map();
  const cellPiece = new Int32Array(n).fill(-1);
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const i = cellIndex(c, r);
      const root = find(i);
      if (groupArea[root] <= 0) continue;
      if (!pieceOfRoot.has(root)) pieceOfRoot.set(root, pieceOfRoot.size);
      cellPiece[i] = pieceOfRoot.get(root);
    }
  }
  const pieceCount = pieceOfRoot.size;

  // Cuts between cells of different pieces, with their knobs.
  const rand = seededRandom(o.seed ?? 1);
  const S = Math.min(cw, ch, o.maxKnob ?? Infinity);
  const cuts = [];
  const knobsInto = Array.from({ length: n }, () => []);
  const boxes = Array.from({ length: pieceCount }, () => [Infinity, Infinity, -Infinity, -Infinity]);
  for (let i = 0; i < n; i++) {
    const p = cellPiece[i];
    if (p < 0) continue;
    const c = i % cols;
    const r = (i - c) / cols;
    grow(boxes[p], rect(c, r));
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = cellIndex(c, r);
      for (const [j, P, Q, normal] of [
        c < cols - 1 ? [i + 1, [x0 + (c + 1) * cw, y0 + r * ch], [x0 + (c + 1) * cw, y0 + (r + 1) * ch], [1, 0]] : null,
        r < rows - 1 ? [i + cols, [x0 + c * cw, y0 + (r + 1) * ch], [x0 + (c + 1) * cw, y0 + (r + 1) * ch], [0, 1]] : null,
      ].filter(Boolean)) {
        const pa = cellPiece[i];
        const pb = cellPiece[j];
        // Draw the random numbers for every edge, used or not, so that one
        // merge does not reshuffle every knob after it.
        const flip = rand() < 0.5;
        const knobRand = [rand(), rand(), rand()];
        if (pa < 0 || pb < 0 || pa === pb) continue;
        let points = [P, Q];
        if (o.joint === "knob") {
          const dir = flip ? [-normal[0], -normal[1]] : normal;
          let k = 0;
          const knob = knobShape(P, Q, dir, S, () => knobRand[k++ % 3]);
          if (knobFits(knob, o.outlineDistance, S)) {
            points = [P, ...knob.curve, Q];
            const giver = flip ? j : i;
            const taker = flip ? i : j;
            knobsInto[taker].push({ region: knob.region, box: bounds(knob.region), piece: cellPiece[giver] });
            grow(boxes[cellPiece[giver]], bounds(knob.region));
          }
        }
        cuts.push(points);
      }
    }
  }

  /** The piece a model point belongs to, or -1 outside every piece. */
  function pieceAt(x, y) {
    let c = Math.floor((x - x0) / cw);
    let r = Math.floor((y - y0) / ch);
    c = Math.max(0, Math.min(cols - 1, c));
    r = Math.max(0, Math.min(rows - 1, r));
    const i = cellIndex(c, r);
    for (const k of knobsInto[i]) {
      if (x < k.box[0] || x > k.box[2] || y < k.box[1] || y > k.box[3]) continue;
      if (pointInPolygon(x, y, k.region)) return k.piece;
    }
    return cellPiece[i];
  }

  return { cols, rows, pieceCount, cuts, pieceAt, boxes, cellPiece, fraction };
}

// A knob is used only where all of it is well inside the outline; at the rim
// a straight cut is cleaner than a knob cut in half.
function knobFits(knob, outlineDistance, S) {
  const margin = Math.max(1, 0.05 * S);
  return knob.region.every(([x, y]) => outlineDistance(x, y) > margin);
}

function bounds(points) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) grow(b, [x, y, x, y]);
  return b;
}

function grow(b, r) {
  b[0] = Math.min(b[0], r[0]);
  b[1] = Math.min(b[1], r[1]);
  b[2] = Math.max(b[2], r[2]);
  b[3] = Math.max(b[3], r[3]);
}

/**
 * Distance from every grid point to the nearest cut, capped at `band`.
 * Exact within the band, which is the only place the mesher reads it.
 * @param {number[][][]} cuts polylines
 * @returns {Float32Array}
 */
export function cutDistance(cuts, grid, band) {
  const { nx, ny, x0, y0, d } = grid;
  const out = new Float32Array(nx * ny).fill(band);
  for (const line of cuts) {
    for (let s = 0; s + 1 < line.length; s++) {
      const [ax, ay] = line[s];
      const [bx, by] = line[s + 1];
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - band - x0) / d));
      const i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx) + band - x0) / d));
      const j0 = Math.max(0, Math.floor((Math.min(ay, by) - band - y0) / d));
      const j1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by) + band - y0) / d));
      const vx = bx - ax;
      const vy = by - ay;
      const vv = vx * vx + vy * vy || 1e-12;
      for (let j = j0; j <= j1; j++) {
        const py = y0 + j * d;
        for (let i = i0; i <= i1; i++) {
          const px = x0 + i * d;
          let t = ((px - ax) * vx + (py - ay) * vy) / vv;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dist = Math.hypot(px - ax - t * vx, py - ay - t * vy);
          const k = j * nx + i;
          if (dist < out[k]) out[k] = dist;
        }
      }
    }
  }
  return out;
}
