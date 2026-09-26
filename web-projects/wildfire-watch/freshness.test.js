import { describe, test, expect } from "bun:test";
import { formatAge, nextScanMinutes, freshnessLine, realFreshnessLine } from "./freshness.js";

describe("formatAge", () => {
  test("says under a minute for fresh data", () => {
    expect(formatAge(20_000)).toBe("<1 min");
  });
  test("counts minutes, then hours and minutes", () => {
    expect(formatAge(6 * 60_000)).toBe("6 min");
    expect(formatAge(220 * 60_000)).toBe("3h 40m");
  });
});

describe("nextScanMinutes", () => {
  test("counts down to the next ten-minute scan", () => {
    expect(nextScanMinutes(6 * 60_000, 10)).toBe(4);
  });
  test("never says zero; an overdue scan reads as one minute", () => {
    expect(nextScanMinutes(12 * 60_000, 10)).toBe(1);
  });
});

describe("freshnessLine", () => {
  test("gives each source its own staleness", () => {
    const now = Date.parse("2026-09-25T09:20:00Z");
    const line = freshnessLine(now, {
      deepfire: now - 30_000,
      mtg: now - 6 * 60_000,
      weather: now - 6 * 60_000,
      elmfire: Date.parse("2026-09-25T08:40:00Z"),
    }, "UTC");
    expect(line).toEqual([
      "Deepfire: updated <1 min ago",
      "MTG: next scan in 4m",
      "WeatherNext: updated 6 min ago",
      "ELMFIRE: model run 08:40",
    ]);
  });
});

describe("realFreshnessLine", () => {
  test("names the newest satellite pass, the copy's age and the weather fetch", () => {
    const now = Date.parse("2026-09-25T14:00:00Z");
    expect(realFreshnessLine(now, {
      newestPass: now - 2 * 3_600_000,
      feedBuilt: now - 14 * 60_000,
      weather: now - 30_000,
      fwiDay: "2026-09-25",
    })).toEqual([
      "NASA FIRMS: newest satellite pass 2h 0m ago (copy refreshed 14 min ago)",
      "Open-Meteo: updated <1 min ago",
      "EFFIS fire danger: forecast for 2026-09-25",
    ]);
  });
  test("says so when the weather has not loaded", () => {
    const now = Date.parse("2026-09-25T14:00:00Z");
    const line = realFreshnessLine(now, { newestPass: now, feedBuilt: now, weather: null, fwiDay: "2026-09-25" });
    expect(line[1]).toBe("Open-Meteo: not loaded yet");
  });
});

describe("realFreshnessLine before the feed loads", () => {
  test("says the fire data is not loaded", () => {
    const now = Date.parse("2026-09-25T14:00:00Z");
    expect(realFreshnessLine(now, { newestPass: null, feedBuilt: null, weather: null, fwiDay: "2026-09-25" })[0]).toBe("NASA FIRMS: not loaded");
  });
});
