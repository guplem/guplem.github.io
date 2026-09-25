import { describe, test, expect } from "bun:test";
import {
  confidenceColor,
  frpToPixels,
  windBand,
  fireDanger,
  downwindBearing,
  spreadEllipse,
  ellipsePolygon,
  pastRadiusKm,
  currentRadiusKm,
} from "./fireModel.js";
import { distanceKm } from "./geo.js";

describe("confidenceColor", () => {
  test("gives each level its own colour", () => {
    const set = new Set(["low", "medium", "high"].map(confidenceColor));
    expect(set.size).toBe(3);
  });
});

describe("frpToPixels", () => {
  test("grows with fire radiative power and has a floor", () => {
    expect(frpToPixels(0)).toBeGreaterThanOrEqual(6);
    expect(frpToPixels(100)).toBeGreaterThan(frpToPixels(10));
  });
});

describe("windBand", () => {
  test("puts calm air in band 0 and a gale in the top band", () => {
    expect(windBand(3)).toBe(0);
    expect(windBand(55)).toBe(4);
  });
});

describe("fireDanger", () => {
  test("cool, still, humid air is low danger", () => {
    expect(fireDanger({ windKmh: 5, tempC: 15, humidity: 70 }).level).toBe("low");
  });
  test("hot, windy, dry air is extreme", () => {
    expect(fireDanger({ windKmh: 45, tempC: 38, humidity: 10 }).level).toBe("extreme");
  });
  test("more wind never lowers the danger", () => {
    const calm = fireDanger({ windKmh: 5, tempC: 30, humidity: 25 }).score;
    const windy = fireDanger({ windKmh: 30, tempC: 30, humidity: 25 }).score;
    expect(windy).toBeGreaterThan(calm);
  });
});

describe("downwindBearing", () => {
  test("wind from the west pushes the fire east", () => {
    expect(downwindBearing(270)).toBe(90);
  });
  test("wind from the east-northeast wraps round", () => {
    expect(downwindBearing(60)).toBe(240);
  });
});

describe("spreadEllipse", () => {
  const fire = { lat: 42, lon: 1.8, frp: 50, weather: { windFrom: 270, windKmh: 25, tempC: 30, humidity: 25 } };

  test("grows with the forecast hours", () => {
    expect(spreadEllipse(fire, 24).semiMajorKm).toBeGreaterThan(spreadEllipse(fire, 6).semiMajorKm);
  });
  test("is stretched along the wind, not a circle", () => {
    const e = spreadEllipse(fire, 12);
    expect(e.semiMajorKm).toBeGreaterThan(e.semiMinorKm * 1.5);
    expect(e.bearing).toBe(90);
  });
  test("its centre moves downwind of the fire", () => {
    const e = spreadEllipse(fire, 12);
    expect(e.centre.lon).toBeGreaterThan(fire.lon);
  });
  test("still wind gives a near circle", () => {
    const still = { ...fire, weather: { ...fire.weather, windKmh: 0 } };
    const e = spreadEllipse(still, 12);
    expect(e.semiMajorKm / e.semiMinorKm).toBeLessThan(1.3);
  });
});

describe("ellipsePolygon", () => {
  test("draws points at the ellipse's radii", () => {
    const e = { centre: { lat: 42, lon: 1 }, semiMajorKm: 10, semiMinorKm: 4, bearing: 0 };
    const ring = ellipsePolygon(e, 1, 4);
    expect(ring.length).toBe(4);
    expect(distanceKm(e.centre, ring[0])).toBeCloseTo(10, 1);
    expect(distanceKm(e.centre, ring[1])).toBeCloseTo(4, 1);
  });
  test("a scale above one draws a wider ring for the uncertainty band", () => {
    const e = { centre: { lat: 42, lon: 1 }, semiMajorKm: 10, semiMinorKm: 4, bearing: 0 };
    expect(distanceKm(e.centre, ellipsePolygon(e, 1.3, 8)[0])).toBeCloseTo(13, 1);
  });
});

describe("pastRadiusKm", () => {
  const fire = { frp: 64, ageMin: 180, mtg: { confirmed: true } };
  test("is smaller in the past than now", () => {
    expect(pastRadiusKm(fire, 1)).toBeLessThan(currentRadiusKm(fire));
    expect(pastRadiusKm(fire, 1)).toBeGreaterThan(0);
  });
  test("is zero before the fire was first seen", () => {
    expect(pastRadiusKm({ ...fire, ageMin: 40 }, 1)).toBe(0);
  });
  test("is null with no MTG series to rebuild it from", () => {
    expect(pastRadiusKm({ ...fire, mtg: { confirmed: false } }, 1)).toBeNull();
  });
});
