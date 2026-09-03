import { describe, expect, test } from "bun:test";
import { TEXT_STYLES, layoutText, styleById, wrapText } from "./textLayout.js";

/**
 * A stand-in for the canvas text measurer: every character is 10 wide. Real
 * measuring needs a canvas, so the caller passes the measurer in and this
 * module stays testable.
 */
const measure = (text) => text.length * 10;

describe("wrapText", () => {
  test("keeps a short line on one line", () => {
    expect(wrapText("hello", 100, measure)).toEqual(["hello"]);
  });

  test("breaks between words when a line runs long", () => {
    // "hello world" is 110 wide, which does not fit 100.
    expect(wrapText("hello world", 100, measure)).toEqual(["hello", "world"]);
  });

  test("fits as many words on a line as it can", () => {
    expect(wrapText("a b c d e f", 50, measure)).toEqual(["a b c", "d e f"]);
  });

  test("honours a line break the person typed", () => {
    // Pressing return in a caption is an instruction, not a suggestion.
    expect(wrapText("one\ntwo", 1000, measure)).toEqual(["one", "two"]);
  });

  test("keeps an empty typed line, so a gap stays a gap", () => {
    expect(wrapText("one\n\ntwo", 1000, measure)).toEqual(["one", "", "two"]);
  });

  test("breaks a single word too long to fit", () => {
    // A word with no spaces cannot be wrapped between words, and letting it
    // run off the sticker is worse than breaking it.
    expect(wrapText("abcdefghij", 50, measure)).toEqual(["abcde", "fghij"]);
  });

  test("never returns an empty line from a word break", () => {
    for (const line of wrapText("abcdefghijklmnop", 15, measure)) {
      expect(line.length).toBeGreaterThan(0);
    }
  });

  test("returns one empty line for empty text", () => {
    expect(wrapText("", 100, measure)).toEqual([""]);
  });

  test("collapses the runs of spaces between words", () => {
    expect(wrapText("a    b", 1000, measure)).toEqual(["a b"]);
  });

  test("survives a width too small for one character", () => {
    // A pathological width must not loop for ever.
    const lines = wrapText("abc", 1, measure);
    expect(lines.length).toBe(3);
  });
});

describe("TEXT_STYLES", () => {
  test("offers several looks, starting with plain text", () => {
    expect(TEXT_STYLES.length).toBeGreaterThan(3);
    expect(TEXT_STYLES[0].id).toBe("plain");
  });

  test("gives every style a unique id", () => {
    const ids = TEXT_STYLES.map((style) => style.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("says for every style how its background is drawn", () => {
    for (const style of TEXT_STYLES) {
      expect(`${style.id}: ${style.background}`).toMatch(
        /: (none|lines|block)$/,
      );
    }
  });

  test("finds a style by id, and falls back to plain", () => {
    expect(styleById("plain").id).toBe("plain");
    // A sticker saved by an older version may name a style that is gone.
    expect(styleById("no-such-style").id).toBe("plain");
  });
});

describe("layoutText", () => {
  const base = {
    text: "hello",
    fontSize: 20,
    maxWidth: 400,
    measure,
    style: "plain",
  };

  test("reports the size of the block it laid out", () => {
    const layout = layoutText(base);
    expect(layout.width).toBe(50);
    // One line at the default line height of 1.25.
    expect(layout.height).toBe(25);
  });

  test("gives each line its own position and width", () => {
    const layout = layoutText({ ...base, text: "hello\nhi" });
    expect(layout.lines.map((line) => line.text)).toEqual(["hello", "hi"]);
    expect(layout.lines[0].width).toBe(50);
    expect(layout.lines[1].width).toBe(20);
  });

  test("stacks the lines one line height apart", () => {
    const layout = layoutText({ ...base, text: "a\nb\nc" });
    const tops = layout.lines.map((line) => line.y);
    expect(tops[1] - tops[0]).toBe(25);
    expect(tops[2] - tops[1]).toBe(25);
  });

  test("takes the widest line as the block width", () => {
    const layout = layoutText({ ...base, text: "hi\nhello" });
    expect(layout.width).toBe(50);
  });

  test("puts a baseline inside each line box, not on its top edge", () => {
    // Canvas draws text from the baseline. Using the line's top would push
    // every line up by most of its height.
    const layout = layoutText(base);
    expect(layout.lines[0].baseline).toBeGreaterThan(layout.lines[0].y);
    expect(layout.lines[0].baseline).toBeLessThanOrEqual(layout.lines[0].y + 25);
  });

  test("centres each line by default", () => {
    const layout = layoutText({ ...base, text: "hi\nhello" });
    // The block is 50 wide, so a 20 wide line starts 15 in.
    expect(layout.lines[0].x).toBe(15);
    expect(layout.lines[1].x).toBe(0);
  });

  test("lines up the left edges when asked", () => {
    const layout = layoutText({ ...base, text: "hi\nhello", align: "left" });
    expect(layout.lines.map((line) => line.x)).toEqual([0, 0]);
  });

  test("lines up the right edges when asked", () => {
    const layout = layoutText({ ...base, text: "hi\nhello", align: "right" });
    expect(layout.lines.map((line) => line.x)).toEqual([30, 0]);
  });

  test("wraps to the width it was given", () => {
    const layout = layoutText({ ...base, text: "hello world", maxWidth: 100 });
    expect(layout.lines.length).toBe(2);
    expect(layout.width).toBeLessThanOrEqual(100);
  });

  test("draws no background for the plain style", () => {
    expect(layoutText(base).boxes).toEqual([]);
  });

  test("draws one box per line for a highlight style", () => {
    // The Instagram-style highlight: each line gets its own bar, so a short
    // line does not sit inside a wide empty block.
    const style = TEXT_STYLES.find((entry) => entry.background === "lines");
    const layout = layoutText({ ...base, text: "hi\nhello", style: style.id });
    expect(layout.boxes.length).toBe(2);
    // Each bar is as wide as its own line, so the short line gets a short bar.
    expect(layout.boxes[0].width).toBe(20);
    expect(layout.boxes[1].width).toBe(50);
  });

  test("draws one box around everything for a block style", () => {
    const style = TEXT_STYLES.find((entry) => entry.background === "block");
    const layout = layoutText({ ...base, text: "hi\nhello", style: style.id });
    expect(layout.boxes.length).toBe(1);
    expect(layout.boxes[0].width).toBe(layout.width);
    expect(layout.boxes[0].height).toBe(layout.height);
  });

  test("pads a background box out beyond the letters", () => {
    // A bar tight against the letters looks like a mistake.
    const style = TEXT_STYLES.find((entry) => entry.background === "lines");
    const layout = layoutText({ ...base, style: style.id, padding: 8 });
    expect(layout.boxes[0].x).toBeLessThan(layout.lines[0].x);
    expect(layout.boxes[0].width).toBeGreaterThan(layout.lines[0].width);
  });

  test("grows the block to hold its own padding", () => {
    const style = TEXT_STYLES.find((entry) => entry.background === "block");
    const plain = layoutText(base);
    const padded = layoutText({ ...base, style: style.id, padding: 10 });
    expect(padded.width).toBe(plain.width + 20);
    expect(padded.height).toBe(plain.height + 20);
  });

  test("keeps every line and box inside the block it reports", () => {
    // The block size is what the editor uses to place and drag the caption,
    // so anything sticking out of it would be clipped or misplaced.
    for (const style of TEXT_STYLES) {
      const layout = layoutText({
        ...base,
        text: "one\ntwo three\nfour",
        style: style.id,
        padding: 6,
      });
      for (const line of layout.lines) {
        expect(`${style.id} line x`).toBe(`${style.id} line x`);
        expect(line.x).toBeGreaterThanOrEqual(-0.001);
        expect(line.x + line.width).toBeLessThanOrEqual(layout.width + 0.001);
      }
      for (const box of layout.boxes) {
        expect(box.x).toBeGreaterThanOrEqual(-0.001);
        expect(box.y).toBeGreaterThanOrEqual(-0.001);
        expect(box.x + box.width).toBeLessThanOrEqual(layout.width + 0.001);
        expect(box.y + box.height).toBeLessThanOrEqual(layout.height + 0.001);
      }
    }
  });

  test("lays out empty text without collapsing to nothing", () => {
    // The caption is empty for the moment the person opens the text tool. A
    // zero height block would leave nothing to tap.
    const layout = layoutText({ ...base, text: "" });
    expect(layout.height).toBeGreaterThan(0);
    expect(layout.lines.length).toBe(1);
  });

  test("scales with the font size", () => {
    const small = layoutText({ ...base, fontSize: 20 });
    const large = layoutText({ ...base, fontSize: 40 });
    expect(large.height).toBe(small.height * 2);
  });
});
