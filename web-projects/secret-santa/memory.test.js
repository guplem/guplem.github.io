// Tests for the memory of who you are, per draw, on this device.
//
// A person who opens the same link again goes straight to their own present.
// The memory is keyed by the draw (names, exclusions and seed), not by the
// whole link, so a title edit keeps it and a new draw starts fresh.

import { describe, expect, test } from "bun:test";
import { MAX_REMEMBERED, STORAGE_KEY, drawId, forgetGiver, recallGiver, rememberGiver } from "./memory.js";

/** Just enough of `localStorage` for the tests. */
function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
}

const EVENT = { title: "Nadal", names: ["Anna", "Bernat", "Carla"], forbidden: [[0, 1]], seed: "abc12345" };

describe("drawId", () => {
  test("ignores the title and the pair order", () => {
    expect(drawId({ ...EVENT, title: "Other" })).toBe(drawId(EVENT));
    expect(drawId({ ...EVENT, forbidden: [[0, 1], [0, 1]] })).toBe(drawId(EVENT));
  });

  test("changes with a new seed, a new name or a new exclusion", () => {
    expect(drawId({ ...EVENT, seed: "zzz" })).not.toBe(drawId(EVENT));
    expect(drawId({ ...EVENT, names: ["Anna", "Bernat", "Clara"] })).not.toBe(drawId(EVENT));
    expect(drawId({ ...EVENT, forbidden: [] })).not.toBe(drawId(EVENT));
  });
});

describe("rememberGiver and recallGiver", () => {
  test("remember who you are for this draw", () => {
    const storage = fakeStorage();
    rememberGiver(storage, EVENT, 2, 1000);
    expect(recallGiver(storage, EVENT)).toBe(2);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
  });

  test("recall nothing for another draw", () => {
    const storage = fakeStorage();
    rememberGiver(storage, EVENT, 2, 1000);
    expect(recallGiver(storage, { ...EVENT, seed: "other" })).toBeNull();
  });

  test("keep one choice per draw", () => {
    const storage = fakeStorage();
    const other = { ...EVENT, seed: "other" };
    rememberGiver(storage, EVENT, 2, 1000);
    rememberGiver(storage, other, 0, 2000);
    expect(recallGiver(storage, EVENT)).toBe(2);
    expect(recallGiver(storage, other)).toBe(0);
  });

  test("recall nothing when the stored entry is damaged or out of range", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    expect(recallGiver(storage, EVENT)).toBeNull();
    storage.setItem(STORAGE_KEY, JSON.stringify({ [drawId(EVENT)]: { g: 9, at: 1 } }));
    expect(recallGiver(storage, EVENT)).toBeNull();
  });

  test("work with no storage at all", () => {
    expect(() => rememberGiver(null, EVENT, 1)).not.toThrow();
    expect(recallGiver(null, EVENT)).toBeNull();
  });

  test("keep only the most recent draws", () => {
    const storage = fakeStorage();
    for (let i = 0; i < MAX_REMEMBERED + 5; i++) rememberGiver(storage, { ...EVENT, seed: `s${i}` }, 1, i);
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(Object.keys(saved).length).toBe(MAX_REMEMBERED);
    expect(recallGiver(storage, { ...EVENT, seed: "s0" })).toBeNull();
    expect(recallGiver(storage, { ...EVENT, seed: `s${MAX_REMEMBERED + 4}` })).toBe(1);
  });
});

describe("forgetGiver", () => {
  test("forgets this draw only", () => {
    const storage = fakeStorage();
    const other = { ...EVENT, seed: "other" };
    rememberGiver(storage, EVENT, 2, 1000);
    rememberGiver(storage, other, 0, 2000);
    forgetGiver(storage, EVENT);
    expect(recallGiver(storage, EVENT)).toBeNull();
    expect(recallGiver(storage, other)).toBe(0);
  });
});
