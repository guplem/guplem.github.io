// The suggested cleanup of the reader's half of the board (ADR 0043).
//
// A note outlives the work it is about. The issue closes, the pull request
// merges, and the note stays in `board.json` for ever, because nothing on the
// board shows that card again. This module says which notes are left on
// finished work, from GitHub's own answer about each item, and empties the ones
// the reader lets go.
//
// Two rules hold here:
// 1. Only a note on work that a token **saw** closed is suggested. An item no
//    token can read may be deleted, or may sit behind a token this browser does
//    not hold, and the board cannot tell which, so it never offers the reader's
//    words for deletion on a guess.
// 2. A deleted note keeps its key. Removing the key would read as "this device
//    never had it", and the other device's older copy would come back on the
//    next merge (ADR 0002). `deleteNotes` writes an empty note instead.

import { readNote, readNoteSuggested, writeNote } from "./boardDocument.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * The notes worth asking GitHub about: every one that still holds words and
 * that the reader did not keep, in a fixed order.
 */
export function cleanupCandidates(document) {
  const notes = isPlainObject(document) && isPlainObject(document.notes) ? document.notes : {};
  return Object.keys(notes)
    .filter((key) => readNote(document, key).trim() !== "" && readNoteSuggested(document, key))
    .sort();
}

/** One node of GitHub's answer into what the cleanup needs, or null for anything else. */
function readItemState(node) {
  if (!isPlainObject(node) || typeof node.id !== "string") return null;
  const kind = node.__typename === "Issue" ? "issue" : node.__typename === "PullRequest" ? "pull-request" : "";
  if (kind === "") return null;
  let state = "open";
  if (kind === "pull-request" && node.merged === true) state = "merged";
  else if (node.state === "CLOSED" || node.state === "MERGED") state = "closed";
  return {
    key: node.id,
    kind,
    state,
    number: Number.isFinite(node.number) ? node.number : 0,
    title: typeof node.title === "string" ? node.title : "",
    url: typeof node.url === "string" ? node.url : "",
    repository: typeof node.repository?.nameWithOwner === "string" ? node.repository.nameWithOwner : "",
    closedAt: typeof node.closedAt === "string" ? node.closedAt : "",
  };
}

/**
 * Every token's answer into one map, keyed by node id.
 *
 * `answers` holds one list of nodes per token, in the order of the token list.
 * The first token that saw an item decides it, so the result never depends on
 * which answer arrived first (ADR 0040).
 */
export function readItemStates(answers) {
  const states = new Map();
  for (const nodes of Array.isArray(answers) ? answers : []) {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      const one = readItemState(node);
      if (one && !states.has(one.key)) states.set(one.key, one);
    }
  }
  return states;
}

/**
 * The notes left on finished work, each with its item and its words, the work
 * that closed longest ago first.
 */
export function cleanupSuggestions(document, states) {
  return cleanupCandidates(document)
    .map((key) => states.get(key))
    .filter((one) => one && one.state !== "open")
    .map((one) => ({ ...one, note: readNote(document, one.key) }))
    .sort((a, b) => a.closedAt.localeCompare(b.closedAt) || a.key.localeCompare(b.key));
}

/** How many candidate notes sit on work that no token could read. */
export function unreadableCount(candidates, states) {
  return (Array.isArray(candidates) ? candidates : []).filter((key) => !states.has(key)).length;
}

/** The same document with every note named here emptied. The document handed in is not changed. */
export function deleteNotes(document, keys, now) {
  let next = document;
  for (const key of Array.isArray(keys) ? keys : []) next = writeNote(next, key, "", now);
  return next;
}
