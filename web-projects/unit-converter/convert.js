// Turning a value in one unit into the same value in another.
//
// Every conversion goes through the base unit of the category. `100 km -> mi`
// becomes `100 km -> 100000 m -> 62.14 mi`. That is one hop more than a direct
// table would need, and it is worth it: a category with 20 units needs 20
// numbers this way and 400 the other way, and only one of those two can be
// checked by reading it.
//
// Two things do not fit a plain multiplication, so a unit may bring its own
// `toBase`/`fromBase` pair instead of a factor: temperature has an offset, and
// fuel economy is a reciprocal. The engine never needs to know which is which.
//
// Currency is the third case. A currency's factor is a rate that changed this
// morning, so the caller passes today's rates in `ctx` and the engine uses them
// per unit, falling back to the bundled snapshot for any currency the rates do
// not cover. A partial rate table therefore still gives an answer for every
// currency, which is the rule the whole page follows: never go blank.

import { categoryById, unitById, unitsInCategory } from "./units.js";

/**
 * How many base units one of this unit is worth, right now.
 *
 * For a currency this is today's rate when the caller has one and the bundled
 * snapshot when it does not. A rate that is not a positive finite number is
 * treated as absent, because a zero or a string would silently produce
 * infinities instead of an answer.
 */
export function factorFor(unit, ctx) {
  if (!unit) return undefined;
  if (unit.live) {
    const rate = ctx?.rates?.[unit.id];
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) return rate;
  }
  return unit.factor;
}

/** Whether the caller passed a live rate for this unit, rather than the snapshot. */
export function isLive(unit, ctx) {
  if (!unit?.live) return false;
  const rate = ctx?.rates?.[unit.id];
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
}

/** The value of `value` of this unit, measured in its category's base unit. */
function toBase(unit, value, ctx) {
  return unit.toBase ? unit.toBase(value) : value * factorFor(unit, ctx);
}

/** The reverse of `toBase`. */
function fromBase(unit, value, ctx) {
  return unit.fromBase ? unit.fromBase(value) : value / factorFor(unit, ctx);
}

/** Whether two units measure the same kind of thing, so a conversion exists. */
export function isConvertible(fromId, toId) {
  const from = unitById(fromId);
  const to = unitById(toId);
  return Boolean(from && to && from.cat === to.cat);
}

/**
 * Convert one value between two units.
 * @param {number} value the amount to convert
 * @param {string} fromId the unit the amount is in
 * @param {string} toId the unit to answer in
 * @param {{rates?: Record<string, number>}} [ctx] today's currency rates
 * @returns {number|null} null when either unit is unknown, when the two measure
 *   different things, or when the value is not a usable number
 */
export function convert(value, fromId, toId, ctx) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const from = unitById(fromId);
  const to = unitById(toId);
  if (!from || !to || from.cat !== to.cat) return null;
  if (from.id === to.id) return value;
  return fromBase(to, toBase(from, value, ctx), ctx);
}

/**
 * How far a number sits from the range a person reads at a glance.
 *
 * 0 is comfortable, 2 is not worth looking at. This exists because commonness
 * alone puts the wrong answers first. Type a height as `5'10"` and miles are a
 * common unit, but `0.0011 mi` is not an answer anybody wants, while `70 in`
 * and `177.8 cm` are the two a person came for. Adding this to `rank` puts them
 * there without hiding anything: every unit is still in the list.
 */
export function readabilityPenalty(value) {
  const size = Math.abs(value);
  if (size === 0) return 0;
  if (size >= 0.01 && size < 1e5) return 0;
  if (size >= 1e-4 && size < 1e8) return 1;
  return 2;
}

/**
 * Convert one value into every other unit of its category at once.
 *
 * This is the answer the page is really built around. A person who types
 * `100 km` almost never wants one target: they want to see the number next to
 * miles and metres and feet and pick with their eyes. Producing the whole table
 * costs nothing and removes a step from every conversion.
 *
 * @returns {{unit: object, value: number, live: boolean}[]} the source unit is
 *   left out; the rows come back most useful first, which is how common the
 *   unit is plus how readable this particular number is in it
 */
export function convertAll(value, fromId, ctx) {
  if (typeof value !== "number" || !Number.isFinite(value)) return [];
  const from = unitById(fromId);
  if (!from) return [];
  const base = toBase(from, value, ctx);
  return unitsInCategory(from.cat)
    .filter((unit) => unit.id !== from.id)
    .map((unit) => {
      const converted = fromBase(unit, base, ctx);
      return {
        unit,
        value: converted,
        live: isLive(unit, ctx),
        order: unit.rank + readabilityPenalty(converted),
      };
    })
    // `unitsInCategory` is already sorted by rank and this sort is stable, so
    // two units of equal usefulness keep the order the catalogue put them in.
    .sort((a, b) => a.order - b.order);
}

/** The category a conversion belongs to, or undefined when the unit is unknown. */
export function categoryOfConversion(fromId) {
  const unit = unitById(fromId);
  return unit ? categoryById(unit.cat) : undefined;
}
