// Closed, printable solids from a grid.
//
// A solid is the region where a field F is positive. F lives on the same
// grid as the heights: points (i, j) at x = x0 + i * d, y = y0 + j * d. The
// mesher walks every grid cell (marching squares):
//   - a cell fully inside gives two top triangles;
//   - a cell the outline crosses gives the part of the cell inside, with the
//     crossing points placed on the cell edges by linear interpolation of F;
//   - every piece of outline inside a cell gives one wall quad, from z = 0
//     up to the top.
// The bottom is flat, so it is not meshed cell by cell: the outline loops are
// joined and filled by earcut, which needs only the outline points.
//
// A crossing point belongs to a cell edge, and both cells that share the edge
// compute it from the same two values in the same order. That is what makes
// the mesh watertight: every edge is used by exactly two triangles.

import earcut from "./vendor/earcut.js";

/**
 * @param {object} o
 * @param {{nx:number, ny:number, x0:number, y0:number, d:number}} o.grid
 * @param {{i0:number, j0:number, i1:number, j1:number}} o.window grid points to use, inclusive
 * @param {(k:number) => number} o.field F at grid point k (k = j * nx + i)
 * @param {Float32Array|null} o.top heights for a terrain top, by grid point
 * @param {number|null} o.flatTop the top height for a flat solid
 * @returns {{positions:Float32Array, indices:Uint32Array}|null} null when empty
 */
export function meshSolid(o) {
  const { grid, window: win } = o;
  const { nx, x0, y0, d } = grid;
  const W = win.i1 - win.i0 + 1;
  const H = win.j1 - win.j0 + 1;
  if (W < 2 || H < 2) return null;
  const flat = o.top == null;
  const zTopAt = (k) => (flat ? o.flatTop : o.top[k]);

  // Field on the window, with the window rim forced outside so every solid closes.
  const f = new Float64Array(W * H);
  let any = false;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const k = (win.j0 + j) * nx + win.i0 + i;
      let v = o.field(k);
      if (i === 0 || j === 0 || i === W - 1 || j === H - 1) v = Math.min(v, -1e-3);
      if (v === 0) v = -1e-9;
      f[j * W + i] = v;
      if (v > 0) any = true;
    }
  }
  if (!any) return null;

  const pos = [];
  const tris = [];
  const add = (x, y, z) => {
    pos.push(x, y, z);
    return pos.length / 3 - 1;
  };
  const cornerTop = new Int32Array(W * H).fill(-1);
  const hTop = new Int32Array(W * H).fill(-1);
  const vTop = new Int32Array(W * H).fill(-1);
  const hBot = new Int32Array(W * H).fill(-1);
  const vBot = new Int32Array(W * H).fill(-1);
  const gk = (i, j) => (win.j0 + j) * nx + win.i0 + i;
  const gx = (i) => x0 + (win.i0 + i) * d;
  const gy = (j) => y0 + (win.j0 + j) * d;

  function corner(i, j) {
    const w = j * W + i;
    if (cornerTop[w] < 0) cornerTop[w] = add(gx(i), gy(j), zTopAt(gk(i, j)));
    return cornerTop[w];
  }
  // Crossing on the edge from (i, j) to (i + 1, j) ("h") or to (i, j + 1) ("v").
  function crossing(kind, i, j) {
    const w = j * W + i;
    const topArr = kind === "h" ? hTop : vTop;
    const botArr = kind === "h" ? hBot : vBot;
    if (topArr[w] < 0) {
      const a = f[w];
      const b = kind === "h" ? f[w + 1] : f[w + W];
      let t = a / (a - b);
      t = Math.min(1 - 1e-6, Math.max(1e-6, t));
      const ka = gk(i, j);
      const kb = kind === "h" ? gk(i + 1, j) : gk(i, j + 1);
      const x = kind === "h" ? gx(i) + t * d : gx(i);
      const y = kind === "h" ? gy(j) : gy(j) + t * d;
      const z = flat ? o.flatTop : zTopAt(ka) + t * (zTopAt(kb) - zTopAt(ka));
      topArr[w] = add(x, y, z);
      botArr[w] = add(x, y, 0);
    }
    return { top: topArr[w], bot: botArr[w] };
  }

  const next = new Map(); // bottom id -> next bottom id along the outline
  const topOfBottom = new Map();

  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const c = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ];
      const inside = c.map(([a, b]) => f[b * W + a] > 0);
      if (!inside[0] && !inside[1] && !inside[2] && !inside[3]) continue;
      const edges = [
        ["h", i, j],
        ["v", i + 1, j],
        ["h", i, j + 1],
        ["v", i, j],
      ];
      const poly = []; // {top, bot (crossings only), cross}
      for (let e = 0; e < 4; e++) {
        if (inside[e]) poly.push({ top: flat ? -1 : corner(...c[e]), cross: false });
        if (inside[e] !== inside[(e + 1) % 4]) {
          const x = crossing(...edges[e]);
          poly.push({ top: x.top, bot: x.bot, cross: true });
        }
      }
      if (!flat) {
        for (let k = 1; k + 1 < poly.length; k++) tris.push(poly[0].top, poly[k].top, poly[k + 1].top);
      }
      for (let k = 0; k < poly.length; k++) {
        const p = poly[k];
        const q = poly[(k + 1) % poly.length];
        if (!p.cross || !q.cross) continue;
        tris.push(p.bot, q.bot, q.top, p.bot, q.top, p.top);
        next.set(p.bot, q.bot);
        topOfBottom.set(p.bot, p.top);
        topOfBottom.set(q.bot, q.top);
      }
    }
  }

  // Walk the outline loops.
  const loops = [];
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let v = start;
    while (!seen.has(v)) {
      seen.add(v);
      loop.push(v);
      v = next.get(v);
      if (v === undefined) throw new Error("Open outline loop");
    }
    loops.push(loop);
  }

  const capBottom = fillLoops(loops, pos, false);
  for (const t of capBottom) tris.push(...t);
  if (flat) {
    const topLoops = loops.map((l) => l.map((b) => topOfBottom.get(b)));
    const capTop = fillLoops(topLoops, pos, true);
    for (const t of capTop) tris.push(...t);
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(tris) };
}

function loopArea(loop, pos) {
  let a = 0;
  for (let k = 0; k < loop.length; k++) {
    const p = loop[k];
    const q = loop[(k + 1) % loop.length];
    a += pos[3 * p] * pos[3 * q + 1] - pos[3 * q] * pos[3 * p + 1];
  }
  return a / 2;
}

function insideLoop(x, y, loop, pos) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const xi = pos[3 * loop[i]];
    const yi = pos[3 * loop[i] + 1];
    const xj = pos[3 * loop[j]];
    const yj = pos[3 * loop[j] + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Fill outline loops with flat triangles: counter-clockwise loops are outer
 * rims, clockwise ones are holes. `up` sets which way the faces point.
 * @returns {number[][]} triangles as vertex id triples
 */
export function fillLoops(loops, pos, up) {
  const outers = [];
  const holes = [];
  for (const loop of loops) {
    const a = loopArea(loop, pos);
    if (Math.abs(a) < 1e-12) continue;
    (a > 0 ? outers : holes).push(loop);
  }
  outers.sort((p, q) => loopArea(p, pos) - loopArea(q, pos)); // smallest first
  const groups = outers.map((o) => ({ outer: o, holes: [] }));
  for (const h of holes) {
    const x = pos[3 * h[0]];
    const y = pos[3 * h[0] + 1];
    const g = groups.find((gr) => insideLoop(x, y, gr.outer, pos));
    if (g) g.holes.push(h);
  }
  const out = [];
  for (const g of groups) {
    const ids = [...g.outer];
    const holeIdx = [];
    for (const h of g.holes) {
      holeIdx.push(ids.length);
      ids.push(...h);
    }
    const flatXY = new Float64Array(ids.length * 2);
    ids.forEach((v, k) => {
      flatXY[2 * k] = pos[3 * v];
      flatXY[2 * k + 1] = pos[3 * v + 1];
    });
    const local = earcut(flatXY, holeIdx.length ? holeIdx : undefined);
    let triangles = [];
    for (let k = 0; k < local.length; k += 3) triangles.push([ids[local[k]], ids[local[k + 1]], ids[local[k + 2]]]);
    triangles = repairDropped(triangles, [g.outer, ...g.holes], pos);
    for (const t of triangles) {
      const ax = pos[3 * t[0]];
      const ay = pos[3 * t[0] + 1];
      const cross = (pos[3 * t[1]] - ax) * (pos[3 * t[2] + 1] - ay) - (pos[3 * t[1] + 1] - ay) * (pos[3 * t[2]] - ax);
      out.push(cross > 0 === up ? t : [t[0], t[2], t[1]]);
    }
  }
  return out;
}

/**
 * earcut skips points that lie exactly on a straight line between their
 * neighbours. A wall still ends at such a point, so the bottom must use it
 * too, or the mesh has a crack (a "T-junction"). This splits the triangle
 * over each skipped run so that every loop point is a corner again.
 */
export function repairDropped(triangles, loops, pos) {
  const used = new Set();
  for (const t of triangles) for (const v of t) used.add(v);
  const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  const edgeTri = new Map();
  const index = (ti) => {
    const t = triangles[ti];
    for (let e = 0; e < 3; e++) edgeTri.set(key(t[e], t[(e + 1) % 3]), ti);
  };
  let dirty = false;
  for (const loop of loops) if (loop.some((v) => !used.has(v))) dirty = true;
  if (!dirty) return triangles;
  triangles.forEach((_, ti) => index(ti));
  for (const loop of loops) {
    const n = loop.length;
    const firstKept = loop.findIndex((v) => used.has(v));
    if (firstKept < 0) continue;
    let a = firstKept;
    for (let step = 1; step <= n; step++) {
      const bIdx = (firstKept + step) % n;
      if (!used.has(loop[bIdx])) continue;
      const dropped = [];
      for (let m = (a + 1) % n; m !== bIdx; m = (m + 1) % n) dropped.push(loop[m]);
      if (dropped.length) {
        const va = loop[a];
        const vb = loop[bIdx];
        const ti = edgeTri.get(key(va, vb));
        if (ti === undefined) throw new Error("Cannot repair the bottom of a piece");
        const t = triangles[ti];
        const e = [0, 1, 2].find((q) => (t[q] === va && t[(q + 1) % 3] === vb) || (t[q] === vb && t[(q + 1) % 3] === va));
        const p = t[e];
        const q = t[(e + 1) % 3];
        const opposite = t[(e + 2) % 3];
        const chain = p === va ? [va, ...dropped, vb] : [vb, ...dropped.slice().reverse(), va];
        const fresh = [];
        for (let s = 0; s + 1 < chain.length; s++) fresh.push([chain[s], chain[s + 1], opposite]);
        triangles[ti] = fresh[0];
        index(ti);
        for (let s = 1; s < fresh.length; s++) {
          triangles.push(fresh[s]);
          index(triangles.length - 1);
        }
        for (const v of dropped) used.add(v);
        void q;
      }
      a = bIdx;
    }
  }
  return triangles;
}

/**
 * A flat-topped prism between two convex rings, for the frame:
 * the bottom of `outer` at z = 0, its wall up to `rimTop`, a ring top, the
 * inner wall down to `floorTop`, and the floor of `inner`.
 * `outer` and `inner` are counter-clockwise and have the same number of
 * points, each inner point facing its outer point.
 */
export function meshFrame(outer, inner, floorTop, rimTop) {
  const n = outer.length;
  const pos = [];
  const tris = [];
  const add = (x, y, z) => {
    pos.push(x, y, z);
    return pos.length / 3 - 1;
  };
  const ob = outer.map(([x, y]) => add(x, y, 0));
  const ot = outer.map(([x, y]) => add(x, y, rimTop));
  const it = inner.map(([x, y]) => add(x, y, rimTop));
  const ifl = inner.map(([x, y]) => add(x, y, floorTop));
  for (let k = 0; k < n; k++) {
    const m = (k + 1) % n;
    tris.push(ob[k], ob[m], ot[m], ob[k], ot[m], ot[k]); // outer wall, facing out
    tris.push(ot[k], ot[m], it[m], ot[k], it[m], it[k]); // ring top, facing up
    tris.push(it[k], it[m], ifl[m], it[k], ifl[m], ifl[k]); // inner wall, facing in
  }
  for (let k = 1; k + 1 < n; k++) {
    tris.push(ob[0], ob[k + 1], ob[k]); // bottom, facing down
    tris.push(ifl[0], ifl[k], ifl[k + 1]); // floor, facing up
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(tris) };
}

// ---------------------------------------------------------------------------
// Checks, used by the tests.

/**
 * Every edge used exactly twice, once in each direction: a closed,
 * consistently oriented surface.
 */
export function isWatertight(mesh) {
  const count = new Map();
  const ix = mesh.indices;
  for (let t = 0; t < ix.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = ix[t + e];
      const b = ix[t + ((e + 1) % 3)];
      const k = `${a},${b}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  for (const [k, c] of count) {
    if (c !== 1) return false;
    const [a, b] = k.split(",");
    if (count.get(`${b},${a}`) !== 1) return false;
  }
  return true;
}

/** Enclosed volume (positive for outward-facing triangles). */
export function meshVolume(mesh) {
  const p = mesh.positions;
  const ix = mesh.indices;
  let v = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const a = 3 * ix[t];
    const b = 3 * ix[t + 1];
    const c = 3 * ix[t + 2];
    v +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
      p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return v / 6;
}

/** Axis-aligned bounds: [minX, minY, minZ, maxX, maxY, maxZ]. */
export function meshBounds(mesh) {
  const p = mesh.positions;
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let k = 0; k < p.length; k += 3) {
    for (let a = 0; a < 3; a++) {
      if (p[k + a] < b[a]) b[a] = p[k + a];
      if (p[k + a] > b[a + 3]) b[a + 3] = p[k + a];
    }
  }
  return b;
}
