// How far a read of GitHub has gone, for the thin bar at the top of the window.
//
// The read is not one call. For each token, `inspectToken` in `app.js` makes
// six calls: the first four together, then the relationships, then the
// checks. Every token reads at the same time (ADR 0040). So the bar can move by
// real steps instead of a timer that guesses (ADR 0039).
//
// The bar never reaches full here. Every call answered is not yet the board
// drawn: the merge and the render come after. `app.js` fills the bar only when
// the board is on the screen.

/** One entry for each call `inspectToken` makes, in the order the board waits on them. */
export const READ_STEPS = ["identity", "open-work", "finished-work", "reviews", "relationships", "checks"];

/** A bar with nothing in it reads as a page that has not started. */
export const READ_PROGRESS_FLOOR = 5;

/** Where the bar stops until the board is drawn. */
export const READ_PROGRESS_CEILING = 90;

/** The step after the last call: the merge and the render, which ask GitHub nothing. */
export const READ_DRAWING = "drawing";

/** The known steps that one token has finished, each once. */
function finishedSteps(done) {
  return new Set((Array.isArray(done) ? done : []).filter((step) => READ_STEPS.includes(step)));
}

/**
 * Which step the read waits on, and which tokens it waits on for that step.
 *
 * `doneByToken` holds, for each token in list order, the steps that token has
 * finished, in any order. The tokens read at the same time and a token's first
 * four calls answer in any order, so the step is the earliest one that some
 * token has not finished (ADR 0040). The refresh button's tooltip says this
 * while a read runs, so the reader can see what the board waits on.
 */
export function readingNow(doneByToken) {
  const tokens = Array.isArray(doneByToken) ? doneByToken.map(finishedSteps) : [];
  if (tokens.length === 0) return { step: READ_STEPS[0], waiting: [] };
  for (const step of READ_STEPS) {
    const waiting = tokens.flatMap((done, index) => (done.has(step) ? [] : [index]));
    if (waiting.length > 0) return { step, waiting };
  }
  return { step: READ_DRAWING, waiting: [] };
}

/** How many steps have ended over every token, for `readProgress`. */
export function stepsDone(doneByToken) {
  if (!Array.isArray(doneByToken)) return 0;
  return doneByToken.reduce((total, done) => total + finishedSteps(done).size, 0);
}

/** How full the bar is, in whole percent, after `stepsDone` steps over `tokenCount` tokens. */
export function readProgress(stepsDone, tokenCount) {
  const total = READ_STEPS.length * tokenCount;
  if (!Number.isFinite(stepsDone) || !(total > 0)) return READ_PROGRESS_FLOOR;
  const share = Math.min(1, Math.max(0, stepsDone / total));
  return Math.round(READ_PROGRESS_FLOOR + share * (READ_PROGRESS_CEILING - READ_PROGRESS_FLOOR));
}
