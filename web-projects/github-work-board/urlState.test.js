import { describe, expect, test } from "bun:test";
import { DEFAULT_KIND } from "./filters.js";
import { DEFAULT_SORT_ID } from "./sorting.js";
import { DEFAULT_VIEW, VIEWS, buildSearch, readStateFromSearch } from "./urlState.js";

const DEFAULTS = {
  sortId: DEFAULT_SORT_ID,
  view: DEFAULT_VIEW,
  kind: DEFAULT_KIND,
  repositories: [],
  labels: [],
  assignees: [],
  reviewers: [],
};

describe("the add-token view", () => {
  // Adding a token is its own screen, so the guide has room to be a
  // numbered walk-through rather than a block inside Settings (ADR 0018).
  // The name travels in the link like every other view.
  test("is a view the link can name", () => {
    expect(readStateFromSearch("?view=add-token").view).toBe("add-token");
    expect(buildSearch({ ...DEFAULTS, view: "add-token" })).toBe("?view=add-token");
  });
});

describe("readStateFromSearch", () => {
  test("reads the chosen order", () => {
    expect(readStateFromSearch("?sort=title")).toEqual({ ...DEFAULTS, sortId: "title" });
  });

  test("reads the chosen view", () => {
    expect(readStateFromSearch("?view=settings")).toEqual({ ...DEFAULTS, view: "settings" });
  });

  test("an empty address bar is the board, in the default order", () => {
    expect(readStateFromSearch("")).toEqual(DEFAULTS);
    expect(readStateFromSearch(null)).toEqual(DEFAULTS);
    expect(readStateFromSearch(undefined)).toEqual(DEFAULTS);
  });

  test("a view or an order nobody offers falls back to the default", () => {
    expect(readStateFromSearch("?sort=by-vibes")).toEqual(DEFAULTS);
    expect(readStateFromSearch("?view=admin")).toEqual(DEFAULTS);
  });

  test("ignores anything else in the address bar", () => {
    expect(readStateFromSearch("?utm_source=chat&sort=title")).toEqual({ ...DEFAULTS, sortId: "title" });
  });

  test("reads the chosen filters", () => {
    expect(readStateFromSearch("?kind=issue")).toEqual({ ...DEFAULTS, kind: "issue" });
    expect(readStateFromSearch("?repo=me%2Fa&repo=me%2Fb")).toEqual({
      ...DEFAULTS,
      repositories: ["me/a", "me/b"],
    });
    expect(readStateFromSearch("?label=bug&label=urgent")).toEqual({ ...DEFAULTS, labels: ["bug", "urgent"] });
  });

  test("a kind nobody offers is everything", () => {
    expect(readStateFromSearch("?kind=issues")).toEqual(DEFAULTS);
  });

  test("the views are exactly these", () => {
    expect(VIEWS).toEqual(["board", "settings", "add-token"]);
    expect(VIEWS).toContain(DEFAULT_VIEW);
  });
});

describe("buildSearch", () => {
  // A link is shared and read by a person. A default that is spelled out adds
  // noise and implies a choice nobody made (root ADR 0006).
  test("leaves the defaults out of the link", () => {
    expect(buildSearch({ sortId: DEFAULT_SORT_ID, view: DEFAULT_VIEW })).toBe("");
    expect(buildSearch({})).toBe("");
  });

  test("writes a chosen order and a chosen view", () => {
    expect(buildSearch({ sortId: "title" })).toBe("?sort=title");
    expect(buildSearch({ view: "settings" })).toBe("?view=settings");
    expect(buildSearch({ view: "settings", sortId: "title" })).toBe("?view=settings&sort=title");
  });

  // Root ADR 0006: one parameter per item in a list, never one comma-separated
  // value, so a repository name carrying a comma cannot break the link.
  test("writes one parameter per chosen repository and label", () => {
    expect(buildSearch({ repositories: ["me/a", "me/b"] })).toBe("?repo=me%2Fa&repo=me%2Fb");
    expect(buildSearch({ labels: ["bug", "needs review"] })).toBe("?label=bug&label=needs+review");
  });

  test("leaves an empty filter out of the link", () => {
    expect(buildSearch({ kind: DEFAULT_KIND, repositories: [], labels: [] })).toBe("");
  });

  test("round-trips a filtered board", () => {
    const state = {
      sortId: "title",
      view: "board",
      kind: "issue",
      repositories: ["me/a"],
      labels: ["bug"],
      assignees: ["ana"],
      reviewers: ["leo"],
    };
    expect(readStateFromSearch(buildSearch(state))).toEqual(state);
  });

  test("round-trips through the address bar", () => {
    for (const sortId of ["title", "repository", "created-asc", DEFAULT_SORT_ID]) {
      for (const view of VIEWS) {
        expect(readStateFromSearch(buildSearch({ sortId, view }))).toEqual({ ...DEFAULTS, sortId, view });
      }
    }
  });

  // The token is the one thing that must never reach the address bar
  // (root ADR 0006, ADR 0001).
  test("writes nothing it was not asked for", () => {
    expect(buildSearch({ sortId: "title", token: "github_pat_11SECRET" })).toBe("?sort=title");
  });
});

describe("the two person filters travel in the link (ADR 0009, ADR 0028)", () => {
  // Two filters over two different lists, so two names. A reader with both
  // chosen has both in one link, and the code, not a guess, says which list
  // each one narrows.
  test("the assignee narrows the review row, the reviewer narrows the board", () => {
    const search = buildSearch({ ...DEFAULTS, assignees: ["ana"], reviewers: ["leo"] });
    expect(search).toContain("assignee=ana");
    expect(search).toContain("reviewer=leo");
  });

  test("round-trips, one parameter per person", () => {
    const read = readStateFromSearch("?assignee=ana&assignee=leo&reviewer=sam");
    expect(read.assignees).toEqual(["ana", "leo"]);
    expect(read.reviewers).toEqual(["sam"]);
  });

  test("nobody chosen says nothing", () => {
    expect(buildSearch({ ...DEFAULTS, assignees: [], reviewers: [] })).toBe("");
    expect(readStateFromSearch("").assignees).toEqual([]);
    expect(readStateFromSearch("").reviewers).toEqual([]);
  });

  // A login cannot hold a comma today, and the board still never joins values
  // into one parameter: the rule is the encoder's, not the value's (ADR 0009).
  test("a person is encoded like every other value", () => {
    expect(buildSearch({ ...DEFAULTS, assignees: ["a b"] })).toContain("assignee=a+b");
  });
});
