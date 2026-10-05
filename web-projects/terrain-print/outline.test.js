// Print outlines. The frame is cut from these polygons and the terrain from
// these distances, so the two must agree, or the tile will not fit its frame.
import { describe, expect, test } from "bun:test";
import { offsetConvex, outlineDistance, outlinePolygon, pointInPolygon, polygonArea, SHAPE_IDS, shapeSize } from "./outline.js";

describe("shape sizes", () => {
  test("the size is the longest side", () => {
    expect(shapeSize("circle", 150)).toEqual({ width: 150, height: 150 });
    expect(shapeSize("landscape", 150)).toEqual({ width: 150, height: 100 });
    expect(shapeSize("portrait", 150)).toEqual({ width: 100, height: 150 });
    expect(shapeSize("hexagon", 100).height).toBeCloseTo(86.6025, 3);
  });
});

describe("outline polygons", () => {
  test("are counter-clockwise for every shape", () => {
    for (const id of SHAPE_IDS) expect(polygonArea(outlinePolygon(id, 100))).toBeGreaterThan(0);
  });
  test("a square of 100 has area 10,000, and grows by 2 mm on every side", () => {
    expect(polygonArea(outlinePolygon("square", 100))).toBeCloseTo(10000, 6);
    expect(polygonArea(outlinePolygon("square", 100, 2))).toBeCloseTo(104 * 104, 6);
  });
  test("an offset hexagon keeps its edges parallel at the offset distance", () => {
    const base = outlinePolygon("hexagon", 100);
    const grown = offsetConvex(base, 3);
    const d = outlineDistance("hexagon", 100);
    // Each grown corner sits 3 mm out from both of its edges.
    for (const [x, y] of grown) expect(d(x, y)).toBeCloseTo(-3, 6);
  });
  test("a circle polygon has every corner on the radius", () => {
    for (const [x, y] of outlinePolygon("circle", 80, 1, 64)) expect(Math.hypot(x, y)).toBeCloseTo(41, 9);
  });
});

describe("outline distances", () => {
  test("are positive inside, zero on the edge and negative outside", () => {
    for (const id of SHAPE_IDS) {
      const d = outlineDistance(id, 100);
      expect(d(0, 0)).toBeGreaterThan(0);
      expect(d(80, 80)).toBeLessThan(0);
    }
    const sq = outlineDistance("square", 100);
    expect(sq(50, 0)).toBeCloseTo(0, 9);
    expect(sq(40, 0)).toBeCloseTo(10, 9);
    expect(outlineDistance("circle", 100)(30, 40)).toBeCloseTo(0, 9);
  });
  test("agree with the polygon about what is inside", () => {
    for (const id of ["hexagon", "landscape", "portrait"]) {
      const poly = outlinePolygon(id, 100);
      const d = outlineDistance(id, 100);
      for (let x = -55; x <= 55; x += 7.3) {
        for (let y = -55; y <= 55; y += 6.1) expect(d(x, y) > 0).toBe(pointInPolygon(x, y, poly));
      }
    }
  });
});
