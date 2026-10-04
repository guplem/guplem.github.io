import { describe, expect, test } from "bun:test";
import { columnCountFor, MAP_COLUMNS, placeCards } from "./masonry.js";

describe("columnCountFor", () => {
  test("gives three columns when each one is wide enough for a card", () => {
    expect(columnCountFor(1200, 16)).toBe(3);
  });

  test("falls back to two columns on a narrow wide screen", () => {
    expect(columnCountFor(800, 16)).toBe(2);
  });

  test("never gives fewer columns than the map spans", () => {
    expect(columnCountFor(100, 16)).toBe(MAP_COLUMNS);
  });

  test("never gives more than three columns, however wide the page", () => {
    expect(columnCountFor(5000, 16)).toBe(3);
  });
});

describe("placeCards", () => {
  test("puts each card in the shortest column, and the leftmost one on a tie", () => {
    const { placements } = placeCards({ heights: [100, 50, 80, 30], columnCount: 3, gap: 10 });
    expect(placements).toEqual([
      { column: 0, top: 0 },
      { column: 1, top: 0 },
      { column: 2, top: 0 },
      { column: 1, top: 60 },
    ]);
  });

  test("starts the columns under the map below it, with one gap between", () => {
    const { placements } = placeCards({ heights: [40, 40, 40], columnCount: 3, gap: 10, startHeights: [200, 200] });
    // The free column fills first, until it is taller than the map.
    expect(placements).toEqual([
      { column: 2, top: 0 },
      { column: 2, top: 50 },
      { column: 2, top: 100 },
    ]);
  });

  test("moves under the map once the free column is the taller one", () => {
    const { placements } = placeCards({ heights: [250, 40], columnCount: 3, gap: 10, startHeights: [200, 200] });
    expect(placements).toEqual([
      { column: 2, top: 0 },
      { column: 0, top: 210 },
    ]);
  });

  test("reports the height of the tallest column, the map included", () => {
    expect(placeCards({ heights: [30], columnCount: 3, gap: 10, startHeights: [200, 200] }).height).toBe(200);
    expect(placeCards({ heights: [100, 50, 80, 30], columnCount: 3, gap: 10 }).height).toBe(100);
  });

  test("answers an empty layout for no cards and no map", () => {
    expect(placeCards({ heights: [], columnCount: 3, gap: 10 })).toEqual({ placements: [], height: 0 });
  });
});
