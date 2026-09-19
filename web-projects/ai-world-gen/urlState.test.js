import { describe, expect, test } from "bun:test";
import { DEFAULT_VIEW, VIEWS, buildSearch, readStateFromSearch, readView } from "./urlState.js";

describe("readView", () => {
  test("accepts the three views and falls back to setup", () => {
    expect(VIEWS).toEqual(["setup", "ai", "map"]);
    expect(DEFAULT_VIEW).toBe("setup");
    expect(readView("map")).toBe("map");
    expect(readView("nope")).toBe("setup");
  });
});

describe("readStateFromSearch", () => {
  test("reads every field and applies the defaults", () => {
    expect(readStateFromSearch("")).toEqual({
      view: "setup",
      setting: { location: "", era: "", notes: "" },
      size: "12x12",
      order: "spiral",
    });
    expect(
      readStateFromSearch("?view=ai&location=Mars+base&era=2140&notes=quiet&size=16x16&order=frontier"),
    ).toEqual({
      view: "ai",
      setting: { location: "Mars base", era: "2140", notes: "quiet" },
      size: "16x16",
      order: "frontier",
    });
  });

  test("an unknown order or size falls back", () => {
    const state = readStateFromSearch("?order=nope&size=999x1");
    expect(state.order).toBe("spiral");
    expect(state.size).toBe("12x12");
  });

  test("a custom size in the WxH form is kept", () => {
    expect(readStateFromSearch("?size=20x10").size).toBe("20x10");
  });
});

describe("buildSearch", () => {
  test("leaves out every default, so a plain page has a plain link", () => {
    expect(buildSearch({ view: "setup", setting: { location: "", era: "", notes: "" }, size: "12x12", order: "spiral" })).toBe("");
  });

  test("writes only what differs from the default", () => {
    const search = buildSearch({
      view: "map",
      setting: { location: "A village", era: "", notes: "cosy" },
      size: "8x8",
      order: "random",
    });
    expect(search).toBe("?view=map&location=A+village&notes=cosy&size=8x8&order=random");
  });

  test("round-trips through readStateFromSearch", () => {
    const state = {
      view: "ai",
      setting: { location: "Mars & beyond", era: "2140", notes: "quiet, cold" },
      size: "24x16",
      order: "clustered",
    };
    expect(readStateFromSearch(buildSearch(state))).toEqual(state);
  });

  test("never writes an api key, whatever the state carries", () => {
    const search = buildSearch({ view: "map", apiKey: "sk-or-secret", setting: { location: "x" } });
    expect(search).not.toContain("secret");
    expect(search).not.toContain("apiKey");
  });
});
