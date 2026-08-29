// Tests for reading one typed line.
//
// The page has one input box, so this module carries the whole interface. Each
// test below is a way a real person writes an amount: a height as `5'10"`, a
// recipe as `1 1/2 cup`, a European price as `1.234,56 €`, a video length as
// `1h30m`. Every one of them has to land on the same answer a careful reader
// would give.

import { describe, expect, test } from "bun:test";
import { parseNumber, parseQuery } from "./parse.js";

/** The parts of a parse that a test usually cares about. */
const read = (text) => {
  const parsed = parseQuery(text);
  return { value: parsed.value, unit: parsed.unitId, target: parsed.targetId };
};

describe("parseNumber", () => {
  test("reads a plain number", () => {
    expect(parseNumber("100")).toBe(100);
    expect(parseNumber("0.5")).toBe(0.5);
    expect(parseNumber("-40")).toBe(-40);
    expect(parseNumber("+12")).toBe(12);
  });

  test("reads a comma as a decimal mark when that is what it must be", () => {
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("0,25")).toBe(0.25);
    expect(parseNumber("1,2345")).toBe(1.2345);
  });

  test("reads a comma as a thousands mark when that is what it must be", () => {
    expect(parseNumber("1,000")).toBe(1000);
    expect(parseNumber("12,345")).toBe(12345);
    expect(parseNumber("1,234,567")).toBe(1234567);
  });

  test("reads the European way of writing both marks", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("1.000.000")).toBe(1000000);
  });

  test("reads the English way of writing both marks", () => {
    expect(parseNumber("1,234.56")).toBe(1234.56);
  });

  test("reads a space or an apostrophe used to group digits", () => {
    expect(parseNumber("1 000 000")).toBe(1000000);
    expect(parseNumber("1'000'000")).toBe(1000000);
  });

  test("reads the exponent form", () => {
    expect(parseNumber("2.5e3")).toBe(2500);
    expect(parseNumber("1E-6")).toBe(0.000001);
  });

  test("reads a fraction, whole part and all", () => {
    expect(parseNumber("3/4")).toBe(0.75);
    expect(parseNumber("1 1/2")).toBe(1.5);
    expect(parseNumber("-1 1/4")).toBe(-1.25);
  });

  test("gives nothing for text that is not a number", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("1/0")).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });
});

describe("an amount and a unit", () => {
  test("reads them with or without a space between", () => {
    expect(read("100 km")).toEqual({ value: 100, unit: "kilometre", target: null });
    expect(read("100km")).toEqual({ value: 100, unit: "kilometre", target: null });
    expect(read("  100   km  ")).toEqual({ value: 100, unit: "kilometre", target: null });
  });

  test("reads a unit written out in full, in either language", () => {
    expect(read("3 pounds").unit).toBe("pound");
    expect(read("3 libras").unit).toBe("pound");
    expect(read("2 tazas").unit).toBe("us-cup");
  });

  test("takes one on its own as one of that unit, so a bare unit still answers", () => {
    const parsed = parseQuery("km");
    expect(parsed.value).toBe(1);
    expect(parsed.unitId).toBe("kilometre");
    expect(parsed.impliedValue).toBe(true);
  });

  test("keeps the number when the unit is not one it knows", () => {
    const parsed = parseQuery("100 banana");
    expect(parsed.value).toBe(100);
    expect(parsed.unitId).toBeNull();
    expect(parsed.unitQuery).toBe("banana");
  });

  test("hands back what was typed for the unit, so the page can suggest", () => {
    expect(parseQuery("100 kilom").unitQuery).toBe("kilom");
    expect(parseQuery("100 ").unitQuery).toBe("");
  });

  test("reads a temperature, degree sign and minus sign and all", () => {
    expect(read("20°C")).toEqual({ value: 20, unit: "celsius", target: null });
    expect(read("-40 C")).toEqual({ value: -40, unit: "celsius", target: null });
    expect(read("98.6 F")).toEqual({ value: 98.6, unit: "fahrenheit", target: null });
  });

  test("reads a currency symbol before or after the amount", () => {
    expect(read("$100")).toEqual({ value: 100, unit: "usd", target: null });
    expect(read("100$")).toEqual({ value: 100, unit: "usd", target: null });
    expect(read("€50")).toEqual({ value: 50, unit: "eur", target: null });
    expect(read("1.234,56 €")).toEqual({ value: 1234.56, unit: "eur", target: null });
  });

  test("reads a unit written with a slash", () => {
    expect(read("100 km/h").unit).toBe("kilometre-per-hour");
    expect(read("100 Mbps").unit).toBe("megabit-per-second");
  });

  // A unit may hold digits of its own. Cutting the unit at the first digit made
  // `7 l/100km` read as seven litres per 100 km plus another hundred km/l, and
  // then quietly answered for eight.
  test("reads a unit that has digits inside it as one unit", () => {
    for (const text of ["7 l/100km", "7 l/100 km", "7l/100km"]) {
      const parsed = parseQuery(text);
      expect(`${text}: ${parsed.unitId}`).toBe(`${text}: litre-per-100km`);
      expect(`${text}: ${parsed.value}`).toBe(`${text}: 7`);
      expect(`${text}: ${parsed.label}`).toBe(`${text}: null`);
    }
  });

  test("reads a squared or cubed unit written with the digit", () => {
    expect(read("100 m2").unit).toBe("square-metre");
    expect(read("100 km2").unit).toBe("square-kilometre");
    expect(read("100 in3").unit).toBe("cubic-inch");
    expect(read("100 m²").unit).toBe("square-metre");
  });

  test("reads a unit written as two words", () => {
    expect(read("2 fl oz").unit).toBe("us-fluid-ounce");
    expect(read("100 square feet").unit).toBe("square-foot");
    expect(read("1 nautical mile").unit).toBe("nautical-mile");
  });
});

describe("picking the target", () => {
  test("understands the words people use for it", () => {
    for (const text of ["100 km to mi", "100 km in mi", "100 km into mi", "100 km as mi", "100 km a mi", "100 km en mi"]) {
      expect(`${text} -> ${parseQuery(text).targetId}`).toBe(`${text} -> mile`);
    }
  });

  test("understands the arrows people use for it", () => {
    for (const text of ["100 km -> mi", "100 km → mi", "100 km > mi", "100 km = mi"]) {
      expect(`${text} -> ${parseQuery(text).targetId}`).toBe(`${text} -> mile`);
    }
  });

  test("still reads `in` as inches when that is what it is", () => {
    expect(read("100 cm in in")).toEqual({ value: 100, unit: "centimetre", target: "inch" });
    expect(read("100 in to cm")).toEqual({ value: 100, unit: "inch", target: "centimetre" });
    expect(read("6 in")).toEqual({ value: 6, unit: "inch", target: null });
  });

  test("keeps the target inside the category of the amount", () => {
    // There is no answer for kilometres in kilograms, so the target is refused
    // rather than silently converted into something else.
    expect(parseQuery("100 km to kg").targetId).toBeNull();
    expect(parseQuery("100 km to kg").targetQuery).toBe("kg");
  });

  test("knows a target is coming while it is still being typed", () => {
    const parsed = parseQuery("100 km to ");
    expect(parsed.unitId).toBe("kilometre");
    expect(parsed.targetId).toBeNull();
    expect(parsed.targetQuery).toBe("");
    expect(parsed.awaitingTarget).toBe(true);
  });

  test("hands back what was typed for the target, so the page can suggest", () => {
    expect(parseQuery("100 km to mil").targetQuery).toBe("mil");
  });
});

describe("amounts written in more than one unit", () => {
  test("reads a height the way a tape measure writes it", () => {
    const parsed = parseQuery(`5'10"`);
    expect(parsed.unitId).toBe("foot");
    expect(parsed.value).toBeCloseTo(5 + 10 / 12, 10);
    expect(parsed.label).toBe("5 ft 10 in");
  });

  test("reads the same height however it is spaced or spelled", () => {
    for (const text of [`5' 10"`, "5ft 10in", "5 ft 10 in", "5′10″"]) {
      expect(`${text}: ${parseQuery(text).value.toFixed(4)}`).toBe(`${text}: ${(5 + 10 / 12).toFixed(4)}`);
    }
  });

  test("reads a length of time the way a video writes it", () => {
    const parsed = parseQuery("1h30m");
    expect(parsed.unitId).toBe("hour");
    expect(parsed.value).toBe(1.5);
    expect(parsed.label).toBe("1 h 30 min");
    expect(parseQuery("2h 15min").value).toBe(2.25);
    expect(parseQuery("1h 30m 30s").value).toBeCloseTo(1.5083333, 6);
  });

  test("reads a recipe fraction", () => {
    expect(read("1 1/2 cup")).toEqual({ value: 1.5, unit: "us-cup", target: null });
    expect(read("3/4 tsp")).toEqual({ value: 0.75, unit: "us-teaspoon", target: null });
  });

  test("reads a compound amount together with a target", () => {
    const parsed = parseQuery(`5'10" in cm`);
    expect(parsed.unitId).toBe("foot");
    expect(parsed.targetId).toBe("centimetre");
  });

  test("refuses to add up units that measure different things", () => {
    // `2h 30km` is two unrelated amounts, not one. Only the first is read.
    const parsed = parseQuery("2h 30km");
    expect(parsed.unitId).toBe("hour");
    expect(parsed.value).toBe(2);
    expect(parsed.label).toBeNull();
  });
});

describe("what the parser gives back when there is nothing to read", () => {
  test("an empty line reads as nothing at all", () => {
    for (const text of ["", "   ", null, undefined, 42]) {
      const parsed = parseQuery(text);
      expect(`${text}: ${parsed.value}/${parsed.unitId}`).toBe(`${text}: null/null`);
    }
  });

  test("a number on its own keeps the number and waits for a unit", () => {
    const parsed = parseQuery("100");
    expect(parsed.value).toBe(100);
    expect(parsed.unitId).toBeNull();
    expect(parsed.unitQuery).toBe("");
  });

  test("a word on its own is read as a unit being typed", () => {
    const parsed = parseQuery("kilo");
    expect(parsed.unitQuery).toBe("kilo");
    expect(parsed.unitId).toBe("kilogram");
    expect(parsed.value).toBe(1);
  });

  test("always hands back the line it was given", () => {
    expect(parseQuery("  100 km  ").raw).toBe("100 km");
  });

  // The page rewrites the line when a suggestion is chosen, so it needs the
  // amount on its own, without whatever target was typed after it.
  test("hands back the amount without the target", () => {
    expect(parseQuery("100 km to mi").amountText).toBe("100 km");
    expect(parseQuery("100 km").amountText).toBe("100 km");
    expect(parseQuery(`5'10" in cm`).amountText).toBe(`5'10"`);
    expect(parseQuery("").amountText).toBe("");
  });
});
