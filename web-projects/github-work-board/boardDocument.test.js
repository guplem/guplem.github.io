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
