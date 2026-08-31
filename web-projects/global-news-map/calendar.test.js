import { describe, expect, test } from "bun:test";
import {
  addDays,
  defaultDay,
  fromIsoDay,
  isSelectableDay,
  portalPageTitle,
  portalPageUrl,
  toIsoDay,
  todayUtc,
} from "./calendar.js";

const day = (text) => fromIsoDay(text);

describe("portalPageTitle", () => {
  test("names the page the way Wikipedia does", () => {
    expect(portalPageTitle(day("2026-08-30"))).toBe("Portal:Current events/2026 August 30");
  });

  // Wikipedia writes the day without a leading zero. "August 05" is a red link.
  test("writes a single-digit day without a leading zero", () => {
    expect(portalPageTitle(day("2026-08-05"))).toBe("Portal:Current events/2026 August 5");
  });

  test("covers January and December, the two the month index gets wrong", () => {
    expect(portalPageTitle(day("2026-01-01"))).toBe("Portal:Current events/2026 January 1");
    expect(portalPageTitle(day("2026-12-31"))).toBe("Portal:Current events/2026 December 31");
  });

  test("links to the readable page, with the underscores Wikipedia expects", () => {
    expect(portalPageUrl(day("2026-08-30"))).toBe(
      "https://en.wikipedia.org/wiki/Portal%3ACurrent_events%2F2026_August_30",
    );
  });
});

describe("fromIsoDay", () => {
  test("reads a real day", () => {
    expect(toIsoDay(fromIsoDay("2026-08-30"))).toBe("2026-08-30");
  });

  // A hand-edited address must not be able to break the page.
  test("refuses anything that is not a real day", () => {
    for (const bad of ["", "not-a-day", "2026-13-01", "2026-02-31", "2026-8-3", "20260830", null, undefined]) {
      expect(fromIsoDay(bad)).toBeNull();
    }
  });
});

describe("the day is read in UTC, never locally", () => {
  // A local reading makes the page show a different day depending on where the
  // reader is, and an empty map for part of every day.
  test("a moment late in the UTC day is still that day", () => {
    expect(toIsoDay(todayUtc(new Date("2026-08-30T23:59:59Z")))).toBe("2026-08-30");
  });

  test("a moment early in the UTC day is still that day", () => {
    expect(toIsoDay(todayUtc(new Date("2026-08-30T00:00:01Z")))).toBe("2026-08-30");
  });
});

describe("addDays", () => {
  test("steps forward and back", () => {
    expect(toIsoDay(addDays(day("2026-08-30"), 1))).toBe("2026-08-31");
    expect(toIsoDay(addDays(day("2026-08-30"), -1))).toBe("2026-08-29");
  });

  test("crosses a month, a year and a leap day", () => {
    expect(toIsoDay(addDays(day("2026-08-31"), 1))).toBe("2026-09-01");
    expect(toIsoDay(addDays(day("2026-12-31"), 1))).toBe("2027-01-01");
    expect(toIsoDay(addDays(day("2024-02-28"), 1))).toBe("2024-02-29");
  });
});

describe("defaultDay", () => {
  // Editors fill today's page through the day. At 01:00 UTC it is nearly empty,
  // and an empty map reads as a broken page.
  test("opens yesterday, because today is still being written", () => {
    expect(toIsoDay(defaultDay(new Date("2026-08-31T01:00:00Z")))).toBe("2026-08-30");
  });
});

describe("isSelectableDay", () => {
  const now = new Date("2026-08-31T12:00:00Z");

  test("allows today and the past", () => {
    expect(isSelectableDay(day("2026-08-31"), now)).toBe(true);
    expect(isSelectableDay(day("2001-09-11"), now)).toBe(true);
  });

  test("refuses a day that has not happened", () => {
    expect(isSelectableDay(day("2026-09-01"), now)).toBe(false);
  });

  test("refuses a broken date rather than throwing", () => {
    expect(isSelectableDay(new Date("nonsense"), now)).toBe(false);
    expect(isSelectableDay(null, now)).toBe(false);
  });
});
