import { describe, expect, test } from "bun:test";
import {
  DIRECTIONS,
  cellKey,
  countByType,
  createGrid,
  getCell,
  gridFromJSON,
  gridToJSON,
  isInside,
  neighboursOf,
  placedKeys,
  ringCounts,
  setCell,
} from "./grid.js";

describe("createGrid", () => {
  test("holds width times height empty cells", () => {
    const grid = createGrid(4, 3);
    expect(grid.width).toBe(4);
    expect(grid.height).toBe(3);
    expect(grid.cells.length).toBe(12);
    expect(grid.cells.every((cell) => cell === null)).toBe(true);
  });

  test("refuses a size below 1", () => {
    expect(() => createGrid(0, 3)).toThrow();
  });
});

describe("setCell and getCell", () => {
  test("stores a cell and reads it back", () => {
    const grid = createGrid(3, 3);
    setCell(grid, 1, 2, { typeId: "grass" });
    expect(getCell(grid, 1, 2)).toEqual({ typeId: "grass" });
    expect(getCell(grid, 0, 0)).toBeNull();
  });

  test("a coordinate outside the grid reads as null and cannot be written", () => {
    const grid = createGrid(2, 2);
    expect(getCell(grid, 5, 5)).toBeNull();
    expect(() => setCell(grid, 5, 5, { typeId: "x" })).toThrow();
  });
});

describe("isInside and cellKey", () => {
  test("isInside is true only within the bounds", () => {
    const grid = createGrid(3, 2);
    expect(isInside(grid, 0, 0)).toBe(true);
    expect(isInside(grid, 2, 1)).toBe(true);
    expect(isInside(grid, 3, 1)).toBe(false);
    expect(isInside(grid, -1, 0)).toBe(false);
  });

  test("cellKey is unique per coordinate", () => {
    expect(cellKey(1, 12)).not.toBe(cellKey(11, 2));
  });
});

describe("neighboursOf", () => {
  test("lists only placed cells, with their direction", () => {
    const grid = createGrid(3, 3);
    setCell(grid, 1, 0, { typeId: "wall" });
    setCell(grid, 2, 2, { typeId: "grass" });
    const around = neighboursOf(grid, 1, 1);
    expect(around).toEqual([
      { direction: "north", x: 1, y: 0, cell: { typeId: "wall" } },
      { direction: "south-east", x: 2, y: 2, cell: { typeId: "grass" } },
    ]);
  });

  test("has eight directions with plain names", () => {
    expect(DIRECTIONS.map((one) => one.name)).toEqual([
      "north",
      "north-east",
      "east",
      "south-east",
      "south",
      "south-west",
      "west",
      "north-west",
    ]);
  });
});

describe("ringCounts and countByType", () => {
  test("counts placed types within a radius, excluding the centre", () => {
    const grid = createGrid(5, 5);
    setCell(grid, 2, 2, { typeId: "centre" });
    setCell(grid, 0, 0, { typeId: "grass" });
    setCell(grid, 4, 4, { typeId: "grass" });
    setCell(grid, 2, 1, { typeId: "wall" });
    expect(ringCounts(grid, 2, 2, 2)).toEqual({ grass: 2, wall: 1 });
    expect(ringCounts(grid, 2, 2, 1)).toEqual({ wall: 1 });
  });

  test("countByType counts the whole grid", () => {
    const grid = createGrid(2, 2);
    setCell(grid, 0, 0, { typeId: "a" });
    setCell(grid, 1, 1, { typeId: "a" });
    setCell(grid, 0, 1, { typeId: "b" });
    expect(countByType(grid)).toEqual({ a: 2, b: 1 });
    expect(placedKeys(grid).size).toBe(3);
  });
});

describe("gridToJSON and gridFromJSON", () => {
  test("round-trips a grid", () => {
    const grid = createGrid(2, 2);
    setCell(grid, 1, 0, { typeId: "grass", confidence: 0.5 });
    const copy = gridFromJSON(JSON.parse(JSON.stringify(gridToJSON(grid))));
    expect(copy).toEqual(grid);
  });

  test("rejects a document with the wrong shape", () => {
    expect(gridFromJSON({ width: 2 })).toBeNull();
    expect(gridFromJSON({ width: 2, height: 1, cells: [null] })).toBeNull();
  });
});
