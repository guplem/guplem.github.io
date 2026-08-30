// The letters.
//
// A five by seven bitmap font, drawn the way a handheld would. The game loads
// no font file, for the same reason it loads no image: everything it needs has
// to fit in the source (ADR 0001). A system font would also break the look,
// because it would be the one smooth thing on a screen of hard pixels.
//
// A glyph is seven rows of five characters, written as one string with slashes
// between the rows. A `#` is on and a `.` is off.
//
// The measuring and the line breaking are pure, so `font.test.js` can check
// that no sentence in the game runs off the edge of the message box.

/** Every glyph is this many pixels across and down. */
export const CHAR_W = 5;
export const CHAR_H = 7;

/** The gap between two letters, and between two lines. */
export const TRACKING = 1;
export const LEADING = 3;

const RAW = {
  A: ".###./#...#/#...#/#####/#...#/#...#/#...#",
  B: "####./#...#/####./#...#/#...#/#...#/####.",
  C: ".###./#...#/#..../#..../#..../#...#/.###.",
  D: "####./#...#/#...#/#...#/#...#/#...#/####.",
  E: "#####/#..../#..../####./#..../#..../#####",
  F: "#####/#..../#..../####./#..../#..../#....",
  G: ".###./#...#/#..../#.###/#...#/#...#/.###.",
  H: "#...#/#...#/#...#/#####/#...#/#...#/#...#",
  I: "#####/..#../..#../..#../..#../..#../#####",
  J: "....#/....#/....#/....#/#...#/#...#/.###.",
  K: "#...#/#..#./#.#../##.../#.#../#..#./#...#",
  L: "#..../#..../#..../#..../#..../#..../#####",
  M: "#...#/##.##/#.#.#/#...#/#...#/#...#/#...#",
  N: "#...#/##..#/#.#.#/#..##/#...#/#...#/#...#",
  O: ".###./#...#/#...#/#...#/#...#/#...#/.###.",
  P: "####./#...#/#...#/####./#..../#..../#....",
  Q: ".###./#...#/#...#/#...#/#.#.#/#..#./.##.#",
  R: "####./#...#/#...#/####./#.#../#..#./#...#",
  S: ".####/#..../#..../.###./....#/....#/####.",
  T: "#####/..#../..#../..#../..#../..#../..#..",
  U: "#...#/#...#/#...#/#...#/#...#/#...#/.###.",
  V: "#...#/#...#/#...#/#...#/#...#/.#.#./..#..",
  W: "#...#/#...#/#...#/#...#/#.#.#/##.##/#...#",
  X: "#...#/#...#/.#.#./..#../.#.#./#...#/#...#",
  Y: "#...#/#...#/.#.#./..#../..#../..#../..#..",
  Z: "#####/....#/...#./..#../.#.../#..../#####",

  a: "...../...../.###./....#/.####/#...#/.####",
  b: "#..../#..../####./#...#/#...#/#...#/####.",
  c: "...../...../.###./#..../#..../#...#/.###.",
  d: "....#/....#/.####/#...#/#...#/#...#/.####",
  e: "...../...../.###./#...#/#####/#..../.###.",
  f: "..##./.#.../####./.#.../.#.../.#.../.#...",
  g: "...../.####/#...#/#...#/.####/....#/.###.",
  h: "#..../#..../####./#...#/#...#/#...#/#...#",
  i: "..#../...../.##../..#../..#../..#../.###.",
  j: "...#./...../..##./...#./...#./#..#./.##..",
  k: "#..../#..../#...#/#..#./###../#..#./#...#",
  l: ".##../..#../..#../..#../..#../..#../.###.",
  m: "...../...../##.#./#.#.#/#.#.#/#.#.#/#...#",
  n: "...../...../####./#...#/#...#/#...#/#...#",
  o: "...../...../.###./#...#/#...#/#...#/.###.",
  p: "...../...../####./#...#/####./#..../#....",
  q: "...../...../.####/#...#/.####/....#/....#",
  r: "...../...../#.##./##..#/#..../#..../#....",
  s: "...../...../.####/#..../.###./....#/####.",
  t: ".#.../.#.../###../.#.../.#.../.#..#/..##.",
  u: "...../...../#...#/#...#/#...#/#..##/.##.#",
  v: "...../...../#...#/#...#/#...#/.#.#./..#..",
  w: "...../...../#...#/#.#.#/#.#.#/#.#.#/.#.#.",
  x: "...../...../#...#/.#.#./..#../.#.#./#...#",
  y: "...../...../#...#/#...#/.####/....#/.###.",
  z: "...../...../#####/...#./..#../.#.../#####",

  0: ".###./#...#/#..##/#.#.#/##..#/#...#/.###.",
  1: "..#../.##../..#../..#../..#../..#../.###.",
  2: ".###./#...#/....#/...#./..#../.#.../#####",
  3: "#####/...#./..##./....#/....#/#...#/.###.",
  4: "...#./..##./.#.#./#..#./#####/...#./...#.",
  5: "#####/#..../####./....#/....#/#...#/.###.",
  6: "..##./.#.../#..../####./#...#/#...#/.###.",
  7: "#####/....#/...#./..#../.#.../.#.../.#...",
  8: ".###./#...#/#...#/.###./#...#/#...#/.###.",
  9: ".###./#...#/#...#/.####/....#/...#./.##..",

  " ": "...../...../...../...../...../...../.....",
  ".": "...../...../...../...../...../.##../.##..",
  ",": "...../...../...../...../.##../.##../.#...",
  "!": "..#../..#../..#../..#../..#../...../..#..",
  "?": ".###./#...#/....#/...#./..#../...../..#..",
  "'": "..#../..#../...../...../...../...../.....",
  '"': ".#.#./.#.#./...../...../...../...../.....",
  "-": "...../...../...../.###./...../...../.....",
  ":": "...../..#../..#../...../..#../..#../.....",
  ";": "...../..#../..#../...../..#../..#../.#...",
  "(": "...#./..#../.#.../.#.../.#.../..#../...#.",
  ")": ".#.../..#../...#./...#./...#./..#../.#...",
  "/": "....#/....#/...#./..#../.#.../#..../#....",
  "+": "...../..#../..#../#####/..#../..#../.....",
  "%": "#...#/#..#./...#./..#../.#.../#..#./#...#",
  "*": "...../#.#.#/.###./#####/.###./#.#.#/.....",
  "<": "...#./..#../.#.../#..../.#.../..#../...#.",
  ">": ".#.../..#../...#./....#/...#./..#../.#...",
  "=": "...../...../#####/...../#####/...../.....",
  "_": "...../...../...../...../...../...../#####",
};

/** Every glyph, as seven rows of five characters. */
export const GLYPHS = Object.fromEntries(
  Object.entries(RAW).map(([character, rows]) => [character, rows.split("/")]),
);

/** What is drawn in place of a letter the font does not have. */
export const MISSING = GLYPHS["?"];

/** Every character this font can draw. */
export const CHARACTERS = Object.keys(GLYPHS);

/** The rows for one character, falling back to a question mark. */
export function glyphFor(character) {
  return GLYPHS[character] ?? MISSING;
}

/** True when the font has this character. */
export function hasGlyph(character) {
  return Object.prototype.hasOwnProperty.call(GLYPHS, character);
}

/** How wide a line of text is, in pixels. */
export function measureText(text) {
  const length = String(text ?? "").length;
  if (length === 0) return 0;
  return length * CHAR_W + (length - 1) * TRACKING;
}

/** How tall a block of lines is, in pixels. */
export function measureBlock(lines) {
  if (lines.length === 0) return 0;
  return lines.length * CHAR_H + (lines.length - 1) * LEADING;
}

/** How many characters fit inside a width, in pixels. */
export function charsThatFit(width) {
  return Math.max(0, Math.floor((width + TRACKING) / (CHAR_W + TRACKING)));
}

/**
 * How many rows of text fit inside a height, in pixels.
 *
 * The gap only sits between two rows, so the first row costs its height alone.
 * A panel that shows its whole text at once uses this to say how much it holds,
 * instead of carrying a number somebody guessed.
 */
export function rowsThatFit(height) {
  if (height < CHAR_H) return 0;
  return 1 + Math.floor((height - CHAR_H) / (CHAR_H + LEADING));
}

/**
 * Break a sentence into lines that fit a width.
 *
 * A word longer than the whole line is broken rather than dropped, because a
 * player who cannot read the message cannot play.
 *
 * @param {string} text
 * @param {number} maxWidth in pixels
 * @returns {string[]}
 */
export function wrapText(text, maxWidth) {
  const limit = charsThatFit(maxWidth);
  if (limit <= 0) return [];
  const lines = [];
  for (const paragraph of String(text ?? "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let piece = word;
      while (piece.length > limit) {
        // A word too long for one line at all: cut it and carry on.
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(piece.slice(0, limit));
        piece = piece.slice(limit);
      }
      if (!line) line = piece;
      else if (line.length + 1 + piece.length <= limit) line += ` ${piece}`;
      else {
        lines.push(line);
        line = piece;
      }
    }
    lines.push(line);
  }
  // A trailing empty line only appears for text that really was empty.
  while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * Break a sentence into pages of at most `rows` lines.
 * The message box shows one page at a time and waits for a key.
 */
export function paginate(text, maxWidth, rows = 2) {
  const lines = wrapText(text, maxWidth);
  const pages = [];
  for (let i = 0; i < lines.length; i += rows) pages.push(lines.slice(i, i + rows));
  return pages.length > 0 ? pages : [[""]];
}
