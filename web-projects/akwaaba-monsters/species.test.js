import { describe, test, expect } from "bun:test";
import {
  FRIEND_IDS,
  SPECIES,
  SPECIES_IDS,
  STARTER_IDS,
  baseStatTotal,
  evolutionAt,
  getSpecies,
  movesAtLevel,
  movesLearnedAt,
} from "./species.js";
import { MOVES } from "./moves.js";
import { isType } from "./types.js";

const allSpecies = SPECIES_IDS.map((id) => SPECIES[id]);
const STAT_KEYS = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"];

describe("the species table", () => {
  test("holds every identifier exactly once", () => {
    expect(new Set(SPECIES_IDS).size).toBe(SPECIES_IDS.length);
  });

  test("has the twenty one species the first area needs", () => {
    expect(SPECIES_IDS.length).toBe(21);
  });

  test("gives every species one or two real types", () => {
    for (const species of allSpecies) {
      expect(species.types.length).toBeGreaterThanOrEqual(1);
      expect(species.types.length).toBeLessThanOrEqual(2);
      for (const type of species.types) expect(isType(type)).toBe(true);
      expect(new Set(species.types).size).toBe(species.types.length);
    }
  });

  test("gives every species all six base stats, each above zero", () => {
    for (const species of allSpecies) {
      expect(Object.keys(species.base).sort()).toEqual([...STAT_KEYS].sort());
      for (const value of Object.values(species.base)) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(140);
      }
    }
  });

  test("keeps catch rate, base experience and growth inside the known ranges", () => {
    for (const species of allSpecies) {
      expect(species.catchRate).toBeGreaterThanOrEqual(3);
      expect(species.catchRate).toBeLessThanOrEqual(255);
      expect(species.baseExp).toBeGreaterThan(0);
      expect(["fast", "medium", "slow"]).toContain(species.growth);
    }
  });

  test("gives every species a field guide entry and a size", () => {
    for (const species of allSpecies) {
      expect(species.entry.length).toBeGreaterThan(40);
      expect(species.height).toBeGreaterThan(0);
      expect(species.weight).toBeGreaterThan(0);
    }
  });
});

describe("learnsets", () => {
  test("only name moves that exist", () => {
    for (const species of allSpecies) {
      for (const [, moveId] of species.learnset) expect(MOVES[moveId]).toBeDefined();
    }
  });

  test("are written in level order, so reading one top to bottom makes sense", () => {
    for (const species of allSpecies) {
      const levels = species.learnset.map(([level]) => level);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
    }
  });

  test("give every species at least two moves at level one", () => {
    for (const species of allSpecies) {
      const starting = species.learnset.filter(([level]) => level === 1);
      expect(starting.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("give every species at least one damaging move at level one", () => {
    for (const species of allSpecies) {
      const starting = species.learnset
        .filter(([level]) => level === 1)
        .map(([, moveId]) => MOVES[moveId]);
      expect(starting.some((move) => move.cat !== "status")).toBe(true);
    }
  });

  test("never teach the same move twice", () => {
    for (const species of allSpecies) {
      const ids = species.learnset.map(([, moveId]) => moveId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("give every species a move matching one of its own types, for the bonus", () => {
    for (const species of allSpecies) {
      const learned = species.learnset.map(([, moveId]) => MOVES[moveId]);
      const matching = learned.filter(
        (move) => species.types.includes(move.type) && move.cat !== "status",
      );
      expect(matching.length).toBeGreaterThan(0);
    }
  });

  test("keep the strongest moves behind a level, so a level 5 catch is not a weapon", () => {
    for (const species of allSpecies) {
      for (const [level, moveId] of species.learnset) {
        if ((MOVES[moveId].power ?? 0) >= 90) expect(level).toBeGreaterThanOrEqual(18);
      }
    }
  });
});

describe("evolutions", () => {
  test("only point at species that exist, and never at themselves", () => {
    for (const species of allSpecies) {
      if (!species.evolve) continue;
      expect(SPECIES[species.evolve.to]).toBeDefined();
      expect(species.evolve.to).not.toBe(species.id);
      expect(species.evolve.level).toBeGreaterThan(1);
    }
  });

  test("make the creature stronger, never weaker", () => {
    for (const species of allSpecies) {
      if (!species.evolve) continue;
      expect(baseStatTotal(SPECIES[species.evolve.to])).toBeGreaterThan(baseStatTotal(species));
    }
  });

  test("never form a loop", () => {
    for (const species of allSpecies) {
      const seen = new Set();
      let current = species;
      while (current?.evolve) {
        expect(seen.has(current.id)).toBe(false);
        seen.add(current.id);
        current = SPECIES[current.evolve.to];
      }
    }
  });

  test("evolutionAt answers only once the level is reached", () => {
    const baobo = getSpecies("baobo");
    expect(evolutionAt(baobo, 15)).toBeNull();
    expect(evolutionAt(baobo, 16)).toBe("baobanto");
    expect(evolutionAt(baobo, 30)).toBe("baobanto");
    expect(evolutionAt(getSpecies("polete"), 99)).toBeNull();
  });
});

describe("the starters", () => {
  test("are three, and form a grass, fire and water triangle", () => {
    expect(STARTER_IDS.length).toBe(3);
    const types = STARTER_IDS.map((id) => SPECIES[id].types[0]);
    expect(types.sort()).toEqual(["fire", "grass", "water"]);
  });

  test("all evolve at the same level, so no choice is slower than another", () => {
    const levels = STARTER_IDS.map((id) => SPECIES[id].evolve.level);
    expect(new Set(levels).size).toBe(1);
  });

  test("start within a few points of each other, so no choice is stronger", () => {
    const totals = STARTER_IDS.map((id) => baseStatTotal(SPECIES[id]));
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(25);
  });
});

describe("the seven friends", () => {
  test("are all present", () => {
    expect(FRIEND_IDS).toEqual(["hinoko", "polete", "nacho", "seryi", "carsla", "gis", "poya"]);
    for (const id of FRIEND_IDS) expect(SPECIES[id]).toBeDefined();
  });

  test("each one carries the trait it was asked to carry", () => {
    // Polete is the small fast one, like a Pikachu or a Rattata.
    expect(SPECIES.polete.base.speed).toBe(Math.max(...allSpecies.map((s) => s.base.speed)));
    expect(SPECIES.polete.weight).toBeLessThan(5);

    // Nacho is the fat one, like a Snorlax: most health, least speed.
    expect(SPECIES.nacho.base.hp).toBe(Math.max(...allSpecies.map((s) => s.base.hp)));
    expect(SPECIES.nacho.base.speed).toBe(Math.min(...allSpecies.map((s) => s.base.speed)));

    // Seryi smokes and dances, so it owns both Smoke Screen and Fire Dance.
    const seryiMoves = SPECIES.seryi.learnset.map(([, moveId]) => moveId);
    expect(seryiMoves).toContain("smokeScreen");
    expect(seryiMoves).toContain("fireDance");

    // Carsla is the oppressive one: the highest defence, and Royal Order.
    expect(SPECIES.carsla.base.defense).toBe(Math.max(...allSpecies.map((s) => s.base.defense)));
    expect(SPECIES.carsla.learnset.map(([, moveId]) => moveId)).toContain("royalOrder");

    // Gis is posh and picky: a flier with the daintiest move in the game.
    expect(SPECIES.gis.types).toContain("sky");
    expect(SPECIES.gis.learnset.map(([, moveId]) => moveId)).toContain("fineFeather");

    // Poya is the brute: the hardest hitter.
    expect(SPECIES.poya.base.attack).toBe(Math.max(...allSpecies.map((s) => s.base.attack)));

    // Hinoko has the rasta mane, so it is the grass one with the vine moves.
    expect(SPECIES.hinoko.types).toContain("grass");
    expect(SPECIES.hinoko.learnset.map(([, moveId]) => moveId)).toContain("vineWhip");
  });

  test("are stronger than the common wild creatures, so finding one matters", () => {
    const commons = ["sumsu", "gori", "kanku", "krabo"];
    const weakestFriend = Math.min(...FRIEND_IDS.map((id) => baseStatTotal(SPECIES[id])));
    const strongestCommon = Math.max(...commons.map((id) => baseStatTotal(SPECIES[id])));
    expect(weakestFriend).toBeGreaterThan(strongestCommon);
  });
});

describe("movesAtLevel", () => {
  test("gives the starting pair at level one", () => {
    expect(movesAtLevel(getSpecies("baobo"), 1)).toEqual(["tackle", "growl"]);
  });

  test("never gives more than four moves", () => {
    for (const species of allSpecies) {
      expect(movesAtLevel(species, 100).length).toBeLessThanOrEqual(4);
    }
  });

  test("keeps the four most recently learned when the list grows past four", () => {
    expect(movesAtLevel(getSpecies("baobo"), 24)).toEqual([
      "deepRoots",
      "razorLeaf",
      "sleepSpores",
      "seedBomb",
    ]);
  });

  test("gives every species at least one move at every level from 1 to 40", () => {
    for (const species of allSpecies) {
      for (let level = 1; level <= 40; level++) {
        expect(movesAtLevel(species, level).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("movesLearnedAt", () => {
  test("finds the move gained on exactly that level", () => {
    expect(movesLearnedAt(getSpecies("baobo"), 5)).toEqual(["vineWhip"]);
  });

  test("finds both starting moves at level one", () => {
    expect(movesLearnedAt(getSpecies("baobo"), 1)).toEqual(["tackle", "growl"]);
  });

  test("is empty on a level with nothing to learn", () => {
    expect(movesLearnedAt(getSpecies("baobo"), 6)).toEqual([]);
  });
});

describe("getSpecies", () => {
  test("finds a species and returns null for an unknown one", () => {
    expect(getSpecies("nacho").name).toBe("Nacho");
    expect(getSpecies("pikachu")).toBeNull();
  });
});
