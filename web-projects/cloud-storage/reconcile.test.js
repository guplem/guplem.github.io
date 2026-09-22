import { describe, expect, test } from "bun:test";
import { emptyDocument, readRecord, writeRecord } from "./envelope.js";
import { ANSWERS, ANSWER_IDS, applyAnswer, describeCopies } from "./reconcile.js";

const T1 = "2026-09-22T10:00:00.000Z";
const T2 = "2026-09-22T11:00:00.000Z";
const T3 = "2026-09-22T12:00:00.000Z";
const MAPS = ["saves"];
const save = (doc, key, hp, at) => writeRecord(doc, "saves", key, { hp }, at);
const hp = (doc, key) => readRecord(doc, "saves", key)?.hp ?? null;

describe("describeCopies", () => {
  const local = save(emptyDocument(MAPS, T1), "main", 3, T2);
  const cloud = save(emptyDocument(MAPS, T1), "main", 7, T2);

  // Once a device has answered, its local copy is a mirror of the cloud, and a
  // normal merge is the right thing. The question must never return.
  test("a reconciled device syncs, whatever the two copies hold", () => {
    expect(describeCopies({ local, cloud, reconciled: true })).toBe("synced");
    expect(describeCopies({ local: null, cloud: null, reconciled: true })).toBe("synced");
  });

  test("nothing anywhere", () => {
    expect(describeCopies({ local: null, cloud: null, reconciled: false })).toBe("none");
    expect(describeCopies({ local: emptyDocument(MAPS, T1), cloud: emptyDocument(MAPS, T1), reconciled: false })).toBe("none");
  });

  test("only this device has data: push it up without asking", () => {
    expect(describeCopies({ local, cloud: null, reconciled: false })).toBe("local-only");
    expect(describeCopies({ local, cloud: emptyDocument(MAPS, T1), reconciled: false })).toBe("local-only");
  });

  test("only the cloud has data: take it without asking", () => {
    expect(describeCopies({ local: null, cloud, reconciled: false })).toBe("cloud-only");
  });

  test("both hold the same records: nothing to ask", () => {
    expect(describeCopies({ local, cloud: { ...local, updatedAt: T3 }, reconciled: false })).toBe("same");
  });

  // The one case a person must decide. Answering it wrong loses data, so the
  // store never guesses here (root ADR 0016).
  test("both hold different data: ask", () => {
    expect(describeCopies({ local, cloud, reconciled: false })).toBe("ask");
  });
});

describe("the answers", () => {
  test("are three, in this order, with merge first because it loses nothing", () => {
    expect(ANSWER_IDS).toEqual(["merge", "keep-local", "use-cloud"]);
    expect(ANSWERS.map((one) => one.id)).toEqual(ANSWER_IDS);
    for (const answer of ANSWERS) expect(answer.label.length).toBeGreaterThan(0);
  });
});

describe("applyAnswer", () => {
  const local = save(save(emptyDocument(MAPS, T1), "main", 3, T2), "alt", 1, T1);
  const cloud = save(save(emptyDocument(MAPS, T1), "main", 7, T1), "other", 9, T2);

  test("merge keeps every record and writes both copies", () => {
    const result = applyAnswer("merge", { local, cloud, now: T3 });
    expect(hp(result.document, "main")).toBe(3);
    expect(hp(result.document, "alt")).toBe(1);
    expect(hp(result.document, "other")).toBe(9);
    expect(result).toMatchObject({ writeLocal: true, writeCloud: true });
  });

  test("keep-local sends this device's copy up and leaves it as it is here", () => {
    const result = applyAnswer("keep-local", { local, cloud, now: T3 });
    expect(hp(result.document, "main")).toBe(3);
    expect(hp(result.document, "other")).toBeNull();
    expect(result).toMatchObject({ writeLocal: false, writeCloud: true });
  });

  test("use-cloud takes the cloud copy down and leaves the cloud as it is", () => {
    const result = applyAnswer("use-cloud", { local, cloud, now: T3 });
    expect(hp(result.document, "main")).toBe(7);
    expect(hp(result.document, "alt")).toBeNull();
    expect(result).toMatchObject({ writeLocal: true, writeCloud: false });
  });

  test("an answer this build does not know merges, the answer that loses nothing", () => {
    expect(applyAnswer("delete-everything", { local, cloud, now: T3 })).toEqual(applyAnswer("merge", { local, cloud, now: T3 }));
  });
});
