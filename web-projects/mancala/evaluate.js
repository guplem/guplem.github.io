// How good is a position for a player? Every searching opponent needs one
// number for that, and the two rule sets need different numbers, because they
// reward different things.
//
// Kalah: seeds in your store are safe for ever, so the store difference is
// worth far more than anything else. Seeds still on your own side are worth
// something, because only you can sow them and the end-of-game sweep gives
// them to you.
//
// Ba-awa: seeds are captured out of the pits, so what matters is the score
// difference plus the traps you are holding. A pit you own with three seeds
// pays you four the moment ANY seed drops into it, including a seed your
// opponent sows. Three-seed pits are therefore the currency of the game.

import { SOUTH, NORTH, other, homePits, seedsIn } from "./board.js";
import { pitsOwnedBy, CAPTURE_AT } from "./baawa.js";

/** A finished game is worth more than any position that is still open. */
export const WIN_SCORE = 100000;

/**
 * How good a finished game is: the win, plus the margin, so an opponent that
 * cannot avoid losing still loses by as little as possible.
 * @param {Object} state a finished game state
 * @param {number} player the player to score for
 * @returns {number}
 */
function finishedValue(state, player) {
  const margin = state.scores[player] - state.scores[other(player)];
  if (margin === 0) return 0;
  return margin > 0 ? WIN_SCORE + margin : -WIN_SCORE + margin;
}

/**
 * Score a Kalah position for a player. Positive is good for that player.
 * @param {Object} state a Kalah game state
 * @param {number} player the player to score for
 * @returns {number}
 */
export function evaluateKalah(state, player) {
  if (state.over) return finishedValue(state, player);
  const foe = other(player);
  const storeDiff = state.scores[player] - state.scores[foe];
  const mine = seedsIn(state.pits, homePits(player));
  const theirs = seedsIn(state.pits, homePits(foe));
  // An empty pit of your own is where a capture can happen, so holding more
  // of them than the opponent is worth a little. The term is a difference, so
  // the whole score stays a mirror: what is good for one player is exactly as
  // bad for the other.
  const myEmpty = homePits(player).filter((pit) => state.pits[pit] === 0).length;
  const theirEmpty = homePits(foe).filter((pit) => state.pits[pit] === 0).length;
  return storeDiff * 12 + (mine - theirs) * 2 + (myEmpty - theirEmpty);
}

/**
 * Score a Ba-awa position for a player. Positive is good for that player.
 * @param {Object} state a Ba-awa game state
 * @param {number} player the player to score for
 * @returns {number}
 */
export function evaluateBaawa(state, player) {
  if (state.over) return finishedValue(state, player);
  const foe = other(player);
  const scoreDiff = state.scores[player] - state.scores[foe];
  const myPits = pitsOwnedBy(state.owner, player);
  const theirPits = pitsOwnedBy(state.owner, foe);
  const mine = seedsIn(state.pits, myPits);
  const theirs = seedsIn(state.pits, theirPits);
  const myTraps = myPits.filter((pit) => state.pits[pit] === CAPTURE_AT - 1).length;
  const theirTraps = theirPits.filter((pit) => state.pits[pit] === CAPTURE_AT - 1).length;
  // Owning more pits is the point of the match, so seeds you can still sow
  // and traps you are holding both count.
  return scoreDiff * 10 + (mine - theirs) * 1 + (myTraps - theirTraps) * 3;
}

/**
 * Score a position under whichever rule set it belongs to.
 * @param {Object} state a game state from either engine
 * @param {number} player the player to score for
 * @returns {number}
 */
export function evaluate(state, player) {
  return state.mode === "baawa" ? evaluateBaawa(state, player) : evaluateKalah(state, player);
}

export { SOUTH, NORTH };
