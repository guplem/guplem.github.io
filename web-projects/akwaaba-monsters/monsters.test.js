import { describe, test, expect } from "bun:test";
import {
  MAX_LEVEL,
  MOVE_SLOTS,
  buildMoveSlots,
  createMonster,
  displayName,
  evolve,
  expForLevel,
  expToNextLevel,
  expYield,
  firstHealthy,
  flatIvs,
  gainExp,
  healParty,
  healed,
  isFainted,
  learnMove,
  levelFromExp,
  levelProgress,
  maxHp,
  outOfPp,
  partyCanFight,
  restoreHp,
  restorePp,
  rollIvs,
  statsAtLevel,
  statsOf,
} from "./monsters.js";
import { SPECIES_IDS, getSpecies } from "./species.js";
import { Rng } from "./rng.js";

const perfect = flatIvs(31);

describe("experience curves", () => {
  test("start at 1 point for level 1 and grow with the cube of the level", () => {
    expect(expForLevel("medium", 1)).toBe(1);
    expect(expForLevel("medium", 10)).toBe(1000);
    expect(expForLevel("medium", 50)).toBe(125000);
  });

  test("make fast creatures cheaper and slow ones dearer", () => {
    expect(expForLevel("fast", 20)).toBeLessThan(expForLevel("medium", 20));
    expect(expForLevel("slow", 20)).toBeGreaterThan(expForLevel("medium", 20));
  });

  test("never go backwards as the level rises", () => {
    for (const growth of ["fast", "medium", "slow"]) {
      for (let level = 2; level <= MAX_LEVEL; level++) {
        expect(expForLevel(growth, level)).toBeGreaterThan(expForLevel(growth, level - 1));
      }
    }
  });

  test("fall back to the medium curve for an unknown growth name", () => {
    expect(expForLevel("turbo", 10)).toBe(expForLevel("medium", 10));
  });

  test("clamp a level outside the allowed range", () => {
    expect(expForLevel("medium", 0)).toBe(expForLevel("medium", 1));
    expect(expForLevel("medium", 500)).toBe(expForLevel("medium", MAX_LEVEL));
  });
});

describe("levelFromExp", () => {
  test("is the exact opposite of expForLevel", () => {
    for (const growth of ["fast", "medium", "slow"]) {
      for (let level = 1; level <= MAX_LEVEL; level++) {
        expect(levelFromExp(growth, expForLevel(growth, level))).toBe(level);
      }
    }
  });

  test("does not round up until the next threshold is actually reached", () => {
    expect(levelFromExp("medium", expForLevel("medium", 10) - 1)).toBe(9);
  });

  test("never goes above the maximum level", () => {
    expect(levelFromExp("medium", 99999999)).toBe(MAX_LEVEL);
  });
});

describe("statsAtLevel", () => {
  test("gives more health than any other stat, because health has its own formula", () => {
    const stats = statsAtLevel(getSpecies("baobo"), 50, perfect);
    expect(stats.hp).toBeGreaterThan(stats.defense);
  });

  test("grows every stat as the level grows", () => {
    const low = statsAtLevel(getSpecies("poya"), 5, perfect);
    const high = statsAtLevel(getSpecies("poya"), 40, perfect);
    for (const key of Object.keys(low)) expect(high[key]).toBeGreaterThan(low[key]);
  });

  test("rewards better hidden talent numbers", () => {
    const dull = statsAtLevel(getSpecies("gis"), 50, flatIvs(0));
    const gifted = statsAtLevel(getSpecies("gis"), 50, flatIvs(31));
    expect(gifted.speed).toBeGreaterThan(dull.speed);
  });

  test("treats a missing talent number as zero instead of crashing", () => {
    const stats = statsAtLevel(getSpecies("gis"), 20, {});
    expect(Number.isFinite(stats.speed)).toBe(true);
  });

  test("gives a level 5 starter roughly twenty health, the way the real games do", () => {
    const stats = statsAtLevel(getSpecies("baobo"), 5, flatIvs(15));
    expect(stats.hp).toBeGreaterThanOrEqual(17);
    expect(stats.hp).toBeLessThanOrEqual(24);
  });
});

describe("createMonster", () => {
  test("builds a healthy creature at the level asked for", () => {
    const monster = createMonster({ species: "volti", level: 5, rng: new Rng(1) });
    expect(monster.species).toBe("volti");
    expect(monster.level).toBe(5);
    expect(monster.hp).toBe(maxHp(monster));
    expect(monster.status).toBeNull();
  });

  test("gives it the moves its species knows at that level", () => {
    const monster = createMonster({ species: "baobo", level: 9, rng: new Rng(1) });
    expect(monster.moves.map((slot) => slot.id)).toEqual([
      "tackle",
      "growl",
      "vineWhip",
      "deepRoots",
    ]);
  });

  test("never gives more than four moves", () => {
    for (const id of SPECIES_IDS) {
      const monster = createMonster({ species: id, level: 100, rng: new Rng(4) });
      expect(monster.moves.length).toBeLessThanOrEqual(MOVE_SLOTS);
    }
  });

  test("fills every move to its full power points", () => {
    const monster = createMonster({ species: "polete", level: 20, rng: new Rng(2) });
    for (const slot of monster.moves) expect(slot.pp).toBeGreaterThan(0);
  });

  test("starts with exactly the experience its level needs", () => {
    const monster = createMonster({ species: "gori", level: 12, rng: new Rng(3) });
    expect(monster.exp).toBe(expForLevel(getSpecies("gori").growth, 12));
    expect(levelFromExp(getSpecies("gori").growth, monster.exp)).toBe(12);
  });

  test("clamps a silly level instead of building a broken creature", () => {
    expect(createMonster({ species: "gori", level: 0, rng: new Rng(1) }).level).toBe(1);
    expect(createMonster({ species: "gori", level: 900, rng: new Rng(1) }).level).toBe(MAX_LEVEL);
  });

  test("refuses an unknown species loudly", () => {
    expect(() => createMonster({ species: "charizard" })).toThrow();
  });

  test("survives being written to JSON and read back, which is what saving does", () => {
    const monster = createMonster({ species: "seryi", level: 18, rng: new Rng(9) });
    expect(JSON.parse(JSON.stringify(monster))).toEqual(monster);
  });

  test("builds every species in the game without error", () => {
    for (const id of SPECIES_IDS) {
      const monster = createMonster({ species: id, level: 15, rng: new Rng(5) });
      expect(monster.hp).toBeGreaterThan(0);
      expect(monster.moves.length).toBeGreaterThan(0);
    }
  });
});

describe("names", () => {
  test("shows the species name when there is no nickname", () => {
    expect(displayName(createMonster({ species: "nacho", rng: new Rng(1) }))).toBe("Nacho");
  });

  test("shows the nickname when there is one", () => {
    const monster = createMonster({ species: "nacho", nickname: "Big Man", rng: new Rng(1) });
    expect(displayName(monster)).toBe("Big Man");
  });
});

describe("health and healing", () => {
  test("counts a creature at zero health as fainted", () => {
    const monster = createMonster({ species: "gori", rng: new Rng(1) });
    expect(isFainted(monster)).toBe(false);
    expect(isFainted({ ...monster, hp: 0 })).toBe(true);
  });

  test("healing refills health, clears status and refills power points", () => {
    const hurt = {
      ...createMonster({ species: "gori", level: 10, rng: new Rng(1) }),
      hp: 1,
      status: "poison",
      sleepTurns: 2,
    };
    hurt.moves[0].pp = 0;
    const better = healed(hurt);
    expect(better.hp).toBe(maxHp(better));
    expect(better.status).toBeNull();
    expect(better.sleepTurns).toBe(0);
    expect(better.moves[0].pp).toBeGreaterThan(0);
  });

  test("healing leaves the hurt creature untouched", () => {
    const hurt = { ...createMonster({ species: "gori", rng: new Rng(1) }), hp: 1 };
    healed(hurt);
    expect(hurt.hp).toBe(1);
  });

  test("healParty heals every creature in the party", () => {
    const party = [
      { ...createMonster({ species: "gori", rng: new Rng(1) }), hp: 0 },
      { ...createMonster({ species: "sumsu", rng: new Rng(2) }), hp: 2 },
    ];
    for (const monster of healParty(party)) expect(monster.hp).toBe(maxHp(monster));
  });

  test("restoreHp never goes past the maximum and reports the real gain", () => {
    const monster = { ...createMonster({ species: "gori", level: 20, rng: new Rng(1) }), hp: 5 };
    const big = restoreHp(monster, 9999);
    expect(big.monster.hp).toBe(maxHp(monster));
    expect(big.healed).toBe(maxHp(monster) - 5);
  });

  test("restoreHp on a full creature heals nothing", () => {
    const monster = createMonster({ species: "gori", level: 20, rng: new Rng(1) });
    expect(restoreHp(monster, 50).healed).toBe(0);
  });
});

describe("party helpers", () => {
  const alive = createMonster({ species: "gori", rng: new Rng(1) });
  const down = { ...createMonster({ species: "sumsu", rng: new Rng(2) }), hp: 0 };

  test("know whether the party can still fight", () => {
    expect(partyCanFight([down, alive])).toBe(true);
    expect(partyCanFight([down])).toBe(false);
    expect(partyCanFight([])).toBe(false);
  });

  test("find the first creature that can fight", () => {
    expect(firstHealthy([down, alive])).toBe(alive);
    expect(firstHealthy([down])).toBeNull();
  });
});

describe("expYield", () => {
  test("grows with the level of the creature beaten", () => {
    const low = createMonster({ species: "sumsu", level: 3, rng: new Rng(1) });
    const high = createMonster({ species: "sumsu", level: 30, rng: new Rng(1) });
    expect(expYield(high)).toBeGreaterThan(expYield(low));
  });

  test("pays half again as much for a trainer's creature", () => {
    const monster = createMonster({ species: "kanku", level: 10, rng: new Rng(1) });
    expect(expYield(monster, { fromTrainer: true })).toBeGreaterThan(expYield(monster));
  });

  test("never pays nothing at all", () => {
    const monster = createMonster({ species: "sumsu", level: 1, rng: new Rng(1) });
    expect(expYield(monster)).toBeGreaterThan(0);
  });
});

describe("gainExp", () => {
  test("raises the level when enough is gained", () => {
    const monster = createMonster({ species: "polete", level: 5, rng: new Rng(1) });
    const result = gainExp(monster, expForLevel("fast", 8) - monster.exp);
    expect(result.monster.level).toBe(8);
    expect(result.levels).toEqual([6, 7, 8]);
  });

  test("reports every move learned along the way", () => {
    const monster = createMonster({ species: "polete", level: 3, rng: new Rng(1) });
    const result = gainExp(monster, expForLevel("fast", 13) - monster.exp);
    const learned = result.learned.map((entry) => entry.moveId);
    expect(learned).toEqual(["spark", "growl", "shockWave"]);
  });

  test("reports an evolution once the level is reached", () => {
    const monster = createMonster({ species: "baobo", level: 15, rng: new Rng(1) });
    const result = gainExp(monster, expForLevel("medium", 16) - monster.exp);
    expect(result.evolveTo).toBe("baobanto");
  });

  test("reports no evolution for a creature that has none", () => {
    const monster = createMonster({ species: "polete", level: 15, rng: new Rng(1) });
    expect(gainExp(monster, 100000).evolveTo).toBeNull();
  });

  test("leaves the original creature untouched", () => {
    const monster = createMonster({ species: "polete", level: 5, rng: new Rng(1) });
    const before = monster.exp;
    gainExp(monster, 5000);
    expect(monster.exp).toBe(before);
    expect(monster.level).toBe(5);
  });

  test("does not heal a hurt creature when it levels up", () => {
    const monster = { ...createMonster({ species: "polete", level: 5, rng: new Rng(1) }), hp: 3 };
    const result = gainExp(monster, expForLevel("fast", 6) - monster.exp);
    expect(result.monster.level).toBe(6);
    expect(result.monster.hp).toBeLessThan(maxHp(result.monster));
    // It does gain the health the new level added.
    expect(result.monster.hp).toBeGreaterThan(3);
  });

  test("stops at the maximum level and never overflows", () => {
    const monster = createMonster({ species: "gori", level: 99, rng: new Rng(1) });
    const result = gainExp(monster, 10 ** 12);
    expect(result.monster.level).toBe(MAX_LEVEL);
    expect(result.monster.exp).toBe(expForLevel("fast", MAX_LEVEL));
  });

  test("ignores a negative amount instead of taking levels away", () => {
    const monster = createMonster({ species: "gori", level: 10, rng: new Rng(1) });
    const result = gainExp(monster, -5000);
    expect(result.monster.level).toBe(10);
    expect(result.monster.exp).toBe(monster.exp);
  });
});

describe("expToNextLevel and levelProgress", () => {
  test("count down to the next level", () => {
    const monster = createMonster({ species: "gori", level: 10, rng: new Rng(1) });
    expect(expToNextLevel(monster)).toBe(expForLevel("fast", 11) - expForLevel("fast", 10));
    expect(levelProgress(monster)).toBe(0);
  });

  test("show a full bar at the maximum level", () => {
    const monster = createMonster({ species: "gori", level: MAX_LEVEL, rng: new Rng(1) });
    expect(expToNextLevel(monster)).toBe(0);
    expect(levelProgress(monster)).toBe(1);
  });

  test("show the bar part way through a level", () => {
    const monster = createMonster({ species: "gori", level: 10, rng: new Rng(1) });
    const half = gainExp(monster, Math.floor(expToNextLevel(monster) / 2)).monster;
    expect(levelProgress(half)).toBeGreaterThan(0.4);
    expect(levelProgress(half)).toBeLessThan(0.6);
  });
});

describe("evolve", () => {
  test("changes the species and raises the maximum health", () => {
    const before = createMonster({ species: "baobo", level: 16, rng: new Rng(1) });
    const after = evolve(before, "baobanto");
    expect(after.species).toBe("baobanto");
    expect(maxHp(after)).toBeGreaterThan(maxHp(before));
  });

  test("keeps the same share of health, so evolving never hurts", () => {
    const before = { ...createMonster({ species: "baobo", level: 16, rng: new Rng(1) }) };
    before.hp = Math.floor(maxHp(before) / 2);
    const after = evolve(before, "baobanto");
    const share = after.hp / maxHp(after);
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });

  test("keeps the moves and the nickname", () => {
    const before = createMonster({
      species: "ananse",
      level: 16,
      nickname: "Spinner",
      rng: new Rng(1),
    });
    const after = evolve(before, "ansefo");
    expect(after.nickname).toBe("Spinner");
    expect(after.moves).toEqual(before.moves);
  });

  test("leaves the creature alone when the target does not exist", () => {
    const before = createMonster({ species: "ananse", level: 16, rng: new Rng(1) });
    expect(evolve(before, "nothing").species).toBe("ananse");
  });
});

describe("learnMove", () => {
  test("fills a free slot without asking", () => {
    const monster = createMonster({ species: "baobo", level: 1, rng: new Rng(1) });
    const result = learnMove(monster, "razorLeaf");
    expect(result.learned).toBe(true);
    expect(result.replaced).toBeNull();
    expect(result.monster.moves.map((slot) => slot.id)).toContain("razorLeaf");
  });

  test("replaces the chosen move once the set is full", () => {
    const monster = createMonster({ species: "baobo", level: 13, rng: new Rng(1) });
    expect(monster.moves.length).toBe(4);
    // At level 13 Baobo has already dropped Tackle: it keeps the last four it
    // learned, so slot 0 holds Growl.
    const result = learnMove(monster, "seedBomb", 0);
    expect(result.learned).toBe(true);
    expect(result.replaced).toBe("growl");
    expect(result.monster.moves[0].id).toBe("seedBomb");
  });

  test("declines when the set is full and no slot is chosen", () => {
    const monster = createMonster({ species: "baobo", level: 13, rng: new Rng(1) });
    const result = learnMove(monster, "seedBomb");
    expect(result.learned).toBe(false);
    expect(result.monster).toBe(monster);
  });

  test("never learns the same move twice", () => {
    const monster = createMonster({ species: "baobo", level: 1, rng: new Rng(1) });
    expect(learnMove(monster, "tackle").learned).toBe(false);
  });

  test("refuses a move that does not exist", () => {
    const monster = createMonster({ species: "baobo", level: 1, rng: new Rng(1) });
    expect(learnMove(monster, "hyperBeam").learned).toBe(false);
  });

  test("refuses an out-of-range slot instead of writing past the end", () => {
    const monster = createMonster({ species: "baobo", level: 13, rng: new Rng(1) });
    expect(learnMove(monster, "seedBomb", 9).learned).toBe(false);
    expect(learnMove(monster, "seedBomb", -1).learned).toBe(false);
  });
});

describe("power points", () => {
  test("outOfPp is true only when every move is empty", () => {
    const monster = createMonster({ species: "baobo", level: 9, rng: new Rng(1) });
    expect(outOfPp(monster)).toBe(false);
    const empty = { ...monster, moves: monster.moves.map((slot) => ({ ...slot, pp: 0 })) };
    expect(outOfPp(empty)).toBe(true);
  });

  test("restorePp refills up to the move's own maximum", () => {
    const monster = createMonster({ species: "baobo", level: 9, rng: new Rng(1) });
    const drained = { ...monster, moves: monster.moves.map((slot) => ({ ...slot, pp: 0 })) };
    const topped = restorePp(drained, 0, 999);
    expect(topped.moves[0].pp).toBe(35);
  });

  test("restorePp on a slot that does not exist changes nothing", () => {
    const monster = createMonster({ species: "baobo", level: 9, rng: new Rng(1) });
    expect(restorePp(monster, 7, 10).moves).toEqual(monster.moves);
  });
});

describe("hidden talent numbers", () => {
  test("stay inside the allowed range", () => {
    const rng = new Rng(6);
    for (let i = 0; i < 200; i++) {
      for (const value of Object.values(rollIvs(rng))) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(31);
      }
    }
  });

  test("are the same for the same seed, so a wild encounter can be replayed", () => {
    expect(rollIvs(new Rng(20))).toEqual(rollIvs(new Rng(20)));
  });
});

describe("buildMoveSlots", () => {
  test("keeps only four moves and fills each one", () => {
    const slots = buildMoveSlots(["tackle", "growl", "bite", "nap", "spark"]);
    expect(slots.length).toBe(4);
    expect(slots[0]).toEqual({ id: "tackle", pp: 35 });
  });

  test("survives an unknown move without crashing", () => {
    expect(buildMoveSlots(["nonsense"])[0].pp).toBe(0);
  });
});

describe("statsOf", () => {
  test("reads the creature's own level and talent numbers", () => {
    const monster = createMonster({ species: "poya", level: 20, ivs: perfect, rng: new Rng(1) });
    expect(statsOf(monster)).toEqual(statsAtLevel(getSpecies("poya"), 20, perfect));
  });
});
