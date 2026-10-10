import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SECTION,
  SETTINGS_ENTRIES,
  SETTINGS_SECTIONS,
  matchSettings,
  parentSection,
  readSection,
  sectionLabel,
} from "./settingsSections.js";

const ids = (results) => results.map((one) => one.entry.id);

describe("the sections of Settings", () => {
  // A section id travels in the link (`?view=settings&section=appearance`),
  // so it is as permanent as a view name (ADR 0048).
  test("the ids never change, and the first is the default", () => {
    expect(SETTINGS_SECTIONS.map((one) => one.id)).toEqual(["tokens", "storage", "appearance", "counting", "copy-lines"]);
    expect(DEFAULT_SECTION).toBe("tokens");
  });

  test("every section has a name for the index", () => {
    for (const one of SETTINGS_SECTIONS) expect(one.label.length).toBeGreaterThan(0);
    expect(sectionLabel("appearance")).toBe("Look");
    expect(sectionLabel("nope")).toBe("");
  });

  test("a section nobody offers is the default", () => {
    expect(readSection("appearance")).toBe("appearance");
    expect(readSection("Appearance")).toBe(DEFAULT_SECTION);
    expect(readSection(undefined)).toBe(DEFAULT_SECTION);
  });

  // Adding a token and the cleanup are screens of their own, opened from one
  // section each, and "back" goes to that section (ADR 0048).
  test("each screen opened from Settings knows the section it came from", () => {
    expect(parentSection("add-token")).toBe("tokens");
    expect(parentSection("cleanup")).toBe("storage");
    expect(parentSection("board")).toBe(null);
    expect(parentSection("settings")).toBe(null);
  });
});

describe("the settings the search can find", () => {
  test("every entry lives in a section that exists, and every id is unique", () => {
    const sections = new Set(SETTINGS_SECTIONS.map((one) => one.id));
    for (const entry of SETTINGS_ENTRIES) expect(sections.has(entry.section)).toBe(true);
    expect(new Set(SETTINGS_ENTRIES.map((one) => one.id)).size).toBe(SETTINGS_ENTRIES.length);
  });

  test("every section has something to find", () => {
    for (const one of SETTINGS_SECTIONS) {
      expect(SETTINGS_ENTRIES.some((entry) => entry.section === one.id)).toBe(true);
    }
  });
});

describe("searching Settings", () => {
  test("nothing typed finds nothing", () => {
    expect(matchSettings("")).toEqual([]);
    expect(matchSettings("   ")).toEqual([]);
    expect(matchSettings(undefined)).toEqual([]);
  });

  test("finds a setting by a word in its name", () => {
    expect(ids(matchSettings("theme"))).toContain("theme");
  });

  // People type the word they think of, not the word on the screen.
  test("finds a setting by a word it is known by", () => {
    expect(ids(matchSettings("dark"))).toContain("theme");
    expect(ids(matchSettings("color"))).toContain("column-colours");
    expect(ids(matchSettings("colour"))).toContain("column-colours");
    expect(ids(matchSettings("effort"))).toContain("card-parts");
  });

  test("a word matches the start of a word, so typing is enough", () => {
    expect(ids(matchSettings("backu"))).toContain("token-backup");
  });

  test("every word typed has to match", () => {
    expect(ids(matchSettings("hide column"))).toContain("column-shown");
    expect(ids(matchSettings("hide zebra"))).toEqual([]);
  });

  // An accent or a capital letter is not a different word.
  test("ignores accents and capitals", () => {
    expect(ids(matchSettings("CoLór"))).toContain("column-colours");
  });

  test("a match in the name ranks above a match in a word it is known by", () => {
    const entries = [
      { id: "a", section: "tokens", label: "Something else", keywords: ["theme"] },
      { id: "b", section: "appearance", label: "Theme", keywords: [] },
    ];
    expect(ids(matchSettings("theme", entries))).toEqual(["b", "a"]);
  });

  test("each answer names its section, for the line under it", () => {
    const [first] = matchSettings("theme");
    expect(first.section.id).toBe("appearance");
    expect(first.section.label).toBe("Look");
  });
});
