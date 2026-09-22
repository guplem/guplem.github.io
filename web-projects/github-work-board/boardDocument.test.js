import { describe, expect, test } from "bun:test";
import {
  DOCUMENT_PATH,
  RECORD_MAPS,
  SCHEMA_VERSION,
  emptyDocument,
  migrate,
  parseDocument,
  readNote,
  serializeDocument,
  writeNote,
  readColumnColour,
  writeColumnColour,
  readCounting,
  readPriority,
  readTheme,
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

  test("anything never painted is the default", () => {
    expect(readColumnColour(emptyDocument(now), "todo")).toBe("default");
    expect(readColumnColour(null, "todo")).toBe("default");
    expect(readColumnColour({ colours: { todo: {} } }, "todo")).toBe("default");
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
    writeColumnColour(before, "todo", "blue", now);
    expect(readColumnColour(before, "todo")).toBe("default");
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
