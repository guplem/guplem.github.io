// The map: a width, a height and one slot per cell.
//
// A slot is `null` until a decision fills it. What fills it is whatever the
// generation loop decided (`generation.js`): the chosen type id, how sure the
// model was, and where the choice came from. This file knows nothing about
// types beyond their id, so it needs no vocabulary to work.
//
// The grid is mutated in place. A map of 32 by 32 cells is redrawn on every
// decision, and a copy on each one would cost more than it saves.

/** The eight directions around a cell, clockwise from north. */
export const DIRECTIONS = [
  { name: "north", dx: 0, dy: -1 },
  { name: "north-east", dx: 1, dy: -1 },
  { name: "east", dx: 1, dy: 0 },
  { name: "south-east", dx: 1, dy: 1 },
  { name: "south", dx: 0, dy: 1 },
  { name: "south-west", dx: -1, dy: 1 },
  { name: "west", dx: -1, dy: 0 },
  { name: "north-west", dx: -1, dy: -1 },
];

/** @typedef {{width: number, height: number, cells: Array<object|null>}} Grid */

/**
 * An empty grid.
 * @param {number} width
 * @param {number} height
 * @returns {Grid}
 */
export function createGrid(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`A grid needs a whole positive width and height, not ${width} by ${height}.`);
  }
  return { width, height, cells: new Array(width * height).fill(null) };
}

/** The string that names one coordinate in a Set. */
export function cellKey(x, y) {
  return `${x},${y}`;
}

export function isInside(grid, x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function getCell(grid, x, y) {
  return isInside(grid, x, y) ? grid.cells[y * grid.width + x] : null;
}

export function setCell(grid, x, y, cell) {
  if (!isInside(grid, x, y)) throw new Error(`(${x}, ${y}) is outside a ${grid.width} by ${grid.height} grid.`);
  grid.cells[y * grid.width + x] = cell;
}

/** The keys of every decided cell. Order strategies read this. */
export function placedKeys(grid) {
  const keys = new Set();
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (grid.cells[y * grid.width + x] !== null) keys.add(cellKey(x, y));
    }
  }
  return keys;
}

/** The decided cells touching (x, y), clockwise from north. Empty slots are left out. */
export function neighboursOf(grid, x, y) {
  const around = [];
  for (const direction of DIRECTIONS) {
    const cell = getCell(grid, x + direction.dx, y + direction.dy);
    if (cell !== null) around.push({ direction: direction.name, x: x + direction.dx, y: y + direction.dy, cell });
  }
  return around;
}

/** How many decided cells of each type sit within `radius` steps of (x, y), the centre left out. */
export function ringCounts(grid, x, y, radius) {
  const counts = {};
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const cell = getCell(grid, x + dx, y + dy);
      if (cell !== null) counts[cell.typeId] = (counts[cell.typeId] ?? 0) + 1;
    }
  }
  return counts;
}

/** How many decided cells of each type the whole grid holds. */
export function countByType(grid) {
  const counts = {};
  for (const cell of grid.cells) {
    if (cell !== null) counts[cell.typeId] = (counts[cell.typeId] ?? 0) + 1;
  }
  return counts;
}

/** The grid as plain data, for a saved file. */
export function gridToJSON(grid) {
  return {
    width: grid.width,
    height: grid.height,
    cells: grid.cells.map((cell) => (cell === null ? null : { ...cell })),
  };
}

/** A grid read back from plain data, or null when the data is not one. */
export function gridFromJSON(data) {
  if (!data || typeof data !== "object") return null;
  const { width, height, cells } = data;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return null;
  if (!Array.isArray(cells) || cells.length !== width * height) return null;
  const clean = cells.map((cell) =>
    cell && typeof cell === "object" && typeof cell.typeId === "string" ? { ...cell } : null,
  );
  return { width, height, cells: clean };
}
