import { describe, expect, test } from "bun:test";
import { ROW_SLACK, SUMMARY_LIMIT, summarise, tapUnfolds, topmostRow } from "./reading.js";

describe("summarise", () => {
  test("leaves a short story alone and asks for no button", () => {
    const short = "A short story about a small place.";
    expect(summarise(short)).toEqual({ summary: short, folded: false });
  });

  test("cuts a long story and says there is more", () => {
    const long = "word ".repeat(80).trim();
    const { summary, folded } = summarise(long);
    expect(folded).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(SUMMARY_LIMIT + 1);
    expect(summary.endsWith("…")).toBe(true);
  });

  test("cuts between words, never through one", () => {
    const text = "Aaaa bbbb cccc dddd eeee ffff";
    const { summary } = summarise(text, 12);
    expect(summary).toBe("Aaaa bbbb…");
    expect(text.startsWith(summary.slice(0, -1))).toBe(true);
  });

  // "…the town, …" reads as a typing mistake rather than as a cut.
  test("drops the space and the punctuation before the cut", () => {
    expect(summarise("Rain fell, and the river rose", 12).summary).toBe("Rain fell…");
  });

  test("cuts inside a word only when the first word is longer than the limit", () => {
    expect(summarise("Antidisestablishmentarianism won", 10).summary).toBe("Antidisest…");
  });

  test("keeps a story that is exactly as long as the limit", () => {
    const text = "x".repeat(SUMMARY_LIMIT);
    expect(summarise(text)).toEqual({ summary: text, folded: false });
  });

  test("copes with no text at all", () => {
    expect(summarise("")).toEqual({ summary: "", folded: false });
    expect(summarise(null)).toEqual({ summary: "", folded: false });
    expect(summarise(undefined)).toEqual({ summary: "", folded: false });
  });
});

describe("topmostRow", () => {
  // The rows carry their own coordinates, so this needs no browser to run.
  const rows = [
    { id: "a", top: 0, bottom: 100 },
    { id: "b", top: 100, bottom: 200 },
    { id: "c", top: 200, bottom: 300 },
  ];

  test("answers nothing when the list is empty", () => {
    expect(topmostRow([], 0)).toBe(null);
  });

  test("picks the first row before the reader scrolls", () => {
    expect(topmostRow(rows, 0)).toBe("a");
  });

  test("picks the row the top edge of the list now sits in", () => {
    expect(topmostRow(rows, 120)).toBe("b");
    expect(topmostRow(rows, 250)).toBe("c");
  });

  // A sliver of the row above is not what the reader is reading.
  test("skips a row with less than the slack still on screen", () => {
    expect(topmostRow(rows, 100 - ROW_SLACK + 1)).toBe("b");
    expect(topmostRow(rows, 100 - ROW_SLACK - 1)).toBe("a");
  });

  test("holds on to the last row once the reader scrolls past every row", () => {
    expect(topmostRow(rows, 5000)).toBe("c");
  });

  test("reads the rows in the order it is given them", () => {
    const single = [{ id: "only", top: 40, bottom: 90 }];
    expect(topmostRow(single, 0)).toBe("only");
    expect(topmostRow(single, 500)).toBe("only");
  });
});

describe("tapUnfolds", () => {
  // A phone shows no panel, so the row is the only place the whole story is
  // written. The chevron under the summary is easy to miss.
  test("opens a folded row on a phone", () => {
    expect(tapUnfolds({ wide: false, open: false })).toBe(true);
  });

  // The row a reader taps is also the row the map marks, so a tap on an open row
  // is a request to go back to it, not a request to lose the words.
  test("never folds a row that is already open", () => {
    expect(tapUnfolds({ wide: false, open: true })).toBe(false);
  });

  // The wide layout prints the chosen place in the panel above the list, in
  // full. Unfolding the row too would print the same story twice on one screen.
  test("leaves the row folded on a wide screen, where the panel holds the story", () => {
    expect(tapUnfolds({ wide: true, open: false })).toBe(false);
    expect(tapUnfolds({ wide: true, open: true })).toBe(false);
  });
});
