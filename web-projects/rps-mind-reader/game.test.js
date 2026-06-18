import { describe, test, expect } from "bun:test";
import {
  MOVES,
  shift,
  counter,
  beats,
  judge,
  gameValue,
  emptyState,
  applyRound,
  currentStreak,
  percentages,
  totalsCount,
  serialize,
  deserialize,
  normalizeState,
  MAX_ROUNDS,
} from "./game.js";

describe("shift", () => {
  test("rotates forward around the wheel", () => {
    expect(shift("rock", 1)).toBe("paper");
    expect(shift("paper", 1)).toBe("scissors");
    expect(shift("scissors", 1)).toBe("rock");
  });
  test("wraps, handles multiples and zero", () => {
    expect(shift("rock", 3)).toBe("rock");
    expect(shift("rock", 0)).toBe("rock");
    expect(shift("rock", 2)).toBe("scissors");
  });
  test("returns null for an unknown move", () => {
    expect(shift("lizard", 1)).toBe(null);
  });
});

describe("counter", () => {
  test("returns the move that beats the input", () => {
    expect(counter("rock")).toBe("paper");
    expect(counter("paper")).toBe("scissors");
    expect(counter("scissors")).toBe("rock");
  });
});

describe("beats", () => {
  test("classic winning combinations", () => {
    expect(beats("rock", "scissors")).toBe(true);
    expect(beats("paper", "rock")).toBe(true);
    expect(beats("scissors", "paper")).toBe(true);
  });
  test("losing and tying combinations are not wins", () => {
    expect(beats("scissors", "rock")).toBe(false);
    expect(beats("rock", "paper")).toBe(false);
    expect(beats("rock", "rock")).toBe(false);
  });
});

describe("judge (player perspective)", () => {
  test("win / loss / tie", () => {
    expect(judge("rock", "scissors")).toBe("win");
    expect(judge("rock", "paper")).toBe("loss");
    expect(judge("rock", "rock")).toBe("tie");
  });
});

describe("gameValue (AI perspective)", () => {
  test("+1 win, 0 tie, -1 loss", () => {
    expect(gameValue("paper", "rock")).toBe(1);
    expect(gameValue("rock", "rock")).toBe(0);
    expect(gameValue("rock", "paper")).toBe(-1);
  });
});

describe("applyRound", () => {
  test("records the outcome and updates totals immutably", () => {
    const s0 = emptyState();
    const s1 = applyRound(s0, "rock", "scissors", "rock"); // player win
    expect(s1.totals).toEqual({ win: 1, loss: 0, tie: 0 });
    expect(s1.rounds).toHaveLength(1);
    expect(s1.rounds[0]).toEqual({ p: "rock", a: "scissors", o: "win", g: "rock" });
    expect(s0.totals).toEqual({ win: 0, loss: 0, tie: 0 }); // original untouched
  });
  test("tracks losses and ties", () => {
    let s = emptyState();
    s = applyRound(s, "rock", "paper"); // loss
    s = applyRound(s, "rock", "rock"); // tie
    expect(s.totals).toEqual({ win: 0, loss: 1, tie: 1 });
  });
  test("stores predicted move only when valid", () => {
    let s = emptyState();
    s = applyRound(s, "rock", "rock"); // no prediction passed
    expect(s.rounds[0].g).toBe(null);
    s = applyRound(s, "rock", "rock", "banana"); // invalid prediction
    expect(s.rounds[1].g).toBe(null);
  });
  test("updates best streak and current streak", () => {
    let s = emptyState();
    s = applyRound(s, "rock", "scissors"); // win
    s = applyRound(s, "rock", "scissors"); // win
    s = applyRound(s, "rock", "paper"); // loss (breaks streak)
    s = applyRound(s, "rock", "scissors"); // win
    expect(s.bestStreak).toBe(2);
    expect(currentStreak(s)).toBe(1);
  });
  test("caps the rounds window but keeps cumulative totals", () => {
    let s = emptyState();
    for (let i = 0; i < MAX_ROUNDS + 50; i++) s = applyRound(s, "rock", "scissors");
    expect(s.rounds).toHaveLength(MAX_ROUNDS);
    expect(s.totals.win).toBe(MAX_ROUNDS + 50);
    expect(totalsCount(s.totals)).toBe(MAX_ROUNDS + 50);
  });
});

describe("percentages", () => {
  test("computes fractions over the total", () => {
    const p = percentages({ win: 2, loss: 1, tie: 1 });
    expect(p.total).toBe(4);
    expect(p.win).toBeCloseTo(0.5);
    expect(p.loss).toBeCloseTo(0.25);
    expect(p.tie).toBeCloseTo(0.25);
  });
  test("returns zeros for an empty record (never NaN)", () => {
    expect(percentages({ win: 0, loss: 0, tie: 0 })).toEqual({ win: 0, loss: 0, tie: 0, total: 0 });
  });
});

describe("serialize / deserialize", () => {
  test("round-trips a played state", () => {
    let s = emptyState();
    s = applyRound(s, "rock", "scissors", "rock"); // win
    s = applyRound(s, "paper", "scissors"); // loss
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
  });
  test("returns an empty state for garbage or empty input", () => {
    expect(deserialize("not json")).toEqual(emptyState());
    expect(deserialize("")).toEqual(emptyState());
    expect(deserialize(null)).toEqual(emptyState());
  });
  test("normalizes malformed objects and drops invalid rounds", () => {
    const dirty = {
      totals: { win: "5", loss: -3, tie: 2 }, // "5" not a number -> 0; -3 -> 0
      bestStreak: -1,
      rounds: [
        { p: "rock", a: "paper", o: "loss", g: "rock" },
        { p: "banana", a: "paper", o: "loss" }, // invalid move -> dropped
        null,
      ],
    };
    const clean = normalizeState(dirty);
    expect(clean.totals).toEqual({ win: 0, loss: 0, tie: 2 });
    expect(clean.bestStreak).toBe(0);
    expect(clean.rounds).toHaveLength(1);
    expect(clean.rounds[0]).toEqual({ p: "rock", a: "paper", o: "loss", g: "rock" });
  });
});

describe("MOVES", () => {
  test("are exactly the three classic moves", () => {
    expect(MOVES).toEqual(["rock", "paper", "scissors"]);
  });
});
