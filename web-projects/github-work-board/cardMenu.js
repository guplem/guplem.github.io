// Which rows the card menu offers for the card that opened it.
//
// One menu element serves the whole board (ADR 0012), so it is pointed at
// whatever opened it and has to decide what that card can actually do. The
// three answers went in one at a time as ad-hoc conditions in `app.js`, and a
// note quietly stopped being addable anywhere but the columns. They live here
// now, where a test can say what is true (ADR 0022).

/**
 * @param item the work item the menu was opened for
 * @param canMove whether this card sits in a column it could be moved between
 */
export function cardMenuRows(item, { canMove = false } = {}) {
  const kind = item && typeof item === "object" ? item.kind : null;
  if (!item || typeof item !== "object") return { note: false, branch: false, move: false };

  return {
    // Every card, wherever it is drawn. A note is filed under the item's node
    // id, so it belongs to the work and not to the place the card sits: the
    // review row and a nested pull request take one exactly like a column does.
    note: true,
    // An issue has no branch.
    branch: kind === "pull-request",
    // A card outside the columns has no column to move between. The review row
    // is ordered by how long something has waited, and a pull request nested in
    // its issue travels in that issue's column (ADR 0012).
    move: canMove === true,
  };
}
