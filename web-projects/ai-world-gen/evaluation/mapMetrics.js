// The rules a good map follows, and the numbers that say how well one does.
//
// Three specifications, each with a few deterministic metrics computed from
// the finished grid and its vocabulary (ADR 0005). Every metric is a number
// from 0 (the rule is broken everywhere) to 1 (the rule holds everywhere), or
// null when the map gives the metric nothing to judge (no barrier type, no
// path type). A null is not sent to Galtea, so it neither helps nor hurts.
//
// The same names are used here, in `evaluate.py` and in the Galtea product,
// so a score in the dashboard can be traced back to one function below.

import { isRouteType } from "../cellDecision.js";
import { getCell } from "../grid.js";
import { analyseReachability } from "../reachability.js";
import { glyphFor } from "../tileStyles.js";
import { typeById } from "../vocabulary.js";

export const SPECIFICATIONS = [
  {
    id: "structures",
    name: "Barriers form structures, not debris",
    description:
      "Wall, fence, hull and other barrier cells belong to a structure: a building, an enclosure, a line of trees. " +
      "A barrier cell standing alone in open ground, with no barrier next to it, is debris the model placed without context. " +
      "The share of barrier cells should also stay in a healthy range: a map that is almost all wall or has no wall at all is not a place.",
  },
  {
    id: "paths",
    name: "Paths form continuous routes",
    description:
      "Path, road, street, corridor and similar cells form continuous lines that join places. " +
      "A path cell with no path neighbour is a dot, not a route, and a map whose paths split into many small networks does not lead anywhere.",
  },
  {
    id: "reachability",
    name: "Every walkable area is reachable, and the map is playable",
    description:
      "All walkable cells connect into one region that a player could walk; a room sealed off by barriers is a broken map. " +
      "The walkable share stays in a playable range, the map uses a fair part of the vocabulary rather than two types, " +
      "and every cell was decided by the model rather than by a fallback.",
  },
];

/** Every metric, with the specification it serves. Names are stable: they are the metric names in Galtea. */
export const METRICS = [
  { name: "barrier-not-isolated", specificationId: "structures", description: "Share of barrier cells that touch at least one other barrier cell (4-neighbours). 1 means no lone wall anywhere." },
  { name: "barrier-in-structure", specificationId: "structures", description: "Share of barrier cells that belong to a connected barrier group of 3 or more cells." },
  { name: "barrier-share-in-range", specificationId: "structures", description: "1 when barriers cover 10% to 45% of the map, falling to 0 at 0% or 70%." },
  { name: "path-not-isolated", specificationId: "paths", description: "Share of path cells that touch at least one other path cell (4-neighbours)." },
  { name: "path-in-largest-network", specificationId: "paths", description: "Share of path cells that belong to the largest connected path network." },
  { name: "path-continuity", specificationId: "paths", description: "Share of path cells with two or more path neighbours, that is, the inside of a line rather than a dot or an end." },
  { name: "walkable-reachable-share", specificationId: "reachability", description: "Share of walkable cells inside the largest walkable region." },
  { name: "single-walkable-region", specificationId: "reachability", description: "1 divided by the number of separate walkable regions. 1 means one connected world." },
  { name: "walkable-share-in-range", specificationId: "reachability", description: "1 when 40% to 90% of the cells are walkable, falling to 0 at 15% or 100%." },
  { name: "vocabulary-coverage", specificationId: "reachability", description: "Share of the vocabulary's types that appear on the map at least once." },
  { name: "model-answered", specificationId: "reachability", description: "Share of cells decided by the model rather than filled by a fallback after a failed call." },
];

export function metricsForSpecification(specificationId) {
  return METRICS.filter((one) => one.specificationId === specificationId);
}

/** Whether a vocabulary type is a route. One definition, shared with the per-cell hints in cellDecision.js. */
export function isPathType(type) {
  return isRouteType(type);
}

function isBarrierType(type) {
  return Boolean(type && type.isBarrier);
}

const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** The cells whose type passes `predicate`, and their 4-connected groups. */
function groups(grid, vocabulary, predicate) {
  const member = new Array(grid.width * grid.height).fill(false);
  const cells = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const cell = getCell(grid, x, y);
      if (cell && predicate(typeById(vocabulary, cell.typeId))) {
        member[y * grid.width + x] = true;
        cells.push({ x, y });
      }
    }
  }
  const neighbourCount = (x, y) =>
    STEPS.filter(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < grid.width && ny < grid.height && member[ny * grid.width + nx];
    }).length;
  const seen = new Array(member.length).fill(false);
  const sizes = [];
  const groupOf = new Map();
  for (const start of cells) {
    const startIndex = start.y * grid.width + start.x;
    if (seen[startIndex]) continue;
    const queue = [start];
    seen[startIndex] = true;
    let size = 0;
    const groupId = sizes.length;
    while (queue.length > 0) {
      const { x, y } = queue.shift();
      size += 1;
      groupOf.set(`${x},${y}`, groupId);
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
        const index = ny * grid.width + nx;
        if (member[index] && !seen[index]) {
          seen[index] = true;
          queue.push({ x: nx, y: ny });
        }
      }
    }
    sizes.push(size);
  }
  return { cells, neighbourCount, sizes, groupOf };
}

/** 1 inside [low, high], falling in a straight line to 0 at `zeroLow` and `zeroHigh`. */
function inRange(value, zeroLow, low, high, zeroHigh) {
  if (value >= low && value <= high) return 1;
  if (value <= zeroLow || value >= zeroHigh) return 0;
  if (value < low) return (value - zeroLow) / (low - zeroLow);
  return (zeroHigh - value) / (zeroHigh - high);
}

const share = (part, whole) => (whole === 0 ? null : part / whole);

/**
 * Every metric for one finished map.
 * @param {import("../grid.js").Grid} grid
 * @param {object} vocabulary
 * @param {{fallbackCount: number}} run what the generation loop reported
 * @returns {Record<string, number|null>} metric name -> score, or null when there is nothing to judge
 */
export function scoreMap(grid, vocabulary, run) {
  const total = grid.width * grid.height;
  const decided = grid.cells.filter((cell) => cell !== null).length;

  const barriers = groups(grid, vocabulary, isBarrierType);
  const lonelyBarriers = barriers.cells.filter((one) => barriers.neighbourCount(one.x, one.y) === 0).length;
  const inStructure = barriers.cells.filter((one) => barriers.sizes[barriers.groupOf.get(`${one.x},${one.y}`)] >= 3).length;

  const paths = groups(grid, vocabulary, isPathType);
  const hasPathType = vocabulary.elements.some(isPathType);
  const lonelyPaths = paths.cells.filter((one) => paths.neighbourCount(one.x, one.y) === 0).length;
  const continuous = paths.cells.filter((one) => paths.neighbourCount(one.x, one.y) >= 2).length;
  const largestPath = Math.max(0, ...paths.sizes);

  const reach = analyseReachability(grid, vocabulary);
  const usedTypes = new Set(grid.cells.filter(Boolean).map((cell) => cell.typeId));

  return {
    "barrier-not-isolated": barriers.cells.length === 0 ? null : 1 - lonelyBarriers / barriers.cells.length,
    "barrier-in-structure": share(inStructure, barriers.cells.length),
    "barrier-share-in-range": inRange(barriers.cells.length / total, 0, 0.1, 0.45, 0.7),
    "path-not-isolated": !hasPathType || paths.cells.length === 0 ? null : 1 - lonelyPaths / paths.cells.length,
    "path-in-largest-network": !hasPathType ? null : share(largestPath, paths.cells.length),
    "path-continuity": !hasPathType ? null : share(continuous, paths.cells.length),
    "walkable-reachable-share": share(reach.largestRegion, reach.walkableCount),
    "single-walkable-region": reach.regions.length === 0 ? null : 1 / reach.regions.length,
    "walkable-share-in-range": inRange(reach.walkableCount / total, 0.15, 0.4, 0.9, 1.0001),
    "vocabulary-coverage": share(usedTypes.size, vocabulary.elements.length),
    "model-answered": decided === 0 ? null : 1 - Math.min(decided, run?.fallbackCount ?? 0) / decided,
  };
}

/**
 * The map as text: one roguelike glyph per cell, then a legend. This is what
 * a person, or a judge model, reads in the Galtea dashboard.
 */
export function renderAscii(grid, vocabulary) {
  const rows = [];
  for (let y = 0; y < grid.height; y += 1) {
    let row = "";
    for (let x = 0; x < grid.width; x += 1) {
      const cell = getCell(grid, x, y);
      row += cell ? glyphFor(typeById(vocabulary, cell.typeId)?.visualTag ?? "unknown").glyph : "·";
    }
    rows.push(row);
  }
  const legend = vocabulary.elements.map((type) => `${glyphFor(type.visualTag).glyph} ${type.label}`);
  return [...rows, "", ...legend].join("\n");
}
