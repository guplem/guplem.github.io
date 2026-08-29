// Tests for the unit search.
//
// This is the part a person touches most, so it is the part most worth pinning
// down. The rule it must never break: the shortest thing you can type for a
// unit gives you that unit. `km` is kilometres. `mb` is megabytes. Everything
// else is ranking, and ranking is what the rest of these tests measure.

import { describe, expect, test } from "bun:test";
import { bestUnit, searchUnits } from "./search.js";

/** The id of the unit the search puts first. */
const top = (query, options) => searchUnits(query, options)[0]?.unit.id;
/** The ids the search offers, in order. */
const ids = (query, options) => searchUnits(query, options).map((hit) => hit.unit.id);

describe("the shortest thing you can type", () => {
  test("a symbol finds its own unit", () => {
    const expected = {
      km: "kilometre",
      m: "metre",
      cm: "centimetre",
      mi: "mile",
      ft: "foot",
      in: "inch",
      kg: "kilogram",
      lb: "pound",
      oz: "ounce",
      g: "gram",
      l: "litre",
      ml: "millilitre",
      s: "second",
      h: "hour",
      w: "watt",
      n: "newton",
      hz: "hertz",
      bar: "bar",
      psi: "psi",
      mph: "mile-per-hour",
      "km/h": "kilometre-per-hour",
      kwh: "kilowatt-hour",
      ha: "hectare",
    };
    for (const [query, id] of Object.entries(expected)) expect(`${query} -> ${top(query)}`).toBe(`${query} -> ${id}`);
  });

  test("a full name finds its unit, in English or in Spanish", () => {
    expect(top("kilometre")).toBe("kilometre");
    expect(top("kilometers")).toBe("kilometre");
    expect(top("kilometros")).toBe("kilometre");
    expect(top("kilómetros")).toBe("kilometre");
    expect(top("pulgadas")).toBe("inch");
    expect(top("libras")).toBe("pound");
    expect(top("cucharada")).toBe("us-tablespoon");
  });

  test("an accent typed or left out finds the same unit", () => {
    expect(top("area")).toBe(top("área"));
    expect(top("kilometro")).toBe(top("kilómetro"));
  });
});

describe("the pairs that differ only by case", () => {
  test("MB is megabytes and Mb is megabits", () => {
    expect(top("MB")).toBe("megabyte");
    expect(top("Mb")).toBe("megabit");
    // Typed all in lower case it is the everyday one, which is the byte.
    expect(top("mb")).toBe("megabyte");
  });

  test("mW is milliwatts and MW is megawatts", () => {
    expect(top("mW")).toBe("milliwatt");
    expect(top("MW")).toBe("megawatt");
    expect(top("mw")).toBe("megawatt");
  });
});

describe("ranking", () => {
  test("an exact match beats a longer word that merely starts the same way", () => {
    // `kilo` is what people call a kilogram, so it must not be swallowed by
    // kilometre, kilojoule, kilowatt and the rest.
    expect(top("kilo")).toBe("kilogram");
    expect(top("cup")).toBe("us-cup");
    expect(top("gal")).toBe("us-gallon");
  });

  test("the common unit wins when two units answer to the same word", () => {
    // `c` is Celsius to almost everyone and the speed of light to almost no one.
    expect(top("c")).toBe("celsius");
    // `min` is a minute far more often than it is a minute of arc.
    expect(top("min")).toBe("minute");
  });

  test("a currency symbol finds its currency", () => {
    expect(top("$")).toBe("usd");
    expect(top("€")).toBe("eur");
    expect(top("£")).toBe("gbp");
    expect(top("¥")).toBe("jpy");
    expect(top("usd")).toBe("usd");
    expect(top("dolar")).toBe("usd");
  });

  test("a prefix offers the units that start with it", () => {
    expect(ids("kilom")).toContain("kilometre");
    expect(ids("gigab")).toContain("gigabyte");
    expect(ids("celsi")[0]).toBe("celsius");
  });

  test("a small typo still finds the unit", () => {
    expect(ids("kilometr")).toContain("kilometre");
    expect(ids("farenheit")[0]).toBe("fahrenheit");
    expect(ids("celcius")).toContain("celsius");
  });

  test("every hit carries the unit and a score, best first", () => {
    const hits = searchUnits("met");
    expect(hits.length).toBeGreaterThan(1);
    for (const hit of hits) expect(typeof hit.score).toBe("number");
    for (let i = 1; i < hits.length; i += 1) expect(hits[i].score).toBeLessThanOrEqual(hits[i - 1].score);
  });
});

describe("what the search does not do", () => {
  test("gives nothing back for an empty query", () => {
    expect(searchUnits("")).toEqual([]);
    expect(searchUnits("   ")).toEqual([]);
    expect(searchUnits(null)).toEqual([]);
    expect(searchUnits(undefined)).toEqual([]);
  });

  test("gives nothing back for a word that is not a unit", () => {
    expect(searchUnits("qwertyuiop")).toEqual([]);
    expect(searchUnits("banana")).toEqual([]);
  });

  test("never offers the same unit twice", () => {
    const found = ids("m");
    expect(new Set(found).size).toBe(found.length);
  });

  test("stops at the limit it is given", () => {
    expect(searchUnits("m", { limit: 3 }).length).toBe(3);
    expect(searchUnits("m", { limit: 0 }).length).toBe(0);
  });
});

describe("searching inside one category", () => {
  test("offers only units that convert with the one already chosen", () => {
    const hits = searchUnits("m", { category: "mass" });
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) expect(hit.unit.cat).toBe("mass");
  });

  test("gives nothing when the category holds no match", () => {
    expect(searchUnits("kilometre", { category: "currency" })).toEqual([]);
  });
});

describe("bestUnit", () => {
  test("gives the one unit the search is most sure of", () => {
    expect(bestUnit("km").id).toBe("kilometre");
    expect(bestUnit("°C").id).toBe("celsius");
  });

  test("gives nothing when it is not sure of anything", () => {
    expect(bestUnit("qwertyuiop")).toBeUndefined();
    expect(bestUnit("")).toBeUndefined();
  });

  test("only answers when the match is a real one, not a distant guess", () => {
    // A single letter that no unit is called must not drag in a unit that
    // merely contains it somewhere, or every stray keystroke becomes a unit.
    expect(bestUnit("zzzz")).toBeUndefined();
  });
});
