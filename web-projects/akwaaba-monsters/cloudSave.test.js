import { describe, expect, test } from "bun:test";
import { emptyDocument } from "../cloud-storage/envelope.js";
import { createSave } from "./save.js";
import { RECORD_MAPS, SAVE_FILE, SAVE_RECORD, documentWithSave, newerSave, saveInDocument } from "./cloudSave.js";

const T1 = "2026-09-22T10:00:00.000Z";
const T2 = "2026-09-22T11:00:00.000Z";
const empty = () => emptyDocument(RECORD_MAPS, T1);

describe("the cloud save document", () => {
  test("is one map with one record, so the save follows the standard's one shape (root ADR 0016)", () => {
    expect(RECORD_MAPS).toEqual(["saves"]);
    expect(SAVE_RECORD).toBe("main");
    expect(SAVE_FILE).toBe("save.json");
  });

  test("round-trips a save, stamped with the time it was written", () => {
    const state = { ...createSave({ name: "Ama", seed: 7 }), savedAt: T1 };
    const document = documentWithSave(empty(), state, T2);
    expect(document.saves.main.updatedAt).toBe(T2);
    expect(saveInDocument(document)).toEqual(state);
  });

  test("reads null when the document holds no save, or a save from another game", () => {
    expect(saveInDocument(empty())).toBeNull();
    expect(saveInDocument(null)).toBeNull();
    const foreign = documentWithSave(empty(), { game: "other", version: 1 }, T2);
    expect(saveInDocument(foreign)).toBeNull();
  });

  test("a save read back goes through migrate, so an old one gains its defaults", () => {
    const old = { game: "akwaaba-monsters", version: 1, player: { name: "Kojo" } };
    const read = saveInDocument(documentWithSave(empty(), old, T2));
    expect(read.player.name).toBe("Kojo");
    expect(Array.isArray(read.party)).toBe(true);
    expect(read.bag).toBeDefined();
  });
});

describe("newerSave", () => {
  // The record is one blob, so the cloud copy either replaces the local save
  // or is ignored. `savedAt` decides, because it is written by the game on
  // every save and survives the trip through the document.
  test("picks the save written later", () => {
    const older = { ...createSave({ seed: 1 }), savedAt: T1 };
    const newer = { ...createSave({ seed: 2 }), savedAt: T2 };
    expect(newerSave(older, newer)).toBe(newer);
    expect(newerSave(newer, older)).toBe(newer);
  });

  test("a missing side loses, and two missing sides give null", () => {
    const one = { ...createSave({ seed: 1 }), savedAt: T1 };
    expect(newerSave(null, one)).toBe(one);
    expect(newerSave(one, null)).toBe(one);
    expect(newerSave(null, null)).toBeNull();
  });

  test("a save with no time counts as the oldest, and a tie keeps the local one", () => {
    const untimed = createSave({ seed: 1 });
    const timed = { ...createSave({ seed: 2 }), savedAt: T1 };
    expect(newerSave(untimed, timed)).toBe(timed);
    const local = { ...createSave({ seed: 3 }), savedAt: T1 };
    expect(newerSave(local, timed)).toBe(local);
  });
});
