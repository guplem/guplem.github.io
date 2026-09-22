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
// 7. Finished. The count above the list already says how many.

/** How many children a card shows before the rest fold away. */
export const CHILDREN_SHOWN = 5;

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
