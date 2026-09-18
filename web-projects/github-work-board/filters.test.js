import { describe, expect, test } from "bun:test";
import {
  DEFAULT_KIND,
  KIND_FILTERS,
  activeFilterCount,
  availableLabels,
  availableRepositories,
  filterWorkItems,
  readKind,
  toggleInList,
} from "./filters.js";

const item = (over = {}) => ({
  key: "k",
  kind: "issue",
  number: 1,
  title: "a title",
  repository: "me/alpha",
  labels: [],
  ...over,
});

const ISSUE = item({ key: "i", kind: "issue", repository: "me/alpha", labels: [{ name: "bug", color: "" }] });
const PULL = item({ key: "p", kind: "pull-request", repository: "me/beta", labels: [{ name: "chore", color: "" }] });
const BOTH = item({
  key: "b",
  kind: "issue",
  repository: "me/beta",
  labels: [
    { name: "bug", color: "" },
    { name: "urgent", color: "" },
  ],
});

const keys = (list) => list.map((one) => one.key);

describe("KIND_FILTERS", () => {
  test("every kind has a unique id and a label for the button", () => {
    const ids = KIND_FILTERS.map((one) => one.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const kind of KIND_FILTERS) expect(kind.label.length).toBeGreaterThan(0);
  });

  test("the default shows everything", () => {
    expect(DEFAULT_KIND).toBe("all");
    expect(KIND_FILTERS.map((one) => one.id)).toContain(DEFAULT_KIND);
  });
});

describe("readKind", () => {
  test("keeps a kind the page knows", () => {
    expect(readKind("pull-request")).toBe("pull-request");
  });

  // The kind arrives from the address bar, where anybody can type anything.
  test("falls back to the default for anything else", () => {
    expect(readKind("issues")).toBe(DEFAULT_KIND);
    expect(readKind(null)).toBe(DEFAULT_KIND);
    expect(readKind(7)).toBe(DEFAULT_KIND);
  });
});

describe("filterWorkItems", () => {
  const all = [ISSUE, PULL, BOTH];

  test("with nothing chosen, nothing is hidden", () => {
    expect(keys(filterWorkItems(all, {}))).toEqual(["i", "p", "b"]);
    expect(keys(filterWorkItems(all, { kind: "all", repositories: [], labels: [] }))).toEqual(["i", "p", "b"]);
  });

  test("by kind", () => {
    expect(keys(filterWorkItems(all, { kind: "issue" }))).toEqual(["i", "b"]);
    expect(keys(filterWorkItems(all, { kind: "pull-request" }))).toEqual(["p"]);
  });

  test("by repository, keeping anything in any chosen repository", () => {
    expect(keys(filterWorkItems(all, { repositories: ["me/beta"] }))).toEqual(["p", "b"]);
    expect(keys(filterWorkItems(all, { repositories: ["me/alpha", "me/beta"] }))).toEqual(["i", "p", "b"]);
  });

  // Two labels chosen means "either of these", not "both of these". Somebody
  // narrowing a board wants to widen the net, not empty it.
  test("by label, keeping anything carrying any chosen label", () => {
    expect(keys(filterWorkItems(all, { labels: ["bug"] }))).toEqual(["i", "b"]);
    expect(keys(filterWorkItems(all, { labels: ["bug", "chore"] }))).toEqual(["i", "p", "b"]);
    expect(keys(filterWorkItems(all, { labels: ["urgent"] }))).toEqual(["b"]);
  });

  // Across the kinds of filter it is the other way round: each one narrows.
  test("two kinds of filter together narrow the list", () => {
    expect(keys(filterWorkItems(all, { kind: "issue", repositories: ["me/beta"] }))).toEqual(["b"]);
    expect(keys(filterWorkItems(all, { kind: "issue", labels: ["chore"] }))).toEqual([]);
  });

  test("a chosen repository or label that nothing carries empties the list", () => {
    expect(filterWorkItems(all, { repositories: ["me/gone"] })).toEqual([]);
    expect(filterWorkItems(all, { labels: ["nope"] })).toEqual([]);
  });

  test("does not reorder or change the list it was given", () => {
    const list = [...all];
    filterWorkItems(list, { kind: "issue" });
    expect(keys(list)).toEqual(["i", "p", "b"]);
  });

  test("survives being handed something that is not a list", () => {
    expect(filterWorkItems(null, { kind: "issue" })).toEqual([]);
    expect(filterWorkItems(undefined, {})).toEqual([]);
  });
});

describe("availableRepositories and availableLabels", () => {
  test("offer each one once, in a readable order", () => {
    expect(availableRepositories([PULL, ISSUE, BOTH])).toEqual(["me/alpha", "me/beta"]);
    expect(availableLabels([PULL, ISSUE, BOTH])).toEqual(["bug", "chore", "urgent"]);
  });

  test("ignore an item with nothing to offer", () => {
    expect(availableRepositories([item({ repository: "" })])).toEqual([]);
    expect(availableLabels([item({ labels: [] })])).toEqual([]);
    expect(availableLabels(null)).toEqual([]);
    expect(availableRepositories(null)).toEqual([]);
  });
});

describe("toggleInList", () => {
  test("adds what is missing and removes what is there", () => {
    expect(toggleInList([], "bug")).toEqual(["bug"]);
    expect(toggleInList(["bug"], "bug")).toEqual([]);
    expect(toggleInList(["bug"], "chore")).toEqual(["bug", "chore"]);
  });

  test("leaves the list it was given alone", () => {
    const list = ["bug"];
    toggleInList(list, "chore");
    expect(list).toEqual(["bug"]);
  });
});

describe("activeFilterCount", () => {
  // The "clear" button appears only when there is something to clear, so this
  // number decides whether the reader sees a way out of an empty list.
  test("counts every narrowing in force", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ kind: "all", repositories: [], labels: [] })).toBe(0);
    expect(activeFilterCount({ kind: "issue" })).toBe(1);
    expect(activeFilterCount({ kind: "issue", repositories: ["a"], labels: ["b", "c"] })).toBe(4);
  });
});
