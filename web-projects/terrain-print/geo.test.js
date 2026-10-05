// Sphere geometry and tile grids. A wrong sign here moves the whole model, so
// the tests pin the projection to known distances and round trips.
import { describe, expect, test } from "bun:test";
import {
  curvatureDrop,
  distanceOnSphere,
  mercatorPixel,
  mercatorPixelMetres,
  projectAzimuthal,
  rotateClockwise,
  unprojectAzimuthal,
  unwrapLon,
  wrapLon,
} from "./geo.js";

const MOON = 1737400;

describe("longitudes", () => {
  test("wrap into [-180, 180)", () => {
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-190)).toBe(170);
    expect(wrapLon(180)).toBe(-180);
    expect(wrapLon(45)).toBe(45);
  });
  test("unwrap next to a reference so a polygon does not jump", () => {
    expect(unwrapLon(-179, 179)).toBe(181);
    expect(unwrapLon(179, -179)).toBe(-181);
    expect(unwrapLon(10, 0)).toBe(10);
  });
});

describe("the azimuthal equidistant projection", () => {
  test("keeps the distance from the centre", () => {
    const [x, y] = projectAzimuthal(10, 20, 30, 40, MOON);
    expect(Math.hypot(x, y)).toBeCloseTo(distanceOnSphere(10, 20, 30, 40, MOON), 3);
  });
  test("puts north up and east right", () => {
    const [xn, yn] = projectAzimuthal(0, 0, 1, 0, MOON);
    expect(xn).toBeCloseTo(0, 6);
    expect(yn).toBeGreaterThan(0);
    const [xe, ye] = projectAzimuthal(0, 0, 0, 1, MOON);
    expect(xe).toBeGreaterThan(0);
    expect(ye).toBeCloseTo(0, 6);
  });
  test("round-trips, also over a pole and across the date line", () => {
    for (const [lat0, lon0, lat, lon] of [
      [0, 0, 5, -7],
      [-89.5, 129.8, -87, -40],
      [10, 179, 12, -178],
      [60, -100, 40, -120],
    ]) {
      const [x, y] = projectAzimuthal(lat0, lon0, lat, lon, MOON);
      const [la, lo] = unprojectAzimuthal(lat0, lon0, x, y, MOON);
      expect(la).toBeCloseTo(lat, 8);
      expect(wrapLon(lo - lon)).toBeCloseTo(0, 8);
    }
  });
  test("the centre maps to the origin and back", () => {
    expect(projectAzimuthal(12, 34, 12, 34, MOON)).toEqual([0, 0]);
    expect(unprojectAzimuthal(12, 34, 0, 0, MOON)).toEqual([12, 34]);
  });
});

describe("rotation", () => {
  test("turns clockwise: north becomes east after 90 degrees", () => {
    const [x, y] = rotateClockwise(0, 1, 90);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(0, 12);
  });
});

describe("the curve of the globe", () => {
  test("is zero at the centre and about r²/2R near it", () => {
    expect(curvatureDrop(0, MOON)).toBe(0);
    expect(curvatureDrop(10000, MOON)).toBeCloseTo((10000 * 10000) / (2 * MOON), 1);
  });
});

describe("Web Mercator tiles", () => {
  test("place (0, 0) at the middle of the world", () => {
    const [x, y] = mercatorPixel(0, 0, 0);
    expect(x).toBe(128);
    expect(y).toBeCloseTo(128, 9);
  });
  test("find the tile that holds Mount Everest at zoom 10", () => {
    const [x, y] = mercatorPixel(27.9881, 86.925, 10);
    expect(Math.floor(x / 256)).toBe(759);
    expect(Math.floor(y / 256)).toBe(429);
  });
  test("shrink a pixel with the cosine of the latitude", () => {
    const eq = mercatorPixelMetres(0, 0, 6378137);
    expect(eq).toBeCloseTo(156543.03, 1);
    expect(mercatorPixelMetres(60, 0, 6378137)).toBeCloseTo(eq / 2, 6);
  });
});
