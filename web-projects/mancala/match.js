// A match is what sits above one game. Kalah plays a single game and stops.
// Ba-awa plays round after round, and the captured seeds buy the pits for the
// next round: four seeds is one pit. A player who captured more than half the
// seeds therefore owns more than six pits, so the extra ones are taken off the
// opponent. That is the "conquest" the Ghanaian game is played for.
//
// A match ends when one player holds `pitsToWin` pits. Ten is the usual target,
// because taking all twelve is very hard.
//
// House rule this file makes explicit: 48 seeds do not always divide into
// fours, so one pit can be left over (one player has 1 seed spare and the
// other 3, or both have 2). The spare pit goes to the bigger leftover, and an
// even 2 and 2 goes to the player who moved second in the round that just
// ended, because moving first is an advantage.
//
// This module is pure. It never plays a move; it only decides what the next
// round looks like.

import { PIT_COUNT, SOUTH, NORTH, other, fixedOwners, ownersFromPitCounts } from "./board.js";
import { CAPTURE_AT } from "./baawa.js";

/** Pits one player must hold to win a Ba-awa match. */
export const DEFAULT_PITS_TO_WIN = 10;

/** Seeds in play, which every round redistributes. */
export const TOTAL_SEEDS = PIT_COUNT * CAPTURE_AT;

/**
 * @typedef {Object} MatchState
 * @property {string} mode the rule set, "kalah" or "baawa"
 * @property {boolean} conquest true when captured seeds buy pits for a new round
 * @property {number} round which round is being played, from 1
 * @property {number[]} owner who owns each pit in the round about to be played
 * @property {number[]} pitCounts how many pits each player holds, [South, North]
 * @property {number} firstPlayer who moves first in the round about to be played
 * @property {number} pitsToWin pits one player needs to win the match
 * @property {Object[]} history one entry per finished round
 * @property {boolean} over true once the match has finished
 * @property {number|null} winner the player who won the match, or null for a draw
 * @property {string|null} endReason "round", "conquest" or "wipeout"
 */

/**
 * Turn a round's captured seeds into a pit count for each player.
 * @param {number[]} scores seeds captured in the round, [South, North]
 * @param {number} spareTo who takes the spare pit if the leftovers are even
 * @returns {number[]} pits each player holds next round, [South, North]
 * @throws {Error} when the two scores are not the whole board
 */
export function distributePits(scores, spareTo) {
  if (scores[SOUTH] + scores[NORTH] !== TOTAL_SEEDS) {
    throw new Error(`${scores[SOUTH]} and ${scores[NORTH]} are not the ${TOTAL_SEEDS} seeds in play`);
  }
  const pits = [Math.floor(scores[SOUTH] / CAPTURE_AT), Math.floor(scores[NORTH] / CAPTURE_AT)];
  const spare = PIT_COUNT - pits[SOUTH] - pits[NORTH];
  if (spare === 1) {
    const leftover = [scores[SOUTH] % CAPTURE_AT, scores[NORTH] % CAPTURE_AT];
    const takes =
      leftover[SOUTH] === leftover[NORTH] ? spareTo : leftover[SOUTH] > leftover[NORTH] ? SOUTH : NORTH;
    pits[takes] += 1;
  }
  return pits;
}

/**
 * A new match, before its first round.
 * @param {{mode: string, conquest?: boolean, pitsToWin?: number, firstPlayer?: number}} options
 * @returns {MatchState}
 */
export function createMatch(options) {
  const conquest = options.mode === "baawa" && options.conquest !== false;
  return {
    mode: options.mode,
    conquest,
    round: 1,
    owner: fixedOwners(),
    pitCounts: [6, 6],
    firstPlayer: options.firstPlayer ?? SOUTH,
    pitsToWin: options.pitsToWin ?? DEFAULT_PITS_TO_WIN,
    history: [],
    over: false,
    winner: null,
    endReason: null,
  };
}

/**
 * File a finished round and work out what comes next: another round with new
 * pit ownership, or the end of the match.
 * @param {MatchState} match the match the round belongs to
 * @param {{scores: number[], winner: number|null, endReason: string|null}} round the finished round
 * @returns {MatchState} the match after the round
 */
export function recordRound(match, round) {
  const entry = {
    round: match.round,
    scores: round.scores.slice(),
    winner: round.winner,
    endReason: round.endReason ?? null,
    pitCounts: match.pitCounts.slice(),
    firstPlayer: match.firstPlayer,
  };

  if (!match.conquest) {
    return {
      ...match,
      history: [...match.history, entry],
      over: true,
      winner: round.winner,
      endReason: "round",
    };
  }

  // The player who moved second in this round breaks an even leftover.
  const pitCounts = distributePits(round.scores, other(match.firstPlayer));
  entry.pitCounts = pitCounts.slice();

  const wiped = pitCounts[SOUTH] === 0 || pitCounts[NORTH] === 0;
  const conquered = pitCounts[SOUTH] >= match.pitsToWin || pitCounts[NORTH] >= match.pitsToWin;
  const leader = pitCounts[SOUTH] > pitCounts[NORTH] ? SOUTH : NORTH;

  if (wiped || conquered) {
    return {
      ...match,
      history: [...match.history, entry],
      pitCounts,
      owner: ownersFromPitCounts(pitCounts[SOUTH], pitCounts[NORTH]),
      over: true,
      winner: leader,
      endReason: wiped ? "wipeout" : "conquest",
    };
  }

  return {
    ...match,
    history: [...match.history, entry],
    round: match.round + 1,
    pitCounts,
    owner: ownersFromPitCounts(pitCounts[SOUTH], pitCounts[NORTH]),
    firstPlayer: other(match.firstPlayer),
  };
}

export { SOUTH, NORTH };
