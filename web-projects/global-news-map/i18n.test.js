import { describe, expect, test } from "bun:test";
import { DEFAULT_LANGUAGE, LANGUAGE_CODES, MESSAGES, fill, makeSay, pickLanguage, translate } from "./i18n.js";

const slotsIn = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("the catalogue", () => {
  test("speaks more than one language", () => {
    expect(LANGUAGE_CODES.length).toBeGreaterThan(1);
    expect(LANGUAGE_CODES).toContain(DEFAULT_LANGUAGE);
  });

  test("has every key in every language, with nothing empty", () => {
    for (const [key, entry] of Object.entries(MESSAGES)) {
      for (const lang of LANGUAGE_CODES) {
        expect(`${key} in ${lang}`).toBe(`${key} in ${lang}`);
        expect(typeof entry[lang], `${key} is missing ${lang}`).toBe("string");
        expect(entry[lang].trim().length, `${key} is empty in ${lang}`).toBeGreaterThan(0);
      }
    }
  });

  // A translation that drops a slot prints a sentence with a hole in it, and one
  // that invents a slot prints a literal "{count}" on screen.
  test("carries the same slots in every language", () => {
    for (const [key, entry] of Object.entries(MESSAGES)) {
      const expected = slotsIn(entry[DEFAULT_LANGUAGE]);
      for (const lang of LANGUAGE_CODES) {
        expect(slotsIn(entry[lang]), `${key} slots differ in ${lang}`).toEqual(expected);
      }
    }
  });

  test("holds no leftover markup", () => {
    for (const [key, entry] of Object.entries(MESSAGES)) {
      for (const lang of LANGUAGE_CODES) {
        expect(entry[lang], `${key} in ${lang}`).not.toContain("<");
      }
    }
  });
});

describe("fill", () => {
  test("puts a value into its slot", () => {
    expect(fill("{a} and {b}", { a: "one", b: "two" })).toBe("one and two");
  });

  test("uses a value more than once when the sentence does", () => {
    expect(fill("{x}-{x}", { x: "7" })).toBe("7-7");
  });

  // Leaving the slot visible makes a missing value obvious during development.
  test("leaves a slot with no value alone", () => {
    expect(fill("{a} and {b}", { a: "one" })).toBe("one and {b}");
  });

  test("accepts a number and zero, rather than treating zero as missing", () => {
    expect(fill("{n} stories", { n: 0 })).toBe("0 stories");
  });
});

describe("translate", () => {
  test("answers in the language asked for", () => {
    expect(translate("story.close", {}, "en")).toBe("Close");
    expect(translate("story.close", {}, "es")).toBe("Cerrar");
  });

  test("falls back to the default language when a language is unknown", () => {
    expect(translate("story.close", {}, "fr")).toBe(translate("story.close", {}, DEFAULT_LANGUAGE));
  });

  // A visible key is a bug report. A blank space is a bug nobody notices.
  test("shows the key itself when there is no such message", () => {
    expect(translate("no.such.key")).toBe("no.such.key");
  });

  test("fills the counts sentence in both languages", () => {
    for (const lang of LANGUAGE_CODES) {
      const line = translate("status.counts", { placed: 9, unplaced: 2 }, lang);
      expect(line).toContain("9");
      expect(line).toContain("2");
      expect(line).not.toContain("{");
    }
  });
});

describe("makeSay", () => {
  test("binds one language for the rest of the page", () => {
    expect(makeSay("es")("day.previous")).toBe("Día anterior");
  });

  test("leaves no unfilled slot in any message, in any language", () => {
    const sample = { date: "1 January", pr: "#1", history: "here", place: "Berlin", title: "Berlin", count: 3, placed: 1, unplaced: 0, portal: "portal", licence: "CC" };
    for (const lang of LANGUAGE_CODES) {
      const say = makeSay(lang);
      for (const key of Object.keys(MESSAGES)) {
        expect(`${lang} ${key}: ${say(key, sample)}`).not.toContain("{");
      }
    }
  });
});

describe("pickLanguage", () => {
  test("honours an explicit choice", () => {
    expect(pickLanguage("es", ["en-GB"])).toBe("es");
  });

  test("falls back to the browser's language when there is no choice", () => {
    expect(pickLanguage(null, ["es-ES", "en"])).toBe("es");
  });

  test("ignores a language the page does not speak", () => {
    expect(pickLanguage("de", ["fr-FR"])).toBe(DEFAULT_LANGUAGE);
  });

  test("copes with no browser languages at all", () => {
    expect(pickLanguage(null, [])).toBe(DEFAULT_LANGUAGE);
    expect(pickLanguage(null, [null, undefined])).toBe(DEFAULT_LANGUAGE);
  });
});
