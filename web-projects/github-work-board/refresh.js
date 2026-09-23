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
// | REST `core` | 5000 an hour | 3 calls: who you are, open work, work closed today |
// | REST `search` | 30 a **minute** | 1 call: the pull requests waiting for your review |
// | GraphQL | 5000 points an hour | 1 or 2 calls: the links between items, then the children of any issue that has them |
//
// The search budget is the tight one, because it is per minute and not per
// hour. It is what sets the shortest interval this module offers, and
// `refresh.test.js` holds that arithmetic as a test.
//
// **GraphQL is charged by size, not by call.** Its budget is points, and the
// points come from how much a query could return rather than from how much it
// did. Both numbers below were measured with `rateLimit(dryRun: true)` on the
// board's own query, at the largest batch it ever sends.
//
// **An id here is written into `board.json`** the moment somebody picks one, so
// it is as permanent as a colour id or a storage key.

/**
 * The schedule that asks nothing.
 *
 * It is its own name, and never "whatever the default is". One line in
 * `app.js` once read `state.refreshId === DEFAULT_REFRESH` to mean "off". The
 * day the default stopped being "off", that line inverted, and the timer would
 * have started on "off" and never on the default. Nothing would have failed.
 */
export const OFF = "off";

/**
 * How often the board asks when nobody has chosen.
 *
 * **A minute, not 30 seconds.** The board also asks the moment a hidden tab is
 * looked at again, so the interval decides only how fresh the board stays while
 * somebody watches it, and work does not move in 30 seconds. A minute halves
 * what a board left open on a second screen all day spends, and 30 seconds is
 * one choice away for anybody who wants it (ADR 0025).
 */
export const DEFAULT_REFRESH = "1m";

/** How often the board asks again. The first one never asks. */
export const REFRESH_CHOICES = [
  { id: OFF, label: "Off", seconds: 0 },
  { id: "30s", label: "Every 30 seconds", seconds: 30 },
  { id: "1m", label: "Every minute", seconds: 60 },
  { id: "5m", label: "Every 5 minutes", seconds: 300 },
];

/** GitHub answers 30 search calls a minute, whatever the token. Measured, not guessed. */
export const SEARCH_BUDGET_PER_MINUTE = 30;

/** One refresh asks each token for the pull requests waiting on the reader, once. */
export const SEARCH_CALLS_PER_TOKEN = 1;

/** GitHub answers 5000 GraphQL points an hour, for each token. Measured, not guessed. */
export const GRAPHQL_BUDGET_PER_HOUR = 5000;

/**
 * What one refresh spends of it, for one token, on the largest board there is.
 *
 * 18 points for a full batch of 100 items, and at most one more batch of the
 * same size for their children, so 36 is the worst a refresh can cost. The
 * board asks about one batch of children and no more, which is what keeps this
 * number a number rather than "however many children the reader has".
 *
 * **Measure this again whenever the query grows a field.** It read 13 when it
 * was first written and measured 18 on 2026-09-23, because the query grew and
 * nobody asked it again. The cost is worked out from the query alone, so
 * `rateLimit(dryRun: true)` answers it without a real board (ADR 0010).
 */
export const GRAPHQL_POINTS_PER_TOKEN = 36;

const BY_ID = new Map(REFRESH_CHOICES.map((one) => [one.id, one]));

/**
 * A schedule the board knows.
 *
 * Anything else falls back to the default, never to off. A newer build, or
 * somebody editing the file by hand, must not read as the reader switching
 * the feature off (ADR 0025).
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
 * A call that says nothing about the schedule asks nothing. The default here
 * is `OFF` and not `DEFAULT_REFRESH`, because "nobody told me" and "nobody has
 * chosen yet" are different questions: the second one is the reader's, and it
 * is answered in `settings.js` where their choice is read.
 *
 * @param choice the reader's schedule
 * @param lastAt when the board last finished reading, in milliseconds, or null
 *   when it has not read yet
 * @param now the time this tick fired, in milliseconds
 * @param hidden whether the tab is out of sight
 * @param busy whether the board is already reading, or a save is on its way
 */
export function refreshDue({ choice = OFF, lastAt = null, now = 0, hidden = false, busy = false } = {}) {
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
