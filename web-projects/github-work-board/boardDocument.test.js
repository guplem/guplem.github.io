import { describe, expect, test } from "bun:test";
import { defaultColour } from "./appearance.js";
import {
  DOCUMENT_PATH,
  RECORD_MAPS,
  SCHEMA_VERSION,
  emptyDocument,
  migrate,
  parseDocument,
  hasNoteText,
  readNote,
  readNoteSuggested,
  writeNoteSuggested,
  serializeDocument,
  writeNote,
  readColumnColour,
  writeColumnColour,
  readAreaShown,
  writeAreaShown,
  readCopyActions,
  readCounting,
  readPriority,
  readTheme,
  removeCopyAction,
  writeCopyAction,
  writeCounting,
  writePriority,
  writeTheme,
} from "./boardDocument.js";

const NOW = "2026-09-17T10:00:00.000Z";
const LATER = "2026-09-17T11:00:00.000Z";
const ISSUE = "I_kwDOAbCdEf4AbCdE"; // a GitHub node id, the permanent key

describe("emptyDocument", () => {
  test("carries the schema version and one empty map per record kind", () => {
    const doc = emptyDocument(NOW);
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.updatedAt).toBe(NOW);
    for (const map of RECORD_MAPS) expect(doc[map]).toEqual({});
  });
});

describe("migrate", () => {
  // A document that throws is a document the reader cannot recover from. Every
  // branch here has to end in a usable document.
  test("never throws, whatever it is handed", () => {
    for (const junk of [null, undefined, 0, "", "text", [], true, { notes: "nope" }]) {
      const doc = migrate(junk, NOW);
      expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
      for (const map of RECORD_MAPS) expect(typeof doc[map]).toBe("object");
    }
  });

  test("keeps records a newer build wrote, so an old tab cannot delete them", () => {
    const fromTheFuture = {
      schemaVersion: SCHEMA_VERSION + 5,
      updatedAt: NOW,
      notes: { [ISSUE]: { body: "kept", updatedAt: NOW } },
      colours: { [ISSUE]: { value: "red", updatedAt: NOW } },
    };
    const doc = migrate(fromTheFuture, LATER);
    expect(readNote(doc, ISSUE)).toBe("kept");
    expect(doc.colours).toEqual(fromTheFuture.colours);
  });

  test("drops a single malformed record without losing its neighbours", () => {
    const doc = migrate(
      { schemaVersion: 1, updatedAt: NOW, notes: { good: { body: "yes", updatedAt: NOW }, bad: 7 } },
      NOW,
    );
    expect(readNote(doc, "good")).toBe("yes");
    expect(doc.notes.bad).toBeUndefined();
  });
});

// A box left with only spaces in it holds nothing a reader wrote. The board
// treats it as no note: it draws no box for it, and an emptied box goes away
// when the reader leaves it (ADR 0014).
describe("hasNoteText", () => {
  test("a note with words in it is a note", () => {
    expect(hasNoteText("look at the rate limit")).toBe(true);
    expect(hasNoteText("  x  ")).toBe(true);
  });

  test("nothing, or only spaces and line breaks, is no note", () => {
    expect(hasNoteText("")).toBe(false);
    expect(hasNoteText("   ")).toBe(false);
    expect(hasNoteText(" \n\t ")).toBe(false);
    expect(hasNoteText(null)).toBe(false);
    expect(hasNoteText(7)).toBe(false);
  });
});

describe("writeNote", () => {
  test("returns a new document and leaves the old one untouched", () => {
    const before = emptyDocument(NOW);
    const after = writeNote(before, ISSUE, "look at the API limits", LATER);
    expect(readNote(before, ISSUE)).toBe("");
    expect(readNote(after, ISSUE)).toBe("look at the API limits");
    expect(after.notes[ISSUE].updatedAt).toBe(LATER);
    expect(after.updatedAt).toBe(LATER);
  });

  // Additive only: a cleared note keeps its key and its timestamp, so the merge
  // can tell "I deleted this just now" from "the other device never had it".
  test("keeps a tombstone when a note is cleared", () => {
    const doc = writeNote(writeNote(emptyDocument(NOW), ISSUE, "draft", NOW), ISSUE, "", LATER);
    expect(Object.keys(doc.notes)).toContain(ISSUE);
    expect(readNote(doc, ISSUE)).toBe("");
    expect(doc.notes[ISSUE].updatedAt).toBe(LATER);
  });

  test("reads a note nobody wrote as an empty string", () => {
    expect(readNote(emptyDocument(NOW), "never-seen")).toBe("");
    expect(readNote(null, ISSUE)).toBe("");
  });
});

describe("serializeDocument and parseDocument", () => {
  test("round-trip through the text GitHub stores", () => {
    const doc = writeNote(emptyDocument(NOW), ISSUE, "cafe con leche", LATER);
    expect(parseDocument(serializeDocument(doc), NOW)).toEqual(doc);
  });

  test("a file a human broke still opens as an empty document", () => {
    const doc = parseDocument("{ not json", NOW);
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.notes).toEqual({});
  });

  test("the stored text ends with a newline, so GitHub shows no 'no newline' marker", () => {
    expect(serializeDocument(emptyDocument(NOW)).endsWith("\n")).toBe(true);
  });
});

describe("the document path", () => {
  test("is a fixed file name at the repository root", () => {
    expect(DOCUMENT_PATH).toBe("board.json");
  });
});

describe("the colour on a column", () => {
  const now = "2026-09-21T10:00:00.000Z";

  // The review row is painted like a column and is not one, so its id sits in
  // the same map beside them (ADR 0024).
  test("round-trips, for a column and for the review row", () => {
    let doc = writeColumnColour(emptyDocument(now), "todo", "blue", now);
    doc = writeColumnColour(doc, "reviews", "amber", now);
    expect(readColumnColour(doc, "todo")).toBe("blue");
    expect(readColumnColour(doc, "reviews")).toBe("amber");
  });

  // A part nobody has painted wears the colour the board ships for it, and a
  // record with nothing readable in it is not a choice anybody made (ADR 0024).
  test("anything never painted wears the colour the board ships", () => {
    expect(readColumnColour(emptyDocument(now), "todo")).toBe(defaultColour("todo"));
    expect(readColumnColour(null, "todo")).toBe(defaultColour("todo"));
    expect(readColumnColour({ colours: { todo: {} } }, "todo")).toBe(defaultColour("todo"));
    expect(readColumnColour(emptyDocument(now), "awaiting-review")).toBe("default");
  });

  // A colour a newer build knows and this one does not must not paint a column
  // with nothing. It reads as the default and is left in the file untouched.
  test("a colour this build does not know reads as the default", () => {
    const doc = writeColumnColour(emptyDocument(now), "todo", "chartreuse", now);
    expect(readColumnColour(doc, "todo")).toBe("default");
  });

  // Back to no colour keeps the record, like a cleared note and a card moved
  // back to automatic: the other device has to tell "cleared just now" from
  // "never set" (ADR 0002).
  test("clearing a colour keeps the record", () => {
    let doc = writeColumnColour(emptyDocument(now), "todo", "blue", now);
    doc = writeColumnColour(doc, "todo", "default", "2026-09-21T11:00:00.000Z");
    expect(readColumnColour(doc, "todo")).toBe("default");
    expect(doc.colours.todo.updatedAt).toBe("2026-09-21T11:00:00.000Z");
  });

  test("the document handed in is never changed", () => {
    const before = emptyDocument(now);
    writeColumnColour(before, "todo", "rose", now);
    expect(readColumnColour(before, "todo")).toBe(defaultColour("todo"));
  });
});

describe("whether a part of the board is shown", () => {
  const now = "2026-10-06T10:00:00.000Z";

  // Every part is on screen until the reader hides it. A record with nothing
  // readable in it is not a choice anybody made.
  test("every part is shown until the reader hides it", () => {
    expect(readAreaShown(emptyDocument(now), "todo")).toBe(true);
    expect(readAreaShown(emptyDocument(now), "reviews")).toBe(true);
    expect(readAreaShown(null, "done")).toBe(true);
    expect(readAreaShown({ visibility: { todo: {} } }, "todo")).toBe(true);
    expect(readAreaShown({ visibility: { todo: { shown: "no" } } }, "todo")).toBe(true);
  });

  test("round-trips, for a column and for the review row", () => {
    let doc = writeAreaShown(emptyDocument(now), "done", false, now);
    doc = writeAreaShown(doc, "reviews", false, now);
    expect(readAreaShown(doc, "done")).toBe(false);
    expect(readAreaShown(doc, "reviews")).toBe(false);
    expect(readAreaShown(doc, "todo")).toBe(true);
  });

  // Showing a part again keeps the record, like a cleared colour: the other
  // device has to tell "shown again just now" from "never hidden" (ADR 0002).
  test("showing a part again keeps the record", () => {
    let doc = writeAreaShown(emptyDocument(now), "done", false, now);
    doc = writeAreaShown(doc, "done", true, "2026-10-06T11:00:00.000Z");
    expect(readAreaShown(doc, "done")).toBe(true);
    expect(doc.visibility.done.updatedAt).toBe("2026-10-06T11:00:00.000Z");
  });

  test("the document handed in is never changed", () => {
    const before = emptyDocument(now);
    writeAreaShown(before, "done", false, now);
    expect(readAreaShown(before, "done")).toBe(true);
  });
});

describe("the theme", () => {
  const now = "2026-09-21T10:00:00.000Z";

  test("round-trips", () => {
    expect(readTheme(writeTheme(emptyDocument(now), "dark", now))).toBe("dark");
    expect(readTheme(writeTheme(emptyDocument(now), "light", now))).toBe("light");
  });

  test("nothing chosen follows the machine", () => {
    expect(readTheme(emptyDocument(now))).toBe("auto");
    expect(readTheme(null)).toBe("auto");
    expect(readTheme({ appearance: { theme: { updatedAt: now } } })).toBe("auto");
  });

  test("a theme this build does not know follows the machine", () => {
    expect(readTheme(writeTheme(emptyDocument(now), "solarized", now))).toBe("auto");
  });

  test("the document handed in is never changed", () => {
    const before = emptyDocument(now);
    writeTheme(before, "dark", now);
    expect(readTheme(before)).toBe("auto");
  });
});

describe("a card pushed down", () => {
  const now = "2026-09-21T10:00:00.000Z";

  test("round-trips", () => {
    expect(readPriority(writePriority(emptyDocument(now), "I_1", "low", now), "I_1")).toBe("low");
    expect(readPriority(writePriority(emptyDocument(now), "I_1", "high", now), "I_1")).toBe("high");
  });

  test("nothing marked is the ordinary priority", () => {
    expect(readPriority(emptyDocument(now), "I_1")).toBe("normal");
    expect(readPriority(null, "I_1")).toBe("normal");
    expect(readPriority({ priorities: { I_1: { updatedAt: now } } }, "I_1")).toBe("normal");
  });

  test("a priority this build does not know is the ordinary one", () => {
    expect(readPriority(writePriority(emptyDocument(now), "I_1", "urgent", now), "I_1")).toBe("normal");
  });

  // The mark belongs to the work, so it is filed under the item's node id and
  // never under the column or the row the card happens to sit in (ADR 0022).
  test("one card's mark says nothing about another's", () => {
    const document = writePriority(emptyDocument(now), "I_1", "low", now);
    expect(readPriority(document, "I_2")).toBe("normal");
  });

  // A record is only ever added, never removed: a key that disappears reads as
  // "this device never saw it", and the older remote value comes back (ADR 0002).
  test("taking the mark off keeps the record", () => {
    const marked = writePriority(emptyDocument(now), "I_1", "low", now);
    const later = "2026-09-21T11:00:00.000Z";
    const cleared = writePriority(marked, "I_1", "normal", later);
    expect(readPriority(cleared, "I_1")).toBe("normal");
    expect(cleared.priorities.I_1.updatedAt).toBe(later);
  });

  test("the document handed in is never changed", () => {
    const before = emptyDocument(now);
    writePriority(before, "I_1", "low", now);
    expect(readPriority(before, "I_1")).toBe("normal");
  });
});

describe("what each part of the board counts", () => {
  const now = "2026-09-22T10:00:00.000Z";

  test("round-trips both answers", () => {
    const document = writeCounting(emptyDocument(now), "ongoing", { counted: false, withLowPriority: false }, now);
    expect(readCounting(document, "ongoing")).toEqual({ counted: false, withLowPriority: false });
  });

  // Nothing chosen is the default, which counts the four areas where work is
  // moving and leaves nothing out of a badge (ADR 0030).
  test("nothing chosen is the default for that area", () => {
    expect(readCounting(emptyDocument(now), "ongoing")).toEqual({ counted: true, withLowPriority: true });
    expect(readCounting(emptyDocument(now), "todo")).toEqual({ counted: false, withLowPriority: true });
    expect(readCounting(null, "reviews")).toEqual({ counted: true, withLowPriority: true });
  });

  // Half a record is what a newer build writing one more answer would leave
  // behind. The half that is there is kept, and the rest is the default.
  test("half a record keeps what it says and defaults the rest", () => {
    const document = { counting: { todo: { counted: true, updatedAt: now } } };
    expect(readCounting(document, "todo")).toEqual({ counted: true, withLowPriority: true });
  });

  test("anything that is not an answer is the default", () => {
    const document = { counting: { todo: { counted: "yes", withLowPriority: 7, updatedAt: now } } };
    expect(readCounting(document, "todo")).toEqual({ counted: false, withLowPriority: true });
  });

  test("one area's choice says nothing about another's", () => {
    const document = writeCounting(emptyDocument(now), "ongoing", { counted: false, withLowPriority: false }, now);
    expect(readCounting(document, "reviews")).toEqual({ counted: true, withLowPriority: true });
  });

  test("the document handed in is never changed", () => {
    const before = emptyDocument(now);
    writeCounting(before, "ongoing", { counted: false, withLowPriority: false }, now);
    expect(readCounting(before, "ongoing").counted).toBe(true);
  });
});

describe("the lines the reader copies from a card (ADR 0031)", () => {
  const now = "2026-09-22T10:00:00.000Z";
  const later = "2026-09-22T11:00:00.000Z";

  test("round-trips one action", () => {
    const document = writeCopyAction(
      emptyDocument(now),
      "a1",
      { label: "Implement", template: "/implement-issue #{N}", createdAt: now },
      now,
    );
    expect(readCopyActions(document)).toEqual([
      { id: "a1", label: "Implement", template: "/implement-issue #{N}", createdAt: now },
    ]);
  });

  test("nobody starts with an action", () => {
    expect(readCopyActions(emptyDocument(now))).toEqual([]);
    expect(readCopyActions(null)).toEqual([]);
  });

  // A removed action keeps its key with an empty template, the same way a
  // cleared note keeps its key. Dropping the key would let the other device
  // bring the action back on the next merge (ADR 0002).
  test("a removed action keeps its key, so the other device hears about it", () => {
    const one = writeCopyAction(emptyDocument(now), "a1", { label: "Implement", template: "#{N}" }, now);
    const gone = removeCopyAction(one, "a1", later);
    expect(readCopyActions(gone)).toEqual([]);
    expect(gone.copyActions.a1.template).toBe("");
    expect(gone.copyActions.a1.updatedAt).toBe(later);
  });

  test("a removed action keeps the name it was made under, so the merge can read it", () => {
    const one = writeCopyAction(emptyDocument(now), "a1", { label: "Implement", template: "#{N}", createdAt: now }, now);
    expect(removeCopyAction(one, "a1", later).copyActions.a1.createdAt).toBe(now);
  });

  test("writing one action says nothing about another", () => {
    const one = writeCopyAction(emptyDocument(now), "a1", { label: "One", template: "#{N}" }, now);
    const two = writeCopyAction(one, "a2", { label: "Two", template: "{URL}" }, later);
    expect(readCopyActions(two).map((action) => action.label)).toEqual(["One", "Two"]);
  });

  test("the document handed in is never changed", () => {
    const before = emptyDocument(now);
    writeCopyAction(before, "a1", { label: "One", template: "#{N}" }, now);
    expect(readCopyActions(before)).toEqual([]);
  });
});

describe("the colour a part of the board opens with (ADR 0024)", () => {
  const now = "2026-09-22T10:00:00.000Z";

  test("a part nobody has painted wears the colour the board ships", () => {
    expect(readColumnColour(emptyDocument(now), "ongoing")).toBe("blue");
    expect(readColumnColour(null, "reviews")).toBe("violet");
    expect(readColumnColour(emptyDocument(now), "done")).toBe("default");
  });

  // The reader's hand wins over what the board ships, and "None" is a choice
  // like any other: a column they cleared stays cleared.
  test("a colour the reader chose wins, and so does the None they chose", () => {
    const painted = writeColumnColour(emptyDocument(now), "ongoing", "rose", now);
    expect(readColumnColour(painted, "ongoing")).toBe("rose");
    const cleared = writeColumnColour(emptyDocument(now), "ongoing", "default", now);
    expect(readColumnColour(cleared, "ongoing")).toBe("default");
  });
});

describe("a note the reader keeps out of the cleanup (ADR 0043)", () => {
  // Every note is a candidate until the reader says otherwise.
  test("a note nobody answered for is suggested", () => {
    expect(readNoteSuggested(emptyDocument(NOW), ISSUE)).toBe(true);
  });

  test("the reader can keep one, and change their mind later", () => {
    const kept = writeNoteSuggested(emptyDocument(NOW), ISSUE, false, NOW);
    expect(readNoteSuggested(kept, ISSUE)).toBe(false);
    expect(readNoteSuggested(writeNoteSuggested(kept, ISSUE, true, LATER), ISSUE)).toBe(true);
  });

  // The answer travels with the board, so another device does not suggest the
  // same note again.
  test("is saved in its own map, filed under the item's node id", () => {
    expect(RECORD_MAPS).toContain("cleanup");
    const kept = writeNoteSuggested(emptyDocument(NOW), ISSUE, false, NOW);
    expect(kept.cleanup[ISSUE]).toEqual({ suggested: false, updatedAt: NOW });
  });

  test("an unreadable record reads as suggested", () => {
    const odd = { ...emptyDocument(NOW), cleanup: { [ISSUE]: { suggested: "no", updatedAt: NOW } } };
    expect(readNoteSuggested(odd, ISSUE)).toBe(true);
  });
});
