import { describe, expect, test } from "bun:test";
import {
  DEFAULT_COUNTED,
  countBoard,
  defaultCounting,
  describeBreakdown,
  describeExcluded,
  tabTitle,
} from "./counting.js";
import { COLUMN_IDS } from "./columns.js";
import { REVIEW_ROW_ID } from "./appearance.js";

const area = (id, label, keys) => ({ id, label, keys });

describe("defaultCounting", () => {
  // What a reader who has chosen nothing gets: the work that is waiting on
  // somebody, and not the work that is finished or not started (ADR 0030).
  test("counts the four areas where work is actually moving", () => {
    expect(DEFAULT_COUNTED).toEqual(["reviews", "ongoing", "needs-changes", "ready-to-merge"]);
    for (const id of DEFAULT_COUNTED) expect(defaultCounting(id).counted).toBe(true);
    for (const id of ["todo", "awaiting-review", "done"]) expect(defaultCounting(id).counted).toBe(false);
  });

  // The badges counted everything before this existed, so leaving them out by
  // default would change a number the reader already reads, without asking.
  test("every area counts what it holds until the reader says otherwise", () => {
    for (const id of [REVIEW_ROW_ID, ...COLUMN_IDS]) {
      expect(defaultCounting(id).withLowPriority).toBe(true);
    }
  });

  test("an area this build does not know still answers", () => {
    expect(defaultCounting("invented")).toEqual({ counted: false, withLowPriority: true });
  });
});

describe("countBoard", () => {
  const settings = (over = {}) => ({
    reviews: { counted: true, withLowPriority: true },
    ongoing: { counted: true, withLowPriority: true },
    todo: { counted: false, withLowPriority: true },
    ...over,
  });

  test("counts the cards in each area, and adds up the chosen ones", () => {
    const board = countBoard(
      [area("reviews", "Waiting for review", ["a"]), area("ongoing", "Ongoing", ["b", "c"]), area("todo", "To do", ["d"])],
      new Set(),
      settings(),
    );
    expect(board.total).toBe(3);
    expect(board.parts.map((one) => [one.id, one.count, one.counted])).toEqual([
      ["reviews", 1, true],
      ["ongoing", 2, true],
      ["todo", 1, false],
    ]);
  });

  // An area the reader left out still reports its own count, because the badge
  // on that column shows it (ADR 0030).
  test("an area left out of the tab name still counts itself", () => {
    const board = countBoard([area("todo", "To do", ["d", "e"])], new Set(), settings());
    expect(board.total).toBe(0);
    expect(board.parts[0].count).toBe(2);
  });

  test("work pushed down is left out where the reader asked", () => {
    const board = countBoard(
      [area("ongoing", "Ongoing", ["b", "c", "d"])],
      new Set(["c", "d"]),
      settings({ ongoing: { counted: true, withLowPriority: false } }),
    );
    expect(board.parts[0].count).toBe(1);
    expect(board.parts[0].excluded).toBe(2);
    expect(board.total).toBe(1);
  });

  test("and counted where they asked for that instead", () => {
    const board = countBoard([area("ongoing", "Ongoing", ["b", "c"])], new Set(["c"]), settings());
    expect(board.parts[0].count).toBe(2);
    expect(board.parts[0].excluded).toBe(0);
  });

  // One area's choice says nothing about another's.
  test("each area follows its own rule", () => {
    const board = countBoard(
      [area("reviews", "Reviews", ["a", "b"]), area("ongoing", "Ongoing", ["c", "d"])],
      new Set(["b", "d"]),
      settings({ ongoing: { counted: true, withLowPriority: false } }),
    );
    expect(board.parts.map((one) => [one.count, one.excluded])).toEqual([
      [2, 0],
      [1, 1],
    ]);
    expect(board.total).toBe(3);
  });

  test("an area with no settings of its own falls back to the default", () => {
    const board = countBoard([area("reviews", "Reviews", ["a"]), area("done", "Done today", ["z"])], new Set(), {});
    expect(board.total).toBe(1);
    expect(board.parts.map((one) => one.counted)).toEqual([true, false]);
  });

  test("never throws, whatever it is handed", () => {
    expect(countBoard(null, null, null)).toEqual({ total: 0, parts: [] });
    expect(countBoard([area("x", "X", null)], new Set(), {}).parts[0].count).toBe(0);
  });
});

describe("tabTitle", () => {
  // A tab reading "Work Board (0)" is a number nobody needs: there is nothing
  // to come back for.
  test("no number when there is nothing to count", () => {
    expect(tabTitle(0)).toBe("Work Board");
    expect(tabTitle(3)).toBe("Work Board (3)");
  });

  test("never throws, whatever it is handed", () => {
    expect(tabTitle(null)).toBe("Work Board");
    expect(tabTitle(-2)).toBe("Work Board");
  });
});

describe("describeBreakdown", () => {
  test("one line for each area the reader chose, and nothing else", () => {
    const parts = [
      { id: "reviews", label: "Pull requests waiting for your review", count: 1, counted: true, excluded: 0 },
      { id: "ongoing", label: "Ongoing", count: 1, counted: true, excluded: 0 },
      { id: "todo", label: "To do", count: 5, counted: false, excluded: 0 },
    ];
    expect(describeBreakdown(parts)).toBe("Pull requests waiting for your review: 1\nOngoing: 1");
  });

  test("says so when the reader counts nothing", () => {
    expect(describeBreakdown([{ id: "todo", label: "To do", count: 5, counted: false }])).toBe(
      "No parts of the board are counted. Choose them in Settings.",
    );
    expect(describeBreakdown(null)).toBe("No parts of the board are counted. Choose them in Settings.");
  });
});

describe("describeExcluded", () => {
  test("says how many were left out, and says nothing when none were", () => {
    expect(describeExcluded(1)).toBe('1 card marked "not a priority" is not counted');
    expect(describeExcluded(4)).toBe('4 cards marked "not a priority" are not counted');
    expect(describeExcluded(0)).toBe("");
    expect(describeExcluded(null)).toBe("");
  });
});
