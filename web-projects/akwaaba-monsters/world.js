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
//
// A tile is one of two kinds. Ground is the surface itself. Everything else is a
// thing standing on the ground, drawn with holes in it so the ground shows
// through. Every map says which ground its screen is made of, in `base`.

/**
 * The ground a screen is made of, for a tile that stands on whatever is there.
 *
 * A map declares its own ground in `base`. A palm tree writes this instead of a
 * tile name, so the same palm can stand on grass in one map and on sand in the
 * next.
 */
export const MAP_GROUND = "@map";

/**
 * What every tile does.
 *
 * solid     you cannot walk into it
 * encounter walking on it can start a wild battle
 * ledge     you can only enter it moving this way, and you land two tiles on
 * water     reserved: nothing can cross it yet, see ROADMAP.md
 * base      what this tile stands on, for a tile that is a thing and not ground
 *
 * A tile with no `base` is **ground**: it is the surface itself, and its art
 * fills the whole 16 by 16 pixels. Every other tile is a **thing standing on
 * the ground**: its art has holes in it, and `base` says what to draw first.
 * Almost everything writes `MAP_GROUND`, which means "whatever ground this
 * screen is made of". `art/art.test.js` checks the art matches this table.
 *
 * Before this split, a palm tree carried its own square of sand and left a sand
 * square in the middle of a grass field. See `art/tiles.js`.
 */
export const TILES = {
  // --- Ground: the surface itself, drawn edge to edge ----------------------
  path: {},
  grass: {},
  sand: {},
  mud: {},
  bridge: {},
  floor: {},
  cave: {},
  gymFloor: {},
  hut: { solid: true },
  roof: { solid: true },
  wall: { solid: true },
  caveWall: { solid: true },
  water: { solid: true, water: true },

  // --- Things that stand on the ground -------------------------------------
  tall: { encounter: true, base: MAP_GROUND },
  flowers: { base: MAP_GROUND },
  mat: { base: MAP_GROUND },
  bed: { base: MAP_GROUND },
  ledge: { ledge: "down", base: MAP_GROUND },
  rock: { solid: true, base: MAP_GROUND },
  tree: { solid: true, base: MAP_GROUND },
  palm: { solid: true, base: MAP_GROUND },
  crop: { solid: true, base: MAP_GROUND },
  fence: { solid: true, base: MAP_GROUND },
  table: { solid: true, base: MAP_GROUND },
  counter: { solid: true, base: MAP_GROUND },
  shelf: { solid: true, base: MAP_GROUND },
  sign: { solid: true, base: MAP_GROUND },
  oreRock: { solid: true, base: MAP_GROUND },
  pot: { solid: true, base: MAP_GROUND },
  statue: { solid: true, base: MAP_GROUND },
  // Two machines the player presses A on. They are ordinary solid furniture
  // here; `objects.js` says what each one does when the player faces it.
  healer: { solid: true, base: MAP_GROUND },
  computer: { solid: true, base: MAP_GROUND },

  // Walkable but usually carrying a warp. A doorway is a hole in a wall, so it
  // carries the wall with it rather than taking the ground of the screen.
  door: { base: "hut" },
  stairs: { base: MAP_GROUND },
  exit: { base: MAP_GROUND },
};

/** Every tile identifier a map legend is allowed to use. */
export const TILE_IDS = Object.keys(TILES);

/** Every tile that is the ground itself, so its art fills the whole square. */
export const GROUND_TILE_IDS = TILE_IDS.filter((id) => TILES[id].base === undefined);

/** True when the tile is the ground itself rather than a thing standing on it. */
export function isGroundTile(id) {
  return Object.prototype.hasOwnProperty.call(TILES, id) && TILES[id].base === undefined;
}

/**
 * Every picture to draw for one tile, from the bottom up.
 *
 * A ground tile comes back on its own. Anything else comes back with what it
 * stands on in front of it, so the renderer draws the ground and then the thing.
 *
 * @param {string} tileId the tile the map asks for
 * @param {string} mapGround the ground this screen is made of
 * @returns {string[]} one or two tile identifiers, bottom first
 */
export function tileStack(tileId, mapGround) {
  const base = TILES[tileId]?.base;
  if (base === undefined) return [tileId];
  const under = base === MAP_GROUND ? mapGround : base;
  if (!isGroundTile(under)) return [tileId];
  return [under, tileId];
}

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

/**
 * The ground at a position: what a thing standing there is standing on.
 *
 * The ground layer of a map holds the surface almost everywhere, so that is the
 * answer. Where the ground layer holds a thing instead (a palm tree written
 * straight into it), the screen's own ground is the answer.
 *
 * A sign written on the `over` layer above a path has to stand on that path.
 * Reaching for the screen's ground there would paint a square of grass over the
 * path first, which is the bug this whole split was made to end.
 */
export function groundAt(map, x, y) {
  const id = map.legend?.[charAt(map.ground, x, y)];
  return isGroundTile(id) ? id : map.base;
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

/**
 * True when this tile should drop a shadow onto the square below it.
 *
 * Something solid stands up out of the ground, so the sun leaves a dark strip
 * at its foot. That strip is the only thing that stops a hut, a tree or a rock
 * from looking painted flat onto the grass.
 *
 * Water is solid but lies flat, so it casts nothing, and a shadow that would
 * land on more of the same wall is not drawn at all.
 */
export function castsShadow(map, x, y) {
  if (!inBounds(map, x, y)) return false;
  const here = tileBehaviour(map, x, y);
  if (!here.solid || here.water) return false;
  if (!inBounds(map, x, y + 1)) return false;
  const below = tileBehaviour(map, x, y + 1);
  return !below.solid;
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
 *
 * Out in the open only tall grass counts, so the player can see danger coming.
 * A cave has no grass to grow, so a map may set `encounters.anywhere` and then
 * any tile you can stand on will do.
 */
export function rollsEncounter(map, x, y, rng) {
  const rate = map.encounters?.rate ?? 0;
  if (rate <= 0) return false;
  const onGrass = isEncounterTile(map, x, y);
  const anywhere = Boolean(map.encounters?.anywhere) && !isSolid(map, x, y);
  if (!onGrass && !anywhere) return false;
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
  // Everything that stands on the ground is drawn with holes in it, so a map
  // with no ground of its own would show the void through every palm tree.
  if (!isGroundTile(map.base)) {
    say(`base is "${map.base}", which is not a ground tile`);
  }
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
    if (!map.encounters.anywhere) {
      const hasGrass = map.ground.some((row) =>
        [...row].some((character) => map.legend[character] === "tall"),
      );
      if (!hasGrass) say("has an encounter table but no tall grass to walk in");
    }
  }

  return problems;
}
