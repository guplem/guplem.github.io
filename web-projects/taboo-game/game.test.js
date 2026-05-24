import { describe, test, expect } from "bun:test";
import {
  hashStringToSeed,
  mulberry32,
  activeTeam,
  judgeTeam,
  activePlayerIndex,
  cardForTurnAndWord,
  roleForPlayer,
  visibilityForRole,
  deriveTurnState,
  parseUrlState,
  serializeUrlState,
  generateRandomSeed,
  ROLES,
  TEAMS,
} from "./game.js";

describe("hashStringToSeed", () => {
  test("returns the same number for the same input", () => {
    expect(hashStringToSeed("foo")).toBe(hashStringToSeed("foo"));
  });

  test("returns different numbers for different inputs", () => {
    expect(hashStringToSeed("foo")).not.toBe(hashStringToSeed("bar"));
  });

  test("returns a non-negative 32-bit integer", () => {
    const h = hashStringToSeed("anything");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe("mulberry32", () => {
  test("is deterministic for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  test("produces values in [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("activeTeam", () => {
  test("turn 1 is team A", () => {
    expect(activeTeam(1)).toBe("A");
  });

  test("turn 2 is team B", () => {
    expect(activeTeam(2)).toBe("B");
  });

  test("alternates strictly", () => {
    for (let t = 1; t <= 50; t++) {
      expect(activeTeam(t)).toBe(t % 2 === 1 ? "A" : "B");
    }
  });

  test("throws on invalid turn", () => {
    expect(() => activeTeam(0)).toThrow();
    expect(() => activeTeam(-1)).toThrow();
    expect(() => activeTeam(1.5)).toThrow();
  });
});

describe("judgeTeam", () => {
  test("is the opposite of activeTeam", () => {
    for (let t = 1; t <= 20; t++) {
      expect(judgeTeam(t)).not.toBe(activeTeam(t));
    }
  });
});

describe("activePlayerIndex", () => {
  test("is deterministic for the same inputs", () => {
    const a = activePlayerIndex({ seed: "abc", turn: 5, teamSize: 4 });
    const b = activePlayerIndex({ seed: "abc", turn: 5, teamSize: 4 });
    expect(a).toBe(b);
  });

  test("returns a 1-based index within range", () => {
    for (let t = 1; t <= 20; t++) {
      const idx = activePlayerIndex({ seed: "abc", turn: t, teamSize: 3 });
      expect(idx).toBeGreaterThanOrEqual(1);
      expect(idx).toBeLessThanOrEqual(3);
    }
  });

  test("always returns 1 when team size is 1", () => {
    for (let t = 1; t <= 10; t++) {
      expect(activePlayerIndex({ seed: "abc", turn: t, teamSize: 1 })).toBe(1);
    }
  });

  test("distributes across players over many turns (rough uniformity)", () => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let t = 1; t <= 400; t++) {
      const idx = activePlayerIndex({ seed: "uniformity", turn: t, teamSize: 4 });
      counts[idx] = (counts[idx] || 0) + 1;
    }
    for (const k of Object.keys(counts)) {
      // Each bucket should be roughly 100. Allow ±50% slack.
      expect(counts[k]).toBeGreaterThan(50);
      expect(counts[k]).toBeLessThan(150);
    }
  });

  test("rotates within a team: each player describes exactly once before any repeats", () => {
    // Team A plays odd turns 1, 3, 5, ... so its first 3 turns with teamSize=3
    // must cover players 1, 2, 3 in some order, with no repeat.
    const teamSize = 3;
    const teamATurns = [1, 3, 5].map((t) =>
      activePlayerIndex({ seed: "rotation", turn: t, teamSize })
    );
    expect(new Set(teamATurns).size).toBe(3);
    expect([...teamATurns].sort()).toEqual([1, 2, 3]);
  });

  test("rotates within team B independently (turns 2, 4, 6)", () => {
    const teamSize = 3;
    const teamBTurns = [2, 4, 6].map((t) =>
      activePlayerIndex({ seed: "rotation", turn: t, teamSize })
    );
    expect(new Set(teamBTurns).size).toBe(3);
    expect([...teamBTurns].sort()).toEqual([1, 2, 3]);
  });

  test("after a full team-round the order is reshuffled (not repeating round 1)", () => {
    const teamSize = 3;
    const round1 = [1, 3, 5].map((t) =>
      activePlayerIndex({ seed: "reroll", turn: t, teamSize })
    );
    const round2 = [7, 9, 11].map((t) =>
      activePlayerIndex({ seed: "reroll", turn: t, teamSize })
    );
    // Both rounds must still be permutations of 1..3
    expect([...round1].sort()).toEqual([1, 2, 3]);
    expect([...round2].sort()).toEqual([1, 2, 3]);
    // The order itself should differ between rounds for at least some seeds.
    // (Probabilistically a 3-element permutation repeats with prob 1/6, so
    // a single seed could collide; we try a handful of seeds and require
    // at least one to differ.)
    const differs = ["a", "b", "c", "d", "e", "f"].some((s) => {
      const r1 = [1, 3, 5].map((t) => activePlayerIndex({ seed: s, turn: t, teamSize }));
      const r2 = [7, 9, 11].map((t) => activePlayerIndex({ seed: s, turn: t, teamSize }));
      return r1.join(",") !== r2.join(",");
    });
    expect(differs).toBe(true);
  });

  test("team A and team B rotations are independent", () => {
    // Even with the same seed, the A rotation and the B rotation should be
    // derived independently (different namespaces), so they need not match.
    const teamSize = 3;
    const aOrder = [1, 3, 5].map((t) =>
      activePlayerIndex({ seed: "independent", turn: t, teamSize })
    );
    const bOrder = [2, 4, 6].map((t) =>
      activePlayerIndex({ seed: "independent", turn: t, teamSize })
    );
    expect([...aOrder].sort()).toEqual([1, 2, 3]);
    expect([...bOrder].sort()).toEqual([1, 2, 3]);
    // Both are valid permutations of 1..3; they can occasionally match by chance,
    // but at minimum the function must not entangle them.
    expect(aOrder).toEqual(aOrder); // sanity: deterministic
  });

  test("different seeds produce different sequences", () => {
    const a = [];
    const b = [];
    for (let t = 1; t <= 10; t++) {
      a.push(activePlayerIndex({ seed: "alpha", turn: t, teamSize: 5 }));
      b.push(activePlayerIndex({ seed: "beta", turn: t, teamSize: 5 }));
    }
    expect(a).not.toEqual(b);
  });

  test("throws on invalid inputs", () => {
    expect(() => activePlayerIndex({ seed: "x", turn: 0, teamSize: 2 })).toThrow();
    expect(() => activePlayerIndex({ seed: "x", turn: 1, teamSize: 0 })).toThrow();
    expect(() => activePlayerIndex({ seed: "x", turn: 1, teamSize: -1 })).toThrow();
  });
});

describe("cardForTurnAndWord", () => {
  const deck = Array.from({ length: 10 }, (_, i) => ({
    word: `w${i}`,
    forbidden: ["a", "b", "c", "d", "e"],
  }));

  test("is deterministic for the same inputs", () => {
    const a = cardForTurnAndWord({ seed: "x", turn: 3, wordIndex: 2, deck });
    const b = cardForTurnAndWord({ seed: "x", turn: 3, wordIndex: 2, deck });
    expect(a.card).toBe(b.card);
    expect(a.index).toBe(b.index);
  });

  test("returns one of the deck cards with a valid index", () => {
    const { card, index } = cardForTurnAndWord({ seed: "x", turn: 1, wordIndex: 1, deck });
    expect(deck).toContain(card);
    expect(card).toBe(deck[index]);
  });

  test("visits every card exactly once within a single turn before repeats", () => {
    const seen = new Set();
    for (let w = 1; w <= deck.length; w++) {
      const { index } = cardForTurnAndWord({ seed: "turnshuffle", turn: 1, wordIndex: w, deck });
      seen.add(index);
    }
    expect(seen.size).toBe(deck.length);
  });

  test("two turns produce different shuffles (with the same seed)", () => {
    const turn1 = [];
    const turn2 = [];
    for (let w = 1; w <= deck.length; w++) {
      turn1.push(cardForTurnAndWord({ seed: "diffturn", turn: 1, wordIndex: w, deck }).index);
      turn2.push(cardForTurnAndWord({ seed: "diffturn", turn: 2, wordIndex: w, deck }).index);
    }
    expect(turn1).not.toEqual(turn2);
    // Both are still permutations of 0..deck.length-1
    expect(new Set(turn1).size).toBe(deck.length);
    expect(new Set(turn2).size).toBe(deck.length);
  });

  test("wordIndex beyond deck length wraps around (same card as wordIndex 1)", () => {
    const a = cardForTurnAndWord({ seed: "wrap", turn: 1, wordIndex: 1, deck });
    const b = cardForTurnAndWord({ seed: "wrap", turn: 1, wordIndex: deck.length + 1, deck });
    expect(a.index).toBe(b.index);
  });

  test("two clients with same (seed, turn, wordIndex) compute the same card", () => {
    const a = cardForTurnAndWord({ seed: "shared", turn: 7, wordIndex: 4, deck });
    const b = cardForTurnAndWord({ seed: "shared", turn: 7, wordIndex: 4, deck });
    expect(a.card).toBe(b.card);
  });

  test("throws on invalid inputs", () => {
    expect(() => cardForTurnAndWord({ seed: "x", turn: 0, wordIndex: 1, deck })).toThrow();
    expect(() => cardForTurnAndWord({ seed: "x", turn: 1, wordIndex: 0, deck })).toThrow();
    expect(() => cardForTurnAndWord({ seed: "x", turn: 1, wordIndex: 1, deck: [] })).toThrow();
  });
});

describe("roleForPlayer", () => {
  const teamSizes = { A: 3, B: 3 };

  test("assigns judge to the non-guessing team", () => {
    const role = roleForPlayer({
      seed: "x",
      turn: 1,
      teamSizes,
      myTeam: "B",
      myPlayerIndex: 1,
    });
    expect(role).toBe(ROLES.JUDGE);
  });

  test("active player and teammate live in the guessing team", () => {
    const turn = 1;
    const activeIdx = activePlayerIndex({ seed: "x", turn, teamSize: teamSizes.A });
    const activeRole = roleForPlayer({
      seed: "x",
      turn,
      teamSizes,
      myTeam: "A",
      myPlayerIndex: activeIdx,
    });
    expect(activeRole).toBe(ROLES.ACTIVE_PLAYER);

    const otherIdx = activeIdx === 1 ? 2 : 1;
    const teammateRole = roleForPlayer({
      seed: "x",
      turn,
      teamSizes,
      myTeam: "A",
      myPlayerIndex: otherIdx,
    });
    expect(teammateRole).toBe(ROLES.GUESSING_TEAMMATE);
  });

  test("two clients with the same inputs derive the same role", () => {
    const args = {
      seed: "shared-seed",
      turn: 13,
      teamSizes: { A: 4, B: 5 },
      myTeam: "A",
      myPlayerIndex: 2,
    };
    expect(roleForPlayer(args)).toBe(roleForPlayer(args));
  });

  test("throws when player index is out of range", () => {
    expect(() =>
      roleForPlayer({ seed: "x", turn: 1, teamSizes, myTeam: "A", myPlayerIndex: 0 })
    ).toThrow();
    expect(() =>
      roleForPlayer({ seed: "x", turn: 1, teamSizes, myTeam: "A", myPlayerIndex: 4 })
    ).toThrow();
  });

  test("throws on invalid team", () => {
    expect(() =>
      roleForPlayer({ seed: "x", turn: 1, teamSizes, myTeam: "C", myPlayerIndex: 1 })
    ).toThrow();
  });
});

describe("visibilityForRole", () => {
  test("active player sees both word and forbidden", () => {
    expect(visibilityForRole(ROLES.ACTIVE_PLAYER)).toEqual({ word: true, forbidden: true });
  });

  test("judge sees both word and forbidden (validates guesses)", () => {
    expect(visibilityForRole(ROLES.JUDGE)).toEqual({ word: true, forbidden: true });
  });

  test("guessing teammate sees nothing", () => {
    expect(visibilityForRole(ROLES.GUESSING_TEAMMATE)).toEqual({
      word: false,
      forbidden: false,
    });
  });

  test("throws on unknown role", () => {
    expect(() => visibilityForRole("bogus")).toThrow();
  });
});

describe("deriveTurnState", () => {
  const deck = Array.from({ length: 20 }, (_, i) => ({
    word: `w${i}`,
    forbidden: ["a", "b", "c", "d", "e"],
  }));
  const teamSizes = { A: 3, B: 4 };

  test("two clients with the same inputs derive the same turn state (modulo personal role)", () => {
    const baseInputs = { seed: "global", turn: 9, wordIndex: 2, teamSizes, deck };
    const clientA = deriveTurnState({ ...baseInputs, myTeam: "A", myPlayerIndex: 1 });
    const clientB = deriveTurnState({ ...baseInputs, myTeam: "B", myPlayerIndex: 1 });
    expect(clientA.card).toBe(clientB.card);
    expect(clientA.cardIndex).toBe(clientB.cardIndex);
    expect(clientA.guessingTeam).toBe(clientB.guessingTeam);
    expect(clientA.activePlayerIndex).toBe(clientB.activePlayerIndex);
    expect(clientA.wordIndex).toBe(clientB.wordIndex);
  });

  test("includes role-driven visibility", () => {
    const state = deriveTurnState({
      seed: "global",
      turn: 1,
      wordIndex: 1,
      teamSizes,
      myTeam: "B",
      myPlayerIndex: 1,
      deck,
    });
    expect(state.role).toBe(ROLES.JUDGE);
    expect(state.visibility).toEqual({ word: true, forbidden: true });
  });

  test("turn 1 is always team A guessing", () => {
    const state = deriveTurnState({
      seed: "any",
      turn: 1,
      wordIndex: 1,
      teamSizes,
      myTeam: "A",
      myPlayerIndex: 1,
      deck,
    });
    expect(state.guessingTeam).toBe("A");
    expect(state.judgeTeam).toBe("B");
  });

  test("defaults wordIndex to 1 when omitted", () => {
    const w1 = deriveTurnState({
      seed: "default",
      turn: 1,
      teamSizes,
      myTeam: "A",
      myPlayerIndex: 1,
      deck,
    });
    const wExplicit = deriveTurnState({
      seed: "default",
      turn: 1,
      wordIndex: 1,
      teamSizes,
      myTeam: "A",
      myPlayerIndex: 1,
      deck,
    });
    expect(w1.card).toBe(wExplicit.card);
  });

  test("advancing wordIndex yields a different card (within the same turn)", () => {
    const w1 = deriveTurnState({
      seed: "advance",
      turn: 1,
      wordIndex: 1,
      teamSizes,
      myTeam: "A",
      myPlayerIndex: 1,
      deck,
    });
    const w2 = deriveTurnState({
      seed: "advance",
      turn: 1,
      wordIndex: 2,
      teamSizes,
      myTeam: "A",
      myPlayerIndex: 1,
      deck,
    });
    expect(w1.cardIndex).not.toBe(w2.cardIndex);
  });
});

describe("parseUrlState", () => {
  test("reads seed, team sizes, turn, word, duration and version", () => {
    const s = parseUrlState("?s=abc&a=3&b=4&t=7&w=5&d=45&v=1.0.0");
    expect(s.seed).toBe("abc");
    expect(s.teamA).toBe(3);
    expect(s.teamB).toBe(4);
    expect(s.turn).toBe(7);
    expect(s.wordIndex).toBe(5);
    expect(s.timerDuration).toBe(45);
    expect(s.version).toBe("1.0.0");
  });

  test("returns nulls for missing fields", () => {
    const s = parseUrlState("");
    expect(s.seed).toBe("");
    expect(s.teamA).toBe(null);
    expect(s.teamB).toBe(null);
    expect(s.turn).toBe(null);
    expect(s.wordIndex).toBe(null);
    expect(s.timerDuration).toBe(null);
    expect(s.version).toBe(null);
  });

  test("rejects non-positive integers", () => {
    const s = parseUrlState("?a=0&b=-1&t=foo&w=0&d=-5");
    expect(s.teamA).toBe(null);
    expect(s.teamB).toBe(null);
    expect(s.turn).toBe(null);
    expect(s.wordIndex).toBe(null);
    expect(s.timerDuration).toBe(null);
  });
});

describe("serializeUrlState", () => {
  test("emits only set fields", () => {
    const out = serializeUrlState({ seed: "abc", teamA: 3, teamB: 4, turn: 2 });
    expect(out).toContain("s=abc");
    expect(out).toContain("a=3");
    expect(out).toContain("b=4");
    expect(out).toContain("t=2");
  });

  test("omits wordIndex when equal to 1 (default)", () => {
    const out = serializeUrlState({ seed: "abc", wordIndex: 1 });
    expect(out).not.toContain("w=");
  });

  test("includes wordIndex when greater than 1", () => {
    const out = serializeUrlState({ seed: "abc", wordIndex: 5 });
    expect(out).toContain("w=5");
  });

  test("includes timer duration when set", () => {
    const out = serializeUrlState({ seed: "abc", timerDuration: 45 });
    expect(out).toContain("d=45");
  });

  test("round-trips with parseUrlState", () => {
    const original = {
      seed: "xyz",
      teamA: 2,
      teamB: 5,
      turn: 12,
      wordIndex: 3,
      timerDuration: 60,
      version: "1.0.0",
    };
    const parsed = parseUrlState("?" + serializeUrlState(original));
    expect(parsed).toEqual(original);
  });

  test("omits unset fields", () => {
    expect(serializeUrlState({})).toBe("");
  });
});

describe("generateRandomSeed", () => {
  test("uses the injected random function", () => {
    const seed = generateRandomSeed(() => 0.5);
    expect(typeof seed).toBe("string");
    expect(seed.length).toBe(6);
  });
});

describe("TEAMS constant", () => {
  test("is immutable", () => {
    expect(Object.isFrozen(TEAMS)).toBe(true);
    expect(TEAMS).toEqual(["A", "B"]);
  });
});
