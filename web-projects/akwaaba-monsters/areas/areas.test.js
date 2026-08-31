import { describe, test, expect } from "bun:test";
import {
  AREAS,
  BADGES,
  MAPS,
  STARTER_CHOICE,
  TRAINERS,
  getBadge,
  getMap,
  getTrainer,
  spawnCharacters,
} from "./index.js";
import { isGroundTile, isSolid, seesPlayer, validateMap, warpAt } from "../world.js";
import { OBJECTS, OBJECT_TILE_IDS, objectPositions } from "../objects.js";
import { validateScript } from "../events.js";
import { SPECIES, SPECIES_IDS, getSpecies } from "../species.js";
import { ITEM_IDS, ITEMS } from "../items.js";
import { PEOPLE_IDS } from "../art/people.js";
import { SONG_IDS } from "../music.js";
import { START } from "../save.js";
import { createMonster } from "../monsters.js";
import { Rng } from "../rng.js";

const mapIds = Object.keys(MAPS);
const known = {
  items: new Set(ITEM_IDS),
  species: new Set(SPECIES_IDS),
  maps: new Set(mapIds),
  trainers: new Set(Object.keys(TRAINERS)),
};

/** Every script anywhere in the game, with a label saying where it came from. */
function allScripts() {
  const found = [];
  for (const [mapId, map] of Object.entries(MAPS)) {
    for (const npc of map.npcs ?? []) {
      if (npc.script) found.push({ where: `${mapId}/${npc.id}`, script: npc.script });
    }
    for (const sign of map.signs ?? []) {
      if (sign.script) found.push({ where: `${mapId}/sign ${sign.x},${sign.y}`, script: sign.script });
    }
    for (const trigger of map.triggers ?? []) {
      found.push({ where: `${mapId}/trigger ${trigger.x},${trigger.y}`, script: trigger.script });
    }
  }
  // The objects standing in the world run scripts too, and a player reads them
  // the same way, so every check below has to see them.
  for (const id of OBJECT_TILE_IDS) {
    found.push({ where: `object ${id}`, script: OBJECTS[id].script });
  }
  return found;
}

/** Every object standing on any map of the game, with the map it stands on. */
function allObjects() {
  return Object.entries(MAPS).flatMap(([mapId, map]) =>
    objectPositions(map).map((entry) => ({ ...entry, mapId, map })),
  );
}

describe("the area register", () => {
  test("holds at least one area", () => {
    expect(AREAS.length).toBeGreaterThan(0);
  });

  test("gives the first area the ten maps it was built with", () => {
    expect(mapIds.length).toBe(10);
  });

  test("finds things by name and gives null for a name that is not there", () => {
    expect(getMap("village").name).toBe("Aduma Village");
    expect(getMap("kanto")).toBeNull();
    expect(getTrainer("nanaKofi").name).toBe("Nana Kofi");
    expect(getTrainer("brock")).toBeNull();
    expect(getBadge("riverStone").name).toBe("River Stone Badge");
    expect(getBadge("boulder")).toBeNull();
  });
});

describe("every map is sound", () => {
  test("passes the world engine's own checks", () => {
    for (const [id, map] of Object.entries(MAPS)) {
      expect(`${id}: ${validateMap(map, MAPS).join(" | ")}`).toBe(`${id}: `);
    }
  });

  test("gives every map a ground it is made of", () => {
    // A palm tree, a rock and a patch of tall grass are all drawn with holes in
    // them, and this is what shows through. A map with no ground would show the
    // void through every one of them.
    for (const [id, map] of Object.entries(MAPS)) {
      expect(`${id}: ${isGroundTile(map.base)}`).toBe(`${id}: true`);
    }
  });

  test("gives every map a name and a song the audio engine knows", () => {
    for (const [id, map] of Object.entries(MAPS)) {
      expect(map.name.length).toBeGreaterThan(2);
      expect(`${id}: ${SONG_IDS.includes(map.music)}`).toBe(`${id}: true`);
    }
  });

  test("uses only people the art can draw", () => {
    for (const map of Object.values(MAPS)) {
      for (const npc of map.npcs ?? []) {
        expect(`${npc.id}: ${npc.sprite}`).toBe(`${npc.id}: ${npc.sprite}`);
        expect(PEOPLE_IDS).toContain(npc.sprite);
      }
    }
  });

  test("gives every person on every map a different identifier", () => {
    for (const [id, map] of Object.entries(MAPS)) {
      const ids = (map.npcs ?? []).map((npc) => npc.id);
      expect(`${id}: ${new Set(ids).size}`).toBe(`${id}: ${ids.length}`);
    }
  });

  test("never puts two people on the same tile", () => {
    for (const [id, map] of Object.entries(MAPS)) {
      const spots = (map.npcs ?? []).map((npc) => `${npc.x},${npc.y}`);
      expect(`${id}: ${new Set(spots).size}`).toBe(`${id}: ${spots.length}`);
    }
  });

  test("never puts a person on a warp, which would trap the player", () => {
    for (const [id, map] of Object.entries(MAPS)) {
      for (const npc of map.npcs ?? []) {
        expect(`${id}/${npc.id} on a warp: ${Boolean(warpAt(map, npc.x, npc.y))}`).toBe(
          `${id}/${npc.id} on a warp: false`,
        );
      }
    }
  });

  test("puts every sign on something solid, so the player faces it to read it", () => {
    for (const [id, map] of Object.entries(MAPS)) {
      for (const sign of map.signs ?? []) {
        expect(`${id} sign ${sign.x},${sign.y} solid: ${isSolid(map, sign.x, sign.y)}`).toBe(
          `${id} sign ${sign.x},${sign.y} solid: true`,
        );
      }
    }
  });

  test("gives every sign either words to read or a script to run", () => {
    for (const map of Object.values(MAPS)) {
      for (const sign of map.signs ?? []) {
        expect(Boolean(sign.text || sign.script)).toBe(true);
      }
    }
  });
});

describe("the machines standing in the world", () => {
  test("puts every kind of object somewhere, so none of them is only a drawing", () => {
    const standing = new Set(allObjects().map((entry) => entry.id));
    for (const id of OBJECT_TILE_IDS) {
      expect(`${id} stands somewhere: ${standing.has(id)}`).toBe(`${id} stands somewhere: true`);
    }
  });

  test("leaves a square in front of every object, so the player can face it", () => {
    // The same rule the signs follow. An object walled in on all four sides is
    // a machine nobody can ever press A on.
    for (const { id, x, y, mapId, map } of allObjects()) {
      const open = [
        [x, y + 1],
        [x, y - 1],
        [x + 1, y],
        [x - 1, y],
      ].filter(([nx, ny]) => !isSolid(map, nx, ny));
      expect(`${mapId} ${id} ${x},${y} can be faced: ${open.length > 0}`).toBe(
        `${mapId} ${id} ${x},${y} can be faced: true`,
      );
    }
  });

  test("never stands an object on a warp, which would hide the way out", () => {
    for (const { id, x, y, mapId, map } of allObjects()) {
      expect(`${mapId} ${id} on a warp: ${Boolean(warpAt(map, x, y))}`).toBe(
        `${mapId} ${id} on a warp: false`,
      );
    }
  });

  test("gives the player somewhere to heal and somewhere to store", () => {
    // Every map can be reached from the start, which an earlier test proves, so
    // one of each anywhere in the area is one of each the player can walk to.
    const standing = allObjects();
    expect(standing.some((entry) => entry.id === "healer")).toBe(true);
    expect(standing.some((entry) => entry.id === "computer")).toBe(true);
  });

  test("puts a healing machine where the first creature is chosen", () => {
    // The player leaves that room with one creature and no items. The nearest
    // other machine is a village, a route and a river away.
    const choosingMaps = Object.entries(MAPS).filter(([, map]) =>
      (map.npcs ?? []).some((npc) =>
        JSON.stringify(npc.script ?? []).includes('"chooseStarter"'),
      ),
    );
    expect(choosingMaps.length).toBeGreaterThan(0);
    for (const [id, map] of choosingMaps) {
      const kinds = objectPositions(map).map((entry) => entry.id);
      expect(`${id} heals: ${kinds.includes("healer")}`).toBe(`${id} heals: true`);
    }
  });

  test("stands a storage computer beside every healing machine", () => {
    // Both jobs belong in the same visit: a player who walks somewhere to heal
    // should not have to walk somewhere else to move a creature.
    const byMap = new Map();
    for (const { id, mapId } of allObjects()) {
      if (!byMap.has(mapId)) byMap.set(mapId, new Set());
      byMap.get(mapId).add(id);
    }
    for (const [mapId, kinds] of byMap) {
      if (!kinds.has("healer")) continue;
      expect(`${mapId} also stores: ${kinds.has("computer")}`).toBe(`${mapId} also stores: true`);
    }
  });
});

describe("the maps join up", () => {
  test("every warp leads to a map that exists", () => {
    for (const map of Object.values(MAPS)) {
      for (const warp of map.warps ?? []) expect(MAPS[warp.to]).toBeDefined();
    }
  });

  test("every warp lands somewhere the player can stand", () => {
    for (const [id, map] of Object.entries(MAPS)) {
      for (const warp of map.warps ?? []) {
        const target = MAPS[warp.to];
        expect(`${id}->${warp.to}: ${isSolid(target, warp.tx, warp.ty)}`).toBe(
          `${id}->${warp.to}: false`,
        );
      }
    }
  });

  test("every warp leads back the way it came, so nobody is stranded", () => {
    for (const [id, map] of Object.entries(MAPS)) {
      for (const warp of map.warps ?? []) {
        const target = MAPS[warp.to];
        const returnWarps = (target.warps ?? []).filter((back) => back.to === id);
        expect(`${id} -> ${warp.to} has a way back: ${returnWarps.length > 0}`).toBe(
          `${id} -> ${warp.to} has a way back: true`,
        );
      }
    }
  });

  test("every map can be reached from where a new game starts", () => {
    const seen = new Set([START.map]);
    const queue = [START.map];
    while (queue.length > 0) {
      const current = MAPS[queue.shift()];
      for (const warp of current.warps ?? []) {
        if (seen.has(warp.to)) continue;
        seen.add(warp.to);
        queue.push(warp.to);
      }
    }
    expect([...seen].sort()).toEqual([...mapIds].sort());
  });

  test("a new game starts somewhere the player can stand", () => {
    const start = MAPS[START.map];
    expect(start).toBeDefined();
    expect(isSolid(start, START.x, START.y)).toBe(false);
  });

  test("a new game does not start on top of a warp", () => {
    expect(warpAt(MAPS[START.map], START.x, START.y)).toBeNull();
  });
});

describe("every script is sound", () => {
  test("names only things that exist", () => {
    for (const { where, script } of allScripts()) {
      expect(`${where}: ${validateScript(script, known, where).join(" | ")}`).toBe(`${where}: `);
    }
  });

  test("gives every line of dialogue real words", () => {
    for (const { where, script } of allScripts()) {
      const walk = (steps) => {
        for (const step of steps) {
          if (!Array.isArray(step)) continue;
          if (step[0] === "say") {
            expect(`${where}: ${step[1].length > 8}`).toBe(`${where}: true`);
          }
          if (step[0] === "if") {
            walk(step[2] ?? []);
            walk(step[3] ?? []);
          }
          if (step[0] === "ask") for (const option of step[2] ?? []) walk(option.then ?? []);
        }
      };
      walk(script);
    }
  });

  test("only plays songs the audio engine knows", () => {
    for (const { where, script } of allScripts()) {
      const walk = (steps) => {
        for (const step of steps) {
          if (!Array.isArray(step)) continue;
          if (step[0] === "music") expect(`${where}: ${SONG_IDS.includes(step[1])}`).toBe(`${where}: true`);
          if (step[0] === "if") {
            walk(step[2] ?? []);
            walk(step[3] ?? []);
          }
          if (step[0] === "ask") for (const option of step[2] ?? []) walk(option.then ?? []);
        }
      };
      walk(script);
    }
  });

  test("only awards badges that exist", () => {
    for (const { script } of allScripts()) {
      const walk = (steps) => {
        for (const step of steps) {
          if (!Array.isArray(step)) continue;
          if (step[0] === "badge") expect(BADGES[step[1]]).toBeDefined();
          if (step[0] === "if") {
            walk(step[2] ?? []);
            walk(step[3] ?? []);
          }
          if (step[0] === "ask") for (const option of step[2] ?? []) walk(option.then ?? []);
        }
      };
      walk(script);
    }
  });

  test("only sells items the shop can price", () => {
    for (const { script } of allScripts()) {
      const walk = (steps) => {
        for (const step of steps) {
          if (!Array.isArray(step)) continue;
          if (step[0] === "shop") {
            for (const id of step[1] ?? []) {
              expect(ITEMS[id]).toBeDefined();
              expect(ITEMS[id].price).toBeGreaterThan(0);
            }
          }
          if (step[0] === "if") {
            walk(step[2] ?? []);
            walk(step[3] ?? []);
          }
        }
      };
      walk(script);
    }
  });

  test("only walks people who are actually on that map", () => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      const people = new Set((map.npcs ?? []).map((npc) => npc.id));
      const scripts = [
        ...(map.npcs ?? []).map((npc) => npc.script ?? []),
        ...(map.triggers ?? []).map((trigger) => trigger.script ?? []),
      ];
      for (const script of scripts) {
        const walk = (steps) => {
          for (const step of steps) {
            if (!Array.isArray(step)) continue;
            if (["walk", "face", "hide", "show"].includes(step[0])) {
              expect(`${mapId} moves ${step[1]}: ${people.has(step[1])}`).toBe(
                `${mapId} moves ${step[1]}: true`,
              );
            }
            if (step[0] === "if") {
              walk(step[2] ?? []);
              walk(step[3] ?? []);
            }
            if (step[0] === "ask") for (const option of step[2] ?? []) walk(option.then ?? []);
          }
        };
        walk(script);
      }
    }
  });
});

describe("the trainers", () => {
  const allTrainers = Object.entries(TRAINERS);

  test("all have a name, a sprite, a prize and at least one creature", () => {
    for (const [id, trainer] of allTrainers) {
      expect(trainer.name.length).toBeGreaterThan(2);
      expect(`${id}: ${PEOPLE_IDS.includes(trainer.sprite)}`).toBe(`${id}: true`);
      expect(trainer.prize).toBeGreaterThan(0);
      expect(trainer.party.length).toBeGreaterThan(0);
      expect(trainer.party.length).toBeLessThanOrEqual(6);
    }
  });

  test("only use creatures that exist, at levels the game can build", () => {
    for (const [id, trainer] of allTrainers) {
      for (const entry of trainer.party) {
        expect(`${id}: ${Boolean(getSpecies(entry.species))}`).toBe(`${id}: true`);
        expect(entry.level).toBeGreaterThan(0);
        expect(entry.level).toBeLessThanOrEqual(100);
      }
    }
  });

  test("every party can actually be built and can fight", () => {
    for (const [id, trainer] of allTrainers) {
      for (const entry of trainer.party) {
        const monster = createMonster({ ...entry, rng: new Rng(1) });
        expect(monster.hp).toBeGreaterThan(0);
        expect(`${id}/${entry.species} has moves: ${monster.moves.length > 0}`).toBe(
          `${id}/${entry.species} has moves: true`,
        );
      }
    }
  });

  test("all have something to say before and after the fight", () => {
    for (const trainer of Object.values(TRAINERS)) {
      expect(trainer.intro.length).toBeGreaterThan(10);
      expect(trainer.defeat.length).toBeGreaterThan(5);
    }
  });

  test("are named by somebody on a map, so none is unreachable", () => {
    const used = new Set();
    for (const map of Object.values(MAPS)) {
      for (const npc of map.npcs ?? []) if (npc.trainer) used.add(npc.trainer);
      const walk = (steps) => {
        for (const step of steps ?? []) {
          if (!Array.isArray(step)) continue;
          if (step[0] === "battle") used.add(step[1]);
          if (step[0] === "if") {
            walk(step[2]);
            walk(step[3]);
          }
          if (step[0] === "ask") for (const option of step[2] ?? []) walk(option.then);
        }
      };
      for (const npc of map.npcs ?? []) walk(npc.script);
      for (const trigger of map.triggers ?? []) walk(trigger.script);
    }
    expect([...Object.keys(TRAINERS)].sort()).toEqual([...used].sort());
  });

  test("rise in strength along the road, so the difficulty climbs", () => {
    const highest = (id) => Math.max(...TRAINERS[id].party.map((entry) => entry.level));
    expect(highest("mamaSopa1")).toBeLessThan(highest("mamaSopa2"));
    expect(highest("mamaSopa2")).toBeLessThan(highest("mamaSopa3"));
    expect(highest("grunt1")).toBeLessThan(highest("grunt4"));
    expect(highest("grunt4")).toBeLessThan(highest("nanaSika"));
    expect(highest("farmerKojo")).toBeLessThan(highest("nanaKofi"));
  });

  test("give the gym leader the last word: nobody in the area is stronger", () => {
    // Nana Sika used to be exempt from this, and his ace sat level with the
    // leader's. Emerald keeps the villain the player meets before a gym well
    // under the gym leader, so the badge is still the hardest thing in the
    // town. He is now under it too, and the exemption is gone.
    const highest = (trainer) => Math.max(...trainer.party.map((entry) => entry.level));
    const leader = highest(TRAINERS.nanaKofi);
    for (const [id, trainer] of allTrainers) {
      if (id === "nanaKofi") continue;
      expect(`${id}: ${highest(trainer) <= leader}`).toBe(`${id}: true`);
    }
  });

  test("keep the gym to its own element, so the badge means something", () => {
    for (const entry of TRAINERS.nanaKofi.party) {
      expect(getSpecies(entry.species).types).toContain("earth");
    }
  });

  test("give the antagonist the creature that stands for authority", () => {
    // Carsla is the oppressive one. The boss of Equip Galamsey uses it, which
    // is the only place in the area it appears.
    expect(TRAINERS.nanaSika.party.map((entry) => entry.species)).toContain("carsla");
  });

  test("give Mama Sopa the soup, which is the whole joke", () => {
    for (const id of ["mamaSopa1", "mamaSopa2", "mamaSopa3"]) {
      const types = TRAINERS[id].party.flatMap((entry) => getSpecies(entry.species).types);
      expect(`${id}: ${types.includes("poison")}`).toBe(`${id}: true`);
    }
  });
});

describe("the starters", () => {
  test("are three, and all exist", () => {
    expect(STARTER_CHOICE.length).toBe(3);
    for (const entry of STARTER_CHOICE) {
      expect(getSpecies(entry.species)).toBeDefined();
      expect(entry.level).toBeGreaterThan(0);
      expect(entry.blurb.length).toBeGreaterThan(20);
    }
  });

  test("all start at the same level, so no choice is behind", () => {
    expect(new Set(STARTER_CHOICE.map((entry) => entry.level)).size).toBe(1);
  });

  test("cover grass, fire and water", () => {
    const types = STARTER_CHOICE.map((entry) => getSpecies(entry.species).types[0]);
    expect(types.sort()).toEqual(["fire", "grass", "water"]);
  });
});

describe("the creatures the player can meet", () => {
  const encounterTables = Object.entries(MAPS)
    .filter(([, map]) => map.encounters)
    .map(([id, map]) => ({ id, table: map.encounters.table }));

  test("every wild table names creatures that exist", () => {
    for (const { id, table } of encounterTables) {
      for (const entry of table) {
        expect(`${id}: ${Boolean(SPECIES[entry.species])}`).toBe(`${id}: true`);
        expect(entry.weight).toBeGreaterThan(0);
      }
    }
  });

  test("the levels rise as the player goes further", () => {
    const highest = (id) => Math.max(...MAPS[id].encounters.table.map((entry) => entry.max));
    expect(highest("route1")).toBeLessThan(highest("river"));
    expect(highest("river")).toBeLessThan(highest("mine"));
  });

  test("all seven of the friends can be met somewhere in the area", () => {
    // This is the point of the whole area. If a change hides one of them, this
    // test is the thing that says so.
    const wild = new Set(encounterTables.flatMap(({ table }) => table.map((e) => e.species)));
    const fromTrainers = new Set(
      Object.values(TRAINERS).flatMap((trainer) => trainer.party.map((entry) => entry.species)),
    );
    const fromScripts = new Set();
    for (const { script } of allScripts()) {
      const walk = (steps) => {
        for (const step of steps ?? []) {
          if (!Array.isArray(step)) continue;
          if (step[0] === "wildBattle" || step[0] === "giveMonster") fromScripts.add(step[1]);
          if (step[0] === "if") {
            walk(step[2]);
            walk(step[3]);
          }
          if (step[0] === "ask") for (const option of step[2] ?? []) walk(option.then);
        }
      };
      walk(script);
    }
    const anywhere = new Set([...wild, ...fromTrainers, ...fromScripts]);
    for (const id of ["hinoko", "polete", "nacho", "seryi", "carsla", "gis", "poya"]) {
      expect(`${id} appears: ${anywhere.has(id)}`).toBe(`${id} appears: true`);
    }
  });

  test("six of the seven can actually be caught, and Carsla is the boss's alone", () => {
    const catchable = new Set();
    for (const { table } of encounterTables) for (const entry of table) catchable.add(entry.species);
    for (const { script } of allScripts()) {
      const walk = (steps) => {
        for (const step of steps ?? []) {
          if (!Array.isArray(step)) continue;
          if (step[0] === "wildBattle") catchable.add(step[1]);
          if (step[0] === "if") {
            walk(step[2]);
            walk(step[3]);
          }
          if (step[0] === "ask") for (const option of step[2] ?? []) walk(option.then);
        }
      };
      walk(script);
    }
    for (const id of ["hinoko", "polete", "nacho", "seryi", "gis", "poya"]) {
      expect(`${id} catchable: ${catchable.has(id)}`).toBe(`${id} catchable: true`);
    }
    expect(catchable.has("carsla")).toBe(false);
  });
});

describe("the trainers standing on the maps", () => {
  test("all name a trainer the game has", () => {
    for (const map of Object.values(MAPS)) {
      for (const npc of map.npcs ?? []) {
        if (!npc.trainer) continue;
        expect(TRAINERS[npc.trainer]).toBeDefined();
        expect(npc.defeatFlag).toBeString();
      }
    }
  });

  test("all use a different flag to remember they were beaten", () => {
    const flags = [];
    for (const map of Object.values(MAPS)) {
      for (const npc of map.npcs ?? []) if (npc.defeatFlag) flags.push(npc.defeatFlag);
    }
    expect(new Set(flags).size).toBe(flags.length);
  });

  test("can all see the player walk past, or the fight never starts", () => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      for (const npc of map.npcs ?? []) {
        if (!npc.trainer || !npc.sight) continue;
        // Somewhere in the sight line there has to be a tile the player can
        // stand on. A trainer facing a wall is a trainer nobody ever fights.
        let reachable = false;
        for (let distance = 1; distance <= npc.sight; distance++) {
          const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[npc.dir];
          const x = npc.x + step[0] * distance;
          const y = npc.y + step[1] * distance;
          if (isSolid(map, x, y)) break;
          if (seesPlayer(map, npc, { x, y })) reachable = true;
        }
        expect(`${mapId}/${npc.id} can spot somebody: ${reachable}`).toBe(
          `${mapId}/${npc.id} can spot somebody: true`,
        );
      }
    }
  });
});

describe("spawnCharacters", () => {
  test("remembers where each person started, so a map can be reset", () => {
    const people = spawnCharacters(MAPS.village);
    expect(people.length).toBeGreaterThan(0);
    for (const person of people) {
      expect(person.startX).toBe(person.x);
      expect(person.startY).toBe(person.y);
      expect(person.frame).toBe(0);
    }
  });

  test("leaves the map data untouched, so reloading gives a clean copy", () => {
    const people = spawnCharacters(MAPS.village);
    people[0].x = 99;
    expect(MAPS.village.npcs[0].x).not.toBe(99);
  });

  test("copes with a map that has nobody on it", () => {
    expect(spawnCharacters({ id: "empty" })).toEqual([]);
  });
});
