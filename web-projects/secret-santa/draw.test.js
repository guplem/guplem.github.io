// Tests for the draw: who gives a present to whom.
//
// The draw is a pure function of the event (names and forbidden pairs) and the
// seed. Every person who opens the same link must get the same answer, so these
// tests pin determinism first, then the rules a valid draw must follow.

import { describe, expect, test } from "bun:test";
import {
  drawAssignments,
  hashString,
  mulberry32,
  newSeed,
  findBlockedPeople,
  canonicalEvent,
} from "./draw.js";

const NAMES = ["Anna", "Bernat", "Carla", "David", "Elena"];

/** Check the rules any valid draw follows. */
function expectValid(names, forbidden, result) {
  expect(result).not.toBeNull();
  expect(result.length).toBe(names.length);
  // Everyone receives exactly once.
  expect(new Set(result).size).toBe(names.length);
  const banned = new Set(forbidden.map(([a, b]) => `${a}>${b}`));
  result.forEach((receiver, giver) => {
    expect(receiver).not.toBe(giver);
    expect(banned.has(`${giver}>${receiver}`)).toBe(false);
  });
}

describe("hashString and mulberry32", () => {
  test("hash the same text to the same number", () => {
    expect(hashString("hola")).toBe(hashString("hola"));
    expect(hashString("hola")).not.toBe(hashString("Hola"));
  });

  test("the generator repeats for the same seed and stays in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("newSeed", () => {
  test("makes a short URL-safe text that differs between runs", () => {
    const seeds = new Set(Array.from({ length: 50 }, () => newSeed()));
    expect(seeds.size).toBe(50);
    for (const seed of seeds) expect(seed).toMatch(/^[a-z0-9]{8}$/);
  });
});

describe("canonicalEvent", () => {
  test("ignores the order of forbidden pairs and repeats", () => {
    expect(canonicalEvent(NAMES, [[0, 1], [2, 3]], "s")).toBe(canonicalEvent(NAMES, [[2, 3], [0, 1], [0, 1]], "s"));
  });

  test("changes with every input", () => {
    const base = canonicalEvent(NAMES, [[0, 1]], "s");
    expect(canonicalEvent(NAMES, [[0, 2]], "s")).not.toBe(base);
    expect(canonicalEvent(NAMES, [[0, 1]], "t")).not.toBe(base);
    expect(canonicalEvent([...NAMES, "Fede"], [[0, 1]], "s")).not.toBe(base);
  });
});

describe("drawAssignments", () => {
  test("gives the same draw for the same names, pairs and seed", () => {
    const first = drawAssignments(NAMES, [[0, 1]], "abc12345");
    const second = drawAssignments([...NAMES], [[0, 1]], "abc12345");
    expect(second).toEqual(first);
  });

  test("gives different draws for different seeds", () => {
    const draws = new Set();
    for (let i = 0; i < 40; i++) draws.add(drawAssignments(NAMES, [], `seed${i}`).join(","));
    expect(draws.size).toBeGreaterThan(10);
  });

  test("changes when the data changes, even with the same seed", () => {
    // The seed is mixed with the event, so editing a name gives a fresh draw.
    const draws = new Set();
    for (let i = 0; i < 20; i++) {
      draws.add(drawAssignments(["A" + i, "B", "C", "D", "E"], [], "same").join(","));
    }
    expect(draws.size).toBeGreaterThan(3);
  });

  test("never lets a person give to themselves", () => {
    for (let i = 0; i < 200; i++) expectValid(NAMES, [], drawAssignments(NAMES, [], `s${i}`));
  });

  test("respects every forbidden pair", () => {
    const forbidden = [[0, 1], [1, 0], [2, 3], [3, 2], [4, 0]];
    for (let i = 0; i < 200; i++) expectValid(NAMES, forbidden, drawAssignments(NAMES, forbidden, `s${i}`));
  });

  test("finds the only possible draw when the rules leave one", () => {
    // Three people: A may only give to B, so the cycle must be A>B>C>A.
    const forbidden = [[0, 2]];
    expect(drawAssignments(["A", "B", "C"], forbidden, "x")).toEqual([1, 2, 0]);
  });

  test("works with two people", () => {
    expect(drawAssignments(["A", "B"], [], "x")).toEqual([1, 0]);
  });

  test("returns null when no draw is possible", () => {
    expect(drawAssignments(["A"], [], "x")).toBeNull();
    expect(drawAssignments(["A", "B"], [[0, 1]], "x")).toBeNull();
    // Nobody can give to C.
    expect(drawAssignments(["A", "B", "C"], [[0, 2], [1, 2]], "x")).toBeNull();
  });

  test("handles a heavily restricted large group through the fallback search", () => {
    const names = Array.from({ length: 30 }, (_, i) => `P${i}`);
    // Each person may only give to the next two people in the circle.
    const forbidden = [];
    for (let g = 0; g < 30; g++) {
      for (let r = 0; r < 30; r++) {
        if (r !== g && r !== (g + 1) % 30 && r !== (g + 2) % 30) forbidden.push([g, r]);
      }
    }
    const result = drawAssignments(names, forbidden, "big");
    expectValid(names, forbidden, result);
    expect(drawAssignments(names, forbidden, "big")).toEqual(result);
  });

  test("is close to uniform when the rules are loose", () => {
    // Four people have 9 derangements. Each should appear roughly 1/9 of the time.
    const counts = new Map();
    const runs = 4500;
    for (let i = 0; i < runs; i++) {
      const key = drawAssignments(["A", "B", "C", "D"], [], `u${i}`).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(9);
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(runs / 9 * 0.75);
      expect(n).toBeLessThan(runs / 9 * 1.25);
    }
  });
});

describe("findBlockedPeople", () => {
  test("names the givers with nobody left to give to", () => {
    expect(findBlockedPeople(3, [[0, 1], [0, 2]])).toEqual({ givers: [0], receivers: [] });
  });

  test("names the receivers nobody can give to", () => {
    expect(findBlockedPeople(3, [[0, 2], [1, 2]])).toEqual({ givers: [], receivers: [2] });
  });

  test("finds nothing when everyone has an option", () => {
    expect(findBlockedPeople(3, [[0, 1]])).toEqual({ givers: [], receivers: [] });
  });
});
