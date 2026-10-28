import { describe, expect, test } from "bun:test";
import { itemMatchesSearch, readSearch, searchGroups, searchItems } from "./boardSearch.js";

const item = (over = {}) => ({
  key: "k",
  kind: "issue",
  number: 1,
  title: "a title",
  repository: "me/alpha",
  ...over,
});

const keys = (list) => list.map((one) => one.key);

const LOOSE = { matchCase: false, wholeWord: false };

describe("readSearch", () => {
  test("an empty box is no search at all", () => {
    expect(readSearch("")).toBe(null);
    expect(readSearch("   ")).toBe(null);
    expect(readSearch(undefined)).toBe(null);
  });

  test("a number is a number, with or without the hash GitHub writes before it", () => {
    expect(readSearch("312")).toEqual({ number: "312", repository: null, words: [], ...LOOSE });
    expect(readSearch(" #312 ")).toEqual({ number: "312", repository: null, words: [], ...LOOSE });
  });

  test("a link pasted from GitHub names the number and the repository", () => {
    expect(readSearch("https://github.com/Me/Alpha/pull/312")).toEqual({
      number: "312",
      repository: "me/alpha",
      words: [],
      ...LOOSE,
    });
    expect(readSearch("github.com/me/alpha/issues/7#issuecomment-1")).toEqual({
      number: "7",
      repository: "me/alpha",
      words: [],
      ...LOOSE,
    });
  });

  test("anything else is words, kept as typed so the case can still count", () => {
    expect(readSearch("Fix  Login")).toEqual({ number: null, repository: null, words: ["Fix", "Login"], ...LOOSE });
  });

  test("both choices are off unless the reader turns them on", () => {
    expect(readSearch("x", { matchCase: true })).toMatchObject({ matchCase: true, wholeWord: false });
    expect(readSearch("x", { wholeWord: true })).toMatchObject({ matchCase: false, wholeWord: true });
  });
});

describe("itemMatchesSearch, with both choices off", () => {
  // The reader narrows as they type, the way words already do: "31" keeps
  // #31, #312 and #131 until the whole number is in.
  test("a number finds every number that contains it", () => {
    const search = readSearch("31");
    expect(itemMatchesSearch(item({ number: 31 }), search)).toBe(true);
    expect(itemMatchesSearch(item({ number: 312 }), search)).toBe(true);
    expect(itemMatchesSearch(item({ number: 131 }), search)).toBe(true);
    expect(itemMatchesSearch(item({ number: 3 }), search)).toBe(false);
  });

  // Two repositories can each have a #12. A bare number shows both; a link
  // names the one it means.
  test("a bare number finds it in every repository, and a link in its own", () => {
    const alpha = item({ number: 12, repository: "me/alpha" });
    const beta = item({ number: 12, repository: "me/beta" });
    expect(itemMatchesSearch(alpha, readSearch("12"))).toBe(true);
    expect(itemMatchesSearch(beta, readSearch("12"))).toBe(true);
    expect(itemMatchesSearch(alpha, readSearch("https://github.com/me/beta/issues/12"))).toBe(false);
    expect(itemMatchesSearch(beta, readSearch("https://github.com/me/beta/issues/12"))).toBe(true);
  });

  // A link names one piece of work, so it never finds a number that merely
  // contains its own.
  test("a link finds its number exactly", () => {
    const link = readSearch("https://github.com/me/alpha/pull/31");
    expect(itemMatchesSearch(item({ number: 31 }), link)).toBe(true);
    expect(itemMatchesSearch(item({ number: 312 }), link)).toBe(false);
  });

  test("words find the title, whatever the case, and every word must be there", () => {
    const one = item({ title: "Fix the login screen" });
    expect(itemMatchesSearch(one, readSearch("LOGIN"))).toBe(true);
    expect(itemMatchesSearch(one, readSearch("login fix"))).toBe(true);
    expect(itemMatchesSearch(one, readSearch("login logout"))).toBe(false);
  });

  test("words find part of a word", () => {
    expect(itemMatchesSearch(item({ title: "Fix the login screen" }), readSearch("log scr"))).toBe(true);
  });

  test("words find the repository too", () => {
    expect(itemMatchesSearch(item({ repository: "me/alpha" }), readSearch("alpha"))).toBe(true);
  });

  test("no search keeps everything", () => {
    expect(itemMatchesSearch(item(), null)).toBe(true);
  });
});

describe("itemMatchesSearch, with match case on", () => {
  const one = item({ title: "Fix the Login screen", repository: "Me/Alpha" });

  test("a word must be written in the same case", () => {
    expect(itemMatchesSearch(one, readSearch("Login", { matchCase: true }))).toBe(true);
    expect(itemMatchesSearch(one, readSearch("login", { matchCase: true }))).toBe(false);
  });

  test("the repository is matched in its own case too", () => {
    expect(itemMatchesSearch(one, readSearch("Alpha", { matchCase: true }))).toBe(true);
    expect(itemMatchesSearch(one, readSearch("alpha", { matchCase: true }))).toBe(false);
  });

  // GitHub treats a repository name in any case as the same repository, so a
  // pasted link must keep finding its card whatever this choice says.
  test("a pasted link still finds its repository in any case", () => {
    const link = readSearch("https://github.com/me/alpha/issues/1", { matchCase: true });
    expect(itemMatchesSearch(item({ number: 1, repository: "Me/Alpha" }), link)).toBe(true);
  });
});

describe("itemMatchesSearch, with whole word on", () => {
  const one = item({ title: "Fix the login-screen", repository: "me/alpha" });

  test("a word must be a whole word, not part of one", () => {
    expect(itemMatchesSearch(one, readSearch("login", { wholeWord: true }))).toBe(true);
    expect(itemMatchesSearch(one, readSearch("log", { wholeWord: true }))).toBe(false);
    expect(itemMatchesSearch(one, readSearch("alpha", { wholeWord: true }))).toBe(true);
    expect(itemMatchesSearch(one, readSearch("alp", { wholeWord: true }))).toBe(false);
  });

  test("the case still does not count unless match case is on too", () => {
    expect(itemMatchesSearch(one, readSearch("LOGIN", { wholeWord: true }))).toBe(true);
    expect(itemMatchesSearch(one, readSearch("LOGIN", { wholeWord: true, matchCase: true }))).toBe(false);
  });

  test("a word with punctuation in it is read as written, not as a pattern", () => {
    expect(itemMatchesSearch(one, readSearch("login-screen", { wholeWord: true }))).toBe(true);
    expect(itemMatchesSearch(item({ title: "a (b) c" }), readSearch("(b)", { wholeWord: true }))).toBe(true);
    expect(itemMatchesSearch(item({ title: "a xb c" }), readSearch(".b", { wholeWord: true }))).toBe(false);
  });

  test("a number finds that number and no number that merely contains it", () => {
    const search = readSearch("31", { wholeWord: true });
    expect(itemMatchesSearch(item({ number: 31 }), search)).toBe(true);
    expect(itemMatchesSearch(item({ number: 312 }), search)).toBe(false);
  });
});

describe("searchGroups", () => {
  const issue = item({ key: "i", number: 10 });
  const pull = item({ key: "p", kind: "pull-request", number: 11 });
  const other = item({ key: "o", number: 22 });
  const groups = [
    { item: issue, children: [pull] },
    { item: other, children: [] },
  ];

  // A pull request travels inside the card of the issue it closes, so the card
  // it is drawn in is the one that has to stay.
  test("a pull request nested in a card keeps that card, with the pull request in it", () => {
    expect(searchGroups(groups, readSearch("11"))).toEqual([{ item: issue, children: [pull] }]);
  });

  test("a card that matches keeps its nested work", () => {
    expect(searchGroups(groups, readSearch("10"))).toEqual([{ item: issue, children: [pull] }]);
  });

  test("no search keeps every group, in the same order", () => {
    expect(searchGroups(groups, null)).toEqual(groups);
  });
});

describe("searchItems", () => {
  test("keeps the matching items in the order they came", () => {
    const list = [item({ key: "a", number: 5 }), item({ key: "b", number: 6 }), item({ key: "c", number: 15 })];
    expect(keys(searchItems(list, readSearch("5")))).toEqual(["a", "c"]);
  });
});
