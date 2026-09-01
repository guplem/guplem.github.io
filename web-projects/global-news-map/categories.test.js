import { describe, expect, test } from "bun:test";
import { CATEGORY_ICONS, CATEGORY_KEYS, classifyCategory } from "./categories.js";
import { LANGUAGE_CODES, MESSAGES } from "./i18n.js";

describe("the set of categories", () => {
  test("holds the ten the portal really uses", () => {
    expect(CATEGORY_KEYS).toHaveLength(10);
    expect(new Set(CATEGORY_KEYS).size).toBe(10);
  });

  test("gives every category an icon to draw", () => {
    for (const key of CATEGORY_KEYS) {
      expect(CATEGORY_ICONS[key], `${key} has no icon`).toBeInstanceOf(Array);
      expect(CATEGORY_ICONS[key].length, `${key} has an empty icon`).toBeGreaterThan(0);
      for (const line of CATEGORY_ICONS[key]) expect(typeof line).toBe("string");
    }
  });

  // The chip shows a short name when the row is folded and the full name when it
  // opens, so both have to exist in every language the page speaks.
  test("gives every category a short and a full name, in every language", () => {
    for (const key of CATEGORY_KEYS) {
      for (const form of ["short", "full"]) {
        const entry = MESSAGES[`category.${key}.${form}`];
        expect(entry, `category.${key}.${form} is missing`).toBeDefined();
        for (const lang of LANGUAGE_CODES) {
          expect(entry[lang]?.trim().length, `category.${key}.${form} is empty in ${lang}`).toBeGreaterThan(0);
        }
      }
    }
  });

  // A short name that is longer than the full one buys the folded row nothing.
  test("keeps every short name no longer than its full name", () => {
    for (const key of CATEGORY_KEYS) {
      for (const lang of LANGUAGE_CODES) {
        const short = MESSAGES[`category.${key}.short`][lang];
        const full = MESSAGES[`category.${key}.full`][lang];
        expect(short.length, `category.${key}.short is longer than its full name in ${lang}`).toBeLessThanOrEqual(
          full.length,
        );
      }
    }
  });
});

describe("classifyCategory on the headings the portal writes today", () => {
  // These ten are 99% of every story on 710 real portal days, 2014 to 2026.
  const today = {
    "Armed conflicts and attacks": "conflicts",
    "Disasters and accidents": "disasters",
    "Politics and elections": "politics",
    "Law and crime": "law",
    Sports: "sports",
    "International relations": "relations",
    "Health and environment": "health",
    "Arts and culture": "arts",
    "Business and economy": "business",
    "Science and technology": "science",
  };

  for (const [heading, key] of Object.entries(today)) {
    test(`reads "${heading}" as ${key}`, () => {
      expect(classifyCategory(heading)).toBe(key);
    });
  }

  test("covers every category, so none of the ten is unreachable", () => {
    expect(new Set(Object.values(today))).toEqual(new Set(CATEGORY_KEYS));
  });
});

describe("classifyCategory on the headings editors have really written", () => {
  // Retired names and plain typos, every one of them taken from a real day.
  // Nothing enforces the heading, so the page must read these as well.
  const seen = {
    Sport: "sports",
    Health: "health",
    "Business and economics": "business",
    Science: "science",
    "Armed conflict and attacks": "conflicts",
    "Disasters and incidents": "disasters",
    "Health and medicine": "health",
    "Armed attacks and conflicts": "conflicts",
    "International Relations": "relations",
    Politics: "politics",
    Disasters: "disasters",
    "Science and Technology": "science",
    Environment: "health",
    "Business and Economy": "business",
    "Sience and technology": "science",
    "Religion and politics": "politics",
    "Businesses and economy": "business",
    "Politics and election": "politics",
    Crime: "law",
    "Art & literature": "arts",
    "Political elections": "politics",
    Weather: "health",
    "Armed conflicts": "conflicts",
    "Law and Crime": "law",
    "Conflicts and attacks": "conflicts",
  };

  for (const [heading, key] of Object.entries(seen)) {
    test(`reads "${heading}" as ${key}`, () => {
      expect(classifyCategory(heading)).toBe(key);
    });
  }
});

describe("classifyCategory when it cannot tell", () => {
  // The page then prints the portal's own words, which is always true even when
  // it is not one of the ten. Guessing would put a wrong icon on the story.
  test("answers null for a heading it does not recognise", () => {
    expect(classifyCategory("Religion")).toBeNull();
    expect(classifyCategory("Transport")).toBeNull();
    expect(classifyCategory("Obituaries")).toBeNull();
  });

  test("answers null rather than picking between two categories", () => {
    expect(classifyCategory("Sports and business")).toBeNull();
  });

  test("answers null for nothing at all", () => {
    expect(classifyCategory("")).toBeNull();
    expect(classifyCategory(null)).toBeNull();
    expect(classifyCategory(undefined)).toBeNull();
    expect(classifyCategory("   ")).toBeNull();
  });

  // A word that merely starts with the same letters is not the word.
  test("does not read an unrelated word as a category", () => {
    expect(classifyCategory("Departments")).toBeNull();
    expect(classifyCategory("Lawn care")).toBeNull();
  });
});
