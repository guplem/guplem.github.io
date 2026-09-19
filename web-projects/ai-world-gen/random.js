// Deterministic randomness, so a test can replay a run and a tile variant never
// changes between two redraws of the same cell.
//
// `mulberry32` is the same small generator `random-option-picker` uses. It is
// not for security; it is for repeatability.

/**
 * A seeded random generator. Every call returns a number in [0, 1).
 * @param {number} seed any integer
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed derived from a text, so the same setting can replay the same order. */
export function seedFromText(text) {
  let hash = 2166136261;
  for (const char of String(text ?? "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A stable number for one cell, used to pick a tile variant. Two neighbours
 * get different numbers, so a field of grass does not repeat one drawing.
 */
export function hashCoordinate(x, y) {
  let hash = (x * 73856093) ^ (y * 19349663);
  hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995);
  return (hash ^ (hash >>> 15)) >>> 0;
}
