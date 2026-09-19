import { describe, expect, test } from "bun:test";
import { DEFAULT_STYLE_ID, STYLE_GLYPHS, VISUAL_STYLES, glyphFor, readStyleId } from "./tileStyles.js";
import { VISUAL_TAGS, visualTagNames } from "./tileset.js";

describe("the style list", () => {
  test("names the styles, each with a label and a description, and the sprite sheet is the default", () => {
    expect(VISUAL_STYLES.map((one) => one.id)).toEqual(["urizen", "emoji", "roguelike", "blocks"]);
    expect(DEFAULT_STYLE_ID).toBe("urizen");
    for (const style of VISUAL_STYLES) {
      expect(style.label.length).toBeGreaterThan(0);
      expect(style.description.length).toBeGreaterThan(0);
    }
  });

  test("readStyleId falls back to the default", () => {
    expect(readStyleId("emoji")).toBe("emoji");
    expect(readStyleId("nope")).toBe(DEFAULT_STYLE_ID);
    expect(readStyleId(undefined)).toBe(DEFAULT_STYLE_ID);
  });
});

describe("the glyph table", () => {
  test("has one row for every visual tag, and no row for a tag the sheet does not know", () => {
    expect(Object.keys(STYLE_GLYPHS).sort()).toEqual(visualTagNames());
  });

  test("every row carries an emoji, a one-character glyph and a colour", () => {
    for (const [tag, row] of Object.entries(STYLE_GLYPHS)) {
      expect(`${tag} emoji`).toBe(typeof row.emoji === "string" && row.emoji.length > 0 ? `${tag} emoji` : `${tag} has NO emoji`);
      expect(`${tag} glyph`).toBe([...row.glyph].length === 1 ? `${tag} glyph` : `${tag} glyph is not one character`);
      expect(row.colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  test("the fallback tag is a visible question mark in every style", () => {
    expect(STYLE_GLYPHS.unknown.glyph).toBe("?");
    expect(STYLE_GLYPHS.unknown.emoji).toBe("❓");
  });

  test("glyphFor answers the row, or the fallback row for an unknown tag", () => {
    expect(glyphFor("grass")).toBe(STYLE_GLYPHS.grass);
    expect(glyphFor("nope")).toBe(STYLE_GLYPHS.unknown);
  });

  test("ground and wall tags use the classic roguelike letters", () => {
    expect(glyphFor("floor").glyph).toBe(".");
    expect(glyphFor("wall").glyph).toBe("#");
    expect(glyphFor("water").glyph).toBe("~");
    expect(glyphFor("door").glyph).toBe("+");
    expect(glyphFor("person").glyph).toBe("@");
  });

  test("the table and the sheet manifest describe the same tags", () => {
    for (const tag of Object.keys(VISUAL_TAGS)) expect(STYLE_GLYPHS[tag]).toBeDefined();
  });
});
