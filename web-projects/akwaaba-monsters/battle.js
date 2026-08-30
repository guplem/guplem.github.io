// The battle engine.
//
// Everything here is pure: give it a battle and an action, get back a new
// battle and a list of events. It draws nothing and it touches no clock. The
// screen in `app.js` plays the events back one at a time, which is why the
// animation can be slow while the maths is instant.
//
// The order of the events is part of the design, not an accident. A player must
// read what happens before they see it happen, so a `message` event always comes
// before the event that changes the picture. `battlePlayback.js` rebuilds the
// picture from these events, one at a time, and it can only be as correct as
// this order is. The one deliberate exception is `faint`: the creature drops and
// then the log names it, the same as in the real games.
//
// A battle is never saved. The real games do not let you save mid-fight either,
// so `battle.rng` is allowed to be a live object rather than a plain number.
//
// The damage formula follows Gen 3 in shape, without effort values, natures,
// abilities or held items. Adding any of those later means changing
// `calcDamage` and nothing else.

import { MOVES, getMove } from "./moves.js";
import { getSpecies } from "./species.js";
import { effectiveness, effectivenessLabel, hasStab } from "./types.js";
import { Rng } from "./rng.js";
import {
  displayName,
  expYield,
  gainExp,
  isFainted,
  maxHp,
  statsOf,
} from "./monsters.js";

/** The stats a battle can raise or lower for the length of the fight. */
export const BATTLE_STAGES = [
  "attack",
  "defense",
  "spAttack",
  "spDefense",
  "speed",
  "accuracy",
  "evasion",
];

/** How far a stat can be pushed in either direction. */
export const MAX_STAGE = 6;

/** How much of its maximum health poison and burn take each turn. */
export const BURN_POISON_FRACTION = 8;

/** A fresh set of stat changes, all at zero. */
export function freshStages() {
  return Object.fromEntries(BATTLE_STAGES.map((stat) => [stat, 0]));
}

/**
 * What a stat change is worth for attack, defence and speed.
 * Plus one is one and a half times; minus one is two thirds.
 */
export function stageMultiplier(stage) {
  const clamped = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, stage));
  return clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 - clamped);
}

/**
 * What a stat change is worth for accuracy and evasion.
 * These move in smaller steps than the others, the same as in the real games.
 */
export function accuracyMultiplier(stage) {
  const clamped = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, stage));
  return clamped >= 0 ? (3 + clamped) / 3 : 3 / (3 - clamped);
}

/** One side of a battle: a party, whichever creature is out, and its buffs. */
function makeSide(party) {
  return { party, active: 0, stages: freshStages(), flinched: false, runAttempts: 0 };
}

/**
 * Start a battle.
 *
 * @param {object} options
 * @param {object[]} options.party the player's creatures
 * @param {object[]} options.foeParty the other side's creatures
 * @param {"wild"|"trainer"} options.kind
 * @param {object} [options.trainer] name, sprite and prize money for a trainer
 * @param {Rng} [options.rng]
 */
export function createBattle({ party, foeParty, kind = "wild", trainer = null, rng = new Rng() }) {
  if (!party?.length) throw new Error("A battle needs at least one creature on the player's side");
  if (!foeParty?.length) throw new Error("A battle needs at least one creature to fight");
  const player = makeSide(structuredClone(party));
  player.active = player.party.findIndex((monster) => !isFainted(monster));
  if (player.active < 0) throw new Error("Every creature in the party has fainted");
  return {
    kind,
    trainer,
    rng,
    player,
    foe: makeSide(structuredClone(foeParty)),
    turn: 0,
    over: false,
    outcome: null,
    awaiting: null,
    caught: null,
    expGained: 0,
    pendingLearns: [],
    evolutions: [],
  };
}

/** The creature currently out on one side. */
export function activeMonster(battle, side) {
  const state = battle[side];
  return state.party[state.active];
}

/** The other side's name. */
function otherSide(side) {
  return side === "player" ? "foe" : "player";
}

/** How the battle log refers to a creature. Foes get "Wild" or the trainer's. */
export function battleName(battle, side) {
  const monster = activeMonster(battle, side);
  const name = displayName(monster);
  if (side === "player") return name;
  if (battle.kind === "wild") return `Wild ${name}`;
  return `${battle.trainer?.name ?? "Trainer"}'s ${name}`;
}

/** A stat as it stands in this battle, with the stage changes applied. */
export function effectiveStat(battle, side, stat) {
  const monster = activeMonster(battle, side);
  const raw = statsOf(monster)[stat];
  let value = raw * stageMultiplier(battle[side].stages[stat] ?? 0);
  if (stat === "attack" && monster.status === "burn") value *= 0.5;
  if (stat === "speed" && monster.status === "paralysis") value *= 0.25;
  return Math.max(1, Math.floor(value));
}

/**
 * How much damage one move does.
 *
 * Kept separate and exported so the tests can pin the numbers, and so a future
 * agent can read the formula without reading the turn loop.
 */
export function calcDamage({
  attacker,
  defender,
  move,
  attackStat,
  defenseStat,
  crit = false,
  roll = 1,
}) {
  if (move.cat === "status" || !move.power) return { damage: 0, multiplier: 1, crit: false };
  const multiplier = effectiveness(move.type, getSpecies(defender.species).types);
  if (multiplier === 0) return { damage: 0, multiplier: 0, crit: false };

  const level = attacker.level;
  let damage = Math.floor(
    Math.floor((Math.floor((2 * level) / 5 + 2) * move.power * attackStat) / defenseStat) / 50,
  ) + 2;
  if (crit) damage = Math.floor(damage * 2);
  if (hasStab(move.type, getSpecies(attacker.species).types)) damage = Math.floor(damage * 1.5);
  damage = Math.floor(damage * multiplier);
  damage = Math.floor(damage * roll);
  return { damage: Math.max(1, damage), multiplier, crit };
}

/** The chance in sixteenths that a move lands a critical hit. */
export function critChance(move) {
  const stage = move.effects?.find((effect) => effect.kind === "crit")?.stage ?? 0;
  return stage >= 1 ? 1 / 8 : 1 / 16;
}

/** True when the move connects, given both sides' accuracy and evasion changes. */
function rollAccuracy(battle, attackerSide, move) {
  if (move.acc === null) return true;
  const attackerStages = battle[attackerSide].stages;
  const defenderStages = battle[otherSide(attackerSide)].stages;
  const chance =
    move.acc *
    accuracyMultiplier(attackerStages.accuracy ?? 0) *
    (1 / accuracyMultiplier(defenderStages.evasion ?? 0));
  return battle.rng.next() * 100 < chance;
}

/** Apply a stat change and say what actually happened. */
function applyStatChange(battle, side, stat, delta, events) {
  const stages = battle[side].stages;
  const before = stages[stat] ?? 0;
  const after = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, before + delta));
  const name = battleName(battle, side);
  if (after === before) {
    const direction = delta > 0 ? "no higher" : "no lower";
    events.push({ type: "message", text: `${name}'s ${statLabel(stat)} will go ${direction}!` });
    return;
  }
  stages[stat] = after;
  const word = describeStatChange(delta);
  events.push({ type: "message", text: `${name}'s ${statLabel(stat)} ${word}!` });
  events.push({ type: "stat", side, stat, delta });
}

/** How a stat is written in the battle log. */
export function statLabel(stat) {
  return {
    attack: "Attack",
    defense: "Defense",
    spAttack: "Sp. Atk",
    spDefense: "Sp. Def",
    speed: "Speed",
    accuracy: "accuracy",
    evasion: "evasiveness",
  }[stat] ?? stat;
}

function describeStatChange(delta) {
  if (delta >= 2) return "rose sharply";
  if (delta === 1) return "rose";
  if (delta === -1) return "fell";
  return "fell sharply";
}

/** How a status reads in the battle log. */
export function statusLabel(status) {
  return {
    poison: "poisoned",
    burn: "burned",
    sleep: "fast asleep",
    paralysis: "paralysed",
  }[status] ?? status;
}

/** Try to inflict a lasting condition. A creature can only carry one. */
function applyStatus(battle, side, status, events) {
  const state = battle[side];
  const monster = state.party[state.active];
  const name = battleName(battle, side);
  if (monster.status) {
    events.push({ type: "message", text: `${name} is already ${statusLabel(monster.status)}.` });
    return false;
  }
  const types = getSpecies(monster.species).types;
  // A creature cannot catch its own element: fire will not burn, poison will
  // not poison. Metal shrugs poison off too, which is what makes it a wall.
  if (status === "burn" && types.includes("fire")) return false;
  if (status === "poison" && (types.includes("poison") || types.includes("metal"))) return false;
  if (status === "paralysis" && types.includes("thunder")) return false;
  monster.status = status;
  if (status === "sleep") monster.sleepTurns = battle.rng.range(1, 3);
  events.push({ type: "message", text: `${name} is ${statusLabel(status)}!` });
  events.push({ type: "status", side, status });
  return true;
}

/** Hurt a creature and report a faint if that was the last of its health. */
function dealDamage(battle, side, amount, events) {
  const state = battle[side];
  const monster = state.party[state.active];
  const applied = Math.max(0, Math.min(monster.hp, Math.floor(amount)));
  monster.hp -= applied;
  events.push({ type: "damage", side, amount: applied, hp: monster.hp, max: maxHp(monster) });
  return applied;
}

/** Give a creature health back, never past its maximum. */
function healActive(battle, side, amount, events) {
  const monster = activeMonster(battle, side);
  const before = monster.hp;
  monster.hp = Math.min(maxHp(monster), monster.hp + Math.floor(amount));
  const gained = monster.hp - before;
  if (gained > 0) {
    events.push({ type: "message", text: `${battleName(battle, side)} regained health!` });
    events.push({ type: "heal", side, amount: gained, hp: monster.hp, max: maxHp(monster) });
  }
  return gained;
}

/**
 * Run one move.
 * @returns {boolean} true when the defender fainted
 */
function useMove(battle, side, slotIndex, events) {
  const state = battle[side];
  const monster = state.party[state.active];
  const target = otherSide(side);
  const name = battleName(battle, side);

  if (state.flinched) {
    state.flinched = false;
    events.push({ type: "message", text: `${name} flinched and could not move!` });
    return false;
  }

  if (monster.status === "sleep") {
    if (monster.sleepTurns > 0) monster.sleepTurns -= 1;
    if (monster.sleepTurns <= 0) {
      monster.status = null;
      events.push({ type: "message", text: `${name} woke up!` });
      events.push({ type: "statusEnd", side, status: "sleep" });
    } else {
      events.push({ type: "message", text: `${name} is fast asleep.` });
      return false;
    }
  }

  if (monster.status === "paralysis" && battle.rng.percent(25)) {
    events.push({ type: "message", text: `${name} is paralysed and cannot move!` });
    return false;
  }

  const slot = monster.moves[slotIndex];
  const move = slot ? getMove(slot.id) : null;
  if (!move) {
    events.push({ type: "message", text: `${name} has nothing to use!` });
    return false;
  }
  if (slot.pp <= 0) {
    events.push({ type: "message", text: `${name} has no power left for ${move.name}!` });
    return false;
  }

  slot.pp -= 1;
  events.push({ type: "message", text: `${name} used ${move.name}!` });
  events.push({ type: "useMove", side, moveId: move.id, name: move.name });

  if (!rollAccuracy(battle, side, move)) {
    events.push({ type: "miss", side });
    events.push({ type: "message", text: `${name}'s attack missed!` });
    return false;
  }

  let dealt = 0;
  if (move.cat !== "status") {
    const crit = battle.rng.next() < critChance(move);
    const physical = move.cat === "physical";
    const result = calcDamage({
      attacker: monster,
      defender: activeMonster(battle, target),
      move,
      attackStat: effectiveStat(battle, side, physical ? "attack" : "spAttack"),
      defenseStat: effectiveStat(battle, target, physical ? "defense" : "spDefense"),
      crit,
      roll: 0.85 + battle.rng.next() * 0.15,
    });

    if (result.multiplier === 0) {
      events.push({
        type: "message",
        text: `It has no effect on ${battleName(battle, target)}...`,
      });
      return false;
    }

    dealt = dealDamage(battle, target, result.damage, events);
    if (result.crit) events.push({ type: "message", text: "A critical hit!" });
    const label = effectivenessLabel(result.multiplier);
    if (label === "veryEffective") {
      events.push({ type: "message", text: "It is super effective!" });
    } else if (label === "notEffective") {
      events.push({ type: "message", text: "It is not very effective..." });
    }
  }

  // Effects run after the damage, and only if the target is still standing,
  // except for the ones the user applies to itself.
  for (const effect of move.effects ?? []) {
    if (effect.kind === "crit") continue;
    const targetSide = effect.target === "self" ? side : target;
    const targetFainted = isFainted(activeMonster(battle, targetSide));
    if (targetFainted && effect.kind !== "heal" && effect.kind !== "drain") continue;
    if (!battle.rng.percent(effect.chance ?? 100)) continue;

    if (effect.kind === "status") {
      applyStatus(battle, targetSide, effect.status, events);
    } else if (effect.kind === "stat") {
      for (const [stat, delta] of Object.entries(effect.changes)) {
        applyStatChange(battle, targetSide, stat, delta, events);
      }
    } else if (effect.kind === "heal") {
      healActive(battle, side, Math.floor((maxHp(monster) * effect.pct) / 100), events);
    } else if (effect.kind === "drain" && dealt > 0) {
      healActive(battle, side, Math.max(1, Math.floor((dealt * effect.pct) / 100)), events);
    } else if (effect.kind === "flinch") {
      battle[target].flinched = true;
    }
  }

  return isFainted(activeMonster(battle, target));
}

/** Poison and burn bite at the end of every turn. */
function endOfTurnDamage(battle, side, events) {
  const monster = activeMonster(battle, side);
  if (isFainted(monster)) return false;
  if (monster.status !== "poison" && monster.status !== "burn") return false;
  const bite = Math.max(1, Math.floor(maxHp(monster) / BURN_POISON_FRACTION));
  const name = battleName(battle, side);
  const word = monster.status === "poison" ? "poison" : "burn";
  events.push({ type: "message", text: `${name} is hurt by its ${word}!` });
  dealDamage(battle, side, bite, events);
  return isFainted(monster);
}

/** How quickly a side acts this turn. */
function actionSpeed(battle, side, action) {
  if (action.kind !== "move") return Infinity; // items and switches always go first
  const slot = activeMonster(battle, side).moves[action.slot];
  const move = slot ? getMove(slot.id) : null;
  return (move?.priority ?? 0) * 10000 + effectiveStat(battle, side, "speed");
}

/**
 * What the other side does this turn.
 *
 * A wild creature picks at random. A trainer scores every move by what it would
 * actually do and usually picks the best, which is enough to make the gym feel
 * like a step up without being unfair.
 */
export function chooseFoeAction(battle) {
  const monster = activeMonster(battle, "foe");
  const usable = monster.moves
    .map((slot, index) => ({ slot, index }))
    .filter((entry) => entry.slot.pp > 0);
  if (usable.length === 0) return { kind: "struggle" };
  if (battle.kind === "wild" || battle.rng.percent(25)) {
    return { kind: "move", slot: battle.rng.pick(usable).index };
  }

  const target = activeMonster(battle, "player");
  const targetTypes = getSpecies(target.species).types;
  let best = usable[0];
  let bestScore = -Infinity;
  for (const entry of usable) {
    const move = getMove(entry.slot.id);
    let score;
    if (move.cat === "status") {
      // A status move is worth using once, early, and never twice.
      const alreadyAsleep = target.status !== null;
      score = alreadyAsleep ? 5 : 45;
    } else {
      const multiplier = effectiveness(move.type, targetTypes);
      const stab = hasStab(move.type, getSpecies(monster.species).types) ? 1.5 : 1;
      score = move.power * multiplier * stab * ((move.acc ?? 100) / 100);
    }
    score += battle.rng.int(10);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return { kind: "move", slot: best.index };
}

/** The chance of getting away from a wild creature, out of 256. */
export function escapeOdds(playerSpeed, foeSpeed, attempts) {
  if (foeSpeed <= 0) return 256;
  return Math.floor((playerSpeed * 128) / foeSpeed) + 30 * attempts;
}

/**
 * How likely one calabash is to hold a creature, from 0 to 1.
 *
 * Follows the Gen 3 shape: a hurt creature is easier, a sleeping one much
 * easier, and a rare creature is hard whatever you do.
 */
export function catchChance({ monster, ballBonus = 1 }) {
  const species = getSpecies(monster.species);
  const max = maxHp(monster);
  const statusBonus =
    monster.status === "sleep" ? 2 : monster.status ? 1.5 : 1;
  const a =
    (((3 * max - 2 * monster.hp) * species.catchRate * ballBonus) / (3 * max)) * statusBonus;
  if (a >= 255) return 1;
  const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / a));
  const perShake = b / 65536;
  return Math.min(1, perShake ** 4);
}

/**
 * Throw one calabash.
 * @returns {{caught: boolean, shakes: number}} shakes runs from 0 to 3 on a miss
 */
export function attemptCatch({ monster, ballBonus = 1, rng }) {
  const species = getSpecies(monster.species);
  const max = maxHp(monster);
  const statusBonus = monster.status === "sleep" ? 2 : monster.status ? 1.5 : 1;
  const a =
    (((3 * max - 2 * monster.hp) * species.catchRate * ballBonus) / (3 * max)) * statusBonus;
  if (a >= 255) return { caught: true, shakes: 3 };
  const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / a));
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (rng.int(65536) >= b) return { caught: false, shakes };
    shakes++;
  }
  return { caught: true, shakes: 3 };
}

/** Hand out experience for a beaten creature, and note what it unlocked. */
function awardExp(battle, defeated, events) {
  const amount = expYield(defeated, { fromTrainer: battle.kind === "trainer" });
  battle.expGained += amount;
  const winner = activeMonster(battle, "player");
  if (isFainted(winner)) return;
  const index = battle.player.active;
  const before = winner.level;
  const result = gainExp(winner, amount);
  battle.player.party[index] = result.monster;

  // Both events carry the value they land on, not only the step, so the screen
  // can rebuild the panel from the events alone. A level also lifts the health,
  // which is why `levelUp` carries `hp`.
  events.push({ type: "message", text: `${displayName(result.monster)} gained ${amount} EXP!` });
  events.push({ type: "exp", amount, partyIndex: index, exp: result.monster.exp });

  result.levels.forEach((level, step) => {
    // Only the last level carries the health. A run of levels raises it once, at
    // the end, and no message in between should move the bar.
    const last = step === result.levels.length - 1;
    events.push({ type: "message", text: `${displayName(result.monster)} grew to level ${level}!` });
    events.push({
      type: "levelUp",
      partyIndex: index,
      level,
      ...(last ? { hp: result.monster.hp } : {}),
    });
  });
  for (const entry of result.learned) {
    battle.pendingLearns.push({ partyIndex: index, moveId: entry.moveId });
  }
  if (result.evolveTo && result.monster.level > before) {
    battle.evolutions.push({ partyIndex: index, to: result.evolveTo });
  }
}

/** Send out the next creature on a side, or say there is none. */
function sendOutNext(battle, side, events) {
  const state = battle[side];
  const index = state.party.findIndex((monster) => !isFainted(monster));
  if (index < 0) return false;
  state.active = index;
  state.stages = freshStages();
  state.flinched = false;
  const name = displayName(state.party[index]);
  events.push({
    type: "message",
    text: side === "player" ? `Go, ${name}!` : `${battle.trainer?.name ?? "The foe"} sent out ${name}!`,
  });
  events.push({ type: "sendOut", side, partyIndex: index });
  return true;
}

/** Close the battle with an outcome. */
function endBattle(battle, outcome, events) {
  battle.over = true;
  battle.outcome = outcome;
  battle.awaiting = null;
  events.push({ type: "end", outcome });
}

/** Handle a faint on one side, and work out whether the battle is over. */
function handleFaint(battle, side, events) {
  const monster = activeMonster(battle, side);
  events.push({ type: "faint", side });
  events.push({ type: "message", text: `${battleName(battle, side)} fainted!` });

  if (side === "foe") {
    awardExp(battle, monster, events);
    if (battle.kind === "wild" || !sendOutNext(battle, "foe", events)) {
      if (battle.kind === "trainer") {
        events.push({
          type: "message",
          text: `${battle.trainer?.name ?? "The trainer"} is out of creatures!`,
        });
      }
      endBattle(battle, "win", events);
    }
    return;
  }

  if (battle.player.party.some((entry) => !isFainted(entry))) {
    battle.awaiting = "switch";
    events.push({ type: "mustSwitch" });
  } else {
    endBattle(battle, "lose", events);
  }
}

/**
 * Play one turn.
 *
 * @param {object} battle the battle, which this function copies before changing
 * @param {object} action what the player does:
 *   {kind:"move", slot} | {kind:"switch", index} | {kind:"item", item, ...} |
 *   {kind:"run"} | {kind:"catch", ballBonus, ballName}
 * @returns {{battle: object, events: object[]}}
 */
export function takeTurn(battle, action) {
  const next = cloneBattle(battle);
  const events = [];
  if (next.over) return { battle: next, events };

  // A forced switch after a faint is free: it does not give the foe a turn.
  if (next.awaiting === "switch") {
    if (action.kind !== "switch") return { battle: next, events };
    const target = next.player.party[action.index];
    if (!target || isFainted(target)) return { battle: next, events };
    next.player.active = action.index;
    next.player.stages = freshStages();
    next.player.flinched = false;
    next.awaiting = null;
    events.push({ type: "message", text: `Go, ${displayName(target)}!` });
    events.push({ type: "sendOut", side: "player", partyIndex: action.index });
    return { battle: next, events };
  }

  next.turn += 1;

  if (action.kind === "run") {
    if (next.kind === "trainer") {
      events.push({ type: "message", text: "You cannot run from a trainer battle!" });
    } else {
      next.player.runAttempts += 1;
      const odds = escapeOdds(
        effectiveStat(next, "player", "speed"),
        effectiveStat(next, "foe", "speed"),
        next.player.runAttempts,
      );
      if (next.rng.int(256) < odds) {
        events.push({ type: "message", text: "Got away safely!" });
        endBattle(next, "ran", events);
        return { battle: next, events };
      }
      events.push({ type: "message", text: "Could not get away!" });
    }
  } else if (action.kind === "catch") {
    if (next.kind === "trainer") {
      events.push({ type: "message", text: "You cannot catch another trainer's creature!" });
    } else {
      const wild = activeMonster(next, "foe");
      events.push({
        type: "message",
        text: `You threw a ${action.ballName ?? "Calabash"}!`,
      });
      const result = attemptCatch({
        monster: wild,
        ballBonus: action.ballBonus ?? 1,
        rng: next.rng,
      });
      events.push({ type: "throw", shakes: result.shakes, caught: result.caught });
      if (result.caught) {
        next.caught = structuredClone(wild);
        events.push({
          type: "message",
          text: `Gotcha! ${displayName(wild)} was caught!`,
        });
        endBattle(next, "caught", events);
        return { battle: next, events };
      }
      events.push({ type: "message", text: `Oh no! ${displayName(wild)} broke free!` });
    }
  } else if (action.kind === "switch") {
    const target = next.player.party[action.index];
    if (target && !isFainted(target) && action.index !== next.player.active) {
      events.push({
        type: "message",
        text: `${displayName(activeMonster(next, "player"))}, come back!`,
      });
      next.player.active = action.index;
      next.player.stages = freshStages();
      next.player.flinched = false;
      events.push({ type: "message", text: `Go, ${displayName(target)}!` });
      events.push({ type: "sendOut", side: "player", partyIndex: action.index });
    }
  } else if (action.kind === "item") {
    events.push({ type: "message", text: action.message ?? "You used an item!" });
    if (action.heal) {
      healActive(next, "player", action.heal, events);
    }
    if (action.cureStatus) {
      const monster = activeMonster(next, "player");
      if (monster.status) {
        events.push({ type: "statusEnd", side: "player", status: monster.status });
        monster.status = null;
        monster.sleepTurns = 0;
      }
    }
  }

  const foeAction = chooseFoeAction(next);
  const playerActs = action.kind === "move";
  const playerSpeed = playerActs ? actionSpeed(next, "player", action) : Infinity;
  const foeSpeed = actionSpeed(next, "foe", foeAction);
  const playerFirst = playerActs
    ? playerSpeed > foeSpeed || (playerSpeed === foeSpeed && next.rng.chance(0.5))
    : true;

  const order = playerFirst ? ["player", "foe"] : ["foe", "player"];
  for (const side of order) {
    if (next.over) break;
    if (side === "player" && !playerActs) continue;
    if (isFainted(activeMonster(next, side))) continue;
    const sideAction = side === "player" ? action : foeAction;
    if (sideAction.kind === "struggle") {
      // Out of power points on every move: a small hit and no effects.
      events.push({
        type: "message",
        text: `${battleName(next, side)} has no moves left and struggles!`,
      });
      dealDamage(next, otherSide(side), Math.max(1, Math.floor(maxHp(activeMonster(next, side)) / 10)), events);
    } else if (sideAction.kind === "move") {
      useMove(next, side, sideAction.slot, events);
    }
    for (const check of ["foe", "player"]) {
      if (!next.over && isFainted(activeMonster(next, check))) handleFaint(next, check, events);
    }
  }

  if (!next.over) {
    for (const side of order) {
      if (next.over) break;
      if (endOfTurnDamage(next, side, events)) handleFaint(next, side, events);
    }
  }

  next.player.flinched = false;
  next.foe.flinched = false;
  return { battle: next, events };
}

/** A deep copy of a battle, keeping the same random generator. */
function cloneBattle(battle) {
  const { rng, trainer, ...rest } = battle;
  const copy = structuredClone(rest);
  copy.rng = rng;
  copy.trainer = trainer;
  return copy;
}

/**
 * What the player is left with once the battle ends: the party as it now
 * stands, anything caught, and the choices still to make.
 */
export function battleResult(battle) {
  return {
    outcome: battle.outcome,
    party: battle.player.party,
    caught: battle.caught,
    expGained: battle.expGained,
    pendingLearns: battle.pendingLearns,
    evolutions: battle.evolutions,
    prize: battle.outcome === "win" && battle.kind === "trainer" ? (battle.trainer?.prize ?? 0) : 0,
  };
}

/** Which of the player's moves can still be used. */
export function usableMoves(battle) {
  const monster = activeMonster(battle, "player");
  return monster.moves.map((slot, index) => ({
    index,
    id: slot.id,
    pp: slot.pp,
    max: MOVES[slot.id]?.pp ?? 0,
    move: getMove(slot.id),
    usable: slot.pp > 0,
  }));
}
