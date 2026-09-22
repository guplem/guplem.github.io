import { describe, expect, test } from "bun:test";
import { LOW, NORMAL, knownPriority, sinkLowPriority, sinkLowPriorityItems } from "./priority.js";

// A group is what the board draws: an item, and the pull requests nested in it.
const group = (key, { repository = "me/repo", head = "", base = "", number = 1 } = {}) => ({
  item: { key, kind: "pull-request", repository, number, headRefName: head, baseRefName: base },
  children: [],
});
const keys = (groups) => groups.map((one) => one.item.key);

describe("knownPriority", () => {
  test("keeps a priority the board knows", () => {
    expect(knownPriority(LOW)).toBe(LOW);
    expect(knownPriority(NORMAL)).toBe(NORMAL);
  });

  // A value written by a newer build, or by somebody editing the file by hand,
  // must never leave a card faint for a reason nobody can undo.
  test("anything else is the ordinary one", () => {
    expect(knownPriority("urgent")).toBe(NORMAL);
    expect(knownPriority("")).toBe(NORMAL);
    expect(knownPriority(null)).toBe(NORMAL);
    expect(knownPriority(3)).toBe(NORMAL);
  });
});

describe("sinkLowPriority", () => {
  test("nothing marked, nothing moves", () => {
    const list = [group("a"), group("b"), group("c")];
    expect(keys(sinkLowPriority(list, new Set()))).toEqual(["a", "b", "c"]);
  });

  test("a marked card goes to the bottom", () => {
    const list = [group("a"), group("b"), group("c")];
    expect(keys(sinkLowPriority(list, new Set(["a"])))).toEqual(["b", "c", "a"]);
  });

  // The reader asked for one order and then pushed some cards down. The order
  // they asked for still decides both halves.
  test("the order the reader chose still holds inside each half", () => {
    const list = [group("a"), group("b"), group("c"), group("d")];
    expect(keys(sinkLowPriority(list, new Set(["a", "c"])))).toEqual(["b", "d", "a", "c"]);
  });

  test("a set, a list of keys, or nothing at all", () => {
    const list = [group("a"), group("b")];
    expect(keys(sinkLowPriority(list, ["a"]))).toEqual(["b", "a"]);
    expect(keys(sinkLowPriority(list, null))).toEqual(["a", "b"]);
  });
});

describe("sinkLowPriority and a stack", () => {
  // main <- one <- two <- three, handed in already in merge order.
  const stack = () => [
    group("one", { head: "one", base: "main", number: 1 }),
    group("two", { head: "two", base: "one", number: 2 }),
    group("three", { head: "three", base: "two", number: 3 }),
  ];

  // Nothing above it can merge until it does, so leaving the rest at the top
  // would show work that reads as ready and is not (ADR 0016).
  test("marking the bottom sinks the whole stack, still in merge order", () => {
    const list = [...stack(), group("other")];
    expect(keys(sinkLowPriority(list, new Set(["one"])))).toEqual(["other", "one", "two", "three"]);
  });

  test("marking the middle sinks it and everything waiting on it", () => {
    const list = [...stack(), group("other")];
    expect(keys(sinkLowPriority(list, new Set(["two"])))).toEqual(["one", "other", "two", "three"]);
  });

  // The whole point of ADR 0016 survives the sink: read the list from the top
  // and you still meet a stack bottom first, wherever its parts ended up.
  test("a stack still reads bottom first, whatever is marked", () => {
    for (const marked of ["one", "two", "three"]) {
      const order = keys(sinkLowPriority([...stack(), group("other")], new Set([marked])));
      expect(order.indexOf("one")).toBeLessThan(order.indexOf("two"));
      expect(order.indexOf("two")).toBeLessThan(order.indexOf("three"));
    }
  });

  test("marking the top moves only the top", () => {
    const list = [...stack(), group("other")];
    expect(keys(sinkLowPriority(list, new Set(["three"])))).toEqual(["one", "two", "other", "three"]);
  });

  // A pull request retargeted at one that targets it back has no bottom. It
  // must not hang the page, and it must not lose a card.
  test("a ring of retargeted branches never hangs", () => {
    const ring = [
      group("x", { head: "x", base: "y" }),
      group("y", { head: "y", base: "x" }),
    ];
    const order = keys(sinkLowPriority(ring, new Set(["x"])));
    expect(order.sort()).toEqual(["x", "y"]);
  });
});

describe("sinkLowPriority never loses work", () => {
  test("the same cards come back, every time", () => {
    const list = [group("a"), group("b", { head: "b", base: "a" }), group("c")];
    for (const marked of [[], ["a"], ["b"], ["c"], ["a", "b", "c"]]) {
      const out = sinkLowPriority(list, new Set(marked));
      expect(out.length).toBe(list.length);
      expect(new Set(out)).toEqual(new Set(list));
    }
  });

  test("the list handed in is never changed", () => {
    const list = [group("a"), group("b")];
    sinkLowPriority(list, new Set(["a"]));
    expect(keys(list)).toEqual(["a", "b"]);
  });

  test("never throws, whatever it is handed", () => {
    expect(sinkLowPriority(null, null)).toEqual([]);
    expect(sinkLowPriority(undefined, new Set(["a"]))).toEqual([]);
    expect(() => sinkLowPriority([{}, { item: null }], new Set(["a"]))).not.toThrow();
  });
});

describe("sinkLowPriorityItems", () => {
  const item = (key, { head = "", base = "", repository = "me/repo" } = {}) => ({
    key,
    kind: "pull-request",
    repository,
    headRefName: head,
    baseRefName: base,
  });
  const keys = (items) => items.map((one) => one.key);

  // The row of pull requests waiting on the reader is flat, not the grouped
  // board. It sorts by the same rules, so it sinks by them too (ADR 0026).
  test("a marked card goes to the bottom of the row", () => {
    const row = [item("a"), item("b"), item("c")];
    expect(keys(sinkLowPriorityItems(row, new Set(["a"])))).toEqual(["b", "c", "a"]);
  });

  test("nothing marked, nothing moves", () => {
    const row = [item("a"), item("b")];
    expect(keys(sinkLowPriorityItems(row, new Set()))).toEqual(["a", "b"]);
  });

  // The same rule the board follows: what waits on a sunk card cannot be
  // picked up either, so it goes down with it (ADR 0016).
  test("a pull request stacked on a marked one sinks with it", () => {
    const row = [
      item("one", { head: "one", base: "main" }),
      item("two", { head: "two", base: "one" }),
      item("three", { head: "three", base: "two" }),
      item("other"),
    ];
    expect(keys(sinkLowPriorityItems(row, new Set(["two"])))).toEqual(["one", "other", "two", "three"]);
  });

  test("never drops one, and never changes the row handed in", () => {
    const row = [item("a"), item("b")];
    const out = sinkLowPriorityItems(row, new Set(["a"]));
    expect(out.length).toBe(2);
    expect(keys(row)).toEqual(["a", "b"]);
  });

  test("never throws, whatever it is handed", () => {
    expect(sinkLowPriorityItems(null, null)).toEqual([]);
    expect(sinkLowPriorityItems([], new Set(["a"]))).toEqual([]);
  });
});
