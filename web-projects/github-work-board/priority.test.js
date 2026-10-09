import { describe, expect, test } from "bun:test";
import {
  HIGH,
  LOW,
  NORMAL,
  PRIORITY_PATHS,
  knownPriority,
  raiseFailedChecks,
  raiseHighPriority,
  raiseHighPriorityItems,
  raiseReviewedBeforeItems,
  sinkBlocked,
  sinkLowPriority,
  sinkLowPriorityItems,
} from "./priority.js";

// A group is what the board draws: an item, and the pull requests nested in it.
const group = (key, { repository = "me/repo", head = "", base = "", number = 1 } = {}) => ({
  item: { key, kind: "pull-request", repository, number, headRefName: head, baseRefName: base },
  children: [],
});
const keys = (groups) => groups.map((one) => one.item.key);

describe("knownPriority", () => {
  test("keeps a priority the board knows", () => {
    expect(knownPriority(HIGH)).toBe(HIGH);
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

describe("raiseReviewedBeforeItems", () => {
  const item = (key, { head = "", base = "", repository = "me/repo" } = {}) => ({
    key,
    kind: "pull-request",
    repository,
    headRefName: head,
    baseRefName: base,
  });
  const keys = (items) => items.map((one) => one.key);

  // A review the reader already started is half-done work. Finishing it comes
  // before opening a new one (ADR 0042).
  test("a pull request the reader reviewed before goes to the top of the row", () => {
    const row = [item("a"), item("b"), item("c")];
    expect(keys(raiseReviewedBeforeItems(row, new Set(["c"])))).toEqual(["c", "a", "b"]);
  });

  test("the order handed in still holds inside each half", () => {
    const row = [item("a"), item("b"), item("c"), item("d")];
    expect(keys(raiseReviewedBeforeItems(row, new Set(["b", "d"])))).toEqual(["b", "d", "a", "c"]);
  });

  test("nothing reviewed before, nothing moves", () => {
    const row = [item("a"), item("b")];
    expect(keys(raiseReviewedBeforeItems(row, new Set()))).toEqual(["a", "b"]);
    expect(keys(raiseReviewedBeforeItems(row, null))).toEqual(["a", "b"]);
  });

  // Nothing in a stack merges before the one below it (ADR 0016), so a raised
  // middle card takes its whole stack up, bottom first.
  test("a re-review anywhere in a stack raises the whole stack, in merge order", () => {
    const stack = () => [
      item("one", { head: "one", base: "main" }),
      item("two", { head: "two", base: "one" }),
      item("three", { head: "three", base: "two" }),
    ];
    for (const reviewed of ["one", "two", "three"]) {
      expect(keys(raiseReviewedBeforeItems([item("other"), ...stack()], new Set([reviewed])))).toEqual([
        "one",
        "two",
        "three",
        "other",
      ]);
    }
  });

  // The reader's own mark runs after this pass, so their hand still wins
  // (ADR 0026).
  test("a card the reader pushed down stays down, even when they reviewed it before", () => {
    const row = [item("a"), item("b")];
    const raised = raiseReviewedBeforeItems(row, new Set(["b"]));
    expect(keys(sinkLowPriorityItems(raised, new Set(["b"])))).toEqual(["a", "b"]);
  });

  test("never throws, whatever it is handed", () => {
    expect(raiseReviewedBeforeItems(null, null)).toEqual([]);
    expect(raiseReviewedBeforeItems([], new Set(["a"]))).toEqual([]);
  });
});

describe("raiseFailedChecks", () => {
  // A red check no longer moves a card out of its column when somebody is
  // waited on (ADR 0011). It climbs to the top of the column instead, so the
  // work that needs a push is the first thing read there (ADR 0026).
  test("a card with a red check goes to the top", () => {
    const list = [group("a"), group("b"), group("c")];
    expect(keys(raiseFailedChecks(list, new Set(["c"])))).toEqual(["c", "a", "b"]);
  });

  test("nothing red, nothing moves", () => {
    const list = [group("a"), group("b")];
    expect(keys(raiseFailedChecks(list, new Set()))).toEqual(["a", "b"]);
    expect(keys(raiseFailedChecks(list, null))).toEqual(["a", "b"]);
  });

  test("the order the reader chose still holds inside each half", () => {
    const list = [group("a"), group("b"), group("c"), group("d")];
    expect(keys(raiseFailedChecks(list, new Set(["b", "d"])))).toEqual(["b", "d", "a", "c"]);
  });
});

describe("raiseFailedChecks and a stack", () => {
  // main <- one <- two <- three, handed in already in merge order.
  const stack = () => [
    group("one", { head: "one", base: "main", number: 1 }),
    group("two", { head: "two", base: "one", number: 2 }),
    group("three", { head: "three", base: "two", number: 3 }),
  ];

  // The whole stack travels, because nothing in it can merge before the one
  // below it. Raising a middle card over its own base would show work that
  // reads as ready and is not, which is the exact failure ADR 0016 forbids.
  test("a red check anywhere in a stack raises the whole stack, in merge order", () => {
    for (const red of ["one", "two", "three"]) {
      const order = keys(raiseFailedChecks([group("other"), ...stack()], new Set([red])));
      expect(order).toEqual(["one", "two", "three", "other"]);
    }
  });

  test("a ring of retargeted branches never hangs", () => {
    const ring = [
      group("x", { head: "x", base: "y", number: 1 }),
      group("y", { head: "y", base: "x", number: 2 }),
    ];
    expect(keys(raiseFailedChecks(ring, new Set(["x"])))).toHaveLength(2);
  });
});


describe("sinkBlocked", () => {
  // A blocked card cannot be started, so in any column the work the reader can
  // pick up now reads first.
  test("a blocked card goes below the ones that are not", () => {
    const list = [group("a"), group("b"), group("c")];
    expect(keys(sinkBlocked(list, new Set(["a"])))).toEqual(["b", "c", "a"]);
  });

  test("nothing blocked, nothing moves", () => {
    const list = [group("a"), group("b")];
    expect(keys(sinkBlocked(list, new Set()))).toEqual(["a", "b"]);
    expect(keys(sinkBlocked(list, null))).toEqual(["a", "b"]);
  });

  test("the order the reader chose still holds inside each half", () => {
    const list = [group("a"), group("b"), group("c"), group("d")];
    expect(keys(sinkBlocked(list, ["a", "c"]))).toEqual(["b", "d", "a", "c"]);
  });

  // The same reason the low-priority sink takes the top of a stack along: what
  // waits on a blocked card cannot merge first either (ADR 0016).
  test("what is stacked on a blocked card sinks with it, in merge order", () => {
    const list = [
      group("one", { head: "one", base: "main", number: 1 }),
      group("two", { head: "two", base: "one", number: 2 }),
      group("other"),
    ];
    expect(keys(sinkBlocked(list, new Set(["one"])))).toEqual(["other", "one", "two"]);
  });

  // The two sinks run one after the other, and the reader's own mark runs
  // last, so a card pushed down sits below a blocked one.
  test("a card the reader pushed down still ends up last", () => {
    const list = [group("low"), group("blocked"), group("free")];
    const order = sinkLowPriority(sinkBlocked(list, new Set(["blocked"])), new Set(["low"]));
    expect(keys(order)).toEqual(["free", "blocked", "low"]);
  });
});

describe("raiseHighPriority", () => {
  // The reader's own word that a card matters this week. In the smart order it
  // reads first in its list (ADR 0044).
  test("a card the reader raised goes to the top", () => {
    const list = [group("a"), group("b"), group("c")];
    expect(keys(raiseHighPriority(list, new Set(["c"])))).toEqual(["c", "a", "b"]);
  });

  test("nothing raised, nothing moves", () => {
    const list = [group("a"), group("b")];
    expect(keys(raiseHighPriority(list, new Set()))).toEqual(["a", "b"]);
    expect(keys(raiseHighPriority(list, null))).toEqual(["a", "b"]);
  });

  // The cards that rose keep the smart order among themselves, exactly as the
  // cards that sank do (ADR 0026).
  test("the order handed in still holds inside each half", () => {
    const list = [group("a"), group("b"), group("c"), group("d")];
    expect(keys(raiseHighPriority(list, ["b", "d"]))).toEqual(["b", "d", "a", "c"]);
  });

  // Nothing in a stack merges before the one below it (ADR 0016), so a raised
  // card takes its whole stack up, bottom first, like a red check does.
  test("a raised card anywhere in a stack raises the whole stack, in merge order", () => {
    const stack = () => [
      group("one", { head: "one", base: "main", number: 1 }),
      group("two", { head: "two", base: "one", number: 2 }),
      group("three", { head: "three", base: "two", number: 3 }),
    ];
    for (const raised of ["one", "two", "three"]) {
      expect(keys(raiseHighPriority([group("other"), ...stack()], new Set([raised])))).toEqual([
        "one",
        "two",
        "three",
        "other",
      ]);
    }
  });

  // The raise runs after the rules (the red check and the blocked sink), so the
  // reader's hand beats them: a blocked card they raised reads first.
  test("a blocked card the reader raised still reads first", () => {
    const list = [group("free"), group("blocked")];
    const order = raiseHighPriority(sinkBlocked(list, new Set(["blocked"])), new Set(["blocked"]));
    expect(keys(order)).toEqual(["blocked", "free"]);
  });

  // Inside the raised group the rules still hold: a red check reads before a
  // card that merely matters, and a blocked one reads after it.
  test("the raised cards keep the smart order among themselves", () => {
    const list = [group("blocked"), group("plain"), group("red"), group("other")];
    const ruled = sinkBlocked(raiseFailedChecks(list, new Set(["red"])), new Set(["blocked"]));
    const order = raiseHighPriority(ruled, new Set(["blocked", "plain", "red"]));
    expect(keys(order)).toEqual(["red", "plain", "blocked", "other"]);
  });

  // The two marks meet in one stack: the bottom pushed down, a top raised. The
  // sink runs last, and a pushed-down base takes everything on it down, so the
  // stack still reads bottom first (ADR 0016, ADR 0026).
  test("a raised top over a pushed-down bottom sinks with its bottom", () => {
    const list = [
      group("other"),
      group("one", { head: "one", base: "main", number: 1 }),
      group("two", { head: "two", base: "one", number: 2 }),
    ];
    const order = sinkLowPriority(raiseHighPriority(list, new Set(["two"])), new Set(["one"]));
    expect(keys(order)).toEqual(["other", "one", "two"]);
  });

  test("never throws, whatever it is handed", () => {
    expect(raiseHighPriority(null, null)).toEqual([]);
    expect(() => raiseHighPriority([{}, { item: null }], new Set(["a"]))).not.toThrow();
  });
});

describe("raiseHighPriorityItems", () => {
  const item = (key) => ({ key, kind: "pull-request", repository: "me/repo", headRefName: "", baseRefName: "" });
  const keys = (items) => items.map((one) => one.key);

  // The review row follows the same rule as a column, flat (ADR 0026).
  test("a raised review goes to the top of the row", () => {
    const row = [item("a"), item("b"), item("c")];
    expect(keys(raiseHighPriorityItems(row, new Set(["c"])))).toEqual(["c", "a", "b"]);
  });

  test("never throws, whatever it is handed", () => {
    expect(raiseHighPriorityItems(null, null)).toEqual([]);
  });
});

// One icon per priority. The menu row that sets a priority and the mark in the
// card's corner draw the same one, so the reader learns a single shape for
// each (ADR 0044).
describe("PRIORITY_PATHS", () => {
  test("every priority has its own icon", () => {
    const drawn = [HIGH, NORMAL, LOW].map((one) => PRIORITY_PATHS[one]);
    for (const paths of drawn) expect(paths.length).toBeGreaterThan(0);
    expect(new Set(drawn.map((paths) => paths.join(" "))).size).toBe(3);
  });

  // The flame is the mark ADR 0044 chose, and the menu must not invent a
  // second picture for the same mark.
  test("high priority is still the flame", () => {
    expect(PRIORITY_PATHS[HIGH][0]).toStartWith("M8.5 14.5");
  });
});
