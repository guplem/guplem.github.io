// Tests for the message the organiser copies or shares with the link.

import { describe, expect, test } from "bun:test";
import { LANGUAGE_CODES } from "./i18n.js";
import { shareMessage, whatsappUrl } from "./share.js";

const URL_ = "https://triunitystudios.com/web-projects/secret-santa/?e=abc";

describe("shareMessage", () => {
  test("holds the title and the link, in every language", () => {
    for (const lang of LANGUAGE_CODES) {
      const text = shareMessage(lang, { title: "Nadal 2026", url: URL_ });
      expect(text).toContain("Nadal 2026");
      expect(text).toContain(URL_);
      expect(text).not.toContain("{");
    }
  });

  test("is different in each language", () => {
    const texts = new Set(LANGUAGE_CODES.map((lang) => shareMessage(lang, { title: "X", url: URL_ })));
    expect(texts.size).toBe(LANGUAGE_CODES.length);
  });

  test("uses the app name in that language when there is no title", () => {
    expect(shareMessage("ca", { title: "", url: URL_ })).toContain("Amic invisible");
    expect(shareMessage("es", { title: "  ", url: URL_ })).toContain("Amigo invisible");
  });

  test("puts the link on its own last line, so chat apps make it a link", () => {
    const lines = shareMessage("en", { title: "X", url: URL_ }).split("\n");
    expect(lines.at(-1)).toBe(URL_);
  });
});

describe("whatsappUrl", () => {
  test("opens WhatsApp with the message filled in", () => {
    const url = whatsappUrl("Hola & adéu\nhttps://x.y/?e=1");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe("Hola & adéu\nhttps://x.y/?e=1");
  });
});
