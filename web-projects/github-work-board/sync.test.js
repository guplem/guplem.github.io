import { describe, expect, test } from "bun:test";
import { emptyDocument, readNote, writeNote } from "./boardDocument.js";
import { mergeDocuments, planSave } from "./sync.js";

const T1 = "2026-09-17T10:00:00.000Z";
const T2 = "2026-09-17T11:00:00.000Z";
const T3 = "2026-09-17T12:00:00.000Z";
const LAPTOP = "I_laptop";
const PHONE = "I_phone";

describe("mergeDocuments", () => {
  // Whole-file last-write-wins would throw away every note the other device
  // wrote. The merge runs per record, so two devices editing two issues both win.
  test("keeps a record only the other side has", () => {
    const mine = writeNote(emptyDocument(T1), LAPTOP, "mine", T2);
    const theirs = writeNote(emptyDocument(T1), PHONE, "theirs", T2);
    const merged = mergeDocuments(mine, theirs, T3);
    expect(readNote(merged, LAPTOP)).toBe("mine");
    expect(readNote(merged, PHONE)).toBe("theirs");
  });

  test("the newer edit of the same record wins, whichever side it is on", () => {
    const older = writeNote(emptyDocument(T1), LAPTOP, "old", T1);
    const newer = writeNote(emptyDocument(T1), LAPTOP, "new", T2);
    expect(readNote(mergeDocuments(older, newer, T3), LAPTOP)).toBe("new");
    expect(readNote(mergeDocuments(newer, older, T3), LAPTOP)).toBe("new");
  });

  // Two devices that merge the same pair must land on the same answer, or they
  // push each other's version back and forth for ever.
  test("a tie keeps the remote side, so every device settles on one answer", () => {
    const mine = writeNote(emptyDocument(T1), LAPTOP, "mine", T2);
    const theirs = writeNote(emptyDocument(T1), LAPTOP, "theirs", T2);
    expect(readNote(mergeDocuments(mine, theirs, T3), LAPTOP)).toBe("theirs");
  });

  test("a clear that happened later beats an edit that happened earlier", () => {
    const edited = writeNote(emptyDocument(T1), LAPTOP, "still here", T1);
    const cleared = writeNote(writeNote(emptyDocument(T1), LAPTOP, "gone", T1), LAPTOP, "", T2);
    expect(readNote(mergeDocuments(edited, cleared, T3), LAPTOP)).toBe("");
  });

  test("keeps a record map only one side knows about", () => {
    const mine = writeNote(emptyDocument(T1), LAPTOP, "mine", T2);
    const theirs = { ...emptyDocument(T1), colours: { [PHONE]: { value: "red", updatedAt: T2 } } };
    expect(mergeDocuments(mine, theirs, T3).colours).toEqual(theirs.colours);
  });

  test("survives a side that is not a document at all", () => {
    const mine = writeNote(emptyDocument(T1), LAPTOP, "mine", T2);
    expect(readNote(mergeDocuments(mine, null, T3), LAPTOP)).toBe("mine");
    expect(readNote(mergeDocuments(null, mine, T3), LAPTOP)).toBe("mine");
  });
});

describe("planSave", () => {
  test("creates the file when the repository has none", () => {
    const local = writeNote(emptyDocument(T1), LAPTOP, "first", T2);
    const plan = planSave({ local, remote: null, remoteSha: null, now: T3 });
    expect(plan.action).toBe("create");
    expect(plan.sha).toBeNull();
    expect(readNote(plan.document, LAPTOP)).toBe("first");
  });

  test("does nothing when the remote already holds exactly this", () => {
    const local = writeNote(emptyDocument(T1), LAPTOP, "same", T2);
    const plan = planSave({ local, remote: local, remoteSha: "abc", now: T3 });
    expect(plan.action).toBe("skip");
  });

  // The sha is GitHub's optimistic-concurrency check: it names the version being
  // replaced. Sending a remembered one is how a save overwrites another device.
  test("sends the sha of the version it merged against", () => {
    const local = writeNote(emptyDocument(T1), LAPTOP, "mine", T2);
    const remote = writeNote(emptyDocument(T1), PHONE, "theirs", T2);
    const plan = planSave({ local, remote, remoteSha: "sha-from-this-read", now: T3 });
    expect(plan.action).toBe("update");
    expect(plan.sha).toBe("sha-from-this-read");
    expect(readNote(plan.document, LAPTOP)).toBe("mine");
    expect(readNote(plan.document, PHONE)).toBe("theirs");
  });

  test("the merged document is what gets uploaded, never the local one alone", () => {
    const local = writeNote(emptyDocument(T1), LAPTOP, "mine", T2);
    const remote = writeNote(emptyDocument(T1), PHONE, "theirs", T2);
    expect(Object.keys(planSave({ local, remote, remoteSha: "s", now: T3 }).document.notes).sort()).toEqual([
      LAPTOP,
      PHONE,
    ]);
  });
});
