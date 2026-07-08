import { describe, test, expect } from "bun:test";
import { parseUrlState, serializeUrlState, osmRef } from "./urlState.js";

describe("parseUrlState", () => {
  test("reads q and sel", () => {
    const s = parseUrlState("?q=Passeig%20de%20Gracia&sel=way/12345");
    expect(s.q).toBe("Passeig de Gracia");
    expect(s.sel).toBe("way/12345");
  });

  test("accepts a query string with or without a leading ?", () => {
    expect(parseUrlState("q=Main+St").q).toBe("Main St");
    expect(parseUrlState("?q=Main+St").q).toBe("Main St");
  });

  test("defaults q to empty and sel to null when missing", () => {
    expect(parseUrlState("")).toEqual({ q: "", sel: null });
    expect(parseUrlState(null)).toEqual({ q: "", sel: null });
  });

  test("accepts node, way, and relation selectors", () => {
    expect(parseUrlState("?sel=node/1").sel).toBe("node/1");
    expect(parseUrlState("?sel=way/2").sel).toBe("way/2");
    expect(parseUrlState("?sel=relation/3").sel).toBe("relation/3");
  });

  test("rejects a malformed sel", () => {
    expect(parseUrlState("?sel=building/9").sel).toBe(null);
    expect(parseUrlState("?sel=way/abc").sel).toBe(null);
    expect(parseUrlState("?sel=way").sel).toBe(null);
  });

  test("trims the query", () => {
    expect(parseUrlState("?q=%20%20hi%20%20").q).toBe("hi");
  });
});

describe("serializeUrlState", () => {
  test("emits q when set", () => {
    expect(serializeUrlState({ q: "Main St" })).toContain("q=Main+St");
  });

  test("omits empty q and null sel", () => {
    expect(serializeUrlState({ q: "", sel: null })).toBe("");
    expect(serializeUrlState({})).toBe("");
  });

  test("omits a whitespace-only query", () => {
    expect(serializeUrlState({ q: "   " })).toBe("");
  });

  test("includes a valid sel and drops an invalid one", () => {
    expect(serializeUrlState({ q: "x", sel: "way/7" })).toContain("sel=way%2F7");
    expect(serializeUrlState({ q: "x", sel: "nope" })).not.toContain("sel");
  });

  test("round-trips with parseUrlState", () => {
    const original = { q: "Carrer de Balmes", sel: "way/999" };
    const parsed = parseUrlState("?" + serializeUrlState(original));
    expect(parsed).toEqual(original);
  });
});

describe("osmRef", () => {
  test("joins type and id", () => {
    expect(osmRef("way", 42)).toBe("way/42");
  });

  test("returns null for missing parts", () => {
    expect(osmRef(null, 42)).toBe(null);
    expect(osmRef("way", null)).toBe(null);
  });
});
