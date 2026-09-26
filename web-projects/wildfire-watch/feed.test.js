import { describe, test, expect } from "bun:test";
import { buildFeed, readFeed, parseGeonames, placesNear, FEED_VERSION } from "./feed.js";

const t = Date.parse("2026-09-25T13:12:00Z");
const detections = [
  { lat: 42.07812, lon: 1.86601, frp: 3.23, confidence: "medium", time: t, source: "VIIRS_SNPP" },
  { lat: 37.5, lon: -5.2, frp: 20, confidence: "high", time: t - 3_600_000, source: "MODIS" },
];

// Two GeoNames rows (tab separated, 19 columns) and one that is not a place.
const row = (id, name, lat, lon, cls, pop, cc) =>
  [id, name, name, "", lat, lon, cls, "PPL", cc, "", "", "", "", "", pop, "", "", "Europe/Madrid", "2024-01-01"].join("\t");
const GEONAMES = [
  row(3128201, "Berga", 42.10429, 1.84628, "P", 17160, "ES"),
  row(1, "Far Town", 50, 10, "P", 5000, "DE"),
  row(2, "A Mountain", 42.1, 1.85, "T", 0, "ES"),
].join("\n");

describe("parseGeonames", () => {
  test("keeps populated places only", () => {
    const places = parseGeonames(GEONAMES);
    expect(places.map((p) => p.name)).toEqual(["Berga", "Far Town"]);
    expect(places[0]).toEqual({ name: "Berga", lat: 42.10429, lon: 1.84628, population: 17160, country: "ES" });
  });
});

describe("placesNear", () => {
  test("keeps the places within the radius of any detection", () => {
    const near = placesNear(parseGeonames(GEONAMES), detections, 30);
    expect(near.map((p) => p.name)).toEqual(["Berga"]);
  });
});

describe("buildFeed and readFeed", () => {
  const feed = buildFeed({
    detections,
    places: parseGeonames(GEONAMES),
    generatedAt: Date.parse("2026-09-25T14:00:00Z"),
    sourcesMeta: [{ key: "VIIRS_SNPP", ok: true }, { key: "MODIS", ok: false, error: "HTTP 500" }],
  });

  test("writes a compact, versioned file", () => {
    expect(feed.version).toBe(FEED_VERSION);
    expect(feed.detections[0]).toEqual([42.07812, 1.86601, 3.23, 1, t / 60_000, "VIIRS_SNPP"]);
    expect(feed.places).toEqual([["Berga", 42.1043, 1.8463, 17160, "ES"]]);
  });
  test("reads back what it wrote", () => {
    const back = readFeed(JSON.parse(JSON.stringify(feed)));
    expect(back.detections).toEqual(detections);
    expect(back.places[0].name).toBe("Berga");
    expect(back.generatedAt).toBe(Date.parse("2026-09-25T14:00:00Z"));
    expect(back.sources.find((s) => s.key === "MODIS").ok).toBe(false);
  });
  test("says when each source last saw a fire", () => {
    const back = readFeed(feed);
    expect(back.newestBySource.VIIRS_SNPP).toBe(t);
  });
  test("refuses a file of another version", () => {
    expect(() => readFeed({ ...feed, version: 99 })).toThrow();
  });
});
