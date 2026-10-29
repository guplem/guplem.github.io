import { describe, expect, test } from "bun:test";
import {
  MOST_SKELETONS,
  SKELETON_FALLBACK,
  skeletonCardShape,
  skeletonColumnCounts,
  skeletonColumns,
  skeletonCount,
  skeletonFilterLabels,
} from "./skeletons.js";

describe("skeletonCount", () => {
  // The point of remembering the last count is that the placeholder is the
  // shape and the size of what arrives, so the page does not jump when it does.
  test("uses what was there last time", () => {
    expect(skeletonCount(7)).toBe(7);
    expect(skeletonCount(1)).toBe(1);
  });

  test("guesses when nothing is remembered", () => {
    expect(skeletonCount(null)).toBe(SKELETON_FALLBACK);
    expect(skeletonCount(undefined)).toBe(SKELETON_FALLBACK);
    expect(skeletonCount("lots")).toBe(SKELETON_FALLBACK);
  });

  // A reader with a hundred items does not need a hundred grey boxes to know
  // the page is working, and drawing them costs more than it says.
  test("never draws more than a screenful", () => {
    expect(skeletonCount(500)).toBe(MOST_SKELETONS);
  });

  // Zero is a real memory: last time there was nothing. Showing no placeholder
  // at all would look like the page had finished and found nothing, so the
  // page still shows one.
  test("shows one placeholder when last time held nothing", () => {
    expect(skeletonCount(0)).toBe(1);
    expect(skeletonCount(-4)).toBe(1);
  });
});

describe("skeletonColumnCounts", () => {
  // Equal columns read as a grid of grey, not as a board. A real board is
  // uneven, so the placeholder is uneven too.
  test("spreads the cards unevenly across the columns", () => {
    expect(skeletonColumnCounts(12, 6)).toEqual([3, 2, 1, 2, 4, 2]);
  });

  test("keeps about the number that was there last time", () => {
    const total = skeletonColumnCounts(12, 6).reduce((sum, count) => sum + count, 0);
    expect(total).toBeGreaterThanOrEqual(12);
    expect(total).toBeLessThanOrEqual(14);
  });

  // An empty column looks like a finished column with nothing in it.
  test("gives every column at least one card", () => {
    expect(skeletonColumnCounts(1, 6).every((count) => count >= 1)).toBe(true);
  });

  test("follows the order of the columns that are shown", () => {
    expect(skeletonColumnCounts(9, 3)).toEqual([5, 3, 2]);
    expect(skeletonColumnCounts(9, 0)).toEqual([]);
  });

  // The cap on the whole board holds here too: a busy board does not turn
  // into a wall of grey boxes.
  test("draws no more than a capped board would", () => {
    expect(skeletonColumnCounts(500, 6)).toEqual(skeletonColumnCounts(MOST_SKELETONS, 6));
  });
});

describe("skeletonColumns", () => {
  // The board remembers how many cards each column held, so each placeholder
  // column is the height the real one will be.
  test("draws what each column held last time", () => {
    const last = { items: 13, "column:todo": 8, "column:ongoing": 3, "column:needs-changes": 0 };
    expect(skeletonColumns(last, ["todo", "ongoing", "needs-changes"])).toEqual([8, 3, 0]);
  });

  // A column that was empty is drawn empty, with the dashed box the real one
  // shows, so nothing grows or shrinks when the answer lands.
  test("keeps an empty column empty", () => {
    expect(skeletonColumns({ "column:done": 0 }, ["done"])).toEqual([0]);
  });

  test("caps a busy column", () => {
    expect(skeletonColumns({ "column:todo": 90 }, ["todo"])).toEqual([MOST_SKELETONS]);
  });

  // A board saved before the columns were remembered still gets a board shape.
  test("falls back to the uneven spread when a column is not remembered", () => {
    expect(skeletonColumns({ items: 12, "column:todo": 4 }, ["todo", "ongoing"])).toEqual(skeletonColumnCounts(12, 2));
  });
});

describe("skeletonFilterLabels", () => {
  // Each placeholder button carries the real name, unseen, so it has the real
  // width, and there is one per menu that was there.
  test("uses the menus the bar held last time", () => {
    expect(skeletonFilterLabels({ menus: ["Repository", "Reviewer", "Effort"] })).toEqual([
      "Repository",
      "Reviewer",
      "Effort",
    ]);
  });

  test("guesses the menus from the counts on an older board", () => {
    expect(skeletonFilterLabels({ repositories: 2, labels: 3, milestones: 0, fields: 2 })).toEqual([
      "Repository",
      "Label",
      "Field",
      "Field",
    ]);
  });

  test("draws no menu when nothing is known", () => {
    expect(skeletonFilterLabels({})).toEqual([]);
  });
});

describe("skeletonCardShape", () => {
  // A placeholder card carries the rows most real cards carried, so it is
  // about their height.
  test("carries the rows that most cards carried", () => {
    expect(skeletonCardShape({ items: 10, withLabels: 9, withFields: 6 })).toEqual({ labels: true, fields: true });
    expect(skeletonCardShape({ items: 10, withLabels: 2, withFields: 0 })).toEqual({ labels: false, fields: false });
  });

  test("guesses a row of labels when nothing is known", () => {
    expect(skeletonCardShape({})).toEqual({ labels: true, fields: false });
  });
});

describe("skeletonCardShape for one column", () => {
  // Pull requests carry no issue fields, so a column of pull requests must not
  // draw a row of them while the column of issues beside it does.
  test("reads the column's own rows when they are remembered", () => {
    const last = { items: 10, withLabels: 10, withFields: 8, "column:ongoing": 3, "labels:ongoing": 3, "fields:ongoing": 0 };
    expect(skeletonCardShape(last, "ongoing")).toEqual({ labels: true, fields: false });
  });

  test("falls back to the whole board for a column it does not know", () => {
    const last = { items: 10, withLabels: 10, withFields: 8 };
    expect(skeletonCardShape(last, "todo")).toEqual({ labels: true, fields: true });
  });
});
