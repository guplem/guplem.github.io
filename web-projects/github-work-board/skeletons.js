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

/**
 * How tall each column looks against the others, read left to right. A real
 * board is uneven, and a row of equal columns reads as a grid of grey rather
 * than as a board, so the placeholder is uneven too. The pattern repeats past
 * the sixth column.
 */
const COLUMN_SHAPE = [1.5, 1, 0.5, 1, 2, 1];

/**
 * How many placeholder cards to draw in each shown column, given how many cards
 * the whole board held last time. The total stays close to that number, and
 * every column gets at least one card.
 */
export function skeletonColumnCounts(lastKnown, columns) {
  if (columns <= 0) return [];
  const share = Math.max(1, skeletonCount(lastKnown) / columns);
  return Array.from({ length: columns }, (_, index) => {
    const weight = COLUMN_SHAPE[index % COLUMN_SHAPE.length];
    return Math.min(MOST_SKELETONS, Math.max(1, Math.round(share * weight)));
  });
}
