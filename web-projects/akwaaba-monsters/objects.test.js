import { describe, test, expect } from "bun:test";
import { OBJECTS, OBJECT_TILE_IDS, isObjectTile, objectAt, objectPositions } from "./objects.js";
import { TILES, TILE_IDS, MAP_GROUND, isSolid } from "./world.js";
import { STEP_NAMES, validateScript } from "./events.js";

/** A tiny map with a healing machine and a storage computer against the wall. */
const room = {
  id: "room",
  name: "Room",
  width: 5,
  height: 4,
  base: "floor",
  legend: { "#": "wall", f: "floor", e: "healer", k: "computer" },
  ground: [
    "#####",
    "#ek##",
    "#fff#",
    "#####",
  ],
};

describe("what an object is", () => {
  test("every object names a tile the world engine knows", () => {
    for (const id of OBJECT_TILE_IDS) {
      expect(`${id} is a tile: ${TILE_IDS.includes(id)}`).toBe(`${id} is a tile: true`);
    }
  });

  test("every object is solid, so the player stands in front and faces it", () => {
    // A machine you can walk through is a machine you can never press A on:
    // the player would step onto it instead of facing it.
    for (const id of OBJECT_TILE_IDS) {
      expect(`${id} is solid: ${Boolean(TILES[id].solid)}`).toBe(`${id} is solid: true`);
    }
  });

  test("every object stands on the ground of whatever screen holds it", () => {
    // An object is furniture, not a floor. It has to let the room show through,
    // or it drops a square of the wrong colour into every map that uses it.
    for (const id of OBJECT_TILE_IDS) {
      expect(`${id} stands on: ${TILES[id].base}`).toBe(`${id} stands on: ${MAP_GROUND}`);
    }
  });

  test("says which tiles are objects and which are not", () => {
    expect(isObjectTile("healer")).toBe(true);
    expect(isObjectTile("computer")).toBe(true);
    expect(isObjectTile("sign")).toBe(false);
    expect(isObjectTile("grass")).toBe(false);
    expect(isObjectTile("nothing at all")).toBe(false);
  });

  test("gives every object a name, so a message can talk about it", () => {
    for (const id of OBJECT_TILE_IDS) {
      expect(`${id} name: ${typeof OBJECTS[id].name}`).toBe(`${id} name: string`);
      expect(`${id} name length: ${OBJECTS[id].name.length > 3}`).toBe(`${id} name length: true`);
    }
  });
});

describe("finding an object on a map", () => {
  test("finds the object the player is facing", () => {
    expect(objectAt(room, 1, 1).id).toBe("healer");
    expect(objectAt(room, 2, 1).id).toBe("computer");
  });

  test("gives back the script to run, not only the name", () => {
    expect(Array.isArray(objectAt(room, 1, 1).script)).toBe(true);
  });

  test("gives null where there is no object", () => {
    expect(objectAt(room, 1, 2)).toBeNull();
    expect(objectAt(room, 0, 0)).toBeNull();
    expect(objectAt(room, 99, 99)).toBeNull();
  });

  test("lists every object standing on a map, so a test can check the room", () => {
    const found = objectPositions(room);
    expect(found).toEqual([
      { id: "healer", x: 1, y: 1 },
      { id: "computer", x: 2, y: 1 },
    ]);
  });

  test("lists nothing on a map that holds no object", () => {
    const bare = { ...room, ground: ["#####", "#fff#", "#fff#", "#####"] };
    expect(objectPositions(bare)).toEqual([]);
  });
});

describe("what each object does", () => {
  test("every script uses only steps the engine understands", () => {
    for (const id of OBJECT_TILE_IDS) {
      const problems = validateScript(OBJECTS[id].script, {}, id);
      expect(`${id}: ${problems.join(" | ")}`).toBe(`${id}: `);
    }
  });

  /** Every step name anywhere in a script, including inside branches. */
  function stepsIn(script) {
    const names = [];
    const walk = (steps) => {
      for (const step of steps ?? []) {
        if (!Array.isArray(step) || step.length === 0) continue;
        names.push(step[0]);
        if (step[0] === "if") {
          walk(step[2]);
          walk(step[3]);
        }
        if (step[0] === "ask") for (const option of step[2] ?? []) walk(option.then);
      }
    };
    walk(script);
    return names;
  }

  test("the healing machine heals the party", () => {
    expect(stepsIn(OBJECTS.healer.script)).toContain("heal");
  });

  test("the storage computer opens the box", () => {
    expect(stepsIn(OBJECTS.computer.script)).toContain("box");
  });

  test("every object says something before it does anything", () => {
    // A machine that heals in silence looks broken. The first step a player
    // meets is always a line of text.
    for (const id of OBJECT_TILE_IDS) {
      expect(`${id} first step: ${OBJECTS[id].script[0][0]}`).toBe(`${id} first step: if`);
      expect(`${id} opens with words: ${stepsIn(OBJECTS[id].script)[1]}`).toBe(
        `${id} opens with words: say`,
      );
    }
  });

  test("every object has an answer for a player who carries no creature", () => {
    // Healing nothing and storing nothing are both confusing. Each script
    // checks for an empty party first and says so.
    for (const id of OBJECT_TILE_IDS) {
      const [name, condition] = OBJECTS[id].script[0];
      expect(`${id}: ${name}`).toBe(`${id}: if`);
      expect(`${id}: ${JSON.stringify(condition)}`).toBe(`${id}: {"partyEmpty":true}`);
    }
  });

  test("uses only step names the engine lists", () => {
    for (const id of OBJECT_TILE_IDS) {
      for (const name of stepsIn(OBJECTS[id].script)) {
        expect(`${id}/${name}: ${STEP_NAMES.includes(name)}`).toBe(`${id}/${name}: true`);
      }
    }
  });
});

describe("an object can be reached", () => {
  test("the player can stand next to it and face it", () => {
    // The same rule the signs follow. An object walled in on all four sides is
    // a machine nobody can ever use.
    for (const { id, x, y } of objectPositions(room)) {
      const neighbours = [
        [x, y + 1],
        [x, y - 1],
        [x + 1, y],
        [x - 1, y],
      ].filter(([nx, ny]) => !isSolid(room, nx, ny));
      expect(`${id} can be faced: ${neighbours.length > 0}`).toBe(`${id} can be faced: true`);
    }
  });
});
