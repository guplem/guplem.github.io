import { describe, expect, test } from "bun:test";
import {
  EXAMPLE_ACTIONS,
  PLACEHOLDERS,
  canFillTemplate,
  fillCopyTemplate,
  orderCopyActions,
  placeholdersIn,
} from "./copyActions.js";

const pull = {
  key: "PR_1",
  kind: "pull-request",
  number: 214,
  title: "Read the notes back",
  repository: "me/work",
  url: "https://github.com/me/work/pull/214",
  headRefName: "claude/read-the-notes",
};

const issue = {
  key: "I_1",
  kind: "issue",
  number: 87,
  title: "The board forgets a note",
  repository: "me/work",
  url: "https://github.com/me/work/issues/87",
};

describe("fillCopyTemplate", () => {
  test("puts the card's own values where the placeholders are", () => {
    expect(fillCopyTemplate("/implement-issue #{N}", issue)).toBe("/implement-issue #87");
    expect(fillCopyTemplate("Please review {URL}", pull)).toBe("Please review https://github.com/me/work/pull/214");
    expect(fillCopyTemplate("{REPO} {TITLE} {BRANCH}", pull)).toBe(
      "me/work Read the notes back claude/read-the-notes",
    );
  });

  test("fills the same placeholder every time it appears", () => {
    expect(fillCopyTemplate("#{N} then #{N}", issue)).toBe("#87 then #87");
  });

  // The reader types the template by hand, and a board that quietly drops what
  // it did not recognise would hand back text with a hole in it. Left as it
  // was, the mistake is in the clipboard where the reader can see it.
  test("leaves a placeholder nobody offers exactly as it was typed", () => {
    expect(fillCopyTemplate("{N} {AUTHOR}", issue)).toBe("87 {AUTHOR}");
  });

  test("the case of a placeholder does not matter", () => {
    expect(fillCopyTemplate("{url}", issue)).toBe("https://github.com/me/work/issues/87");
  });

  test("never throws, whatever it is handed", () => {
    expect(fillCopyTemplate("{N}", null)).toBe("");
    expect(fillCopyTemplate(null, issue)).toBe("");
    expect(fillCopyTemplate("{BRANCH}", issue)).toBe("");
  });
});

describe("placeholdersIn", () => {
  test("names the placeholders a template uses, once each", () => {
    expect(placeholdersIn("#{N} {URL} {N}")).toEqual(["{N}", "{URL}"]);
    expect(placeholdersIn("nothing to fill")).toEqual([]);
    expect(placeholdersIn("{AUTHOR}")).toEqual([]);
  });
});

describe("canFillTemplate", () => {
  // The same answer the menu already gives for "Copy branch name": an issue
  // has no branch, so a row that would copy an empty one is not offered at all
  // (ADR 0022).
  test("a template asking for something the card has not is not offered", () => {
    expect(canFillTemplate("checkout {BRANCH}", pull)).toBe(true);
    expect(canFillTemplate("checkout {BRANCH}", issue)).toBe(false);
  });

  test("a template with nothing to fill is always offered", () => {
    expect(canFillTemplate("hello", issue)).toBe(true);
  });

  test("never throws, whatever it is handed", () => {
    expect(canFillTemplate("{N}", null)).toBe(false);
    expect(canFillTemplate(null, issue)).toBe(false);
  });
});

describe("orderCopyActions", () => {
  const now = "2026-09-22T10:00:00.000Z";
  const later = "2026-09-22T11:00:00.000Z";

  test("oldest first, so the list holds still as the reader adds to it", () => {
    const stored = {
      b: { label: "Second", template: "{N}", createdAt: later, updatedAt: later },
      a: { label: "First", template: "{URL}", createdAt: now, updatedAt: now },
    };
    expect(orderCopyActions(stored).map((one) => one.label)).toEqual(["First", "Second"]);
  });

  // Two devices can write an action in the same second. The id breaks the tie,
  // so both read the same order on both machines.
  test("two actions made in the same moment are ordered by their id", () => {
    const stored = {
      b: { label: "B", template: "{N}", createdAt: now, updatedAt: now },
      a: { label: "A", template: "{N}", createdAt: now, updatedAt: now },
    };
    expect(orderCopyActions(stored).map((one) => one.id)).toEqual(["a", "b"]);
  });

  // A removed action keeps its key with an empty template, the same way a
  // cleared note keeps its key: the other device has to tell "removed just now"
  // from "never seen" (ADR 0002).
  test("an action with no template left is one the reader removed", () => {
    const stored = {
      a: { label: "Gone", template: "", createdAt: now, updatedAt: later },
      b: { label: "Here", template: "{N}", createdAt: now, updatedAt: now },
    };
    expect(orderCopyActions(stored).map((one) => one.id)).toEqual(["b"]);
  });

  test("an action with no label is named by what it copies", () => {
    const stored = { a: { label: "  ", template: "/implement-issue #{N}", createdAt: now, updatedAt: now } };
    expect(orderCopyActions(stored)[0].label).toBe("/implement-issue #{N}");
  });

  test("the text is trimmed, because a stray space is not a name", () => {
    const stored = { a: { label: " Implement ", template: " #{N} ", createdAt: now, updatedAt: now } };
    expect(orderCopyActions(stored)[0]).toEqual({
      id: "a",
      label: "Implement",
      template: "#{N}",
      createdAt: now,
    });
  });

  test("never throws, whatever is in the file", () => {
    expect(orderCopyActions(null)).toEqual([]);
    expect(orderCopyActions({ a: 7, b: null, c: { template: "{N}" } })).toEqual([
      { id: "c", label: "{N}", template: "{N}", createdAt: "" },
    ]);
  });
});

describe("what the reader is offered", () => {
  // A token is written into board.json the moment the reader saves a template,
  // so renaming one breaks every template already saved. The list is also what
  // Settings shows, so it carries its own words for each one.
  test("every placeholder is one word in braces, said once, with an explanation", () => {
    const tokens = PLACEHOLDERS.map((one) => one.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const one of PLACEHOLDERS) {
      expect(one.token).toMatch(/^\{[A-Z]+\}$/);
      expect(one.describe.length).toBeGreaterThan(0);
    }
  });

  // The examples are what an empty Settings shows, so a placeholder that is no
  // longer offered would be suggested to every new reader.
  test("each example uses only placeholders the board fills", () => {
    expect(EXAMPLE_ACTIONS.length).toBeGreaterThanOrEqual(2);
    for (const one of EXAMPLE_ACTIONS) {
      expect(one.label.length).toBeGreaterThan(0);
      expect(placeholdersIn(one.template).length).toBeGreaterThan(0);
      expect(one.template.match(/\{[A-Za-z]+\}/g)).toEqual(placeholdersIn(one.template));
    }
  });
});
