import { describe, expect, test } from "bun:test";
import { readNote, writeNote, writeNoteSuggested, emptyDocument } from "./boardDocument.js";
import {
  cleanupCandidates,
  cleanupSuggestions,
  deleteNotes,
  readItemStates,
  unreadableCount,
} from "./cleanup.js";

const NOW = "2026-10-07T10:00:00.000Z";
const LATER = "2026-10-07T11:00:00.000Z";

/** A document holding one note per key given. */
function withNotes(notes) {
  let document = emptyDocument(NOW);
  for (const [key, body] of Object.entries(notes)) document = writeNote(document, key, body, NOW);
  return document;
}

// The shape GitHub's `nodes` answer takes for each kind, trimmed to what the
// cleanup asks for.
const issue = (id, state, closedAt = null, extra = {}) => ({
  __typename: "Issue",
  id,
  number: 7,
  title: `Issue ${id}`,
  url: `https://github.com/me/repo/issues/7`,
  state,
  closedAt,
  repository: { nameWithOwner: "me/repo" },
  ...extra,
});
const pullRequest = (id, state, merged, closedAt = null) => ({
  __typename: "PullRequest",
  id,
  number: 9,
  title: `Pull request ${id}`,
  url: `https://github.com/me/repo/pull/9`,
  state,
  merged,
  closedAt,
  repository: { nameWithOwner: "me/repo" },
});

describe("cleanupCandidates", () => {
  test("lists every note that still holds words", () => {
    const document = withNotes({ I_b: "second", I_a: "first" });
    expect(cleanupCandidates(document)).toEqual(["I_a", "I_b"]);
  });

  // A cleared note keeps its key (ADR 0002), so the file is full of empty
  // records. They are already as clean as a note can get.
  test("leaves out a note that was already cleared", () => {
    const document = withNotes({ I_a: "words", I_b: "", I_c: "   " });
    expect(cleanupCandidates(document)).toEqual(["I_a"]);
  });

  test("leaves out a note the reader told the board to keep", () => {
    const document = writeNoteSuggested(withNotes({ I_a: "keep me", I_b: "words" }), "I_a", false, LATER);
    expect(cleanupCandidates(document)).toEqual(["I_b"]);
  });

  test("a document with no notes has nothing to ask about", () => {
    expect(cleanupCandidates(emptyDocument(NOW))).toEqual([]);
    expect(cleanupCandidates(null)).toEqual([]);
  });
});

describe("readItemStates", () => {
  test("reads whether an issue is open or closed", () => {
    const states = readItemStates([[issue("I_a", "OPEN"), issue("I_b", "CLOSED", NOW)]]);
    expect(states.get("I_a")).toMatchObject({ key: "I_a", kind: "issue", state: "open", repository: "me/repo" });
    expect(states.get("I_b")).toMatchObject({ kind: "issue", state: "closed", closedAt: NOW });
  });

  // A merged pull request is closed as well, and the reader wants to see which.
  test("tells a merged pull request from one closed without merging", () => {
    const states = readItemStates([
      [pullRequest("P_a", "MERGED", true, NOW), pullRequest("P_b", "CLOSED", false, NOW), pullRequest("P_c", "OPEN", false)],
    ]);
    expect(states.get("P_a")).toMatchObject({ kind: "pull-request", state: "merged" });
    expect(states.get("P_b")).toMatchObject({ kind: "pull-request", state: "closed" });
    expect(states.get("P_c")).toMatchObject({ kind: "pull-request", state: "open" });
  });

  // A node id from one owner is unreadable to another owner's token (ADR 0007),
  // so GitHub answers null in its place. That is "this token cannot see it",
  // never "it is gone".
  test("skips the nulls a token answers for work it cannot see", () => {
    const states = readItemStates([[null, issue("I_a", "OPEN"), undefined, { __typename: "Commit", id: "C_x" }]]);
    expect([...states.keys()]).toEqual(["I_a"]);
  });

  // Every token is asked at the same time; the answers are merged in the order
  // of the token list, never the order they arrived in (ADR 0040).
  test("the first token in the list that saw an item decides it", () => {
    const states = readItemStates([[issue("I_a", "OPEN")], [issue("I_a", "CLOSED", NOW)]]);
    expect(states.get("I_a").state).toBe("open");
  });
});

describe("cleanupSuggestions", () => {
  test("suggests the notes on closed and merged work, with the note itself", () => {
    const document = withNotes({ I_open: "still going", I_done: "shipped", P_merged: "merged it" });
    const states = readItemStates([
      [issue("I_open", "OPEN"), issue("I_done", "CLOSED", NOW), pullRequest("P_merged", "MERGED", true, NOW)],
    ]);
    const suggestions = cleanupSuggestions(document, states);
    expect(suggestions.map((one) => one.key).sort()).toEqual(["I_done", "P_merged"]);
    expect(suggestions.find((one) => one.key === "I_done").note).toBe("shipped");
  });

  // An item no token could read might be deleted, or might sit behind a token
  // this browser does not hold. The board cannot tell, so it never suggests
  // deleting the reader's words over it.
  test("never suggests a note on work no token could read", () => {
    const document = withNotes({ I_unseen: "who knows" });
    expect(cleanupSuggestions(document, readItemStates([[]]))).toEqual([]);
  });

  test("never suggests a note the reader told the board to keep", () => {
    const document = writeNoteSuggested(withNotes({ I_done: "keep" }), "I_done", false, LATER);
    const states = readItemStates([[issue("I_done", "CLOSED", NOW)]]);
    expect(cleanupSuggestions(document, states)).toEqual([]);
  });

  // The note closed longest ago is the one least likely to be read again.
  test("lists the work that closed longest ago first", () => {
    const document = withNotes({ I_new: "a", I_old: "b", I_mid: "c" });
    const states = readItemStates([
      [
        issue("I_new", "CLOSED", "2026-10-01T00:00:00Z"),
        issue("I_old", "CLOSED", "2026-01-01T00:00:00Z"),
        issue("I_mid", "CLOSED", "2026-05-01T00:00:00Z"),
      ],
    ]);
    expect(cleanupSuggestions(document, states).map((one) => one.key)).toEqual(["I_old", "I_mid", "I_new"]);
  });

  // Every list on this page ends its comparison with the key, so two items
  // that closed in the same second land the same way round every time.
  test("two items that closed together keep a fixed order", () => {
    const document = withNotes({ I_b: "b", I_a: "a" });
    const states = readItemStates([[issue("I_b", "CLOSED", NOW), issue("I_a", "CLOSED", NOW)]]);
    expect(cleanupSuggestions(document, states).map((one) => one.key)).toEqual(["I_a", "I_b"]);
  });
});

describe("unreadableCount", () => {
  test("counts the notes on work that no token could read", () => {
    const document = withNotes({ I_seen: "a", I_unseen: "b", I_gone: "c" });
    const states = readItemStates([[issue("I_seen", "OPEN")]]);
    expect(unreadableCount(cleanupCandidates(document), states)).toBe(2);
  });
});

describe("deleteNotes", () => {
  test("empties every note it is handed, and no other", () => {
    const document = withNotes({ I_a: "a", I_b: "b", I_c: "c" });
    const cleaned = deleteNotes(document, ["I_a", "I_b"], LATER);
    expect(readNote(cleaned, "I_a")).toBe("");
    expect(readNote(cleaned, "I_b")).toBe("");
    expect(readNote(cleaned, "I_c")).toBe("c");
  });

  // Deleting the key would read as "this device never had it", and the other
  // device's older copy of the note would come back on the next merge (ADR 0002).
  test("keeps the key of a deleted note, with a new timestamp", () => {
    const cleaned = deleteNotes(withNotes({ I_a: "a" }), ["I_a"], LATER);
    expect(cleaned.notes.I_a).toEqual({ body: "", updatedAt: LATER });
  });

  test("never changes the document it is handed", () => {
    const document = withNotes({ I_a: "a" });
    deleteNotes(document, ["I_a"], LATER);
    expect(readNote(document, "I_a")).toBe("a");
  });
});
