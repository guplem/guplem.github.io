// Tests for how numbers reach the screen.
//
// A converter is judged on its numbers, and the two ways to get them wrong are
// noise (`0.30480000000000004 m`) and lost meaning (`1,073,742,000` for a
// gibibyte that is exactly 1073741824 bytes). The rules below aim at both.

import { describe, expect, test } from "bun:test";
import { formatCompound, formatNumber, formatPlain, formatPlainValue, formatValue } from "./format.js";
import { unitById } from "./units.js";

describe("formatNumber", () => {
  test("writes an everyday number the way a reader expects", () => {
    expect(formatNumber(62.13711922373339, "en")).toBe("62.13712");
    expect(formatNumber(1609.344, "en")).toBe("1,609.344");
    expect(formatNumber(100000, "en")).toBe("100,000");
    expect(formatNumber(0.0254, "en")).toBe("0.0254");
    expect(formatNumber(1, "en")).toBe("1");
  });

  test("never leaves the noise that floating point adds", () => {
    expect(formatNumber(0.1 + 0.2, "en")).toBe("0.3");
    expect(formatNumber(0.30480000000000004, "en")).toBe("0.3048");
  });

  test("keeps a whole number whole, however long it is", () => {
    // A gibibyte is exactly 1073741824 bytes. Rounding it to seven significant
    // digits would print a number that is not the answer.
    expect(formatNumber(1073741824, "en")).toBe("1,073,741,824");
    expect(formatNumber(1e12, "en")).toBe("1,000,000,000,000");
  });

  test("keeps the whole part of a big number rather than its decimals", () => {
    expect(formatNumber(9460730472580.8, "en")).toBe("9,460,730,472,581");
  });

  test("uses powers of ten once a number stops being readable", () => {
    expect(formatNumber(1e15, "en")).toBe("1 × 10¹⁵");
    expect(formatNumber(9.4607e18, "en")).toBe("9.4607 × 10¹⁸");
    expect(formatNumber(1.23e-9, "en")).toBe("1.23 × 10⁻⁹");
    // Just inside the readable range, so it stays as digits.
    expect(formatNumber(0.0001, "en")).toBe("0.0001");
  });

  test("keeps the sign", () => {
    expect(formatNumber(-40, "en")).toBe("-40");
    expect(formatNumber(-0.5, "en")).toBe("-0.5");
  });

  test("writes zero as zero, not as a power of ten", () => {
    expect(formatNumber(0, "en")).toBe("0");
    expect(formatNumber(-0, "en")).toBe("0");
  });

  test("follows the reader's language for the decimal mark and the grouping", () => {
    expect(formatNumber(1609.344, "es")).toBe("1609,344");
    expect(formatNumber(100000, "es")).toBe("100.000");
    expect(formatNumber(1.23e-9, "es")).toBe("1,23 × 10⁻⁹");
  });

  test("says nothing for a number that is not one", () => {
    expect(formatNumber(Number.NaN, "en")).toBe("");
    expect(formatNumber(Number.POSITIVE_INFINITY, "en")).toBe("");
    expect(formatNumber("12", "en")).toBe("");
    expect(formatNumber(null, "en")).toBe("");
  });
});

describe("formatPlain, the value that lands on the clipboard", () => {
  test("drops the grouping, because a spreadsheet cannot read it", () => {
    expect(formatPlain(1609.344)).toBe("1609.344");
    expect(formatPlain(1073741824)).toBe("1073741824");
    expect(formatPlain(100000)).toBe("100000");
  });

  test("keeps the decimal point a point, whatever the reader's language", () => {
    expect(formatPlain(62.13711922373339)).toBe("62.13712");
  });

  test("shows the same digits the screen shows, so nothing changes on paste", () => {
    expect(formatPlain(0.1 + 0.2)).toBe("0.3");
    expect(formatPlain(9460730472580.8)).toBe("9460730472581");
  });

  test("writes a very small or very large number in a form a spreadsheet reads", () => {
    expect(formatPlain(1.23e-9)).toBe("1.23e-9");
    expect(formatPlain(1e15)).toBe("1e+15");
  });

  test("says nothing for a number that is not one", () => {
    expect(formatPlain(Number.NaN)).toBe("");
    expect(formatPlain(null)).toBe("");
  });
});

describe("formatValue, which knows what kind of thing the number is", () => {
  const euro = unitById("eur");
  const metre = unitById("metre");

  test("writes money to the cent, because that is how a price is written", () => {
    expect(formatValue(215.337, euro, "en")).toBe("215.34");
    expect(formatValue(1683.598, euro, "en")).toBe("1,683.60");
    expect(formatValue(250, euro, "en")).toBe("250.00");
  });

  test("keeps the digits of an amount too small to have cents", () => {
    // A hundred Indonesian rupiah is a fraction of a cent. `0.01` would be a lie
    // and `0.00` would be useless, so a small amount keeps its digits.
    expect(formatValue(0.0052, euro, "en")).toBe("0.0052");
    expect(formatValue(0, euro, "en")).toBe("0");
  });

  test("leaves every other kind of number alone", () => {
    expect(formatValue(1609.344, metre, "en")).toBe(formatNumber(1609.344, "en"));
    expect(formatValue(0.1 + 0.2, metre, "en")).toBe("0.3");
  });

  test("follows the reader's language", () => {
    expect(formatValue(1683.598, euro, "es")).toBe("1683,60");
  });

  test("says nothing for a number that is not one, or no unit at all", () => {
    expect(formatValue(Number.NaN, euro, "en")).toBe("");
    expect(formatValue(12, null, "en")).toBe("12");
  });

  test("puts the same digits on the clipboard as on the screen", () => {
    expect(formatPlainValue(1683.598, euro)).toBe("1683.60");
    expect(formatPlainValue(1609.344, metre)).toBe("1609.344");
    expect(formatPlainValue(0.0052, euro)).toBe("0.0052");
  });
});

describe("formatCompound, the second reading under a value", () => {
  test("reads feet as feet and inches, which is how people say a height", () => {
    expect(formatCompound(5.8399, "foot", "en")).toBe("5′ 10.1″");
    expect(formatCompound(5.5, "foot", "en")).toBe("5′ 6″");
    expect(formatCompound(-5.5, "foot", "en")).toBe("-5′ 6″");
  });

  test("rolls up to the next foot rather than printing twelve inches", () => {
    expect(formatCompound(5.99999, "foot", "en")).toBe("6′ 0″");
  });

  test("reads inches as the fraction a tape measure shows", () => {
    expect(formatCompound(0.75, "inch", "en")).toBe("3/4″");
    expect(formatCompound(1.5, "inch", "en")).toBe("1 1/2″");
    expect(formatCompound(0.0625, "inch", "en")).toBe("1/16″");
    expect(formatCompound(3.26, "inch", "en")).toBe("3 1/4″");
  });

  test("reads a duration as the parts a person would say", () => {
    expect(formatCompound(1.5, "hour", "en")).toBe("1 h 30 min");
    expect(formatCompound(90, "minute", "en")).toBe("1 h 30 min");
    expect(formatCompound(3661, "second", "en")).toBe("1 h 1 min 1 s");
    expect(formatCompound(2.5, "day", "en")).toBe("2 d 12 h");
  });

  test("stays quiet when the second reading would only repeat the first", () => {
    expect(formatCompound(30, "minute", "en")).toBeNull();
    expect(formatCompound(2, "hour", "en")).toBeNull();
    // Six whole feet is already "6 ft", and two whole inches is already "2 in".
    expect(formatCompound(6, "foot", "en")).toBeNull();
    expect(formatCompound(2, "inch", "en")).toBeNull();
    expect(formatCompound(100, "kilometre", "en")).toBeNull();
    expect(formatCompound(5, "celsius", "en")).toBeNull();
  });

  test("stays quiet when the number is too big or too small for a second reading to help", () => {
    expect(formatCompound(0.0001, "hour", "en")).toBeNull();
    expect(formatCompound(1e7, "foot", "en")).toBeNull();
    expect(formatCompound(1200, "inch", "en")).toBeNull();
  });

  test("follows the reader's language for the decimal mark", () => {
    expect(formatCompound(5.8399, "foot", "es")).toBe("5′ 10,1″");
  });

  test("says nothing for a number that is not one, or a unit it does not know", () => {
    expect(formatCompound(Number.NaN, "foot", "en")).toBeNull();
    expect(formatCompound(1, "no-such-unit", "en")).toBeNull();
  });
});
