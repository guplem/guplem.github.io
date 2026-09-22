import { describe, expect, test } from "bun:test";
import { cardMenuRows } from "./cardMenu.js";

const issue = { key: "I_1", kind: "issue", number: 87, url: "https://github.com/me/work/issues/87" };
const pull = {
  key: "PR_1",
  kind: "pull-request",
  number: 214,
  url: "https://github.com/me/work/pull/214",
  headRefName: "claude/read-the-notes",
};

const NOTHING = { note: false, branch: false, move: false, priority: false, copies: [] };

describe("cardMenuRows", () => {
  // The note is the reader's own half of this board, filed under the item's
  // node id. It follows the work wherever the card happens to be drawn, so
  // every card can take one (ADR 0022).
  test("any card can hold a note, wherever it is drawn", () => {
    expect(cardMenuRows(issue, { canMove: true }).note).toBe(true);
    expect(cardMenuRows(pull, { canMove: false }).note).toBe(true);
  });

  test("only a pull request has a branch to copy", () => {
    expect(cardMenuRows(pull, { canMove: true }).branch).toBe(true);
    expect(cardMenuRows(issue, { canMove: true }).branch).toBe(false);
  });

  // A card outside the columns has no column to move between: the review row
  // is sorted by how long something has waited, and a pull request nested in
  // its issue travels in that issue's column (ADR 0012).
  test("only a card in a column can be moved between columns", () => {
    expect(cardMenuRows(pull, { canMove: true }).move).toBe(true);
    expect(cardMenuRows(pull, { canMove: false }).move).toBe(false);
    expect(cardMenuRows(pull).move).toBe(false);
  });

  // Like a note, the mark belongs to the work and not to the place the card
  // sits, so every card can carry one: a column card, a review card, and a
  // pull request nested in its issue (ADR 0022, ADR 0026).
  test("any card can be pushed down the list, wherever it is drawn", () => {
    expect(cardMenuRows(issue, { canMove: true }).priority).toBe(true);
    expect(cardMenuRows(pull, { canMove: false }).priority).toBe(true);
  });

  // The menu is one element serving the whole board (ADR 0012), so it is
  // pointed at whatever opened it. Nothing is a card with no rows at all.
  test("never throws, and offers nothing for what is not a card", () => {
    expect(cardMenuRows(null, { canMove: true })).toEqual(NOTHING);
    expect(cardMenuRows(7)).toEqual(NOTHING);
    expect(cardMenuRows({ key: "x" }).note).toBe(true);
  });
});

// The reader writes their own lines in Settings, and each one becomes a row in
// this menu. Which of them a card offers is decided here, with every other row,
// rather than in `app.js`: that is the drift ADR 0022 exists to stop (ADR 0031).
describe("the lines the reader wrote (ADR 0031)", () => {
  const actions = [
    { id: "a1", label: "Implement", template: "/implement-issue #{N}" },
    { id: "a2", label: "Check out", template: "git checkout {BRANCH}" },
  ];

  test("every action the card can fill is a row, in the order Settings holds them", () => {
    expect(cardMenuRows(pull, { copyActions: actions }).copies).toEqual(actions);
  });

  // An issue has no branch, so a row that would copy "git checkout " is not
  // offered at all. The same answer "Copy branch name" gives (ADR 0021).
  test("an action asking for something the card has not is left out", () => {
    expect(cardMenuRows(issue, { copyActions: actions }).copies).toEqual([actions[0]]);
  });

  test("nobody has written one yet, so there are no rows", () => {
    expect(cardMenuRows(pull).copies).toEqual([]);
    expect(cardMenuRows(pull, { copyActions: null }).copies).toEqual([]);
  });

  test("a row appears wherever the card is drawn, like the note does", () => {
    expect(cardMenuRows(pull, { canMove: false, copyActions: actions }).copies).toEqual(actions);
  });
});
