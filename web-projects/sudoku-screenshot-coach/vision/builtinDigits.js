// Digit shapes the tool carries with it, so it does not depend on the fonts a
// device happens to have.
//
// `fonts.js` also builds reference pictures from the browser's own typefaces,
// but that alone is not safe: a phone, a desktop and a test machine each install
// a different set, and a missing family falls back to whatever the system likes.
// One real case: where every family falls back to DejaVu Sans, every reference
// "1" carries a foot serif, and a plain "1" from a sudoku app stops matching.
// These shapes cover the variants that differ between typefaces, so at least one
// reference always looks like what the player's app drew. See adr/0002.
//
// The paths are plain data in a 100 x 100 box, drawn as strokes. `fonts.js`
// turns them into pictures with a canvas; keeping them as data lets the table be
// checked without a browser.
//
// Commands: ["M", x, y] move, ["L", x, y] line, ["Q", cx, cy, x, y] curve,
// ["A", cx, cy, r, fromDegrees, toDegrees] arc.

/**
 * One or more shapes per digit. A second shape is listed only where typefaces
 * really disagree: the foot on a 1, the bar across a 7, the tail of a 9.
 */
export const BUILTIN_DIGIT_PATHS = {
  1: [
    // Plain: a flag and a stem, the shape most screen typefaces use.
    [["M", 36, 26], ["L", 52, 12], ["L", 52, 92]],
    // With a foot, the shape DejaVu, Georgia and most serif faces use.
    [["M", 36, 26], ["L", 52, 12], ["L", 52, 92], ["M", 32, 92], ["L", 72, 92]],
  ],
  2: [[["A", 50, 36, 24, 200, 355], ["M", 71, 46], ["L", 26, 90], ["L", 78, 90]]],
  3: [
    [
      ["A", 50, 31, 20, 200, 130],
      ["A", 50, 69, 22, 230, 130],
    ],
  ],
  4: [
    [["M", 62, 92], ["L", 62, 10], ["L", 20, 66], ["L", 80, 66]],
    // A closed apex, the way many print faces draw it.
    [["M", 62, 92], ["L", 62, 10], ["L", 20, 66], ["L", 80, 66], ["M", 62, 10], ["L", 62, 66]],
  ],
  5: [[["M", 72, 13], ["L", 33, 13], ["L", 29, 48], ["Q", 55, 38, 70, 55], ["Q", 80, 74, 60, 88], ["Q", 38, 96, 26, 80]]],
  6: [[["A", 50, 66, 24, 0, 360], ["M", 70, 20], ["Q", 32, 24, 27, 62]]],
  7: [
    [["M", 24, 14], ["L", 76, 14], ["L", 44, 92]],
    // With a bar across the stem, common in Europe and in many serif faces.
    [["M", 24, 14], ["L", 76, 14], ["L", 44, 92], ["M", 33, 55], ["L", 65, 55]],
  ],
  8: [[["A", 50, 31, 19, 0, 360], ["A", 50, 69, 23, 0, 360]]],
  9: [
    // A straight tail.
    [["A", 50, 33, 22, 0, 360], ["M", 72, 33], ["L", 62, 92]],
    // A curled tail.
    [["A", 50, 33, 22, 0, 360], ["M", 72, 36], ["Q", 71, 80, 38, 91]],
  ],
};

/** The box the coordinates above are written in. */
export const BUILTIN_BOX = 100;

/** How thick to draw the strokes, as a share of the box. */
export const BUILTIN_STROKE = 0.11;
