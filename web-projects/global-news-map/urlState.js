// The address bar as the record of what is on screen.
//
// A day of news pinned to a map is worth sending to someone, so the day, the
// open story and the language live in the URL and a shared link opens on the
// same view. Root ADR 0006 is why this is a module of its own: the reading and
// the writing are pure and tested, and `app.js` only calls `history.replaceState`.
//
// Everything arriving in the URL is text a stranger wrote. A day that is not a
// real date, a day that has not happened yet and a language the page does not
// speak are all dropped rather than passed on.

import { fromIsoDay, isSelectableDay, toIsoDay } from "./calendar.js";
import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "./i18n.js";

/** Story ids come from `slugify`, so anything else did not come from us. */
const STORY_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

/**
 * Read the state out of a `location.search` string.
 * @returns {{day: string|null, story: string|null, lang: string|null}} `day` is a
 *   `YYYY-MM-DD` string, or null when it was missing or not usable
 */
export function readState(search, now = new Date()) {
  const empty = { day: null, story: null, lang: null };
  if (typeof search !== "string") return empty;
  let params;
  try {
    params = new URLSearchParams(search);
  } catch {
    return empty;
  }
  const day = fromIsoDay(params.get("day"));
  const story = params.get("story");
  const lang = params.get("lang");
  return {
    // A day in the future has no news, so it is not a state the page can be in.
    day: day && isSelectableDay(day, now) ? toIsoDay(day) : null,
    story: story && STORY_ID.test(story) ? story : null,
    lang: LANGUAGE_CODES.includes(lang) ? lang : null,
  };
}

/**
 * Write the state back into a `?...` string.
 *
 * The starting language is left out, and so is any empty part, so an everyday
 * link stays short enough to read.
 *
 * @returns {string} an empty string when there is nothing worth recording
 */
export function buildSearch(state) {
  const params = new URLSearchParams();
  const day = fromIsoDay(state?.day);
  if (day) params.set("day", toIsoDay(day));
  if (state?.story && STORY_ID.test(state.story)) params.set("story", state.story);
  if (state?.lang && state.lang !== DEFAULT_LANGUAGE && LANGUAGE_CODES.includes(state.lang)) {
    params.set("lang", state.lang);
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}
