// The register of areas.
//
// One import line per area, and the rest is merging. A later agent adds area 2
// by writing `areas/area2.js` and adding it to `AREAS` below. Nothing else in
// the game has to change (ADR 0003).
//
// The merge is deliberately strict: two areas may not share a map identifier, a
// trainer identifier or a badge identifier, because a save file holds those
// names and a collision would silently move the player to the wrong place.
// `areas.test.js` checks it.

import * as area1 from "./area1.js";

/** Every area, in the order the player reaches them. */
export const AREAS = [area1];

function mergeNamed(key) {
  const merged = {};
  for (const area of AREAS) {
    for (const [id, value] of Object.entries(area[key] ?? {})) {
      if (merged[id]) {
        throw new Error(`Two areas both define ${key} "${id}". Identifiers must be unique.`);
      }
      merged[id] = value;
    }
  }
  return merged;
}

/** Every map in the game, keyed by identifier. */
export const MAPS = mergeNamed("MAPS");

/** Every trainer in the game, keyed by identifier. */
export const TRAINERS = mergeNamed("TRAINERS");

/** Every badge in the game, keyed by identifier. */
export const BADGES = mergeNamed("BADGES");

/** The starters the first professor offers. Only area 1 has these. */
export const STARTER_CHOICE = area1.STARTER_CHOICE;

/**
 * One map by identifier.
 * @returns {object|null} null when there is no map by that name
 */
export function getMap(id) {
  return MAPS[id] ?? null;
}

/**
 * One trainer by identifier.
 * @returns {object|null} null when there is no trainer by that name
 */
export function getTrainer(id) {
  return TRAINERS[id] ?? null;
}

/**
 * One badge by identifier.
 * @returns {object|null} null when there is no badge by that name
 */
export function getBadge(id) {
  return BADGES[id] ?? null;
}

/**
 * Every person on a map, as the game will actually use them.
 *
 * The area files write people as plain data. This adds the fields the running
 * game needs and leaves the source data untouched, so a map can be reloaded
 * from scratch at any time.
 */
export function spawnCharacters(map) {
  return (map.npcs ?? []).map((npc) => ({
    ...npc,
    startX: npc.x,
    startY: npc.y,
    startDir: npc.dir ?? "down",
    hidden: Boolean(npc.hidden),
    frame: 0,
  }));
}
