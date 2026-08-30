// The difficulty curve, checked as data.
//
// `areas.test.js` checks that the world joins up. This file checks that the
// world is winnable. Every rule below copies a measured number out of Pokemon
// Emerald, because Emerald opens a creature-collecting game about as gently as
// the genre ever has, and this game is built in its shape.
//
// The Emerald numbers these rules come from, all with a level 5 starter:
//
//   Route 101, the first grass       Lv 2-3, which is 2 to 3 BELOW the starter
//   Route 102, the second grass      Lv 3-4, which overlaps Route 101
//   Youngster Calvin, first trainer  one Poochyena at Lv 5
//   Bug Catcher Rick, next trainer   two Wurmple at Lv 4
//   Youngster Allen, next trainer    Zigzagoon Lv 4 and Taillow Lv 3
//   Rustboro gym trainers            Lv 8 to Lv 10
//   Roxanne, the first gym leader    Geodude Lv 12 and Nosepass Lv 15
//   Zigzagoon, the strongest common  240 base stat points against a 310 starter
//   Wurmple's Poison Sting           learned at Lv 5, ABOVE the Route 101 cap
//
// The last line is the important one. Emerald gives a first route creature a
// poison move and then puts that move one level out of reach, so the opening
// hours hold no lasting condition at all.
//
// This game had it backwards. A wild Kanku knew Venom Sting from level 1, and
// the first trainer battle began with the whole party already poisoned. A
// simulation of the real engine gave the grass starter a 0 percent win rate
// against that first trainer. Every rule below closes one of those holes.
//
// When a rule here fails, the fix is almost always the data, not the rule.

import { describe, test, expect } from "bun:test";
import { MAPS, STARTER_CHOICE, TRAINERS } from "./index.js";
import { FRIEND_IDS, baseStatTotal, getSpecies, movesAtLevel } from "../species.js";
import { getMove } from "../moves.js";
import { effectiveness } from "../types.js";

/** The level every starter begins at. Emerald starts you at 5. */
const STARTER_LEVEL = STARTER_CHOICE[0].level;

/** The sum of the six base stats of the weakest starter. */
const WEAKEST_STARTER = Math.min(
  ...STARTER_CHOICE.map((entry) => baseStatTotal(getSpecies(entry.species))),
);

/**
 * The maps that hold wild creatures, in road order.
 *
 * `MAPS` lists maps in the order the player sees them, so the first entry with
 * an encounter table is the first grass the player ever walks into.
 */
const wildMaps = Object.entries(MAPS)
  .filter(([, map]) => map.encounters?.table?.length)
  .map(([id, map]) => ({ id, table: map.encounters.table }));

const firstWildMap = wildMaps[0];

/** Every trainer that a map names, keyed by the map the player meets them on. */
function trainersByMap() {
  const found = new Map();
  for (const [mapId, map] of Object.entries(MAPS)) {
    const here = new Set();
    const walk = (steps) => {
      for (const step of steps ?? []) {
        if (!Array.isArray(step)) continue;
        if (step[0] === "battle") here.add(step[1]);
        if (step[0] === "if") {
          walk(step[2]);
          walk(step[3]);
        }
        if (step[0] === "ask") for (const option of step[2] ?? []) walk(option.then);
      }
    };
    for (const npc of map.npcs ?? []) {
      if (npc.trainer) here.add(npc.trainer);
      walk(npc.script);
    }
    for (const trigger of map.triggers ?? []) walk(trigger.script);
    found.set(mapId, here);
  }
  return found;
}

const byMap = trainersByMap();

/** The trainers the player can meet before ever walking into tall grass. */
const trainersBeforeAnyGrass = (() => {
  const found = [];
  for (const mapId of Object.keys(MAPS)) {
    if (mapId === firstWildMap.id) break;
    found.push(...(byMap.get(mapId) ?? []));
  }
  return found;
})();

/** The trainers who stand on the first route. */
const trainersOnFirstRoute = [...(byMap.get(firstWildMap.id) ?? [])];

/** True when this species at this level knows a move that leaves a condition. */
function canInflictStatus(speciesId, level) {
  return movesAtLevel(getSpecies(speciesId), level).some((moveId) =>
    (getMove(moveId)?.effects ?? []).some((effect) => effect.kind === "status"),
  );
}

/** The strongest attack this species knows at this level. Status moves count 0. */
function strongestMove(speciesId, level) {
  const powers = movesAtLevel(getSpecies(speciesId), level).map(
    (moveId) => getMove(moveId)?.power ?? 0,
  );
  return powers.length ? Math.max(...powers) : 0;
}

/** The strongest attack any starter brings to its first battle. */
const STARTER_BEST_MOVE = Math.max(
  ...STARTER_CHOICE.map((entry) => strongestMove(entry.species, entry.level)),
);

/**
 * True when this creature, at this level, holds a move that hits the target
 * species for double damage. It reads the moves and not the types on purpose:
 * a poison creature with no poison move yet threatens nobody.
 */
function hitsHard(speciesId, level, targetSpeciesId) {
  const targetTypes = getSpecies(targetSpeciesId).types;
  return movesAtLevel(getSpecies(speciesId), level).some((moveId) => {
    const move = getMove(moveId);
    return move?.power && effectiveness(move.type, targetTypes) > 1;
  });
}

/** Every script in the game, with a label that says where it came from. */
function allScripts() {
  const found = [];
  for (const [mapId, map] of Object.entries(MAPS)) {
    for (const npc of map.npcs ?? []) {
      if (npc.script) found.push({ mapId, where: `${mapId}/${npc.id}`, script: npc.script });
    }
    for (const trigger of map.triggers ?? []) {
      if (trigger.script) {
        found.push({ mapId, where: `${mapId}/trigger ${trigger.x},${trigger.y}`, script: trigger.script });
      }
    }
  }
  return found;
}

/** Every step of a script, including the branches of `if` and `ask`. */
function flattenScript(steps) {
  const flat = [];
  for (const step of steps ?? []) {
    if (!Array.isArray(step)) continue;
    flat.push(step);
    if (step[0] === "if") flat.push(...flattenScript(step[2]), ...flattenScript(step[3]));
    if (step[0] === "ask") {
      for (const option of step[2] ?? []) flat.push(...flattenScript(option.then));
    }
  }
  return flat;
}

describe("the first grass the player walks into", () => {
  test("holds creatures below the starter's level, the way Route 101 does", () => {
    // Emerald puts Lv 2-3 creatures in front of a Lv 5 starter. A first route
    // that matches the player's level has no easy fight anywhere in it.
    const highest = Math.max(...firstWildMap.table.map((entry) => entry.max));
    expect(`${firstWildMap.id} tops out at Lv ${highest}`).toBe(
      `${firstWildMap.id} tops out at Lv ${STARTER_LEVEL - 1}`,
    );
  });

  test("holds nothing stronger than the weakest starter", () => {
    // Emerald tops the first route out at Zigzagoon, 240 base stat points
    // against a 310 starter. Anything above the player's own total is a wall.
    for (const entry of firstWildMap.table) {
      const total = baseStatTotal(getSpecies(entry.species));
      expect(`${entry.species} (${total}) fits under ${WEAKEST_STARTER}: ${total <= WEAKEST_STARTER}`).toBe(
        `${entry.species} (${total}) fits under ${WEAKEST_STARTER}: true`,
      );
    }
  });

  test("holds none of the seven friends, who are the rare strong ones", () => {
    // The seven stand for real people and carry 327 to 435 base stat points.
    // They belong further along the road, where the player has a team to meet
    // them with. Emerald keeps its rare strong encounters off the first route
    // in the same way.
    for (const entry of firstWildMap.table) {
      expect(`${entry.species} is one of the seven: ${FRIEND_IDS.includes(entry.species)}`).toBe(
        `${entry.species} is one of the seven: false`,
      );
    }
  });

  test("holds nothing that can poison, burn, paralyse or send to sleep", () => {
    // Emerald teaches Wurmple Poison Sting at Lv 5 and stops Route 101 at Lv 3,
    // so the opening hours carry no lasting condition at all. A level 5 creature
    // has around 20 health and poison takes 2 of it every turn, on top of
    // whatever the foe is hitting with.
    for (const entry of firstWildMap.table) {
      const guilty = canInflictStatus(entry.species, entry.max);
      expect(`${entry.species} at Lv ${entry.max} leaves a condition: ${guilty}`).toBe(
        `${entry.species} at Lv ${entry.max} leaves a condition: false`,
      );
    }
  });
});

describe("the three starters", () => {
  test("carry the same number of base stat points, so no choice is behind", () => {
    // Treecko, Torchic and Mudkip all total exactly 310. Baobo totalled 298
    // against 316 and 318, so the grass choice was the weakest creature as well
    // as the one with the worst matchups on the first roads.
    const totals = STARTER_CHOICE.map((entry) => ({
      species: entry.species,
      total: baseStatTotal(getSpecies(entry.species)),
    }));
    const highest = Math.max(...totals.map((entry) => entry.total));
    for (const entry of totals) {
      expect(`${entry.species} totals ${entry.total}`).toBe(`${entry.species} totals ${highest}`);
    }
  });

  test("each attack with the stat they are built around", () => {
    // Every grass move Baobo knew was physical while its best stat was special
    // attack, so it fought with its weaker number. Generation 3, whose damage
    // formula this engine follows, makes every grass move special. Emerald's
    // Treecko is a special attacker with special grass moves, and the two
    // agree.
    for (const entry of STARTER_CHOICE) {
      const species = getSpecies(entry.species);
      const attacks = movesAtLevel(species, entry.level)
        .map((moveId) => getMove(moveId))
        .filter((move) => move?.power);
      const usesBest = attacks.some((move) =>
        move.cat === "physical"
          ? species.base.attack >= species.base.spAttack
          : species.base.spAttack >= species.base.attack,
      );
      expect(`${entry.species} has an attack that uses its better stat: ${usesBest}`).toBe(
        `${entry.species} has an attack that uses its better stat: true`,
      );
    }
  });
});

describe("what the first route is allowed to hit with", () => {
  // Emerald teaches Poochyena its 60 power Bite at Lv 13, and Taillow its 60
  // power Wing Attack at Lv 13 as well. Everything the player meets before that
  // swings 35 to 40 power, which is what the starter itself carries.
  //
  // This game handed both of those moves out at level 5. A level 5 Sumsu with a
  // 60 power flying move, doubled against grass and raised by half again for
  // matching its own element, hit for 180 effective power. It one-shot the
  // grass starter. Nothing on the first route may out-hit the starter.

  test("no wild creature out-hits the starter's own best move", () => {
    for (const entry of firstWildMap.table) {
      const power = strongestMove(entry.species, entry.max);
      expect(`${entry.species} at Lv ${entry.max} hits for ${power}, cap ${STARTER_BEST_MOVE}`).toBe(
        `${entry.species} at Lv ${entry.max} hits for ${Math.min(power, STARTER_BEST_MOVE)}, cap ${STARTER_BEST_MOVE}`,
      );
    }
  });

  test("no trainer met by the end of the first route out-hits it either", () => {
    for (const id of [...trainersBeforeAnyGrass, ...trainersOnFirstRoute]) {
      for (const entry of TRAINERS[id].party) {
        const power = strongestMove(entry.species, entry.level);
        expect(`${id} uses ${entry.species}, hitting for ${power}, cap ${STARTER_BEST_MOVE}`).toBe(
          `${id} uses ${entry.species}, hitting for ${Math.min(power, STARTER_BEST_MOVE)}, cap ${STARTER_BEST_MOVE}`,
        );
      }
    }
  });
});

describe("the wild level curve", () => {
  test("climbs, with no gap the player cannot walk into", () => {
    // Emerald runs Route 101 at Lv 2-3 and Route 102 at Lv 3-4. Two maps in a
    // row overlap, so the player never meets a level wall between them.
    for (let i = 1; i < wildMaps.length; i++) {
      const before = Math.max(...wildMaps[i - 1].table.map((entry) => entry.max));
      const after = Math.min(...wildMaps[i].table.map((entry) => entry.min));
      expect(`${wildMaps[i].id} opens at Lv ${after}, one map back ended at Lv ${before}`).toBe(
        `${wildMaps[i].id} opens at Lv ${Math.min(after, before + 1)}, one map back ended at Lv ${before}`,
      );
    }
  });

  test("lets each map hold a stronger creature than the map before it", () => {
    // The seven friends arrive one map at a time, so meeting one is a moment
    // and not a wall.
    let ceiling = 0;
    for (const map of wildMaps) {
      const highest = Math.max(
        ...map.table.map((entry) => baseStatTotal(getSpecies(entry.species))),
      );
      expect(`${map.id} allows ${highest}, which is at least ${ceiling}: ${highest >= ceiling}`).toBe(
        `${map.id} allows ${highest}, which is at least ${ceiling}: true`,
      );
      ceiling = highest;
    }
  });
});

describe("the first trainers", () => {
  test("the one before any grass brings a single creature at the starter's level", () => {
    // Emerald sends Youngster Calvin with one Poochyena at Lv 5 against a Lv 5
    // starter, and that is the whole first trainer battle.
    expect(trainersBeforeAnyGrass.length).toBeGreaterThan(0);
    for (const id of trainersBeforeAnyGrass) {
      const trainer = TRAINERS[id];
      expect(`${id} brings ${trainer.party.length} creature(s)`).toBe(`${id} brings 1 creature(s)`);
      const highest = Math.max(...trainer.party.map((entry) => entry.level));
      expect(`${id} tops out at Lv ${highest}, limit Lv ${STARTER_LEVEL}`).toBe(
        `${id} tops out at Lv ${Math.min(highest, STARTER_LEVEL)}, limit Lv ${STARTER_LEVEL}`,
      );
    }
  });

  test("nobody before any grass can leave a lasting condition", () => {
    // The player carries no medicine that clears one, and the first shop is
    // four maps away, so a condition here is one the player cannot answer.
    for (const id of trainersBeforeAnyGrass) {
      for (const entry of TRAINERS[id].party) {
        const guilty = canInflictStatus(entry.species, entry.level);
        expect(`${id} uses ${entry.species}, which leaves a condition: ${guilty}`).toBe(
          `${id} uses ${entry.species}, which leaves a condition: false`,
        );
      }
    }
  });

  test("never field a whole party that beats one starter's element", () => {
    // Emerald sends Bug Catcher Rick out with two Wurmple, and bug is twice as
    // strong against Treecko, the grass starter. It is still a fair fight,
    // because a Lv 4 Wurmple knows Tackle and String Shot and does not learn
    // Poison Sting until Lv 5. Not one move in that party is super effective.
    //
    // Watcher Ama used to bring two creatures whose every move hit the grass
    // starter for double. A simulation of the real engine gave Baobo a 0
    // percent win rate against her at every level up to 9. The player still has
    // one creature at this point and cannot switch out of a bad element, so
    // each early party has to leave one creature that any starter can trade
    // with.
    for (const id of [...trainersBeforeAnyGrass, ...trainersOnFirstRoute]) {
      for (const starter of STARTER_CHOICE) {
        const safe = TRAINERS[id].party.filter(
          (entry) => !hitsHard(entry.species, entry.level, starter.species),
        );
        expect(`${id} leaves ${starter.species} ${safe.length} creature(s) to trade with`).not.toBe(
          `${id} leaves ${starter.species} 0 creature(s) to trade with`,
        );
      }
    }
  });

  test("the ones on the first route stay within two levels of the starter", () => {
    // Every trainer on Emerald's Route 102 brings Lv 3 to Lv 5 creatures, and
    // the player walks in at Lv 5. They are level with the player or below.
    const limit = STARTER_LEVEL + 2;
    for (const id of trainersOnFirstRoute) {
      const highest = Math.max(...TRAINERS[id].party.map((entry) => entry.level));
      expect(`${id} tops out at Lv ${highest}, limit Lv ${limit}`).toBe(
        `${id} tops out at Lv ${Math.min(highest, limit)}, limit Lv ${limit}`,
      );
    }
  });
});

describe("scripted fights", () => {
  test("never begin with the party already poisoned", () => {
    // This is the bug the whole file exists for. Mama Sopa's soup poisoned the
    // party and the battle began in the same script, so the player never
    // reached the bag to answer it. Poison after the fight is a joke. Poison
    // before it is a loss the player cannot play out of.
    const offenders = [];
    for (const { where, script } of allScripts()) {
      let poisoned = false;
      for (const step of flattenScript(script)) {
        if (step[0] === "poisonParty") poisoned = true;
        if (step[0] === "battle" && poisoned) offenders.push(`${where} poisons before ${step[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("only poison the party over a choice made in that same scene", () => {
    // The poison moved to after the battle, which means a flag has to carry the
    // player's answer across the fight. The flag has to belong to this scene.
    // `ateSoup` records that the player ever accepted a bowl, so a scene that
    // read it would poison somebody who ate once at the village and refused
    // every time after that.
    // How many scenes set each flag. A flag that stands for "the player said
    // yes, here, just now" is set in exactly one scene.
    const scenesSetting = new Map();
    for (const { where, script } of allScripts()) {
      for (const step of flattenScript(script)) {
        if (step[0] !== "setFlag") continue;
        scenesSetting.set(step[1], (scenesSetting.get(step[1]) ?? new Set()).add(where));
      }
    }

    for (const { where, script } of allScripts()) {
      const steps = flattenScript(script);
      if (!steps.some((step) => step[0] === "poisonParty")) continue;

      const guards = steps
        .filter(
          (step) =>
            step[0] === "if" && flattenScript(step[2]).some((inner) => inner[0] === "poisonParty"),
        )
        .map((step) => step[1]?.flag)
        .filter(Boolean);
      expect(`${where} guards its poison with ${guards.length} flag(s)`).not.toBe(
        `${where} guards its poison with 0 flag(s)`,
      );

      for (const flag of guards) {
        const scenes = scenesSetting.get(flag) ?? new Set();
        expect(`${where} guards on "${flag}", which ${scenes.size} scene(s) set`).toBe(
          `${where} guards on "${flag}", which 1 scene(s) set`,
        );
        expect(`${where} guards on "${flag}", set by this scene: ${scenes.has(where)}`).toBe(
          `${where} guards on "${flag}", set by this scene: true`,
        );
      }
    }
  });

  test("hand the player the cure before anything can poison the party", () => {
    // Emerald sells Antidotes in the first shop, a whole route before the first
    // thing that can poison you. The first shop here is four maps in, so
    // whoever poisons the party first has to hand over the leaf themselves.
    const mapOrder = Object.keys(MAPS);
    const rank = (mapId) => mapOrder.indexOf(mapId);
    const poisons = allScripts()
      .filter(({ script }) => flattenScript(script).some((step) => step[0] === "poisonParty"))
      .map(({ mapId, where }) => ({ rank: rank(mapId), where }));
    const gifts = allScripts()
      .filter(({ script }) =>
        flattenScript(script).some((step) => step[0] === "give" && step[1] === "bitterLeaf"),
      )
      .map(({ mapId }) => rank(mapId));

    for (const poison of poisons) {
      const covered = gifts.some((giftRank) => giftRank <= poison.rank);
      expect(`${poison.where} poisons with the leaf already given: ${covered}`).toBe(
        `${poison.where} poisons with the leaf already given: true`,
      );
    }
  });
});
