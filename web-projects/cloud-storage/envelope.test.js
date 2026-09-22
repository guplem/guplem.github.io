import { describe, expect, test } from "bun:test";
import {
  MAX_DOCUMENT_BYTES,
  SCHEMA_VERSION,
  defineDocument,
  documentBytes,
  emptyDocument,
  hasRecords,
  migrate,
  parseDocument,
  readRecord,
  removeRecord,
  serializeDocument,
  writeRecord,
} from "./envelope.js";

const T1 = "2026-09-22T10:00:00.000Z";
const T2 = "2026-09-22T11:00:00.000Z";
const MAPS = ["saves", "settings"];

describe("emptyDocument", () => {
  test("carries the schema version, the time, and one empty map per name", () => {
    expect(emptyDocument(MAPS, T1)).toEqual({ schemaVersion: SCHEMA_VERSION, updatedAt: T1, saves: {}, settings: {} });
  });
});

describe("migrate", () => {
  test("never throws, whatever it is handed", () => {
    for (const junk of [null, undefined, 4, "text", [], { updatedAt: 3 }]) {
      expect(migrate(junk, MAPS, T1)).toEqual(emptyDocument(MAPS, T1));
    }
  });

  // Additive only: a build that drops a map it does not know deletes the work
  // of every newer build the moment an older tab saves (root ADR 0016).
  test("keeps a map it has never heard of, and adds the ones it knows", () => {
    const doc = migrate({ schemaVersion: 99, invented: { a: { updatedAt: T1, x: 1 } } }, MAPS, T2);
    expect(doc.invented).toEqual({ a: { updatedAt: T1, x: 1 } });
    expect(doc.saves).toEqual({});
    expect(doc.settings).toEqual({});
  });

  test("drops a record with no updatedAt, because the merge could not place it", () => {
    const doc = migrate({ saves: { good: { updatedAt: T1 }, bad: { body: "x" }, worse: 4 } }, MAPS, T2);
    expect(Object.keys(doc.saves)).toEqual(["good"]);
  });

  test("keeps the document's own time when it has one", () => {
    expect(migrate({ updatedAt: T1 }, MAPS, T2).updatedAt).toBe(T1);
  });
});

describe("readRecord and writeRecord", () => {
  test("a write does not change the document it was given", () => {
    const before = emptyDocument(MAPS, T1);
    const after = writeRecord(before, "saves", "main", { hp: 3 }, T2);
    expect(before.saves).toEqual({});
    expect(readRecord(after, "saves", "main")).toEqual({ hp: 3, updatedAt: T2 });
    expect(after.updatedAt).toBe(T2);
  });

  test("a write to a map the document did not declare creates it", () => {
    const after = writeRecord(emptyDocument(MAPS, T1), "later", "k", { v: 1 }, T2);
    expect(readRecord(after, "later", "k")).toEqual({ v: 1, updatedAt: T2 });
  });

  test("the fields cannot override the record's time", () => {
    const after = writeRecord(emptyDocument(MAPS, T1), "saves", "main", { updatedAt: "lie" }, T2);
    expect(readRecord(after, "saves", "main").updatedAt).toBe(T2);
  });

  test("reads null for a missing record, a missing map, or no document at all", () => {
    expect(readRecord(emptyDocument(MAPS, T1), "saves", "nope")).toBeNull();
    expect(readRecord(emptyDocument(MAPS, T1), "nope", "nope")).toBeNull();
    expect(readRecord(null, "saves", "main")).toBeNull();
  });

  // A deleted key would come back from the other device on the next merge.
  test("removing a record keeps its key with only a time, so the merge can tell removed from never seen", () => {
    const written = writeRecord(emptyDocument(MAPS, T1), "saves", "main", { hp: 3 }, T1);
    const removed = removeRecord(written, "saves", "main", T2);
    expect(removed.saves.main).toEqual({ updatedAt: T2, removed: true });
    expect(readRecord(removed, "saves", "main")).toBeNull();
  });
});

describe("hasRecords", () => {
  test("an empty document and a document of removed records both count as empty", () => {
    expect(hasRecords(emptyDocument(MAPS, T1))).toBe(false);
    const removed = removeRecord(writeRecord(emptyDocument(MAPS, T1), "saves", "a", { x: 1 }, T1), "saves", "a", T2);
    expect(hasRecords(removed)).toBe(false);
    expect(hasRecords(writeRecord(emptyDocument(MAPS, T1), "saves", "a", { x: 1 }, T1))).toBe(true);
    expect(hasRecords(null)).toBe(false);
  });
});

describe("serializeDocument and parseDocument", () => {
  test("round-trips, with two spaces and a final newline so a human can read the diff", () => {
    const doc = writeRecord(emptyDocument(MAPS, T1), "saves", "main", { name: "Ámbar" }, T2);
    const text = serializeDocument(doc);
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).toContain('  "saves": {');
    expect(parseDocument(text, MAPS, T2)).toEqual(doc);
  });

  test("a file somebody broke by hand opens as an empty document, never as an error", () => {
    expect(parseDocument("{ not json", MAPS, T1)).toEqual(emptyDocument(MAPS, T1));
    expect(parseDocument(null, MAPS, T1)).toEqual(emptyDocument(MAPS, T1));
  });
});

describe("the size limit", () => {
  // The contents API returns file content only up to 1 MB. The store refuses
  // earlier, with a sentence, instead of failing later inside GitHub.
  test("counts UTF-8 bytes, not characters", () => {
    expect(documentBytes("aé")).toBe(3);
  });

  test("the limit leaves room under GitHub's one megabyte", () => {
    expect(MAX_DOCUMENT_BYTES).toBeLessThan(1024 * 1024);
    expect(MAX_DOCUMENT_BYTES).toBeGreaterThanOrEqual(800 * 1024);
  });
});

describe("defineDocument", () => {
  test("binds the record maps so a project never repeats them", () => {
    const shape = defineDocument(MAPS);
    const doc = shape.write(shape.empty(T1), "saves", "main", { hp: 1 }, T2);
    expect(shape.read(doc, "saves", "main")).toEqual({ hp: 1, updatedAt: T2 });
    expect(shape.parse(shape.serialize(doc), T2)).toEqual(doc);
    expect(shape.migrate({ junk: 1 }, T1)).toEqual(emptyDocument(MAPS, T1));
    expect(shape.recordMaps).toEqual(MAPS);
  });
});

describe("recordCount", () => {
  test("counts live records across every map, and not removed ones", () => {
    const { recordCount } = require("./envelope.js");
    let doc = writeRecord(emptyDocument(MAPS, T1), "saves", "a", { x: 1 }, T1);
    doc = writeRecord(doc, "settings", "b", { x: 1 }, T1);
    doc = writeRecord(doc, "saves", "c", { x: 1 }, T1);
    doc = removeRecord(doc, "saves", "c", T2);
    expect(recordCount(doc)).toBe(2);
    expect(recordCount(null)).toBe(0);
  });
});
