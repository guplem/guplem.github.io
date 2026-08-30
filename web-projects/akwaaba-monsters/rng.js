// Seeded random numbers.
//
// Every random choice in the game goes through this: wild encounters, damage
// spread, critical hits, catch rolls, and the speckles the art rasterizer
// scatters on a grass tile. A seed makes all of it reproducible, which is the
// only reason the battle engine can be tested at all.
//
// The generator is mulberry32: 32 bits of state, one multiply-shift round. It
// is not cryptographic and does not need to be.

/**
 * Build a generator function from a 32-bit seed.
 * @param {number} seed any integer; only the low 32 bits matter
 * @returns {() => number} a function giving the next float in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed for a fresh game. The only place the game asks the clock. */
export function randomSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/**
 * A generator with the helpers the game actually asks for.
 *
 * The `state` field is a plain number, so a save file can hold it and a loaded
 * game continues the same sequence. Keep it that way.
 */
export class Rng {
  /** @param {number} seed */
  constructor(seed = randomSeed()) {
    this.state = seed >>> 0;
  }

  /** Restore a generator from a saved state. */
  static fromState(state) {
    return new Rng(state);
  }

  /** The next float in [0, 1). */
  next() {
    // Advance the stored state so the sequence survives a save and a load.
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * A whole number in [0, n).
   * @param {number} n how many values are possible
   */
  int(n) {
    if (n <= 0) return 0;
    return Math.floor(this.next() * n);
  }

  /**
   * A whole number in [min, max], both ends included.
   */
  range(min, max) {
    if (max < min) return min;
    return min + this.int(max - min + 1);
  }

  /** True with probability `p`, where `p` runs from 0 to 1. */
  chance(p) {
    return this.next() < p;
  }

  /** True with probability `percent` out of 100. */
  percent(percent) {
    return this.next() * 100 < percent;
  }

  /** One item of a list. Returns undefined for an empty list. */
  pick(list) {
    if (!list || list.length === 0) return undefined;
    return list[this.int(list.length)];
  }

  /**
   * One item of a list, where each item carries its own `weight`.
   * An item with no weight counts as weight 1.
   * @param {Array<{weight?: number}>} list
   */
  weighted(list) {
    if (!list || list.length === 0) return undefined;
    let total = 0;
    for (const item of list) total += item.weight ?? 1;
    if (total <= 0) return list[0];
    let roll = this.next() * total;
    for (const item of list) {
      roll -= item.weight ?? 1;
      if (roll < 0) return item;
    }
    return list[list.length - 1];
  }

  /** A copy of `list` in a shuffled order. Does not touch the original. */
  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
