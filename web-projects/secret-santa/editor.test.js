// Tests for the list editor: the pure changes the create screen makes.
//
// Forbidden pairs point at people by their place in the list, so removing a
// person must renumber every pair after them. That is easy to get wrong.

import { describe, expect, test } from "bun:test";
import { addPeople, removePerson, toggleForbidden, isForbidden, forbiddenFor } from "./editor.js";

const draft = () => ({ title: "", names: ["Anna", "Bernat", "Carla", "David"], forbidden: [[0, 1], [1, 0], [3, 2]] });

describe("addPeople", () => {
  test("adds cleaned names at the end and skips repeats", () => {
    expect(addPeople(draft(), "Elena, anna").names).toEqual(["Anna", "Bernat", "Carla", "David", "Elena"]);
  });

  test("does not change the draft it is given", () => {
    const before = draft();
    addPeople(before, "Elena");
    expect(before.names.length).toBe(4);
  });
});

describe("removePerson", () => {
  test("drops their pairs and renumbers the pairs after them", () => {
    const after = removePerson(draft(), 1);
    expect(after.names).toEqual(["Anna", "Carla", "David"]);
    expect(after.forbidden).toEqual([[2, 1]]);
  });
});

describe("toggleForbidden", () => {
  test("adds one direction when not mutual", () => {
    const after = toggleForbidden(draft(), 0, 2, false);
    expect(isForbidden(after, 0, 2)).toBe(true);
    expect(isForbidden(after, 2, 0)).toBe(false);
  });

  test("adds both directions when mutual", () => {
    const after = toggleForbidden(draft(), 0, 2, true);
    expect(isForbidden(after, 0, 2)).toBe(true);
    expect(isForbidden(after, 2, 0)).toBe(true);
  });

  test("removes the pair, and its mirror when mutual", () => {
    const after = toggleForbidden(draft(), 0, 1, true);
    expect(isForbidden(after, 0, 1)).toBe(false);
    expect(isForbidden(after, 1, 0)).toBe(false);
    const oneWay = toggleForbidden(draft(), 0, 1, false);
    expect(isForbidden(oneWay, 0, 1)).toBe(false);
    expect(isForbidden(oneWay, 1, 0)).toBe(true);
  });

  test("ignores a person paired with themselves", () => {
    expect(toggleForbidden(draft(), 2, 2, true).forbidden).toEqual(draft().forbidden);
  });
});

describe("forbiddenFor", () => {
  test("lists who a giver may not give to, in list order", () => {
    const d = { ...draft(), forbidden: [[0, 3], [0, 1]] };
    expect(forbiddenFor(d, 0)).toEqual([1, 3]);
    expect(forbiddenFor(d, 2)).toEqual([]);
  });
});
