import { describe, test, expect } from "bun:test";
import {
  RECENTS_KEY,
  MAX_RECENTS,
  addRecent,
  serializeRecents,
  deserializeRecents,
} from "./recents.js";

const ES = { dial: "34", national: "639078482" };
const UK = { dial: "44", national: "7911123456" };
const US = { dial: "1", national: "2125550123" };

describe("storage key", () => {
  test("is namespaced and versioned, as root ADR 0007 requires", () => {
    expect(RECENTS_KEY).toBe("whatsapp-no-contact:recents:v1");
  });

  test("keeps the list short enough to show without scrolling", () => {
    expect(MAX_RECENTS).toBeGreaterThan(2);
    expect(MAX_RECENTS).toBeLessThanOrEqual(8);
  });
});

describe("addRecent", () => {
  test("puts the newest number first", () => {
    expect(addRecent([ES], UK)).toEqual([UK, ES]);
  });

  test("does not change the list it is given", () => {
    const list = [ES];
    addRecent(list, UK);
    expect(list).toEqual([ES]);
  });

  test("moves a repeated number to the front instead of duplicating it", () => {
    expect(addRecent([UK, ES], ES)).toEqual([ES, UK]);
  });

  test("treats the same number written differently as one entry", () => {
    const written = { dial: "44", national: "(0) 7911 123456" };
    expect(addRecent([UK, ES], written)).toEqual([UK, ES]);
  });

  test("stores the normalized number, not the raw typing", () => {
    expect(addRecent([], { dial: "44", national: "07911 123456" })).toEqual([UK]);
  });

  test("caps the list at the maximum, dropping the oldest entry", () => {
    const list = addRecent(addRecent(addRecent([], ES), UK), US);
    expect(addRecent(list, ES, 2)).toEqual([ES, US]);
  });

  test("ignores a number that is not valid", () => {
    expect(addRecent([ES], { dial: "34", national: "" })).toEqual([ES]);
    expect(addRecent([ES], { dial: null, national: "639078482" })).toEqual([ES]);
    expect(addRecent([ES], null)).toEqual([ES]);
  });

  test("starts a fresh list when the given list is not an array", () => {
    expect(addRecent(null, ES)).toEqual([ES]);
    expect(addRecent("nope", ES)).toEqual([ES]);
  });
});

describe("serializeRecents and deserializeRecents", () => {
  test("round-trip a list", () => {
    const list = [ES, UK];
    expect(deserializeRecents(serializeRecents(list))).toEqual(list);
  });

  test("store only the dial code and the number", () => {
    const stored = JSON.parse(serializeRecents([{ ...ES, note: "drop me" }]));
    expect(stored).toEqual([{ dial: "34", national: "639078482" }]);
  });

  test("deserialize returns an empty list for anything unreadable", () => {
    // Old or corrupt stored data must never break the page.
    expect(deserializeRecents(null)).toEqual([]);
    expect(deserializeRecents("")).toEqual([]);
    expect(deserializeRecents("{not json")).toEqual([]);
    expect(deserializeRecents('"a string"')).toEqual([]);
    expect(deserializeRecents("{}")).toEqual([]);
    expect(deserializeRecents("42")).toEqual([]);
  });

  test("deserialize drops entries that are not usable numbers", () => {
    const raw = JSON.stringify([ES, { dial: "34" }, { national: "639078482" }, "nope", null, UK]);
    expect(deserializeRecents(raw)).toEqual([ES, UK]);
  });

  test("deserialize drops a number whose country code no longer exists", () => {
    const raw = JSON.stringify([{ dial: "999", national: "12345678" }, ES]);
    expect(deserializeRecents(raw)).toEqual([ES]);
  });

  test("deserialize removes duplicates and enforces the cap", () => {
    const raw = JSON.stringify([ES, ES, UK, US, ES]);
    expect(deserializeRecents(raw)).toEqual([ES, UK, US]);
    const many = JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({ dial: "34", national: `6390784${String(i).padStart(2, "0")}` }))
    );
    expect(deserializeRecents(many)).toHaveLength(MAX_RECENTS);
  });
});
