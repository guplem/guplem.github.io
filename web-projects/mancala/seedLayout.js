// Where the seeds sit inside a pit, and which place the next seed takes.
//
// This is view geometry, not board geometry, but it is not decoration: a
// flying seed has to land exactly where the pit is about to draw it. When the
// flight aimed at the middle of the pit instead, every seed jumped sideways
// into its place the moment it arrived, which read as a teleport.
//
// This module is pure, so the places can be tested. render.js turns them into
// pixels, and nothing else knows the formula.

import { PIT_COUNT } from "./board.js";
import { mulberry32 } from "./rng.js";

/** The most seed dots drawn in one pit. Above this the number does the work. */
export const MAX_DOTS = 12;

/**
 * The places for one pit, as percentages of the pit's box.
 *
 * Two things matter here. The places must spread evenly, or a full pit looks
 * like a clump with bald patches, and they must be FIXED per pit, so that
 * adding a seed adds a dot without moving the dots already there.
 *
 * The spread comes from the golden angle, the same trick a sunflower uses: a
 * turn of about 137.5 degrees between one seed and the next never repeats, so
 * no two dots line up however many there are. Each pit gets its own starting
 * angle so the twelve pits do not look like twelve copies.
 *
 * @param {number} pit the pit index, used as the seed of the pattern
 * @returns {Array<{x: number, y: number}>} percentages inside the pit
 */
function pattern(pit) {
  const phase = mulberry32(1000 + pit * 37)() * Math.PI * 2;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spots = [];
  for (let index = 0; index < MAX_DOTS; index += 1) {
    // Two rings of six. A pit usually holds four or five seeds, and putting
    // those on one ring spreads them across the bowl instead of piling them
    // in the middle, which is what a single spiral from the centre did.
    const radius = index < 6 ? 14 : 25;
    const angle = phase + index * golden;
    spots.push({
      // The middle sits above the pit's centre, because the seed count sits
      // in a pill along the bottom of the bowl.
      x: 50 + Math.cos(angle) * radius,
      y: 40 + Math.sin(angle) * radius * 0.85,
    });
  }
  return Object.freeze(spots.map((spot) => Object.freeze(spot)));
}

const PATTERNS = Object.freeze(Array.from({ length: PIT_COUNT }, (_, pit) => pattern(pit)));

/**
 * Every place a seed can rest in one pit, in the order the pit fills them.
 * @param {number} pit the pit index
 * @returns {Array<{x: number, y: number}>} percentages inside the pit
 */
export function spotsIn(pit) {
  return PATTERNS[pit] ?? [];
}

/**
 * The place the seed that has just arrived comes to rest in.
 * @param {number} pit the pit the seed lands in
 * @param {number} seeds how many seeds the pit holds AFTER the seed arrives
 * @returns {{x: number, y: number}|null} the place, or null when the pit draws
 *   a number instead of that many dots
 */
export function landingSpot(pit, seeds) {
  if (seeds < 1 || seeds > MAX_DOTS) return null;
  return spotsIn(pit)[seeds - 1] ?? null;
}
