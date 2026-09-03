import { describe, expect, test } from "bun:test";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_CODES,
  MESSAGES,
  pickLanguage,
  sayFinding,
  sayIn,
  t,
} from "./i18n.js";
import { FILTER_PRESETS } from "./filters.js";
import { TEXT_STYLES } from "./textLayout.js";
import { checkPack, checkSticker } from "./spec.js";

const slotsIn = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("the catalogue", () => {
  test("says every key in every language", () => {
    for (const [key, entry] of Object.entries(MESSAGES)) {
      for (const lang of LANGUAGE_CODES) {
        expect(`${key}/${lang}: ${typeof entry[lang]}`).toBe(`${key}/${lang}: string`);
        expect(`${key}/${lang} is empty: ${entry[lang].trim() === ""}`).toBe(
          `${key}/${lang} is empty: false`,
        );
      }
    }
  });

  test("keeps the same placeholders in every language", () => {
    // A translation that drops a slot silently loses the number the sentence
    // was about, which is worse than not translating it at all.
    for (const [key, entry] of Object.entries(MESSAGES)) {
      const expected = slotsIn(entry[DEFAULT_LANGUAGE]).join(",");
      for (const lang of LANGUAGE_CODES) {
        expect(`${key}/${lang}: ${slotsIn(entry[lang]).join(",")}`).toBe(
          `${key}/${lang}: ${expected}`,
        );
      }
    }
  });

  test("offers exactly the languages it lists", () => {
    expect(LANGUAGES.map((language) => language.code)).toEqual(LANGUAGE_CODES);
    expect(LANGUAGE_CODES).toContain(DEFAULT_LANGUAGE);
  });
});

describe("t", () => {
  test("says a plain message", () => {
    expect(t("tool.cutout", "en")).toBe("Cut out");
    expect(t("tool.cutout", "es")).toBe("Recortar");
  });

  test("fills in the numbers", () => {
    expect(t("rule.sticker.tooManyEmojis", "en", { max: 3 })).toBe(
      "A sticker carries at most 3 emoji.",
    );
  });

  test("leaves a placeholder it was given nothing for", () => {
    // Better a visible gap than the word "undefined" on the page.
    expect(t("rule.sticker.tooManyEmojis", "en")).toContain("{max}");
  });

  test("falls back to English for a language it does not speak", () => {
    expect(t("tool.cutout", "kl")).toBe("Cut out");
  });

  test("returns the key itself for a message that is not there", () => {
    expect(t("ui.nothing", "en")).toBe("ui.nothing");
  });

  test("sayIn binds one language", () => {
    expect(sayIn("es")("tool.text")).toBe("Texto");
  });
});

describe("pickLanguage", () => {
  test("takes the language asked for", () => {
    expect(pickLanguage("es")).toBe("es");
  });

  test("falls back to one the browser lists", () => {
    expect(pickLanguage(undefined, ["es-ES", "en"])).toBe("es");
    expect(pickLanguage("de", ["fr-FR", "es-MX"])).toBe("es");
  });

  test("falls back to English when nothing matches", () => {
    expect(pickLanguage(undefined, ["de", "fr"])).toBe("en");
    expect(pickLanguage()).toBe("en");
  });

  test("survives a browser list that holds nothing useful", () => {
    expect(pickLanguage(undefined, [null, undefined, ""])).toBe("en");
  });
});

describe("every rule has a sentence", () => {
  /** Break every sticker rule at once, so each one produces a finding. */
  const brokenSticker = {
    byteLength: 999999,
    width: 100,
    height: 200,
    frameDurationsMs: [1],
    emojis: [],
    accessibilityText: "a".repeat(500),
    hasTransparency: false,
    touchesEdge: true,
  };

  const brokenPack = {
    name: "",
    publisher: "a".repeat(200),
    identifier: "not/legal..",
    publisherEmail: "nope",
    publisherWebsite: "example.com",
    tray: { byteLength: 999999, width: 4, height: 4, isPng: false },
    stickers: [brokenSticker, { ...brokenSticker, frameDurationsMs: [100, 100] }],
  };

  test("covers every sticker rule the checker can report", () => {
    // This is the test that stops a new rule shipping without a message. A
    // rule with no sentence renders as its own key on the page.
    for (const finding of checkSticker(brokenSticker)) {
      expect(`${finding.rule}: ${MESSAGES[`rule.${finding.rule}`] !== undefined}`).toBe(
        `${finding.rule}: true`,
      );
    }
  });

  test("covers every pack rule the checker can report", () => {
    for (const finding of checkPack(brokenPack)) {
      expect(`${finding.rule}: ${MESSAGES[`rule.${finding.rule}`] !== undefined}`).toBe(
        `${finding.rule}: true`,
      );
    }
  });

  test("covers the two rules only a nearly-good pack reports", () => {
    // A tray icon that is legal but not the recommended size, and a pack
    // that mixes still and animated stickers, only appear when everything
    // else about the pack is right.
    const almost = {
      name: "A",
      publisher: "B",
      identifier: "a-b",
      tray: { byteLength: 100, width: 128, height: 128, isPng: true },
      stickers: [
        { ...brokenSticker, width: 512, height: 512, byteLength: 10, emojis: ["a"], accessibilityText: "", frameDurationsMs: [], hasTransparency: true, touchesEdge: false },
        { ...brokenSticker, width: 512, height: 512, byteLength: 10, emojis: ["a"], accessibilityText: "", frameDurationsMs: [100, 100], hasTransparency: true, touchesEdge: false },
        { ...brokenSticker, width: 512, height: 512, byteLength: 10, emojis: ["a"], accessibilityText: "", frameDurationsMs: [], hasTransparency: true, touchesEdge: false },
      ],
    };
    const rules = checkPack(almost).map((finding) => finding.rule);
    expect(rules).toContain("pack.trayNotRecommended");
    expect(rules).toContain("pack.mixed");
    for (const rule of rules) {
      expect(`${rule}: ${MESSAGES[`rule.${rule}`] !== undefined}`).toBe(`${rule}: true`);
    }
  });

  test("writes a sentence with no placeholder left in it, in both languages", () => {
    for (const finding of [...checkSticker(brokenSticker), ...checkPack(brokenPack)]) {
      for (const lang of LANGUAGE_CODES) {
        const sentence = sayFinding(finding, lang);
        expect(`${finding.rule}/${lang}: ${sentence}`).not.toContain("{");
        expect(`${finding.rule}/${lang}: ${sentence}`).not.toContain("undefined");
      }
    }
  });
});

describe("sayFinding", () => {
  test("turns bytes into the kilobytes a person reads", () => {
    const finding = {
      rule: "sticker.tooBig",
      severity: "error",
      params: { byteLength: 143360, maxBytes: 102400 },
    };
    expect(sayFinding(finding, "en")).toBe("This sticker is 140 KB. The limit is 100 KB.");
  });

  test("turns milliseconds into the seconds a person reads", () => {
    const finding = { rule: "sticker.tooLong", severity: "error", params: { totalMs: 14500 } };
    expect(sayFinding(finding, "en")).toContain("14.5 s");
  });

  test("says the same finding in Spanish", () => {
    const finding = {
      rule: "sticker.tooBig",
      severity: "error",
      params: { byteLength: 143360, maxBytes: 102400 },
    };
    expect(sayFinding(finding, "es")).toBe("Este sticker pesa 140 KB. El límite es 100 KB.");
  });
});

describe("every list on screen has its labels", () => {
  test("names every colour preset", () => {
    for (const preset of FILTER_PRESETS) {
      expect(`${preset.id}: ${MESSAGES[preset.labelKey] !== undefined}`).toBe(
        `${preset.id}: true`,
      );
    }
  });

  test("names every text style", () => {
    for (const style of TEXT_STYLES) {
      expect(`${style.id}: ${MESSAGES[style.labelKey] !== undefined}`).toBe(`${style.id}: true`);
    }
  });

  test("names every language in its own language", () => {
    // A picker that says "Spanish" to a Spanish reader is no help.
    expect(LANGUAGES.find((language) => language.code === "es").label).toBe("Español");
  });
});
