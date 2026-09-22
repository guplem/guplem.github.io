// What the address bar carries, and what it must never carry.
//
// The open view, the chosen order and the filters in force, each left out when
// it is the default (root ADR 0006): a link that spells out a default adds
// noise and implies a choice nobody made. A list is written as one parameter
// per item (`?repo=a&repo=b`), never as one comma-separated value, so a name
// carrying a comma cannot break the link.
//
// Everything else the board knows is private. The tokens above all never go
// here, because a link is pasted into chat messages and written to server logs.
// `invariants.test.js` guards that.
//
// This module builds the search string and nothing else. `app.js` is what calls
// `history.replaceState`, never `pushState`: narrowing a list is not a place the
// back button should return to.

import { DEFAULT_KIND, readKind } from "./filters.js";
import { DEFAULT_SORT_ID, readSortId } from "./sorting.js";

const SORT_PARAM = "sort";
const VIEW_PARAM = "view";
const KIND_PARAM = "kind";
const REPOSITORY_PARAM = "repo";
const LABEL_PARAM = "label";
// Two filters over two different lists, so two names. `assignee` narrows the
// row of pull requests waiting on the reader, by whose work each one is.
// `reviewer` narrows the reader's own board, by who is in the review
// (ADR 0028). Both are permanent, because they travel in saved links.
const ASSIGNEE_PARAM = "assignee";
const REVIEWER_PARAM = "reviewer";

/** The screens this page has. Named in links, so a name is never changed. */
// A view name travels in the address bar, so it is permanent, exactly like
// a sort id. "add-token" is its own screen because the guide it holds is
// long enough to bury the rest of Settings (ADR 0018).
export const VIEWS = ["board", "settings", "add-token"];
export const DEFAULT_VIEW = "board";

/** One of the views above, whatever was asked for. */
export function readView(value) {
  return typeof value === "string" && VIEWS.includes(value) ? value : DEFAULT_VIEW;
}

function readList(params, name) {
  return params.getAll(name).filter((one) => typeof one === "string" && one !== "");
}

/** The view the address bar asks for, with anything unreadable falling back to the default. */
export function readStateFromSearch(search) {
  const params = new URLSearchParams(typeof search === "string" ? search : "");
  return {
    sortId: readSortId(params.get(SORT_PARAM)),
    view: readView(params.get(VIEW_PARAM)),
    kind: readKind(params.get(KIND_PARAM)),
    repositories: readList(params, REPOSITORY_PARAM),
    labels: readList(params, LABEL_PARAM),
    assignees: readList(params, ASSIGNEE_PARAM),
    reviewers: readList(params, REVIEWER_PARAM),
  };
}

/** The search string for a view, or an empty string when nothing needs saying. */
export function buildSearch({ sortId, view, kind, repositories, labels, assignees, reviewers } = {}) {
  const params = new URLSearchParams();
  const chosenView = readView(view);
  const chosenKind = readKind(kind);
  const chosenSort = readSortId(sortId);

  if (chosenView !== DEFAULT_VIEW) params.append(VIEW_PARAM, chosenView);
  if (chosenSort !== DEFAULT_SORT_ID) params.append(SORT_PARAM, chosenSort);
  if (chosenKind !== DEFAULT_KIND) params.append(KIND_PARAM, chosenKind);
  for (const name of Array.isArray(repositories) ? repositories : []) {
    if (typeof name === "string" && name !== "") params.append(REPOSITORY_PARAM, name);
  }
  for (const name of Array.isArray(labels) ? labels : []) {
    if (typeof name === "string" && name !== "") params.append(LABEL_PARAM, name);
  }

  for (const login of Array.isArray(assignees) ? assignees : []) {
    if (typeof login === "string" && login !== "") params.append(ASSIGNEE_PARAM, login);
  }
  for (const login of Array.isArray(reviewers) ? reviewers : []) {
    if (typeof login === "string" && login !== "") params.append(REVIEWER_PARAM, login);
  }

  const search = params.toString();
  return search === "" ? "" : `?${search}`;
}
