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

describe("readSearch", () => {
  test("an empty box is no search at all", () => {
    expect(readSearch("")).toBe(null);
    expect(readSearch("   ")).toBe(null);
    expect(readSearch(undefined)).toBe(null);
  });

  test("a number is a number, with or without the hash GitHub writes before it", () => {
    expect(readSearch("312")).toEqual({ number: 312, repository: null, words: [] });
    expect(readSearch(" #312 ")).toEqual({ number: 312, repository: null, words: [] });
  });

  test("a link pasted from GitHub names the number and the repository", () => {
    expect(readSearch("https://github.com/Me/Alpha/pull/312")).toEqual({
      number: 312,
      repository: "me/alpha",
      words: [],
    });
    expect(readSearch("github.com/me/alpha/issues/7#issuecomment-1")).toEqual({
      number: 7,
      repository: "me/alpha",
      words: [],
    });
  });

  test("anything else is words, in lower case", () => {
    expect(readSearch("Fix  Login")).toEqual({ number: null, repository: null, words: ["fix", "login"] });
  });
});

describe("itemMatchesSearch", () => {
  test("a number finds that number and no number that merely contains it", () => {
    const search = readSearch("31");
    expect(itemMatchesSearch(item({ number: 31 }), search)).toBe(true);
    expect(itemMatchesSearch(item({ number: 312 }), search)).toBe(false);
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

  test("words find the title, whatever the case, and every word must be there", () => {
    const one = item({ title: "Fix the login screen" });
    expect(itemMatchesSearch(one, readSearch("LOGIN"))).toBe(true);
    expect(itemMatchesSearch(one, readSearch("login fix"))).toBe(true);
    expect(itemMatchesSearch(one, readSearch("login logout"))).toBe(false);
  });

  test("words find the repository too", () => {
    expect(itemMatchesSearch(item({ repository: "me/alpha" }), readSearch("alpha"))).toBe(true);
  });

  test("no search keeps everything", () => {
    expect(itemMatchesSearch(item(), null)).toBe(true);
  });
});

describe("searchGroups", () => {
  const issue = item({ key: "i", number: 10 });
  const pull = item({ key: "p", kind: "pull-request", number: 11 });
  const other = item({ key: "o", number: 12 });
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
    const list = [item({ key: "a", number: 5 }), item({ key: "b", number: 6 }), item({ key: "c", number: 5 })];
    expect(keys(searchItems(list, readSearch("5")))).toEqual(["a", "c"]);
  });
});
