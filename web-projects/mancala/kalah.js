// Kalah: the mancala most people have played, and the one the app screenshots
// show. Each player owns six pits and one big store. A move lifts every seed
// out of one of your own pits and drops them one by one, counterclockwise, into
// the pits and into your own store, but never into the opponent's store.
//
// Two rules make the game:
//   - Last seed in your own store: play again.
//   - Last seed in an empty pit of your own row: take it and the facing pit.
//
// The game ends as soon as one whole row is empty. Every seed still on the
// board then goes to the player who owns the row it sits in.
//
// This module is pure. `applyMove` returns a new state plus an ordered list of
// events, and the screen replays those events one at a time (see playback.js).

import {
  PIT_COUNT,
  ROW,
  SOUTH,
  NORTH,
  other,
  homeStart,
  homePits,
  oppositePit,
  initialPits,
  seedsIn,
  fixedOwners,
} from "./board.js";

/** Seeds in each pit at the start. Twelve pits, so 48 seeds in the game. */
export const SEEDS_PER_PIT = 4;

/** This module's rule-set name, the value `state.mode` carries. */
export const MODE = "kalah";

/**
 * @typedef {Object} GameState
 * @property {string} mode always "kalah"
 * @property {number[]} pits seeds in each of the twelve pits
 * @property {number[]} scores seeds in each player's store, [South, North]
 * @property {number} turn the player to move
 * @property {number[]} owner who owns each pit; fixed in Kalah
 * @property {boolean} over true once the game has finished
 * @property {number|null} winner the player with more seeds, or null for a draw
 * @property {string|null} endReason why the game ended
 * @property {number} plies how many moves have been played
 */

/**
 * A new game in the opening position.
 * @param {{seedsPerPit?: number, firstPlayer?: number}} [options]
 * @returns {GameState}
 */
export function createGame(options = {}) {
  return {
    mode: MODE,
    pits: initialPits(options.seedsPerPit ?? SEEDS_PER_PIT),
    scores: [0, 0],
    turn: options.firstPlayer ?? SOUTH,
    owner: fixedOwners(),
    over: false,
    winner: null,
    endReason: null,
    plies: 0,
  };
}

/**
 * The slots a player sows into, in order, starting at their own first pit.
 * A slot is either a pit or that player's own store. The opponent's store is
 * not in the list, which is how "skip the opponent's store" is enforced.
 * @param {number} player the mover
 * @returns {Array<{kind: string, index?: number, player?: number}>}
 */
function sowingPath(player) {
  const slots = [];
  const start = homeStart(player);
  for (let step = 0; step < PIT_COUNT; step += 1) {
    const pit = (start + step) % PIT_COUNT;
    slots.push({ kind: "pit", index: pit });
    if (step === ROW - 1) slots.push({ kind: "store", player });
  }
  return slots;
}

const PATHS = [sowingPath(SOUTH), sowingPath(NORTH)];

/**
 * The pits the player to move may choose: their own row, minus the empty pits.
 * @param {GameState} state
 * @returns {number[]} pit indices
 */
export function legalMoves(state) {
  if (state.over) return [];
  return homePits(state.turn).filter((pit) => state.pits[pit] > 0);
}

/**
 * Play one move and return the position it leads to, with the events that got
 * there. The state passed in is never changed.
 * @param {GameState} state the position to move from
 * @param {number} pit the pit to lift
 * @returns {{state: GameState, events: Object[]}}
 * @throws {Error} when the pit is not a legal move
 */
export function applyMove(state, pit) {
  if (state.over) throw new Error("the game is over");
  if (!legalMoves(state).includes(pit)) throw new Error(`pit ${pit} is not a legal move`);

  const mover = state.turn;
  const pits = state.pits.slice();
  const scores = state.scores.slice();
  const events = [];

  let hand = pits[pit];
  pits[pit] = 0;
  events.push({ type: "lift", pit, count: hand, player: mover });

  const path = PATHS[mover];
  let at = path.findIndex((slot) => slot.kind === "pit" && slot.index === pit);
  let landedInStore = false;
  let landedPit = -1;

  while (hand > 0) {
    at = (at + 1) % path.length;
    const slot = path[at];
    hand -= 1;
    if (slot.kind === "store") {
      scores[mover] += 1;
      landedInStore = hand === 0;
      landedPit = -1;
      events.push({ type: "store", player: mover, total: scores[mover], last: hand === 0 });
    } else {
      const wasEmpty = pits[slot.index] === 0;
      pits[slot.index] += 1;
      landedInStore = false;
      landedPit = slot.index;
      events.push({
        type: "drop",
        pit: slot.index,
        seeds: pits[slot.index],
        wasEmpty,
        last: hand === 0,
        player: mover,
      });
    }
  }

  // The capture: the last seed landed in a pit of the mover's own row that was
  // empty before the drop. The mover takes it and everything facing it.
  let captured = 0;
  if (landedPit >= 0 && state.owner[landedPit] === mover && pits[landedPit] === 1) {
    const facing = oppositePit(landedPit);
    captured = pits[landedPit] + pits[facing];
    pits[landedPit] = 0;
    pits[facing] = 0;
    scores[mover] += captured;
    events.push({ type: "capture", pit: landedPit, facing, count: captured, player: mover });
  }

  const next = {
    ...state,
    pits,
    scores,
    turn: landedInStore ? mover : other(mover),
    plies: state.plies + 1,
  };

  const finished = finish(next, events);
  if (!finished.over) {
    events.push({ type: landedInStore ? "extraTurn" : "turn", player: finished.turn });
  }
  return { state: finished, events };
}

/**
 * End the game if either row is empty, sweeping the seeds that are left to the
 * player who owns the row they sit in. Pushes the events it creates.
 * @param {GameState} state the position after a move
 * @param {Object[]} events the event list to append to
 * @returns {GameState} the same position, finished if a row ran out
 */
function finish(state, events) {
  const rows = [homePits(SOUTH), homePits(NORTH)];
  const left = [seedsIn(state.pits, rows[SOUTH]), seedsIn(state.pits, rows[NORTH])];
  if (left[SOUTH] > 0 && left[NORTH] > 0) return state;

  const pits = state.pits.slice();
  const scores = state.scores.slice();
  for (const player of [SOUTH, NORTH]) {
    if (left[player] === 0) continue;
    scores[player] += left[player];
    events.push({ type: "sweep", player, count: left[player], pits: rows[player].slice() });
    for (const index of rows[player]) pits[index] = 0;
  }

  const winner = scores[SOUTH] === scores[NORTH] ? null : scores[SOUTH] > scores[NORTH] ? SOUTH : NORTH;
  // `turn` rides along so the screen's copy of the board can match the
  // engine's exactly, even on the move that ends the game (see playback.js).
  events.push({ type: "gameOver", winner, scores: scores.slice(), reason: "side-empty", turn: state.turn });
  return { ...state, pits, scores, over: true, winner, endReason: "side-empty" };
}

/**
 * What a move would do, without committing to it. The setup screen uses this
 * for hints and the simpler opponents use it as their whole brain.
 * @param {GameState} state the position to move from
 * @param {number} pit the pit to lift
 * @returns {{extraTurn: boolean, captured: number, gain: number, state: GameState}}
 */
export function describeMove(state, pit) {
  const { state: after, events } = applyMove(state, pit);
  let captured = 0;
  let stored = 0;
  let extraTurn = false;
  for (const event of events) {
    if (event.type === "capture") captured += event.count;
    if (event.type === "store") stored += 1;
    if (event.type === "extraTurn") extraTurn = true;
    // A move that ends the game still counted as an extra turn if the last
    // seed reached the store, but no extraTurn event is emitted then.
    if (event.type === "store" && event.last) extraTurn = true;
  }
  return { extraTurn, captured, gain: captured + stored, state: after };
}

export { SOUTH, NORTH };
