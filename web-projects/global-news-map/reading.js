// The reading list: how much of a story a folded row shows, and which row the
// reader has at the top of the list.
//
// Both answers belong to the phone layout. There the day and the map hold the
// top of the screen and only the list moves under them, so the list has to say
// what the reader is looking at: the row at the top of it is the story the map
// marks. The rows are folded to a summary as well, because a full sentence per
// story makes a list that only scrolls.
//
// Nothing here touches the DOM. The caller measures the rows and passes the
// numbers in, which is what lets `bun test` run this with no browser.

/**
 * How many characters a folded row shows before it is cut.
 *
 * About three lines on a phone, which is what keeps two whole stories on screen
 * under the map. A story on the portal runs to about 160 characters.
 */
export const SUMMARY_LIMIT = 120;

/** How much of a row must still be on screen for it to count as the top one. */
export const ROW_SLACK = 24;

/**
 * The folded form of one story's text.
 *
 * The cut lands between words, and the punctuation the cut leaves behind is
 * dropped: "Rain fell, …" reads as a typing mistake rather than as a cut.
 *
 * @param {string} text the story's own words
 * @param {number} [limit] how long the summary may be, in characters
 * @returns {{summary: string, folded: boolean}} `folded` is false when the whole
 *   text already fits, so the row needs no "show more" button for the text
 */
export function summarise(text, limit = SUMMARY_LIMIT) {
  const whole = String(text ?? "").trim();
  if (whole.length <= limit) return { summary: whole, folded: false };

  const window = whole.slice(0, limit);
  const lastSpace = window.lastIndexOf(" ");
  const head = lastSpace > 0 ? window.slice(0, lastSpace) : window;
  // A word longer than the limit leaves nothing to trim, so keep the hard cut.
  const tidy = head.replace(/[\s,;:.—–-]+$/, "") || head;
  return { summary: `${tidy}…`, folded: true };
}

/**
 * Which row stands at the top of the scrolling list.
 *
 * A row showing only a sliver of itself above the top edge is not the one being
 * read, so a row has to keep `slack` pixels on screen to win.
 *
 * @param {Array<{id: string, top: number, bottom: number}>} rows every row, in
 *   the order the list shows them, measured in the list's own coordinates
 * @param {number} scrollTop how far the list is scrolled
 * @param {number} [slack] how much of the row must still be on screen
 * @returns {string|null} the row's id, or null when the list is empty. Once the
 *   reader is past every row the last one stays chosen, so a list scrolled to
 *   its end still marks a story on the map.
 */
export function topmostRow(rows, scrollTop, slack = ROW_SLACK) {
  if (!rows?.length) return null;
  const line = scrollTop + slack;
  for (const row of rows) {
    if (row.bottom >= line) return row.id;
  }
  return rows[rows.length - 1].id;
}
