// How often the board asks GitHub again on its own, and when a tick is due.
//
// The board reads GitHub once, when it connects. Anything that happens after
// that is invisible until the reader reloads the page. This module holds the
// schedule that fixes it (ADR 0025).
//
// **Asking is not free.** Every refresh spends the reader's GitHub rate limit,
// measured live against three separate budgets:
//
// | Budget | Limit | What one refresh spends, per token |
// |---|---|---|
// | REST `core` | 5000 an hour | 5 calls: who you are, open work, work closed today, the board repository, the board file |
// | REST `search` | 30 a **minute** | 1 call: the pull requests waiting for your review |
// | GraphQL | 5000 points an hour | 1 call: the links between items |
//
// The search budget is the tight one, because it is per minute and not per
// hour. It is what sets the shortest interval this module offers, and
// `refresh.test.js` holds that arithmetic as a test.
//
// **An id here is written into `board.json`** the moment somebody picks one, so
// it is as permanent as a colour id or a storage key.

export const DEFAULT_REFRESH = "off";

/** How often the board asks again. The first one never asks. */
export const REFRESH_CHOICES = [
  { id: "off", label: "Off", seconds: 0 },
  { id: "30s", label: "Every 30 seconds", seconds: 30 },
  { id: "1m", label: "Every minute", seconds: 60 },
  { id: "5m", label: "Every 5 minutes", seconds: 300 },
];

/** GitHub answers 30 search calls a minute, whatever the token. Measured, not guessed. */
export const SEARCH_BUDGET_PER_MINUTE = 30;

/** One refresh asks each token for the pull requests waiting on the reader, once. */
export const SEARCH_CALLS_PER_TOKEN = 1;

const BY_ID = new Map(REFRESH_CHOICES.map((one) => [one.id, one]));

/**
 * A schedule the board knows.
 *
 * Anything else asks for nothing. A newer build, or somebody editing the file
 * by hand, must never leave the board asking GitHub on a schedule nobody chose.
 */
export function knownRefresh(value) {
  return typeof value === "string" && BY_ID.has(value) ? value : DEFAULT_REFRESH;
}

/** How long the board waits between questions, in seconds. Zero means it never asks. */
export function refreshSeconds(choice) {
  return BY_ID.get(knownRefresh(choice))?.seconds ?? 0;
}

/**
 * Whether the board should ask GitHub again now.
 *
 * @param choice the reader's schedule
 * @param lastAt when the board last finished reading, in milliseconds, or null
 *   when it has not read yet
 * @param now the time this tick fired, in milliseconds
 * @param hidden whether the tab is out of sight
 * @param busy whether the board is already reading, or a save is on its way
 */
export function refreshDue({ choice = DEFAULT_REFRESH, lastAt = null, now = 0, hidden = false, busy = false } = {}) {
  const seconds = refreshSeconds(choice);
  if (seconds === 0) return false;

  // A board nobody is looking at is a board nobody needs refreshed, and the
  // rate limit is spent all the same. The tick resumes when the tab comes back.
  if (hidden) return false;

  // A refresh replaces the board document it has just read. While a note is on
  // its way to GitHub, that would race the reader's own typing (ADR 0002).
  if (busy) return false;

  if (typeof lastAt !== "number") return true;

  // A clock that went backwards must leave the board due, never stuck for hours.
  const waited = now - lastAt;
  if (waited < 0) return true;
  return waited >= seconds * 1000;
}
