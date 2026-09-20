// The rules a good map follows, and the numbers that say how well one does.
//
// Four specifications, each with a few deterministic metrics computed from
// the finished grid and its vocabulary (ADR 0005). The fourth, coherence, was
// added after v4 from what a person sees first when a generated map sits next
// to a hand-drawn one: doors in walls, walls one cell thick around a room,
// ground in patches, things sprinkled on it. Every metric is a number
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
  {
    id: "coherence",
    name: "A place reads as a place",
    description:
      "The map reads as the place it describes, the way a hand-drawn map does. Doors sit in walls, not in open ground. " +
      "Walls are outlines one cell thick around an interior, not filled blocks. At least one room is enclosed. " +
      "Ground types spread in patches of several cells, not as confetti. Interactable things (people, objects, doors) are sprinkled over the map, neither absent nor heaped.",
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
  { name: "path-share-in-range", specificationId: "paths", description: "1 when paths cover 8% to 30% of the map, falling to 0 at 0% or 60%. A map that is all corridor is not a route network." },
  { name: "walkable-reachable-share", specificationId: "reachability", description: "Share of walkable cells inside the largest walkable region." },
  { name: "single-walkable-region", specificationId: "reachability", description: "1 divided by the number of separate walkable regions. 1 means one connected world." },
  { name: "walkable-share-in-range", specificationId: "reachability", description: "1 when 40% to 90% of the cells are walkable, falling to 0 at 15% or 100%." },
  { name: "vocabulary-coverage", specificationId: "reachability", description: "Share of the vocabulary's types that appear on the map at least once." },
  { name: "model-answered", specificationId: "reachability", description: "Share of cells decided by the model rather than filled by a fallback after a failed call." },
  { name: "door-in-wall", specificationId: "coherence", description: "Share of door cells (door, hatch, arch, gate tags) with barrier cells on two opposite sides, that is, set into a wall." },
  { name: "barrier-outline", specificationId: "coherence", description: "Share of barrier cells with at least one non-barrier 4-neighbour. A barrier buried among barriers on all four sides is a filled block, not a wall." },
  { name: "enclosed-room-exists", specificationId: "coherence", description: "1 when at least one non-barrier cell cannot be reached from the map edge without crossing a barrier or a door, that is, the map holds one enclosed room." },
  { name: "ground-in-patches", specificationId: "coherence", description: "Share of ground cells (walkable, not interactable, not a route) with two or more 4-neighbours of their own type. Ground in patches scores 1; confetti scores 0." },
  { name: "interactable-share-in-range", specificationId: "coherence", description: "1 when interactable cells are 4% to 20% of the map, falling to 0 at 0% or 40%." },
];

/**
 * Metrics a judge model scores in Galtea from the logged output, for the
 * questions code cannot answer. `evaluate.py` creates them as PARTIAL_PROMPT
 * metrics and asks Galtea to evaluate them; no score is computed here.
 */
export const JUDGE_METRICS = [
  {
    name: "reads-as-the-setting",
    specificationId: "coherence",
    description: "A judge model reads the map (one character per cell, then the legend, then the grid as JSON) and the setting, and scores how much the map reads as that place: elements where such a place would have them, one coherent whole rather than scattered tiles.",
    judgePrompt: [
      "The input is the seed of a tile map: a setting preset, a grid size, a generation order and a random seed.",
      "The output is the finished map: first one character per cell, rows from north to south, then a legend that gives each character's element, then a JSON object whose grid lists every cell's element type id in the same order.",
      "Judge how much the map reads as the place the preset names (a medieval village, a space station, a haunted mansion, a desert outpost, a cyberpunk block, a jungle temple, an arctic base, a Ghanaian market town).",
      "Reward: walls that outline rooms or buildings with a door set into the wall; floors inside those rooms; paths, roads or corridors that lead from door to door; water, fields, dunes or forest as one body rather than scattered cells; people and objects standing where such a place would have them; a whole that a reader could describe in one sentence as a place with a story.",
      "Punish: lone wall cells in open ground; doors with no wall on either side; indoor floor touching outdoor ground with no wall between; the same element flooding most of the map; things placed with no relation to what is next to them.",
      "Score 0 for a random scatter of tiles, 0.5 for a map with some structures that a reader still has to guess at, 1 for a map a person could have drawn on purpose.",
    ].join(" "),
  },
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

const DOOR_TAGS = new Set(["door", "wood-door", "metal-door", "hatch", "arch", "gate"]);

/** Whether a vocabulary type is a door, by its visual tag. */
export function isDoorType(type) {
  return Boolean(type && DOOR_TAGS.has(type.visualTag));
}

/** A ground type: something to stand on that is neither a thing nor a route. */
function isGroundType(type) {
  return Boolean(type && type.walkable && !type.isBarrier && !type.interactable && !isPathType(type));
}

/** Whether the cell at (x, y) passes `predicate`; a cell outside the grid or undecided does not. */
function cellIs(grid, vocabulary, x, y, predicate) {
  const cell = getCell(grid, x, y);
  return Boolean(cell && predicate(typeById(vocabulary, cell.typeId)));
}

/**
 * How many non-barrier cells the map edge cannot reach when barriers and
 * doors both block. Those cells are the inside of an enclosed room.
 */
function enclosedCells(grid, vocabulary) {
  const blocks = (type) => isBarrierType(type) || isDoorType(type);
  const open = new Array(grid.width * grid.height).fill(false);
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) open[y * grid.width + x] = !cellIs(grid, vocabulary, x, y, blocks);
  }
  const seen = new Array(open.length).fill(false);
  const queue = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const onEdge = x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1;
      const index = y * grid.width + x;
      if (onEdge && open[index] && !seen[index]) {
        seen[index] = true;
        queue.push(index);
      }
    }
  }
  while (queue.length > 0) {
    const index = queue.shift();
    const x = index % grid.width;
    const y = Math.floor(index / grid.width);
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      const next = ny * grid.width + nx;
      if (open[next] && !seen[next]) {
        seen[next] = true;
        queue.push(next);
      }
    }
  }
  return open.filter((isOpen, index) => isOpen && !seen[index]).length;
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

  const doors = groups(grid, vocabulary, isDoorType);
  const doorsInWalls = doors.cells.filter(({ x, y }) => {
    const barrier = (dx, dy) => cellIs(grid, vocabulary, x + dx, y + dy, isBarrierType);
    return (barrier(0, -1) && barrier(0, 1)) || (barrier(-1, 0) && barrier(1, 0));
  }).length;
  // Outside the map is open ground, so a wall along the map edge is an outline too.
  const outlineBarriers = barriers.cells.filter(({ x, y }) => STEPS.some(([dx, dy]) => !cellIs(grid, vocabulary, x + dx, y + dy, isBarrierType))).length;
  const grounds = groups(grid, vocabulary, isGroundType);
  const patched = grounds.cells.filter(({ x, y }) => {
    const own = getCell(grid, x, y).typeId;
    return STEPS.filter(([dx, dy]) => getCell(grid, x + dx, y + dy)?.typeId === own).length >= 2;
  }).length;
  const interactables = grid.cells.filter((cell) => cell && typeById(vocabulary, cell.typeId)?.interactable).length;

  return {
    "barrier-not-isolated": barriers.cells.length === 0 ? null : 1 - lonelyBarriers / barriers.cells.length,
    "barrier-in-structure": share(inStructure, barriers.cells.length),
    "barrier-share-in-range": inRange(barriers.cells.length / total, 0, 0.1, 0.45, 0.7),
    "path-not-isolated": !hasPathType || paths.cells.length === 0 ? null : 1 - lonelyPaths / paths.cells.length,
    "path-in-largest-network": !hasPathType ? null : share(largestPath, paths.cells.length),
    "path-continuity": !hasPathType ? null : share(continuous, paths.cells.length),
    "path-share-in-range": !hasPathType ? null : inRange(paths.cells.length / total, 0, 0.08, 0.3, 0.6),
    "walkable-reachable-share": share(reach.largestRegion, reach.walkableCount),
    "single-walkable-region": reach.regions.length === 0 ? null : 1 / reach.regions.length,
    "walkable-share-in-range": inRange(reach.walkableCount / total, 0.15, 0.4, 0.9, 1.0001),
    "vocabulary-coverage": share(usedTypes.size, vocabulary.elements.length),
    "model-answered": decided === 0 ? null : 1 - Math.min(decided, run?.fallbackCount ?? 0) / decided,
    "door-in-wall": share(doorsInWalls, doors.cells.length),
    "barrier-outline": share(outlineBarriers, barriers.cells.length),
    "enclosed-room-exists": enclosedCells(grid, vocabulary) > 0 ? 1 : 0,
    "ground-in-patches": share(patched, grounds.cells.length),
    "interactable-share-in-range": inRange(interactables / total, 0, 0.04, 0.2, 0.4),
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
