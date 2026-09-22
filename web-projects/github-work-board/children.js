// The children of an issue, in the order they read on their parent's card.
//
// A parent can have twenty children and a card is a card, so the card shows a
// handful and folds the rest away. Which handful is the whole question, and it
// is not the order the board reads in (ADR 0032).
//
// **The board's columns read left to right as the life of a change**: nothing
// yet, a branch, somebody was asked, they answered, it landed (ADR 0011). That
// is the right order for a board and the wrong one for this list. A parent with
// ten children nobody has started and one whose reviewer asked for changes
// would fold away the only one with work to do.
//
// **So the children read by what wants a person**, closest first:
//
// 1. Somebody asked for changes. There is work to do, and it is here.
// 2. Approved. One press finishes it.
// 3. Somebody was asked to look. It is with them, and they can be reminded.
// 4. Being written. It is moving, and nobody is waiting.
// 5. Not started.
// 6. Nothing known, because the board could not ask about this one (ADR 0010).
// 7. Finished. The row of pills above the list already says how many.
//
// **The list itself is folded away until somebody asks for it.** A card carries
// one pill per child instead, painted with the colour of the column that child
// sits in, so a parent says how its work is going in one glance and takes one
// line while it does (ADR 0032).

import { stateLabel } from "./columns.js";

/** Nearest the top wants a person most. Anything not named here sits at 5. */
const ORDER = ["needs-changes", "ready-to-merge", "awaiting-review", "ongoing", "todo"];

const UNKNOWN = ORDER.length;
const FINISHED = ORDER.length + 1;

function rank(columnId) {
  if (columnId === "done") return FINISHED;
  const at = ORDER.indexOf(columnId);
  return at === -1 ? UNKNOWN : at;
}

/**
 * The same children, in the order they read.
 *
 * Two children in the same state keep the order they came in, which is the
 * order somebody arranged them in on GitHub, and the only order anybody chose
 * by hand.
 *
 * @param rows `[{item, columnId}]`, where `columnId` is "" when the board could
 *   not ask GitHub about that child
 * @returns a new array holding exactly the rows it could read
 */
export function orderChildren(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === "object" && row.item && typeof row.item === "object")
    .map((row, at) => ({ row, at, rank: rank(row.columnId) }))
    .sort((one, other) => (one.rank === other.rank ? one.at - other.at : one.rank - other.rank))
    .map((one) => one.row);
}

/**
 * How many children are closed, out of how many there are.
 *
 * Both numbers come from GitHub's own summary, which counts every child,
 * including the ones past the twenty the board asks about. "Closed" is closed
 * for any reason: work that was finished and work that was dropped are both
 * off the list of things left to do (ADR 0032).
 *
 * Nothing here invents a number. An answer that is not a pair of whole counts
 * reads as nothing, and more done than there are reads as all of them, which a
 * parent whose children were closed and then reopened can really answer with.
 */
export function childrenProgress(summary) {
  const whole = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);
  const total = whole(summary?.total);
  const done = Math.min(whole(summary?.completed), total);
  return { done, total, label: `${done}/${total}` };
}

/**
 * What one pill says when the reader hovers it.
 *
 * A pill is a few pixels wide and carries no words of its own, so this is the
 * whole of what it stands for: which issue it is, and where that issue sits.
 */
export function childSummary(row) {
  const child = row?.item;
  if (!child || typeof child !== "object") return "";
  const title = typeof child.title === "string" ? child.title : "";
  const name = `#${child.number ?? ""} ${title}`.trim();
  const where = row.columnId === "" ? "the board could not ask GitHub about this one" : stateLabel(row.columnId);
  return where === "" ? name : `${name} - ${where}`;
}

/** The words on the press that opens and closes the list. */
export function childrenToggleLabel(open, count) {
  if (open) return "Hide the children";
  return count === 1 ? "Show the one child" : `Show the ${count} children`;
}
