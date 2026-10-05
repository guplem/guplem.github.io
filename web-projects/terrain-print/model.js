// From a design and its ground heights to the parts a slicer prints.
//
// This is the whole pipeline after the download, and it is pure: the worker
// calls it with heights it has fetched, and the tests call it with made-up
// heights. The steps:
//   1. modelGeometry: the model's size in mm, the grid, and the scale.
//   2. groundPoints:  the latitude and longitude of every grid point.
//   3. buildModel:    print heights, the cut plan, one closed mesh per piece,
//                     and the frame.

import { BODIES } from "./bodies.js";
import { colourPlan } from "./colourPlan.js";
import { rotateClockwise, unprojectAzimuthal } from "./geo.js";
import { buildHeights, edgeHeights, fillGaps } from "./heights.js";
import { meshBounds, meshFrame, meshSolid } from "./mesher.js";
import { outlineDistance, outlinePolygon, shapeSize } from "./outline.js";
import { cutDistance, gridForBed, gridForCount, KNOB_REACH, planPieces } from "./pieces.js";
import { DETAILS, filamentHex, FRAME_FITS, GAPS } from "./settings.js";

/** Largest knob on a bed-sized split, mm: a big piece needs no bigger lock. */
export const BED_KNOB_MM = 30;
/** An enclosed dry pocket below sea level smaller than this (mm² of model) is data noise, and floods. */
export const MIN_POCKET_MM2 = 20;
/** Room kept free around a piece on the bed, mm. */
export const BED_MARGIN_MM = 5;

/** Size, grid and scale of a design. */
export function modelGeometry(s) {
  const { width, height } = shapeSize(s.shape, s.sizeMm);
  const d = DETAILS[s.detail]?.spacing ?? DETAILS.fine.spacing;
  // Two spare grid points beyond the outline on every side.
  const nx = Math.ceil(width / d) + 5;
  const ny = Math.ceil(height / d) + 5;
  const x0 = -((nx - 1) * d) / 2;
  const y0 = -((ny - 1) * d) / 2;
  const metresPerMm = (s.km * 1000) / s.sizeMm;
  return { width, height, d, nx, ny, x0, y0, metresPerMm, groundSpacing: d * metresPerMm };
}

/** Latitude, longitude and ground distance from the centre of every grid point. */
export function groundPoints(geom, s) {
  const body = BODIES[s.body];
  const n = geom.nx * geom.ny;
  const lats = new Float64Array(n);
  const lons = new Float64Array(n);
  const distance = new Float32Array(n);
  for (let j = 0; j < geom.ny; j++) {
    for (let i = 0; i < geom.nx; i++) {
      const k = j * geom.nx + i;
      const [gx, gy] = rotateClockwise((geom.x0 + i * geom.d) * geom.metresPerMm, (geom.y0 + j * geom.d) * geom.metresPerMm, s.rotation);
      const [lat, lon] = unprojectAzimuthal(s.lat, s.lon, gx, gy, body.radius);
      lats[k] = lat;
      lons[k] = lon;
      distance[k] = Math.hypot(gx, gy);
    }
  }
  return { lats, lons, distance };
}

/** The outline of the selection on the map, as [lat, lon] points. */
export function footprint(s, segments = 96) {
  const body = BODIES[s.body];
  const metresPerMm = (s.km * 1000) / s.sizeMm;
  return outlinePolygon(s.shape, s.sizeMm, 0, segments).map(([x, y]) => {
    const [gx, gy] = rotateClockwise(x * metresPerMm, y * metresPerMm, s.rotation);
    return unprojectAzimuthal(s.lat, s.lon, gx, gy, body.radius);
  });
}

/** Rows and columns of the split. */
export function splitGrid(s, geom, bed) {
  if (s.split === "puzzle") return gridForCount(geom.width, geom.height, s.pieces);
  if (s.split === "bed" && bed) {
    const reach = s.joint === "knob" ? KNOB_REACH * BED_KNOB_MM : 0;
    return gridForBed(geom.width, geom.height, bed, BED_MARGIN_MM, reach) ?? { cols: 1, rows: 1 };
  }
  return { cols: 1, rows: 1 };
}

/** Does a part of `w` x `h` mm fit the bed, turned if needed? */
export function fitsBed(w, h, bed) {
  const bw = bed.width - 2 * BED_MARGIN_MM;
  const bh = bed.height - 2 * BED_MARGIN_MM;
  return (w <= bw && h <= bh) || (w <= bh && h <= bw);
}

/**
 * Build every part.
 * @param {object} o
 * @param {object} o.settings the design
 * @param {object} o.geom from modelGeometry
 * @param {Float32Array} o.elev ground heights at every grid point (a copy: it is filled in place)
 * @param {Float32Array|null} o.distance ground distance from the centre (for the curve)
 * @param {{width:number, height:number}} o.bed the printer bed
 * @param {(done:number, total:number) => void} [o.onPiece]
 * @returns {{parts:object[], stats:object, grid:{cols:number, rows:number}, plan:object, warnings:string[]}}
 */
export function buildModel(o) {
  const { settings: s, geom, elev, bed } = o;
  const body = BODIES[s.body];
  const { nx, ny, x0, y0, d } = geom;
  const n = nx * ny;
  const sd = outlineDistance(s.shape, s.sizeMm);
  const outD = new Float32Array(n);
  const inside = new Uint8Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      outD[k] = sd(x0 + i * d, y0 + j * d);
      inside[k] = outD[k] > 0 ? 1 : 0;
    }
  }
  fillGaps(elev, nx, ny);
  const heights = buildHeights({
    elev,
    nx,
    ny,
    inside,
    mmPerMetre: 1 / geom.metresPerMm,
    mode: s.heightMode,
    reliefMm: s.reliefMm,
    exaggeration: s.exaggeration,
    baseMm: s.baseMm,
    sea: body.sea && s.seaOn
      ? { on: true, level: s.seaLevel, flood: s.flood, stepMm: s.coastStepMm, minPocket: Math.ceil(MIN_POCKET_MM2 / (d * d)) }
      : null,
    groundDistance: s.curvature ? o.distance : null,
    radius: body.radius,
  });
  const z = heights.z;
  const warnings = [];

  const grid = splitGrid(s, geom, bed);
  const multi = grid.cols * grid.rows > 1;
  const gap = GAPS[s.gap]?.mm ?? GAPS.standard.mm;
  let plan = null;
  let label = null;
  let dist = null;
  if (multi) {
    plan = planPieces({
      width: geom.width,
      height: geom.height,
      cols: grid.cols,
      rows: grid.rows,
      joint: s.joint,
      seed: s.seed,
      outlineDistance: sd,
      maxKnob: s.split === "bed" ? BED_KNOB_MM : Infinity,
    });
    label = new Int32Array(n);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) label[j * nx + i] = plan.pieceAt(x0 + i * d, y0 + j * d);
    dist = cutDistance(plan.cuts, geom, gap / 2 + 3 * d);
    const cell = Math.min(geom.width / grid.cols, geom.height / grid.rows);
    if (cell < 20) warnings.push(`Pieces are about ${Math.round(cell)} mm across. Below 20 mm they are hard to print and to hold; choose fewer pieces or a bigger model.`);
  }

  const pieceCount = plan ? plan.pieceCount : 1;
  const parts = [];
  const pad = 3 * d;
  for (let p = 0; p < pieceCount; p++) {
    let win = { i0: 0, j0: 0, i1: nx - 1, j1: ny - 1 };
    if (plan) {
      const [bx0, by0, bx1, by1] = plan.boxes[p];
      win = {
        i0: Math.max(0, Math.floor((bx0 - pad - x0) / d)),
        j0: Math.max(0, Math.floor((by0 - pad - y0) / d)),
        i1: Math.min(nx - 1, Math.ceil((bx1 + pad - x0) / d)),
        j1: Math.min(ny - 1, Math.ceil((by1 + pad - y0) / d)),
      };
    }
    const field = plan ? (k) => Math.min(outD[k], (label[k] === p ? dist[k] : -dist[k]) - gap / 2) : (k) => outD[k];
    const mesh = meshSolid({ grid: geom, window: win, field, top: z, flatTop: null });
    o.onPiece?.(p + 1, pieceCount);
    if (!mesh) continue;
    const name = pieceCount > 1 ? `Piece ${String(p + 1).padStart(2, "0")}` : "Terrain";
    parts.push({ name, kind: "piece", mesh, colour: filamentHex(s.terrainColour), bounds: meshBounds(mesh) });
  }

  const edge = edgeHeights(z, inside, nx, ny);
  if (s.frame === "tray") {
    const fit = FRAME_FITS[s.frameFit]?.mm ?? FRAME_FITS.standard.mm;
    const inner = outlinePolygon(s.shape, s.sizeMm, fit);
    const outer = outlinePolygon(s.shape, s.sizeMm, fit + s.borderMm);
    const rim = s.rimMode === "lowest" ? edge.min : s.rimMode === "highest" ? edge.max : s.rimMm;
    const mesh = meshFrame(outer, inner, s.floorMm, s.floorMm + Math.max(0.6, rim));
    parts.push({ name: "Frame", kind: "frame", mesh, colour: filamentHex(s.frameColour), bounds: meshBounds(mesh) });
  }

  for (const part of parts) {
    const b = part.bounds;
    if (!fitsBed(b[3] - b[0], b[4] - b[1], bed)) {
      warnings.push(
        part.kind === "frame"
          ? "The frame is bigger than the printer bed. Choose a smaller model, a thinner border, or no frame."
          : `${part.name} is bigger than the printer bed. Choose "Fit to the bed" under Pieces, or a smaller model.`,
      );
      break;
    }
  }

  const stats = { ...heights.stats, edgeMinMm: edge.min, edgeMaxMm: edge.max };
  return {
    parts,
    stats,
    grid,
    pieceCount,
    colours: colourPlan({ stats, settings: s }),
    warnings,
  };
}

/**
 * Where each part sits in the download. Pieces move apart from the centre so
 * that neighbours end up `spread` mm further apart than in the model, and a
 * slicer reads them as separate objects; the frame sits to the right.
 * @param {number} cell the size of one grid cell, mm
 */
export function layoutOffsets(parts, cell, spread = 4) {
  const pieces = parts.filter((p) => p.kind === "piece");
  const right = Math.max(...pieces.map((p) => p.bounds[3]));
  const k = pieces.length > 1 ? spread / cell : 0;
  return parts.map((part) => {
    if (part.kind !== "piece") return [right + (pieces.length > 1 ? spread * 3 : 0) - part.bounds[0] + 10, 0];
    const cx = (part.bounds[0] + part.bounds[3]) / 2;
    const cy = (part.bounds[1] + part.bounds[4]) / 2;
    return [cx * k, cy * k];
  });
}
