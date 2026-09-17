import { describe, expect, test } from "bun:test";
import { DEFAULT_SORT_ID } from "./sorting.js";
import { DEFAULT_VIEW, VIEWS, buildSearch, readStateFromSearch } from "./urlState.js";

const DEFAULTS = { sortId: DEFAULT_SORT_ID, view: DEFAULT_VIEW };

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

  test("the views are exactly these", () => {
    expect(VIEWS).toEqual(["board", "settings"]);
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

  test("round-trips through the address bar", () => {
    for (const sortId of ["title", "repository", "created-asc", DEFAULT_SORT_ID]) {
      for (const view of VIEWS) {
        expect(readStateFromSearch(buildSearch({ sortId, view }))).toEqual({ sortId, view });
      }
    }
  });

  // The token is the one thing that must never reach the address bar
  // (root ADR 0006, ADR 0001).
  test("writes nothing it was not asked for", () => {
    expect(buildSearch({ sortId: "title", token: "github_pat_11SECRET" })).toBe("?sort=title");
  });
});
