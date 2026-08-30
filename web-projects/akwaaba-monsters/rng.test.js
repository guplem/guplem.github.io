import { describe, test, expect } from "bun:test";
import { Rng, mulberry32, randomSeed } from "./rng.js";

describe("mulberry32", () => {
  test("gives the same sequence for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const first = [a(), a(), a()];
    const second = [b(), b(), b()];
    expect(first).toEqual(second);
  });

  test("gives a different sequence for a different seed", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toEqual(b());
  });

  test("stays inside [0, 1)", () => {
    const next = mulberry32(999);
    for (let i = 0; i < 500; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("Rng", () => {
  test("repeats its sequence when built from the same seed", () => {
    const a = new Rng(7);
    const b = new Rng(7);
    expect([a.int(100), a.int(100)]).toEqual([b.int(100), b.int(100)]);
  });

  test("carries its position in `state`, so a save can restore it", () => {
    const original = new Rng(42);
    original.next();
    original.next();
    const restored = Rng.fromState(original.state);
    expect(restored.next()).toBe(new Rng(original.state).next());
  });

  test("int stays inside the asked range", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 300; i++) {
      const value = rng.int(6);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
    }
  });

  test("int of zero or less gives zero", () => {
    const rng = new Rng(3);
    expect(rng.int(0)).toBe(0);
    expect(rng.int(-4)).toBe(0);
  });

  test("range includes both ends", () => {
    const rng = new Rng(11);
    const seen = new Set();
    for (let i = 0; i < 400; i++) seen.add(rng.range(2, 5));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  test("range with a max below the min gives the min", () => {
    expect(new Rng(1).range(9, 4)).toBe(9);
  });

  test("percent never fires at 0 and always fires at 100", () => {
    const rng = new Rng(5);
    for (let i = 0; i < 100; i++) {
      expect(rng.percent(0)).toBe(false);
      expect(rng.percent(100)).toBe(true);
    }
  });

  test("pick returns undefined for an empty list", () => {
    expect(new Rng(1).pick([])).toBeUndefined();
  });

  test("weighted never returns a zero-weight item", () => {
    const rng = new Rng(8);
    const list = [
      { id: "never", weight: 0 },
      { id: "always", weight: 5 },
    ];
    for (let i = 0; i < 200; i++) expect(rng.weighted(list).id).toBe("always");
  });

  test("weighted follows the weights roughly", () => {
    const rng = new Rng(2024);
    const list = [
      { id: "common", weight: 9 },
      { id: "rare", weight: 1 },
    ];
    let rare = 0;
    for (let i = 0; i < 4000; i++) if (rng.weighted(list).id === "rare") rare++;
    // 10 percent of 4000 is 400. Allow a wide band; this only guards a gross bug.
    expect(rare).toBeGreaterThan(250);
    expect(rare).toBeLessThan(550);
  });

  test("weighted returns undefined for an empty list", () => {
    expect(new Rng(1).weighted([])).toBeUndefined();
  });

  test("shuffle keeps every item and leaves the original alone", () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = new Rng(77).shuffle(source);
    expect(shuffled.slice().sort((a, b) => a - b)).toEqual(source);
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("randomSeed", () => {
  test("gives a 32-bit whole number", () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });
});
