import { describe, expect, test } from "bun:test";
import { DEFAULT_SORT_ID, SORT_OPTIONS, readSortId, sortWorkItems } from "./sorting.js";

const item = (over) => ({
  key: "k",
  kind: "issue",
  number: 1,
  title: "a title",
  repository: "me/repo",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  ...over,
});

const keys = (list) => list.map((one) => one.key);

describe("SORT_OPTIONS", () => {
  test("every option has a unique id and something to show in the dropdown", () => {
    const ids = SORT_OPTIONS.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const option of SORT_OPTIONS) {
      expect(option.id).toMatch(/^[a-z-]+$/);
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  test("the default is one of them", () => {
    expect(SORT_OPTIONS.map((option) => option.id)).toContain(DEFAULT_SORT_ID);
  });
});

describe("readSortId", () => {
  test("keeps an order the page knows", () => {
    expect(readSortId("title")).toBe("title");
  });

  // The order arrives from the address bar, where anybody can type anything.
  test("falls back to the default for anything else", () => {
    expect(readSortId("by-vibes")).toBe(DEFAULT_SORT_ID);
    expect(readSortId(null)).toBe(DEFAULT_SORT_ID);
    expect(readSortId(undefined)).toBe(DEFAULT_SORT_ID);
    expect(readSortId(7)).toBe(DEFAULT_SORT_ID);
  });
});

describe("sortWorkItems", () => {
  const older = item({ key: "older", updatedAt: "2026-09-01T00:00:00Z", createdAt: "2026-01-01T00:00:00Z" });
  const newer = item({ key: "newer", updatedAt: "2026-09-16T00:00:00Z", createdAt: "2026-08-01T00:00:00Z" });

  test("does not reorder the list it was given", () => {
    const list = [older, newer];
    sortWorkItems(list, "updated-desc");
    expect(keys(list)).toEqual(["older", "newer"]);
  });

  test("recently updated puts the newest first, and least recently reverses it", () => {
    expect(keys(sortWorkItems([older, newer], "updated-desc"))).toEqual(["newer", "older"]);
    expect(keys(sortWorkItems([older, newer], "updated-asc"))).toEqual(["older", "newer"]);
  });

  test("newest and oldest read the creation date, not the last touch", () => {
    expect(keys(sortWorkItems([older, newer], "created-desc"))).toEqual(["newer", "older"]);
    expect(keys(sortWorkItems([older, newer], "created-asc"))).toEqual(["older", "newer"]);
  });

  test("by repository groups them, then counts up within a repository", () => {
    const list = [
      item({ key: "b2", repository: "me/beta", number: 2 }),
      item({ key: "a9", repository: "me/alpha", number: 9 }),
      item({ key: "b1", repository: "me/beta", number: 1 }),
      item({ key: "a1", repository: "me/alpha", number: 1 }),
    ];
    expect(keys(sortWorkItems(list, "repository"))).toEqual(["a1", "a9", "b1", "b2"]);
  });

  test("by title ignores case, so a lower-case title is not exiled to the end", () => {
    const list = [item({ key: "z", title: "zebra" }), item({ key: "a", title: "Apple" }), item({ key: "m", title: "mango" })];
    expect(keys(sortWorkItems(list, "title"))).toEqual(["a", "m", "z"]);
  });

  test("notes first puts what you wrote about at the top, newest of those first", () => {
    const list = [older, newer, item({ key: "noted", updatedAt: "2026-01-01T00:00:00Z" })];
    expect(keys(sortWorkItems(list, "noted-first", (key) => key === "noted"))).toEqual(["noted", "newer", "older"]);
  });

  // Two items updated in the same second must not swap places between renders,
  // or the list appears to shuffle itself while it is read.
  test("settles a tie the same way every time", () => {
    const same = [item({ key: "b" }), item({ key: "a" }), item({ key: "c" })];
    expect(keys(sortWorkItems(same, "updated-desc"))).toEqual(keys(sortWorkItems([...same].reverse(), "updated-desc")));
  });

  // An item with no date is a broken answer from GitHub, not an old item. It
  // goes last whichever way round the list is sorted.
  test("puts an item with no date last, in both directions", () => {
    const undated = item({ key: "undated", updatedAt: "", createdAt: "" });
    expect(keys(sortWorkItems([undated, newer], "updated-desc")).at(-1)).toBe("undated");
    expect(keys(sortWorkItems([undated, newer], "updated-asc")).at(-1)).toBe("undated");
  });

  test("an order it does not know is the default order, not an empty list", () => {
    expect(keys(sortWorkItems([older, newer], "by-vibes"))).toEqual(["newer", "older"]);
  });

  test("survives being handed something that is not a list", () => {
    expect(sortWorkItems(null, "title")).toEqual([]);
    expect(sortWorkItems(undefined, "title")).toEqual([]);
  });
});
