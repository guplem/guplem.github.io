// The wide layout: the map in the top left corner, and the day's stories as
// cards in columns around it and under it. See ADR 0006.
//
// Each card goes into the column that is shortest at that moment, which keeps
// the columns even and keeps the reading order close to left to right. CSS
// columns fill one column top to bottom before the next, so the second story
// of the day could land at the foot of the first column.
//
// Nothing here touches the DOM. The caller measures the cards and passes the
// numbers in, which is what lets `bun test` run this with no browser.

/** How many columns the map spans, at the top left of the layout. */
export const MAP_COLUMNS = 2;

/** The most columns the page uses. More would make the map too small beside them. */
const MAX_COLUMNS = 3;

/** The narrowest a card may be, in CSS pixels, before the page drops a column. */
const MIN_COLUMN_WIDTH = 300;

/**
 * How many columns fit in a width.
 *
 * @param {number} width the width of the layout, in CSS pixels
 * @param {number} gap the space between two columns, in CSS pixels
 * @returns {number} a count between `MAP_COLUMNS` and `MAX_COLUMNS`
 */
export function columnCountFor(width, gap) {
  const fits = Math.floor((width + gap) / (MIN_COLUMN_WIDTH + gap));
  return Math.min(MAX_COLUMNS, Math.max(MAP_COLUMNS, fits));
}

/**
 * Where each card goes.
 *
 * @param {object} layout
 * @param {number[]} layout.heights each card's height, in the list's order
 * @param {number} layout.columnCount how many columns there are
 * @param {number} layout.gap the space between two cards in a column
 * @param {number[]} [layout.startHeights] how much of each column, from the
 *   left, is already taken at the top. The map takes the first `MAP_COLUMNS`.
 * @returns {{ placements: { column: number, top: number }[], height: number }}
 *   the column and the top of each card, and the height of the tallest column
 */
export function placeCards({ heights, columnCount, gap, startHeights = [] }) {
  const bottoms = Array.from({ length: columnCount }, (_, column) => startHeights[column] ?? 0);
  const placements = heights.map((height) => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    // An empty column starts at its very top; any other leaves a gap under
    // what it already holds.
    const top = bottoms[column] === 0 ? 0 : bottoms[column] + gap;
    bottoms[column] = top + height;
    return { column, top };
  });
  return { placements, height: Math.max(0, ...bottoms) };
}
