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
 * How long a seed takes to cross from one pit to the next, in milliseconds.
 *
 * This is a pace per PIT, not per event, because the seeds of one lift all
 * leave together and fly as a stream: the first drops into the next pit, the
 * second carries on to the pit after it, and the last one crosses the whole
 * distance. So a lift of five seeds takes five gaps from first lift to last
 * landing. See `sowingLaps` and render.js.
 *
 * The number comes from the game this copies. A move of five seeds there runs
 * for 2.85 seconds, which is about 570ms per pit, and five seeds are in the
 * air at once. An earlier version of this file used 150ms and flew one seed at
 * a time; a seed then crossed a pit in a tenth of a second, which reads as a
 * jump rather than a throw.
 *
 * A long Ba-awa relay cannot have that pace. Its last seed would fly for one
 * gap per seed sown, so a forty-seed move would run for nearly twenty seconds.
 * The gap therefore shrinks as a move gets longer, to hold the whole move
 * inside MOVE_BUDGET, and never falls below MIN_GAP.
 *
 * @param {Object[]} events the events of one move
 * @param {number} speed 1 is normal, 2 and 3 are faster, 0 is no animation
 * @returns {number} milliseconds for one seed to cross one pit
 */
export function paceFor(events, speed) {
  if (speed === 0) return 0;
  const seeds = events.filter((event) => event.type === "drop" || event.type === "store").length;
  const gap = Math.min(BASE_GAP, Math.max(MIN_GAP, MOVE_BUDGET / Math.max(1, seeds)));
  return Math.round(gap / speed);
}

/** Milliseconds a seed takes to cross one pit in a short move. */
export const BASE_GAP = 560;

/** The floor on that time, however long the relay. */
export const MIN_GAP = 85;

/** How long a whole move may run before the gap starts to shrink. */
export const MOVE_BUDGET = 6500;

/**
 * Split a move's events into laps, so the screen can fly a whole lift at once.
 *
 * A lap is one `lift` and the seeds it sows. The lift says how many seeds the
 * hand picked up, so the lap is complete after that many `drop` and `store`
 * events; a Ba-awa relay then lifts again and starts the next lap.
 *
 * A `capture` belongs to the seed that caused it, so it rides along as an
 * `extra` on that step. Everything after the last lap, which is the turn
 * change, any sweep and the closing event, comes back as `tail`.
 *
 * @param {Object[]} events the events of one move
 * @returns {{laps: Array<{lift: Object, steps: Array<{event: Object, extras: Object[]}>}>, tail: Object[]}}
 */
export function sowingLaps(events) {
  const laps = [];
  const tail = [];
  let lap = null;

  for (const event of events) {
    if (event.type === "lift") {
      lap = { lift: event, steps: [] };
      laps.push(lap);
      continue;
    }
    if (event.type === "drop" || event.type === "store") {
      if (lap) {
        lap.steps.push({ event, extras: [] });
        continue;
      }
    }
    // A capture, and anything else that arrives mid-lap, hangs on the seed
    // that was last dropped. Once a lap has all its seeds, the rest is tail.
    const open = lap && lap.steps.length > 0 && lap.steps.length <= lap.lift.count;
    if (open && event.type === "capture") {
      lap.steps[lap.steps.length - 1].extras.push(event);
      continue;
    }
    tail.push(event);
  }

  return { laps, tail };
}

export { PIT_COUNT };
