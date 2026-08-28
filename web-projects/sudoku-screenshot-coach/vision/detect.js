// Finds the sudoku grid inside a screenshot that holds other things too.
//
// The idea: the grid lines of a sudoku touch each other, so the whole grid is
// one connected shape of ink. The search therefore labels every connected shape,
// keeps the ones that could be a square frame, and then proves which one is the
// puzzle by pulling it flat and counting its lines. A header bar or a photo can
// be bigger than the puzzle, but only the puzzle has ten evenly spaced lines in
// both directions.
//
// Every step runs on plain typed arrays, so the detector is testable without a
// browser.

import { adaptiveThreshold, dilate, downscale, invertGray } from "./imaging.js";

/** Longest side the search works at. Bigger images are slow and no more accurate. */
export const WORK_MAX_DIM = 900;
/** Side of the flattened grid the rest of the pipeline reads. 9 cells of 48 px. */
export const WARP_SIZE = 432;
/** Share of a row that must be ink for it to count as a rule. */
const LINE_DENSITY = 0.55;
/**
 * Most of a sudoku is empty. A shape whose ink covers more than this share of
 * the flattened square is a block of colour, not a grid.
 */
const MAX_INK_SHARE = 0.5;

/**
 * Group the ink into connected shapes, counting diagonal contact as connected.
 * @returns {{labels: Int32Array, components: Array<{id, count, minX, minY, maxX, maxY}>}}
 *   `labels` holds 0 for background and the component id, starting at 1, elsewhere.
 */
export function labelComponents(mask, width, height) {
  const labels = new Int32Array(width * height);
  const components = [];
  const stack = new Int32Array(width * height);
  let nextLabel = 0;

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || labels[start] !== 0) continue;
    nextLabel += 1;
    let top = 0;
    stack[top] = start;
    top += 1;
    labels[start] = nextLabel;
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (top > 0) {
      top -= 1;
      const index = stack[top];
      const x = index % width;
      const y = (index - x) / width;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const neighbour = ny * width + nx;
          if (!mask[neighbour] || labels[neighbour] !== 0) continue;
          labels[neighbour] = nextLabel;
          stack[top] = neighbour;
          top += 1;
        }
      }
    }
    components.push({ id: nextLabel, count, minX, minY, maxX, maxY });
  }
  return { labels, components };
}

/**
 * The four corners of a shape, clockwise from the top left.
 * The top-left corner is the pixel with the smallest x + y, the bottom-right the
 * largest, and the other two come from x - y. That holds for a square however it
 * is rotated a little, which is what a photographed or scrolled grid looks like.
 */
export function cornersOfComponent(labels, width, height, component) {
  let minSum = Infinity;
  let maxSum = -Infinity;
  let minDiff = Infinity;
  let maxDiff = -Infinity;
  let topLeft = null;
  let bottomRight = null;
  let bottomLeft = null;
  let topRight = null;

  for (let y = component.minY; y <= component.maxY; y += 1) {
    for (let x = component.minX; x <= component.maxX; x += 1) {
      if (labels[y * width + x] !== component.id) continue;
      const sum = x + y;
      const diff = x - y;
      if (sum < minSum) {
        minSum = sum;
        topLeft = { x, y };
      }
      if (sum > maxSum) {
        maxSum = sum;
        bottomRight = { x, y };
      }
      if (diff < minDiff) {
        minDiff = diff;
        bottomLeft = { x, y };
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        topRight = { x, y };
      }
    }
  }
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null;
  return [topLeft, topRight, bottomRight, bottomLeft];
}

/**
 * Solve the 3x3 projective transform that sends each `from` point to the
 * matching `to` point. Pass the flat square as `from` and the quad found in the
 * image as `to`, so the result maps an output pixel back to the pixel to sample.
 * @returns {Float64Array|null} nine numbers, row major, or null when the points
 *   are degenerate (three of them on one line).
 */
export function solveHomography(from, to) {
  const a = [];
  const b = [];
  for (let index = 0; index < 4; index += 1) {
    const { x: u, y: v } = from[index];
    const { x, y } = to[index];
    a.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    a.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  // Gaussian elimination with partial pivoting on the 8x8 system.
  for (let col = 0; col < 8; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 8; row += 1) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-9) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let row = 0; row < 8; row += 1) {
      if (row === col) continue;
      const factor = a[row][col] / a[col][col];
      if (factor === 0) continue;
      for (let k = col; k < 8; k += 1) a[row][k] -= factor * a[col][k];
      b[row] -= factor * b[col];
    }
  }

  const h = new Float64Array(9);
  for (let index = 0; index < 8; index += 1) h[index] = b[index] / a[index][index];
  h[8] = 1;
  return h;
}

/** Send one point through a transform. */
export function applyHomography(matrix, u, v) {
  const w = matrix[6] * u + matrix[7] * v + matrix[8];
  return {
    x: (matrix[0] * u + matrix[1] * v + matrix[2]) / w,
    y: (matrix[3] * u + matrix[4] * v + matrix[5]) / w,
  };
}

/** Read a pixel with bilinear blending, so the warp does not look blocky. */
function sampleBilinear(gray, width, height, x, y) {
  const cx = Math.min(width - 1, Math.max(0, x));
  const cy = Math.min(height - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const top = gray[y0 * width + x0] * (1 - fx) + gray[y0 * width + x1] * fx;
  const bottom = gray[y1 * width + x0] * (1 - fx) + gray[y1 * width + x1] * fx;
  return top * (1 - fy) + bottom * fy;
}

/** Pull the quad the transform describes into a flat square image of `size` pixels. */
export function warpGray(gray, width, height, matrix, size) {
  const out = new Uint8ClampedArray(size * size);
  for (let v = 0; v < size; v += 1) {
    for (let u = 0; u < size; u += 1) {
      const point = applyHomography(matrix, u + 0.5, v + 0.5);
      out[v * size + u] = Math.round(sampleBilinear(gray, width, height, point.x, point.y));
    }
  }
  return out;
}

/**
 * How much the flattened square looks like a sudoku grid, from 0 to 1.
 *
 * A sudoku is ten rules across and ten down, evenly spaced. The score is the
 * share of those twenty rules that are really there.
 *
 * One check comes first. A sudoku is mostly empty space: its rules and digits
 * cover only a small part of it. A shape that is filled with ink has a dense row
 * at every position, so it would pass for a rule everywhere and score perfectly.
 * A block of highlight colour, or a dark page seen through the inverted pass, is
 * exactly that. Anything that solid scores zero whatever its rows look like.
 */
export function scoreGridLines(mask, size) {
  let ink = 0;
  for (let index = 0; index < mask.length; index += 1) ink += mask[index];
  if (ink / mask.length > MAX_INK_SHARE) return 0;

  const step = size / 9;
  const tolerance = Math.max(2, Math.round(step / 5));

  /** Is there a dense line within `tolerance` of this position? */
  const hasLine = (position, horizontal) => {
    const centre = Math.round(position);
    for (let offset = -tolerance; offset <= tolerance; offset += 1) {
      const index = centre + offset;
      if (index < 0 || index >= size) continue;
      let along = 0;
      for (let step2 = 0; step2 < size; step2 += 1) {
        along += horizontal ? mask[index * size + step2] : mask[step2 * size + index];
      }
      if (along / size >= LINE_DENSITY) return true;
    }
    return false;
  };

  let found = 0;
  for (let index = 0; index <= 9; index += 1) {
    // The outer rules sit on the very edge, so nudge them inwards by a pixel.
    const position = Math.min(size - 1, Math.max(0, index * step + (index === 0 ? 1 : index === 9 ? -1 : 0)));
    if (hasLine(position, true)) found += 1;
    if (hasLine(position, false)) found += 1;
  }
  return found / 20;
}

/** Reject a quad that is not close to a square. */
function looksSquare(quad) {
  const sides = [0, 1, 2, 3].map((index) => {
    const a = quad[index];
    const b = quad[(index + 1) % 4];
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
  const shortest = Math.min(...sides);
  const longest = Math.max(...sides);
  if (shortest < 24) return false;
  if (longest / shortest > 1.5) return false;
  // The two diagonals of a square are close to equal.
  const d1 = Math.hypot(quad[2].x - quad[0].x, quad[2].y - quad[0].y);
  const d2 = Math.hypot(quad[3].x - quad[1].x, quad[3].y - quad[1].y);
  return Math.max(d1, d2) / Math.min(d1, d2) <= 1.4;
}

const FLAT_SQUARE = (size) => [
  { x: 0, y: 0 },
  { x: size, y: 0 },
  { x: size, y: size },
  { x: 0, y: size },
];

/** Two candidates score alike when they sit this close. */
const SCORE_TIE = 0.02;

/**
 * Is this candidate a better grid than the one held so far?
 * A clearly higher score wins. When two scores are alike, the larger region
 * wins: a small patch of texture can imitate a grid once it is blown up to the
 * flattened square, and the real puzzle is the biggest thing that looks like one.
 */
function isBetter(candidate, best) {
  if (!best) return true;
  if (candidate.score > best.score + SCORE_TIE) return true;
  if (best.score > candidate.score + SCORE_TIE) return false;
  return candidate.area > best.area;
}

/**
 * Try one polarity and one amount of gap-closing, and return the best quad.
 *
 * Candidates are located on the small working image, because labelling every
 * connected shape is the expensive step. Each candidate is then scored on a warp
 * taken from the FULL-resolution image. That split matters: a hairline rule does
 * not survive the downscale, so a score measured on the small image misses real
 * grids. See adr/0005.
 *
 * @param {{gray, width, height, back}} work the downscaled image; `back` maps
 *   a working coordinate to a full-resolution one
 * @param {{gray, width, height}} full the image at its own resolution
 */
function searchOnce(work, full, dilateRadius, warpSize) {
  const { gray, width, height } = work;
  const mask = dilate(adaptiveThreshold(gray, width, height), width, height, dilateRadius);
  const { labels, components } = labelComponents(mask, width, height);
  const minSide = Math.max(30, Math.round(Math.min(width, height) * 0.08));

  const candidates = components
    .filter((component) => {
      const boxWidth = component.maxX - component.minX + 1;
      const boxHeight = component.maxY - component.minY + 1;
      if (boxWidth < minSide || boxHeight < minSide) return false;
      const ratio = boxWidth / boxHeight;
      return ratio > 0.65 && ratio < 1.55;
    })
    .sort((a, b) => (b.maxX - b.minX) * (b.maxY - b.minY) - (a.maxX - a.minX) * (a.maxY - a.minY))
    .slice(0, 12);

  let best = null;
  for (const component of candidates) {
    const found = cornersOfComponent(labels, width, height, component);
    if (!found || !looksSquare(found)) continue;
    // Move the corners to full-resolution coordinates before warping.
    const quad = found.map((corner) => ({ x: corner.x * work.back, y: corner.y * work.back }));
    const matrix = solveHomography(FLAT_SQUARE(warpSize), quad);
    if (!matrix) continue;
    const warped = warpGray(full.gray, full.width, full.height, matrix, warpSize);
    const score = scoreGridLines(adaptiveThreshold(warped, warpSize, warpSize), warpSize);
    const area = (component.maxX - component.minX + 1) * (component.maxY - component.minY + 1);
    const candidate = { quad, warped, score, area };
    if (isBetter(candidate, best)) best = candidate;
  }
  return best;
}

/**
 * Find the sudoku grid in a grayscale image.
 * @param {Uint8ClampedArray} gray brightness of every pixel
 * @param {number} width
 * @param {number} height
 * @param {{warpSize?: number, minScore?: number, maxDim?: number}} [options]
 * @returns {{quad: Array<{x,y}>, score: number, warped: Uint8ClampedArray,
 *   warpSize: number, inverted: boolean}|null}
 *   `quad` is in the coordinates of the image that was passed in. `warped` is the
 *   grid pulled flat, ready for the digit reader. Null means nothing scored well
 *   enough to call a grid.
 */
export function findGrid(gray, width, height, options = {}) {
  const { warpSize = WARP_SIZE, minScore = 0.75, maxDim = WORK_MAX_DIM } = options;
  const small = downscale(gray, width, height, maxDim);
  const back = 1 / small.scale;

  let best = null;
  for (const inverted of [false, true]) {
    // A light grid on a dark page becomes a dark grid on a light page.
    const work = {
      gray: inverted ? invertGray(small.data) : small.data,
      width: small.width,
      height: small.height,
      back,
    };
    const full = { gray: inverted ? invertGray(gray) : gray, width, height };
    for (const dilateRadius of [0, 1, 2]) {
      const found = searchOnce(work, full, dilateRadius, warpSize);
      if (found && isBetter(found, best)) best = { ...found, inverted };
      // A perfect score cannot be beaten, so stop early.
      if (best && best.score >= 1) break;
    }
    if (best && best.score >= 1) break;
  }

  if (!best || best.score < minScore) return null;
  // `quad` and `warped` already sit at full resolution, so nothing is redone here.
  return { quad: best.quad, score: best.score, warped: best.warped, warpSize, inverted: best.inverted };
}
