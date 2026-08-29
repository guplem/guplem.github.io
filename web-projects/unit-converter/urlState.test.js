// Tests for the address bar as the record of what is on screen.
//
// A conversion is worth sending to someone, so the line a person typed lives in
// the URL and a shared link opens on the same answer. Root ADR 0006 is the
// reason this is a module of its own rather than a few lines in `app.js`.

import { describe, expect, test } from "bun:test";
import { buildSearch, readState } from "./urlState.js";

describe("readState", () => {
  test("reads the line, the target and the language", () => {
    expect(readState("?q=100+km&to=mile&lang=es")).toEqual({ q: "100 km", to: "mile", lang: "es" });
  });

  test("reads a line with symbols in it", () => {
    expect(readState("?q=5%2710%22").q).toBe(`5'10"`);
    expect(readState("?q=20%C2%B0C").q).toBe("20°C");
  });

  test("gives nothing for parts that are not there", () => {
    expect(readState("")).toEqual({ q: null, to: null, lang: null });
    expect(readState("?q=100+km")).toEqual({ q: "100 km", to: null, lang: null });
  });

  test("refuses a target that names no unit, rather than passing it on", () => {
    expect(readState("?q=100+km&to=not-a-unit").to).toBeNull();
  });

  test("refuses a language the page does not speak", () => {
    expect(readState("?lang=kl").lang).toBeNull();
    expect(readState("?lang=en").lang).toBe("en");
  });

  test("ignores an empty value rather than treating it as a line", () => {
    expect(readState("?q=&to=").q).toBeNull();
  });

  test("survives a search string that is not one", () => {
    expect(readState(null)).toEqual({ q: null, to: null, lang: null });
    expect(readState(42)).toEqual({ q: null, to: null, lang: null });
  });
});

describe("buildSearch", () => {
  test("writes what there is to write", () => {
    expect(buildSearch({ q: "100 km", to: "mile", lang: "es" })).toBe("?q=100+km&to=mile&lang=es");
  });

  test("leaves out what is empty, so a plain conversion gets a short link", () => {
    expect(buildSearch({ q: "100 km" })).toBe("?q=100+km");
    expect(buildSearch({ q: "100 km", to: null, lang: null })).toBe("?q=100+km");
  });

  test("leaves out the language when it is the one the page starts in", () => {
    expect(buildSearch({ q: "1 m", lang: "en" })).toBe("?q=1+m");
  });

  test("gives an empty string when there is nothing to record", () => {
    expect(buildSearch({})).toBe("");
    expect(buildSearch({ q: "  " })).toBe("");
    expect(buildSearch(null)).toBe("");
  });

  test("comes back out of readState the way it went in", () => {
    for (const q of ["100 km", `5'10"`, "20°C", "1 1/2 cup", "1.234,56 €"]) {
      expect(`${q}: ${readState(buildSearch({ q, to: "metre" })).q}`).toBe(`${q}: ${q}`);
    }
  });
});
