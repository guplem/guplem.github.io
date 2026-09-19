import { describe, expect, test } from "bun:test";
import { createGrid, setCell } from "./grid.js";
import { analyseReachability, isWalkableType } from "./reachability.js";

const vocabulary = {
  elements: [
    { id: "floor", walkable: true, isBarrier: false },
    { id: "wall", walkable: false, isBarrier: true },
    { id: "door", walkable: true, isBarrier: false },
    { id: "odd", walkable: true, isBarrier: true },
  ],
};

function fill(rows) {
  const grid = createGrid(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char === ".") setCell(grid, x, y, { typeId: "floor" });
      if (char === "#") setCell(grid, x, y, { typeId: "wall" });
      if (char === "d") setCell(grid, x, y, { typeId: "door" });
      if (char === "?") setCell(grid, x, y, { typeId: "odd" });
    });
  });
  return grid;
}

describe("isWalkableType", () => {
  test("a type is walkable only when walkable and not a barrier", () => {
    expect(isWalkableType(vocabulary, "floor")).toBe(true);
    expect(isWalkableType(vocabulary, "wall")).toBe(false);
    expect(isWalkableType(vocabulary, "odd")).toBe(false);
    expect(isWalkableType(vocabulary, "missing")).toBe(false);
  });
});

describe("analyseReachability", () => {
  test("one open room is one region and nothing is sealed", () => {
    const report = analyseReachability(fill(["...", "...", "..."]), vocabulary);
    expect(report.walkableCount).toBe(9);
    expect(report.regions.length).toBe(1);
    expect(report.largestRegion).toBe(9);
    expect(report.sealedCells).toEqual([]);
    expect(report.ok).toBe(true);
  });

  test("a wall across the room splits it, and the smaller side is sealed", () => {
    const report = analyseReachability(fill(["..#..", "..#..", "..#.."]), vocabulary);
    expect(report.regions.length).toBe(2);
    expect(report.largestRegion).toBe(6);
    expect(report.sealedCells.length).toBe(6);
    expect(report.ok).toBe(false);
  });

  test("a door joins two rooms", () => {
    const report = analyseReachability(fill(["..#..", "..d..", "..#.."]), vocabulary);
    expect(report.regions.length).toBe(1);
    expect(report.ok).toBe(true);
  });

  test("a single walled-in cell is reported with its coordinates", () => {
    const report = analyseReachability(fill(["....", ".##.", ".#.#", "..##"]), vocabulary);
    expect(report.sealedCells).toEqual([{ x: 2, y: 2 }]);
  });

  test("diagonal contact does not connect regions", () => {
    const report = analyseReachability(fill([".#", "#."]), vocabulary);
    expect(report.regions.length).toBe(2);
  });

  test("an empty or undecided grid is not a problem", () => {
    const grid = createGrid(3, 3);
    const report = analyseReachability(grid, vocabulary);
    expect(report.walkableCount).toBe(0);
    expect(report.regions).toEqual([]);
    expect(report.ok).toBe(true);
  });

  test("a map with no walkable cell at all is flagged", () => {
    const report = analyseReachability(fill(["##", "##"]), vocabulary);
    expect(report.walkableCount).toBe(0);
    expect(report.ok).toBe(false);
  });
});
