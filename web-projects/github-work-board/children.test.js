import { describe, expect, test } from "bun:test";
import { childSummary, childrenProgress, childrenToggleLabel, orderChildren } from "./children.js";

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

// The row of pills is the picture and this is the number beside it: how many
// children are closed, out of how many there are. GitHub's own summary answers
// both, so it counts every child, including the ones past the twenty the board
// asked about (ADR 0032).
describe("childrenProgress", () => {
  test("reads closed out of total, and says it as one short line", () => {
    expect(childrenProgress({ completed: 3, total: 8 })).toEqual({ done: 3, total: 8, label: "3/8" });
  });

  test("none done and all done both read", () => {
    expect(childrenProgress({ completed: 0, total: 4 }).label).toBe("0/4");
    expect(childrenProgress({ completed: 4, total: 4 }).label).toBe("4/4");
  });

  // Nothing here may invent a number: a card would state it as fact.
  test("anything that is not a pair of counts reads as nothing", () => {
    expect(childrenProgress(null)).toEqual({ done: 0, total: 0, label: "0/0" });
    expect(childrenProgress({ completed: "3", total: 8 }).done).toBe(0);
    expect(childrenProgress({ completed: -2, total: 8 }).done).toBe(0);
  });

  // A parent whose children were closed and then reopened can answer with more
  // done than there are. The card must not print "9/8".
  test("more done than there are reads as all of them", () => {
    expect(childrenProgress({ completed: 9, total: 8 }).label).toBe("8/8");
  });
});

// A pill is a few pixels wide, so the words it stands for live in its tooltip.
describe("childSummary", () => {
  test("says which issue it is and where it sits", () => {
    expect(childSummary({ item: { number: 12, title: "Upload a dataset" }, columnId: "ongoing" })).toBe(
      "#12 Upload a dataset - Ongoing",
    );
  });

  // The board asks about one batch of children, so a parent with a great many
  // has children it knows nothing about. Saying nothing beats guessing "To do".
  test("a child the board could not ask about says so", () => {
    expect(childSummary({ item: { number: 4, title: "Later" }, columnId: "" })).toBe(
      "#4 Later - the board could not ask GitHub about this one",
    );
  });

  test("never throws, whatever it is handed", () => {
    expect(childSummary(null)).toBe("");
    expect(childSummary({ item: { number: 7 }, columnId: "done" })).toBe("#7 - Done");
  });
});

describe("childrenToggleLabel", () => {
  // The list is folded away until somebody asks for it, because the pills
  // already answer "how is this going" (ADR 0032).
  test("says what the press does, and how many are in the list", () => {
    expect(childrenToggleLabel(false, 8)).toBe("Show the 8 children");
    expect(childrenToggleLabel(true, 8)).toBe("Hide the children");
  });

  test("one child is not called children", () => {
    expect(childrenToggleLabel(false, 1)).toBe("Show the one child");
  });
});
