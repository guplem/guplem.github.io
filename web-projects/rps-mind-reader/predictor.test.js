import { describe, test, expect } from "bun:test";
import { createModel, decide, learn, rebuildModel, randomMove } from "./predictor.js";
import { MOVES, judge, counter } from "./game.js";

// Deterministic RNG (mulberry32) so randomised fallbacks stay stable in tests.
function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Play `n` rounds of a scripted player against the adaptive AI.
// playerFn(roundIndex, pastRounds) -> move. Returns rounds + an AI-perspective tally.
function playSeries(model, playerFn, n, random) {
  const rounds = [];
  const tally = { aiWin: 0, aiLoss: 0, tie: 0 };
  for (let i = 0; i < n; i++) {
    const decision = decide(model, random);
    const playerMove = playerFn(i, rounds);
    const outcome = judge(playerMove, decision.aiMove); // player perspective
    rounds.push({ p: playerMove, a: decision.aiMove, o: outcome, g: decision.predictedPlayerMove });
    if (outcome === "loss") tally.aiWin++;
    else if (outcome === "win") tally.aiLoss++;
    else tally.tie++;
    learn(model, playerMove, decision.aiMove);
  }
  return { rounds, tally };
}

describe("createModel", () => {
  test("starts empty", () => {
    const m = createModel();
    expect(m.n).toBe(0);
    expect(m.freq).toEqual({ rock: 0, paper: 0, scissors: 0 });
    expect(m.scores).toEqual({});
    expect(m.recentPlayers).toEqual([]);
  });
});

describe("randomMove", () => {
  test("maps rng output across all three moves", () => {
    expect(randomMove(() => 0)).toBe("rock");
    expect(randomMove(() => 0.4)).toBe("paper");
    expect(randomMove(() => 0.9)).toBe("scissors");
  });
});

describe("decide (cold start)", () => {
  test("plays a valid move and predicts nothing with no history", () => {
    const m = createModel();
    const d = decide(m, () => 0);
    expect(MOVES).toContain(d.aiMove);
    expect(d.predictedPlayerMove).toBe(null);
    expect(d.confident).toBe(false);
  });
  test("does not mutate the model", () => {
    const m = createModel();
    const snapshot = JSON.stringify(m);
    decide(m, () => 0.5);
    expect(JSON.stringify(m)).toBe(snapshot);
  });
});

describe("learning a constant player", () => {
  test("converges to the counter move, predicts correctly, and wins", () => {
    const m = createModel();
    const { rounds, tally } = playSeries(m, () => "rock", 30, () => 0);
    const tail = rounds.slice(-10);
    for (const r of tail) {
      expect(r.a).toBe("paper"); // counter of rock
      expect(r.o).toBe("loss"); // player keeps losing
      expect(r.g).toBe("rock"); // AI announced it predicted rock
    }
    expect(tally.aiWin).toBeGreaterThan(tally.aiLoss);
  });
});

describe("learning a cyclic player", () => {
  test("beats a fixed rock->paper->scissors cycle most of the time", () => {
    const m = createModel();
    const cycle = ["rock", "paper", "scissors"];
    const { tally } = playSeries(m, (i) => cycle[i % 3], 90, rng(1));
    const decisive = tally.aiWin + tally.aiLoss;
    expect(tally.aiWin / decisive).toBeGreaterThan(0.6);
  });
});

describe("resisting an anti-bot player", () => {
  test("is not exploited by a player that counters the AI's last move", () => {
    const m = createModel();
    const playerFn = (i, rounds) =>
      rounds.length === 0 ? "rock" : counter(rounds[rounds.length - 1].a);
    const { tally } = playSeries(m, playerFn, 150, rng(7));
    expect(tally.aiWin).toBeGreaterThan(tally.aiLoss);
  });
});

describe("a predictable player is beaten badly", () => {
  test("a two-move pattern loses the large majority of decisive rounds", () => {
    const m = createModel();
    const pattern = ["rock", "rock", "paper"];
    const { tally } = playSeries(m, (i) => pattern[i % pattern.length], 120, rng(5));
    const decisive = tally.aiWin + tally.aiLoss;
    expect(tally.aiWin / decisive).toBeGreaterThan(0.6);
  });
});

describe("persistence via replay", () => {
  test("rebuildModel reproduces the incrementally trained model exactly", () => {
    const live = createModel();
    const cycle = ["rock", "rock", "paper", "scissors", "paper"];
    const { rounds } = playSeries(live, (i) => cycle[i % cycle.length], 60, rng(3));
    const rebuilt = rebuildModel(rounds);
    expect(rebuilt.scores).toEqual(live.scores);
    expect(rebuilt.freq).toEqual(live.freq);
    expect(rebuilt.markov).toEqual(live.markov);
    expect(rebuilt.reactAI).toEqual(live.reactAI);
    expect(rebuilt.reactOutcome).toEqual(live.reactOutcome);
    expect(rebuilt.recentPlayers).toEqual(live.recentPlayers);
    // The next decision matches too (its deterministic part).
    expect(decide(rebuilt, () => 0)).toEqual(decide(live, () => 0));
  });
  test("rebuildModel tolerates a missing or malformed history", () => {
    expect(rebuildModel(undefined).n).toBe(0);
    expect(rebuildModel([{ p: "rock" }, null, { p: "rock", a: "paper" }]).n).toBe(1);
  });
});

describe("score decay", () => {
  test("rewards the expert that would have countered, not the mirror", () => {
    const m = createModel();
    learn(m, "rock", "rock"); // builds freq, no scoring yet (no prior data)
    learn(m, "rock", "rock"); // now freq predicts rock; experts get scored
    expect(m.scores["freq:1"]).toBeGreaterThan(0); // recommending paper beats rock
    expect(m.scores["freq:2"]).toBeLessThan(0); // recommending scissors loses to rock
    expect(m.scores["freq:3"]).toBe(0); // recommending rock only ties
  });
});
