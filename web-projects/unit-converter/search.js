// Finding the unit a person means from the few letters they typed.
//
// There is no category picker on this page. That is the whole design: you type
// an amount and a unit, and the unit alone says what kind of thing you are
// converting. So this search carries the weight that a picker would otherwise
// carry, and one rule holds it up:
//
//   the shortest thing you can type for a unit gives you that unit
//
// `km` is kilometres, `mb` is megabytes, `kilo` is a kilogram and not a
// kilometre. That is why an exact match on a short alias outranks a longer word
// that merely starts the same way, and why `rank` (how common a unit is) breaks
// the ties that remain: `c` is Celsius to almost everyone and the speed of
// light to almost no one.
//
// Case matters in exactly two places, `MB` against `Mb` and `mW` against `MW`,
// so those units carry an `exact` spelling that only a case-for-case match
// hits. Everything else ignores case and accents, because a person typing
// `kilometro` in a hurry means `kilómetro`.

import { UNITS } from "./units.js";

/** Scores, highest first. The gaps are wide so that `rank` never crosses a tier. */
const EXACT_CASE = 1000;
const EXACT = 900;
const STARTS = 700;
const WORD_STARTS = 620;
const CONTAINS = 400;
const FUZZY = 200;

/** Lower case, no accents: how every term is compared. */
function fold(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Every spelling one unit answers to, folded once at load and reused. */
const INDEX = UNITS.map((unit) => {
  const terms = new Set();
  for (const alias of unit.aliases ?? []) terms.add(fold(alias));
  for (const language of Object.values(unit.name)) terms.add(fold(language));
  terms.add(fold(unit.sym));
  return { unit, terms: [...terms], exact: unit.exact ?? [] };
});

/** Whether every letter of `query` appears in `term`, in order. Catches a dropped letter. */
function isSubsequence(query, term) {
  let position = 0;
  for (const letter of term) {
    if (letter === query[position]) position += 1;
    if (position === query.length) return true;
  }
  return false;
}

/**
 * Whether one word is within `budget` single-letter edits of another. This
 * catches the typo a subsequence cannot: a swapped letter, as in `celcius` for
 * `celsius`, where nothing was dropped and nothing was added.
 */
function isNearly(query, term, budget) {
  if (Math.abs(query.length - term.length) > budget) return false;
  let previous = Array.from({ length: term.length + 1 }, (_, index) => index);
  for (let i = 1; i <= query.length; i += 1) {
    const row = [i];
    let least = i;
    for (let j = 1; j <= term.length; j += 1) {
      const cost = query[i - 1] === term[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      least = Math.min(least, row[j]);
    }
    if (least > budget) return false;
    previous = row;
  }
  return previous[term.length] <= budget;
}

/** How well one unit answers to one folded query. 0 means it does not. */
function scoreUnit(entry, folded, raw) {
  if (entry.exact.includes(raw)) return EXACT_CASE;
  let best = 0;
  for (const term of entry.terms) {
    if (term === folded) return EXACT;
    // A shorter term that starts with the query is the better guess: typing
    // `kilom` should reach `kilometre` before `kilometre per hour`.
    const overshoot = Math.min(term.length - folded.length, 40);
    if (term.startsWith(folded)) best = Math.max(best, STARTS - overshoot);
    else if (term.split(/[\s/]+/).some((word) => word.startsWith(folded))) best = Math.max(best, WORD_STARTS - overshoot);
    else if (term.includes(folded)) best = Math.max(best, CONTAINS - overshoot);
    else if (folded.length >= 4 && isSubsequence(folded, term)) best = Math.max(best, FUZZY - overshoot);
  }
  // Only worth the cost when nothing else matched at all.
  if (best === 0 && folded.length >= 4) {
    const budget = folded.length >= 8 ? 2 : 1;
    for (const term of entry.terms) {
      if (isNearly(folded, term, budget)) return FUZZY - Math.min(term.length, 40);
    }
  }
  return best;
}

/**
 * The units that answer to what was typed, best first.
 *
 * @param {string} query what the person typed for the unit
 * @param {{limit?: number, category?: string|null}} [options] `category` keeps
 *   the answer to units that convert with one already chosen
 * @returns {{unit: object, score: number}[]} empty when nothing matches
 */
export function searchUnits(query, { limit = 8, category = null } = {}) {
  if (typeof query !== "string") return [];
  const raw = query.trim();
  const folded = fold(raw);
  if (folded === "") return [];

  const hits = [];
  for (const entry of INDEX) {
    if (category && entry.unit.cat !== category) continue;
    const score = scoreUnit(entry, folded, raw);
    // `rank` is 1 for an everyday unit and 4 for an exotic one, so subtracting
    // it puts the everyday one first whenever two units match equally well.
    if (score > 0) hits.push({ unit: entry.unit, score: score - entry.unit.rank });
  }
  hits.sort((a, b) => b.score - a.score || a.unit.id.localeCompare(b.unit.id));
  return limit >= 0 ? hits.slice(0, limit) : hits;
}

/**
 * The one unit a query names, so the page can convert while a person is still
 * typing. There is no confidence threshold on purpose: `scoreUnit` already
 * gives nothing to a word no unit answers to, and holding back a half-typed
 * match would leave the results empty at exactly the moment they are most
 * useful. The suggestion list stays open underneath, so a wrong guess costs one
 * tap to correct.
 *
 * @returns {object|undefined} undefined when no unit matches at all
 */
export function bestUnit(query, { category = null } = {}) {
  return searchUnits(query, { limit: 1, category })[0]?.unit;
}

/**
 * Whether a unit is already written out in full, so there is nothing left to
 * suggest. The page uses this to close the suggestion list the moment the
 * typing has landed, rather than leaving it open over the answers.
 */
export function matchesExactly(unit, query) {
  if (!unit || typeof query !== "string") return false;
  const entry = INDEX.find((candidate) => candidate.unit.id === unit.id);
  return Boolean(entry && (entry.terms.includes(fold(query)) || entry.exact.includes(query.trim())));
}
