// Tests for the unit catalogue.
//
// The catalogue is data, but wrong data is a wrong answer, so the numbers that
// a standard defines exactly are pinned here. An inch is 0.0254 metres by
// definition, not by measurement, and a test that says so catches a typo that
// no amount of reading catches.

import { describe, expect, test } from "bun:test";
import { CATEGORIES, UNITS, categoryOf, unitById, unitsInCategory } from "./units.js";

/** How close two numbers must be to count as the same. */
const near = (got, want, tolerance = 1e-9) => {
  const scale = Math.max(1, Math.abs(want));
  expect(Math.abs(got - want) / scale).toBeLessThan(tolerance);
};

/** Value of one unit measured in its category's base unit. */
const oneIn = (id) => {
  const unit = unitById(id);
  return unit.toBase ? unit.toBase(1) : unit.factor;
};

describe("catalogue shape", () => {
  test("holds a broad catalogue across many categories", () => {
    expect(UNITS.length).toBeGreaterThan(150);
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(15);
  });

  test("every unit has an id, a category, a symbol and a name in both languages", () => {
    for (const unit of UNITS) {
      expect(`${unit.id}: id`).toMatch(/^[a-z0-9-]+: id$/);
      expect(`${unit.id}: ${typeof unit.sym}`).toBe(`${unit.id}: string`);
      expect(`${unit.id}: ${typeof unit.name?.en}`).toBe(`${unit.id}: string`);
      expect(`${unit.id}: ${typeof unit.name?.es}`).toBe(`${unit.id}: string`);
      expect(`${unit.id}: ${typeof unit.rank}`).toBe(`${unit.id}: number`);
    }
  });

  test("every unit converts, either by a factor or by its own pair of functions", () => {
    for (const unit of UNITS) {
      const linear = typeof unit.factor === "number" && Number.isFinite(unit.factor) && unit.factor > 0;
      const custom = typeof unit.toBase === "function" && typeof unit.fromBase === "function";
      expect(`${unit.id}: ${linear || custom}`).toBe(`${unit.id}: true`);
    }
  });

  test("no two units share an id", () => {
    const seen = new Set();
    for (const unit of UNITS) {
      expect(`duplicate id ${unit.id}`).toBe(`duplicate id ${seen.has(unit.id) ? "!" : unit.id}`);
      seen.add(unit.id);
    }
  });

  test("every unit belongs to a declared category", () => {
    const known = new Set(CATEGORIES.map((category) => category.id));
    for (const unit of UNITS) expect(`${unit.id} -> ${known.has(unit.cat)}`).toBe(`${unit.id} -> true`);
  });

  test("every category has units and names the base unit it measures against", () => {
    for (const category of CATEGORIES) {
      const members = unitsInCategory(category.id);
      expect(`${category.id}: ${members.length > 1}`).toBe(`${category.id}: true`);
      expect(`${category.id}: ${members.some((unit) => unit.id === category.base)}`).toBe(`${category.id}: true`);
      expect(`${category.id}: ${typeof category.name?.en}`).toBe(`${category.id}: string`);
      expect(`${category.id}: ${typeof category.name?.es}`).toBe(`${category.id}: string`);
    }
  });

  test("the base unit of each category is worth exactly one of itself", () => {
    for (const category of CATEGORIES) near(oneIn(category.base), 1, 1e-12);
  });

  test("no alias is claimed twice inside one category", () => {
    for (const category of CATEGORIES) {
      const seen = new Map();
      for (const unit of unitsInCategory(category.id)) {
        for (const alias of unit.aliases ?? []) {
          const key = alias.toLowerCase();
          expect(`${category.id}/${key}: ${seen.get(key) ?? unit.id}`).toBe(`${category.id}/${key}: ${unit.id}`);
          seen.set(key, unit.id);
        }
      }
    }
  });

  // A symbol shows on screen, so it must be a real symbol a reader recognises,
  // never an internal-looking string invented to dodge a name clash.
  test("every symbol is short and carries no invented suffix", () => {
    for (const unit of UNITS) {
      expect(`${unit.id}: ${unit.sym.includes("-")}`).toBe(`${unit.id}: false`);
      expect(`${unit.id}: ${unit.sym.length <= 12}`).toBe(`${unit.id}: true`);
    }
  });

  test("every unit answers to its own symbol", () => {
    for (const unit of UNITS) {
      const aliases = (unit.aliases ?? []).map((alias) => alias.toLowerCase());
      const found = aliases.includes(unit.sym.toLowerCase()) || (unit.exact ?? []).includes(unit.sym);
      expect(`${unit.id}: ${found}`).toBe(`${unit.id}: true`);
    }
  });

  // `mW` and `MW` differ only by case, and so do `MB` and `Mb`. Those units
  // carry an `exact` spelling that the search matches case-sensitively.
  test("units that differ only by the case of their symbol carry an exact spelling", () => {
    for (const id of ["milliwatt", "megawatt", "megabyte", "megabit"]) {
      expect(`${id}: ${(unitById(id).exact ?? []).length > 0}`).toBe(`${id}: true`);
    }
  });
});

describe("round trip", () => {
  test("a value survives the trip to the base unit and back", () => {
    for (const unit of UNITS) {
      for (const value of [1, 0, -17.25, 1234.5678]) {
        const unitValue = unit.toBase ? unit.toBase(value) : value * unit.factor;
        const back = unit.fromBase ? unit.fromBase(unitValue) : unitValue / unit.factor;
        expect(`${unit.id}@${value}: ${Math.abs(back - value) < 1e-6}`).toBe(`${unit.id}@${value}: true`);
      }
    }
  });
});

describe("the numbers a standard fixes exactly", () => {
  test("length", () => {
    near(oneIn("inch"), 0.0254, 1e-12);
    near(oneIn("foot"), 0.3048, 1e-12);
    near(oneIn("yard"), 0.9144, 1e-12);
    near(oneIn("mile"), 1609.344, 1e-12);
    near(oneIn("nautical-mile"), 1852, 1e-12);
    // A CSS pixel is one ninety-sixth of an inch, which is why it belongs here.
    near(oneIn("pixel"), 0.0254 / 96, 1e-12);
    near(oneIn("point"), 0.0254 / 72, 1e-12);
  });

  test("mass", () => {
    near(oneIn("pound"), 0.45359237, 1e-12);
    near(oneIn("ounce"), 0.45359237 / 16, 1e-12);
    near(oneIn("stone"), 0.45359237 * 14, 1e-12);
    near(oneIn("carat"), 0.0002, 1e-12);
  });

  test("volume, where a US gallon and a UK gallon are not the same thing", () => {
    near(oneIn("us-gallon"), 3.785411784, 1e-12);
    near(oneIn("imperial-gallon"), 4.54609, 1e-12);
    near(oneIn("us-cup"), 0.2365882365, 1e-12);
    near(oneIn("us-tablespoon"), 0.01478676478125, 1e-12);
    near(oneIn("us-teaspoon"), 0.00492892159375, 1e-12);
    near(oneIn("cubic-metre"), 1000, 1e-12);
  });

  test("data, where a kilobyte and a kibibyte are not the same thing", () => {
    near(oneIn("kilobyte"), 1000, 1e-12);
    near(oneIn("kibibyte"), 1024, 1e-12);
    near(oneIn("gigabyte"), 1e9, 1e-12);
    near(oneIn("gibibyte"), 1024 ** 3, 1e-12);
    near(oneIn("bit"), 0.125, 1e-12);
  });

  test("energy and power", () => {
    near(oneIn("kilocalorie"), 4184, 1e-12);
    near(oneIn("kilowatt-hour"), 3.6e6, 1e-12);
    near(oneIn("horsepower"), 745.6998715822702, 1e-9);
    near(oneIn("metric-horsepower"), 735.49875, 1e-9);
  });

  test("pressure and speed", () => {
    near(oneIn("bar"), 1e5, 1e-12);
    near(oneIn("atmosphere"), 101325, 1e-12);
    near(oneIn("psi"), 6894.757293168361, 1e-9);
    near(oneIn("knot"), 1852 / 3600, 1e-12);
    near(oneIn("kilometre-per-hour"), 1 / 3.6, 1e-12);
  });

  test("time", () => {
    near(oneIn("hour"), 3600, 1e-12);
    near(oneIn("day"), 86400, 1e-12);
    near(oneIn("week"), 604800, 1e-12);
  });
});

describe("the units that are not a simple multiplication", () => {
  test("temperature carries an offset, so zero is not zero", () => {
    const celsius = unitById("celsius");
    near(celsius.toBase(0), 273.15, 1e-12);
    near(celsius.toBase(100), 373.15, 1e-12);
    const fahrenheit = unitById("fahrenheit");
    near(fahrenheit.toBase(32), 273.15, 1e-12);
    near(fahrenheit.fromBase(273.15), 32, 1e-12);
    // The one temperature that reads the same on both scales.
    near(fahrenheit.fromBase(celsius.toBase(-40)), -40, 1e-12);
  });

  test("fuel economy runs backwards: more miles per gallon is fewer litres per 100 km", () => {
    const mpg = unitById("mpg-us");
    const thirsty = mpg.toBase(10);
    const frugal = mpg.toBase(50);
    expect(thirsty).toBeGreaterThan(frugal);
    const kmPerLitre = unitById("km-per-litre");
    near(kmPerLitre.fromBase(kmPerLitre.toBase(16.5)), 16.5, 1e-12);
    // 10 litres per 100 km is the same car as 10 km on a litre.
    near(kmPerLitre.fromBase(10), 10, 1e-12);
    // 1 US mpg is 235.214...  litres per 100 km, the number every car magazine prints.
    near(mpg.toBase(1), 235.21458333333334, 1e-9);
  });
});

describe("lookup helpers", () => {
  test("unitById finds a unit and gives nothing for a name that is not one", () => {
    expect(unitById("metre").sym).toBe("m");
    expect(unitById("no-such-unit")).toBeUndefined();
    expect(unitById(null)).toBeUndefined();
  });

  test("unitsInCategory returns only that category, sorted by how common each unit is", () => {
    const lengths = unitsInCategory("length");
    expect(lengths.length).toBeGreaterThan(10);
    for (const unit of lengths) expect(unit.cat).toBe("length");
    for (let i = 1; i < lengths.length; i += 1) expect(lengths[i].rank).toBeGreaterThanOrEqual(lengths[i - 1].rank);
    expect(unitsInCategory("no-such-category")).toEqual([]);
  });

  test("categoryOf names the category a unit measures", () => {
    expect(categoryOf("celsius").id).toBe("temperature");
    expect(categoryOf("no-such-unit")).toBeUndefined();
  });
});

describe("currency", () => {
  test("currencies are marked live, because their factor is not known until the rates arrive", () => {
    const euro = unitById("eur");
    expect(euro.cat).toBe("currency");
    expect(euro.live).toBe(true);
    const currencies = unitsInCategory("currency");
    expect(currencies.length).toBeGreaterThan(30);
    for (const unit of currencies) {
      expect(`${unit.id}: ${unit.live}`).toBe(`${unit.id}: true`);
      // The id is the ISO 4217 code in lower case, which is what the rate table is keyed by.
      expect(unit.id).toMatch(/^[a-z]{3}$/);
    }
  });
});
