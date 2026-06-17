import { describe, test, expect } from "bun:test";
import { TRANSLATIONS, detectLanguage, t, translateToken } from "./i18n.js";

describe("detectLanguage", () => {
  test("matches the primary subtag (es-ES -> es)", () => {
    expect(detectLanguage(["es-ES", "en"])).toBe("es");
  });
  test("prefers the first supported language in the list", () => {
    expect(detectLanguage(["fr", "ca", "en"])).toBe("ca");
  });
  test("falls back to Spanish when none match", () => {
    expect(detectLanguage(["fr-FR", "de"])).toBe("es");
    expect(detectLanguage([])).toBe("es");
    expect(detectLanguage(null)).toBe("es");
  });
  test("respects a custom fallback", () => {
    expect(detectLanguage(["de"], ["ca", "es", "en"], "en")).toBe("en");
  });
});

describe("t", () => {
  test("returns the string for the language", () => {
    expect(t("en", "nav.home")).toBe("Home");
    expect(t("ca", "nav.home")).toBe("Inici");
    expect(t("es", "nav.home")).toBe("Inicio");
  });
  test("falls back to Spanish for an unknown language", () => {
    expect(t("zz", "nav.home")).toBe(t("es", "nav.home"));
  });
  test("returns the key itself when the key is unknown", () => {
    expect(t("en", "does.not.exist")).toBe("does.not.exist");
  });
  test("fills {placeholders}", () => {
    expect(t("en", "fields.tatami", { n: 2 })).toBe("Tatami 2");
    expect(t("es", "combat.label", { n: 5 })).toBe("Combate 5");
  });
});

describe("translateToken", () => {
  test("translates stored tokens for display", () => {
    expect(translateToken("en", "sex", "Masculino")).toBe("Male");
    expect(translateToken("ca", "status", "Finished")).toBe("Acabat");
    expect(translateToken("es", "side", "Red")).toBe("Rojo");
  });
  test("returns unknown tokens unchanged (never blank)", () => {
    expect(translateToken("en", "sex", "Weird")).toBe("Weird");
  });
  test("empty token -> empty string", () => {
    expect(translateToken("en", "status", "")).toBe("");
    expect(translateToken("en", "status", null)).toBe("");
  });
});

describe("translation table completeness", () => {
  test("every language has the same set of keys", () => {
    const es = Object.keys(TRANSLATIONS.es).sort();
    const ca = Object.keys(TRANSLATIONS.ca).sort();
    const en = Object.keys(TRANSLATIONS.en).sort();
    expect(ca).toEqual(es);
    expect(en).toEqual(es);
  });
});
