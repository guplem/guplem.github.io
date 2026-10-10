// The parts of a card the reader can hide.
//
// A card carries the title, where the work lives and the pills that say what
// wants doing, and those always stay. The parts below are context: useful on
// one board, noise on another. Each reader decides which of them their cards
// carry, in Settings, and the choice is saved in `board.json` beside the
// colours, so it follows them to every machine (ADR 0024, ADR 0047).
//
// An id is written into `board.json` the moment the reader flips a switch, so
// it is permanent, like a column id. `cardParts.test.js` pins the set.

export const CARD_PARTS = [
  { id: "labels", label: "Labels", says: "the labels on the work" },
  { id: "milestone", label: "Milestone", says: "the milestone the work is in, and how far it has gone" },
  { id: "fields", label: "Fields", says: "the issue fields that are set, such as the effort or the priority" },
  { id: "people", label: "People", says: "the faces of the people in the review, or whose work it is" },
  { id: "links", label: "Parent and blockers", says: "the issue this one is a sub-issue of, and what blocks it" },
  { id: "children", label: "Sub-issues", says: "the sub-issues of an issue, and how many are closed" },
];

const BY_ID = new Map(CARD_PARTS.map((part) => [part.id, part]));

/** Whether this is a part of a card the reader can hide. */
export function isCardPart(id) {
  return typeof id === "string" && BY_ID.has(id);
}

/** The name of a part on its switch, or an empty string for an id this build does not know. */
export function cardPartLabel(id) {
  return BY_ID.get(id)?.label ?? "";
}
