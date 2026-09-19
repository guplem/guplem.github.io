import { describe, expect, test } from "bun:test";
import { cellKey } from "./grid.js";
import { DEFAULT_ORDER_ID, ORDER_STRATEGIES, createOrder, readOrderId } from "./orderStrategies.js";
import { mulberry32 } from "./random.js";

/** Run one strategy to the end and return the coordinates in the order they came. */
function drain(id, width, height, seed = 1) {
  const order = createOrder(id, { width, height, random: mulberry32(seed) });
  const placed = new Set();
  const visited = [];
  for (let i = 0; i < width * height + 5; i += 1) {
    const next = order.nextCoordinate(placed);
    if (next === null) break;
    placed.add(cellKey(next.x, next.y));
    visited.push(next);
  }
  return { visited, after: order.nextCoordinate(placed) };
}

describe("the strategy list", () => {
  test("names five strategies, each with a label and a description", () => {
    expect(ORDER_STRATEGIES.map((one) => one.id)).toEqual(["spiral", "random", "clustered", "branching", "frontier"]);
    for (const strategy of ORDER_STRATEGIES) {
      expect(strategy.label.length).toBeGreaterThan(0);
      expect(strategy.description.length).toBeGreaterThan(0);
    }
  });

  test("readOrderId falls back to the default", () => {
    expect(readOrderId("frontier")).toBe("frontier");
    expect(readOrderId("nope")).toBe(DEFAULT_ORDER_ID);
    expect(readOrderId(undefined)).toBe(DEFAULT_ORDER_ID);
  });

  test("createOrder refuses an unknown id", () => {
    expect(() => createOrder("nope", { width: 2, height: 2, random: Math.random })).toThrow();
  });
});

describe("every strategy visits every cell exactly once", () => {
  for (const { id } of ORDER_STRATEGIES) {
    test(`${id} on a 7 by 5 grid`, () => {
      const { visited, after } = drain(id, 7, 5);
      expect(visited.length).toBe(35);
      expect(new Set(visited.map((one) => cellKey(one.x, one.y))).size).toBe(35);
      expect(after).toBeNull();
    });

    test(`${id} on a 1 by 1 grid`, () => {
      const { visited, after } = drain(id, 1, 1);
      expect(visited).toEqual([{ x: 0, y: 0 }]);
      expect(after).toBeNull();
    });
  }
});

describe("spiral", () => {
  test("starts at the centre and moves outward", () => {
    const { visited } = drain("spiral", 5, 5);
    expect(visited[0]).toEqual({ x: 2, y: 2 });
    const distance = (one) => Math.max(Math.abs(one.x - 2), Math.abs(one.y - 2));
    for (let i = 1; i < visited.length; i += 1) {
      expect(distance(visited[i])).toBeGreaterThanOrEqual(distance(visited[i - 1]));
    }
  });
});

describe("random", () => {
  test("depends on the seed", () => {
    const a = drain("random", 6, 6, 1).visited;
    const b = drain("random", 6, 6, 2).visited;
    expect(a).not.toEqual(b);
    expect(drain("random", 6, 6, 1).visited).toEqual(a);
  });
});

describe("frontier", () => {
  test("every cell after the first touches an already placed cell", () => {
    const { visited } = drain("frontier", 8, 8, 3);
    const placed = new Set();
    placed.add(cellKey(visited[0].x, visited[0].y));
    for (const one of visited.slice(1)) {
      const touches = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ].some(([dx, dy]) => placed.has(cellKey(one.x + dx, one.y + dy)));
      expect(touches).toBe(true);
      placed.add(cellKey(one.x, one.y));
    }
  });
});

describe("branching", () => {
  test("keeps walking from the last cell while a free neighbour exists", () => {
    const { visited } = drain("branching", 6, 6, 5);
    const step = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    expect(step(visited[0], visited[1])).toBe(1);
    expect(step(visited[1], visited[2])).toBe(1);
  });
});

describe("clustered", () => {
  test("grows a whole patch before it starts another one", () => {
    const { visited } = drain("clustered", 10, 10, 9);
    // Every cell but a seed touches (8-way) a cell placed before it, and a
    // patch holds about ten cells on a 10 by 10 grid, so seeds are few.
    const placed = new Set();
    let seeds = 0;
    for (const one of visited) {
      const touches = [...placed].some((key) => {
        const [x, y] = key.split(",").map(Number);
        return Math.max(Math.abs(x - one.x), Math.abs(y - one.y)) === 1;
      });
      if (!touches) seeds += 1;
      placed.add(cellKey(one.x, one.y));
    }
    expect(seeds).toBeLessThanOrEqual(12);
    expect(seeds).toBeGreaterThanOrEqual(2);
  });
});

describe("a cell placed by somebody else", () => {
  test("is never offered again, whatever the strategy", () => {
    for (const { id } of ORDER_STRATEGIES) {
      const order = createOrder(id, { width: 3, height: 3, random: mulberry32(4) });
      const placed = new Set([cellKey(1, 1), cellKey(0, 0)]);
      const seen = [];
      for (let i = 0; i < 10; i += 1) {
        const next = order.nextCoordinate(placed);
        if (next === null) break;
        placed.add(cellKey(next.x, next.y));
        seen.push(cellKey(next.x, next.y));
      }
      expect(seen.length).toBe(7);
      expect(seen).not.toContain(cellKey(1, 1));
    }
  });
});
