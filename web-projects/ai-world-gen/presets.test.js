import { describe, expect, test } from "bun:test";
import {
  DEFAULT_GRID_SIZE_ID,
  GRID_LIMITS,
  GRID_SIZES,
  SETTING_PRESETS,
  cleanSetting,
  describeSetting,
  isSettingComplete,
  readGridSize,
} from "./presets.js";

describe("the setting presets", () => {
  test("each one carries an id, a label and the three setting fields", () => {
    expect(SETTING_PRESETS.length).toBeGreaterThanOrEqual(5);
    for (const preset of SETTING_PRESETS) {
      expect(preset.id).toMatch(/^[a-z-]+$/);
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.location.length).toBeGreaterThan(0);
      expect(preset.era.length).toBeGreaterThan(0);
      expect(preset.notes.length).toBeGreaterThan(0);
    }
  });

  test("ids are unique", () => {
    expect(new Set(SETTING_PRESETS.map((one) => one.id)).size).toBe(SETTING_PRESETS.length);
  });
});

describe("cleanSetting and isSettingComplete", () => {
  test("trims and fills missing fields with empty strings", () => {
    expect(cleanSetting({ location: "  Mars base ", era: 2140 })).toEqual({ location: "Mars base", era: "2140", notes: "" });
    expect(cleanSetting(null)).toEqual({ location: "", era: "", notes: "" });
  });

  test("a setting is complete when it has a location", () => {
    expect(isSettingComplete({ location: "A village", era: "", notes: "" })).toBe(true);
    expect(isSettingComplete({ location: "  ", era: "1200", notes: "x" })).toBe(false);
  });
});

describe("describeSetting", () => {
  test("joins the three fields into one paragraph, leaving out the empty ones", () => {
    expect(describeSetting({ location: "A medieval village", era: "the year 1200", notes: "cosy, autumn" })).toBe(
      "Location: A medieval village. Time: the year 1200. Tone and notes: cosy, autumn.",
    );
    expect(describeSetting({ location: "Mars base", era: "", notes: "" })).toBe("Location: Mars base.");
  });
});

describe("the grid sizes", () => {
  test("offer a small, a medium and a large square and a default", () => {
    expect(GRID_SIZES.map((one) => one.id)).toContain(DEFAULT_GRID_SIZE_ID);
    for (const size of GRID_SIZES) {
      expect(size.width).toBeGreaterThanOrEqual(GRID_LIMITS.min);
      expect(size.width).toBeLessThanOrEqual(GRID_LIMITS.max);
      expect(size.height).toBeGreaterThanOrEqual(GRID_LIMITS.min);
      expect(size.height).toBeLessThanOrEqual(GRID_LIMITS.max);
    }
  });

  test("readGridSize accepts a preset id, a custom WxH, and falls back to the default", () => {
    const fallback = GRID_SIZES.find((one) => one.id === DEFAULT_GRID_SIZE_ID);
    expect(readGridSize(DEFAULT_GRID_SIZE_ID)).toEqual({ width: fallback.width, height: fallback.height });
    expect(readGridSize("20x10")).toEqual({ width: 20, height: 10 });
    expect(readGridSize("nope")).toEqual({ width: fallback.width, height: fallback.height });
    expect(readGridSize("999x2")).toEqual({ width: fallback.width, height: fallback.height });
  });
});
