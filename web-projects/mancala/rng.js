// A small seeded random-number generator, so a benchmark run can be repeated
// exactly and a bug in an opponent can be reproduced. mulberry32 is a 32-bit
// generator: fast, tiny, and good enough for picking between equal moves.

/**
 * A random-number generator from a seed.
 * @param {number} seed any integer
 * @returns {() => number} a function returning a float in [0, 1)
 */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The generator the game uses when nobody asked for a seed: the real one.
 * @returns {() => number}
 */
export function systemRandom() {
  return Math.random;
}

/**
 * One item from a list, chosen at random.
 * @param {Array} items the list to pick from
 * @param {() => number} rng a random-number generator
 * @returns {*} the chosen item
 */
export function pickOne(items, rng) {
  return items[Math.floor(rng() * items.length) % items.length];
}
