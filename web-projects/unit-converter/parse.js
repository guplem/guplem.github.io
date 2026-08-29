// Reading one typed line into an amount, a unit and, if it is there, a target.
//
// The page has one input box and no dropdowns. Everything a person can choose,
// they choose by typing, so this module is the whole interface and it has to be
// generous about how people really write things:
//
//   100 km            5'10"          1 1/2 cup        $100
//   100km             5 ft 10 in     3/4 tsp          1.234,56 €
//   100 km to mi      1h30m          2.5e3 J          -40 C
//   100 cm in in      2h 15min       1 000 000 m      20°C
//
// The order of work is always the same:
//
//   1. split off a target ("... to mi") if there is one
//   2. read the left side as one amount, which may be written in several units
//      at once ("5 ft 10 in")
//   3. resolve the target inside the category the amount turned out to be
//
// Step 3 is what lets `100 cm in in` mean inches and `100 in to cm` mean the
// other thing: `in` is only a separator when what sits to its left is already a
// complete amount.

import { convert } from "./convert.js";
import { bestUnit, matchesExactly } from "./search.js";
import { unitById } from "./units.js";

/** The words and arrows that mean "and now the unit I want the answer in". */
const SEPARATORS = [" to ", " into ", " in ", " as ", " a ", " en ", "->", "→", "⇒", ">", "="];
/** The currency signs a person writes before the amount rather than after it. */
const CURRENCY_SIGNS = "$€£¥₹₩";
/**
 * A number at the front of a line.
 *
 * A space, a dot or a comma joins two runs of digits, so `1 000 000` and
 * `1.234,56` are each one number. An apostrophe only joins when exactly three
 * digits follow it, which is how Swiss writing groups digits (`1'000'000`).
 * Any other apostrophe is a foot mark, so `5'10"` reads as five and ten and
 * not as five hundred and ten. That one lookahead is the whole reason this
 * pattern is written out rather than inlined.
 */
const NUMBER_HEAD = /^[+-]?\d+(?:(?:[ .,_]|['’](?=\d{3}(?!\d)))\d+)*(?:[eE][+-]?\d+)?/;

/* -------------------------------------------------------------------------- */
/* Numbers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Decide what the dots and commas in a number mean, then read it.
 *
 * There is no way to be certain: `1,000` is one thousand to an English reader
 * and one to a Spanish one. The rules below are the ones that agree with what
 * people actually type:
 *
 *   - both marks present: the last one is the decimal mark
 *   - one comma followed by exactly three digits: a thousands mark (`1,000`)
 *   - one comma followed by anything else: a decimal mark (`1,5`)
 *   - more than one dot: thousands marks (`1.000.000`)
 *   - spaces and apostrophes between digits: always thousands marks
 */
function readDecimalMarks(text) {
  const cleaned = text.replace(/[\s'’_]/g, "");
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const grouping = decimal === "." ? "," : ".";
    return cleaned.split(grouping).join("").replace(decimal, ".");
  }
  if (lastComma >= 0) {
    const commas = cleaned.split(",").length - 1;
    const after = cleaned.slice(lastComma + 1);
    const isGrouping = commas > 1 || /^\d{3}$/.test(after);
    return isGrouping ? cleaned.split(",").join("") : cleaned.replace(",", ".");
  }
  if ((cleaned.split(".").length - 1) > 1) return cleaned.split(".").join("");
  return cleaned;
}

/**
 * Read one written amount: `100`, `1,5`, `1.234,56`, `2.5e3`, `3/4`, `1 1/2`.
 * @returns {number|null} null for anything that is not a number
 */
export function parseNumber(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (trimmed === "") return null;

  const fraction = /^([+-]?)(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (fraction) {
    const [, sign, whole, numerator, denominator] = fraction;
    if (Number(denominator) === 0) return null;
    const value = Number(whole ?? 0) + Number(numerator) / Number(denominator);
    return sign === "-" ? -value : value;
  }

  const value = Number(readDecimalMarks(trimmed));
  return Number.isFinite(value) ? value : null;
}

/* -------------------------------------------------------------------------- */
/* Splitting off the target                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Whether a piece of text is a complete amount and nothing else, which is what
 * makes `in` a separator in `100 cm in in` and a unit in `100 in to cm`. It has
 * to read the whole amount, compound parts and all, or `5'10" in cm` would look
 * unfinished at the `'` and the split would be refused.
 */
function isCompleteAmount(text) {
  const amount = readAmount(text.trim());
  return Boolean(amount.unit && amount.rest === "");
}

/**
 * Split `100 km to mi` into `100 km` and `mi`.
 *
 * Candidates are tried from the right, because the rightmost separator is the
 * one a person means: in `100 in to cm` the ` in ` comes first in the line but
 * the ` to ` is the split. A candidate only counts when what sits to its left
 * is already a complete amount, which is what keeps `in` free to mean inches.
 *
 * @returns {{left: string, right: string, awaiting: boolean}}
 */
function splitTarget(text) {
  const candidates = [];
  for (const separator of SEPARATORS) {
    let at = text.indexOf(separator);
    while (at >= 0) {
      candidates.push({ at, separator });
      at = text.indexOf(separator, at + 1);
    }
  }
  candidates.sort((a, b) => b.at - a.at);
  for (const { at, separator } of candidates) {
    const left = text.slice(0, at).trim();
    if (left !== "" && isCompleteAmount(left)) {
      return { left, right: text.slice(at + separator.length).trim(), awaiting: true };
    }
  }
  // A line that simply ends with a separator is a person part-way through
  // typing one. The page should already be offering targets.
  for (const separator of SEPARATORS) {
    const tail = separator.trimEnd();
    if (text.endsWith(tail) && isCompleteAmount(text.slice(0, text.length - tail.length).trim())) {
      return { left: text.slice(0, text.length - tail.length).trim(), right: "", awaiting: true };
    }
  }
  return { left: text, right: "", awaiting: false };
}

/* -------------------------------------------------------------------------- */
/* Reading the amount                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Read one `<number><unit>` pair off the front of a line.
 *
 * @param {string} text the line, already trimmed
 * @param {string|null} category the category the unit must belong to, so that
 *   the `m` in `1h30m` is minutes and not metres
 * @returns {{value: number, unit: object|undefined, unitText: string, rest: string}|null}
 */
function readOnePart(text, category) {
  if (text === "") return null;

  // A currency sign written in front of the amount, as in `$100`.
  if (CURRENCY_SIGNS.includes(text[0])) {
    const sign = text[0];
    const after = text.slice(1).trim();
    const inner = readOnePart(after, category);
    if (!inner) return null;
    return { ...inner, unit: inner.unit ?? bestUnit(sign, { category }), unitText: inner.unitText || sign };
  }

  const fraction = /^([+-]?)(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)/.exec(text);
  const numberMatch = fraction ?? NUMBER_HEAD.exec(text);
  if (!numberMatch) return null;

  const value = parseNumber(numberMatch[0].trim());
  if (value === null) return null;

  return { value, ...readUnitText(text.slice(numberMatch[0].length), category) };
}

/**
 * Take the unit off the front of what follows a number.
 *
 * Stopping at the first digit is the obvious rule and it is wrong: a unit may
 * hold digits of its own (`l/100km`, `m2`, `in3`). Cutting there made
 * `7 l/100km` read as seven litres per 100 km *plus another hundred km/l*, and
 * then answer for eight.
 *
 * So the longest readings are tried first, and one is taken only when it is a
 * unit spelled out in full. Anything shorter and the reading is ambiguous, in
 * which case the first-digit rule is right after all: `1h30m` really is two
 * parts, and `5'10"` really is two parts.
 *
 * @returns {{unit: object|undefined, unitText: string, rest: string}}
 */
function readUnitText(after, category) {
  const body = after.replace(/^\s+/, "");

  for (const candidate of [body, body.match(/^\S+/)?.[0] ?? ""]) {
    const trimmed = candidate.trim();
    if (trimmed === "") continue;
    const unit = bestUnit(trimmed, { category });
    if (unit && matchesExactly(unit, trimmed)) {
      return { unit, unitText: trimmed, rest: body.slice(candidate.length).trim() };
    }
  }

  const upToDigit = body.match(/^[^\d]*/)?.[0] ?? "";
  const unitText = upToDigit.trim();
  return {
    unit: unitText === "" ? undefined : bestUnit(unitText, { category }),
    unitText,
    rest: body.slice(upToDigit.length).trim(),
  };
}

/** The short label a compound amount is echoed back with: `5 ft 10 in`. */
const labelOf = (parts) => parts.map((part) => `${part.value} ${part.unit.sym}`).join(" ");

/**
 * Read the whole left side: one amount, possibly written in several units of
 * the same category at once (`5 ft 10 in`, `1h 30m 30s`).
 *
 * Every part after the first is looked up inside the first part's category, and
 * a part that does not belong there ends the amount rather than joining it:
 * `2h 30km` is two unrelated things, so only the `2h` is read.
 */
function readAmount(text) {
  const first = readOnePart(text, null);
  if (!first) return { value: null, unit: null, unitText: text.trim(), parts: [], rest: text.trim() };
  if (!first.unit) return { value: first.value, unit: null, unitText: first.unitText, parts: [], rest: first.rest };

  const parts = [{ value: first.value, unit: first.unit }];
  let rest = first.rest;
  while (rest !== "") {
    const next = readOnePart(rest, first.unit.cat);
    if (!next?.unit) break;
    parts.push({ value: next.value, unit: next.unit });
    rest = next.rest;
  }

  // Add the parts up in the unit of the first one, which is the largest and the
  // one a person would read the answer back in.
  const total = parts.reduce((sum, part) => sum + (convert(part.value, part.unit.id, first.unit.id) ?? 0), 0);
  return { value: total, unit: first.unit, unitText: first.unitText, parts, rest };
}

/* -------------------------------------------------------------------------- */
/* The whole line                                                             */
/* -------------------------------------------------------------------------- */

const EMPTY = {
  raw: "",
  amountText: "",
  value: null,
  unitId: null,
  unitQuery: "",
  targetId: null,
  targetQuery: "",
  awaitingTarget: false,
  impliedValue: false,
  label: null,
};

/**
 * Read one typed line.
 *
 * @param {string} text what is in the input box
 * @returns {{
 *   raw: string, amountText: string, value: number|null, unitId: string|null,
 *   unitQuery: string, targetId: string|null, targetQuery: string,
 *   awaitingTarget: boolean, impliedValue: boolean, label: string|null
 * }} `unitQuery` and `targetQuery` are what was typed, so the page can offer
 *   suggestions for a unit that is still half-written. `amountText` is the left
 *   side without any target, which is what the page rebuilds the line from when
 *   a suggestion is chosen. `impliedValue` is true when a bare unit was read as
 *   one of it. `label` is set only when the amount was written in more than one
 *   unit.
 */
export function parseQuery(text) {
  if (typeof text !== "string") return { ...EMPTY };
  const raw = text.trim();
  if (raw === "") return { ...EMPTY };

  const { left, right, awaiting } = splitTarget(raw);
  const amount = readAmount(left);

  // A bare unit with no number is read as one of it, so that typing `km` alone
  // already answers instead of waiting for a `1`.
  let value = amount.value;
  let unit = amount.unit;
  let unitQuery = amount.unitText;
  let impliedValue = false;
  if (value === null) {
    const guess = bestUnit(left);
    if (guess) {
      value = 1;
      unit = guess;
      unitQuery = left;
      impliedValue = true;
    }
  }

  const target = right === "" ? undefined : bestUnit(right, { category: unit?.cat ?? null });

  return {
    raw,
    amountText: left,
    value,
    unitId: unit?.id ?? null,
    unitQuery,
    targetId: target?.id ?? null,
    targetQuery: right,
    awaitingTarget: awaiting,
    impliedValue,
    label: amount.parts.length > 1 ? labelOf(amount.parts) : null,
  };
}

/** The unit a parse settled on, or undefined. A small helper for the page. */
export function parsedUnit(parsed) {
  return unitById(parsed?.unitId);
}
