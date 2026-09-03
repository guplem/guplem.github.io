// The picture on the screen, which trails the engine by one event.
//
// An engine move answers with the finished position and a list of everything
// that happened on the way there. If the screen drew the finished position at
// once, a move that sows nine seeds and captures four would appear as a single
// jump, and the player would never see where the seeds went.
//
// So the screen keeps a second, slower copy of the board: a snapshot. It starts
// as the position before the move and takes the events one at a time, and the
// animation runs between one snapshot and the next. The engine holds the truth;
// the snapshot holds the picture.
//
// This module is pure. It draws nothing and it reads no clock.

import { PIT_COUNT } from "./board.js";

/**
 * @typedef {Object} Shown
 * @property {number[]} pits seeds in each pit as the screen has it
 * @property {number[]} scores each player's captured seeds as the screen has it
 * @property {number[]} owner who owns each pit
 * @property {number} turn the player the screen says is to move
 * @property {string} mode the rule set
 * @property {{pit: number, left: number}|null} hand the pit a move lifted from
 *   and how many seeds are still in the hand, or null between moves
 * @property {boolean} over whether the screen has shown the end yet
 * @property {number|null} winner
 * @property {number|null} lastPit the pit the last seed went into
 */

/**
 * The picture of a position, before any event has played.
 * @param {Object} state a game state from either engine
 * @returns {Shown}
 */
export function snapshot(state) {
  return {
    pits: state.pits.slice(),
    scores: state.scores.slice(),
    owner: state.owner.slice(),
    turn: state.turn,
    mode: state.mode,
    hand: null,
    over: state.over,
    winner: state.winner ?? null,
    lastPit: null,
  };
}

/**
 * Move the picture on by one event.
 * @param {Shown} shown the picture as it is now
 * @param {Object} event one event from an engine move
 * @returns {Shown} the picture after that event
 */
export function applyEvent(shown, event) {
  const next = {
    ...shown,
    pits: shown.pits.slice(),
    scores: shown.scores.slice(),
    owner: shown.owner.slice(),
  };

  switch (event.type) {
    case "lift":
      next.pits[event.pit] = 0;
      next.hand = { pit: event.pit, left: event.count };
      next.lastPit = event.pit;
      break;

    case "drop":
      next.pits[event.pit] = event.seeds;
      next.hand = next.hand ? { ...next.hand, left: Math.max(0, next.hand.left - 1) } : null;
      next.lastPit = event.pit;
      break;

    case "store":
      next.scores[event.player] = event.total;
      next.hand = next.hand ? { ...next.hand, left: Math.max(0, next.hand.left - 1) } : null;
      next.lastPit = null;
      break;

    case "capture":
      next.pits[event.pit] = 0;
      if (typeof event.facing === "number") next.pits[event.facing] = 0;
      next.scores[event.player] += event.count;
      break;

    case "sweep":
      for (const pit of event.pits ?? []) next.pits[pit] = 0;
      next.scores[event.player] += event.count;
      break;

    case "turn":
    case "extraTurn":
      next.turn = event.player;
      next.hand = null;
      break;

    case "gameOver":
      next.over = true;
      next.winner = event.winner;
      next.hand = null;
      if (typeof event.turn === "number") next.turn = event.turn;
      break;

    default:
      // relayCutOff and anything added later change nothing on the board.
      break;
  }

  return next;
}

/**
 * Play a whole move into the picture at once. Used for a move the player must
 * not wait for, and by the tests that check the picture and the engine agree.
 * @param {Shown} shown the picture before the move
 * @param {Object[]} events the events of one move
 * @returns {Shown} the picture after the move
 */
export function applyEvents(shown, events) {
  return events.reduce(applyEvent, shown);
}

/**
 * How long the screen should spend on one event, in milliseconds.
 * The pace comes from the number of events: a move that sows thirty seeds must
 * not take thirty times as long as a move that sows one, or a long relay in
 * Ba-awa would feel broken.
 * @param {Object[]} events the events of one move
 * @param {number} speed 1 is normal, 2 is fast, 0 is no animation at all
 * @returns {number} milliseconds per seed
 */
export function paceFor(events, speed) {
  if (speed === 0) return 0;
  const drops = events.filter((event) => event.type === "drop" || event.type === "store").length;
  const base = drops <= 6 ? 150 : drops <= 14 ? 105 : drops <= 30 ? 70 : 42;
  return Math.max(16, Math.round(base / speed));
}

export { PIT_COUNT };
