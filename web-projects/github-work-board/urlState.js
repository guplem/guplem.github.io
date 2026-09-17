// What the address bar carries, and what it must never carry.
//
// Only the chosen order, and only when it is not the default one (root ADR
// 0006): a link that spells out a default adds noise and implies a choice
// nobody made. Everything else the board knows is private. The token above all
// never goes here, because a link is pasted into chat messages and written to
// server logs. `invariants.test.js` guards that.
//
// This module builds the search string and nothing else. `app.js` is what calls
// `history.replaceState`, never `pushState`: changing the order is not a place
// the back button should return to.

import { DEFAULT_SORT_ID, readSortId } from "./sorting.js";

const SORT_PARAM = "sort";

/** The view the address bar asks for, with anything unreadable falling back to the default. */
export function readStateFromSearch(search) {
  const params = new URLSearchParams(typeof search === "string" ? search : "");
  return { sortId: readSortId(params.get(SORT_PARAM)) };
}

/** The search string for a view, or an empty string when nothing needs saying. */
export function buildSearch({ sortId } = {}) {
  const chosen = readSortId(sortId);
  return chosen === DEFAULT_SORT_ID ? "" : `?${SORT_PARAM}=${encodeURIComponent(chosen)}`;
}
