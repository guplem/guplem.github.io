// The correctness net: a flood fill over the walkable cells, so a map with a
// sealed-off room is reported rather than shipped.
//
// It is plain code, not a model call. The model decides one cell at a time
// from its neighbours, and nothing in that loop can see that two rooms never
// meet. A breadth-first search over the finished grid can, in a few
// milliseconds.
//
// Four-way movement: a diagonal gap between two walls is not a doorway.

/** Whether a type id can be walked on. A barrier is never walkable, whatever its flag says. */
export function isWalkableType(vocabulary, typeId) {
  const type = vocabulary?.elements?.find((one) => one.id === typeId);
  return Boolean(type && type.walkable === true && type.isBarrier !== true);
}

const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Every walkable region of the grid, largest first, and the cells that are not
 * in the largest one.
 *
 * `ok` is false when there is more than one region, or when a decided map has
 * no walkable cell at all. An undecided grid is fine: there is nothing to
 * judge yet.
 */
export function analyseReachability(grid, vocabulary) {
  const walkable = new Array(grid.width * grid.height).fill(false);
  let walkableCount = 0;
  let decidedCount = 0;
  for (let i = 0; i < grid.cells.length; i += 1) {
    const cell = grid.cells[i];
    if (cell === null) continue;
    decidedCount += 1;
    if (isWalkableType(vocabulary, cell.typeId)) {
      walkable[i] = true;
      walkableCount += 1;
    }
  }

  const seen = new Array(grid.width * grid.height).fill(false);
  const regions = [];
  for (let start = 0; start < walkable.length; start += 1) {
    if (!walkable[start] || seen[start]) continue;
    const cells = [];
    const queue = [start];
    seen[start] = true;
    while (queue.length > 0) {
      const index = queue.shift();
      const x = index % grid.width;
      const y = Math.floor(index / grid.width);
      cells.push({ x, y });
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
        const next = ny * grid.width + nx;
        if (walkable[next] && !seen[next]) {
          seen[next] = true;
          queue.push(next);
        }
      }
    }
    regions.push({ size: cells.length, cells });
  }
  regions.sort((a, b) => b.size - a.size);

  const largestRegion = regions[0]?.size ?? 0;
  const sealedCells = regions.slice(1).flatMap((region) => region.cells);
  const ok = regions.length <= 1 && (decidedCount === 0 || walkableCount > 0);
  return { walkableCount, regions, largestRegion, sealedCells, ok };
}
