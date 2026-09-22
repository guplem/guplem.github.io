import { describe, expect, test } from "bun:test";
import {
  DEFAULT_RANGE,
  RANGE_PRESETS,
  isDefaultRange,
  rangeBounds,
  rangeDates,
  rangeFromDates,
  rangeLabel,
  readRange,
} from "./doneRange.js";

// A Tuesday, half past two in the afternoon, in whatever clock the machine
// running the tests is set to. Every answer below is in that same clock,
// because the reader's day is the one the column is about (ADR 0017).
const NOW = new Date(2026, 8, 22, 14, 30, 0);
const local = (y, m, d) => new Date(y, m - 1, d).toISOString();

describe("readRange", () => {
  test("keeps the three presets", () => {
    for (const preset of RANGE_PRESETS) expect(readRange(preset.id)).toBe(preset.id);
  });

  test("reads a pair of days, and a single day as a pair", () => {
    expect(readRange("2026-09-15..2026-09-19")).toBe("2026-09-15..2026-09-19");
    expect(readRange("2026-09-19")).toBe("2026-09-19..2026-09-19");
  });

  // Somebody can hand in the two days the wrong way round, by typing them or
  // by editing the link. The earlier one is the start, whatever order it came.
  test("puts the earlier day first", () => {
    expect(readRange("2026-09-19..2026-09-15")).toBe("2026-09-15..2026-09-19");
  });

  // A link is edited by hand and comes back from old versions of this page.
  // Anything unreadable is today, which is the thing the column is for.
  test("anything else is today", () => {
    expect(readRange("last-year")).toBe(DEFAULT_RANGE);
    expect(readRange("2026-13-40")).toBe(DEFAULT_RANGE);
    expect(readRange("")).toBe(DEFAULT_RANGE);
    expect(readRange(null)).toBe(DEFAULT_RANGE);
    expect(readRange(7)).toBe(DEFAULT_RANGE);
  });

  test("today is the default, and it is the one left out of a link", () => {
    expect(DEFAULT_RANGE).toBe("today");
    expect(isDefaultRange("today")).toBe(true);
    expect(isDefaultRange("yesterday")).toBe(false);
  });
});

describe("rangeBounds", () => {
  // Midnight in the reader's own clock, and the end is the midnight after the
  // last day, so the whole of the last day counts (ADR 0017).
  test("today runs from this midnight to the next", () => {
    expect(rangeBounds("today", NOW)).toEqual({ from: local(2026, 9, 22), to: local(2026, 9, 23) });
  });

  test("yesterday is the day before, and stops where today starts", () => {
    expect(rangeBounds("yesterday", NOW)).toEqual({ from: local(2026, 9, 21), to: local(2026, 9, 22) });
  });

  // Seven days including today, so a Tuesday standup covers last Wednesday on.
  test("the last 7 days counts today as one of them", () => {
    expect(rangeBounds("last-7-days", NOW)).toEqual({ from: local(2026, 9, 16), to: local(2026, 9, 23) });
  });

  test("a pair of days covers both of them in full", () => {
    expect(rangeBounds("2026-09-15..2026-09-19", NOW)).toEqual({
      from: local(2026, 9, 15),
      to: local(2026, 9, 20),
    });
  });

  test("one day covers that day and nothing else", () => {
    expect(rangeBounds("2026-09-18..2026-09-18", NOW)).toEqual({ from: local(2026, 9, 18), to: local(2026, 9, 19) });
  });

  test("anything unreadable falls back to today", () => {
    expect(rangeBounds("nonsense", NOW)).toEqual(rangeBounds("today", NOW));
  });
});

describe("rangeLabel", () => {
  test("the three presets read as words", () => {
    expect(rangeLabel("today", NOW)).toBe("Done today");
    expect(rangeLabel("yesterday", NOW)).toBe("Done yesterday");
    expect(rangeLabel("last-7-days", NOW)).toBe("Done in the last 7 days");
  });

  // One day carries its weekday, because "last Friday" is how somebody asks
  // for it out loud.
  test("one chosen day says which weekday it was", () => {
    expect(rangeLabel("2026-09-18..2026-09-18", NOW)).toBe("Done on Fri 18 Sep");
  });

  test("a span says both ends", () => {
    expect(rangeLabel("2026-09-15..2026-09-19", NOW)).toBe("Done 15 Sep to 19 Sep");
  });

  // A chosen day that happens to be today or yesterday is still said plainly,
  // because the reader chose a date and the column has to answer with it.
  test("a chosen day is never renamed to today", () => {
    expect(rangeLabel("2026-09-22..2026-09-22", NOW)).toBe("Done on Tue 22 Sep");
  });
});

describe("the two date boxes", () => {
  test("every range fills both boxes, so the picker opens on what is on screen", () => {
    expect(rangeDates("today", NOW)).toEqual({ from: "2026-09-22", to: "2026-09-22" });
    expect(rangeDates("yesterday", NOW)).toEqual({ from: "2026-09-21", to: "2026-09-21" });
    expect(rangeDates("last-7-days", NOW)).toEqual({ from: "2026-09-16", to: "2026-09-22" });
    expect(rangeDates("2026-09-15..2026-09-19", NOW)).toEqual({ from: "2026-09-15", to: "2026-09-19" });
  });

  test("two days typed into the boxes become a range", () => {
    expect(rangeFromDates("2026-09-15", "2026-09-19")).toBe("2026-09-15..2026-09-19");
    expect(rangeFromDates("2026-09-19", "2026-09-19")).toBe("2026-09-19..2026-09-19");
  });

  // An empty box means "this end is open". One end alone is that one day.
  test("one end alone is that day, and neither end is today", () => {
    expect(rangeFromDates("2026-09-19", "")).toBe("2026-09-19..2026-09-19");
    expect(rangeFromDates("", "2026-09-19")).toBe("2026-09-19..2026-09-19");
    expect(rangeFromDates("", "")).toBe(DEFAULT_RANGE);
  });
});
