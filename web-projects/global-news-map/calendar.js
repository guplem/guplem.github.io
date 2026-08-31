// Which day of news the page is showing, and how to name that day to Wikipedia.
//
// Every date here is handled in UTC. The portal's day boundary is UTC, so a
// reader in Sydney and a reader in Los Angeles must be shown the same page for
// "today". Read a local date instead and both see the wrong day for part of it.

/** The month names Wikipedia uses in a portal page title. */
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A day as `YYYY-MM-DD` in UTC. This is the form the address bar carries.
 * @param {Date} date
 */
export function toIsoDay(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Read a `YYYY-MM-DD` day into a UTC midnight date.
 * @returns {Date|null} null when the text is not a real day, so a hand-edited
 *   address cannot put the page into a broken state
 */
export function fromIsoDay(text) {
  const parts = ISO_DAY.exec(String(text ?? ""));
  if (!parts) return null;
  const [, year, month, day] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects 2026-02-31, which `Date.UTC` would roll forward into March.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** The same clock time, `count` days away. Negative counts go back. */
export function addDays(date, count) {
  return new Date(date.getTime() + count * DAY_MS);
}

/** Today in UTC, at midnight. */
export function todayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * The Wikipedia page holding one day of news, for example
 * `Portal:Current events/2026 August 30`.
 */
export function portalPageTitle(date) {
  return `Portal:Current events/${date.getUTCFullYear()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Where a reader can see and edit the day on Wikipedia itself. */
export function portalPageUrl(date) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(portalPageTitle(date).replace(/ /g, "_"))}`;
}

/**
 * The day to open on first load.
 *
 * Not today: editors fill today's page as the day goes on, so at 01:00 UTC it is
 * nearly empty and the map would look broken. Yesterday is always complete.
 */
export function defaultDay(now = new Date()) {
  return addDays(todayUtc(now), -1);
}

/**
 * Whether a day can hold news yet. Guards the "next day" button and any date
 * typed into the address bar.
 */
export function isSelectableDay(date, now = new Date()) {
  return date instanceof Date && !Number.isNaN(date.getTime()) && date.getTime() <= todayUtc(now).getTime();
}
