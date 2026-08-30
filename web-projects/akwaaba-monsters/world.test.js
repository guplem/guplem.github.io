import { describe, test, expect } from "bun:test";
import {
  DIRECTIONS,
  TILES,
  TILE_IDS,
  characterAt,
  directionTowards,
  facingPosition,
  inBounds,
  isEncounterTile,
  isSolid,
  isTileId,
  ledgeAt,
  oppositeDirection,
  pickEncounter,
  rollsEncounter,
  seesPlayer,
  signAt,
  tileAt,
  tileBehaviour,
  triggersAt,
  tryStep,
  validateMap,
  warpAt,
} from "./world.js";
import { Rng } from "./rng.js";

/**
 *  0123456
 * 0#######
 * 1#..t..#
 * 2#.TTT.#
 * 3#..L..#
 * 4#.....#
 * 5#######
 */
const sample = {
  id: "sample",
  name: "Sample",
  width: 7,
  height: 6,
  legend: { "#": "wall", ".": "path", T: "tall", t: "tree", L: "ledge", "~": "water" },
  ground: [
    "#######",
    "#.....#",
    "#.TTT.#",
    "#..L..#",
    "#.....#",
    "#######",
  ],
  over: [
    "       ",
    "   t   ",
    "       ",
    "       ",
    "       ",
    "       ",
  ],
  warps: [{ x: 1, y: 4, to: "other", tx: 1, ty: 1 }],
  signs: [{ x: 5, y: 1, text: "This way to the river." }],
  triggers: [{ x: 3, y: 4, script: "someScript" }],
  encounters: {
    rate: 0.15,
    table: [
      { species: "sumsu", min: 2, max: 4, weight: 6 },
      { species: "polete", min: 3, max: 5, weight: 4 },
    ],
  },
  npcs: [],
};

describe("the tile table", () => {
  test("names every tile the maps can use", () => {
    for (const id of TILE_IDS) expect(isTileId(id)).toBe(true);
    expect(isTileId("lava")).toBe(false);
  });

  test("has something walkable and something solid", () => {
    expect(TILES.path.solid).toBeUndefined();
    expect(TILES.wall.solid).toBe(true);
  });

  test("makes tall grass the only tile that starts a battle", () => {
    const withEncounters = TILE_IDS.filter((id) => TILES[id].encounter);
    expect(withEncounters).toEqual(["tall"]);
  });
});

describe("reading a map", () => {
  test("finds the tile under a position", () => {
    expect(tileAt(sample, 1, 1)).toBe("path");
    expect(tileAt(sample, 2, 2)).toBe("tall");
    expect(tileAt(sample, 0, 0)).toBe("wall");
  });

  test("lets the over layer win, because that is what you bump into", () => {
    expect(tileAt(sample, 3, 1)).toBe("tree");
  });

  test("gives null outside the map", () => {
    expect(tileAt(sample, -1, 0)).toBeNull();
    expect(tileAt(sample, 99, 0)).toBeNull();
  });

  test("knows what is inside the map", () => {
    expect(inBounds(sample, 0, 0)).toBe(true);
    expect(inBounds(sample, 7, 0)).toBe(false);
    expect(inBounds(sample, 0, -1)).toBe(false);
  });

  test("treats everything outside the map as solid", () => {
    expect(isSolid(sample, -1, 1)).toBe(true);
    expect(isSolid(sample, 1, 1)).toBe(false);
    expect(isSolid(sample, 0, 1)).toBe(true);
  });

  test("treats an unknown tile as solid rather than walking into nothing", () => {
    const broken = { ...sample, legend: { ...sample.legend, ".": "nonsense" } };
    expect(isSolid(broken, 1, 1)).toBe(true);
    expect(tileBehaviour(broken, 1, 1).solid).toBe(true);
  });

  test("finds tall grass", () => {
    expect(isEncounterTile(sample, 2, 2)).toBe(true);
    expect(isEncounterTile(sample, 1, 1)).toBe(false);
  });

  test("finds warps, signs and triggers by position", () => {
    expect(warpAt(sample, 1, 4).to).toBe("other");
    expect(warpAt(sample, 2, 4)).toBeNull();
    expect(signAt(sample, 5, 1).text).toContain("river");
    expect(triggersAt(sample, 3, 4).length).toBe(1);
    expect(triggersAt(sample, 0, 0)).toEqual([]);
  });
});

describe("walking", () => {
  test("moves one tile into open ground", () => {
    const step = tryStep(sample, { x: 1, y: 1 }, "right");
    expect(step).toEqual({ ok: true, x: 2, y: 1, jumped: false, blockedBy: null });
  });

  test("stops at a wall and says why", () => {
    const step = tryStep(sample, { x: 1, y: 1 }, "left");
    expect(step.ok).toBe(false);
    expect(step.blockedBy).toBe("tile");
    expect(step).toMatchObject({ x: 1, y: 1 });
  });

  test("stops at the edge of the map", () => {
    const tiny = { ...sample, legend: { ".": "path" }, ground: ["."], over: null, width: 1, height: 1 };
    expect(tryStep(tiny, { x: 0, y: 0 }, "up").blockedBy).toBe("edge");
  });

  test("stops at a person standing in the way", () => {
    const characters = [{ id: "guard", x: 2, y: 1 }];
    const step = tryStep(sample, { x: 1, y: 1 }, "right", characters);
    expect(step.ok).toBe(false);
    expect(step.blockedBy).toBe("character");
  });

  test("walks straight through a person who is hidden", () => {
    const characters = [{ id: "ghost", x: 2, y: 1, hidden: true }];
    expect(tryStep(sample, { x: 1, y: 1 }, "right", characters).ok).toBe(true);
  });

  test("refuses a direction that is not a direction", () => {
    expect(tryStep(sample, { x: 1, y: 1 }, "sideways").ok).toBe(false);
  });

  test("has exactly four directions", () => {
    expect(Object.keys(DIRECTIONS).sort()).toEqual(["down", "left", "right", "up"]);
  });
});

describe("ledges", () => {
  test("are found where they are drawn", () => {
    expect(ledgeAt(sample, 3, 3)).toBe("down");
    expect(ledgeAt(sample, 1, 1)).toBeNull();
  });

  test("drop the player two tiles when jumped the right way", () => {
    const step = tryStep(sample, { x: 3, y: 2 }, "down");
    expect(step).toEqual({ ok: true, x: 3, y: 4, jumped: true, blockedBy: null });
  });

  test("are a wall from every other side", () => {
    expect(tryStep(sample, { x: 3, y: 4 }, "up").ok).toBe(false);
    expect(tryStep(sample, { x: 2, y: 3 }, "right").ok).toBe(false);
    expect(tryStep(sample, { x: 4, y: 3 }, "left").blockedBy).toBe("ledge");
  });

  test("refuse the jump when the landing spot is taken", () => {
    const blocked = tryStep(sample, { x: 3, y: 2 }, "down", [{ id: "someone", x: 3, y: 4 }]);
    expect(blocked.ok).toBe(false);
  });
});

describe("facing and turning", () => {
  test("finds the tile in front, even when it is solid", () => {
    expect(facingPosition({ x: 1, y: 1 }, "left")).toEqual({ x: 0, y: 1 });
    expect(facingPosition({ x: 1, y: 1 }, "nowhere")).toEqual({ x: 1, y: 1 });
  });

  test("points an NPC at the player", () => {
    expect(directionTowards({ x: 2, y: 2 }, { x: 5, y: 2 })).toBe("right");
    expect(directionTowards({ x: 2, y: 2 }, { x: 2, y: 0 })).toBe("up");
    expect(directionTowards({ x: 2, y: 2 }, { x: 1, y: 5 })).toBe("down");
  });

  test("turns a direction round", () => {
    expect(oppositeDirection("up")).toBe("down");
    expect(oppositeDirection("left")).toBe("right");
  });
});

describe("characterAt", () => {
  test("finds who is standing on a tile", () => {
    const people = [{ id: "a", x: 1, y: 1 }, { id: "b", x: 2, y: 2 }];
    expect(characterAt(people, 2, 2).id).toBe("b");
    expect(characterAt(people, 3, 3)).toBeNull();
    expect(characterAt(undefined, 1, 1)).toBeNull();
  });
});

describe("a trainer spotting the player", () => {
  // Row 4 is clear all the way across, which is what a sight line needs.
  const trainer = { id: "grunt", x: 1, y: 4, dir: "right", sight: 4 };

  test("sees straight down the line it is facing", () => {
    expect(seesPlayer(sample, trainer, { x: 4, y: 4 })).toBe(true);
  });

  test("does not see behind itself", () => {
    expect(seesPlayer(sample, { ...trainer, dir: "left" }, { x: 4, y: 4 })).toBe(false);
  });

  test("does not see past its own range", () => {
    expect(seesPlayer(sample, { ...trainer, sight: 2 }, { x: 4, y: 4 })).toBe(false);
  });

  test("cannot see through a wall", () => {
    // Facing down from row 4, the wall row at y=5 blocks everything beyond it.
    expect(seesPlayer(sample, { ...trainer, dir: "down", sight: 6 }, { x: 1, y: 5 })).toBe(false);
  });

  test("cannot see past a tree standing in the line", () => {
    // The over layer puts a tree at 3,1, so a trainer on row 1 sees no further.
    const onRowOne = { id: "grunt", x: 1, y: 1, dir: "right", sight: 4 };
    expect(seesPlayer(sample, onRowOne, { x: 4, y: 1 })).toBe(false);
    expect(seesPlayer(sample, onRowOne, { x: 2, y: 1 })).toBe(true);
  });

  test("cannot see through another person", () => {
    const blocker = [{ id: "blocker", x: 2, y: 4 }];
    expect(seesPlayer(sample, trainer, { x: 4, y: 4 }, blocker)).toBe(false);
  });

  test("sees nothing at all when it has no sight range", () => {
    expect(seesPlayer(sample, { ...trainer, sight: 0 }, { x: 2, y: 4 })).toBe(false);
  });
});

describe("wild encounters", () => {
  test("only ever happen on tall grass", () => {
    const rng = new Rng(1);
    for (let i = 0; i < 200; i++) expect(rollsEncounter(sample, 1, 1, rng)).toBe(false);
  });

  test("happen sometimes on tall grass, and not every step", () => {
    const rng = new Rng(3);
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (rollsEncounter(sample, 2, 2, rng)) hits++;
    expect(hits).toBeGreaterThan(150);
    expect(hits).toBeLessThan(500);
  });

  test("happen anywhere on a map that says so, which is how caves work", () => {
    const cave = {
      ...sample,
      encounters: { ...sample.encounters, anywhere: true },
    };
    const rng = new Rng(4);
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (rollsEncounter(cave, 1, 1, rng)) hits++;
    expect(hits).toBeGreaterThan(100);
  });

  test("never happen inside a wall, even on a map that says anywhere", () => {
    const cave = { ...sample, encounters: { ...sample.encounters, anywhere: true } };
    const rng = new Rng(4);
    for (let i = 0; i < 200; i++) expect(rollsEncounter(cave, 0, 0, rng)).toBe(false);
  });

  test("never happen on a map with no rate", () => {
    const quiet = { ...sample, encounters: { rate: 0, table: [] } };
    const rng = new Rng(1);
    for (let i = 0; i < 100; i++) expect(rollsEncounter(quiet, 2, 2, rng)).toBe(false);
  });

  test("pick a creature from the table, inside its level band", () => {
    const rng = new Rng(9);
    for (let i = 0; i < 300; i++) {
      const met = pickEncounter(sample, rng);
      const row = sample.encounters.table.find((entry) => entry.species === met.species);
      expect(row).toBeDefined();
      expect(met.level).toBeGreaterThanOrEqual(row.min);
      expect(met.level).toBeLessThanOrEqual(row.max);
    }
  });

  test("favour the heavier entry in the table", () => {
    const rng = new Rng(11);
    let common = 0;
    for (let i = 0; i < 2000; i++) {
      if (pickEncounter(sample, rng).species === "sumsu") common++;
    }
    expect(common).toBeGreaterThan(1000);
  });

  test("give null on a map with nothing to meet", () => {
    expect(pickEncounter({ ...sample, encounters: null }, new Rng(1))).toBeNull();
  });
});

describe("validateMap", () => {
  test("passes a sound map", () => {
    expect(validateMap(sample, { other: sample, sample })).toEqual([]);
  });

  test("catches a row of the wrong width", () => {
    const broken = { ...sample, ground: [...sample.ground.slice(0, 5), "####"] };
    expect(validateMap(broken, { other: sample }).join(" ")).toContain("wide");
  });

  test("catches a legend pointing at a tile that does not exist", () => {
    const broken = { ...sample, legend: { ...sample.legend, ".": "quicksand" } };
    expect(validateMap(broken, { other: sample }).join(" ")).toContain("unknown tile");
  });

  test("catches a character used with nothing in the legend", () => {
    const broken = { ...sample, ground: [...sample.ground.slice(0, 1), "#..X..#", ...sample.ground.slice(2)] };
    expect(validateMap(broken, { other: sample }).join(" ")).toContain("nothing in the legend");
  });

  test("catches a warp pointing at a map that does not exist", () => {
    expect(validateMap(sample, {}).join(" ")).toContain("not a map");
  });

  test("catches a warp landing inside a wall", () => {
    const target = { ...sample, id: "other" };
    const broken = { ...sample, warps: [{ x: 1, y: 4, to: "other", tx: 0, ty: 0 }] };
    expect(validateMap(broken, { other: target }).join(" ")).toContain("solid tile in other");
  });

  test("catches a person standing inside a wall", () => {
    const broken = { ...sample, npcs: [{ id: "lost", x: 0, y: 0 }] };
    expect(validateMap(broken, { other: sample }).join(" ")).toContain("inside a wall");
  });

  test("catches a trigger nothing can ever stand on", () => {
    const broken = { ...sample, triggers: [{ x: 0, y: 0, script: "never" }] };
    expect(validateMap(broken, { other: sample }).join(" ")).toContain("nothing can reach it");
  });

  test("catches an encounter table on a map with no tall grass", () => {
    const broken = {
      ...sample,
      ground: sample.ground.map((row) => row.replace(/T/g, ".")),
    };
    expect(validateMap(broken, { other: sample }).join(" ")).toContain("no tall grass");
  });

  test("allows a cave to have encounters with no grass at all", () => {
    const cave = {
      ...sample,
      ground: sample.ground.map((row) => row.replace(/T/g, ".")),
      encounters: { ...sample.encounters, anywhere: true },
    };
    expect(validateMap(cave, { other: sample }).join(" ")).not.toContain("no tall grass");
  });

  test("catches an encounter with the levels the wrong way round", () => {
    const broken = {
      ...sample,
      encounters: { rate: 0.1, table: [{ species: "sumsu", min: 9, max: 2, weight: 1 }] },
    };
    expect(validateMap(broken, { other: sample }).join(" ")).toContain("min above max");
  });
});
