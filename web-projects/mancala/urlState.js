// The address bar holds the whole setup: which rule set, who sits in each
// seat, and whether Ba-awa plays one round or a whole match. So a link is a
// table already laid out, and a reload keeps the game you set up. Root ADR 0006
// is the rule this follows.
//
// The position itself is NOT in the URL. A mancala move is fast and a game is
// short, and a link that restored a half-played game would also have to carry
// the pit contents, whose turn it is and the round scores, which makes an
// unreadable link that goes stale the moment the rules change.
//
// Anything unknown falls back to the default, and a value equal to the default
// is never written, so the common case has a clean URL.

import { isMode, DEFAULT_MODE } from "./modes.js";
import { isAgent, HUMAN, DEFAULT_AGENT } from "./agents.js";

/** What a fresh visitor gets: a person in the blue seat against Farmer. */
export const DEFAULT_SETUP = {
  mode: DEFAULT_MODE,
  blue: HUMAN,
  red: DEFAULT_AGENT,
  conquest: true,
};

/**
 * Is this a value a seat can hold: a person, or an opponent the game knows?
 * @param {string} value a candidate seat value
 * @returns {boolean}
 */
export function isSeat(value) {
  return value === HUMAN || isAgent(value);
}

/**
 * Read a setup out of a query string. Never throws.
 * @param {string} search a query string, with or without the leading "?"
 * @returns {{mode: string, blue: string, red: string, conquest: boolean}}
 */
export function parseSetup(search) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const mode = params.get("mode");
  const blue = params.get("blue");
  const red = params.get("red");
  return {
    mode: isMode(mode) ? mode : DEFAULT_SETUP.mode,
    blue: isSeat(blue) ? blue : DEFAULT_SETUP.blue,
    red: isSeat(red) ? red : DEFAULT_SETUP.red,
    // "single" is the only value that turns the match off, so a typo leaves
    // the full match in place.
    conquest: params.get("rounds") !== "single",
  };
}

/**
 * Write a setup as a query string, leaving out everything that is already the
 * default.
 * @param {{mode: string, blue: string, red: string, conquest: boolean}} setup
 * @returns {string} a query string starting with "?", or "" for the defaults
 */
export function serializeSetup(setup) {
  const params = new URLSearchParams();
  if (setup.mode !== DEFAULT_SETUP.mode) params.set("mode", setup.mode);
  if (setup.blue !== DEFAULT_SETUP.blue) params.set("blue", setup.blue);
  if (setup.red !== DEFAULT_SETUP.red) params.set("red", setup.red);
  // Only Ba-awa has rounds, so a single-round Kalah setup says nothing.
  if (setup.mode === "baawa" && setup.conquest === false) params.set("rounds", "single");
  const query = params.toString();
  return query ? `?${query}` : "";
}
