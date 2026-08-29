// Tests for the conversion engine.
//
// The engine is small on purpose: everything goes through the base unit of a
// category, so one unit only ever has to know its own relation to that base.
// The tests below check the three things that can still go wrong: a category
// boundary that must not be crossed, a currency whose factor arrives at run
// time, and the two groups where the arithmetic is not a multiplication.

import { describe, expect, test } from "bun:test";
import { convert, convertAll, factorFor, isConvertible, readabilityPenalty } from "./convert.js";
import { unitById } from "./units.js";

const near = (got, want, tolerance = 1e-9) => {
  expect(typeof got).toBe("number");
  expect(Math.abs(got - want) / Math.max(1, Math.abs(want))).toBeLessThan(tolerance);
};

describe("convert", () => {
  test("converts inside a category", () => {
    near(convert(100, "kilometre", "mile"), 62.13711922373339);
    near(convert(1, "mile", "kilometre"), 1.609344);
    near(convert(5, "kilogram", "pound"), 11.023113109243879);
    near(convert(1, "gibibyte", "gigabyte"), 1.073741824);
    near(convert(90, "degree", "radian"), Math.PI / 2);
  });

  test("gives the same value back when both units are the same", () => {
    near(convert(7.5, "metre", "metre"), 7.5);
  });

  test("crosses the offset in temperature", () => {
    near(convert(100, "celsius", "fahrenheit"), 212);
    near(convert(0, "celsius", "fahrenheit"), 32);
    near(convert(-40, "celsius", "fahrenheit"), -40);
    near(convert(98.6, "fahrenheit", "celsius"), 37);
    near(convert(0, "celsius", "kelvin"), 273.15);
  });

  test("turns fuel economy round, because the two units are reciprocals", () => {
    near(convert(30, "mpg-us", "litre-per-100km"), 7.840486111111111);
    near(convert(7.840486111111111, "litre-per-100km", "mpg-us"), 30);
    // A UK gallon is bigger, so the same car scores more miles on one.
    expect(convert(1, "mpg-uk", "litre-per-100km")).toBeGreaterThan(convert(1, "mpg-us", "litre-per-100km"));
  });

  test("refuses to cross a category, because there is no answer to give", () => {
    expect(convert(1, "metre", "kilogram")).toBeNull();
    expect(convert(1, "celsius", "byte")).toBeNull();
  });

  test("gives nothing for a unit it does not know, or for a value that is not a number", () => {
    expect(convert(1, "no-such-unit", "metre")).toBeNull();
    expect(convert(1, "metre", "no-such-unit")).toBeNull();
    expect(convert(Number.NaN, "metre", "kilometre")).toBeNull();
    expect(convert("100", "metre", "kilometre")).toBeNull();
    expect(convert(null, "metre", "kilometre")).toBeNull();
  });
});

describe("isConvertible", () => {
  test("says yes inside a category and no across one", () => {
    expect(isConvertible("metre", "mile")).toBe(true);
    expect(isConvertible("metre", "gram")).toBe(false);
    expect(isConvertible("metre", "no-such-unit")).toBe(false);
  });
});

describe("currency, whose factor only exists once the rates arrive", () => {
  // Made-up rates, so the test says what it means without depending on a
  // real market: one euro buys two dollars and one hundred yen.
  const rates = { eur: 1, usd: 0.5, jpy: 0.01 };

  test("uses the live rate when it is given", () => {
    near(convert(10, "eur", "usd", { rates }), 20);
    near(convert(100, "jpy", "eur", { rates }), 1);
    near(convert(10, "usd", "jpy", { rates }), 500);
  });

  test("falls back to the bundled snapshot when no rate is given", () => {
    const snapshot = convert(10, "eur", "usd");
    expect(snapshot).toBeGreaterThan(0);
    expect(snapshot).not.toBe(20);
    near(snapshot, 10 / unitById("usd").factor);
  });

  test("falls back per currency, so one missing rate does not break the rest", () => {
    const partial = { rates: { usd: 0.5 } };
    near(convert(10, "eur", "usd", partial), 20);
    // No rate for the yen, so its snapshot factor still answers.
    expect(convert(100, "jpy", "eur", partial)).toBeGreaterThan(0);
  });

  test("ignores a rate that is not a usable number", () => {
    for (const bad of [0, -1, Number.NaN, "0.5", null]) {
      const value = convert(10, "eur", "usd", { rates: { usd: bad } });
      expect(`${bad}: ${value === 20}`).toBe(`${bad}: false`);
      expect(`${bad}: ${value > 0}`).toBe(`${bad}: true`);
    }
  });

  test("factorFor reports which factor a unit is using", () => {
    near(factorFor(unitById("usd"), { rates }), 0.5);
    near(factorFor(unitById("usd")), unitById("usd").factor);
    near(factorFor(unitById("kilometre"), { rates }), 1000);
  });
});

describe("convertAll", () => {
  test("answers every unit of the category in one pass, most useful first", () => {
    const rows = convertAll(1, "kilometre");
    expect(rows.length).toBeGreaterThan(15);
    expect(rows[0].unit.cat).toBe("length");
    for (let i = 1; i < rows.length; i += 1) expect(rows[i].order).toBeGreaterThanOrEqual(rows[i - 1].order);
    const metre = rows.find((row) => row.unit.id === "metre");
    near(metre.value, 1000);
  });

  // The ordering is what makes one screen enough. These are the two cases that
  // drove the rule, so they are the two that must not regress.
  test("puts the units a person came for at the top", () => {
    const height = convertAll(5 + 10 / 12, "foot").slice(0, 4).map((row) => row.unit.id);
    expect(height).toContain("centimetre");
    expect(height).toContain("inch");
    expect(height).not.toContain("mile");

    // 100 km is 62 miles and 100,000,000 millimetres. Only one of those is an answer.
    const distance = convertAll(100, "kilometre").map((row) => row.unit.id);
    expect(distance[0]).toBe("mile");
    expect(distance.indexOf("mile")).toBeLessThan(distance.indexOf("millimetre"));
  });

  test("leaves the source unit out, because converting a unit to itself says nothing", () => {
    const rows = convertAll(1, "kilometre");
    expect(rows.some((row) => row.unit.id === "kilometre")).toBe(false);
  });

  test("gives nothing for a unit it does not know", () => {
    expect(convertAll(1, "no-such-unit")).toEqual([]);
    expect(convertAll(Number.NaN, "kilometre")).toEqual([]);
  });

  test("marks a currency row as live or as a snapshot, so the page can say which", () => {
    const live = convertAll(10, "eur", { rates: { usd: 0.5 } });
    expect(live.find((row) => row.unit.id === "usd").live).toBe(true);
    expect(live.find((row) => row.unit.id === "jpy").live).toBe(false);
    expect(convertAll(1, "kilometre")[0].live).toBe(false);
  });
});

describe("readabilityPenalty", () => {
  test("charges nothing for a number a person reads at a glance", () => {
    for (const value of [1, 62.14, 0.01, 99999, -177.8, 0]) expect(`${value}: ${readabilityPenalty(value)}`).toBe(`${value}: 0`);
  });

  test("charges one for a number that is getting hard to read", () => {
    for (const value of [0.001, 1e5, 1e7, -0.0011]) expect(`${value}: ${readabilityPenalty(value)}`).toBe(`${value}: 1`);
  });

  test("charges two for a number nobody wants to see", () => {
    for (const value of [1e8, 1e15, 1e-5, -1e-9]) expect(`${value}: ${readabilityPenalty(value)}`).toBe(`${value}: 2`);
  });
});
