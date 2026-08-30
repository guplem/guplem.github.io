// The save document: what it holds, how it is checked, and how it travels.
//
// The game keeps one save. It writes it to localStorage on its own after
// anything that matters, and the player can download that same document as a
// `.json` file and load it back on another device. Nothing is sent anywhere.
//
// This game is built to grow: a later agent adds area 2, area 3, and more
// species. A save written today has to still load then. Two rules make that
// work, and ADR 0002 explains why:
//
//   1. Only ever ADD fields. Give every new field a default in `migrate`, so a
//      save that predates the field still loads.
//   2. Never reuse or rename an identifier. Species, move, item, map and flag
//      identifiers are written into save files and are permanent.
//
// `migrate` also keeps fields it does not recognise. A save touched by a newer
// build loses nothing when an older build opens it.

import { getSpecies } from "./species.js";
import { getItem } from "./items.js";
import { getMove } from "./moves.js";
import { MOVE_SLOTS, createMonster, maxHp, partyCanFight } from "./monsters.js";
import { randomSeed } from "./rng.js";

/** Bumped only when the shape changes in a way `migrate` has to know about. */
export const SAVE_VERSION = 1;

/** Written into every save, so a file from another game is refused politely. */
export const GAME_ID = "akwaaba-monsters";

/** Where the browser keeps the running save. */
export const STORAGE_KEY = "akwaaba-monsters:save";

/** How many creatures travel with the player. The rest wait in the box. */
export const PARTY_LIMIT = 6;

/** Where a new game starts. */
export const START = { map: "playerHouse", x: 4, y: 5, dir: "down" };

/** A brand new game. */
export function createSave({ name = "Guillem", sprite = "boy", seed = randomSeed() } = {}) {
  return {
    game: GAME_ID,
    version: SAVE_VERSION,
    savedAt: null,
    player: {
      name: cleanName(name),
      sprite: sprite === "girl" ? "girl" : "boy",
      map: START.map,
      x: START.x,
      y: START.y,
      dir: START.dir,
      money: 3000,
      badges: [],
      steps: 0,
      playTime: 0,
    },
    party: [],
    box: [],
    bag: { calabash: 5, sachetWater: 3 },
    flags: {},
    seen: [],
    caught: [],
    rngState: seed >>> 0,
  };
}

/** Trim a typed name to something that fits the text box. */
export function cleanName(name) {
  const trimmed = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 10);
  return trimmed.length > 0 ? trimmed : "Guillem";
}

/** True when a flag has been set. Flags are the whole story memory. */
export function hasFlag(state, flag) {
  return Boolean(state.flags?.[flag]);
}

/** A copy of the state with a flag set. */
export function setFlag(state, flag, value = true) {
  return { ...state, flags: { ...state.flags, [flag]: value } };
}

/** A copy of the state noting that a species has been met. */
export function markSeen(state, speciesId) {
  if (!getSpecies(speciesId) || state.seen.includes(speciesId)) return state;
  return { ...state, seen: [...state.seen, speciesId] };
}

/** A copy of the state noting that a species has been caught, and met. */
export function markCaught(state, speciesId) {
  if (!getSpecies(speciesId)) return state;
  const seen = state.seen.includes(speciesId) ? state.seen : [...state.seen, speciesId];
  const caught = state.caught.includes(speciesId) ? state.caught : [...state.caught, speciesId];
  return { ...state, seen, caught };
}

/**
 * Put a creature with the player: into the party when there is room, otherwise
 * into the box.
 * @returns {{state: object, wentToBox: boolean}}
 */
export function addMonster(state, monster) {
  if (state.party.length < PARTY_LIMIT) {
    return {
      state: markCaught({ ...state, party: [...state.party, monster] }, monster.species),
      wentToBox: false,
    };
  }
  return {
    state: markCaught({ ...state, box: [...state.box, monster] }, monster.species),
    wentToBox: true,
  };
}

// --- Moving creatures between the party and the box -------------------------
//
// A creature caught with a full party goes into the box. These five are the way
// back out. Three rules hold, and all three are tested:
//
//   * the party never grows past PARTY_LIMIT
//   * the party never empties, because a player with nothing to fight with
//     cannot walk out of the tall grass again
//   * the party always keeps one creature that can fight. `createBattle` throws
//     on a party where everything has fainted, so a screen that let the player
//     put the last healthy creature away would crash on the next patch of grass.
//
// Each one returns the new state and whether it did anything, so the screen can
// say why it refused rather than just beeping.

/**
 * Bring a creature out of the box and into the party.
 * @returns {{state: object, moved: boolean, reason: string|null}}
 */
export function withdrawFromBox(state, boxIndex) {
  const creature = state.box?.[boxIndex];
  if (!creature) return { state, moved: false, reason: "There is nothing in that slot." };
  if (state.party.length >= PARTY_LIMIT) {
    return { state, moved: false, reason: "Your team is full." };
  }
  const box = [...state.box];
  box.splice(boxIndex, 1);
  return { state: { ...state, party: [...state.party, creature], box }, moved: true, reason: null };
}

/**
 * Put a creature from the party away in the box.
 * @returns {{state: object, moved: boolean, reason: string|null}}
 */
export function depositToBox(state, partyIndex) {
  const creature = state.party?.[partyIndex];
  if (!creature) return { state, moved: false, reason: "There is nothing in that slot." };
  if (state.party.length <= 1) {
    return { state, moved: false, reason: "That is your last creature." };
  }
  const party = [...state.party];
  party.splice(partyIndex, 1);
  if (!partyCanFight(party)) {
    return { state, moved: false, reason: "Nothing left on your team can fight." };
  }
  return { state: { ...state, party, box: [...state.box, creature] }, moved: true, reason: null };
}

/**
 * Exchange a creature in the party for one in the box.
 *
 * This is the one that matters with a full party. Neither side changes size, so
 * a full team is never a reason to refuse and nothing can be stranded. The one
 * swap it does refuse takes the last creature that can fight off the team.
 *
 * @returns {{state: object, swapped: boolean, reason: string|null}}
 */
export function swapWithBox(state, partyIndex, boxIndex) {
  const fromParty = state.party?.[partyIndex];
  const fromBox = state.box?.[boxIndex];
  if (!fromParty || !fromBox) {
    return { state, swapped: false, reason: "There is nothing in that slot." };
  }
  const party = [...state.party];
  const box = [...state.box];
  party[partyIndex] = fromBox;
  box[boxIndex] = fromParty;
  if (!partyCanFight(party)) {
    return { state, swapped: false, reason: "Nothing left on your team can fight." };
  }
  return { state: { ...state, party, box }, swapped: true, reason: null };
}

/** Swap two creatures inside the party, which is how the player picks a lead. */
export function reorderParty(state, a, b) {
  if (a === b) return state;
  if (!state.party?.[a] || !state.party?.[b]) return state;
  const party = [...state.party];
  [party[a], party[b]] = [party[b], party[a]];
  return { ...state, party };
}

/**
 * Swap two creatures inside the box.
 *
 * The order of the box changes nothing about the game. This exists so the box
 * screen can hold one rule for both columns: A picks a creature up, A puts it
 * down. A player who learns that on the party side does not have to learn a
 * second rule on the box side.
 */
export function reorderBox(state, a, b) {
  if (a === b) return state;
  if (!state.box?.[a] || !state.box?.[b]) return state;
  const box = [...state.box];
  [box[a], box[b]] = [box[b], box[a]];
  return { ...state, box };
}

/** True when the player has this badge. */
export function hasBadge(state, badgeId) {
  return (state.player.badges ?? []).includes(badgeId);
}

/** A copy of the state with a badge added. Adding it twice does nothing. */
export function awardBadge(state, badgeId) {
  if (hasBadge(state, badgeId)) return state;
  return {
    ...state,
    player: { ...state.player, badges: [...state.player.badges, badgeId] },
  };
}

/**
 * Repair whatever a loaded document is missing, and drop what makes no sense.
 *
 * This is the one place that knows how to read an old save. It never throws:
 * a broken field is replaced with a sensible default, because losing one item
 * beats losing the whole game.
 */
export function migrate(raw) {
  const fresh = createSave();
  const state = { ...fresh, ...(raw ?? {}) };

  state.game = GAME_ID;
  state.version = SAVE_VERSION;
  state.player = { ...fresh.player, ...(raw?.player ?? {}) };
  state.player.name = cleanName(state.player.name);
  state.player.sprite = state.player.sprite === "girl" ? "girl" : "boy";
  state.player.money = clampNumber(state.player.money, 0, 999999, fresh.player.money);
  state.player.steps = clampNumber(state.player.steps, 0, Number.MAX_SAFE_INTEGER, 0);
  state.player.playTime = clampNumber(state.player.playTime, 0, Number.MAX_SAFE_INTEGER, 0);
  state.player.badges = Array.isArray(state.player.badges)
    ? state.player.badges.filter((badge) => typeof badge === "string")
    : [];
  state.player.dir = ["up", "down", "left", "right"].includes(state.player.dir)
    ? state.player.dir
    : "down";
  state.player.map = typeof state.player.map === "string" ? state.player.map : START.map;
  state.player.x = clampNumber(state.player.x, 0, 999, START.x);
  state.player.y = clampNumber(state.player.y, 0, 999, START.y);

  state.party = sanitiseMonsters(raw?.party).slice(0, PARTY_LIMIT);
  state.box = sanitiseMonsters(raw?.box);
  state.bag = sanitiseBag(raw?.bag);
  state.flags = isPlainObject(raw?.flags) ? { ...raw.flags } : {};
  state.seen = sanitiseSpeciesList(raw?.seen);
  state.caught = sanitiseSpeciesList(raw?.caught);
  state.rngState = clampNumber(raw?.rngState, 0, 0xffffffff, randomSeed()) >>> 0;
  state.savedAt = typeof raw?.savedAt === "string" ? raw.savedAt : null;

  // Every creature ever held has been seen and caught, whatever the lists say.
  for (const monster of [...state.party, ...state.box]) {
    if (!state.seen.includes(monster.species)) state.seen.push(monster.species);
    if (!state.caught.includes(monster.species)) state.caught.push(monster.species);
  }

  return state;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function sanitiseSpeciesList(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((id) => typeof id === "string" && getSpecies(id)))];
}

function sanitiseBag(bag) {
  if (!isPlainObject(bag)) return {};
  const clean = {};
  for (const [id, count] of Object.entries(bag)) {
    if (!getItem(id)) continue;
    const amount = clampNumber(count, 0, 99, 0);
    if (amount > 0) clean[id] = amount;
  }
  return clean;
}

/** Repair a list of creatures, dropping any the current build cannot build. */
function sanitiseMonsters(list) {
  if (!Array.isArray(list)) return [];
  const clean = [];
  for (const raw of list) {
    const monster = sanitiseMonster(raw);
    if (monster) clean.push(monster);
  }
  return clean;
}

/**
 * Repair one creature.
 * @returns {object|null} null when the species is gone, which is the one case
 *   worth dropping the creature over
 */
export function sanitiseMonster(raw) {
  if (!isPlainObject(raw)) return null;
  const species = getSpecies(raw.species);
  if (!species) return null;

  const level = clampNumber(raw.level, 1, 100, 5);
  const base = createMonster({ species: species.id, level });

  const monster = {
    ...base,
    ...raw,
    species: species.id,
    level,
    nickname: typeof raw.nickname === "string" ? raw.nickname.slice(0, 12) : null,
    metAt: typeof raw.metAt === "string" ? raw.metAt : null,
    metLevel: clampNumber(raw.metLevel, 1, 100, level),
    status: ["poison", "burn", "sleep", "paralysis"].includes(raw.status) ? raw.status : null,
    sleepTurns: clampNumber(raw.sleepTurns, 0, 7, 0),
  };

  monster.ivs = isPlainObject(raw.ivs) ? { ...base.ivs, ...raw.ivs } : base.ivs;
  for (const [key, value] of Object.entries(monster.ivs)) {
    monster.ivs[key] = clampNumber(value, 0, 31, 0);
  }

  const moves = Array.isArray(raw.moves) ? raw.moves : [];
  monster.moves = moves
    .filter((slot) => isPlainObject(slot) && getMove(slot.id))
    .slice(0, MOVE_SLOTS)
    .map((slot) => ({
      id: slot.id,
      pp: clampNumber(slot.pp, 0, getMove(slot.id).pp, getMove(slot.id).pp),
    }));
  if (monster.moves.length === 0) monster.moves = base.moves;

  monster.exp = clampNumber(raw.exp, 0, Number.MAX_SAFE_INTEGER, base.exp);
  monster.hp = clampNumber(raw.hp, 0, maxHp(monster), maxHp(monster));
  return monster;
}

/** The text that goes into the downloaded file. Indented, so a human can read it. */
export function serialise(state) {
  return JSON.stringify({ ...state, savedAt: new Date().toISOString() }, null, 2);
}

/**
 * Read a save file the player picked.
 *
 * Never throws. A file that is not this game's save comes back with a reason
 * the player can act on.
 *
 * @returns {{ok: true, state: object} | {ok: false, error: string}}
 */
export function parseSave(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not readable. It should be the .json file the game gave you." };
  }
  if (!isPlainObject(raw)) {
    return { ok: false, error: "That file does not hold a saved game." };
  }
  if (raw.game !== GAME_ID) {
    return { ok: false, error: "That save belongs to a different game." };
  }
  if (Number(raw.version) > SAVE_VERSION) {
    return {
      ok: false,
      error: "That save comes from a newer version of the game. Reload the page and try again.",
    };
  }
  return { ok: true, state: migrate(raw) };
}

/** The name of the file the player downloads. */
export function exportFileName(state, now = new Date()) {
  const stamp = now.toISOString().slice(0, 10);
  const name = (state?.player?.name ?? "player").replace(/[^A-Za-z0-9-]/g, "") || "player";
  return `akwaaba-${name}-${stamp}.json`;
}

/**
 * Write the save to browser storage.
 *
 * A browser can refuse: private windows, storage turned off, or a full quota.
 * The game keeps running either way, so this reports rather than throws.
 *
 * @returns {{ok: boolean, error: string|null}}
 */
export function saveToStorage(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, serialise(state));
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "This browser will not let the game save. Export the file instead." };
  }
}

/**
 * Read the save from browser storage.
 * @returns {object|null} null when there is nothing saved, or it is unreadable
 */
export function loadFromStorage(storage) {
  let text;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!text) return null;
  const result = parseSave(text);
  return result.ok ? result.state : null;
}

/** True when there is something to continue. */
export function hasStoredSave(storage) {
  return loadFromStorage(storage) !== null;
}

/** Throw the stored save away. */
export function clearStorage(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Play time, written the way the save screen shows it. */
export function formatPlayTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}
