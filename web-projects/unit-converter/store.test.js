// Tests for what the page remembers between visits.
//
// Everything here goes through a storage object the caller passes in, so the
// tests use a plain fake and never touch a browser. That also means the rules
// that matter can be checked directly: a browser with storage switched off, or
// a key holding something that is not what we wrote, must never break the page.

import { beforeEach, describe, expect, test } from "bun:test";
import { readLanguage, readRates, readRecents, rememberConversion, saveLanguage, saveRates, RECENTS_KEPT } from "./store.js";

/** A stand-in for localStorage that lives in a plain object. */
const fakeStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

/** A browser that refuses to store anything, which is what private mode can do. */
const refusingStorage = () => ({
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
  removeItem: () => {
    throw new Error("denied");
  },
});

let storage;
beforeEach(() => {
  storage = fakeStorage();
});

describe("recent conversions", () => {
  test("starts with none", () => {
    expect(readRecents(storage)).toEqual([]);
  });

  test("remembers one and gives it back", () => {
    rememberConversion(storage, { q: "100 km", to: "mile" });
    expect(readRecents(storage)).toEqual([{ q: "100 km", to: "mile" }]);
  });

  test("puts the newest first", () => {
    rememberConversion(storage, { q: "100 km", to: "mile" });
    rememberConversion(storage, { q: "20 C", to: "fahrenheit" });
    expect(readRecents(storage)[0].q).toBe("20 C");
  });

  test("does not list the same conversion twice", () => {
    rememberConversion(storage, { q: "100 km", to: "mile" });
    rememberConversion(storage, { q: "20 C", to: "fahrenheit" });
    rememberConversion(storage, { q: "100 km", to: "mile" });
    const recents = readRecents(storage);
    expect(recents.length).toBe(2);
    expect(recents[0].q).toBe("100 km");
  });

  test("keeps only the last few, so the row of chips never grows past one line", () => {
    for (let i = 0; i < RECENTS_KEPT + 5; i += 1) rememberConversion(storage, { q: `${i} km`, to: "mile" });
    expect(readRecents(storage).length).toBe(RECENTS_KEPT);
    expect(readRecents(storage)[0].q).toBe(`${RECENTS_KEPT + 4} km`);
  });

  test("refuses an entry with nothing in it, so no blank chip can appear", () => {
    rememberConversion(storage, { q: "", to: "mile" });
    rememberConversion(storage, {});
    rememberConversion(storage, null);
    expect(readRecents(storage)).toEqual([]);
  });

  test("survives a key holding something that is not a list", () => {
    storage.setItem("unit-converter.recents", "not json at all");
    expect(readRecents(storage)).toEqual([]);
    storage.setItem("unit-converter.recents", '{"q":"100 km"}');
    expect(readRecents(storage)).toEqual([]);
  });

  test("drops entries inside the list that are not conversions", () => {
    storage.setItem("unit-converter.recents", JSON.stringify([{ q: "100 km" }, 7, null, { to: "mile" }]));
    expect(readRecents(storage)).toEqual([{ q: "100 km", to: null }]);
  });
});

describe("the cached rate table", () => {
  const table = { date: "2026-08-29", rates: { eur: 1, usd: 0.86 } };

  test("comes back exactly as it went in", () => {
    saveRates(storage, table);
    expect(readRates(storage)).toEqual(table);
  });

  test("is nothing before anything is saved", () => {
    expect(readRates(storage)).toBeNull();
  });

  test("is nothing when what was stored is not a rate table", () => {
    storage.setItem("unit-converter.rates", "{}");
    expect(readRates(storage)).toBeNull();
    storage.setItem("unit-converter.rates", '{"date":"2026-08-29"}');
    expect(readRates(storage)).toBeNull();
  });
});

describe("the chosen language", () => {
  test("comes back after it is saved", () => {
    saveLanguage(storage, "es");
    expect(readLanguage(storage)).toBe("es");
  });

  test("is nothing when none was chosen, or when the stored one is not offered", () => {
    expect(readLanguage(storage)).toBeNull();
    storage.setItem("unit-converter.lang", "kl");
    expect(readLanguage(storage)).toBeNull();
  });
});

describe("a browser that will not store anything", () => {
  test("reads as empty rather than throwing", () => {
    const denied = refusingStorage();
    expect(readRecents(denied)).toEqual([]);
    expect(readRates(denied)).toBeNull();
    expect(readLanguage(denied)).toBeNull();
  });

  test("writes quietly rather than throwing, so the page keeps working", () => {
    const denied = refusingStorage();
    expect(() => rememberConversion(denied, { q: "100 km", to: "mile" })).not.toThrow();
    expect(() => saveRates(denied, { date: "2026-08-29", rates: { eur: 1 } })).not.toThrow();
    expect(() => saveLanguage(denied, "es")).not.toThrow();
  });

  test("does the same when there is no storage at all", () => {
    expect(readRecents(null)).toEqual([]);
    expect(() => rememberConversion(null, { q: "1 m", to: "foot" })).not.toThrow();
  });
});
