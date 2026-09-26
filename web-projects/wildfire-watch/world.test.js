import { describe, test, expect } from "bun:test";
import { demoFires, realFires, satelliteText, inBounds, MODE_CONFIG } from "./world.js";
import { FIRES } from "./mockData.js";
import { nearestIndex } from "./geo.js";

const H = 3_600_000;
const now = Date.parse("2026-09-25T14:00:00Z");

describe("demoFires", () => {
  const fires = demoFires(now);
  test("gives every demo fire the common shape", () => {
    expect(fires.length).toBe(FIRES.length);
    const berga = fires.find((f) => f.id === "bergueda");
    expect(berga.firstSeen).toBe(now - 220 * 60_000);
    expect(berga.crossChecked).toBe(true);
    expect(berga.crossText).toBe("Confirmed by MTG 6 min ago");
    expect(berga.weather.windKmh).toBe(28);
    expect(berga.active).toBe(true);
  });
  test("says when MTG has not confirmed a fire", () => {
    expect(fires.find((f) => f.id === "montsant").crossText).toBe("Not yet confirmed by MTG");
  });
});

describe("realFires", () => {
  const det = (lat, lon, time, source) => ({ lat, lon, time, source, frp: 10, confidence: "high" });
  const places = [{ name: "Berga", lat: 42.104, lon: 1.846, population: 17160, country: "ES" }];
  const fires = realFires(
    [det(42.078, 1.866, now - 2 * H, "VIIRS_SNPP"), det(42.08, 1.867, now - H, "MODIS"), det(45, 10, now - 30 * H, "VIIRS_NOAA20")],
    now,
    nearestIndex(places),
  );

  test("names a fire after the town it is nearest to", () => {
    const near = fires.find((f) => f.town);
    expect(near.name).toBe("Near Berga");
    expect(near.town.km).toBeGreaterThan(3);
  });
  test("names a fire with no town near by its position", () => {
    expect(fires.find((f) => !f.town).name).toBe("Hotspot at 45.000° N, 10.000° E");
  });
  test("marks fires not seen in the past 24 hours as inactive", () => {
    expect(fires.find((f) => !f.town).active).toBe(false);
    expect(fires.find((f) => f.town).active).toBe(true);
  });
  test("has no weather until the page loads it", () => {
    expect(fires[0].weather).toBeNull();
  });
});

describe("satelliteText", () => {
  test("names the satellites that saw the fire", () => {
    expect(satelliteText(["VIIRS_SNPP", "VIIRS_NOAA20"])).toBe("Seen by 2 satellites: Suomi NPP (VIIRS), NOAA-20 (VIIRS)");
    expect(satelliteText(["MODIS"])).toBe("Seen by one satellite only: Terra and Aqua (MODIS)");
  });
});

describe("inBounds", () => {
  test("keeps the points inside the view", () => {
    const b = { south: 41, west: 1, north: 43, east: 3 };
    expect(inBounds({ lat: 42, lon: 2 }, b)).toBe(true);
    expect(inBounds({ lat: 44, lon: 2 }, b)).toBe(false);
  });
});

describe("MODE_CONFIG", () => {
  test("the demo rebuilds the last hours; real data looks back one day", () => {
    expect(MODE_CONFIG.demo.pastSteps).toEqual([-3, -1]);
    expect(MODE_CONFIG.real.pastSteps).toEqual([-24, -12]);
  });
});
