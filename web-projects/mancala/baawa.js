// Ba-awa: the mancala played in Ghana. The board is the same ring of twelve
// pits, but there are no stores, and the game feels nothing like Kalah.
//
// A move lifts every seed out of one pit you own and sows them counterclockwise
// one per pit. Then the move usually keeps going:
//
//   - Last seed lands in an EMPTY pit: the move ends.
//   - Last seed lands in an OCCUPIED pit: lift that whole pit and sow again,
//     from there. This is called relay sowing, and one move can travel round
//     the board many times.
//
// Scoring has nothing to do with stores. Any pit that reaches EXACTLY four
// seeds is emptied at once and those four are captured:
//
//   - Normally the player who OWNS that pit takes them, even if the opponent
//     is the one sowing.
//   - If the seed that made it four was the LAST seed of the move, the player
//     who is moving takes them instead, wherever the pit is.
//
// A round ends when the player whose turn it is owns no seed at all. Every
// seed still on the board then goes to the other player.
//
// One more rule closes the endgame. Once only eight seeds are left they can
// hardly be gathered into a four again, and they can circle the board for
// ever. So if eight or fewer seeds go 18 turns with nobody capturing, the
// round stops there and the player who moved first in it takes them.
//
// Rounds add up into a match, and the captured seeds buy pits for the next
// round: see match.js. This module plays one round and nothing more.
//
// Two limits this file makes explicit, because a program needs a number where
// players would just agree to stop:
//   - STALL_TURNS: after this many turns in a row with no capture the round
//     ends and each player keeps the seeds in the pits they own. This is a
//     backstop and almost never fires, because the endgame rule above stops a
//     quiet endgame first. It was written when that rule was missing, and it
//     then decided over four rounds in ten, which is far too many.
//   - MAX_LAPS: a relay is cut off after this many lifts. Nothing in the rules
//     stops a relay from looping for ever, and a browser tab must not freeze.
//
// This module is pure. `applyMove` returns a new state plus an ordered list of
// events, and the screen replays those events one at a time (see playback.js).

import { PIT_COUNT, SOUTH, NORTH, other, seedsIn, fixedOwners, initialPits } from "./board.js";

/** Seeds in each pit at the start of a round. */
export const SEEDS_PER_PIT = 4;

/** The pit size that scores. A pit holding exactly this is emptied at once. */
export const CAPTURE_AT = 4;

/**
 * Seeds left on the board that count as the endgame. Eight seeds spread round
 * twelve pits can hardly be gathered into a four again.
 */
export const ENDGAME_SEEDS = 8;

/**
 * Turns without a capture that end an endgame. Both this and ENDGAME_SEEDS
 * must hold: a quiet endgame stops, and a lively one plays on.
 *
 * The number is a trade-off, measured over 75 self-played rounds. Raising it
 * lets more rounds reach the main ending, which rewards play rather than the
 * luck of who started the round, but it also adds quiet moves at the end that
 * nobody enjoys watching. At 6 turns only 23 rounds in 100 reached the main
 * ending; at 18 it is 44, and a round runs about 26 moves.
 */
export const ENDGAME_QUIET_TURNS = 18;

/**
 * Turns in a row with no capture that end a round at any seed count. This is
 * only a backstop against a full board circling for ever, and it should
 * almost never fire.
 */
export const STALL_TURNS = 40;

/** Lifts in one move before the relay is cut off. */
export const MAX_LAPS = 300;

/** This module's rule-set name, the value `state.mode` carries. */
export const MODE = "baawa";

/**
 * @typedef {Object} GameState
 * @property {string} mode always "baawa"
 * @property {number[]} pits seeds in each of the twelve pits
 * @property {number[]} scores seeds captured, [South, North]
 * @property {number} turn the player to move
 * @property {number[]} owner who owns each pit; a round can start with pits
 *   conquered in an earlier round, so this is not fixed
 * @property {boolean} over true once the round has finished
 * @property {number|null} winner the player with more captured seeds, or null
 * @property {number} starter the player who moved first in this round, who
 *   takes the last eight seeds
 * @property {string|null} endReason "eight-left", "starved" or "stalled"
 * @property {number} sinceCapture turns in a row with no capture
 * @property {number} plies how many moves have been played
 */

/**
 * A new round in the opening position.
 * @param {{owner?: number[], firstPlayer?: number, seedsPerPit?: number}} [options]
 * @returns {GameState}
 */
export function createGame(options = {}) {
  return {
    mode: MODE,
    pits: initialPits(options.seedsPerPit ?? SEEDS_PER_PIT),
    scores: [0, 0],
    turn: options.firstPlayer ?? SOUTH,
    starter: options.firstPlayer ?? SOUTH,
    owner: options.owner ? options.owner.slice() : fixedOwners(),
    over: false,
    winner: null,
    endReason: null,
    sinceCapture: 0,
    plies: 0,
  };
}

/**
 * The pits a player owns, in sowing order.
 * @param {number[]} owner owner per pit
 * @param {number} player SOUTH or NORTH
 * @returns {number[]} pit indices
 */
export function pitsOwnedBy(owner, player) {
  const out = [];
  for (let pit = 0; pit < PIT_COUNT; pit += 1) if (owner[pit] === player) out.push(pit);
  return out;
}

/**
 * The pits the player to move may choose: the ones they own that hold a seed.
 * @param {GameState} state
 * @returns {number[]} pit indices
 */
export function legalMoves(state) {
  if (state.over) return [];
  return pitsOwnedBy(state.owner, state.turn).filter((pit) => state.pits[pit] > 0);
}

/**
 * Play one move, relay and all, and return the position it leads to with the
 * events that got there. The state passed in is never changed.
 * @param {GameState} state the position to move from
 * @param {number} pit the pit to lift
 * @returns {{state: GameState, events: Object[]}}
 * @throws {Error} when the pit is not a legal move
 */
export function applyMove(state, pit) {
  if (state.over) throw new Error("the round is over");
  if (!legalMoves(state).includes(pit)) throw new Error(`pit ${pit} is not a legal move`);

  const mover = state.turn;
  const pits = state.pits.slice();
  const scores = state.scores.slice();
  const events = [];

  let at = pit;
  let laps = 0;
  let captures = 0;

  for (;;) {
    laps += 1;
    let hand = pits[at];
    pits[at] = 0;
    events.push({ type: "lift", pit: at, count: hand, player: mover, lap: laps });

    while (hand > 0) {
      at = (at + 1) % PIT_COUNT;
      pits[at] += 1;
      hand -= 1;
      const last = hand === 0;
      events.push({ type: "drop", pit: at, seeds: pits[at], last, player: mover });

      if (pits[at] === CAPTURE_AT) {
        // The last seed of the move pays the mover. Any earlier seed pays
        // whoever owns the pit, which may well be the opponent.
        const taker = last ? mover : state.owner[at];
        pits[at] = 0;
        scores[taker] += CAPTURE_AT;
        captures += 1;
        events.push({ type: "capture", pit: at, count: CAPTURE_AT, player: taker, last, byOwner: !last });
      }
    }

    // The move goes on only if the landing pit still holds more than the seed
    // that just arrived. A captured pit is empty, so a capture always stops it.
    if (pits[at] < 2) break;
    if (laps >= MAX_LAPS) {
      events.push({ type: "relayCutOff", pit: at, laps });
      break;
    }
  }

  const next = {
    ...state,
    pits,
    scores,
    turn: other(mover),
    plies: state.plies + 1,
    sinceCapture: captures > 0 ? 0 : state.sinceCapture + 1,
  };

  const finished = finishRound(next, events);
  if (!finished.over) events.push({ type: "turn", player: finished.turn });
  return { state: finished, events };
}

/**
 * End the round if the player to move is out of seeds, or if the round has
 * stopped producing captures. Pushes the events it creates.
 * @param {GameState} state the position after a move
 * @param {Object[]} events the event list to append to
 * @returns {GameState} the same position, finished if a rule says so
 */
function finishRound(state, events) {
  const left = state.pits.reduce((total, seeds) => total + seeds, 0);
  const canMove = pitsOwnedBy(state.owner, state.turn).some((pit) => state.pits[pit] > 0);

  // The main ending, and the one to check first: the player to move owns no
  // seed, so the player who just moved takes everything that is left.
  if (!canMove) {
    const taker = other(state.turn);
    const scores = state.scores.slice();
    if (left > 0) {
      scores[taker] += left;
      events.push({ type: "sweep", player: taker, count: left, pits: filledPits(state.pits) });
    }
    return close({ ...state, pits: new Array(PIT_COUNT).fill(0), scores }, events, "starved");
  }

  // The quiet endgame: few seeds left and nobody taking any. The round stops
  // and the player who began it takes what is on the board. Both halves of the
  // test matter. Checking the seed count alone ended every single round here,
  // because the board always falls to eight seeds before a player runs out,
  // and the main ending above would then never happen at all.
  if (left <= ENDGAME_SEEDS && state.sinceCapture >= ENDGAME_QUIET_TURNS) {
    const scores = state.scores.slice();
    scores[state.starter] += left;
    events.push({ type: "sweep", player: state.starter, count: left, pits: filledPits(state.pits) });
    return close({ ...state, pits: new Array(PIT_COUNT).fill(0), scores }, events, "eight-left");
  }

  if (state.sinceCapture >= STALL_TURNS) {
    const scores = state.scores.slice();
    for (const player of [SOUTH, NORTH]) {
      const own = pitsOwnedBy(state.owner, player);
      const left = seedsIn(state.pits, own);
      if (left === 0) continue;
      scores[player] += left;
      events.push({ type: "sweep", player, count: left, pits: own.filter((pit) => state.pits[pit] > 0) });
    }
    return close({ ...state, pits: new Array(PIT_COUNT).fill(0), scores }, events, "stalled");
  }

  return state;
}

/**
 * The pits that hold at least one seed.
 * @param {number[]} pits the ring
 * @returns {number[]} pit indices
 */
function filledPits(pits) {
  const out = [];
  for (let pit = 0; pit < PIT_COUNT; pit += 1) if (pits[pit] > 0) out.push(pit);
  return out;
}

/**
 * Mark a round finished, work out who won it and push the closing event.
 * @param {GameState} state the position with every seed already swept
 * @param {Object[]} events the event list to append to
 * @param {string} reason why the round ended
 * @returns {GameState}
 */
function close(state, events, reason) {
  const [south, north] = state.scores;
  const winner = south === north ? null : south > north ? SOUTH : NORTH;
  // `turn` rides along so the screen's copy of the board can match the
  // engine's exactly, even on the move that ends the round (see playback.js).
  events.push({ type: "gameOver", winner, scores: state.scores.slice(), reason, turn: state.turn });
  return { ...state, over: true, winner, endReason: reason };
}

/**
 * What a move would do, without committing to it. A held pit shows this, the
 * simpler opponents use it as their whole brain, and both engines answer it
 * with the same fields (see modes.js).
 * @param {GameState} state the position to move from
 * @param {number} pit the pit to lift
 * @returns {{gain: number, given: number, laps: number, captured: number,
 *   extraTurn: boolean, lands: number|null, landsInStore: number|null,
 *   state: GameState}} `gain` is what the mover would capture, `captured` is
 *   the same number here because every Ba-awa seed is scored out of a pit,
 *   `given` is what the opponent would capture from the same move, `laps` is
 *   how many times the relay lifts, `extraTurn` is never true because the game
 *   has no extra turns, `lands` is the pit the last seed comes to rest in and
 *   `landsInStore` is always null because the game has no stores.
 */
export function describeMove(state, pit) {
  const { state: after, events } = applyMove(state, pit);
  const mover = state.turn;
  let gain = 0;
  let given = 0;
  let laps = 0;
  let lands = null;
  for (const event of events) {
    if (event.type === "lift") laps += 1;
    // Where the seeds end up: each drop overwrites the one before, so the last
    // drop of the last lap is where the last seed rests.
    if (event.type === "drop") lands = event.pit;
    if (event.type !== "capture") continue;
    if (event.player === mover) gain += event.count;
    else given += event.count;
  }
  return {
    gain,
    given,
    laps,
    captured: gain,
    extraTurn: false,
    lands,
    landsInStore: null,
    state: after,
  };
}

export { SOUTH, NORTH };
