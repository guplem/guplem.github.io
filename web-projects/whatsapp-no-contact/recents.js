// The list of numbers this browser used before. Private to the device and
// never shared, so it lives in localStorage per root ADR 0007. This module owns
// the stored format and validates everything it reads back; `app.js` only calls
// getItem and setItem.

import { digitsOnly, normalizeNational, toE164Digits, validateNumber } from "./phone.js";

export const RECENTS_KEY = "whatsapp-no-contact:recents:v1";
export const MAX_RECENTS = 6;

/**
 * Accept a candidate only if it is a usable number, and return it in the one
 * stored shape. Anything else becomes null, so old or corrupt stored data can
 * never reach the page.
 * @param {*} candidate
 * @returns {{dial: string, national: string}|null}
 */
function toEntry(candidate) {
  if (candidate === null || typeof candidate !== "object") return null;
  const dial = digitsOnly(candidate.dial);
  const state = { dial, national: candidate.national };
  if (!validateNumber(state).valid) return null;
  return { dial, national: normalizeNational(candidate.national, dial) };
}

/**
 * Put a number at the front of the list. A number already in the list moves up
 * instead of appearing twice, and the list never grows past the cap.
 * @param {Array} list the current list
 * @param {{dial: ?string, national: ?string}} entry the number just used
 * @param {number} [max] how many numbers to keep
 * @returns {Array<{dial: string, national: string}>} a new list
 */
export function addRecent(list, entry, max = MAX_RECENTS) {
  const current = Array.isArray(list) ? list : [];
  const normalized = toEntry(entry);
  if (normalized === null) return current.slice();

  const key = toE164Digits(normalized);
  const kept = current.filter((item) => {
    const existing = toEntry(item);
    return existing !== null && toE164Digits(existing) !== key;
  });
  return [normalized, ...kept].slice(0, max);
}

/**
 * @param {Array} list
 * @returns {string} JSON holding only the dial code and the number of each
 *   valid entry
 */
export function serializeRecents(list) {
  const entries = (Array.isArray(list) ? list : []).map(toEntry).filter((entry) => entry !== null);
  return JSON.stringify(entries);
}

/**
 * Read the stored list defensively: bad JSON, a value that is not a list,
 * unusable entries, duplicates and overflow are all dropped.
 * @param {?string} raw what localStorage returned
 * @returns {Array<{dial: string, national: string}>}
 */
export function deserializeRecents(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const entries = [];
  const seen = new Set();
  for (const candidate of parsed) {
    const entry = toEntry(candidate);
    if (entry === null) continue;
    const key = toE164Digits(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
    if (entries.length === MAX_RECENTS) break;
  }
  return entries;
}
