// How far a read of GitHub has gone, for the thin bar at the top of the window.
//
// The read is not one call. For each token, `inspectToken` in `app.js` waits on
// six calls one after another, and the tokens go one after another too. So the
// bar can move by real steps instead of a timer that guesses (ADR 0039).
//
// The bar never reaches full here. Every call answered is not yet the board
// drawn: the merge and the render come after. `app.js` fills the bar only when
// the board is on the screen.

/** One entry for each call `inspectToken` waits on, in the order it waits. */
export const READ_STEPS = ["identity", "open-work", "finished-work", "reviews", "relationships", "checks"];

/** A bar with nothing in it reads as a page that has not started. */
export const READ_PROGRESS_FLOOR = 5;

/** Where the bar stops until the board is drawn. */
export const READ_PROGRESS_CEILING = 90;

/** How full the bar is, in whole percent, after `stepsDone` steps over `tokenCount` tokens. */
export function readProgress(stepsDone, tokenCount) {
  const total = READ_STEPS.length * tokenCount;
  if (!Number.isFinite(stepsDone) || !(total > 0)) return READ_PROGRESS_FLOOR;
  const share = Math.min(1, Math.max(0, stepsDone / total));
  return Math.round(READ_PROGRESS_FLOOR + share * (READ_PROGRESS_CEILING - READ_PROGRESS_FLOOR));
}
