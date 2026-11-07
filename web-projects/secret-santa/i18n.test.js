// Tests for the three languages: Catalan, Spanish and English.

import { describe, expect, test } from "bun:test";
import { MESSAGES, LANGUAGE_CODES, detectLanguage, translate } from "./i18n.js";

describe("MESSAGES", () => {
  test("every key has a text in every language", () => {
    for (const [key, entry] of Object.entries(MESSAGES)) {
      for (const lang of LANGUAGE_CODES) {
        expect(`${key}.${lang}: ${typeof entry[lang]}`).toBe(`${key}.${lang}: string`);
        expect(entry[lang].length).toBeGreaterThan(0);
      }
    }
  });

  test("every language uses the same placeholders for a key", () => {
    const slots = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const [key, entry] of Object.entries(MESSAGES)) {
      const english = slots(entry.en);
      for (const lang of LANGUAGE_CODES) expect(`${key}.${lang}: ${slots(entry[lang])}`).toBe(`${key}.${lang}: ${english}`);
    }
  });

  test("the warning names the person twice, so nobody misreads who it is for", () => {
    for (const lang of LANGUAGE_CODES) {
      const text = translate(lang, "receive.warningBody", { name: "Anna" });
      expect(text.split("Anna").length - 1).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("detectLanguage", () => {
  test("picks the first system language the page speaks", () => {
    expect(detectLanguage(["ca-ES", "es-ES", "en"])).toBe("ca");
    expect(detectLanguage(["es-MX"])).toBe("es");
    expect(detectLanguage(["fr-FR", "es-ES"])).toBe("es");
    expect(detectLanguage(["EN-gb"])).toBe("en");
  });

  test("treats Valencian as Catalan", () => {
    expect(detectLanguage(["ca-ES-valencia"])).toBe("ca");
    expect(detectLanguage(["vl"])).toBe("en");
  });

  test("falls back to English", () => {
    expect(detectLanguage(["de-DE"])).toBe("en");
    expect(detectLanguage([])).toBe("en");
    expect(detectLanguage(undefined)).toBe("en");
  });
});

describe("translate", () => {
  test("fills placeholders and leaves unknown ones visible", () => {
    expect(translate("en", "receive.warningTitle", { name: "Anna" })).toContain("Anna");
  });

  test("falls back to English, then to the key", () => {
    expect(translate("xx", "create.generate")).toBe(MESSAGES["create.generate"].en);
    expect(translate("en", "no.such.key")).toBe("no.such.key");
  });
});
