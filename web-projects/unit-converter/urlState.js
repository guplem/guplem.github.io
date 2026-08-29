// The address bar as the record of what is on screen.
//
// A conversion is worth sending to someone, so the line a person typed lives in
// the URL and a shared link opens on the same answer. Root ADR 0006 is why this
// is a module of its own: the reading and the writing are pure, so they can be
// tested, and `app.js` only has to call `history.replaceState`.
//
// Anything that arrives in the URL is treated as text a stranger wrote. A
// target that names no unit and a language the page does not speak are both
// dropped rather than passed on.

import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "./i18n.js";
import { unitById } from "./units.js";

/**
 * Read the state out of a `location.search` string.
 * @returns {{q: string|null, to: string|null, lang: string|null}}
 */
export function readState(search) {
  const empty = { q: null, to: null, lang: null };
  if (typeof search !== "string") return empty;
  let params;
  try {
    params = new URLSearchParams(search);
  } catch {
    return empty;
  }
  const q = params.get("q");
  const to = params.get("to");
  const lang = params.get("lang");
  return {
    q: q && q.trim() !== "" ? q : null,
    to: unitById(to) ? to : null,
    lang: LANGUAGE_CODES.includes(lang) ? lang : null,
  };
}

/**
 * Write the state back into a `?...` string.
 *
 * Empty parts are left out, and so is the language the page starts in, so an
 * everyday conversion produces a link short enough to read.
 *
 * @returns {string} an empty string when there is nothing worth recording
 */
export function buildSearch(state) {
  const params = new URLSearchParams();
  const q = typeof state?.q === "string" ? state.q.trim() : "";
  if (q === "") return "";
  params.set("q", q);
  if (state.to && unitById(state.to)) params.set("to", state.to);
  if (state.lang && state.lang !== DEFAULT_LANGUAGE && LANGUAGE_CODES.includes(state.lang)) params.set("lang", state.lang);
  return `?${params.toString()}`;
}
