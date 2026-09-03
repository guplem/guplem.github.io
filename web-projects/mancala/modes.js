// The two rule sets, side by side behind one interface.
//
// Both engines take the same state shape and answer the same four calls, so
// everything above this file (the screen, the opponents, the benchmark) works
// on either game without knowing which one it is playing:
//
//   createGame(options) -> state
//   legalMoves(state)   -> pit indices
//   applyMove(state, pit) -> { state, events }
//   describeMove(state, pit) -> what the move would do
//
// The card text below is the "How to play" carousel. It lives here, next to the
// rule set it explains, so a rule change and its explanation are one edit. Each
// card also carries a `figure`: a board position the carousel draws with the
// real board code, so the picture cannot drift from the rules the way a
// screenshot would.

import * as kalah from "./kalah.js";
import * as baawa from "./baawa.js";
import { fixedOwners, ownersFromPitCounts } from "./board.js";

/** The rule set a fresh visitor gets. */
export const DEFAULT_MODE = "kalah";

/** Every rule set, in the order the setup screen lists them. */
export const MODE_IDS = ["kalah", "baawa"];

/**
 * A board position for a rules card.
 * @param {number[]} pits seeds in each pit
 * @param {number[]} scores captured seeds, [Blue, Red]
 * @param {number[]} highlight pits to point out
 * @param {Object} [extra] `badge` for a tag over the store, `owner` to show
 *   pits that changed hands
 * @returns {Object}
 */
function figure(pits, scores, highlight, extra = {}) {
  return { pits, scores, highlight, owner: extra.owner ?? fixedOwners(), badge: extra.badge ?? null };
}

const EVEN = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];

export const MODES = {
  kalah: {
    id: "kalah",
    name: "Kalah",
    tagline: "The classic mancala",
    origin: "The version sold in most shops, and the one most apps teach.",
    hasStores: true,
    conquest: false,
    rules: kalah,
    howToPlay: [
      {
        title: "The board",
        text: "Each player has six pits and one big store, the Mancala, which keeps every seed they capture.",
        figure: figure(EVEN, [0, 0], [0, 1, 2, 3, 4, 5]),
      },
      {
        title: "Sowing",
        text: "On your turn you pick one of your own pits. Every seed comes out and goes round the board counterclockwise, one seed per pit.",
        figure: figure(EVEN, [0, 0], [2]),
      },
      {
        title: "The stores",
        text: "A seed drops into your own store as you pass it, but never into your opponent's. You sow straight past theirs.",
        // Red sowed pit 12: one seed into Red's own store, then three into
        // Blue's pits. Blue's store stayed empty.
        figure: figure([5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 0], [0, 1], [11, 0, 1, 2]),
      },
      {
        title: "Play again",
        text: "If your last seed lands in your own store, you take another turn at once. A good move can chain several turns together.",
        // Blue sowed pit 3, and its fourth seed reached Blue's own store.
        figure: figure([4, 4, 0, 5, 5, 5, 4, 4, 4, 4, 4, 4], [1, 0], [2], { badge: "+1 turn" }),
      },
      {
        title: "Capture",
        text: "If your last seed lands in an empty pit on your own side, you take that seed and every seed in the pit facing it.",
        // Blue's pit 3 is empty and the pit facing it holds five. One seed
        // from pit 3's left neighbour wins all six.
        figure: figure([1, 0, 1, 0, 3, 2, 4, 4, 5, 4, 4, 4], [8, 8], [3, 8]),
      },
      {
        title: "The end",
        text: "The game ends when one whole row is empty. The seeds still on the board go to the player who owns that row, and the fuller store wins.",
        figure: figure([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], [28, 16], [11]),
      },
    ],
  },
  baawa: {
    id: "baawa",
    name: "Ba-awa",
    tagline: "The Ghanaian four-seed game",
    origin:
      "Played in Ghana. No stores, one move can cross the board many times, and the winner takes pits off the loser.",
    hasStores: false,
    conquest: true,
    rules: baawa,
    howToPlay: [
      {
        title: "The board",
        text: "Twelve pits, four seeds in each, and no stores at all. Each player owns the six pits on their own side.",
        figure: figure(EVEN, [0, 0], [0, 1, 2, 3, 4, 5]),
      },
      {
        title: "Sowing",
        text: "Pick one of the pits you own. Every seed comes out and goes round the board counterclockwise, one seed per pit.",
        figure: figure(EVEN, [0, 0], [1]),
      },
      {
        title: "Keep going",
        text: "If your last seed lands in a pit that already held seeds, lift that whole pit and sow again from there. One move can cross the board many times.",
        // The four seeds of pit 2 landed in pits 3 to 6, and the last one
        // found five seeds waiting, so pit 6 is lifted next.
        figure: figure([4, 0, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4], [0, 0], [5]),
      },
      {
        title: "Four scores",
        text: "Any pit that reaches exactly four is emptied at once, and the player who owns it takes the four seeds. That happens even while your opponent is sowing.",
        // Pit 4 has just reached four, so Blue is about to take those four.
        figure: figure([0, 5, 5, 4, 5, 5, 4, 4, 4, 4, 4, 4], [0, 0], [3]),
      },
      {
        title: "The last seed",
        text: "If the seed that made four was the last seed of your move, you take those four yourself, wherever the pit is. Your move then ends.",
        // Blue's last seed made four in pit 8, which is Red's pit, and Blue
        // took them anyway.
        figure: figure([0, 0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4], [8, 0], [7]),
      },
      {
        title: "Rounds and pits",
        text: "When the player to move owns no seed, the other player takes everything left. If instead the last eight seeds go round with nobody taking any, the player who started the round takes them. Four seeds then buy one pit for the next round, so the winner takes pits off the loser. Hold ten pits to win the match.",
        figure: figure(EVEN, [0, 0], [6, 7], { owner: ownersFromPitCounts(8, 4) }),
      },
    ],
  },
};

/**
 * Is this a rule set the game knows?
 * @param {string} id a candidate mode name
 * @returns {boolean}
 */
export function isMode(id) {
  return MODE_IDS.includes(id);
}

/**
 * A rule set by name, falling back to the default for anything unknown.
 * @param {string} id a mode name
 * @returns {Object} the mode entry
 */
export function modeById(id) {
  return MODES[isMode(id) ? id : DEFAULT_MODE];
}

/**
 * The engine of a rule set: the four calls the rest of the app makes.
 * @param {string} id a mode name
 * @returns {Object} the engine module
 */
export function rulesFor(id) {
  return modeById(id).rules;
}

/**
 * Start a game under a rule set.
 * @param {string} id a mode name
 * @param {Object} [options] passed to that engine's createGame
 * @returns {Object} a fresh game state
 */
export function newGame(id, options = {}) {
  return rulesFor(id).createGame(options);
}
