import { describe, test, expect } from "bun:test";
import {
  CHARACTERS,
  CHAR_H,
  CHAR_W,
  GLYPHS,
  charsThatFit,
  glyphFor,
  hasGlyph,
  measureBlock,
  measureText,
  paginate,
  wrapText,
} from "./font.js";
import { MAPS, TRAINERS } from "../areas/index.js";
import { SPECIES, SPECIES_IDS } from "../species.js";
import { MOVES, MOVE_IDS } from "../moves.js";
import { ITEMS, ITEM_IDS } from "../items.js";

describe("the glyphs", () => {
  test("are all seven rows of five", () => {
    for (const [character, rows] of Object.entries(GLYPHS)) {
      expect(`${character}: ${rows.length}`).toBe(`${character}: ${CHAR_H}`);
      for (const row of rows) {
        expect(`${character}: "${row}" is ${row.length}`).toBe(`${character}: "${row}" is ${CHAR_W}`);
      }
    }
  });

  test("only use on and off, nothing else", () => {
    for (const [character, rows] of Object.entries(GLYPHS)) {
      for (const row of rows) {
        expect(`${character}: ${/^[#.]+$/.test(row)}`).toBe(`${character}: true`);
      }
    }
  });

  test("cover the whole alphabet in both cases, and every digit", () => {
    for (const character of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") expect(hasGlyph(character)).toBe(true);
    for (const character of "abcdefghijklmnopqrstuvwxyz") expect(hasGlyph(character)).toBe(true);
    for (const character of "0123456789") expect(hasGlyph(character)).toBe(true);
  });

  test("leave the space blank and draw everything else", () => {
    expect(glyphFor(" ").join("")).not.toContain("#");
    for (const character of CHARACTERS) {
      if (character === " ") continue;
      expect(`${character} has ink: ${glyphFor(character).join("").includes("#")}`).toBe(
        `${character} has ink: true`,
      );
    }
  });

  test("fall back to a question mark for a letter the font lacks", () => {
    expect(glyphFor("é")).toEqual(GLYPHS["?"]);
    expect(glyphFor("")).toEqual(GLYPHS["?"]);
  });

  test("keep upper and lower case apart, or the text reads as shouting", () => {
    for (const upper of "ABDEFGHIJKLMNQRTUY") {
      expect(`${upper}: ${GLYPHS[upper].join() !== GLYPHS[upper.toLowerCase()].join()}`).toBe(
        `${upper}: true`,
      );
    }
  });
});

describe("measuring", () => {
  test("counts a letter plus the gap after it", () => {
    expect(measureText("A")).toBe(5);
    expect(measureText("AB")).toBe(11);
    expect(measureText("")).toBe(0);
  });

  test("counts a block of lines with the gap between them", () => {
    expect(measureBlock([])).toBe(0);
    expect(measureBlock(["one"])).toBe(CHAR_H);
    expect(measureBlock(["one", "two"])).toBe(CHAR_H * 2 + 3);
  });

  test("works out how many letters fit a width", () => {
    expect(charsThatFit(5)).toBe(1);
    expect(charsThatFit(11)).toBe(2);
    expect(charsThatFit(0)).toBe(0);
    expect(charsThatFit(-10)).toBe(0);
  });
});

describe("wrapping", () => {
  test("keeps a short line on one line", () => {
    expect(wrapText("Hello", 200)).toEqual(["Hello"]);
  });

  test("breaks between words, never inside one", () => {
    const lines = wrapText("the quick brown fox jumps", charsThatFit(200) * 6);
    for (const line of lines) expect(line.startsWith(" ")).toBe(false);
    expect(lines.join(" ")).toBe("the quick brown fox jumps");
  });

  test("never gives a line wider than it was asked for", () => {
    const width = 100;
    for (const line of wrapText("Akwaaba, welcome to Aduma village and the road north", width)) {
      expect(measureText(line)).toBeLessThanOrEqual(width);
    }
  });

  test("breaks a word that cannot fit any line at all, rather than dropping it", () => {
    const lines = wrapText("supercalifragilistic", 30);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("supercalifragilistic");
  });

  test("collapses runs of spaces", () => {
    expect(wrapText("a    b", 200)).toEqual(["a b"]);
  });

  test("keeps a line break the writer put in", () => {
    expect(wrapText("one\ntwo", 200)).toEqual(["one", "two"]);
  });

  test("gives one empty line for empty text, so a box still draws", () => {
    expect(wrapText("", 200)).toEqual([""]);
    expect(wrapText(null, 200)).toEqual([""]);
  });

  test("gives nothing for a width nothing fits in", () => {
    expect(wrapText("hello", 0)).toEqual([]);
  });
});

describe("paginating", () => {
  test("splits into pages of the asked number of rows", () => {
    const pages = paginate("one two three four five six seven eight nine ten", 60, 2);
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(2);
    expect(pages.flat().join(" ")).toBe("one two three four five six seven eight nine ten");
  });

  test("always gives at least one page, so the box is never blank", () => {
    expect(paginate("", 100, 2)).toEqual([[""]]);
  });
});

describe("every word in the game can actually be drawn", () => {
  /** Collect every string a player will ever read. */
  function everyString() {
    const found = [];
    const add = (value, where) => {
      if (typeof value === "string") found.push({ value, where });
    };
    for (const id of SPECIES_IDS) {
      add(SPECIES[id].name, `species ${id}`);
      add(SPECIES[id].entry, `entry ${id}`);
    }
    for (const id of MOVE_IDS) {
      add(MOVES[id].name, `move ${id}`);
      add(MOVES[id].desc, `move desc ${id}`);
    }
    for (const id of ITEM_IDS) {
      add(ITEMS[id].name, `item ${id}`);
      add(ITEMS[id].desc, `item desc ${id}`);
    }
    for (const [id, trainer] of Object.entries(TRAINERS)) {
      add(trainer.name, `trainer ${id}`);
      add(trainer.intro, `intro ${id}`);
      add(trainer.defeat, `defeat ${id}`);
    }
    for (const [mapId, map] of Object.entries(MAPS)) {
      add(map.name, `map ${mapId}`);
      for (const sign of map.signs ?? []) add(sign.text, `sign in ${mapId}`);
      const walk = (steps, where) => {
        for (const step of steps ?? []) {
          if (!Array.isArray(step)) continue;
          if (step[0] === "say") add(step[1], where);
          if (step[0] === "ask") {
            add(step[1], where);
            for (const option of step[2] ?? []) {
              add(option.label, where);
              walk(option.then, where);
            }
          }
          if (step[0] === "if") {
            walk(step[2], where);
            walk(step[3], where);
          }
        }
      };
      for (const npc of map.npcs ?? []) walk(npc.script, `${mapId}/${npc.id}`);
      for (const sign of map.signs ?? []) walk(sign.script, `${mapId}/sign`);
      for (const trigger of map.triggers ?? []) walk(trigger.script, `${mapId}/trigger`);
    }
    return found;
  }

  test("uses no character the font is missing", () => {
    // This is the test that catches a curly quote or an accent pasted into a
    // line of dialogue, which would otherwise show up as a question mark.
    const missing = new Set();
    for (const { value, where } of everyString()) {
      for (const character of value) {
        if (!hasGlyph(character)) missing.add(`${character} (in ${where})`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  test("keeps every name short enough for the boxes that hold it", () => {
    for (const id of SPECIES_IDS) expect(measureText(SPECIES[id].name)).toBeLessThanOrEqual(60);
    for (const id of MOVE_IDS) expect(measureText(MOVES[id].name)).toBeLessThanOrEqual(78);
    for (const id of ITEM_IDS) expect(measureText(ITEMS[id].name)).toBeLessThanOrEqual(102);
  });

  test("fits every line of dialogue into the message box in a few pages", () => {
    // The box is 224 pixels wide inside its border and shows two rows.
    for (const { value, where } of everyString()) {
      const pages = paginate(value, 216, 2);
      expect(`${where}: ${pages.length <= 4}`).toBe(`${where}: true`);
    }
  });
});
