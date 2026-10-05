// Geometry on a sphere, and the tile grids the elevation data comes in.
//
// A model is a flat print of a curved surface. Every model point is placed
// with an azimuthal equidistant projection around the centre of the selection:
// the distance and the direction from the centre are kept exactly, so a model
// near a pole or across the date line is as true as one at the equator.

const DEG = Math.PI / 180;

/** Wrap a longitude into [-180, 180). */
export function wrapLon(lon) {
  const w = (((lon + 180) % 360) + 360) % 360 - 180;
  return w === 180 ? -180 : w;
}

/** Bring `lon` within 180 degrees of `ref`, so a polygon does not jump across the map. */
export function unwrapLon(lon, ref) {
  let l = lon;
  while (l - ref > 180) l -= 360;
  while (l - ref < -180) l += 360;
  return l;
}

/**
 * Project (lat, lon) to the plane around (lat0, lon0).
 * @returns {[number, number]} x east and y north, in the unit of `radius`
 */
export function projectAzimuthal(lat0, lon0, lat, lon, radius) {
  const p0 = lat0 * DEG;
  const p = lat * DEG;
  const dl = (lon - lon0) * DEG;
  const cosC = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl);
  const c = Math.acos(Math.max(-1, Math.min(1, cosC)));
  const k = c < 1e-12 ? 1 : c / Math.sin(c);
  const x = radius * k * Math.cos(p) * Math.sin(dl);
  const y = radius * k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl));
  return [x, y];
}

/**
 * The inverse of projectAzimuthal.
 * @returns {[number, number]} [lat, lon], lon wrapped into [-180, 180)
 */
export function unprojectAzimuthal(lat0, lon0, x, y, radius) {
  const rho = Math.hypot(x, y);
  if (rho < 1e-9) return [lat0, wrapLon(lon0)];
  const c = rho / radius;
  const p0 = lat0 * DEG;
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const lat = Math.asin(Math.max(-1, Math.min(1, cosC * Math.sin(p0) + (y * sinC * Math.cos(p0)) / rho)));
  const lon = lon0 * DEG + Math.atan2(x * sinC, rho * Math.cos(p0) * cosC - y * Math.sin(p0) * sinC);
  return [lat / DEG, wrapLon(lon / DEG)];
}

/** Rotate (x, y) clockwise by `deg` degrees: a selection turned to the right on the map. */
export function rotateClockwise(x, y, deg) {
  if (!deg) return [x, y];
  const a = -deg * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

/** Great-circle distance in the unit of `radius`. */
export function distanceOnSphere(lat1, lon1, lat2, lon2, radius) {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dp = p2 - p1;
  const dl = (lon2 - lon1) * DEG;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * How far a sphere falls below its tangent plane at ground distance `r` from
 * the point of contact. A model that keeps the curve of the globe subtracts it.
 */
export function curvatureDrop(r, radius) {
  const c = r / radius;
  return radius * (1 - Math.cos(c));
}

// ---------------------------------------------------------------------------
// Web Mercator, the grid of the Earth tiles (256 px, the slippy-map scheme).

export const MERCATOR_MAX_LAT = 85.0511287798066;

/** Global pixel coordinates of (lat, lon) at zoom `z`, for `tile`-pixel tiles. */
export function mercatorPixel(lat, lon, z, tile = 256) {
  const n = tile * 2 ** z;
  const la = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat)) * DEG;
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n;
  return [x, y];
}

/** Ground size of one Mercator pixel at `lat`, in metres, for a sphere of `radius`. */
export function mercatorPixelMetres(lat, z, radius, tile = 256) {
  return ((2 * Math.PI * radius) / (tile * 2 ** z)) * Math.cos(lat * DEG);
}

// ---------------------------------------------------------------------------
// Plate carrée (simple cylindrical), the grid of the Moon and Mars data.

/** Ground size of one degree of latitude on a sphere of `radius`. */
export function metresPerDegree(radius) {
  return (Math.PI * radius) / 180;
}
