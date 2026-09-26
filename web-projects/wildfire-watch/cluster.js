// Turn satellite detections (one hot pixel each) into fires. Detections that
// lie within LINK_KM of each other belong to the same fire.

import { distanceKm } from "./geo.js";

/** Link distance. A MODIS pixel is 1 km wide, so neighbours sit up to ~1.4 km apart. */
export const LINK_KM = 1.5;
/** Detections within this time of a fire's newest one count as the same pass. */
const PASS_MS = 20 * 60_000;
const ACTIVE_MS = 24 * 3_600_000;
const RANK = { low: 0, medium: 1, high: 2 };

/**
 * @param {{lat, lon, frp, confidence, time, source}[]} detections
 * @returns fires, strongest first
 */
export function clusterDetections(detections, linkKm = LINK_KM) {
  // Grid buckets one link wide, so each detection only checks its neighbours.
  const cell = linkKm / 111;
  const key = (lat, lon) => `${Math.floor(lat / cell)}:${Math.floor(lon / (cell / Math.max(0.2, Math.cos((lat * Math.PI) / 180))))}`;
  const parent = detections.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const buckets = new Map();
  detections.forEach((d, i) => {
    const k = key(d.lat, d.lon);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  });
  detections.forEach((d, i) => {
    const [a, b] = key(d.lat, d.lon).split(":").map(Number);
    for (let da = -1; da <= 1; da++) {
      for (let db = -1; db <= 1; db++) {
        for (const j of buckets.get(`${a + da}:${b + db}`) ?? []) {
          if (j > i && distanceKm(d, detections[j]) <= linkKm) parent[find(j)] = find(i);
        }
      }
    }
  });
  const groups = new Map();
  detections.forEach((d, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(d);
  });
  return [...groups.values()].map(summarise).sort((a, b) => b.frp - a.frp);
}

function summarise(dets) {
  const byTime = [...dets].sort((a, b) => a.time - b.time || a.lat - b.lat || a.lon - b.lon);
  const first = byTime[0];
  const last = byTime[byTime.length - 1];
  const lat = dets.reduce((s, d) => s + d.lat, 0) / dets.length;
  const lon = dets.reduce((s, d) => s + d.lon, 0) / dets.length;
  const centre = { lat, lon };
  const latestPass = dets.filter((d) => last.time - d.time <= PASS_MS);
  const sources = [...new Set(dets.map((d) => d.source))];
  const lastBySource = {};
  for (const d of dets) lastBySource[d.source] = Math.max(lastBySource[d.source] ?? 0, d.time);
  const confidence = dets.reduce((best, d) => (RANK[d.confidence] > RANK[best] ? d.confidence : best), "low");
  // Half a VIIRS pixel is the smallest size a single hot pixel can mean.
  const radiusKm = Math.max(0.19, ...dets.map((d) => distanceKm(centre, d) + 0.19));
  return {
    id: `${first.lat.toFixed(3)},${first.lon.toFixed(3)},${first.time}`,
    lat,
    lon,
    frp: Math.round(latestPass.reduce((s, d) => s + d.frp, 0) * 10) / 10,
    confidence,
    firstSeen: first.time,
    lastSeen: last.time,
    sources,
    lastBySource,
    crossChecked: sources.length >= 2,
    radiusKm,
    detections: byTime,
  };
}

/** The detections of a fire that had been seen by `time`. */
export function footprintAt(fire, time) {
  return fire.detections.filter((d) => d.time <= time);
}

/** A fire last seen within the past 24 hours. */
export function isActive(fire, now) {
  return now - fire.lastSeen <= ACTIVE_MS;
}
