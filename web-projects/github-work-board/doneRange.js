// Which days the last column is about.
//
// The column was "Done today" and nothing else (ADR 0017). The question a
// person actually asks at a standup is "what did I finish yesterday", and on a
// Monday it is "what did I finish last week", so the column takes a range: the
// three presets people ask for out loud, and two date boxes for any other pair
// of days (ADR 0034).
//
// **Every boundary is midnight in the reader's own clock**, never UTC. A board
// opened at half past midnight in Barcelona must not still be showing
// yesterday's work as today's, and the same rule decides where a chosen day
// starts and ends.
//
// **A range travels in the link**, so its written form is permanent, exactly
// like a sort id or a column id. There are two forms: a preset id, and two days
// written `YYYY-MM-DD..YYYY-MM-DD`. Anything else reads as today, because a
// link is edited by hand and comes back from older versions of this page.

/** The range the column opens with, and the one a link leaves out. */
export const DEFAULT_RANGE = "today";

/** The ranges somebody asks for out loud. An id here travels in links, so it never changes. */
export const RANGE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last-7-days", label: "The last 7 days" },
];

const PRESET_IDS = new Set(RANGE_PRESETS.map((one) => one.id));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * One day as the reader's clock has it, or null when it is not a real day.
 *
 * `new Date("2026-09-19")` is midnight UTC, which is the day before in half the
 * world, so the parts are read out and handed over one by one instead.
 */
function readDay(value) {
  const found = DAY_PATTERN.exec(typeof value === "string" ? value : "");
  if (!found) return null;
  const [, year, month, day] = found.map(Number);
  const when = new Date(year, month - 1, day);
  // A date the calendar does not hold, like the 40th, rolls into the next
  // month. Reading the parts back is what catches that.
  if (when.getFullYear() !== year || when.getMonth() !== month - 1 || when.getDate() !== day) return null;
  return when;
}

/** One day written the way a range and a date box both write it. */
function writeDay(when) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}

/** Midnight at the start of a day, in the reader's own clock. */
function startOfDay(when) {
  const day = new Date(when);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** The same day, moved by a number of days. */
function addDays(when, days) {
  const day = new Date(when);
  day.setDate(day.getDate() + days);
  return day;
}

/**
 * The range this page was asked for, in its written form.
 *
 * A preset stays as it is. Two days come back with the earlier one first,
 * because somebody can type them the wrong way round or edit the link.
 * A single day reads as that day twice. Anything else is today.
 */
export function readRange(value) {
  if (typeof value !== "string") return DEFAULT_RANGE;
  if (PRESET_IDS.has(value)) return value;

  const [left, right] = value.includes("..") ? value.split("..") : [value, value];
  const from = readDay(left);
  const to = readDay(right);
  if (!from || !to) return DEFAULT_RANGE;
  return from <= to ? `${writeDay(from)}..${writeDay(to)}` : `${writeDay(to)}..${writeDay(from)}`;
}

/** Whether this is the range the column opens with, which a link leaves out. */
export function isDefaultRange(range) {
  return readRange(range) === DEFAULT_RANGE;
}

/** The two days a range covers, first and last, as `Date` objects at midnight. */
function daysOf(range, now) {
  const today = startOfDay(now instanceof Date ? now : new Date());
  const chosen = readRange(range);
  if (chosen === "today") return { first: today, last: today };
  if (chosen === "yesterday") return { first: addDays(today, -1), last: addDays(today, -1) };
  // Seven days including today, so a Tuesday standup reaches back to last
  // Wednesday rather than to last Tuesday.
  if (chosen === "last-7-days") return { first: addDays(today, -6), last: today };
  const [left, right] = chosen.split("..");
  return { first: readDay(left), last: readDay(right) };
}

/**
 * The moment the range starts, and the moment it stops.
 *
 * `to` is the midnight after the last day, so the whole of that day counts, and
 * a comparison never has to ask whether an end is inclusive.
 */
export function rangeBounds(range, now) {
  const { first, last } = daysOf(range, now);
  return { from: first.toISOString(), to: addDays(last, 1).toISOString() };
}

/** One day as the column head says it: `Fri 18 Sep`, or `18 Sep` without the weekday. */
function sayDay(when, { weekday = false } = {}) {
  const date = `${when.getDate()} ${MONTHS[when.getMonth()]}`;
  return weekday ? `${WEEKDAYS[when.getDay()]} ${date}` : date;
}

/**
 * What the column is called for this range.
 *
 * A single chosen day carries its weekday, because "last Friday" is how
 * somebody asks for it out loud. A chosen day is never renamed to "today":
 * the reader picked a date, so the column answers with that date.
 */
export function rangeLabel(range, now) {
  const chosen = readRange(range);
  if (chosen === "today") return "Done today";
  if (chosen === "yesterday") return "Done yesterday";
  if (chosen === "last-7-days") return "Done in the last 7 days";
  const { first, last } = daysOf(chosen, now);
  if (writeDay(first) === writeDay(last)) return `Done on ${sayDay(first, { weekday: true })}`;
  return `Done ${sayDay(first)} to ${sayDay(last)}`;
}

/** What the column says under its name when the reader hovers it. */
export function rangeHint(range, now) {
  const { first, last } = daysOf(range, now);
  const same = writeDay(first) === writeDay(last);
  const days = same ? sayDay(first, { weekday: true }) : `${sayDay(first)} to ${sayDay(last)}`;
  return `Merged or closed on ${days}, in this machine's clock`;
}

/** Both date boxes, filled with the days this range covers. */
export function rangeDates(range, now) {
  const { first, last } = daysOf(range, now);
  return { from: writeDay(first), to: writeDay(last) };
}

/**
 * The range two date boxes ask for.
 *
 * One end left empty is that one day: somebody who types one date wants that
 * date, not everything since it. Both ends empty is today, which is where the
 * column started.
 */
export function rangeFromDates(from, to) {
  const left = readDay(from);
  const right = readDay(to);
  if (!left && !right) return DEFAULT_RANGE;
  return readRange(`${writeDay(left ?? right)}..${writeDay(right ?? left)}`);
}
