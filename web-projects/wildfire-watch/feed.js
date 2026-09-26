// The fire feed: one JSON file that the scheduled GitHub Action writes and the
// page reads (ADR 0002). It holds the FIRMS detections of the past 48 hours
// and the GeoNames towns near them, in a compact form.

import { distanceKm } from "./geo.js";

export const FEED_VERSION = 1;
/** Towns further than this from every detection are left out. Impact alerts use 10 km. */
export const PLACE_RADIUS_KM = 15;
/** Where the Action publishes the feed. raw.githubusercontent.com sends CORS headers. */
export const FEED_URL = "https://raw.githubusercontent.com/guplem/guplem.github.io/wildfire-feed/fires.json";

const CONF = ["low", "medium", "high"];
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Read GeoNames `citiesNNNN.txt` (tab separated). Keeps populated places
 * (feature class P) that have a population.
 */
export function parseGeonames(text) {
  const out = [];
  for (const line of String(text).split("\n")) {
    const f = line.split("\t");
    if (f.length < 15 || f[6] !== "P") continue;
    const population = Number(f[14]);
    if (!population) continue;
    out.push({ name: f[1], lat: Number(f[4]), lon: Number(f[5]), population, country: f[8] });
  }
  return out;
}

/** The places within `km` of any detection. */
export function placesNear(places, detections, km) {
  const cell = km / 111;
  const cells = new Set();
  for (const d of detections) cells.add(`${Math.floor(d.lat / cell)}:${Math.floor(d.lon / cell)}`);
  const candidate = (p) => {
    const a = Math.floor(p.lat / cell);
    const b = Math.floor(p.lon / cell);
    // Longitude cells shrink toward the poles, so look a few cells wide.
    for (let da = -1; da <= 1; da++) for (let db = -3; db <= 3; db++) if (cells.has(`${a + da}:${b + db}`)) return true;
    return false;
  };
  return places.filter((p) => candidate(p) && detections.some((d) => distanceKm(p, d) <= km));
}

export function buildFeed({ detections, places, generatedAt, sourcesMeta }) {
  return {
    version: FEED_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    region: "Europe",
    sources: sourcesMeta,
    detections: detections.map((d) => [round(d.lat, 5), round(d.lon, 5), round(d.frp, 2), CONF.indexOf(d.confidence), d.time / 60_000, d.source]),
    places: placesNear(places, detections, PLACE_RADIUS_KM).map((p) => [p.name, round(p.lat, 4), round(p.lon, 4), p.population, p.country]),
  };
}

export function readFeed(json) {
  if (json?.version !== FEED_VERSION) throw new Error(`Unknown feed version ${json?.version}`);
  const detections = json.detections.map(([lat, lon, frp, c, minutes, source]) => ({
    lat, lon, frp, confidence: CONF[c] ?? "low", time: minutes * 60_000, source,
  }));
  const newestBySource = {};
  for (const d of detections) newestBySource[d.source] = Math.max(newestBySource[d.source] ?? 0, d.time);
  return {
    generatedAt: Date.parse(json.generatedAt),
    sources: json.sources ?? [],
    detections,
    newestBySource,
    places: json.places.map(([name, lat, lon, population, country]) => ({ name, lat, lon, population, country })),
  };
}
