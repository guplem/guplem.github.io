import { describe, expect, test } from "bun:test";
import {
  COLUMN_COLOURS,
  DEFAULT_COLOUR,
  DEFAULT_THEME,
  REVIEW_ROW_ID,
  THEMES,
  colourableAreas,
  knownColour,
  knownTheme,
} from "./appearance.js";
import { COLUMN_IDS } from "./columns.js";

describe("COLUMN_COLOURS", () => {
  // A colour id is written into `board.json` the moment somebody picks one, so
  // it is as permanent as a storage key or a column id (ADR 0024).
  test("these are the colours, and an id is never renamed", () => {
    expect(COLUMN_COLOURS.map((one) => one.id)).toEqual([
      "default",
      "slate",
      "blue",
      "teal",
      "green",
      "amber",
      "rose",
      "violet",
    ]);
  });

  test("every colour has something to say and, unless it is the default, something to paint", () => {
    for (const colour of COLUMN_COLOURS) {
      expect(colour.label.length).toBeGreaterThan(0);
      if (colour.id !== DEFAULT_COLOUR) expect(colour.tint).toMatch(/^\d+ \d+% \d+%$/);
    }
  });

  // Bare HSL channels, never a finished colour: every wash and every outline is
  // the same channels at a different alpha, which a hex value cannot do
  // (ADR 0004).
  test("the default paints nothing, so a board nobody touched looks as it did", () => {
    expect(COLUMN_COLOURS[0].id).toBe(DEFAULT_COLOUR);
    expect(COLUMN_COLOURS[0].tint).toBe("");
  });
});

describe("knownColour", () => {
  test("keeps a colour the board knows", () => {
    expect(knownColour("blue")).toBe("blue");
  });

  // A colour written by a newer build, or by somebody editing the file by
  // hand, must not leave a column painted with nothing.
  test("anything else is the default", () => {
    expect(knownColour("chartreuse")).toBe(DEFAULT_COLOUR);
    expect(knownColour("")).toBe(DEFAULT_COLOUR);
    expect(knownColour(null)).toBe(DEFAULT_COLOUR);
    expect(knownColour(7)).toBe(DEFAULT_COLOUR);
  });
});

describe("knownTheme", () => {
  test("keeps a theme the board knows", () => {
    expect(knownTheme("dark")).toBe("dark");
    expect(knownTheme("light")).toBe("light");
  });

  // Following the machine is the answer that is right without being asked.
  test("anything else follows the machine", () => {
    expect(DEFAULT_THEME).toBe("auto");
    expect(knownTheme("solarized")).toBe("auto");
    expect(knownTheme(null)).toBe("auto");
  });

  test("these are the themes, and an id is never renamed", () => {
    expect(THEMES.map((one) => one.id)).toEqual(["auto", "light", "dark"]);
  });
});

describe("colourableAreas", () => {
  test("the review row comes first, then every column in the order they read", () => {
    const areas = colourableAreas();
    expect(areas[0].id).toBe(REVIEW_ROW_ID);
    expect(areas.slice(1).map((one) => one.id)).toEqual(COLUMN_IDS);
  });

  // The review row's id is stored beside the column ids in one map, so it must
  // never be a column id as well.
  test("the review row's id is not a column's", () => {
    expect(COLUMN_IDS).not.toContain(REVIEW_ROW_ID);
  });

  test("every area has something to call it on screen", () => {
    for (const area of colourableAreas()) expect(area.label.length).toBeGreaterThan(0);
  });
});
