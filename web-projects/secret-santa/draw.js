// The draw: who gives a present to whom.
//
// The draw is a pure function of the event and the seed. The link carries the
// names, the forbidden pairs and the seed, never the result, and every phone
// that opens the link works out the same result again. So nothing here may
// depend on the clock, on Math.random or on the order of object keys.
//
// People are numbered by their place in the list. A forbidden pair [g, r] means
// "g may not give to r". A result is an array where result[g] is the person g
// gives to.

/** How many random shuffles to try before the exact search takes over. */
const SHUFFLE_TRIES = 5000;

/** FNV-1a: turn a text into a 32-bit number. */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A small seeded random generator. Returns a function that gives numbers in [0, 1). */
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

const SEED_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A fresh seed for a new draw: 8 random letters and digits. */
export function newSeed() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => SEED_ALPHABET[b % SEED_ALPHABET.length]).join("");
}

/** Sorted, unique "g>r" keys, so the pair order in the link does not matter. */
function pairKeys(forbidden) {
  return [...new Set(forbidden.map(([g, r]) => `${g}>${r}`))].sort();
}

/**
 * One text that holds the whole event. The random generator is seeded with its
 * hash, so a change to any name, any pair or the seed gives a new draw.
 */
export function canonicalEvent(names, forbidden, seed) {
  return JSON.stringify([names, pairKeys(forbidden), seed]);
}

/** For each giver, the set of people they may give to. */
function allowedReceivers(count, forbidden) {
  const banned = new Set(pairKeys(forbidden));
  return Array.from({ length: count }, (_, g) => {
    const allowed = [];
    for (let r = 0; r < count; r++) if (r !== g && !banned.has(`${g}>${r}`)) allowed.push(r);
    return allowed;
  });
}

/**
 * Find the people who make any draw impossible on their own: givers with nobody
 * left to give to, and receivers nobody may give to.
 */
export function findBlockedPeople(count, forbidden) {
  const allowed = allowedReceivers(count, forbidden);
  const givers = [];
  const reachable = new Set();
  allowed.forEach((list, g) => {
    if (list.length === 0) givers.push(g);
    list.forEach((r) => reachable.add(r));
  });
  const receivers = [];
  for (let r = 0; r < count; r++) if (!reachable.has(r)) receivers.push(r);
  return { givers, receivers };
}

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Exact search, for groups where random shuffles almost never fit the rules. */
function searchAssignment(allowed, random) {
  const count = allowed.length;
  // The most restricted givers go first, so dead ends show up early.
  const order = shuffle([...Array(count).keys()], random).sort((a, b) => allowed[a].length - allowed[b].length);
  const options = allowed.map((list) => shuffle(list, random));
  const result = new Array(count).fill(-1);
  const taken = new Array(count).fill(false);

  const place = (step) => {
    if (step === count) return true;
    const giver = order[step];
    for (const receiver of options[giver]) {
      if (taken[receiver]) continue;
      taken[receiver] = true;
      result[giver] = receiver;
      if (place(step + 1)) return true;
      taken[receiver] = false;
    }
    result[giver] = -1;
    return false;
  };

  return place(0) ? result : null;
}

/**
 * Draw who gives to whom.
 *
 * It first shuffles the whole list and keeps the first shuffle that fits the
 * rules. Every valid draw is then equally likely. When the rules are so tight
 * that shuffles keep failing, an exact search takes over, which is a little
 * less even but always finds a draw when one exists.
 *
 * @param {string[]} names the people, in list order
 * @param {[number, number][]} forbidden pairs [giver, receiver] that may not happen
 * @param {string} seed the seed of this run
 * @returns {number[]|null} result[giver] = receiver, or null when no draw exists
 */
export function drawAssignments(names, forbidden, seed) {
  const count = names.length;
  if (count < 2) return null;
  const blocked = findBlockedPeople(count, forbidden);
  if (blocked.givers.length || blocked.receivers.length) return null;

  const allowed = allowedReceivers(count, forbidden).map((list) => new Set(list));
  const random = mulberry32(hashString(canonicalEvent(names, forbidden, seed)));
  const everyone = [...Array(count).keys()];

  for (let attempt = 0; attempt < SHUFFLE_TRIES; attempt++) {
    const candidate = shuffle(everyone, random);
    if (candidate.every((receiver, giver) => allowed[giver].has(receiver))) return candidate;
  }
  return searchAssignment(allowed.map((set) => [...set]), random);
}
