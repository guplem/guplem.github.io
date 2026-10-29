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

/**
 * How many placeholder cards to draw in each shown column, from what each
 * column held last time (`column:<id>` in the remembered counts).
 *
 * A column that was empty stays empty, because the real one will most likely
 * draw its dashed box again. A board saved before the columns were remembered
 * falls back to the uneven spread above.
 */
export function skeletonColumns(last, columnIds) {
  const known = columnIds.map((id) => last?.[`column:${id}`]);
  if (!known.every(Number.isFinite)) return skeletonColumnCounts(last?.items, columnIds.length);
  return known.map((count) => Math.min(MOST_SKELETONS, Math.max(0, Math.round(count))));
}

/**
 * The names of the filter menus to draw while the board waits.
 *
 * Each placeholder button carries its real name, unseen, so the bar has its
 * real width and the menus do not move when they land (ADR 0049). A board
 * saved before the names were remembered guesses them from the counts.
 */
export function skeletonFilterLabels(last) {
  if (Array.isArray(last?.menus)) return last.menus;
  return [
    ...(last?.repositories > 1 ? ["Repository"] : []),
    ...(last?.labels > 0 ? ["Label"] : []),
    ...(last?.milestones > 0 ? ["Milestone"] : []),
    ...Array.from({ length: Number.isFinite(last?.fields) ? last.fields : 0 }, () => "Field"),
  ];
}

/**
 * Which rows a placeholder card carries under its title: the row of labels and
 * the row of issue fields, each when most cards carried it last time.
 *
 * With a column id, the column's own memory (`labels:<id>` and `fields:<id>`
 * beside `column:<id>`) decides, because a column of pull requests carries no
 * issue fields while a column of issues does. Without one, or for a column the
 * board does not remember, the whole board decides.
 */
export function skeletonCardShape(last, columnId = "") {
  const inColumn = last?.[`column:${columnId}`];
  const own = columnId !== "" && Number.isFinite(inColumn) && inColumn > 0;
  const items = own ? inColumn : last?.items;
  if (!Number.isFinite(items) || items === 0) return { labels: true, fields: false };
  const most = (count) => Number.isFinite(count) && count * 2 >= items;
  return own
    ? { labels: most(last[`labels:${columnId}`]), fields: most(last[`fields:${columnId}`]) }
    : { labels: most(last.withLabels), fields: most(last.withFields) };
}
