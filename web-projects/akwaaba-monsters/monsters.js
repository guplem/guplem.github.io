// A creature the player actually owns or fights.
//
// A species is a template. A monster is one individual: its level, its hidden
// talent numbers, the four moves it happens to know, how hurt it is right now.
//
// Every monster is a plain object with only JSON-safe values inside. That is
// deliberate. The save file writes a monster straight out and reads it straight
// back, with no class to rebuild. Keep it that way when you add fields, and add
// them with a default so an old save still loads (see ADR 0002).

import { MOVES, getMove } from "./moves.js";
import { getSpecies, movesAtLevel, movesLearnedAt } from "./species.js";
import { Rng } from "./rng.js";

/** The six stats a creature has. `hp` grows on a different formula. */
export const STAT_KEYS = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"];

/** Highest level a creature can reach. */
export const MAX_LEVEL = 100;

/** Highest value for one hidden talent number. */
export const MAX_IV = 31;

/** How many moves a creature can hold at once. */
export const MOVE_SLOTS = 4;

/**
 * Total experience needed to be at a level.
 *
 * Three curves, in the shape Pokemon uses: a cube, plus or minus a fifth. A
 * "fast" creature reaches level 20 for 6400 points; a "slow" one needs 10000.
 */
export const EXP_CURVES = {
  fast: (level) => Math.floor(0.8 * level ** 3),
  medium: (level) => level ** 3,
  slow: (level) => Math.floor(1.25 * level ** 3),
};

/** Total experience needed to reach `level` on this curve. */
export function expForLevel(growth, level) {
  const curve = EXP_CURVES[growth] ?? EXP_CURVES.medium;
  const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return curve(clamped);
}

/** The level a creature is at, given its total experience. */
export function levelFromExp(growth, exp) {
  let level = 1;
  while (level < MAX_LEVEL && exp >= expForLevel(growth, level + 1)) level++;
  return level;
}

/** How much more experience the creature needs to reach its next level. */
export function expToNextLevel(monster) {
  const species = getSpecies(monster.species);
  if (monster.level >= MAX_LEVEL) return 0;
  return expForLevel(species.growth, monster.level + 1) - monster.exp;
}

/** How far along the current level the creature is, from 0 to 1. */
export function levelProgress(monster) {
  const species = getSpecies(monster.species);
  if (monster.level >= MAX_LEVEL) return 1;
  const start = expForLevel(species.growth, monster.level);
  const end = expForLevel(species.growth, monster.level + 1);
  if (end === start) return 1;
  return Math.max(0, Math.min(1, (monster.exp - start) / (end - start)));
}

/** A full set of random hidden talent numbers. */
export function rollIvs(rng = new Rng()) {
  const ivs = {};
  for (const key of STAT_KEYS) ivs[key] = rng.int(MAX_IV + 1);
  return ivs;
}

/** A set of hidden talent numbers all at the same value. Used by tests. */
export function flatIvs(value = 0) {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, value]));
}

/**
 * The six real stats of a creature at a level.
 *
 * Health uses its own formula, which is why a level 5 creature has around 20
 * health but only around 10 attack. Copied in shape from Gen 3, without effort
 * values or natures. Adding those later only changes this function.
 */
export function statsAtLevel(species, level, ivs = flatIvs(0)) {
  const stats = {};
  for (const key of STAT_KEYS) {
    const base = species.base[key];
    const iv = ivs[key] ?? 0;
    if (key === "hp") {
      stats.hp = Math.floor(((2 * base + iv) * level) / 100) + level + 10;
    } else {
      stats[key] = Math.floor(((2 * base + iv) * level) / 100) + 5;
    }
  }
  return stats;
}

/** The stats this individual has right now. */
export function statsOf(monster) {
  return statsAtLevel(getSpecies(monster.species), monster.level, monster.ivs);
}

/** How much health this creature has when completely healthy. */
export function maxHp(monster) {
  return statsOf(monster).hp;
}

/** Build the move slots a creature carries, each with full power points. */
export function buildMoveSlots(moveIds) {
  return moveIds.slice(0, MOVE_SLOTS).map((id) => {
    const move = getMove(id);
    return { id, pp: move ? move.pp : 0 };
  });
}

/**
 * Make one creature.
 *
 * @param {object} options
 * @param {string} options.species species identifier
 * @param {number} options.level
 * @param {Rng} [options.rng] leave it out only where the result is thrown away
 * @param {string[]} [options.moves] override the level-up moves
 * @param {object} [options.ivs] override the hidden talent numbers
 * @param {string} [options.nickname]
 * @param {string} [options.metAt] map identifier, for the summary screen
 */
export function createMonster({
  species: speciesId,
  level = 5,
  rng = new Rng(),
  moves,
  ivs,
  nickname = null,
  metAt = null,
} = {}) {
  const species = getSpecies(speciesId);
  if (!species) throw new Error(`Unknown species: ${speciesId}`);
  const cappedLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const talents = ivs ?? rollIvs(rng);
  const moveIds = moves ?? movesAtLevel(species, cappedLevel);
  const monster = {
    species: species.id,
    nickname,
    level: cappedLevel,
    exp: expForLevel(species.growth, cappedLevel),
    ivs: talents,
    moves: buildMoveSlots(moveIds),
    hp: 0,
    status: null,
    sleepTurns: 0,
    metAt,
    metLevel: cappedLevel,
  };
  monster.hp = maxHp(monster);
  return monster;
}

/** The name to show: the nickname if it has one, otherwise the species name. */
export function displayName(monster) {
  return monster.nickname || getSpecies(monster.species).name;
}

/** True when the creature has no health left and cannot fight. */
export function isFainted(monster) {
  return monster.hp <= 0;
}

/** A copy of the creature, healthy again, with every move refilled. */
export function healed(monster) {
  const copy = structuredClone(monster);
  copy.hp = maxHp(copy);
  copy.status = null;
  copy.sleepTurns = 0;
  copy.moves = copy.moves.map((slot) => ({ ...slot, pp: getMove(slot.id)?.pp ?? slot.pp }));
  return copy;
}

/** A copy of the whole party, fully healed. What the Akwaaba Centre does. */
export function healParty(party) {
  return party.map(healed);
}

/** True when at least one creature in the party can still fight. */
export function partyCanFight(party) {
  return party.some((monster) => !isFainted(monster));
}

/** The first creature in the party that can still fight, or null. */
export function firstHealthy(party) {
  return party.find((monster) => !isFainted(monster)) ?? null;
}

/**
 * How much experience beating this creature gives.
 * A trainer's creature is worth half again as much as a wild one.
 */
export function expYield(defeated, { fromTrainer = false } = {}) {
  const species = getSpecies(defeated.species);
  const base = Math.floor((species.baseExp * defeated.level) / 7);
  return Math.max(1, Math.floor(base * (fromTrainer ? 1.5 : 1)));
}

/**
 * Give a creature experience and work out everything that follows.
 *
 * Returns a new creature and a report, instead of changing the old one, so the
 * battle screen can show "grew to level 7", "learned Vine Whip" and "evolved"
 * one message at a time.
 *
 * Health goes up by the same amount the maximum went up, which is what the real
 * games do: levelling up in battle does not heal you.
 *
 * @returns {{monster: object, levels: number[], learned: Array<{level:number, moveId:string}>, evolveTo: string|null}}
 */
export function gainExp(monster, amount) {
  const species = getSpecies(monster.species);
  const next = structuredClone(monster);
  const levels = [];
  const learned = [];
  let evolveTo = null;

  next.exp = Math.max(0, next.exp + Math.max(0, Math.floor(amount)));
  const cap = expForLevel(species.growth, MAX_LEVEL);
  if (next.exp > cap) next.exp = cap;

  const targetLevel = levelFromExp(species.growth, next.exp);
  while (next.level < targetLevel) {
    const before = maxHp(next);
    next.level += 1;
    const after = maxHp(next);
    next.hp = Math.min(after, next.hp + (after - before));
    levels.push(next.level);
    for (const moveId of movesLearnedAt(species, next.level)) {
      learned.push({ level: next.level, moveId });
    }
    if (!evolveTo && species.evolve && next.level >= species.evolve.level) {
      evolveTo = species.evolve.to;
    }
  }

  return { monster: next, levels, learned, evolveTo };
}

/**
 * Turn a creature into what it evolves into.
 * Health keeps the same share of the maximum, so an evolution never hurts.
 */
export function evolve(monster, intoSpeciesId) {
  const target = getSpecies(intoSpeciesId);
  if (!target) return structuredClone(monster);
  const share = maxHp(monster) > 0 ? monster.hp / maxHp(monster) : 1;
  const next = structuredClone(monster);
  next.species = target.id;
  next.hp = Math.max(1, Math.round(maxHp(next) * share));
  return next;
}

/**
 * Put a move into a creature's set.
 *
 * With a free slot the move goes in. With four moves already, pass the slot to
 * replace. Passing no slot when the set is full leaves the creature unchanged,
 * which is how "do not learn it" is expressed.
 *
 * @returns {{monster: object, learned: boolean, replaced: string|null}}
 */
export function learnMove(monster, moveId, slotIndex = null) {
  if (!getMove(moveId)) return { monster, learned: false, replaced: null };
  if (monster.moves.some((slot) => slot.id === moveId)) {
    return { monster, learned: false, replaced: null };
  }
  const next = structuredClone(monster);
  const fresh = { id: moveId, pp: MOVES[moveId].pp };
  if (next.moves.length < MOVE_SLOTS) {
    next.moves.push(fresh);
    return { monster: next, learned: true, replaced: null };
  }
  if (slotIndex === null || slotIndex < 0 || slotIndex >= MOVE_SLOTS) {
    return { monster, learned: false, replaced: null };
  }
  const replaced = next.moves[slotIndex].id;
  next.moves[slotIndex] = fresh;
  return { monster: next, learned: true, replaced };
}

/** True when every one of a creature's moves is out of power points. */
export function outOfPp(monster) {
  return monster.moves.every((slot) => slot.pp <= 0);
}

/** Refill one move's power points, up to its maximum. */
export function restorePp(monster, slotIndex, amount) {
  const next = structuredClone(monster);
  const slot = next.moves[slotIndex];
  if (!slot) return next;
  const max = getMove(slot.id)?.pp ?? slot.pp;
  slot.pp = Math.min(max, slot.pp + amount);
  return next;
}

/** Restore health, never past the maximum. Returns the creature and the gain. */
export function restoreHp(monster, amount) {
  const next = structuredClone(monster);
  const max = maxHp(next);
  const before = next.hp;
  next.hp = Math.max(0, Math.min(max, next.hp + Math.floor(amount)));
  return { monster: next, healed: next.hp - before };
}
