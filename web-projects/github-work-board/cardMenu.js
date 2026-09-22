// Which rows the card menu offers for the card that opened it.
//
// One menu element serves the whole board (ADR 0012), so it is pointed at
// whatever opened it and has to decide what that card can actually do. The
// three answers went in one at a time as ad-hoc conditions in `app.js`, and a
// note quietly stopped being addable anywhere but the columns. They live here
// now, where a test can say what is true (ADR 0022).
//
// The reader's own lines are decided here too. Each one is a row, and a row is
// offered only when this card holds everything its template asks for (ADR 0031).

import { canFillTemplate } from "./copyActions.js";

/**
 * @param item the work item the menu was opened for
 * @param canMove whether this card sits in a column it could be moved between
 * @param copyActions the lines the reader wrote, from `readCopyActions`
 */
export function cardMenuRows(item, { canMove = false, copyActions = [] } = {}) {
  const kind = item && typeof item === "object" ? item.kind : null;
  if (!item || typeof item !== "object") {
    return { note: false, branch: false, move: false, priority: false, copies: [] };
  }

  return {
    // Every card, wherever it is drawn. A note is filed under the item's node
    // id, so it belongs to the work and not to the place the card sits: the
    // review row and a nested pull request take one exactly like a column does.
    note: true,
    // An issue has no branch.
    branch: kind === "pull-request",
    // A card outside the columns has no column to move between: the review
    // row holds none, and a pull request nested in its issue travels in that
    // issue's column (ADR 0012).
    move: canMove === true,
    // Every card, like the note above. The mark is filed under the item's node
    // id, so it follows the work and not the place the card sits (ADR 0026).
    priority: true,
    // The reader's own lines, in the order Settings holds them. An action this
    // card cannot fill is left out rather than copied with a hole in it: an
    // issue has no branch, exactly as "Copy branch name" already says.
    copies: (Array.isArray(copyActions) ? copyActions : []).filter((action) => canFillTemplate(action?.template, item)),
  };
}
