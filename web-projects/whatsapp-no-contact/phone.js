// Phone number logic: read what the visitor typed, turn it into the digits
// WhatsApp expects, and move that number in and out of the URL. Pure functions
// with no DOM access, so tests can import this without a browser.

import { splitDialCode, findByDial } from "./countries.js";

// Most countries write a national number with a trunk zero that the
// international form drops: a UK mobile is 07700 900123 at home and
// 44 7700 900123 abroad. Italy is the exception, where the leading zero is
// part of the number and removing it breaks the call.
const DIALS_KEEPING_LEADING_ZERO = new Set(["39"]);

// E.164, the international numbering standard, allows 15 digits in total,
// including the dial code. Saint Helena has the shortest numbers, at four
// digits after a three-digit code.
const MAX_TOTAL_DIGITS = 15;
const MIN_TOTAL_DIGITS = 7;
const MIN_NATIONAL_DIGITS = 4;

// The URL parameter that carries the number. Kept short, per root ADR 0006.
const PHONE_PARAM = "p";

const EMPTY_STATE = { dial: null, national: "" };

/**
 * Keep the ASCII digits and drop everything else: plus signs, spaces, dashes,
 * brackets, and digits from other scripts that WhatsApp cannot read.
 * @param {string|number} input
 * @returns {string} digits only, possibly empty
 */
export function digitsOnly(input) {
  const text = typeof input === "string" || typeof input === "number" ? String(input) : "";
  return text.replace(/[^0-9]/g, "");
}

/**
 * Turn a national number into the form that follows a dial code: digits only,
 * with the trunk zero removed unless the country keeps it.
 * @param {string} input the number as the visitor wrote it
 * @param {string|null} dial the dial code it belongs to
 * @returns {string} digits only, possibly empty
 */
export function normalizeNational(input, dial) {
  const digits = digitsOnly(input);
  if (digits === "") return "";
  if (DIALS_KEEPING_LEADING_ZERO.has(digitsOnly(dial))) return digits;
  return digits.replace(/^0+/, "");
}

/**
 * Read a number that already carries its country, so pasting "+34 639 078 482"
 * selects Spain and fills in the rest. A number with no plus sign and no 00
 * exit code is rejected: there is no way to tell a dial code from an area code,
 * so the selected country must stay in charge.
 * @param {string} input
 * @returns {{dial: string, national: string}|null} null when it is not an
 *   international number, or when the dial code is unassigned
 */
export function parseInternational(input) {
  if (typeof input !== "string") return null;
  if (!/^(\+|00)/.test(input.trim())) return null;
  const split = splitDialCode(input);
  if (split === null) return null;
  return { dial: split.dial, national: normalizeNational(split.national, split.dial) };
}

/**
 * Join a state into the plain digit string WhatsApp expects.
 * @param {{dial: ?string, national: ?string}} state
 * @returns {string} digits only, or "" when a part is missing
 */
export function toE164Digits(state) {
  const dial = digitsOnly(state?.dial);
  const national = normalizeNational(state?.national, dial);
  return dial === "" || national === "" ? "" : dial + national;
}

/**
 * Check a number well enough to catch real mistakes without rejecting valid
 * numbers. Per-country length rules are deliberately not enforced: they change
 * often, and a wrong rule blocks a number that works.
 * @param {{dial: ?string, national: ?string}} state
 * @returns {{valid: boolean, reason: ?string}} reason is one of "no-country",
 *   "empty", "too-short", "too-long", or null when the number is valid
 */
export function validateNumber(state) {
  const dial = digitsOnly(state?.dial);
  if (dial === "" || findByDial(dial) === null) return { valid: false, reason: "no-country" };

  const national = normalizeNational(state?.national, dial);
  if (national === "") return { valid: false, reason: "empty" };

  const total = dial.length + national.length;
  if (national.length < MIN_NATIONAL_DIGITS || total < MIN_TOTAL_DIGITS) {
    return { valid: false, reason: "too-short" };
  }
  if (total > MAX_TOTAL_DIGITS) return { valid: false, reason: "too-long" };

  return { valid: true, reason: null };
}

/**
 * Build the link that opens a WhatsApp chat with a number that is not a saved
 * contact. WhatsApp reads the number from the `phone` parameter as plain
 * digits, with no plus sign and no separators.
 * @param {{dial: ?string, national: ?string}} state
 * @returns {string|null} the link, or null when the number is not valid
 */
export function buildWhatsAppUrl(state) {
  if (!validateNumber(state).valid) return null;
  return `https://api.whatsapp.com/send?phone=${toE164Digits(state)}`;
}

/**
 * Write the number the way it is dialled internationally, for the visitor to
 * check before opening the chat. The national part is not regrouped, because
 * grouping rules differ per country and a wrong guess reads as an error.
 * @param {{dial: ?string, national: ?string}} state
 * @returns {string} e.g. "+34 123456789", or "" when there is no country
 */
export function formatForDisplay(state) {
  const dial = digitsOnly(state?.dial);
  if (dial === "") return "";
  const national = normalizeNational(state?.national, dial);
  return national === "" ? `+${dial}` : `+${dial} ${national}`;
}

/**
 * Read the number out of a query string, so a shared link opens ready to send.
 * @param {string} search the query string, with or without the leading "?"
 * @returns {{dial: ?string, national: string}} an empty state when the
 *   parameter is missing or unreadable
 */
export function parseUrlState(search) {
  if (typeof search !== "string") return { ...EMPTY_STATE };
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const split = splitDialCode(params.get(PHONE_PARAM) ?? "");
  if (split === null) return { ...EMPTY_STATE };
  return { dial: split.dial, national: normalizeNational(split.national, split.dial) };
}

/**
 * Write the number into a query string. An incomplete number serializes to
 * nothing, so a half-typed number never ends up in a shared link.
 * @param {{dial: ?string, national: ?string}} state
 * @returns {string} e.g. "p=34123456789", or ""
 */
export function serializeUrlState(state) {
  if (!validateNumber(state).valid) return "";
  const params = new URLSearchParams();
  params.set(PHONE_PARAM, toE164Digits(state));
  return params.toString();
}
