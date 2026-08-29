// How a number reaches the screen.
//
// A converter is judged on its numbers. Two things spoil them:
//
//   - noise: `0.30480000000000004 m`, which is what a computer really holds
//   - lost meaning: `1,073,742,000` for a gibibyte that is exactly 1073741824
//     bytes, which is what "round to seven significant digits" does to it
//
// So the rule changes with the size of the number. A whole number is printed
// whole, however long. A number past ten million keeps its whole part and drops
// its decimals. Anything smaller gets seven significant digits, which is enough
// to be useful and few enough to hide the noise. Past the point where digits
// stop being readable at all, the number becomes a power of ten.
//
// `formatCompound` adds the second reading a person would say out loud: 5.84 ft
// is `5′ 10.1″`, and 1.5 h is `1 h 30 min`. It is the line that turns a correct
// answer into a useful one, and it stays quiet whenever it would only repeat
// what the first line already said.

import { convert } from "./convert.js";
import { unitById } from "./units.js";

/** Above this, digits stop being readable and a power of ten takes over. */
const BIG = 1e15;
/** Below this (and not zero), the same. */
const SMALL = 1e-4;
/** Above this, the decimals of a number carry less than its whole part does. */
const WHOLE_ONLY = 1e7;
/** How many significant digits an everyday number keeps. */
const DIGITS = 7;

const SUPERSCRIPT = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

const usable = (value) => typeof value === "number" && Number.isFinite(value);

/** Drop the zeros a fixed-width conversion leaves behind: `1.2300` -> `1.23`. */
const trimZeros = (text) => (text.includes(".") ? text.replace(/\.?0+$/, "") : text);

const localise = (value, lang, options) => {
  try {
    return new Intl.NumberFormat(lang, options).format(value);
  } catch {
    return new Intl.NumberFormat("en", options).format(value);
  }
};

/** `1.23e-9` as `1.23 × 10⁻⁹`, which reads as a number rather than as code. */
function powerOfTen(value, lang) {
  const [mantissa, exponent] = value.toExponential(4).split("e");
  const digits = trimZeros(mantissa);
  const shown = localise(Number(digits), lang, { maximumSignificantDigits: 5 });
  const power = [...String(Number(exponent))].map((character) => SUPERSCRIPT[character] ?? character).join("");
  return `${shown} × 10${power}`;
}

/**
 * Write a number for a reader of this language.
 * @returns {string} an empty string for anything that is not a finite number
 */
export function formatNumber(value, lang = "en") {
  if (!usable(value)) return "";
  if (value === 0) return localise(0, lang);
  const size = Math.abs(value);
  if (size >= BIG || size < SMALL) return powerOfTen(value, lang);
  if (Number.isInteger(value)) return localise(value, lang, { maximumFractionDigits: 0 });
  if (size >= WHOLE_ONLY) return localise(value, lang, { maximumFractionDigits: 0 });
  return localise(value, lang, { maximumSignificantDigits: DIGITS });
}

/**
 * The same number, in the form that survives a paste into a spreadsheet: no
 * grouping, and a decimal point rather than whatever mark the reader's language
 * uses. It shows the digits the screen shows, so nothing changes on paste.
 */
export function formatPlain(value) {
  if (!usable(value)) return "";
  if (value === 0) return "0";
  const size = Math.abs(value);
  if (size >= BIG || size < SMALL) return trimZeros(value.toExponential(4).split("e")[0]) + "e" + value.toExponential(4).split("e")[1];
  if (Number.isInteger(value)) return String(value);
  if (size >= WHOLE_ONLY) return String(Math.round(value));
  return String(Number(value.toPrecision(DIGITS)));
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

/** One cent. Below this, an amount of money has no cents worth writing. */
const CENT = 0.01;

/** Whether a value is money, which is the one kind of number written to a fixed width. */
const isMoney = (unit, value) => unit?.cat === "currency" && Math.abs(value) >= CENT;

/**
 * Write a value the way its own kind of thing is written.
 *
 * Money is the exception to every rule above. A price is written to the cent,
 * so `215.337` euros is `215.34` and `250` euros is `250.00`, because a price
 * with no cents looks unfinished. The exception has its own exception: an
 * amount smaller than a cent keeps its digits, since a hundred rupiah is real
 * money and `0.00` says nothing.
 */
export function formatValue(value, unit, lang = "en") {
  if (!usable(value)) return "";
  if (!isMoney(unit, value)) return formatNumber(value, lang);
  return localise(value, lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The same value in the form that survives a paste into a spreadsheet. */
export function formatPlainValue(value, unit) {
  if (!usable(value)) return "";
  return isMoney(unit, value) ? value.toFixed(2) : formatPlain(value);
}

/* -------------------------------------------------------------------------- */
/* The second reading                                                         */
/* -------------------------------------------------------------------------- */

/** Feet and inches, the way a height is said out loud. */
function feetAndInches(value, lang) {
  const sign = value < 0 ? "-" : "";
  const size = Math.abs(value);
  let feet = Math.floor(size);
  let inches = Number(((size - feet) * 12).toFixed(1));
  if (inches >= 12) {
    feet += 1;
    inches = 0;
  }
  return `${sign}${formatNumber(feet, lang)}′ ${formatNumber(inches, lang)}″`;
}

/** The nearest sixteenth of an inch, which is what a tape measure is marked in. */
function inchFraction(value, lang) {
  const sign = value < 0 ? "-" : "";
  const size = Math.abs(value);
  const sixteenths = Math.round(size * 16);
  const whole = Math.floor(sixteenths / 16);
  let numerator = sixteenths % 16;
  let denominator = 16;
  while (numerator > 0 && numerator % 2 === 0) {
    numerator /= 2;
    denominator /= 2;
  }
  if (numerator === 0) return `${sign}${formatNumber(whole, lang)}″`;
  const fraction = `${numerator}/${denominator}`;
  return whole === 0 ? `${sign}${fraction}″` : `${sign}${formatNumber(whole, lang)} ${fraction}″`;
}

/**
 * The largest-first parts of a duration: `1 h 30 min`, never `0 d 1 h 30 min`
 * and never `1 h 30 min 0 s`. A single part means the first line already said
 * it, so there is nothing to add and the caller gets nothing.
 */
function duration(seconds, lang) {
  const sign = seconds < 0 ? "-" : "";
  let left = Math.abs(seconds);
  const steps = [
    [86400, "d"],
    [3600, "h"],
    [60, "min"],
    [1, "s"],
  ];
  const parts = steps.map(([size, label], index) => {
    const count = index === steps.length - 1 ? Number(left.toFixed(2)) : Math.floor(left / size);
    left -= count * size;
    return { count, label };
  });
  while (parts.length > 0 && parts[0].count === 0) parts.shift();
  while (parts.length > 0 && parts[parts.length - 1].count === 0) parts.pop();
  if (parts.length < 2) return null;
  const shown = parts.slice(0, 3).map((part) => `${formatNumber(part.count, lang)} ${part.label}`);
  return `${sign}${shown.join(" ")}`;
}

/** Every unit whose duration is worth reading back in parts. */
const DURATION_UNITS = new Set(["second", "minute", "hour", "day", "week"]);

/**
 * The extra line under a value, in the words a person would use.
 *
 * It is deliberately silent more often than not. A second line that repeats the
 * first is clutter, and clutter is what this page is trying not to be.
 *
 * @returns {string|null} null when there is nothing worth adding
 */
export function formatCompound(value, unitId, lang = "en") {
  if (!usable(value)) return null;
  const unit = unitById(unitId);
  if (!unit) return null;
  const size = Math.abs(value);

  if (unit.id === "foot") {
    // Feet and inches is how a person says a height or a room. Past a thousand
    // feet nobody counts the inches, and the second line becomes noise.
    if (size < 1 || size >= 1000) return null;
    return Number.isInteger(value) ? null : feetAndInches(value, lang);
  }
  if (unit.id === "inch") {
    if (size >= 1000) return null;
    const sixteenths = Math.round(size * 16);
    if (sixteenths === 0) return null;
    if (Number.isInteger(value)) return null;
    return inchFraction(value, lang);
  }
  if (DURATION_UNITS.has(unit.id)) {
    const seconds = convert(value, unit.id, "second");
    if (seconds === null || Math.abs(seconds) < 1 || Math.abs(seconds) >= 1e9) return null;
    return duration(seconds, lang);
  }
  return null;
}
