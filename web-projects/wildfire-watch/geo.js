// Small spherical geometry helpers. Points are `{ lat, lon }` in degrees,
// distances are kilometres, bearings are degrees clockwise from north.

const EARTH_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Great-circle distance (haversine). */
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The point reached by going `km` from `start` along `bearing`. */
export function destination(start, bearing, km) {
  const d = km / EARTH_KM;
  const b = rad(bearing);
  const lat1 = rad(start.lat);
  const lon1 = rad(start.lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lon: deg(lon2) };
}

/** Ray casting on lat/lon. Accurate enough for park-sized shapes. */
export function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.lat > p.lat !== b.lat > p.lat && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) {
      inside = !inside;
    }
  }
  return inside;
}

/** Distance from a point to the nearest edge of a polygon; zero when inside. */
export function distanceToPolygonKm(p, polygon) {
  if (pointInPolygon(p, polygon)) return 0;
  // Project onto each edge in a local flat frame (km), which is fine at this scale.
  const kx = 111.32 * Math.cos(rad(p.lat));
  const ky = 110.57;
  const flat = (q) => ({ x: (q.lon - p.lon) * kx, y: (q.lat - p.lat) * ky });
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = flat(polygon[i]);
    const b = flat(polygon[(i + 1) % polygon.length]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return best;
}

/** The item in `items` nearest to `p`, as `{ item, km }`, or null. */
export function nearest(p, items) {
  let best = null;
  for (const item of items) {
    const km = distanceKm(p, item);
    if (!best || km < best.km) best = { item, km };
  }
  return best;
}

/** Inverse-distance-weighted value of `pick(sample)` at `p`. */
export function idw(p, samples, pick, power = 2) {
  let num = 0;
  let den = 0;
  for (const s of samples) {
    const d = distanceKm(p, s);
    if (d < 1e-6) return pick(s);
    const w = 1 / d ** power;
    num += w * pick(s);
    den += w;
  }
  return den ? num / den : 0;
}

/**
 * A nearest-item lookup over a grid of `cellKm` cells, for lists too long to
 * scan once per query (thousands of towns against thousands of fires).
 * @returns {(p, maxKm) => ({item, km}|null)}
 */
export function nearestIndex(items, cellKm = 10) {
  const cell = cellKm / 111;
  const grid = new Map();
  const key = (a, b) => `${a}:${b}`;
  for (const item of items) {
    const k = key(Math.floor(item.lat / cell), Math.floor(item.lon / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(item);
  }
  return (p, maxKm) => {
    const a = Math.floor(p.lat / cell);
    const b = Math.floor(p.lon / cell);
    const rows = Math.ceil(maxKm / cellKm) + 1;
    // A degree of longitude is shorter than a degree of latitude, so search wider across.
    const cols = Math.ceil(rows / Math.max(0.1, Math.cos(rad(p.lat))));
    let best = null;
    for (let da = -rows; da <= rows; da++) {
      for (let db = -cols; db <= cols; db++) {
        for (const item of grid.get(key(a + da, b + db)) ?? []) {
          const km = distanceKm(p, item);
          if (km <= maxKm && (!best || km < best.km)) best = { item, km };
        }
      }
    }
    return best;
  };
}
