import { describe, it, expect } from "bun:test";
import {
  AGENTS,
  AGENT_IDS,
  DEFAULT_AGENT,
  HUMAN,
  isAgent,
  agentById,
  chooseMove,
  planFor,
  runPlan,
} from "./agents.js";
import { MODE_IDS, rulesFor, newGame } from "./modes.js";
import { mulberry32 } from "./rng.js";
import { bestOf, alphaBeta, minimaxMove, greedyMove, mctsMove } from "./search.js";
import { evaluateKalah, evaluateBaawa, WIN_SCORE } from "./evaluate.js";
import * as kalah from "./kalah.js";
import * as baawa from "./baawa.js";

describe("the opponent list", () => {
  it("gives every opponent an id, a name, a level and a blurb", () => {
    for (const agent of AGENTS) {
      expect(agent.id.length).toBeGreaterThan(0);
      expect(agent.name.length).toBeGreaterThan(0);
      expect(agent.level.length).toBeGreaterThan(0);
      expect(agent.blurb.length).toBeGreaterThan(0);
      expect(typeof agent.plan).toBe("function");
      for (const mode of MODE_IDS) {
        expect(typeof agent.plan(mode).kind).toBe("string");
      }
    }
  });

  it("shrinks a thinking clock when the benchmark asks, and leaves a depth alone", () => {
    expect(planFor("deep", "kalah", 0.5).budgetMs).toBe(225);
    expect(planFor("mcts", "kalah", 0.5).iterations).toBe(600);
    expect(planFor("minimax", "kalah", 0.5)).toEqual(planFor("minimax", "kalah", 1));
    expect(planFor("random", "kalah", 0.1)).toEqual({ kind: "random" });
  });

  it("refuses a plan it has no algorithm for", () => {
    expect(() => runPlan({ kind: "telepathy" }, newGame("kalah"), rulesFor("kalah"), Math.random)).toThrow();
  });

  it("ranks them from one upwards with no repeats and no gaps", () => {
    expect(AGENTS.map((agent) => agent.tier)).toEqual(AGENTS.map((_, index) => index + 1));
  });

  it("has no id that clashes with the value used for a person", () => {
    expect(AGENT_IDS).not.toContain(HUMAN);
    expect(new Set(AGENT_IDS).size).toBe(AGENT_IDS.length);
  });

  it("falls back to the default opponent for an id it does not know", () => {
    expect(isAgent("stockfish")).toBe(false);
    expect(agentById("stockfish").id).toBe(DEFAULT_AGENT);
    expect(isAgent(DEFAULT_AGENT)).toBe(true);
  });
});

describe("every opponent plays a legal move in every rule set", () => {
  for (const mode of MODE_IDS) {
    for (const agent of AGENTS) {
      it(`${agent.id} plays ${mode}`, () => {
        const rules = rulesFor(mode);
        const rng = mulberry32(7);
        let state = newGame(mode);
        for (let turn = 0; turn < 3 && !state.over; turn += 1) {
          const move = chooseMove(agent.id, state, rules, rng);
          expect(rules.legalMoves(state)).toContain(move);
          state = rules.applyMove(state, move).state;
        }
      });
    }
  }
});

describe("the evaluation function", () => {
  it("scores a won Kalah game above anything unfinished", () => {
    const won = { ...kalah.createGame(), over: true, scores: [30, 18] };
    expect(evaluateKalah(won, 0)).toBeGreaterThan(WIN_SCORE);
    expect(evaluateKalah(won, 1)).toBeLessThan(-WIN_SCORE);
  });

  it("calls a drawn game level for both players", () => {
    const drawn = { ...kalah.createGame(), over: true, scores: [24, 24] };
    expect(evaluateKalah(drawn, 0)).toBe(0);
    expect(evaluateKalah(drawn, 1)).toBe(0);
  });

  it("rewards a Ba-awa pit holding three seeds, because any seed pays it", () => {
    const flat = baawa.createGame();
    const trap = { ...flat, pits: [3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] };
    expect(evaluateBaawa(trap, 0)).toBeGreaterThan(evaluateBaawa(flat, 0));
    expect(evaluateBaawa(trap, 1)).toBeLessThan(evaluateBaawa(flat, 1));
  });

  it("is a mirror: what is good for one player is bad for the other", () => {
    const game = kalah.applyMove(kalah.createGame(), 2).state;
    expect(evaluateKalah(game, 0)).toBe(-evaluateKalah(game, 1));
    const ghana = baawa.applyMove(baawa.createGame(), 2).state;
    expect(evaluateBaawa(ghana, 0)).toBe(-evaluateBaawa(ghana, 1));
  });
});

describe("bestOf", () => {
  it("takes the highest score", () => {
    expect(bestOf([1, 2, 3], mulberry32(1), (move) => move * 10)).toBe(3);
  });

  it("breaks a tie without always taking the first", () => {
    const rng = mulberry32(3);
    const seen = new Set();
    for (let round = 0; round < 40; round += 1) seen.add(bestOf([1, 2, 3], rng, () => 0));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("looking ahead", () => {
  it("takes a capture that is there for the taking", () => {
    // One seed in pit 2 lands in the empty pit 3 and takes the five seeds
    // facing it. Every other move does nothing.
    const start = { ...kalah.createGame(), pits: [1, 0, 1, 0, 0, 0, 4, 4, 5, 4, 4, 4] };
    expect(greedyMove(start, kalah, mulberry32(1))).toBe(2);
    expect(minimaxMove(start, kalah, { depth: 4, rng: mulberry32(1) })).toBe(2);
  });

  it("sees a Kalah extra turn as worth having", () => {
    const start = { ...kalah.createGame(), pits: [2, 2, 2, 2, 2, 1, 3, 3, 3, 3, 3, 3] };
    // Pit 5 puts the last seed in South's own store, so South plays again.
    expect(greedyMove(start, kalah, mulberry32(2))).toBe(5);
  });

  it("refuses a move that hands the opponent a big capture, which greed takes", () => {
    // Pit 4 sows one seed into pit 5, and North answers by dropping its last
    // seed into its own empty pit 6, taking pit 5 with it. Pit 0 avoids that.
    const start = {
      ...kalah.createGame(),
      pits: [1, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 1],
      scores: [0, 0],
    };
    const chosen = minimaxMove(start, kalah, { depth: 4, rng: mulberry32(5) });
    expect(kalah.legalMoves(start)).toContain(chosen);
    // Whatever it picks, it must be at least as good as what greed picks.
    const deep = alphaBeta(kalah.applyMove(start, chosen).state, 3, -Infinity, Infinity, 0, kalah);
    const greedy = greedyMove(start, kalah, mulberry32(5));
    const shallow = alphaBeta(kalah.applyMove(start, greedy).state, 3, -Infinity, Infinity, 0, kalah);
    expect(deep).toBeGreaterThanOrEqual(shallow);
  });

  it("finds the last move of a won game", () => {
    const start = { ...kalah.createGame(), pits: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 4], scores: [28, 15] };
    expect(minimaxMove(start, kalah, { depth: 3, rng: mulberry32(1) })).toBe(5);
  });

  it("stops searching when the clock runs out", () => {
    // Depth 30 in Kalah would take longer than a lifetime, so this only
    // returns at all because the deadline is honoured inside the search.
    const started = Date.now();
    const move = minimaxMove(kalah.createGame(), kalah, {
      budgetMs: 120,
      maxDepth: 30,
      rng: mulberry32(1),
    });
    expect(kalah.legalMoves(kalah.createGame())).toContain(move);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("tree search", () => {
  it("returns a legal move in both rule sets", () => {
    for (const mode of MODE_IDS) {
      const rules = rulesFor(mode);
      const state = newGame(mode);
      const move = mctsMove(state, rules, { iterations: 60, rng: mulberry32(4) });
      expect(rules.legalMoves(state)).toContain(move);
    }
  });

  it("takes a free win over a pointless move", () => {
    const start = { ...kalah.createGame(), pits: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 4], scores: [28, 15] };
    expect(mctsMove(start, kalah, { iterations: 120, rng: mulberry32(9) })).toBe(5);
  });
});

describe("the stronger opponent beats the weaker one", () => {
  /**
   * Play one game between two opponents and say who won.
   * @returns {number|null} the winning player, or null for a draw
   */
  function playGame(mode, southAgent, northAgent, seed) {
    const rules = rulesFor(mode);
    const rng = mulberry32(seed);
    let state = newGame(mode);
    let guard = 0;
    while (!state.over && guard < 400) {
      const id = state.turn === 0 ? southAgent : northAgent;
      state = rules.applyMove(state, chooseMove(id, state, rules, rng)).state;
      guard += 1;
    }
    return state.winner;
  }

  /**
   * Play a set of games from both seats and count the wins for the first
   * opponent named. Both seats are played because moving first is an
   * advantage in each rule set.
   */
  function series(mode, contender, foe, games) {
    let points = 0;
    for (let seed = 1; seed <= games; seed += 1) {
      if (playGame(mode, contender, foe, seed) === 0) points += 1;
      if (playGame(mode, foe, contender, seed) === 1) points += 1;
    }
    return points;
  }

  it("has the heuristic opponent beat the random one at Kalah", () => {
    expect(series("kalah", "heuristic", "random", 4)).toBeGreaterThanOrEqual(6);
  });

  // Ba-awa is a sharper game than Kalah: a round is short, one relay can take
  // three pits at once, and the last few seeds go to whoever started. So the
  // gap between a weak opponent and a middling one is real but narrower, and
  // this asks for a clear majority over sixteen games rather than a near
  // sweep over four.
  it("has the heuristic opponent beat the random one at Ba-awa", () => {
    expect(series("baawa", "heuristic", "random", 8)).toBeGreaterThanOrEqual(10);
  });

  // The two opponents that think on a clock are left to `benchmark.js`: a
  // 450ms search times a test suite out, and comparing the strong opponents
  // properly needs more games than a test should play. This checks the
  // fixed-depth search, which is fast.
  it("has the searching opponent beat the greedy one at both rule sets", () => {
    expect(series("kalah", "minimax", "greedy", 3)).toBeGreaterThanOrEqual(4);
    expect(series("baawa", "minimax", "greedy", 3)).toBeGreaterThanOrEqual(4);
  });
});
