// How many placeholders to draw while the board waits for GitHub.
//
// Nothing on this page may appear out of nothing after a pause. Every list the
// board is about to fill draws a placeholder in the shape of what is coming,
// and in as close to the right number as the page can know (ADR 0004).
//
// That number is what the board saw last time, kept in storage. Guessing a
// fixed three makes the page jump when eleven arrive; remembering eleven means
// the layout barely moves.

/** What to draw before the board has ever been used. */
export const SKELETON_FALLBACK = 3;

/** A reader does not need a hundred grey boxes to know the page is working. */
export const MOST_SKELETONS = 12;

/** How many placeholders to draw, given what was there last time. */
export function skeletonCount(lastKnown, fallback = SKELETON_FALLBACK) {
  if (!Number.isFinite(lastKnown)) return fallback;
  return Math.min(MOST_SKELETONS, Math.max(1, Math.round(lastKnown)));
}
