// Tests for choosing a word and for the links around it.

import { describe, expect, test } from "bun:test";
import { apiUrl, pickWord, raeUrl, searchForWord, wiktionaryUrl, wordFromSearch } from "./pick.js";
import { WORDS } from "./words.js";

const LIST = ["casa", "perro", "zumo"];

describe("pickWord", () => {
  test("maps the random number onto the list", () => {
    expect(pickWord(LIST, () => 0)).toBe("casa");
    expect(pickWord(LIST, () => 0.5)).toBe("perro");
    expect(pickWord(LIST, () => 0.999)).toBe("zumo");
  });

  // A reader who presses "another word" must always see a new one.
  test("never repeats the word on screen", () => {
    expect(pickWord(LIST, () => 0, "casa")).toBe("perro");
    expect(pickWord(LIST, () => 0.999, "zumo")).toBe("casa");
  });

  test("returns the only word of a one-word list, even when it is on screen", () => {
    expect(pickWord(["casa"], () => 0, "casa")).toBe("casa");
  });
});

describe("wordFromSearch", () => {
  test("reads the word from the link", () => {
    expect(wordFromSearch("?palabra=perro", LIST)).toBe("perro");
  });

  test("ignores case and spaces", () => {
    expect(wordFromSearch("?palabra=%20Perro%20", LIST)).toBe("perro");
  });

  test("returns null for a word that is not in the list, or no word", () => {
    expect(wordFromSearch("?palabra=empero", LIST)).toBeNull();
    expect(wordFromSearch("", LIST)).toBeNull();
  });
});

describe("searchForWord", () => {
  test("writes a link that wordFromSearch reads back", () => {
    expect(searchForWord("pingüino")).toBe("?palabra=ping%C3%BCino");
    expect(wordFromSearch(searchForWord("pingüino"), ["pingüino"])).toBe("pingüino");
  });
});

describe("links", () => {
  test("asks the Wiktionary API for the page source, with CORS allowed", () => {
    const url = new URL(apiUrl("pingüino"));
    expect(url.origin).toBe("https://es.wiktionary.org");
    expect(url.searchParams.get("titles")).toBe("pingüino");
    expect(url.searchParams.get("origin")).toBe("*");
    expect(url.searchParams.get("prop")).toBe("revisions");
  });

  test("links the Wiktionary page and the RAE dictionary", () => {
    expect(wiktionaryUrl("año")).toBe("https://es.wiktionary.org/wiki/a%C3%B1o");
    expect(raeUrl("año")).toBe("https://dle.rae.es/a%C3%B1o");
  });
});

describe("the word list", () => {
  test("holds thousands of words, each once, all lower case", () => {
    expect(WORDS.length).toBeGreaterThan(3000);
    expect(new Set(WORDS).size).toBe(WORDS.length);
    expect(WORDS.every((word) => /^[a-záéíóúüñ]+$/.test(word))).toBe(true);
  });

  test("keeps everyday words from Spain and leaves out old or foreign ones", () => {
    for (const word of ["casa", "perro", "ordenador", "coger"]) expect(WORDS).toContain(word);
    for (const word of ["empero", "computadora", "platicar", "guagua"]) expect(WORDS).not.toContain(word);
  });
});
