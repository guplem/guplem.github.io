import { describe, test, expect } from "bun:test";
import { distanceKm, destination, pointInPolygon, distanceToPolygonKm, nearest, idw } from "./geo.js";

describe("distanceKm", () => {
  test("is zero for the same point", () => {
    expect(distanceKm({ lat: 41.4, lon: 2.2 }, { lat: 41.4, lon: 2.2 })).toBe(0);
  });
  test("matches Barcelona to Girona (about 86 km)", () => {
    const d = distanceKm({ lat: 41.387, lon: 2.17 }, { lat: 41.979, lon: 2.821 });
    expect(d).toBeGreaterThan(83);
    expect(d).toBeLessThan(89);
  });
});

describe("destination", () => {
  test("moves north by the distance asked", () => {
    const start = { lat: 41, lon: 1 };
    const end = destination(start, 0, 10);
    expect(end.lon).toBeCloseTo(1, 6);
    expect(distanceKm(start, end)).toBeCloseTo(10, 3);
  });
  test("moves east when the bearing is 90", () => {
    const end = destination({ lat: 41, lon: 1 }, 90, 5);
    expect(end.lon).toBeGreaterThan(1);
    expect(end.lat).toBeCloseTo(41, 2);
  });
});

describe("pointInPolygon and distanceToPolygonKm", () => {
  const square = [
    { lat: 41, lon: 1 },
    { lat: 41, lon: 2 },
    { lat: 42, lon: 2 },
    { lat: 42, lon: 1 },
  ];
  test("a point in the middle is inside, and its distance is zero", () => {
    expect(pointInPolygon({ lat: 41.5, lon: 1.5 }, square)).toBe(true);
    expect(distanceToPolygonKm({ lat: 41.5, lon: 1.5 }, square)).toBe(0);
  });
  test("a point outside gets the distance to the nearest edge", () => {
    const p = { lat: 41.5, lon: 0.9 };
    expect(pointInPolygon(p, square)).toBe(false);
    expect(distanceToPolygonKm(p, square)).toBeCloseTo(distanceKm(p, { lat: 41.5, lon: 1 }), 0);
  });
});

describe("nearest", () => {
  test("returns the closest item and its distance", () => {
    const items = [
      { name: "far", lat: 43, lon: 3 },
      { name: "near", lat: 41.1, lon: 1.1 },
    ];
    const hit = nearest({ lat: 41, lon: 1 }, items);
    expect(hit.item.name).toBe("near");
    expect(hit.km).toBeGreaterThan(0);
  });
  test("returns null for an empty list", () => {
    expect(nearest({ lat: 0, lon: 0 }, [])).toBeNull();
  });
});

describe("idw", () => {
  test("returns the sample value on top of a sample", () => {
    const samples = [
      { lat: 41, lon: 1, value: 10 },
      { lat: 42, lon: 2, value: 30 },
    ];
    expect(idw({ lat: 41, lon: 1 }, samples, (s) => s.value)).toBe(10);
  });
  test("returns the mean half way between two samples", () => {
    const samples = [
      { lat: 41, lon: 1, value: 10 },
      { lat: 41, lon: 3, value: 30 },
    ];
    expect(idw({ lat: 41, lon: 2 }, samples, (s) => s.value)).toBeCloseTo(20, 1);
  });
});
