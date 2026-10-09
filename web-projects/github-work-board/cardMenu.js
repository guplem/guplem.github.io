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

import { AUTOMATIC, readColumnId } from "./columns.js";
import { COPY_ICONS, canFillTemplate } from "./copyActions.js";
import { HIGH, LOW, NORMAL, knownPriority } from "./priority.js";

/**
 * The icons on the menu's own rows, as SVG paths on a 24 by 24 grid (Lucide).
 * The priority rows draw `priority.PRIORITY_PATHS`, and a line the reader
 * wrote draws the icon they picked (ADR 0031).
 */
export const MENU_ICON_PATHS = {
  note: ["M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z", "M15 3v4a2 2 0 0 0 2 2h4"],
  branch: COPY_ICONS.find((one) => one.id === "branch").paths,
  move: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M9 3v18", "M15 3v18"],
};

/** Every priority, in the order the menu offers them. */
const PRIORITY_ORDER = [HIGH, NORMAL, LOW];

/**
 * @param item the work item the menu was opened for
 * @param canMove whether this card sits in a column it could be moved between
 * @param copyActions the lines the reader wrote, from `readCopyActions`
 * @param priority the card's priority now, from `readPriority`
 * @param column the column the reader moved this card to, from `readColumn`
 */
export function cardMenuRows(item, { canMove = false, copyActions = [], priority = NORMAL, column = "" } = {}) {
  const kind = item && typeof item === "object" ? item.kind : null;
  if (!item || typeof item !== "object") {
    return { note: false, branch: false, move: false, moved: false, priorities: [], copies: [] };
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
    // The card no longer follows the rules, so the menu button and the "Move
    // to" row carry a dot. Only where the move means something: a column the
    // board does not know reads as automatic, and so does a card that cannot
    // be moved (ADR 0011).
    moved: canMove === true && readColumnId(column) !== AUTOMATIC,
    // Every card, like the note above. The mark is filed under the item's node
    // id, so it follows the work and not the place the card sits (ADR 0026).
    // One row for each priority the card is not in, so a press always changes
    // something (ADR 0044).
    priorities: PRIORITY_ORDER.filter((one) => one !== knownPriority(priority)),
    // The reader's own lines, in the order Settings holds them. An action this
    // card cannot fill is left out rather than copied with a hole in it: an
    // issue has no branch, exactly as "Copy branch name" already says.
    copies: (Array.isArray(copyActions) ? copyActions : []).filter((action) => canFillTemplate(action?.template, item)),
  };
}
