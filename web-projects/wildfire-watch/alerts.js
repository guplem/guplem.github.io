// Facts that join the fire layer to the static context layer: which towns a
// fire threatens, which protected area it is in or near, and the town search.

import { distanceToPolygonKm, nearest } from "./geo.js";

/**
 * One alert per fire whose nearest town is within `radiusKm`, nearest first.
 * @returns {{fire, town, km}[]}
 */
export function impactAlerts(fires, towns, radiusKm = 10) {
  const alerts = [];
  for (const fire of fires) {
    const hit = nearest(fire, towns);
    if (hit && hit.km <= radiusKm) alerts.push({ fire, town: hit.item, km: hit.km });
  }
  return alerts.sort((a, b) => a.km - b.km);
}

/** The protected area nearest to a point: `{ area, inside, km }`, or null. */
export function protectedAreaFact(point, areas) {
  let best = null;
  for (const area of areas) {
    const km = distanceToPolygonKm(point, area.polygon);
    if (!best || km < best.km) best = { area, inside: km === 0, km };
  }
  return best;
}

/** Lower case, no accents, and every apostrophe written the same way. */
export function normalise(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'")
    .toLowerCase()
    .trim();
}

/** The best town for a typed query: a name that starts with it, else contains it. */
export function findTown(query, towns) {
  const q = normalise(query);
  if (!q) return null;
  return (
    towns.find((t) => normalise(t.name).startsWith(q)) ??
    towns.find((t) => normalise(t.name).includes(q)) ??
    null
  );
}

export function formatKm(km) {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
