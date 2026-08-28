import { describe, test, expect } from "bun:test";
import { DEFAULT_MODE, parseUrlState, serializeUrlState } from "./urlState.js";

const PUZZLE =
  "530070000" + "600195000" + "098000060" + "800060003" + "400803001" + "700020006" + "060000280" + "000419005" + "000080079";
const DOTTED = PUZZLE.replace(/0/g, ".");

describe("parseUrlState", () => {
  test("reads a puzzle from the p parameter", () => {
    expect(parseUrlState(`?p=${PUZZLE}`).puzzle).toBe(DOTTED);
  });

  test("accepts dots as empty cells", () => {
    expect(parseUrlState(`?p=${DOTTED}`).puzzle).toBe(DOTTED);
  });

  test("returns no puzzle when the parameter is missing", () => {
    expect(parseUrlState("").puzzle).toBeNull();
    expect(parseUrlState("?m=solution").puzzle).toBeNull();
  });

  test("ignores a puzzle that is not 81 cells", () => {
    expect(parseUrlState("?p=123").puzzle).toBeNull();
    expect(parseUrlState(`?p=${PUZZLE}7`).puzzle).toBeNull();
  });

  test("ignores characters that are not digits or dots", () => {
    expect(parseUrlState(`?p=${"x".repeat(81)}`).puzzle).toBeNull();
  });

  test("reads the mode and falls back to the default", () => {
    expect(parseUrlState("?m=solution").mode).toBe("solution");
    expect(parseUrlState("?m=hint").mode).toBe("hint");
    expect(parseUrlState("").mode).toBe(DEFAULT_MODE);
    expect(parseUrlState("?m=nonsense").mode).toBe(DEFAULT_MODE);
  });
});

describe("serializeUrlState", () => {
  test("writes the puzzle with dots for empty cells", () => {
    expect(serializeUrlState({ puzzle: DOTTED })).toBe(`?p=${DOTTED}`);
  });

  test("leaves out the default mode, to keep links short", () => {
    expect(serializeUrlState({ puzzle: DOTTED, mode: DEFAULT_MODE })).toBe(`?p=${DOTTED}`);
    expect(serializeUrlState({ puzzle: DOTTED, mode: "solution" })).toBe(`?p=${DOTTED}&m=solution`);
  });

  test("returns an empty string when there is nothing to share", () => {
    expect(serializeUrlState({ puzzle: null })).toBe("");
    expect(serializeUrlState({ puzzle: ".".repeat(81) })).toBe("");
  });
});

describe("language", () => {
  test("reads the language from the link", () => {
    expect(parseUrlState("?lang=es").lang).toBe("es");
    expect(parseUrlState("?lang=en").lang).toBe("en");
  });

  test("reports no language when the link does not name one", () => {
    // Null lets the page follow the browser rather than forcing English.
    expect(parseUrlState("").lang).toBeNull();
    expect(parseUrlState("?lang=de").lang).toBeNull();
  });

  test("writes the language only when it is not the default", () => {
    expect(serializeUrlState({ puzzle: DOTTED, lang: "es" })).toBe(`?p=${DOTTED}&lang=es`);
    expect(serializeUrlState({ puzzle: DOTTED, lang: "en" })).toBe(`?p=${DOTTED}`);
  });

  test("shares the language even when the grid is empty", () => {
    expect(serializeUrlState({ puzzle: ".".repeat(81), lang: "es" })).toBe("?lang=es");
  });
});

describe("round trip", () => {
  test("what is written comes back unchanged", () => {
    for (const mode of ["hint", "solution"]) {
      for (const lang of ["en", "es"]) {
        const state = { puzzle: DOTTED, mode, lang };
        const parsed = parseUrlState(serializeUrlState(state));
        expect(parsed.puzzle).toBe(DOTTED);
        expect(parsed.mode).toBe(mode);
        // English is the default, so it is left out of the link and comes back
        // as null: the page then follows the browser, which is what we want.
        expect(parsed.lang).toBe(lang === "en" ? null : lang);
      }
    }
  });
});
