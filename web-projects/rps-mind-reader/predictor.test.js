import { describe, test, expect } from "bun:test";
import { createModel, decide, learn, rebuildModel, randomMove } from "./predictor.js";
import { MOVES, judge, counter, beats, shift } from "./game.js";

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
    const d = decide(model, random);
    const playerMove = playerFn(i, rounds);
    const outcome = judge(playerMove, d.aiMove); // player perspective
    rounds.push({ p: playerMove, a: d.aiMove, o: outcome, g: d.predictedPlayerMove });
    if (outcome === "loss") tally.aiWin++;
    else if (outcome === "win") tally.aiLoss++;
    else tally.tie++;
    learn(model, playerMove, d.aiMove);
  }
  return { rounds, tally };
}

describe("createModel", () => {
  test("starts empty", () => {
    const m = createModel();
    expect(m.n).toBe(0);
    expect(m.llScores).toEqual({});
    expect(m.tables).toEqual({});
    expect(m.pHist).toEqual([]);
    expect(m.aHist).toEqual([]);
    expect(m.oHist).toEqual([]);
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
    expect(d.confidence).toBe(null);
  });
  test("does not mutate the model", () => {
    const m = createModel();
    const snapshot = JSON.stringify(m);
    decide(m, () => 0.5);
    expect(JSON.stringify(m)).toBe(snapshot);
  });
});

describe("prediction display invariant", () => {
  // The UI shows "I predicted you'd throw X" and the AI plays its move. That only
  // makes sense if the AI move always beats the announced prediction.
  test("once confident, the AI move always beats the announced prediction", () => {
    const m = createModel();
    for (let i = 0; i < 5; i++) learn(m, "rock", "rock"); // a clear pattern
    const d = decide(m, () => 0);
    expect(d.confident).toBe(true);
    expect(d.predictedPlayerMove).not.toBe(null);
    expect(beats(d.aiMove, d.predictedPlayerMove)).toBe(true);
    expect(counter(d.predictedPlayerMove)).toBe(d.aiMove);
    expect(typeof d.confidence).toBe("number");
    expect(d.confidence).toBeGreaterThan(0);
    expect(d.confidence).toBeLessThanOrEqual(1);
  });
  test("does not mutate the model even when confident", () => {
    const m = createModel();
    for (let i = 0; i < 5; i++) learn(m, "rock", "rock");
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
      expect(r.g).toBe("rock"); // announced prediction
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

describe("exploiting a 50/50 opponent (expected-value play)", () => {
  // "never repeat": after move X the player is 50/50 over the other two. No single
  // move is "most likely", yet one AI reply is uniquely EV-optimal. A distribution-
  // aware predictor must still net positive here.
  test("nets positive against a never-repeat player", () => {
    const m = createModel();
    const pr = rng(123);
    const antiRepeat = (i, rounds) => {
      if (!rounds.length) return "rock";
      const last = rounds[rounds.length - 1].p;
      const others = MOVES.filter((x) => x !== last);
      return others[Math.floor(pr() * 2)];
    };
    const { tally } = playSeries(m, antiRepeat, 150, rng(2));
    expect(tally.aiWin).toBeGreaterThan(tally.aiLoss);
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
  test("a short repeating pattern loses the large majority of decisive rounds", () => {
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
    const seq = ["rock", "rock", "paper", "scissors", "paper", "rock"];
    const { rounds } = playSeries(live, (i) => seq[i % seq.length], 60, rng(3));
    const rebuilt = rebuildModel(rounds);
    expect(rebuilt.llScores).toEqual(live.llScores);
    expect(rebuilt.tables).toEqual(live.tables);
    expect(rebuilt.pHist).toEqual(live.pHist);
    expect(rebuilt.aHist).toEqual(live.aHist);
    expect(rebuilt.oHist).toEqual(live.oHist);
    expect(rebuilt.lastAI).toEqual(live.lastAI);
    expect(rebuilt.lastOutcome).toEqual(live.lastOutcome);
    // The next decision matches too (its deterministic part).
    expect(decide(rebuilt, () => 0)).toEqual(decide(live, () => 0));
  });
  test("tolerates a missing or malformed history", () => {
    expect(rebuildModel(undefined).n).toBe(0);
    expect(rebuildModel([{ p: "rock" }, null, { p: "rock", a: "paper" }]).n).toBe(1);
  });
});
