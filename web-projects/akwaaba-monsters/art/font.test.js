import { describe, test, expect } from "bun:test";
import {
  CHARACTERS,
  CHAR_H,
  CHAR_W,
  GLYPHS,
  LEADING,
  charsThatFit,
  glyphFor,
  hasGlyph,
  measureBlock,
  measureText,
  paginate,
  rowsThatFit,
  wrapText,
} from "./font.js";
import { BOX, BOX_MARGIN, PANELS, PROMPT_W } from "../render.js";
import { MAPS, STARTER_CHOICE, TRAINERS } from "../areas/index.js";
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

  test("works out how many rows fit a height", () => {
    expect(rowsThatFit(CHAR_H)).toBe(1);
    expect(rowsThatFit(CHAR_H - 1)).toBe(0);
    expect(rowsThatFit(CHAR_H * 2 + LEADING)).toBe(2);
    expect(rowsThatFit(CHAR_H * 2 + LEADING - 1)).toBe(1);
    expect(rowsThatFit(0)).toBe(0);
    expect(rowsThatFit(-10)).toBe(0);
  });

  test("agrees with the block it measures", () => {
    // A panel of this many rows must be no taller than the panel allows.
    for (const height of [7, 12, 20, 31, 35, 46, 100]) {
      const rows = rowsThatFit(height);
      expect(`${height}: ${measureBlock(Array(rows).fill("x")) <= height}`).toBe(`${height}: true`);
      expect(`${height}: ${measureBlock(Array(rows + 1).fill("x")) > height}`).toBe(
        `${height}: true`,
      );
    }
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
    for (const entry of STARTER_CHOICE) add(entry.blurb, `starter blurb ${entry.species}`);
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

describe("the panels that describe what the cursor sits on", () => {
  // These panels turn no page. No arrow shows and no key advances them, so a
  // description that needs one row more than the panel holds is simply lost.
  // That is what cut the end off every starter blurb until the panels were
  // given their real height.

  /** Every line the panel would draw for this text. */
  function linesIn(panel, text) {
    return wrapText(text, panel.w);
  }

  test("hold at least two rows each, or no description reads as a sentence", () => {
    for (const [name, panel] of Object.entries(PANELS)) {
      expect(`${name}: ${panel.rows >= 2}`).toBe(`${name}: true`);
    }
  });

  test("show every line of every starter blurb", () => {
    for (const entry of STARTER_CHOICE) {
      const lines = linesIn(PANELS.starter, entry.blurb);
      expect(`${entry.species}: ${lines.length} rows`).toBe(
        `${entry.species}: ${Math.min(lines.length, PANELS.starter.rows)} rows`,
      );
    }
  });

  test("show every line of every item description, in the bag and in the shop", () => {
    for (const id of ITEM_IDS) {
      for (const which of ["bag", "shop"]) {
        const lines = linesIn(PANELS[which], ITEMS[id].desc);
        expect(`${which} ${id}: ${lines.length} rows`).toBe(
          `${which} ${id}: ${Math.min(lines.length, PANELS[which].rows)} rows`,
        );
      }
    }
  });

  test("keep every line inside the width they were given", () => {
    for (const [name, panel] of Object.entries(PANELS)) {
      for (const id of ITEM_IDS) {
        for (const line of linesIn(panel, ITEMS[id].desc)) {
          expect(`${name} ${id}: ${measureText(line) <= panel.w}`).toBe(`${name} ${id}: true`);
        }
      }
    }
  });
});

describe("the message box", () => {
  test("keeps its rows inside the paper of the box, and wastes no room", () => {
    // The border of a box is three pixels, so the paper ends three above it.
    const paperBottom = BOX.y + BOX.h - 3;
    expect(BOX.textY + measureBlock(Array(BOX.rows).fill("x"))).toBeLessThanOrEqual(paperBottom);
    expect(BOX.textY + measureBlock(Array(BOX.rows + 1).fill("x"))).toBeGreaterThan(paperBottom);
  });

  test("takes the prompts that are written straight into it, with no paging", () => {
    // These are the lines the game hands to the box as one string. Nothing
    // pages them, so each one has to fit the box whole.
    const straightIn = [
      "Type your name in the box below the screen.",
      "You cannot catch another trainer's creature!",
      "The bag is empty. Press X or tap.",
    ];
    for (const text of straightIn) {
      const lines = wrapText(text, BOX.textW);
      expect(`${text}: ${lines.length} rows`).toBe(
        `${text}: ${Math.min(lines.length, BOX.rows)} rows`,
      );
      for (const line of lines) {
        expect(`${line}: ${measureText(line) <= BOX.textW}`).toBe(`${line}: true`);
      }
    }
  });

  test("fits the battle question beside the action menu, with the longest name", () => {
    // A nickname is cut to twelve letters when the game is saved, so that is the
    // longest name the question can ever hold. The narrow box sits next to the
    // action menu: a question too wide for it is drawn under the menu and lost.
    const question = `What will\n${"a".repeat(12)} do?`;
    const lines = wrapText(question, PROMPT_W - BOX_MARGIN);
    expect(lines.length).toBeLessThanOrEqual(BOX.rows);
    for (const line of lines) expect(measureText(line)).toBeLessThanOrEqual(PROMPT_W - BOX_MARGIN);
  });
});
