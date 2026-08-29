// Reading a rate table out of whatever an exchange-rate service sends.
//
// Two free services answer this page, in two different shapes, and neither is
// under our control. So this module reads defensively: a missing field, a
// currency the converter does not carry, or a value that is not a number all
// get dropped rather than passed on. A wrong rate is worse than no rate,
// because the page has a bundled snapshot to fall back to and says so.
//
// One conversion happens here and it is easy to get backwards. A service
// answers "how many dollars one euro buys" (1.16). The conversion engine wants
// the opposite, "what one dollar is worth in euros" (0.86), because that is a
// factor like every other unit's. So every rate is inverted on the way in.
//
// This file does no fetching. `dataSource.js` does that, and hands the raw
// answer here. That split is what makes the hard part testable.

import { unitsInCategory } from "./units.js";

/** After this many hours, rates are fetched again rather than reused. */
export const RATE_MAX_AGE_HOURS = 12;

/** The currency the whole table is expressed in, matching the category's base unit. */
const BASE = "eur";

/** Every currency code the converter carries, so an unknown one can be dropped. */
const KNOWN = new Set(unitsInCategory("currency").map((unit) => unit.id));

const usable = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

/** The day a table is from, as `YYYY-MM-DD`, from whichever field carries it. */
function readDate(payload) {
  const raw = payload.date ?? payload.time_last_update_utc ?? payload.time_last_update_utc_string;
  if (typeof raw === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Read a service's answer into the table the conversion engine takes.
 *
 * @param {unknown} payload the parsed JSON a service sent
 * @returns {{date: string, rates: Record<string, number>}|null} null when the
 *   answer cannot be read, or when not one usable rate survives it
 */
export function normalizeRates(payload) {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload.rates;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const base = String(payload.base ?? payload.base_code ?? "").toLowerCase();
  if (!KNOWN.has(base)) return null;

  // "Units of X per one base", straight from the service.
  const perBase = { [base]: 1 };
  for (const [code, value] of Object.entries(raw)) {
    const id = code.toLowerCase();
    if (KNOWN.has(id) && usable(value)) perBase[id] = value;
  }

  // The engine wants euros, so a table quoted in anything else is turned round
  // through the euro rate the service gave.
  const perEuro = perBase[BASE];
  if (!usable(perEuro)) return null;

  const rates = {};
  for (const [id, value] of Object.entries(perBase)) rates[id] = perEuro / value;
  rates[BASE] = 1;

  return Object.keys(rates).length > 1 ? { date: readDate(payload), rates } : null;
}

/**
 * Whether a table is old enough to be worth fetching again. A date that cannot
 * be read counts as stale, because fetching again is the safe answer.
 */
export function isStale(date, now = new Date()) {
  const when = typeof date === "string" ? Date.parse(date) : Number.NaN;
  if (Number.isNaN(when)) return true;
  return now.getTime() - when > RATE_MAX_AGE_HOURS * 3600 * 1000;
}
