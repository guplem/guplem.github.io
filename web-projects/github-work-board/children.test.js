import { describe, expect, test } from "bun:test";
import { CHILDREN_SHOWN, orderChildren } from "./children.js";

const row = (number, columnId) => ({ item: { key: `I_${number}`, number }, columnId });

describe("orderChildren", () => {
  // The order answers "what wants me", not "how far along is this". A parent
  // with ten children not started and one whose review asked for changes must
  // not hide the one with work to do (ADR 0032).
  test("puts the work that wants a person first, and finished work last", () => {
    const rows = [
      row(1, "done"),
      row(2, "todo"),
      row(3, "ongoing"),
      row(4, "awaiting-review"),
      row(5, "ready-to-merge"),
      row(6, "needs-changes"),
    ];
    expect(orderChildren(rows).map((one) => one.item.number)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  // A child the board could not ask GitHub about has no column at all. It is
  // not finished work, so it does not go last, and it is not work anybody can
  // act on either, so it does not go first.
  test("a child with no column sits before the finished work", () => {
    const rows = [row(1, "done"), row(2, ""), row(3, "todo")];
    expect(orderChildren(rows).map((one) => one.item.number)).toEqual([3, 2, 1]);
  });

  // GitHub answers in the order somebody arranged the children in, and that is
  // the only order anybody chose by hand.
  test("two children in the same state keep the order GitHub gave", () => {
    const rows = [row(1, "todo"), row(2, "todo"), row(3, "todo")];
    expect(orderChildren(rows).map((one) => one.item.number)).toEqual([1, 2, 3]);
  });

  test("the list handed in is never changed", () => {
    const rows = [row(1, "done"), row(2, "needs-changes")];
    orderChildren(rows);
    expect(rows.map((one) => one.item.number)).toEqual([1, 2]);
  });

  test("never throws, whatever it is handed", () => {
    expect(orderChildren(null)).toEqual([]);
    expect(orderChildren([null, 7])).toEqual([]);
    expect(orderChildren([{ item: null, columnId: "todo" }])).toEqual([]);
  });
});

describe("how many are shown", () => {
  // Enough to read at a glance from a column, and few enough that a card with
  // twenty children is still a card (ADR 0032).
  test("a card shows a handful, and the rest are one press away", () => {
    expect(CHILDREN_SHOWN).toBeGreaterThanOrEqual(3);
    expect(CHILDREN_SHOWN).toBeLessThanOrEqual(6);
  });
});
