// The world engine: what a tile does, where you can walk, and what jumps out.
//
// This file holds no map. It holds the rules every map obeys. The maps
// themselves live in `areas/`, one file per area, and a later agent adds area 2
// by adding a file there and nothing else (see ADR 0003).
//
// A map is a grid of single characters. `legend` turns a character into a tile
// identifier, and `TILES` below says what that tile does. Two layers stack:
// `ground` is always there, `over` is drawn on top and wins for collision when
// it is not blank. A third layer, `top`, is drawn above the player so it can
// walk under a tree canopy.

/**
 * What every tile does.
 *
 * solid     you cannot walk into it
 * encounter walking on it can start a wild battle
 * ledge     you can only enter it moving this way, and you land two tiles on
 * water     reserved: nothing can cross it yet, see ROADMAP.md
 */
export const TILES = {
  path: {},
  grass: {},
  tall: { encounter: true },
  sand: {},
  mud: {},
  flowers: {},
  bridge: {},
  floor: {},
  mat: {},
  bed: {},
  cave: {},
  gymFloor: {},
  ledge: { ledge: "down" },

  water: { solid: true, water: true },
  rock: { solid: true },
  tree: { solid: true },
  palm: { solid: true },
  crop: { solid: true },
  fence: { solid: true },
  hut: { solid: true },
  wall: { solid: true },
  table: { solid: true },
  counter: { solid: true },
  shelf: { solid: true },
  sign: { solid: true },
  caveWall: { solid: true },
  oreRock: { solid: true },
  pot: { solid: true },
  statue: { solid: true },

  // Walkable but usually carrying a warp.
  door: {},
  stairs: {},
  exit: {},
};

/** Every tile identifier a map legend is allowed to use. */
export const TILE_IDS = Object.keys(TILES);

/** The four directions, and what each one adds to a position. */
export const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** True when the identifier names a tile this game knows. */
export function isTileId(id) {
  return Object.prototype.hasOwnProperty.call(TILES, id);
}

/** True when the position is inside the map at all. */
export function inBounds(map, x, y) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

/** The raw character on one layer, or a space when there is nothing there. */
function charAt(layer, x, y) {
  if (!layer) return " ";
  const row = layer[y];
  if (row === undefined) return " ";
  return row[x] ?? " ";
}

/**
 * The tile identifier at a position.
 * The `over` layer wins when it is not blank, because that is what you bump into.
 * Out of bounds gives null.
 */
export function tileAt(map, x, y) {
  if (!inBounds(map, x, y)) return null;
  const overChar = charAt(map.over, x, y);
  if (overChar !== " " && map.legend[overChar]) return map.legend[overChar];
  const groundChar = charAt(map.ground, x, y);
  return map.legend[groundChar] ?? null;
}

/** What that tile does. An unknown tile behaves like a solid wall. */
export function tileBehaviour(map, x, y) {
  const id = tileAt(map, x, y);
  if (id === null) return { solid: true };
  return TILES[id] ?? { solid: true };
}

/** True when nothing can walk into this position. Off the map counts as solid. */
export function isSolid(map, x, y) {
  if (!inBounds(map, x, y)) return true;
  return Boolean(tileBehaviour(map, x, y).solid);
}

/** True when standing here can start a wild battle. */
export function isEncounterTile(map, x, y) {
  return Boolean(tileBehaviour(map, x, y).encounter);
}

/** The ledge at this position, or null. A ledge can only be jumped one way. */
export function ledgeAt(map, x, y) {
  const behaviour = tileBehaviour(map, x, y);
  return behaviour.ledge ?? null;
}

/** The warp at this position, or null. */
export function warpAt(map, x, y) {
  return (map.warps ?? []).find((warp) => warp.x === x && warp.y === y) ?? null;
}

/** The sign at this position, or null. */
export function signAt(map, x, y) {
  return (map.signs ?? []).find((sign) => sign.x === x && sign.y === y) ?? null;
}

/** Every trigger standing on this position. */
export function triggersAt(map, x, y) {
  return (map.triggers ?? []).filter((trigger) => trigger.x === x && trigger.y === y);
}

/**
 * The character standing at a position.
 * @param {object[]} characters live positions, which move as the game runs
 */
export function characterAt(characters, x, y) {
  return (characters ?? []).find(
    (character) => !character.hidden && character.x === x && character.y === y,
  ) ?? null;
}

/**
 * Whether the player can step from one tile to the next, and what happens.
 *
 * Returns the move rather than a plain yes or no, because a ledge sends the
 * player two tiles instead of one and the caller needs to know.
 *
 * @returns {{ok: boolean, x: number, y: number, jumped: boolean, blockedBy: string|null}}
 */
export function tryStep(map, from, direction, characters = []) {
  const step = DIRECTIONS[direction];
  if (!step) return { ok: false, x: from.x, y: from.y, jumped: false, blockedBy: "direction" };
  const x = from.x + step.dx;
  const y = from.y + step.dy;

  if (!inBounds(map, x, y)) {
    return { ok: false, x: from.x, y: from.y, jumped: false, blockedBy: "edge" };
  }

  const ledge = ledgeAt(map, x, y);
  if (ledge) {
    // A ledge is a one-way drop. Coming at it from any other side is a wall.
    if (ledge !== direction) {
      return { ok: false, x: from.x, y: from.y, jumped: false, blockedBy: "ledge" };
    }
    const landX = x + step.dx;
    const landY = y + step.dy;
    if (isSolid(map, landX, landY) || characterAt(characters, landX, landY)) {
      return { ok: false, x: from.x, y: from.y, jumped: false, blockedBy: "ledge" };
    }
    return { ok: true, x: landX, y: landY, jumped: true, blockedBy: null };
  }

  if (isSolid(map, x, y)) {
    return { ok: false, x: from.x, y: from.y, jumped: false, blockedBy: "tile" };
  }
  if (characterAt(characters, x, y)) {
    return { ok: false, x: from.x, y: from.y, jumped: false, blockedBy: "character" };
  }
  return { ok: true, x, y, jumped: false, blockedBy: null };
}

/** The position one step away, whether or not it can be walked into. */
export function facingPosition(from, direction) {
  const step = DIRECTIONS[direction] ?? { dx: 0, dy: 0 };
  return { x: from.x + step.dx, y: from.y + step.dy };
}

/** The direction that points from one position to another, for an NPC turning round. */
export function directionTowards(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  if (dy !== 0) return dy > 0 ? "down" : "up";
  return dx > 0 ? "right" : "left";
}

/** The opposite direction. Used when an NPC has spotted the player. */
export function oppositeDirection(direction) {
  return { up: "down", down: "up", left: "right", right: "left" }[direction] ?? direction;
}

/**
 * Whether a trainer standing still can see the player.
 * They look in a straight line, up to `sight` tiles, and anything solid blocks it.
 */
export function seesPlayer(map, trainer, player, characters = []) {
  const sight = trainer.sight ?? 0;
  if (sight <= 0) return false;
  const step = DIRECTIONS[trainer.dir];
  if (!step) return false;
  for (let distance = 1; distance <= sight; distance++) {
    const x = trainer.x + step.dx * distance;
    const y = trainer.y + step.dy * distance;
    if (!inBounds(map, x, y) || isSolid(map, x, y)) return false;
    if (player.x === x && player.y === y) return true;
    const blocker = characterAt(characters, x, y);
    if (blocker && blocker !== trainer) return false;
  }
  return false;
}

/**
 * Whether a step onto this tile starts a wild battle.
 * Only tall grass counts, and only at the map's own rate.
 */
export function rollsEncounter(map, x, y, rng) {
  if (!isEncounterTile(map, x, y)) return false;
  const rate = map.encounters?.rate ?? 0;
  if (rate <= 0) return false;
  return rng.next() < rate;
}

/**
 * Pick which creature appears and at what level.
 * @returns {{species: string, level: number}|null}
 */
export function pickEncounter(map, rng) {
  const table = map.encounters?.table ?? [];
  if (table.length === 0) return null;
  const entry = rng.weighted(table);
  if (!entry) return null;
  return { species: entry.species, level: rng.range(entry.min, entry.max) };
}

/**
 * Check a map for the mistakes that are easy to make and hard to see.
 * `areas.test.js` runs this over every map in the game.
 *
 * @returns {string[]} one line per problem, empty when the map is sound
 */
export function validateMap(map, allMaps = {}) {
  const problems = [];
  const say = (message) => problems.push(`${map.id}: ${message}`);

  if (!map.id) problems.push("a map has no id");
  if (!map.name) say("has no name");
  if (map.ground.length !== map.height) {
    say(`ground has ${map.ground.length} rows but height is ${map.height}`);
  }
  for (const [index, row] of map.ground.entries()) {
    if (row.length !== map.width) {
      say(`ground row ${index} is ${row.length} wide but width is ${map.width}`);
    }
  }
  for (const layerName of ["over", "top"]) {
    const layer = map[layerName];
    if (!layer) continue;
    if (layer.length !== map.height) say(`${layerName} has the wrong number of rows`);
    for (const [index, row] of layer.entries()) {
      if (row.length !== map.width) say(`${layerName} row ${index} is the wrong width`);
    }
  }

  for (const tileId of Object.values(map.legend)) {
    if (!isTileId(tileId)) say(`legend names an unknown tile "${tileId}"`);
  }

  const used = new Set();
  for (const layerName of ["ground", "over", "top"]) {
    for (const row of map[layerName] ?? []) {
      for (const character of row) {
        if (character !== " ") used.add(character);
      }
    }
  }
  for (const character of used) {
    if (!map.legend[character]) say(`uses "${character}" with nothing in the legend`);
  }

  for (const warp of map.warps ?? []) {
    if (!inBounds(map, warp.x, warp.y)) say(`a warp sits outside the map at ${warp.x},${warp.y}`);
    if (isSolid(map, warp.x, warp.y)) say(`a warp sits on a solid tile at ${warp.x},${warp.y}`);
    const target = allMaps[warp.to];
    if (!target) {
      say(`a warp points at "${warp.to}", which is not a map`);
    } else {
      if (!inBounds(target, warp.tx, warp.ty)) {
        say(`a warp lands outside ${warp.to} at ${warp.tx},${warp.ty}`);
      } else if (isSolid(target, warp.tx, warp.ty)) {
        say(`a warp lands on a solid tile in ${warp.to} at ${warp.tx},${warp.ty}`);
      }
    }
  }

  for (const character of map.npcs ?? []) {
    if (!inBounds(map, character.x, character.y)) {
      say(`${character.id} stands outside the map`);
    } else if (isSolid(map, character.x, character.y)) {
      say(`${character.id} stands inside a wall at ${character.x},${character.y}`);
    }
  }

  for (const sign of map.signs ?? []) {
    if (!inBounds(map, sign.x, sign.y)) say(`a sign sits outside the map`);
  }

  for (const trigger of map.triggers ?? []) {
    if (!inBounds(map, trigger.x, trigger.y)) say(`a trigger sits outside the map`);
    else if (isSolid(map, trigger.x, trigger.y)) {
      say(`a trigger sits on a solid tile at ${trigger.x},${trigger.y}, so nothing can reach it`);
    }
  }

  if (map.encounters) {
    if (map.encounters.rate <= 0 || map.encounters.rate > 1) {
      say("has an encounter rate outside 0 to 1");
    }
    if ((map.encounters.table ?? []).length === 0) {
      say("has an encounter rate but nothing to meet");
    }
    for (const entry of map.encounters.table ?? []) {
      if (entry.min > entry.max) say(`encounter ${entry.species} has min above max`);
      if (entry.min < 1) say(`encounter ${entry.species} can appear below level 1`);
    }
    const hasGrass = map.ground.some((row) =>
      [...row].some((character) => map.legend[character] === "tall"),
    );
    if (!hasGrass) say("has an encounter table but no tall grass to walk in");
  }

  return problems;
}
