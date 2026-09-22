// The work the reader has pushed down, and what sinks with it.
//
// A card marked "not a priority" is drawn fainter wherever it appears, and in
// the smart order it sinks to the bottom of its list (ADR 0026). Every other
// order says what it does on the label, and must keep doing exactly that, so
// there the mark only changes how the card looks.
//
// **Marking one card can move more than one.** A stacked pull request cannot
// merge until the one below it does (ADR 0016). So a card pushed down takes
// everything waiting on it down as well: leaving those at the top would show
// work that reads as ready to pick up and is not.
//
// That rule keeps ADR 0016 true rather than bending it. The cards that sink
// are always a whole top of a stack, so read the board from the top and you
// still meet a stack bottom first, wherever its parts ended up.
//
// **The card that carries the mark is the card that moves.** A pull request
// nested inside the issue it closes travels in that issue's card (ADR 0016), so
// marking the nested one only makes it fainter. Mark the card itself to move it.
//
// **A value here is written into `board.json`** the moment somebody marks a
// card, so it is as permanent as a colour id or a storage key.

import { stackedUnder } from "./stacks.js";

/** Pushed down by the reader. */
export const LOW = "low";

/** Where everything starts. */
export const NORMAL = "normal";

/**
 * A priority the board knows. Anything else is the ordinary one.
 *
 * A newer build, or somebody editing the file by hand, must never leave a card
 * faint for a reason the reader cannot undo.
 */
export function knownPriority(value) {
  return value === LOW ? LOW : NORMAL;
}

/**
 * The same flat row, with the marked cards moved to the bottom.
 *
 * The row of pull requests waiting on the reader is flat, not the grouped
 * board, and it follows the same rules: a flat item is a group with nothing
 * nested in it, so this is the same pass (ADR 0026).
 *
 * @param items work items, not groups
 * @param marked the keys the reader marked, as a Set or a list
 * @returns a new array holding exactly the same items
 */
export function sinkLowPriorityItems(items, marked) {
  const list = (Array.isArray(items) ? items : []).filter((one) => one && typeof one === "object");
  return sinkLowPriority(
    list.map((item) => ({ item, children: [] })),
    marked,
  ).map((group) => group.item);
}

/**
 * The same groups, with the marked ones moved to the bottom.
 *
 * The order handed in decides both halves: the reader asked for an order and
 * then pushed some cards down, so the cards that stayed up are in their order
 * and the cards that sank are in theirs.
 *
 * @param groups `{item, children}` pairs, already in the reader's chosen order
 * @param marked the keys the reader marked, as a Set or a list
 * @returns a new array holding exactly the same groups
 */
export function sinkLowPriority(groups, marked) {
  const list = (Array.isArray(groups) ? groups : []).filter((one) => one && typeof one === "object");
  const keys = marked instanceof Set ? marked : new Set(Array.isArray(marked) ? marked : []);
  if (keys.size === 0) return [...list];

  // Read once, because the answer is the same for every walk below.
  const under = new Map(list.map((group) => [group, stackedUnder(group, list)]));
  const isMarked = (group) => keys.has(group?.item?.key);

  const sinks = (group) => {
    let at = group;
    // The seen set breaks a ring of retargeted branches, which must never hang
    // the page.
    const seen = new Set([at]);
    while (at) {
      if (isMarked(at)) return true;
      const below = under.get(at);
      if (!below || seen.has(below)) return false;
      seen.add(below);
      at = below;
    }
    return false;
  };

  const sunk = new Set(list.filter(sinks));
  return [...list.filter((group) => !sunk.has(group)), ...list.filter((group) => sunk.has(group))];
}
