// Synthetic screenshots for the vision tests.
//
// This module is used by tests only. It draws a sudoku grid, its digits, and the
// clutter that surrounds a puzzle in a real screenshot (a header bar, a block of
// body text, buttons), so the detector can be tested end to end with no browser
// and no binary fixture files in the repository.
//
// The digits come from a 5x7 pixel font defined below. The real page builds its
// templates from browser fonts instead, but both go through the same
// `normalizeGlyph` step, so a test that reads this font back proves the same
// code path the page uses.

/** 5 wide, 7 tall, one string per row. `#` is ink. */
export const FONT_5X7 = {
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", "..#..", ".#...", ".#..."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
};

/** A blank RGBA canvas of one colour. */
function blankRgba(width, height, level) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = level;
    rgba[i * 4 + 1] = level;
    rgba[i * 4 + 2] = level;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

function fillRect(rgba, width, height, x, y, w, h, level) {
  for (let row = Math.max(0, y); row < Math.min(height, y + h); row += 1) {
    for (let col = Math.max(0, x); col < Math.min(width, x + w); col += 1) {
      const i = (row * width + col) * 4;
      rgba[i] = level;
      rgba[i + 1] = level;
      rgba[i + 2] = level;
      rgba[i + 3] = 255;
    }
  }
}

/** Draw one digit of the 5x7 font, scaled, with its top-left corner at (x, y). */
function drawGlyph(rgba, width, height, digit, x, y, scale, level) {
  const rows = FONT_5X7[digit];
  for (let gy = 0; gy < rows.length; gy += 1) {
    for (let gx = 0; gx < rows[gy].length; gx += 1) {
      if (rows[gy][gx] !== "#") continue;
      fillRect(rgba, width, height, x + gx * scale, y + gy * scale, scale, scale, level);
    }
  }
}

/** The ink mask of one digit on its own, at the given scale. */
export function glyphMask(digit, scale = 4) {
  const rows = FONT_5X7[digit];
  const width = 5 * scale;
  const height = 7 * scale;
  const mask = new Uint8Array(width * height);
  for (let gy = 0; gy < rows.length; gy += 1) {
    for (let gx = 0; gx < rows[gy].length; gx += 1) {
      if (rows[gy][gx] !== "#") continue;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) mask[(gy * scale + sy) * width + gx * scale + sx] = 1;
      }
    }
  }
  return { mask, width, height };
}

/**
 * Draw a sudoku screenshot.
 * @param {object} options
 * @param {string} options.puzzle 81 characters, `.` or `0` for an empty cell
 * @param {number} [options.cell] cell size in pixels
 * @param {number} [options.originX] left edge of the grid inside the image
 * @param {number} [options.originY] top edge of the grid inside the image
 * @param {number} [options.width] image width
 * @param {number} [options.height] image height
 * @param {boolean} [options.clutter] draw a header, text lines and buttons around it
 * @param {boolean} [options.darkMode] light grid on a dark page
 * @param {number} [options.lineWidth] thickness of the thin grid lines
 * @param {Record<number, number[]>} [options.notes] pencil marks per cell index:
 *   the small candidate digits a player writes in a corner. The reader must
 *   ignore these, so tests draw them at the size real apps use.
 * @param {number} [options.selectedCell] cell index to paint as a solid
 *   highlight, the way an app marks the cell the player is on
 * @returns {{rgba: Uint8ClampedArray, width: number, height: number,
 *   origin: {x: number, y: number}, cell: number, size: number}}
 */
export function renderSudokuScreenshot(options = {}) {
  const {
    puzzle = ".".repeat(81),
    cell = 48,
    originX = 60,
    originY = 140,
    clutter = true,
    darkMode = false,
    lineWidth = 2,
    notes = {},
    selectedCell = null,
  } = options;
  const size = cell * 9;
  const width = options.width ?? originX * 2 + size;
  const height = options.height ?? originY + size + 160;

  const page = darkMode ? 24 : 246;
  const ink = darkMode ? 232 : 26;
  const soft = darkMode ? 90 : 170;

  const rgba = blankRgba(width, height, page);

  if (clutter) {
    // A header bar, a title, body text lines, and two buttons: the "other
    // things" a screenshot carries around the puzzle.
    fillRect(rgba, width, height, 0, 0, width, 56, darkMode ? 44 : 222);
    fillRect(rgba, width, height, 16, 20, 120, 14, ink);
    fillRect(rgba, width, height, width - 90, 18, 70, 20, soft);
    for (let line = 0; line < 3; line += 1) {
      fillRect(rgba, width, height, 40, 76 + line * 16, width - 160 - line * 40, 7, soft);
    }
    fillRect(rgba, width, height, 40, originY + size + 40, 150, 44, soft);
    fillRect(rgba, width, height, 220, originY + size + 40, 150, 44, soft);
    // A large filled panel: a decoy that is bigger than the grid but has no
    // line structure inside it.
    fillRect(rgba, width, height, width - 46, originY, 30, size, darkMode ? 60 : 205);
  }

  // The cell the player is on: a solid block of colour that fills the cell.
  if (selectedCell !== null) {
    const row = Math.floor(selectedCell / 9);
    const col = selectedCell % 9;
    fillRect(rgba, width, height, originX + col * cell + 2, originY + row * cell + 2, cell - 4, cell - 4, darkMode ? 70 : 186);
  }

  // The grid: thin lines everywhere, thick lines on the box borders.
  for (let index = 0; index <= 9; index += 1) {
    const thick = index % 3 === 0 ? lineWidth * 2 : lineWidth;
    const offset = Math.floor(thick / 2);
    fillRect(rgba, width, height, originX - offset, originY + index * cell - offset, size + thick, thick, ink);
    fillRect(rgba, width, height, originX + index * cell - offset, originY - offset, thick, size + thick, ink);
  }

  // The digits, centred in their cells.
  const scale = Math.max(2, Math.round((cell * 0.62) / 7));
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const char = puzzle[row * 9 + col];
      if (char < "1" || char > "9") continue;
      const glyphWidth = 5 * scale;
      const glyphHeight = 7 * scale;
      drawGlyph(
        rgba,
        width,
        height,
        Number(char),
        originX + col * cell + Math.round((cell - glyphWidth) / 2),
        originY + row * cell + Math.round((cell - glyphHeight) / 2),
        scale,
        ink
      );
    }
  }

  // The pencil marks. Measured against a real screenshot, a mark stands about
  // four tenths as tall as a digit, and sits in a corner rather than the middle.
  const noteScale = Math.max(1, Math.round(scale * 0.4));
  for (const [cellIndex, marks] of Object.entries(notes)) {
    const row = Math.floor(Number(cellIndex) / 9);
    const col = Number(cellIndex) % 9;
    marks.slice(0, 4).forEach((mark, order) => {
      const gap = Math.round(cell * 0.06);
      const x = originX + col * cell + gap + (order % 2) * Math.round(cell * 0.36);
      const y = originY + row * cell + gap + Math.floor(order / 2) * Math.round(cell * 0.42);
      drawGlyph(rgba, width, height, mark, x, y, noteScale, ink);
    });
  }

  return { rgba, width, height, origin: { x: originX, y: originY }, cell, size };
}

/** Templates for the classifier, built from the 5x7 font through `normalizeGlyph`. */
export function fontTemplates(normalizeGlyph, glyphSize) {
  const templates = [];
  for (let digit = 1; digit <= 9; digit += 1) {
    for (const scale of [3, 5]) {
      const { mask, width, height } = glyphMask(digit, scale);
      templates.push({
        digit,
        ...normalizeGlyph(mask, width, height, { x: 0, y: 0, width, height }, glyphSize),
      });
    }
  }
  return templates;
}
