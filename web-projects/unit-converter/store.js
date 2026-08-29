// What the page remembers between visits.
//
// Three small things: the last few conversions, the exchange-rate table, and
// the chosen language. All of it is private to the browser and none of it is
// sent anywhere (root ADR 0007).
//
// Every function takes the storage to use rather than reaching for
// `localStorage` itself. That is what makes this file testable without a
// browser, and it is also the honest shape: a browser in private mode throws on
// the first write, and a page that assumes otherwise breaks for a reader who
// did nothing wrong. So every read and every write is wrapped, a refused write
// is simply forgotten, and a key holding something unexpected reads as empty.

import { LANGUAGE_CODES } from "./i18n.js";
import { unitById } from "./units.js";

const PREFIX = "unit-converter";
const RECENTS_KEY = `${PREFIX}.recents`;
const RATES_KEY = `${PREFIX}.rates`;
const LANGUAGE_KEY = `${PREFIX}.lang`;

/** How many recent conversions the row of chips holds. */
export const RECENTS_KEPT = 6;

function readRaw(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeRaw(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // A browser that refuses to store is not an error the reader can act on.
  }
}

function readJson(storage, key) {
  const raw = readRaw(storage, key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Recent conversions                                                         */
/* -------------------------------------------------------------------------- */

/** One stored entry, or null when what was stored is not one. */
function readEntry(value) {
  if (!value || typeof value !== "object") return null;
  const q = typeof value.q === "string" ? value.q.trim() : "";
  if (q === "") return null;
  return { q, to: typeof value.to === "string" && value.to !== "" ? value.to : null };
}

/** The last few conversions, newest first. Always an array. */
export function readRecents(storage) {
  const stored = readJson(storage, RECENTS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.map(readEntry).filter(Boolean).slice(0, RECENTS_KEPT);
}

/**
 * Put one conversion at the front of the list.
 *
 * The same conversion typed again moves up rather than appearing twice, so the
 * row of chips stays a list of different things to go back to.
 */
export function rememberConversion(storage, entry) {
  const clean = readEntry(entry);
  if (!clean) return readRecents(storage);
  const kept = readRecents(storage).filter((item) => !(item.q === clean.q && item.to === clean.to));
  const next = [clean, ...kept].slice(0, RECENTS_KEPT);
  writeRaw(storage, RECENTS_KEY, JSON.stringify(next));
  return next;
}

/* -------------------------------------------------------------------------- */
/* The rate table                                                             */
/* -------------------------------------------------------------------------- */

/** The rate table last fetched, or null when there is none worth using. */
export function readRates(storage) {
  const stored = readJson(storage, RATES_KEY);
  if (!stored || typeof stored !== "object") return null;
  const { date, rates } = stored;
  if (typeof date !== "string" || !rates || typeof rates !== "object") return null;
  return Object.keys(rates).length > 0 ? { date, rates } : null;
}

export function saveRates(storage, table) {
  if (!table?.rates) return;
  writeRaw(storage, RATES_KEY, JSON.stringify({ date: table.date, rates: table.rates }));
}

/* -------------------------------------------------------------------------- */
/* The chosen language                                                        */
/* -------------------------------------------------------------------------- */

/** The language chosen last time, or null when none was chosen or it is not offered. */
export function readLanguage(storage) {
  const stored = readRaw(storage, LANGUAGE_KEY);
  return LANGUAGE_CODES.includes(stored) ? stored : null;
}

export function saveLanguage(storage, lang) {
  if (LANGUAGE_CODES.includes(lang)) writeRaw(storage, LANGUAGE_KEY, lang);
}

/** Whether a stored target still names a unit this page carries. */
export function isKnownUnit(id) {
  return Boolean(unitById(id));
}
