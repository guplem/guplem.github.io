// Build the fire feed. The `wildfire-feed` GitHub Action runs this on a
// schedule and publishes the result to the `wildfire-feed` branch (ADR 0002).
//
//   bun web-projects/wildfire-watch/makeFeed.js --geonames cities1000.txt --out out/fires.json
//
// It fetches the four keyless NASA FIRMS files, keeps the GeoNames towns near
// the detections, and writes one JSON file. It exits with an error, and writes
// nothing, when every FIRMS file fails: an empty feed would read as "no fires".

import { FIRMS_SOURCES, parseFirmsCsv } from "./firms.js";
import { buildFeed, parseGeonames } from "./feed.js";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const out = arg("out") ?? "fires.json";
const geonamesPath = arg("geonames");

const detections = [];
const sourcesMeta = [];
for (const source of FIRMS_SOURCES) {
  try {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = parseFirmsCsv(await res.text(), source.key);
    detections.push(...rows);
    sourcesMeta.push({ key: source.key, ok: true, count: rows.length });
  } catch (error) {
    sourcesMeta.push({ key: source.key, ok: false, error: String(error.message ?? error) });
  }
}

if (!sourcesMeta.some((s) => s.ok)) {
  console.error("Every FIRMS file failed; keeping the previous feed.", sourcesMeta);
  process.exit(1);
}

const places = geonamesPath ? parseGeonames(await Bun.file(geonamesPath).text()) : [];
const feed = buildFeed({ detections, places, generatedAt: Date.now(), sourcesMeta });
await Bun.write(out, JSON.stringify(feed));
console.log(`Wrote ${out}: ${feed.detections.length} detections, ${feed.places.length} places.`, sourcesMeta);
