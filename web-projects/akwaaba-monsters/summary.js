// The words the creature summary screen shows.
//
// The summary is the screen that answers "what exactly am I carrying?". It has
// three pages and the player turns between them, so most of it is text that has
// to fit a panel. Every line of that text is built here, and nothing here
// touches the browser, so `summary.test.js` can measure it and
// `art/font.test.js` can check that it fits the panel that draws it.
//
// `app.js` holds the layout and the cursor. This file holds the sentences.

import { statusLabel } from "./battle.js";
import { getMove } from "./moves.js";
import { MAX_LEVEL, MOVE_SLOTS, expToNextLevel, isFainted, statsOf } from "./monsters.js";
import { statusShort } from "./render.js";

/** The three pages, in the order Left and Right walk through them. */
export const SUMMARY_PAGES = ["info", "stats", "moves"];

/** What the tab strip writes on each page. */
export const SUMMARY_PAGE_LABELS = {
  info: "Info",
  stats: "Stats",
  moves: "Moves",
};

/** The five stats the health bar does not already show, in the order they read. */
const STAT_ROWS = [
  { label: "Attack", key: "attack" },
  { label: "Defense", key: "defense" },
  { label: "Sp. Atk", key: "spAttack" },
  { label: "Sp. Def", key: "spDefense" },
  { label: "Speed", key: "speed" },
];

/** How each kind of move reads on the move page. */
const CATEGORY_NAMES = {
  physical: "Physical",
  special: "Special",
  status: "Status",
};

/**
 * The three letters that mark what is wrong with a creature, or null.
 *
 * Fainted comes first. A fainted creature cannot fight whatever else it carries,
 * and that is the one thing the player has to see at a glance.
 */
export function conditionBadge(monster) {
  if (isFainted(monster)) return "FNT";
  if (!monster.status) return null;
  return statusShort(monster.status);
}

/** The same thing in a word, for the stats page. Never the raw identifier. */
export function conditionName(monster) {
  if (isFainted(monster)) return "Fainted";
  if (!monster.status) return "Healthy";
  const word = statusLabel(monster.status);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Where the creature came from, in at most two lines.
 *
 * A creature caught before this screen existed can still carry no record, so
 * the caller gets an empty list rather than a line that says "null".
 */
export function metLines(monster, mapName) {
  const level = typeof monster.metLevel === "number" ? monster.metLevel : null;
  if (!mapName) return level === null ? [] : [`Met at level ${level}`];
  if (level === null) return [`Met in ${mapName}`];
  return [`Met in ${mapName}`, `at level ${level}`];
}

/** The height and the weight, each on its own line. */
export function measurementLines(species) {
  return [`Height ${formatMeasure(species.height)} m`, `Weight ${formatMeasure(species.weight)} kg`];
}

/** One decimal place, and no decimal point where it says nothing. */
function formatMeasure(value) {
  return String(Number(Number(value ?? 0).toFixed(1)));
}

/** The five stat rows, with the numbers the battle engine would use. */
export function statRows(monster) {
  const stats = statsOf(monster);
  return STAT_ROWS.map((row) => ({ label: row.label, value: stats[row.key] }));
}

/** The two experience lines: the total, and what the next level still needs. */
export function expLines(monster) {
  const needed = expToNext(monster);
  return [`Exp ${monster.exp}`, `To next ${needed === null ? "-" : needed}`];
}

/** How much experience the next level needs, or null at the top level. */
function expToNext(monster) {
  if (monster.level >= MAX_LEVEL) return null;
  return expToNextLevel(monster);
}

/**
 * Every move slot, empty ones included.
 *
 * The screen draws four rows whatever the creature knows, so an empty slot is a
 * row the player can see rather than a gap they have to count.
 */
export function moveRows(monster) {
  return Array.from({ length: MOVE_SLOTS }, (_, index) => {
    const slot = monster.moves?.[index];
    const move = slot ? getMove(slot.id) : null;
    if (!move) return { filled: false, name: "-", type: null, pp: "", power: "", desc: "" };
    return {
      filled: true,
      id: move.id,
      name: move.name,
      type: move.type,
      pp: `${slot.pp}/${move.pp}`,
      power: move.power ? String(move.power) : "-",
      desc: move.desc,
      move,
    };
  });
}

/** The line under the highlighted move: its power, its accuracy and its kind. */
export function moveDetailLine(move) {
  if (!move) return "";
  const power = move.power ? move.power : "-";
  const accuracy = move.acc ? move.acc : "-";
  return `Pow ${power}   Acc ${accuracy}   ${CATEGORY_NAMES[move.cat] ?? move.cat}`;
}
