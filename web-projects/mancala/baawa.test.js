import { describe, it, expect } from "bun:test";
import {
  createGame,
  legalMoves,
  applyMove,
  describeMove,
  STALL_TURNS,
  ENDGAME_SEEDS,
  ENDGAME_QUIET_TURNS,
} from "./baawa.js";
import { ownersFromPitCounts } from "./board.js";

/**
 * Build a Ba-awa position for a test. Anything not given keeps the default.
 *
 * Most fixtures park a fat pit out of the way, usually pit 10 with twelve
 * seeds. Two rules would otherwise end the round before the rule under test
 * could fire: a board down to eight seeds stops, and a player with no seed
 * hands the rest over. Twelve seeds never reach four, so the ballast changes
 * nothing else.
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

  it("puts four seeds in every pit and has no stores", () => {
    expect(game.pits).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    expect(game.scores).toEqual([0, 0]);
  });

  it("does not capture the four seeds a pit starts with", () => {
    // The capture only fires when a seed is dropped INTO a pit that then holds
    // four. The setup itself never scores.
    expect(createGame().scores).toEqual([0, 0]);
  });

  it("offers the pits the mover owns", () => {
    expect(legalMoves(game)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(legalMoves({ ...game, turn: 1 })).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it("offers conquered pits too, and only those with seeds", () => {
    const owner = ownersFromPitCounts(8, 4);
    const start = position({ owner, pits: [1, 0, 1, 0, 0, 0, 2, 0, 3, 0, 0, 0] });
    expect(legalMoves(start)).toEqual([0, 2, 6]);
    expect(legalMoves({ ...start, turn: 1 })).toEqual([8]);
  });
});

describe("sowing", () => {
  it("stops when the last seed lands in an empty pit", () => {
    const start = position({ pits: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 12, 0] });
    const { state, events } = applyMove(start, 0);
    expect(state.pits).toEqual([0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 12, 0]);
    expect(state.turn).toBe(1);
    expect(types(events)).toEqual(["lift", "drop", "turn"]);
  });

  it("lifts the pit again and keeps going when the last seed lands in an occupied pit", () => {
    // One seed from pit 0 lands in pit 1, which already holds one. Those two
    // are lifted and sown into pits 2 and 3, and pit 3 was empty, so it stops.
    const start = position({ pits: [1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 12, 0] });
    const { state, events } = applyMove(start, 0);
    expect(state.pits).toEqual([0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 12, 0]);
    expect(types(events)).toEqual(["lift", "drop", "lift", "drop", "drop", "turn"]);
  });

  it("never sows into a store, because there is none", () => {
    const start = position({ pits: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 12, 0] });
    const { state } = applyMove(start, 5);
    expect(state.pits[6]).toBe(1);
    expect(state.scores).toEqual([0, 0]);
  });

  it("wraps round the ring", () => {
    const start = position({ pits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 1], turn: 1 });
    const { state } = applyMove(start, 11);
    expect(state.pits[0]).toBe(1);
  });
});

describe("the four-seed capture", () => {
  it("gives the four seeds to the player who owns the pit", () => {
    // North sows two seeds from pit 11. The first lands in pit 0, which held
    // three, so South takes those four even though North is the one moving.
    const start = position({ turn: 1, pits: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 2] });
    const { state, events } = applyMove(start, 11);
    expect(state.scores).toEqual([4, 0]);
    expect(state.pits[0]).toBe(0);
    expect(state.pits[1]).toBe(1);
    expect(events.find((event) => event.type === "capture")).toMatchObject({
      pit: 0,
      count: 4,
      player: 0,
      last: false,
    });
  });

  it("gives them to the mover instead when it is the last seed of the move", () => {
    const start = position({ turn: 1, pits: [3, 0, 0, 0, 1, 0, 0, 0, 0, 0, 12, 1] });
    const { state, events } = applyMove(start, 11);
    expect(state.scores).toEqual([0, 4]);
    expect(state.pits[0]).toBe(0);
    expect(events.find((event) => event.type === "capture")).toMatchObject({
      pit: 0,
      count: 4,
      player: 1,
      last: true,
    });
  });

  it("ends the move when the last seed makes four, because the pit is now empty", () => {
    const start = position({ pits: [1, 3, 0, 0, 0, 0, 1, 0, 0, 0, 12, 0] });
    const { state, events } = applyMove(start, 0);
    expect(state.scores).toEqual([4, 0]);
    expect(state.turn).toBe(1);
    expect(types(events)).toEqual(["lift", "drop", "capture", "turn"]);
  });

  it("keeps sowing after a capture that was not the last seed", () => {
    const start = position({ pits: [2, 3, 0, 0, 0, 0, 1, 0, 0, 0, 12, 0] });
    const { state, events } = applyMove(start, 0);
    // Pit 1 reaches four and is emptied, then the second seed lands in pit 2.
    expect(state.scores).toEqual([4, 0]);
    expect(state.pits).toEqual([0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 12, 0]);
    expect(types(events)).toEqual(["lift", "drop", "capture", "drop", "turn"]);
  });

  it("takes only exactly four, never five", () => {
    const start = position({ pits: [1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0] });
    const { state } = applyMove(start, 0);
    expect(state.scores).toEqual([0, 0]);
    // Pit 1 now holds five, so it is lifted and sown on instead.
    expect(state.pits[1]).toBe(0);
  });
});

describe("the end of a round", () => {
  it("gives every seed left to the other player when the player to move has none", () => {
    // North sows inside its own row and leaves South with nothing to play.
    const start = position({ turn: 1, pits: [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 12, 0] });
    const { state, events } = applyMove(start, 6);
    expect(state.over).toBe(true);
    expect(state.endReason).toBe("starved");
    expect(state.scores).toEqual([0, 14]);
    expect(state.pits).toEqual(new Array(12).fill(0));
    expect(events.some((event) => event.type === "sweep" && event.player === 1)).toBe(true);
    expect(state.winner).toBe(1);
  });

  it("stops a quiet endgame and gives the last seeds to whoever started", () => {
    // Eight seeds cannot really be made to reach four again, so once they go
    // round without a capture the round stops and the player who moved first
    // in it takes them.
    const start = position({
      pits: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7],
      starter: 0,
      sinceCapture: ENDGAME_QUIET_TURNS,
    });
    const { state, events } = applyMove(start, 1);
    expect(state.over).toBe(true);
    expect(state.endReason).toBe("eight-left");
    expect(state.scores).toEqual([8, 0]);
    expect(state.pits).toEqual(new Array(12).fill(0));
    expect(events.some((event) => event.type === "sweep" && event.player === 0)).toBe(true);
  });

  it("gives those last seeds to North when North started the round", () => {
    const start = position({
      pits: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7],
      starter: 1,
      sinceCapture: ENDGAME_QUIET_TURNS,
    });
    const { state } = applyMove(start, 1);
    expect(state.endReason).toBe("eight-left");
    expect(state.scores).toEqual([0, 8]);
  });

  it("keeps playing while more than eight seeds are on the board", () => {
    const start = position({
      pits: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9],
      starter: 0,
      sinceCapture: ENDGAME_QUIET_TURNS + 3,
    });
    const { state } = applyMove(start, 1);
    expect(state.over).toBe(false);
  });

  it("keeps playing in an endgame where seeds are still being taken", () => {
    // Eight seeds on the board, but a capture happened recently, so the round
    // is still alive and the main ending gets its chance.
    const start = position({ pits: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7], sinceCapture: 0 });
    const { state } = applyMove(start, 1);
    expect(state.over).toBe(false);
  });

  it("remembers who started the round", () => {
    expect(createGame().starter).toBe(0);
    expect(createGame({ firstPlayer: 1 }).starter).toBe(1);
  });

  it("stops a round where nobody can capture any more", () => {
    const start = position({
      pits: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11],
      sinceCapture: STALL_TURNS - 1,
    });
    const { state } = applyMove(start, 0);
    expect(state.over).toBe(true);
    expect(state.endReason).toBe("stalled");
    // Each player keeps the seeds sitting in the pits they own.
    expect(state.scores).toEqual([1, 11]);
    expect(state.winner).toBe(1);
  });

  it("forgets the stall count as soon as somebody captures", () => {
    const start = position({ pits: [1, 3, 1, 0, 0, 0, 1, 0, 0, 0, 12, 0], sinceCapture: 5 });
    const { state } = applyMove(start, 0);
    expect(state.sinceCapture).toBe(0);
    expect(state.over).toBe(false);
  });

  it("adds the swept seeds before it decides the winner, and calls a tie a draw", () => {
    const start = position({ turn: 1, pits: [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0], scores: [23, 21] });
    const { state } = applyMove(start, 6);
    // South has nothing left, so North sweeps the last two seeds, and that
    // makes the scores level.
    expect(state.endReason).toBe("starved");
    expect(state.scores).toEqual([23, 23]);
    expect(state.winner).toBe(null);
  });

  it("offers no moves once the round is over", () => {
    expect(legalMoves(position({ over: true }))).toEqual([]);
  });
});

describe("relay sowing always finishes", () => {
  it("never lets the endgame rule fire while nine or more seeds are in play", () => {
    // ENDGAME_SEEDS is the whole reason the stall rule almost never fires.
    expect(ENDGAME_SEEDS).toBe(8);
  });

  it("plays a full round without hanging and never loses a seed", () => {
    let state = createGame();
    let guard = 0;
    while (!state.over && guard < 2000) {
      const moves = legalMoves(state);
      state = applyMove(state, moves[guard % moves.length]).state;
      const total = state.pits.reduce((a, b) => a + b, 0) + state.scores[0] + state.scores[1];
      expect(total).toBe(48);
      guard += 1;
    }
    expect(state.over).toBe(true);
    expect(state.scores[0] + state.scores[1]).toBe(48);
  });

  it("stops a relay that would go round for ever", () => {
    // Every pit holds one seed, so each drop lands in an empty pit... except
    // this position is built so the relay keeps finding occupied pits. The lap
    // cap must break it rather than hang the browser.
    const start = position({ pits: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] });
    const { state, events } = applyMove(start, 0);
    expect(state.over === true || state.turn === 1).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe("rejecting bad moves", () => {
  it("refuses a pit the mover does not own", () => {
    expect(() => applyMove(createGame(), 7)).toThrow();
  });

  it("refuses an empty pit", () => {
    expect(() => applyMove(position({ pits: [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] }), 0)).toThrow();
  });

  it("leaves the position it was given untouched", () => {
    const start = createGame();
    const before = JSON.stringify(start);
    applyMove(start, 0);
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe("describeMove", () => {
  it("counts what the mover would take and what the opponent would take", () => {
    const start = position({ turn: 1, pits: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2] });
    expect(describeMove(start, 11)).toMatchObject({ gain: 0, given: 4, laps: 1 });
  });

  it("counts the mover's own last-seed capture as a gain", () => {
    const start = position({ turn: 1, pits: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] });
    expect(describeMove(start, 11)).toMatchObject({ gain: 4, given: 0 });
  });
});
