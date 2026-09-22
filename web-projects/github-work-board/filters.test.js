import { describe, expect, test } from "bun:test";
import {
  DEFAULT_KIND,
  KIND_FILTERS,
  activeFilterCount,
  availableAssignees,
  availableLabels,
  availableRepositories,
  availableReviewers,
  filterByPerson,
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

describe("by person", () => {
  const withPeople = (key, field, logins) => ({
    key,
    kind: "pull-request",
    [field]: logins.map((login) => ({ login, name: login, avatarUrl: "" })),
  });
  const keys = (list) => list.map((one) => one.key);

  // Two lists, two questions. The review row asks whose work this is, so it
  // narrows by assignee. The board asks who is in the review, so it narrows by
  // reviewer (ADR 0028).
  test("narrows a list to the work one person is on", () => {
    const row = [
      withPeople("a", "assignees", ["ana"]),
      withPeople("b", "assignees", ["leo"]),
      withPeople("c", "assignees", ["ana", "leo"]),
    ];
    expect(keys(filterByPerson(row, ["ana"], "assignees"))).toEqual(["a", "c"]);
  });

  // The rule every filter here follows: within one kind the values widen
  // (ADR 0009). Two people means either of them, never both.
  test("two people means either of them", () => {
    const row = [
      withPeople("a", "reviewers", ["ana"]),
      withPeople("b", "reviewers", ["leo"]),
      withPeople("c", "reviewers", ["sam"]),
    ];
    expect(keys(filterByPerson(row, ["ana", "leo"], "reviewers"))).toEqual(["a", "b"]);
  });

  test("nobody chosen hides nothing", () => {
    const row = [withPeople("a", "assignees", ["ana"]), withPeople("b", "assignees", [])];
    expect(keys(filterByPerson(row, [], "assignees"))).toEqual(["a", "b"]);
  });

  test("work with nobody on it is hidden once somebody is chosen", () => {
    const row = [withPeople("a", "assignees", ["ana"]), withPeople("b", "assignees", [])];
    expect(keys(filterByPerson(row, ["ana"], "assignees"))).toEqual(["a"]);
  });

  test("does not reorder or change the list it was given", () => {
    const row = [withPeople("a", "assignees", ["ana"]), withPeople("b", "assignees", ["ana"])];
    const out = filterByPerson(row, ["ana"], "assignees");
    expect(out).not.toBe(row);
    expect(keys(row)).toEqual(["a", "b"]);
  });

  test("never throws, whatever it is handed", () => {
    expect(filterByPerson(null, ["ana"], "assignees")).toEqual([]);
    expect(filterByPerson([{ key: "a" }], ["ana"], "assignees")).toEqual([]);
  });
});

describe("who a list can be narrowed by", () => {
  const person = (login) => ({ login, name: login, avatarUrl: "" });

  test("every assignee the row mentions, each once, in name order", () => {
    const row = [
      { assignees: [person("leo"), person("ana")] },
      { assignees: [person("ana")] },
      { assignees: [] },
    ];
    expect(availableAssignees(row).map((one) => one.login)).toEqual(["ana", "leo"]);
  });

  test("every reviewer the board mentions, each once", () => {
    const board = [{ reviewers: [person("sam")] }, { reviewers: [person("sam"), person("ana")] }, {}];
    expect(availableReviewers(board).map((one) => one.login)).toEqual(["ana", "sam"]);
  });

  // The chip needs a picture and a name, so the whole person comes back and
  // not only the login.
  test("each one comes back whole, so a face can be drawn", () => {
    const row = [{ assignees: [{ login: "ana", name: "Ana Diaz", avatarUrl: "u" }] }];
    expect(availableAssignees(row)).toEqual([{ login: "ana", name: "Ana Diaz", avatarUrl: "u" }]);
  });

  test("never throws, whatever it is handed", () => {
    expect(availableAssignees(null)).toEqual([]);
    expect(availableReviewers([null, 7, {}])).toEqual([]);
  });
});

describe("activeFilterCount counts the people too", () => {
  // The "clear" button appears only when something is narrowing the list. A
  // reader who narrowed by a face and nothing else still needs the way out.
  test("a person chosen counts as a narrowing", () => {
    expect(activeFilterCount({ assignees: ["ana"] })).toBe(1);
    expect(activeFilterCount({ reviewers: ["ana", "leo"] })).toBe(2);
    expect(activeFilterCount({ assignees: ["ana"], reviewers: ["leo"], labels: ["bug"] })).toBe(3);
  });

  test("nobody chosen narrows nothing", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ assignees: [], reviewers: [] })).toBe(0);
  });
});
