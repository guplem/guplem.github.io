// Tests for the message catalogue.
//
// A half-translated page is worse than an English one, because the missing half
// shows up as a raw key like `ui.copied` in the middle of a sentence. These
// tests make that impossible to merge: every key must exist in every language,
// and every placeholder must exist in every language too.

import { describe, expect, test } from "bun:test";
import { DEFAULT_LANGUAGE, LANGUAGES, LANGUAGE_CODES, MESSAGES, pickLanguage, sayIn, t } from "./i18n.js";
import { CATEGORIES, UNITS } from "./units.js";

/** The `{name}` slots in one sentence. */
const slotsIn = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("the catalogue", () => {
  test("offers at least English and Spanish, and starts in one of them", () => {
    expect(LANGUAGE_CODES).toContain("en");
    expect(LANGUAGE_CODES).toContain("es");
    expect(LANGUAGE_CODES).toContain(DEFAULT_LANGUAGE);
    for (const language of LANGUAGES) expect(typeof language.label).toBe("string");
  });

  test("says every key in every language", () => {
    for (const [key, entry] of Object.entries(MESSAGES)) {
      for (const lang of LANGUAGE_CODES) {
        expect(`${key}/${lang}: ${typeof entry[lang]}`).toBe(`${key}/${lang}: string`);
        expect(`${key}/${lang}: ${entry[lang].trim() === ""}`).toBe(`${key}/${lang}: false`);
      }
    }
  });

  test("keeps the same placeholders in every language", () => {
    for (const [key, entry] of Object.entries(MESSAGES)) {
      const expected = slotsIn(entry[DEFAULT_LANGUAGE]).join(",");
      for (const lang of LANGUAGE_CODES) {
        expect(`${key}/${lang}: ${slotsIn(entry[lang]).join(",")}`).toBe(`${key}/${lang}: ${expected}`);
      }
    }
  });
});

describe("names that live outside the catalogue", () => {
  test("every unit is named in every language", () => {
    for (const unit of UNITS) {
      for (const lang of LANGUAGE_CODES) {
        expect(`${unit.id}/${lang}: ${typeof unit.name[lang]}`).toBe(`${unit.id}/${lang}: string`);
      }
      if (unit.tag) for (const lang of LANGUAGE_CODES) expect(`${unit.id}/${lang}: ${typeof unit.tag[lang]}`).toBe(`${unit.id}/${lang}: string`);
    }
  });

  test("every category is named in every language", () => {
    for (const category of CATEGORIES) {
      for (const lang of LANGUAGE_CODES) {
        expect(`${category.id}/${lang}: ${typeof category.name[lang]}`).toBe(`${category.id}/${lang}: string`);
      }
    }
  });
});

describe("t", () => {
  test("gives the sentence in the language asked for", () => {
    expect(t("ui.results", "en")).toBe("Results");
    expect(t("ui.results", "es")).toBe("Resultados");
  });

  test("fills the placeholders", () => {
    expect(t("ui.copied", "en", { value: "62.14" })).toBe("Copied 62.14");
    expect(t("ui.showAll", "es", { n: 7 })).toContain("7");
  });

  test("leaves a placeholder it was given nothing for, rather than writing 'undefined'", () => {
    expect(t("ui.copied", "en")).toBe("Copied {value}");
  });

  test("falls back to English for a language it does not speak", () => {
    expect(t("ui.results", "kl")).toBe("Results");
  });

  test("gives back the key itself for a key that is not in the catalogue", () => {
    // A visible `ui.nothing` is found in one glance; an empty string is not.
    expect(t("ui.nothing", "en")).toBe("ui.nothing");
  });

  test("sayIn binds one language", () => {
    expect(sayIn("es")("ui.results")).toBe("Resultados");
    expect(sayIn("es")("ui.copied", { value: "1" })).toBe("Copiado 1");
  });
});

describe("pickLanguage", () => {
  test("takes the one asked for when the page speaks it", () => {
    expect(pickLanguage("es", ["en-GB"])).toBe("es");
  });

  test("falls back to the reader's browser", () => {
    expect(pickLanguage(null, ["es-ES", "en"])).toBe("es");
    expect(pickLanguage("kl", ["es-419"])).toBe("es");
  });

  test("falls back to English when nothing else fits", () => {
    expect(pickLanguage(null, ["fr-FR", "de"])).toBe("en");
    expect(pickLanguage(null, [])).toBe("en");
    expect(pickLanguage(null)).toBe("en");
  });
});
