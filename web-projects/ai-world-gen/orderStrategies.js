// The order in which the cells are decided.
//
// One interface, `nextCoordinate(placed) -> {x, y} | null`, and five ways to
// answer it. `placed` is the Set of keys of every decided cell, and the answer
// is always a cell that is not in it. The interface takes the placed set rather
// than remembering its own progress, so a cell decided by hand, or loaded from
// a file, is simply never offered again.
//
// The order matters more than it looks. A cell is decided from its neighbours
// (ADR 0002), so the order decides which neighbours exist when: a spiral grows
// one coherent region from the middle, a random order forces early guesses
// with no context at all, and frontier growth is the middle ground.

import { cellKey } from "./grid.js";

/** Every strategy, in the order the setup screen lists them. Ids travel in links, so they never change. */
export const ORDER_STRATEGIES = [
  {
    id: "spiral",
    label: "Centre-out spiral",
    description: "Starts in the middle and spirals outward. One region grows steadily, so the map stays coherent.",
  },
  {
    id: "random",
    label: "Pure random",
    description: "Every cell in a shuffled order. Early cells have no neighbours, so the model guesses a lot.",
  },
  {
    id: "clustered",
    label: "Clustered",
    description: "Picks a random seed, fills a patch around it, then picks another seed. Makes distinct districts.",
  },
  {
    id: "branching",
    label: "Tree / branching",
    description: "A random walk that backs up when it hits a dead end. Grows corridors and branches.",
  },
  {
    id: "frontier",
    label: "Frontier growth",
    description: "Always picks a random cell next to what is already placed (Prim's style). Organic, blob-like growth.",
  },
];

export const DEFAULT_ORDER_ID = "spiral";

/** One of the ids above, whatever was asked for. */
export function readOrderId(value) {
  return ORDER_STRATEGIES.some((one) => one.id === value) ? value : DEFAULT_ORDER_ID;
}

const STEPS_4 = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const STEPS_8 = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

function allCoordinates(width, height) {
  const list = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) list.push({ x, y });
  return list;
}

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

/** The first coordinate of a fixed list that is not yet placed. */
function firstFree(list, placed) {
  return list.find((one) => !placed.has(cellKey(one.x, one.y))) ?? null;
}

function freeNeighbours(width, height, placed, at, steps) {
  const free = [];
  for (const [dx, dy] of steps) {
    const x = at.x + dx;
    const y = at.y + dy;
    if (x >= 0 && y >= 0 && x < width && y < height && !placed.has(cellKey(x, y))) free.push({ x, y });
  }
  return free;
}

/** Centre first, then rings outward, each ring in reading order. */
function spiralList(width, height) {
  const cx = Math.floor((width - 1) / 2);
  const cy = Math.floor((height - 1) / 2);
  return allCoordinates(width, height).sort((a, b) => {
    const ra = Math.max(Math.abs(a.x - cx), Math.abs(a.y - cy));
    const rb = Math.max(Math.abs(b.x - cx), Math.abs(b.y - cy));
    if (ra !== rb) return ra - rb;
    const angle = (one) => Math.atan2(one.y - cy, one.x - cx);
    return angle(a) - angle(b);
  });
}

function spiralOrder({ width, height }) {
  const list = spiralList(width, height);
  return { nextCoordinate: (placed) => firstFree(list, placed) };
}

function randomOrder({ width, height, random }) {
  const list = shuffle(allCoordinates(width, height), random);
  return { nextCoordinate: (placed) => firstFree(list, placed) };
}

/**
 * Frontier growth: any free cell that touches a placed one, chosen at random.
 * Starts from the centre when nothing is placed.
 */
function frontierOrder({ width, height, random }) {
  const centre = { x: Math.floor((width - 1) / 2), y: Math.floor((height - 1) / 2) };
  return {
    nextCoordinate: (placed) => {
      if (placed.size === 0) return centre;
      const frontier = [];
      const seen = new Set();
      for (const key of placed) {
        const [x, y] = key.split(",").map(Number);
        for (const one of freeNeighbours(width, height, placed, { x, y }, STEPS_4)) {
          const oneKey = cellKey(one.x, one.y);
          if (!seen.has(oneKey)) {
            seen.add(oneKey);
            frontier.push(one);
          }
        }
      }
      if (frontier.length === 0) return firstFree(allCoordinates(width, height), placed);
      return pick(frontier, random);
    },
  };
}

/**
 * A random walk with a stack. From the last cell, step to a random free
 * 4-neighbour; with none free, back up the stack until one has a free
 * neighbour. A fresh start is taken when the whole stack is exhausted.
 */
function branchingOrder({ width, height, random }) {
  const stack = [];
  return {
    nextCoordinate: (placed) => {
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        const free = freeNeighbours(width, height, placed, top, STEPS_4);
        if (free.length > 0) {
          const next = pick(free, random);
          stack.push(next);
          return next;
        }
        stack.pop();
      }
      const free = allCoordinates(width, height).filter((one) => !placed.has(cellKey(one.x, one.y)));
      if (free.length === 0) return null;
      const start = pick(free, random);
      stack.push(start);
      return start;
    },
  };
}

/**
 * Clusters: pick a random free seed, then grow a patch around it, breadth
 * first, until it holds about the square root of the grid area. Then seed
 * again. Each patch becomes a district with its own character.
 */
function clusteredOrder({ width, height, random }) {
  const patchSize = Math.max(4, Math.round(Math.sqrt(width * height)));
  let queue = [];
  let grown = 0;
  const shuffledNeighbours = (placed, at) => shuffle(freeNeighbours(width, height, placed, at, STEPS_8), random);
  return {
    nextCoordinate: (placed) => {
      while (queue.length > 0 && grown < patchSize) {
        const candidate = queue.shift();
        if (placed.has(cellKey(candidate.x, candidate.y))) continue;
        grown += 1;
        queue.push(...shuffledNeighbours(placed, candidate));
        return candidate;
      }
      const free = allCoordinates(width, height).filter((one) => !placed.has(cellKey(one.x, one.y)));
      if (free.length === 0) return null;
      const seed = pick(free, random);
      queue = shuffledNeighbours(placed, seed);
      grown = 1;
      return seed;
    },
  };
}

const BUILDERS = {
  spiral: spiralOrder,
  random: randomOrder,
  clustered: clusteredOrder,
  branching: branchingOrder,
  frontier: frontierOrder,
};

/**
 * An order for one grid.
 * @param {string} id one of `ORDER_STRATEGIES`
 * @param {{width: number, height: number, random: () => number}} options
 * @returns {{nextCoordinate: (placed: Set<string>) => {x: number, y: number} | null}}
 */
export function createOrder(id, { width, height, random }) {
  const build = BUILDERS[id];
  if (!build) throw new Error(`Unknown generation order "${id}".`);
  return build({ width, height, random });
}
