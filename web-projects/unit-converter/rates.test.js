// Tests for reading a rate table out of whatever an exchange-rate service sends.
//
// Two services are used, and they answer in different shapes. Neither is under
// our control, so the reader has to survive a missing field, a currency we do
// not carry, and a value that is not a number, without ever handing the page a
// rate that would produce a wrong price.

import { describe, expect, test } from "bun:test";
import { RATE_MAX_AGE_HOURS, isStale, normalizeRates } from "./rates.js";

/** What api.frankfurter.dev sends: rates are units per one euro. */
const FRANKFURTER = {
  amount: 1,
  base: "EUR",
  date: "2026-08-28",
  rates: { USD: 1.1643, GBP: 0.8572, JPY: 185.92 },
};

/** What open.er-api.com sends: the same numbers, different field names. */
const ER_API = {
  result: "success",
  base_code: "EUR",
  time_last_update_utc: "Sat, 29 Aug 2026 00:02:31 +0000",
  rates: { USD: 1.1643, GBP: 0.8572, JPY: 185.92 },
};

describe("normalizeRates", () => {
  test("turns 'units per euro' into 'worth in euros', which is what the engine wants", () => {
    const table = normalizeRates(FRANKFURTER);
    expect(table.rates.usd).toBeCloseTo(1 / 1.1643, 12);
    expect(table.rates.gbp).toBeCloseTo(1 / 0.8572, 12);
    expect(table.rates.eur).toBe(1);
  });

  test("reads both shapes the same way", () => {
    expect(normalizeRates(ER_API).rates).toEqual(normalizeRates(FRANKFURTER).rates);
  });

  test("keeps the day the rates are from", () => {
    expect(normalizeRates(FRANKFURTER).date).toBe("2026-08-28");
    expect(normalizeRates(ER_API).date).toBe("2026-08-29");
  });

  test("keys every rate by the unit id, which is the code in lower case", () => {
    for (const code of Object.keys(normalizeRates(FRANKFURTER).rates)) expect(code).toMatch(/^[a-z]{3}$/);
  });

  test("drops a currency the converter does not carry, rather than inventing a unit for it", () => {
    const table = normalizeRates({ ...FRANKFURTER, rates: { USD: 1.1643, XYZ: 5 } });
    expect(table.rates.usd).toBeDefined();
    expect(table.rates.xyz).toBeUndefined();
  });

  test("drops a rate that is not a usable number, and keeps the rest", () => {
    const table = normalizeRates({ ...FRANKFURTER, rates: { USD: 1.1643, GBP: 0, JPY: "185", CHF: null } });
    expect(table.rates.usd).toBeDefined();
    expect(table.rates.gbp).toBeUndefined();
    expect(table.rates.jpy).toBeUndefined();
    expect(table.rates.chf).toBeUndefined();
  });

  test("gives nothing back for an answer it cannot read", () => {
    expect(normalizeRates(null)).toBeNull();
    expect(normalizeRates({})).toBeNull();
    expect(normalizeRates({ rates: {} })).toBeNull();
    expect(normalizeRates({ base: "EUR", rates: "not a table" })).toBeNull();
    expect(normalizeRates("not an answer")).toBeNull();
  });

  test("gives nothing back when not one rate survives, so the page keeps its snapshot", () => {
    expect(normalizeRates({ ...FRANKFURTER, rates: { XYZ: 5 } })).toBeNull();
  });

  test("rebases a table that does not come in euros, so the engine always gets euros", () => {
    // One dollar buys 0.86 euros and 155 yen, so one euro buys about 180 yen.
    const table = normalizeRates({ base: "USD", date: "2026-08-28", rates: { EUR: 0.86, JPY: 155 } });
    expect(table.rates.eur).toBe(1);
    expect(table.rates.usd).toBeCloseTo(0.86, 10);
    expect(table.rates.jpy).toBeCloseTo(0.86 / 155, 10);
  });
});

describe("isStale", () => {
  const day = "2026-08-29T00:00:00Z";

  test("a table read today is fresh", () => {
    expect(isStale(day, new Date("2026-08-29T06:00:00Z"))).toBe(false);
  });

  test("a table older than the limit is stale", () => {
    const later = new Date(Date.parse(day) + (RATE_MAX_AGE_HOURS + 1) * 3600 * 1000);
    expect(isStale(day, later)).toBe(true);
  });

  test("a date it cannot read counts as stale, because the safe answer is to fetch again", () => {
    expect(isStale("not a date", new Date(day))).toBe(true);
    expect(isStale(null, new Date(day))).toBe(true);
  });
});
