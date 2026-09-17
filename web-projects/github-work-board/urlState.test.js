import { describe, expect, test } from "bun:test";
import { DEFAULT_SORT_ID } from "./sorting.js";
import { buildSearch, readStateFromSearch } from "./urlState.js";

describe("readStateFromSearch", () => {
  test("reads the chosen order", () => {
    expect(readStateFromSearch("?sort=title")).toEqual({ sortId: "title" });
  });

  test("an empty address bar is the default order", () => {
    expect(readStateFromSearch("")).toEqual({ sortId: DEFAULT_SORT_ID });
    expect(readStateFromSearch(null)).toEqual({ sortId: DEFAULT_SORT_ID });
    expect(readStateFromSearch(undefined)).toEqual({ sortId: DEFAULT_SORT_ID });
  });

  test("an order nobody offers is the default order", () => {
    expect(readStateFromSearch("?sort=by-vibes")).toEqual({ sortId: DEFAULT_SORT_ID });
  });

  test("ignores anything else in the address bar", () => {
    expect(readStateFromSearch("?utm_source=chat&sort=title")).toEqual({ sortId: "title" });
  });
});

describe("buildSearch", () => {
  // A link is shared and read by a person. A default that is spelled out adds
  // noise and implies a choice nobody made (root ADR 0006).
  test("leaves the default order out of the link", () => {
    expect(buildSearch({ sortId: DEFAULT_SORT_ID })).toBe("");
    expect(buildSearch({})).toBe("");
  });

  test("writes a chosen order", () => {
    expect(buildSearch({ sortId: "title" })).toBe("?sort=title");
  });

  test("round-trips through the address bar", () => {
    for (const sortId of ["title", "repository", "created-asc", DEFAULT_SORT_ID]) {
      expect(readStateFromSearch(buildSearch({ sortId }))).toEqual({ sortId });
    }
  });

  // The token is the one thing that must never reach the address bar
  // (root ADR 0006, ADR 0001).
  test("writes nothing it was not asked for", () => {
    expect(buildSearch({ sortId: "title", token: "github_pat_11SECRET" })).toBe("?sort=title");
  });
});
