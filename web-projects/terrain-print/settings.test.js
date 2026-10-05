// The link holds the design. These tests pin the round trip, the defaults
// that stay out of the link, and what happens to bad values.
import { describe, expect, test } from "bun:test";
import { clampField, defaultSettings, FILAMENTS, PRINTERS, readSettings, writeSearch } from "./settings.js";

describe("defaults", () => {
  test("each world opens on a place that shows the tool", () => {
    expect(defaultSettings("moon")).toMatchObject({ lat: -43.31, lon: -11.36, seaOn: false });
    expect(defaultSettings("earth")).toMatchObject({ seaOn: true, seaLevel: 0, flood: "connected" });
    expect(defaultSettings("mars")).toMatchObject({ seaOn: false, seaLevel: -3760, flood: "all" });
  });
  test("an unknown world falls back to the Moon", () => {
    expect(defaultSettings("pluto").body).toBe("moon");
  });
});

describe("the link", () => {
  test("a default design writes only the world and the place", () => {
    expect(writeSearch(defaultSettings("mars"))).toBe("?b=mars&lat=18.65&lon=-133.8&km=900");
  });
  test("round-trips every changed choice", () => {
    const s = {
      ...defaultSettings("earth"),
      lat: 27.98812,
      lon: 86.925,
      km: 42.5,
      shape: "hexagon",
      rotation: 30,
      sizeMm: 220,
      reliefMm: 25.5,
      seaOn: false,
      split: "puzzle",
      pieces: 36,
      frame: "tray",
      terrainColour: "white",
      seed: 77,
    };
    const back = readSettings(writeSearch(s));
    expect(back).toEqual(s);
  });
  test("bad values fall back to the default, one by one", () => {
    const s = readSettings("?b=earth&lat=95&km=abc&shape=star&mm=300&sea=maybe&c=pink");
    const d = defaultSettings("earth");
    expect(s.lat).toBe(d.lat);
    expect(s.km).toBe(d.km);
    expect(s.shape).toBe("circle");
    expect(s.sizeMm).toBe(300);
    expect(s.seaOn).toBe(true);
    expect(s.terrainColour).toBe(d.terrainColour);
  });
  test("refuses numbers written in other forms", () => {
    expect(readSettings("?b=moon&mm=1e3").sizeMm).toBe(150);
    expect(readSettings("?b=moon&mm=0x40").sizeMm).toBe(150);
  });
});

describe("clampField", () => {
  test("keeps a typed number in range and whole where it must be", () => {
    expect(clampField("sizeMm", 5000)).toBe(1200);
    expect(clampField("pieces", 12.6)).toBe(13);
    expect(clampField("reliefMm", -3)).toBe(0.5);
  });
});

describe("lists", () => {
  test("printer and filament ids are unique", () => {
    expect(new Set(PRINTERS.map((p) => p.id)).size).toBe(PRINTERS.length);
    expect(new Set(FILAMENTS.map((f) => f.id)).size).toBe(FILAMENTS.length);
    for (const f of FILAMENTS) expect(f.hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});
