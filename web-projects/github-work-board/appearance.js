// How the board looks: the colour on each column, and light or dark.
//
// Both are the reader's, so both live in their own repository beside their
// notes and travel with them to every machine (ADR 0024). Neither is anything
// GitHub knows.
//
// **A colour is bare HSL channels, never a finished colour.** The wash behind a
// column and the outline round it are the same channels at two alphas, which a
// hex value cannot do, and which is why every colour in this file is written
// the way `style.css` writes its own (ADR 0004).
//
// **An id here is written into `board.json`** the moment somebody picks one, so
// it is as permanent as a storage key or a column id.

import { COLUMNS } from "./columns.js";

export const DEFAULT_COLOUR = "default";

/** The review row is painted like a column, and it is not one, so it has an id of its own. */
export const REVIEW_ROW_ID = "reviews";

/** The colours a column can be painted. The first one paints nothing. */
export const COLUMN_COLOURS = [
  { id: "default", label: "None", tint: "" },
  { id: "slate", label: "Slate", tint: "215 16% 47%" },
  { id: "blue", label: "Blue", tint: "217 91% 60%" },
  { id: "teal", label: "Teal", tint: "173 80% 40%" },
  { id: "green", label: "Green", tint: "142 71% 45%" },
  { id: "amber", label: "Amber", tint: "38 92% 50%" },
  { id: "rose", label: "Rose", tint: "347 77% 50%" },
  { id: "violet", label: "Violet", tint: "262 83% 58%" },
];

/**
 * The colour each part of the board opens with.
 *
 * The board used to open with nothing painted. That is honest and it is a grey
 * row of six columns, and every reader painted the same six by hand before the
 * board told them anything at a glance. These are the colours the board is
 * used with, so they are what it opens with (ADR 0024).
 *
 * **Two are deliberately unpainted.** "Awaiting review" and "Done today" are
 * the columns nobody has to act on: one is with somebody else and the other is
 * over. Leaving them plain is what makes the painted ones mean something.
 *
 * The reader's own choice always wins, and "None" is a choice like any other.
 */
export const DEFAULT_COLOURS = {
  [REVIEW_ROW_ID]: "violet",
  todo: "slate",
  ongoing: "blue",
  "needs-changes": "rose",
  "awaiting-review": DEFAULT_COLOUR,
  "ready-to-merge": "green",
  done: DEFAULT_COLOUR,
};

export const DEFAULT_THEME = "auto";

/** Light, dark, or whatever the machine is set to. */
export const THEMES = [
  { id: "auto", label: "Automatic" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const KNOWN_COLOURS = new Set(COLUMN_COLOURS.map((one) => one.id));
const KNOWN_THEMES = new Set(THEMES.map((one) => one.id));

/**
 * A colour the board can paint.
 *
 * Anything else is the default. A newer build, or somebody editing the file by
 * hand, must never leave a column painted with nothing.
 */
export function knownColour(value) {
  return typeof value === "string" && KNOWN_COLOURS.has(value) ? value : DEFAULT_COLOUR;
}

/** What one part of the board is painted before the reader says otherwise. */
export function defaultColour(areaId) {
  return knownColour(DEFAULT_COLOURS[areaId]);
}

/** A theme the board knows. Anything else follows the machine. */
export function knownTheme(value) {
  return typeof value === "string" && KNOWN_THEMES.has(value) ? value : DEFAULT_THEME;
}

/**
 * Everything that can be painted, in the order it reads down the page: the row
 * of reviews above the board, then the columns left to right.
 */
export function colourableAreas() {
  return [
    { id: REVIEW_ROW_ID, label: "Pull requests waiting for your review" },
    ...COLUMNS.map((column) => ({ id: column.id, label: column.label })),
  ];
}
