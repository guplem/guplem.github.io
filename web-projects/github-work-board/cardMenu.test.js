import { describe, expect, test } from "bun:test";
import { cardMenuRows } from "./cardMenu.js";

const issue = { key: "I_1", kind: "issue" };
const pull = { key: "PR_1", kind: "pull-request" };

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
    expect(cardMenuRows(null, { canMove: true })).toEqual({ note: false, branch: false, move: false, priority: false });
    expect(cardMenuRows(7)).toEqual({ note: false, branch: false, move: false, priority: false });
    expect(cardMenuRows({ key: "x" }).note).toBe(true);
  });
});
