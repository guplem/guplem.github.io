import { describe, test, expect } from "bun:test";
import { DEFAULT_LANGUAGE, LANGUAGES, LANGUAGE_CODES, MESSAGES, joinList, pickLanguage, t } from "./i18n.js";

describe("catalogue", () => {
  test("offers English and Spanish", () => {
    expect(LANGUAGE_CODES).toContain("en");
    expect(LANGUAGE_CODES).toContain("es");
    expect(DEFAULT_LANGUAGE).toBe("en");
    for (const language of LANGUAGES) expect(language.label.length).toBeGreaterThan(0);
  });

  test("every message exists in every language", () => {
    const missing = [];
    for (const [key, entry] of Object.entries(MESSAGES)) {
      for (const code of LANGUAGE_CODES) {
        if (typeof entry[code] !== "string" || entry[code].length === 0) missing.push(`${key}.${code}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("no message carries a language the page does not offer", () => {
    const extra = [];
    for (const [key, entry] of Object.entries(MESSAGES)) {
      for (const code of Object.keys(entry)) if (!LANGUAGE_CODES.includes(code)) extra.push(`${key}.${code}`);
    }
    expect(extra).toEqual([]);
  });

  test("every translation of a message uses the same placeholders", () => {
    const slots = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const mismatched = [];
    for (const [key, entry] of Object.entries(MESSAGES)) {
      const reference = slots(entry[DEFAULT_LANGUAGE]);
      for (const code of LANGUAGE_CODES) {
        // Technique descriptions mention set notation such as {a,b}, which is not
        // a placeholder; the slot regex only matches single words, so those are
        // skipped naturally.
        if (JSON.stringify(slots(entry[code])) !== JSON.stringify(reference)) mismatched.push(`${key}.${code}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  test("every technique in the catalogue has a name, a summary and a how-to", () => {
    const ids = [
      "naked-single", "hidden-single", "pointing", "claiming", "naked-pair", "hidden-pair",
      "naked-triple", "hidden-triple", "naked-quad", "x-wing", "y-wing", "swordfish", "xyz-wing",
    ];
    for (const id of ids) {
      for (const part of ["name", "summary", "how"]) {
        expect(MESSAGES[`technique.${id}.${part}`]).toBeDefined();
      }
    }
  });
});

describe("t", () => {
  test("returns the text for the language asked for", () => {
    expect(t("en", "ui.example")).toBe("Load an example puzzle");
    expect(t("es", "ui.example")).toBe("Cargar un ejemplo");
  });

  test("fills the placeholders", () => {
    expect(t("en", "explain.place.title", { digit: 4, cell: "r2c3" })).toBe("Place 4 in r2c3");
    expect(t("es", "explain.place.title", { digit: 4, cell: "r2c3" })).toBe("Coloca el 4 en r2c3");
  });

  test("falls back to English for a language it does not have", () => {
    expect(t("fr", "ui.example")).toBe("Load an example puzzle");
  });

  test("returns the key itself when the message is missing", () => {
    expect(t("en", "no.such.key")).toBe("no.such.key");
  });

  test("leaves a placeholder alone when no value is given", () => {
    expect(t("en", "explain.place.title", { digit: 4 })).toContain("{cell}");
  });
});

describe("joinList", () => {
  test("joins with the right word in each language", () => {
    expect(joinList("en", ["a", "b", "c"])).toBe("a, b and c");
    expect(joinList("es", ["a", "b", "c"])).toBe("a, b y c");
    expect(joinList("es", ["a", "b"])).toBe("a y b");
  });

  test("handles one item and none", () => {
    expect(joinList("en", ["only"])).toBe("only");
    expect(joinList("es", [])).toBe("");
  });
});

describe("pickLanguage", () => {
  test("uses the code that was asked for", () => {
    expect(pickLanguage("es", ["en-GB"])).toBe("es");
  });

  test("falls back to what the browser prefers", () => {
    expect(pickLanguage(null, ["es-ES", "en"])).toBe("es");
    expect(pickLanguage("de", ["es-419"])).toBe("es");
  });

  test("ends at English when nothing matches", () => {
    expect(pickLanguage(null, ["de", "fr"])).toBe("en");
    expect(pickLanguage(null, [])).toBe("en");
  });
});
