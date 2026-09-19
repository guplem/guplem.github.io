import { describe, expect, test } from "bun:test";
import { hashCoordinate, mulberry32, seedFromText } from "./random.js";

describe("mulberry32", () => {
  test("the same seed gives the same sequence", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  test("every value is in [0, 1)", () => {
    const next = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  test("two seeds give two sequences", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("seedFromText", () => {
  test("is stable and differs between texts", () => {
    expect(seedFromText("medieval village")).toBe(seedFromText("medieval village"));
    expect(seedFromText("medieval village")).not.toBe(seedFromText("space station"));
  });

  test("an empty text still gives a number", () => {
    expect(Number.isInteger(seedFromText(""))).toBe(true);
  });
});

describe("hashCoordinate", () => {
  test("is stable for one cell and spreads across neighbours", () => {
    expect(hashCoordinate(3, 4)).toBe(hashCoordinate(3, 4));
    const values = new Set([hashCoordinate(0, 0), hashCoordinate(1, 0), hashCoordinate(0, 1), hashCoordinate(1, 1)]);
    expect(values.size).toBeGreaterThan(1);
  });

  test("is a non-negative integer", () => {
    expect(hashCoordinate(10, 20)).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hashCoordinate(10, 20))).toBe(true);
  });
});
