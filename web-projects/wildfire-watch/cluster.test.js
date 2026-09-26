import { describe, test, expect } from "bun:test";
import { clusterDetections, footprintAt, isActive } from "./cluster.js";

const H = 3_600_000;
const t0 = Date.parse("2026-09-25T12:00:00Z");
const det = (lat, lon, time, source = "VIIRS_SNPP", frp = 10, confidence = "medium") => ({ lat, lon, time, source, frp, confidence });

describe("clusterDetections", () => {
  test("joins detections that touch into one fire", () => {
    const fires = clusterDetections([
      det(42.0, 1.8, t0),
      det(42.005, 1.8, t0),
      det(42.01, 1.8, t0),
    ]);
    expect(fires.length).toBe(1);
    expect(fires[0].detections.length).toBe(3);
  });
  test("keeps far-apart detections apart", () => {
    expect(clusterDetections([det(42, 1.8, t0), det(42.2, 1.8, t0)]).length).toBe(2);
  });
  test("sums the power of the latest pass only", () => {
    const [fire] = clusterDetections([
      det(42, 1.8, t0 - 10 * H, "VIIRS_SNPP", 100),
      det(42.003, 1.8, t0, "VIIRS_NOAA20", 20),
      det(42.006, 1.8, t0 + 5 * 60_000, "VIIRS_NOAA20", 5),
    ]);
    expect(fire.frp).toBe(25);
    expect(fire.firstSeen).toBe(t0 - 10 * H);
    expect(fire.lastSeen).toBe(t0 + 5 * 60_000);
  });
  test("a fire seen by two satellites is cross-checked", () => {
    const [one] = clusterDetections([det(42, 1.8, t0), det(42.003, 1.8, t0 + H)]);
    expect(one.crossChecked).toBe(false);
    const [two] = clusterDetections([det(42, 1.8, t0), det(42.003, 1.8, t0 + H, "MODIS")]);
    expect(two.crossChecked).toBe(true);
    expect(two.sources.sort()).toEqual(["MODIS", "VIIRS_SNPP"]);
  });
  test("takes the highest confidence and sizes the fire from its extent", () => {
    const [fire] = clusterDetections([
      det(42, 1.8, t0, "VIIRS_SNPP", 1, "low"),
      det(42.009, 1.8, t0, "VIIRS_SNPP", 1, "high"),
    ]);
    expect(fire.confidence).toBe("high");
    expect(fire.radiusKm).toBeGreaterThan(0.4);
    expect(fire.lat).toBeCloseTo(42.0045, 4);
  });
  test("gives each fire a stable id from its first detection", () => {
    const input = [det(42, 1.8, t0), det(42.003, 1.8, t0 + H)];
    expect(clusterDetections(input)[0].id).toBe(clusterDetections([...input].reverse())[0].id);
  });
  test("sorts the fires by power, strongest first", () => {
    const fires = clusterDetections([det(42, 1.8, t0, "MODIS", 5), det(43, 1.8, t0, "MODIS", 50)]);
    expect(fires.map((f) => f.frp)).toEqual([50, 5]);
  });
});

describe("footprintAt", () => {
  test("keeps only the detections seen by then", () => {
    const [fire] = clusterDetections([det(42, 1.8, t0 - 20 * H), det(42.003, 1.8, t0)]);
    expect(footprintAt(fire, t0 - 12 * H).length).toBe(1);
    expect(footprintAt(fire, t0 - 30 * H).length).toBe(0);
  });
});

describe("isActive", () => {
  test("a fire last seen within 24 hours is active", () => {
    const [fire] = clusterDetections([det(42, 1.8, t0)]);
    expect(isActive(fire, t0 + 23 * H)).toBe(true);
    expect(isActive(fire, t0 + 25 * H)).toBe(false);
  });
});
