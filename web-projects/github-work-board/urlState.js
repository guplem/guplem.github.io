// What the address bar carries, and what it must never carry.
//
// Which view is open, and the chosen order, and only when either is not the
// default one (root ADR 0006): a link that spells out a default adds noise and
// implies a choice nobody made. Everything else the board knows is private. The
// tokens above all never go here, because a link is pasted into chat messages
// and written to server logs. `invariants.test.js` guards that.
//
// This module builds the search string and nothing else. `app.js` is what calls
// `history.replaceState`, never `pushState`: changing the order is not a place
// the back button should return to.

import { DEFAULT_SORT_ID, readSortId } from "./sorting.js";

const SORT_PARAM = "sort";
const VIEW_PARAM = "view";

/** The screens this page has. Named in links, so a name is never changed. */
export const VIEWS = ["board", "settings"];
export const DEFAULT_VIEW = "board";

/** One of the views above, whatever was asked for. */
export function readView(value) {
  return typeof value === "string" && VIEWS.includes(value) ? value : DEFAULT_VIEW;
}

/** The view the address bar asks for, with anything unreadable falling back to the default. */
export function readStateFromSearch(search) {
  const params = new URLSearchParams(typeof search === "string" ? search : "");
  return { sortId: readSortId(params.get(SORT_PARAM)), view: readView(params.get(VIEW_PARAM)) };
}

/** The search string for a view, or an empty string when nothing needs saying. */
export function buildSearch({ sortId, view } = {}) {
  const chosenSort = readSortId(sortId);
  const chosenView = readView(view);
  const parts = [];
  if (chosenView !== DEFAULT_VIEW) parts.push(`${VIEW_PARAM}=${encodeURIComponent(chosenView)}`);
  if (chosenSort !== DEFAULT_SORT_ID) parts.push(`${SORT_PARAM}=${encodeURIComponent(chosenSort)}`);
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}
