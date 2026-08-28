// Reads the 81 digits out of a grid that `detect.js` has pulled flat.
//
// There is no OCR library here. A sudoku holds nine shapes only, drawn large and
// clean, so the reader normalises each cell to a small fixed picture and compares
// it with pictures of the digits 1 to 9. That is faster than a general OCR engine
// and easier to reason about: a wrong reading is a nearest-match distance, not a
// black box. See adr/0002.
//
// The page builds the reference pictures from browser fonts (`fonts.js`); the
// tests build them from a pixel font. Both go through `normalizeGlyph`, so the
// two paths stay comparable.

import { labelComponents } from "./detect.js";
import { adaptiveThreshold } from "./imaging.js";

/** Side of the little square picture every digit is squeezed into. */
export const GLYPH_SIZE = 16;
/** Share of the cell trimmed off each edge, to drop the grid lines. */
export const CELL_MARGIN = 0.17;
/**
 * A digit fills a good part of its cell. Measured on real screenshots, a digit
 * stands about seven tenths as tall as the trimmed cell and a pencil mark about
 * three tenths, so a shape below this share of the cell is not a digit.
 */
export const MIN_DIGIT_HEIGHT_OF_CELL = 0.35;
/**
 * A digit is also close in height to the other digits of the same grid. This is
 * the share of the measured digit height a shape must reach. It carries grids
 * whose digits are drawn small, where the fixed share above is too generous.
 */
export const MIN_DIGIT_HEIGHT_OF_REFERENCE = 0.55;

/** Where one cell sits inside the flattened grid. */
export function cellRegion(row, col, warpSize) {
  const size = warpSize / 9;
  return { x: Math.round(col * size), y: Math.round(row * size), size: Math.round(size) };
}

/** The tight box around the ink, or null when the patch is blank. */
export function inkBoundingBox(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, count };
}

/**
 * Squeeze the ink inside `box` into a fixed square picture.
 * The shape keeps its proportions and sits in the middle, so the same digit
 * drawn at any size lands on the same picture. Each output value is the share of
 * ink in the piece of the source it covers, which keeps thin strokes visible.
 * @returns {{vector: Float32Array, aspect: number, fill: number}}
 */
export function normalizeGlyph(mask, width, height, box, glyphSize = GLYPH_SIZE) {
  const vector = new Float32Array(glyphSize * glyphSize);
  const inner = glyphSize - 4; // leave a two-pixel margin all round
  const scale = Math.min(inner / box.width, inner / box.height);
  const drawWidth = Math.max(1, box.width * scale);
  const drawHeight = Math.max(1, box.height * scale);
  const offsetX = (glyphSize - drawWidth) / 2;
  const offsetY = (glyphSize - drawHeight) / 2;

  for (let y = 0; y < glyphSize; y += 1) {
    for (let x = 0; x < glyphSize; x += 1) {
      // Map this output pixel back to a rectangle of the source box.
      const sx0 = box.x + ((x - offsetX) / scale);
      const sy0 = box.y + ((y - offsetY) / scale);
      const sx1 = sx0 + 1 / scale;
      const sy1 = sy0 + 1 / scale;
      let ink = 0;
      let total = 0;
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy += 1) {
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx += 1) {
          total += 1;
          // Anything outside the box counts as background. Without this, a
          // narrow digit such as a 1 is blown up so much that the sampling
          // reaches into the rest of the cell and picks up pencil marks.
          if (sx < box.x || sx >= box.x + box.width || sy < box.y || sy >= box.y + box.height) continue;
          if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
          if (mask[sy * width + sx]) ink += 1;
        }
      }
      vector[y * glyphSize + x] = total > 0 ? ink / total : 0;
    }
  }

  let sum = 0;
  for (const value of vector) sum += value;
  return { vector, aspect: box.width / box.height, fill: sum / vector.length };
}

/** Squared distance between two pictures, plus a small penalty for a different shape. */
function glyphDistance(glyph, template) {
  let sum = 0;
  for (let i = 0; i < glyph.vector.length; i += 1) {
    const difference = glyph.vector[i] - template.vector[i];
    sum += difference * difference;
  }
  const shape = Math.abs(glyph.aspect - template.aspect);
  return sum / glyph.vector.length + shape * 0.05;
}

/**
 * Name the digit a picture looks most like.
 * @returns {{digit: number, distance: number, runnerUp: number|null, confidence: number}|null}
 *   `confidence` is how much better the winner is than the best other digit,
 *   from 0 (a coin flip) to 1 (a perfect match with no rival).
 */
export function classifyGlyph(glyph, templates) {
  if (!templates || templates.length === 0) return null;
  const bestPerDigit = new Map();
  for (const template of templates) {
    const distance = glyphDistance(glyph, template);
    const current = bestPerDigit.get(template.digit);
    if (current === undefined || distance < current) bestPerDigit.set(template.digit, distance);
  }
  const ranked = [...bestPerDigit.entries()].sort((a, b) => a[1] - b[1]);
  const [digit, distance] = ranked[0];
  const runner = ranked[1] ?? null;
  const confidence = runner ? Math.max(0, Math.min(1, (runner[1] - distance) / (runner[1] + 1e-6))) : 1;
  return { digit, distance, runnerUp: runner ? runner[0] : null, confidence };
}

/** Cut one cell out of the flattened grid, trimming the margin that holds the rules. */
function cropCell(mask, warpSize, row, col) {
  const region = cellRegion(row, col, warpSize);
  const margin = Math.round(region.size * CELL_MARGIN);
  const cropSize = region.size - margin * 2;
  if (cropSize < 6) return null;
  const crop = new Uint8Array(cropSize * cropSize);
  for (let y = 0; y < cropSize; y += 1) {
    for (let x = 0; x < cropSize; x += 1) {
      const sx = region.x + margin + x;
      const sy = region.y + margin + y;
      if (sx >= warpSize || sy >= warpSize) continue;
      crop[y * cropSize + x] = mask[sy * warpSize + sx];
    }
  }
  return { crop, cropSize };
}

/**
 * Pick the one shape in a cell that could be a digit.
 *
 * A cell may hold a digit, several pencil marks, a leftover piece of a rule, or
 * a block of highlight colour. Each of those is a separate connected shape, so
 * the search takes the tallest one and keeps only shapes that belong with it:
 * a piece directly above or below it that overlaps it sideways, which is how a
 * digit breaks apart when a thin stroke drops out of the threshold.
 *
 * @returns {{box: object, mask: Uint8Array}|null} the shape and a mask holding
 *   only its pixels, so nothing else in the cell reaches the classifier.
 */
function mainShape(crop, cropSize) {
  const { labels, components } = labelComponents(crop, cropSize, cropSize);
  const usable = components.filter((component) => {
    const width = component.maxX - component.minX + 1;
    const height = component.maxY - component.minY + 1;
    if (component.count < 5) return false; // speckle
    // A highlight behind the cell fills it corner to corner. A digit never does.
    if (width > cropSize * 0.9 && height > cropSize * 0.9) return false;
    return true;
  });
  if (usable.length === 0) return null;

  const tallest = usable.reduce((best, component) =>
    component.maxY - component.minY > best.maxY - best.minY ? component : best
  );
  const group = usable.filter((component) => {
    if (component === tallest) return true;
    const overlap = Math.min(component.maxX, tallest.maxX) - Math.max(component.minX, tallest.minX) + 1;
    const narrower = Math.min(component.maxX - component.minX, tallest.maxX - tallest.minX) + 1;
    const gap = Math.max(tallest.minY - component.maxY, component.minY - tallest.maxY);
    return overlap >= narrower * 0.5 && gap <= 3;
  });

  const ids = new Set(group.map((component) => component.id));
  const shapeMask = new Uint8Array(crop.length);
  let count = 0;
  for (let index = 0; index < crop.length; index += 1) {
    if (ids.has(labels[index])) {
      shapeMask[index] = 1;
      count += 1;
    }
  }
  const box = {
    x: Math.min(...group.map((component) => component.minX)),
    y: Math.min(...group.map((component) => component.minY)),
    width: Math.max(...group.map((component) => component.maxX)) - Math.min(...group.map((component) => component.minX)) + 1,
    height: Math.max(...group.map((component) => component.maxY)) - Math.min(...group.map((component) => component.minY)) + 1,
    count,
  };
  return { box, mask: shapeMask };
}

/**
 * Decide whether a shape is a digit rather than noise or a leftover rule.
 * @param {number} minHeight the height a digit must reach in this grid
 */
function looksLikeDigit(box, cropSize, minHeight) {
  if (box.count < 6) return false;
  if (box.height < minHeight) return false;
  if (box.width > box.height * 1.6) return false; // a leftover rule is wide and flat
  if (box.count / (box.width * box.height) < 0.12) return false; // too sparse to be a stroke
  return true;
}

/**
 * Read all 81 cells of a flattened grid.
 *
 * It runs in two passes. The first finds the main shape in every cell and
 * measures it. The second throws away every shape much shorter than the digits
 * in this grid, which is what separates a player's pencil marks from the digits
 * themselves, and reads what is left.
 *
 * @param {Uint8ClampedArray} warped the grid pulled flat, `warpSize` on a side
 * @param {number} warpSize
 * @param {Array} templates reference pictures, from `fonts.js` or the test font
 * @returns {{digits: Int8Array, confidences: Float32Array, alternates: Int8Array,
 *   text: string, filled: number, glyphs: Array, digitHeight: number}}
 *   `alternates` holds the second-best digit per cell, which the repair step uses.
 */
export function readGrid(warped, warpSize, templates) {
  const mask = adaptiveThreshold(warped, warpSize, warpSize);
  const digits = new Int8Array(81);
  const confidences = new Float32Array(81);
  const alternates = new Int8Array(81);
  const glyphs = new Array(81).fill(null);
  let filled = 0;

  // Pass one: the main shape of every cell.
  const shapes = new Array(81).fill(null);
  let cropSize = 0;
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const cropped = cropCell(mask, warpSize, row, col);
      if (!cropped) continue;
      cropSize = cropped.cropSize;
      shapes[row * 9 + col] = mainShape(cropped.crop, cropped.cropSize);
    }
  }

  // How tall a digit is in this grid: the tall end of what was found, ignoring
  // the very tallest so one odd shape cannot move the mark.
  const heights = shapes.filter(Boolean).map((shape) => shape.box.height).sort((a, b) => a - b);
  const reference = heights.length > 0 ? heights[Math.floor((heights.length - 1) * 0.9)] : 0;
  const minHeight = Math.max(cropSize * MIN_DIGIT_HEIGHT_OF_CELL, reference * MIN_DIGIT_HEIGHT_OF_REFERENCE);

  // Pass two: read the shapes that are tall enough to be digits.
  for (let cell = 0; cell < 81; cell += 1) {
    const shape = shapes[cell];
    if (!shape || !looksLikeDigit(shape.box, cropSize, minHeight)) continue;
    const glyph = normalizeGlyph(shape.mask, cropSize, cropSize, shape.box, GLYPH_SIZE);
    const guess = classifyGlyph(glyph, templates);
    if (!guess) continue;
    digits[cell] = guess.digit;
    confidences[cell] = guess.confidence;
    alternates[cell] = guess.runnerUp ?? 0;
    glyphs[cell] = glyph;
    filled += 1;
  }

  let text = "";
  for (let cell = 0; cell < 81; cell += 1) text += digits[cell] === 0 ? "." : String(digits[cell]);
  return { digits, confidences, alternates, text, filled, glyphs, digitHeight: reference };
}
