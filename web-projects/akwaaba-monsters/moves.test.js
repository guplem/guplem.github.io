import { describe, test, expect } from "bun:test";
import {
  CATEGORIES,
  EFFECT_KINDS,
  MOVES,
  MOVE_IDS,
  STATUSES,
  STAT_STAGES,
  getMove,
  isStatusMove,
} from "./moves.js";
import { isType } from "./types.js";

const allMoves = MOVE_IDS.map((id) => MOVES[id]);

describe("the move table", () => {
  test("holds every identifier exactly once", () => {
    expect(new Set(MOVE_IDS).size).toBe(MOVE_IDS.length);
  });

  test("gives every move a name, a real type and a real category", () => {
    for (const move of allMoves) {
      expect(move.name.length).toBeGreaterThan(0);
      expect(isType(move.type)).toBe(true);
      expect(CATEGORIES).toContain(move.cat);
    }
  });

  test("gives every move usable power points", () => {
    for (const move of allMoves) {
      expect(move.pp).toBeGreaterThan(0);
      expect(move.pp).toBeLessThanOrEqual(40);
    }
  });

  test("gives damaging moves power and status moves none", () => {
    for (const move of allMoves) {
      if (move.cat === "status") {
        expect(move.power).toBeNull();
      } else {
        expect(move.power).toBeGreaterThan(0);
      }
    }
  });

  test("keeps accuracy between 1 and 100, or null for a move that never misses", () => {
    for (const move of allMoves) {
      if (move.acc === null) continue;
      expect(move.acc).toBeGreaterThan(0);
      expect(move.acc).toBeLessThanOrEqual(100);
    }
  });

  test("gives every move a one-line description", () => {
    for (const move of allMoves) {
      expect(move.desc.length).toBeGreaterThan(10);
      expect(move.desc.endsWith(".")).toBe(true);
    }
  });

  test("always has an effects list, even when it is empty", () => {
    for (const move of allMoves) expect(Array.isArray(move.effects)).toBe(true);
  });
});

describe("move effects", () => {
  test("only use effect kinds the battle engine knows", () => {
    for (const move of allMoves) {
      for (const effect of move.effects) expect(EFFECT_KINDS).toContain(effect.kind);
    }
  });

  test("only inflict statuses the engine knows", () => {
    for (const move of allMoves) {
      for (const effect of move.effects) {
        if (effect.kind === "status") expect(STATUSES).toContain(effect.status);
      }
    }
  });

  test("only move stats the engine knows, by one or two stages", () => {
    for (const move of allMoves) {
      for (const effect of move.effects) {
        if (effect.kind !== "stat") continue;
        expect(["foe", "self"]).toContain(effect.target);
        for (const [stat, stages] of Object.entries(effect.changes)) {
          expect(STAT_STAGES).toContain(stat);
          expect([-2, -1, 1, 2]).toContain(stages);
        }
      }
    }
  });

  test("give every chance-based effect a chance between 1 and 100", () => {
    for (const move of allMoves) {
      for (const effect of move.effects) {
        if (effect.kind === "crit") continue;
        expect(effect.chance).toBeGreaterThan(0);
        expect(effect.chance).toBeLessThanOrEqual(100);
      }
    }
  });

  test("keep heal and drain percentages sensible", () => {
    for (const move of allMoves) {
      for (const effect of move.effects) {
        if (effect.kind === "heal" || effect.kind === "drain") {
          expect(effect.pct).toBeGreaterThan(0);
          expect(effect.pct).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe("balance guards", () => {
  test("never gives a strong move both high power and high accuracy and many uses", () => {
    // A move with 100 power or more has to give something up, or the game has
    // one correct answer in every battle.
    for (const move of allMoves) {
      if ((move.power ?? 0) < 100) continue;
      const alwaysHits = move.acc === null || move.acc >= 100;
      expect(alwaysHits && move.pp > 10).toBe(false);
    }
  });

  test("covers every type with at least one damaging move", () => {
    const covered = new Set(allMoves.filter((move) => move.cat !== "status").map((move) => move.type));
    expect(covered.size).toBe(10);
  });

  test("gives every type at least one move a starter could sensibly learn early", () => {
    for (const move of allMoves) {
      if (move.power !== null && move.power <= 45) expect(move.pp).toBeGreaterThanOrEqual(25);
    }
  });
});

describe("getMove", () => {
  test("finds a move by identifier", () => {
    expect(getMove("tackle").name).toBe("Tackle");
  });

  test("returns null for an unknown identifier", () => {
    expect(getMove("nope")).toBeNull();
  });
});

describe("isStatusMove", () => {
  test("separates status moves from damaging ones", () => {
    expect(isStatusMove(getMove("growl"))).toBe(true);
    expect(isStatusMove(getMove("tackle"))).toBe(false);
  });
});

describe("the signature moves the story leans on", () => {
  test("Mama Sopa's soup is a poison move that can poison", () => {
    const soup = getMove("bankuSoup");
    expect(soup.type).toBe("poison");
    expect(soup.effects.some((effect) => effect.status === "poison")).toBe(true);
  });

  test("Royal Order lowers two of the target's stats at once", () => {
    const order = getMove("royalOrder");
    expect(order.cat).toBe("status");
    expect(order.effects[0].changes).toEqual({ attack: -1, defense: -1 });
  });

  test("Fire Dance raises two of the user's own stats", () => {
    const dance = getMove("fireDance");
    expect(dance.effects[0].target).toBe("self");
    expect(dance.effects[0].changes).toEqual({ spAttack: 1, speed: 1 });
  });
});
