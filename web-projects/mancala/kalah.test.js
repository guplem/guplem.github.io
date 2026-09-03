import { describe, it, expect } from "bun:test";
import { createGame, legalMoves, applyMove, describeMove } from "./kalah.js";

/**
 * Build a Kalah position for a test. Everything not given keeps the default.
 * Several fixtures leave a spare seed in the mover's row on purpose: a move
 * that empties the mover's own row ends the game, which would hide the rule
 * the test is about.
 */
function position(patch) {
  return { ...createGame(), ...patch };
}

/** The event types of a move, in order. */
function types(events) {
  return events.map((event) => event.type);
}

describe("the opening position", () => {
  const game = createGame();

  it("puts four seeds in every pit and nothing in the stores", () => {
    expect(game.pits).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    expect(game.scores).toEqual([0, 0]);
  });

  it("lets South start", () => {
    expect(game.turn).toBe(0);
    expect(game.over).toBe(false);
  });

  it("offers each player only their own six pits", () => {
    expect(legalMoves(game)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(legalMoves({ ...game, turn: 1 })).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it("never offers an empty pit", () => {
    const game2 = position({ pits: [0, 0, 3, 0, 0, 1, 4, 4, 4, 4, 4, 4] });
    expect(legalMoves(game2)).toEqual([2, 5]);
  });
});

describe("sowing", () => {
  it("drops one seed per pit counterclockwise and hands the turn over", () => {
    const { state, events } = applyMove(createGame(), 0);
    expect(state.pits).toEqual([0, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4]);
    expect(state.turn).toBe(1);
    expect(types(events)).toEqual(["lift", "drop", "drop", "drop", "drop", "turn"]);
  });

  it("puts a seed in the mover's own store on the way past", () => {
    const { state, events } = applyMove(createGame(), 2);
    expect(state.pits).toEqual([4, 4, 0, 5, 5, 5, 4, 4, 4, 4, 4, 4]);
    expect(state.scores).toEqual([1, 0]);
    expect(events.some((event) => event.type === "store" && event.player === 0)).toBe(true);
  });

  it("skips the opponent's store", () => {
    // North sows 8 seeds from pit 11: one into its own store, then all six
    // South pits, then one more into pit 6. South's store stays empty.
    const start = position({ turn: 1, pits: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 8] });
    const { state } = applyMove(start, 11);
    expect(state.pits).toEqual([1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0]);
    expect(state.scores).toEqual([0, 1]);
  });

  it("wraps past its own store and keeps going round the board", () => {
    const start = position({ pits: [0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0] });
    const { state } = applyMove(start, 5);
    // 14 seeds: the store, pits 6-11, pits 0-5, then one more into the store.
    expect(state.pits).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(state.scores).toEqual([2, 0]);
  });
});

describe("the extra turn", () => {
  it("keeps the turn when the last seed lands in the mover's store", () => {
    const start = position({ pits: [1, 0, 0, 0, 0, 1, 4, 4, 4, 4, 4, 4] });
    const { state, events } = applyMove(start, 5);
    expect(state.scores).toEqual([1, 0]);
    expect(state.turn).toBe(0);
    expect(types(events)).toContain("extraTurn");
    expect(types(events)).not.toContain("turn");
  });

  it("gives North the same extra turn from its own last pit", () => {
    const start = position({ turn: 1, pits: [4, 4, 4, 4, 4, 4, 1, 0, 0, 0, 0, 1] });
    const { state } = applyMove(start, 11);
    expect(state.scores).toEqual([0, 1]);
    expect(state.turn).toBe(1);
  });
});

describe("the capture", () => {
  it("takes the landing seed and the facing pit when the last seed lands in the mover's empty pit", () => {
    const start = position({ pits: [1, 0, 1, 0, 0, 0, 4, 4, 5, 4, 4, 4] });
    const { state, events } = applyMove(start, 2);
    // The seed lands in pit 3, which was empty. Pit 8 faces pit 3 and holds 5.
    expect(state.pits[3]).toBe(0);
    expect(state.pits[8]).toBe(0);
    expect(state.scores).toEqual([6, 0]);
    const capture = events.find((event) => event.type === "capture");
    expect(capture).toMatchObject({ pit: 3, facing: 8, count: 6, player: 0 });
  });

  it("still takes the single landing seed when the facing pit is empty", () => {
    const start = position({ pits: [1, 0, 1, 0, 0, 0, 4, 4, 0, 4, 4, 4] });
    const { state } = applyMove(start, 2);
    expect(state.scores).toEqual([1, 0]);
    expect(state.pits[3]).toBe(0);
  });

  it("does not capture in the opponent's row", () => {
    const start = position({ pits: [1, 0, 0, 0, 0, 2, 0, 4, 4, 4, 4, 4] });
    const { state } = applyMove(start, 5);
    // One seed to the store, the last one into pit 6, which is North's.
    expect(state.pits[6]).toBe(1);
    expect(state.scores).toEqual([1, 0]);
  });

  it("does not capture when the landing pit already held seeds", () => {
    const start = position({ pits: [0, 0, 1, 3, 0, 0, 4, 4, 5, 4, 4, 4] });
    const { state } = applyMove(start, 2);
    expect(state.pits[3]).toBe(4);
    expect(state.pits[8]).toBe(5);
    expect(state.scores).toEqual([0, 0]);
  });
});

describe("the end of the game", () => {
  it("sweeps the seeds left on the board to the player who owns that row", () => {
    // South plays its last seed into its store, so South's row is empty and
    // the four seeds left in North's row go to North.
    const start = position({ pits: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 4], scores: [28, 15] });
    const { state, events } = applyMove(start, 5);
    expect(state.over).toBe(true);
    expect(state.scores).toEqual([29, 19]);
    expect(state.winner).toBe(0);
    expect(events.some((event) => event.type === "sweep" && event.player === 1)).toBe(true);
    expect(state.endReason).toBe("side-empty");
  });

  it("ends the game when a move empties the mover's own row", () => {
    const start = position({ pits: [0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0], scores: [20, 26] });
    const { state } = applyMove(start, 5);
    // One seed to the store, one to pit 6, then South has nothing left.
    expect(state.over).toBe(true);
    expect(state.scores).toEqual([21, 27]);
    expect(state.winner).toBe(1);
  });

  it("calls an equal split a draw", () => {
    const start = position({ pits: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], scores: [23, 24] });
    const { state } = applyMove(start, 5);
    expect(state.over).toBe(true);
    expect(state.scores).toEqual([24, 24]);
    expect(state.winner).toBe(null);
  });

  it("offers no moves once the game is over", () => {
    const over = position({ over: true });
    expect(legalMoves(over)).toEqual([]);
  });

  it("never loses a seed, whatever the move", () => {
    let state = createGame();
    let guard = 0;
    while (!state.over && guard < 500) {
      const moves = legalMoves(state);
      state = applyMove(state, moves[guard % moves.length]).state;
      expect(state.pits.reduce((a, b) => a + b, 0) + state.scores[0] + state.scores[1]).toBe(48);
      guard += 1;
    }
    expect(state.over).toBe(true);
  });
});

describe("rejecting bad moves", () => {
  it("refuses a pit that is not the mover's", () => {
    expect(() => applyMove(createGame(), 7)).toThrow();
  });

  it("refuses an empty pit", () => {
    const start = position({ pits: [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] });
    expect(() => applyMove(start, 0)).toThrow();
  });

  it("leaves the position it was given untouched", () => {
    const start = createGame();
    const before = JSON.stringify(start);
    applyMove(start, 0);
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe("describeMove", () => {
  it("names what a move would do without playing it", () => {
    const start = position({ pits: [1, 0, 0, 0, 0, 1, 4, 4, 4, 4, 4, 4] });
    expect(describeMove(start, 5)).toMatchObject({ extraTurn: true, captured: 0, gain: 1 });
  });

  it("counts the seeds a capture would win", () => {
    const start = position({ pits: [1, 0, 1, 0, 0, 0, 4, 4, 5, 4, 4, 4] });
    expect(describeMove(start, 2)).toMatchObject({ extraTurn: false, captured: 6, gain: 6 });
  });
});
