import { describe, expect, test } from "bun:test";
import { emptyDocument, readRecord, removeRecord, writeRecord } from "./envelope.js";
import { mergeDocuments, planSave, planText, sameRecords } from "./merge.js";

const T1 = "2026-09-22T10:00:00.000Z";
const T2 = "2026-09-22T11:00:00.000Z";
const T3 = "2026-09-22T12:00:00.000Z";
const MAPS = ["notes"];
const note = (doc, key, body, at) => writeRecord(doc, "notes", key, { body }, at);
const body = (doc, key) => readRecord(doc, "notes", key)?.body ?? "";

describe("mergeDocuments (github-work-board ADR 0002, lifted)", () => {
  test("keeps a record only the other side has", () => {
    const mine = note(emptyDocument(MAPS, T1), "a", "mine", T2);
    const theirs = note(emptyDocument(MAPS, T1), "b", "theirs", T2);
    const merged = mergeDocuments(mine, theirs, T3);
    expect(body(merged, "a")).toBe("mine");
    expect(body(merged, "b")).toBe("theirs");
  });

  test("the newer edit of the same record wins, whichever side it is on", () => {
    const older = note(emptyDocument(MAPS, T1), "a", "old", T1);
    const newer = note(emptyDocument(MAPS, T1), "a", "new", T2);
    expect(body(mergeDocuments(older, newer, T3), "a")).toBe("new");
    expect(body(mergeDocuments(newer, older, T3), "a")).toBe("new");
  });

  // Two devices that merge the same pair must land on the same answer, or they
  // push each other's version back and forth for ever.
  test("a tie keeps the remote side, so every device settles on one answer", () => {
    const mine = note(emptyDocument(MAPS, T1), "a", "mine", T2);
    const theirs = note(emptyDocument(MAPS, T1), "a", "theirs", T2);
    expect(body(mergeDocuments(mine, theirs, T3), "a")).toBe("theirs");
  });

  test("a removal that happened later beats an edit that happened earlier", () => {
    const edited = note(emptyDocument(MAPS, T1), "a", "still here", T1);
    const removed = removeRecord(note(emptyDocument(MAPS, T1), "a", "gone", T1), "notes", "a", T2);
    expect(readRecord(mergeDocuments(edited, removed, T3), "notes", "a")).toBeNull();
  });

  test("keeps a record map only one side knows about", () => {
    const mine = note(emptyDocument(MAPS, T1), "a", "mine", T2);
    const theirs = { ...emptyDocument(MAPS, T1), colours: { x: { value: "red", updatedAt: T2 } } };
    expect(mergeDocuments(mine, theirs, T3).colours).toEqual(theirs.colours);
  });

  test("survives a side that is not a document at all", () => {
    const mine = note(emptyDocument(MAPS, T1), "a", "mine", T2);
    expect(body(mergeDocuments(mine, null, T3), "a")).toBe("mine");
    expect(body(mergeDocuments(null, mine, T3), "a")).toBe("mine");
  });
});

describe("sameRecords", () => {
  test("ignores the document's own time and the order of keys", () => {
    const a = { schemaVersion: 1, updatedAt: T1, notes: { x: { body: "1", updatedAt: T1 }, y: { body: "2", updatedAt: T1 } } };
    const b = { schemaVersion: 1, updatedAt: T3, notes: { y: { body: "2", updatedAt: T1 }, x: { body: "1", updatedAt: T1 } } };
    expect(sameRecords(a, b)).toBe(true);
    expect(sameRecords(a, note(a, "x", "changed", T2))).toBe(false);
  });
});

describe("planSave", () => {
  test("creates the file when the repository has none", () => {
    const local = note(emptyDocument(MAPS, T1), "a", "first", T2);
    const plan = planSave({ local, remote: null, remoteSha: null, now: T3 });
    expect(plan.action).toBe("create");
    expect(plan.sha).toBeNull();
    expect(body(plan.document, "a")).toBe("first");
  });

  test("does nothing when the remote already holds exactly this", () => {
    const local = note(emptyDocument(MAPS, T1), "a", "same", T2);
    expect(planSave({ local, remote: local, remoteSha: "abc", now: T3 }).action).toBe("skip");
  });

  // The sha is GitHub's optimistic-concurrency check: it names the version being
  // replaced. Sending a remembered one is how a save overwrites another device.
  test("sends the sha of the version it merged against", () => {
    const local = note(emptyDocument(MAPS, T1), "a", "mine", T2);
    const remote = note(emptyDocument(MAPS, T1), "b", "theirs", T2);
    const plan = planSave({ local, remote, remoteSha: "sha-from-this-read", now: T3 });
    expect(plan.action).toBe("update");
    expect(plan.sha).toBe("sha-from-this-read");
    expect(body(plan.document, "a")).toBe("mine");
    expect(body(plan.document, "b")).toBe("theirs");
  });

  test("planText is the exact text to upload", () => {
    const local = note(emptyDocument(MAPS, T1), "a", "mine", T2);
    const plan = planSave({ local, remote: null, now: T3 });
    expect(planText(plan)).toBe(`${JSON.stringify(plan.document, null, 2)}\n`);
  });
});
