// Finding the background in a photo, with no model and no network call.
//
// Every other tool that does this well runs a trained segmentation model. That
// is not available here: the repository has no build step and no package
// manager (root ADR 0002), so a model would arrive from a content delivery
// network at page load, weigh several megabytes, and send the person's photo
// through code nobody in this repository can read. The same reasoning made
// sudoku-screenshot-coach carry its own digit shapes instead of an OCR library
// (that project's ADR 0002).
//
// So this file solves a smaller problem honestly instead of a larger one
// vaguely. It does not look for a person, a pet or an object. It looks for the
// background, which is the region that touches the edge of the frame and holds
// together by colour. For the photos people actually turn into stickers, a
// subject against a wall, a floor or the sky, that is the same answer. When it
// is not, the person paints the difference with the brush, and the tolerance
// slider moves the line. Automatic detection is a first guess, not a verdict.
//
// The fill spreads from the border and takes a pixel only when two separate
// tests agree, and each one covers the other's blind spot:
//
//   Neighbour test (`tolerance`)
//     Is this pixel close in colour to the one the fill arrived from? This is
//     what carries the fill across a background that shades from light to dark,
//     where the far side no longer resembles the corner it started from.
//     On its own it walks up any slope, including one leading into the subject.
//
//   Border test (`edgeTolerance`)
//     Is this pixel close in colour to something the border actually held?
//     This is what stops the fill halfway up that slope. On its own it fails
//     on any background that is not one flat colour.
//
// Both tests measure colour in CIELAB (see `colour.js`), so one tolerance
// setting means the same thing in a dark photo and a bright one.

import { labDelta, labDeltaToColour, toLab } from "./colour.js";
import { DROP, KEEP, createMask, feather, fillHoles, removeSmallIslands } from "./mask.js";

/** How close two colours must be to count as the same background, in CIELAB. */
const DEFAULT_TOLERANCE = 12;

/** How far the fill may drift from any colour the border held. */
const DEFAULT_EDGE_TOLERANCE = 30;

/** Enough reference colours for a busy border, few enough to stay quick. */
const MAX_BORDER_COLOURS = 16;

/** Alpha at or below this in the source picture is already background. */
const ALREADY_TRANSPARENT = 8;

/**
 * The handful of colours the border of the picture holds.
 *
 * Camera noise means no two background pixels match exactly, so the border is
 * grouped rather than listed: a colour joins the nearest group it is close
 * enough to, and starts a new one otherwise. The result is a short list, which
 * matters because every pixel of the fill is measured against all of it.
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @param {object} [options]
 * @param {number} [options.spread] How far apart two groups must sit.
 * @returns {Float32Array} Three numbers per colour: L, a, b.
 */
export function sampleBorderColours(rgba, width, height, { spread = 12 } = {}) {
  const lab = toLab(rgba, width, height);
  const centres = [];
  const counts = [];

  for (const index of borderIndices(width, height)) {
    // A pixel that is already transparent says nothing about colour.
    if (rgba[index * 4 + 3] <= ALREADY_TRANSPARENT) continue;
    const L = lab[index * 3];
    const a = lab[index * 3 + 1];
    const b = lab[index * 3 + 2];

    let best = -1;
    let bestDistance = Infinity;
    for (let group = 0; group < centres.length; group += 1) {
      const distance = Math.hypot(
        centres[group][0] - L,
        centres[group][1] - a,
        centres[group][2] - b,
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = group;
      }
    }

    if (best >= 0 && bestDistance <= spread) {
      // Move the group's centre towards the new colour, so the group ends up
      // at the average of what joined it rather than at whatever came first.
      const count = counts[best] + 1;
      counts[best] = count;
      centres[best][0] += (L - centres[best][0]) / count;
      centres[best][1] += (a - centres[best][1]) / count;
      centres[best][2] += (b - centres[best][2]) / count;
    } else if (centres.length < MAX_BORDER_COLOURS) {
      centres.push([L, a, b]);
      counts.push(1);
    }
  }

  const flat = new Float32Array(centres.length * 3);
  centres.forEach((centre, group) => flat.set(centre, group * 3));
  return flat;
}

/**
 * Guess which pixels are the background, and return a mask that drops them.
 *
 * @param {Uint8ClampedArray} rgba Four bytes per pixel.
 * @param {number} width
 * @param {number} height
 * @param {object} [options]
 * @param {number} [options.tolerance] The neighbour test, in CIELAB. Higher
 *   takes more.
 * @param {number} [options.edgeTolerance] The border test, in CIELAB.
 * @param {number} [options.feather] Pixels of softening on the boundary.
 * @param {number} [options.minIsland] Drop a surviving speck smaller than this.
 * @param {number} [options.maxHole] Fill a pocket in the subject up to this size.
 * @returns {Uint8Array} KEEP for the subject, DROP for the background.
 */
export function autoBackgroundMask(
  rgba,
  width,
  height,
  {
    tolerance = DEFAULT_TOLERANCE,
    edgeTolerance = DEFAULT_EDGE_TOLERANCE,
    feather: featherRadius = 1,
    minIsland,
    maxHole,
  } = {},
) {
  const count = width * height;
  const lab = toLab(rgba, width, height);
  const borderColours = sampleBorderColours(rgba, width, height);

  const isBackground = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;

  const enqueue = (index) => {
    if (isBackground[index]) return;
    isBackground[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  // Start from every border pixel. The background is what touches the frame.
  for (const index of borderIndices(width, height)) {
    if (rgba[index * 4 + 3] <= ALREADY_TRANSPARENT) enqueue(index);
    else if (nearBorderColour(lab, index, borderColours, edgeTolerance)) enqueue(index);
  }

  while (head < tail) {
    const from = queue[head];
    head += 1;
    const x = from % width;
    const y = (from - x) / width;

    if (x > 0) consider(from, from - 1);
    if (x < width - 1) consider(from, from + 1);
    if (y > 0) consider(from, from - width);
    if (y < height - 1) consider(from, from + width);
  }

  function consider(from, to) {
    if (isBackground[to]) return;
    // A pixel that arrived transparent is background whatever its colour.
    if (rgba[to * 4 + 3] <= ALREADY_TRANSPARENT) {
      enqueue(to);
      return;
    }
    if (labDelta(lab, from, to) > tolerance) return;
    if (!nearBorderColour(lab, to, borderColours, edgeTolerance)) return;
    enqueue(to);
  }

  // A picture of one flat colour swallows itself: every pixel passes both
  // tests, and the answer is an empty sticker. Nobody wants that, so hand the
  // picture back whole and let the person cut it by hand.
  let dropped = 0;
  for (let i = 0; i < count; i += 1) dropped += isBackground[i];
  if (dropped === count) return createMask(width, height, KEEP);

  let mask = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) mask[i] = isBackground[i] ? DROP : KEEP;

  // Both clean-up limits scale with the picture, so they mean the same thing
  // on a thumbnail and on a full sized photo.
  const area = count;
  mask = removeSmallIslands(mask, width, height, minIsland ?? Math.max(4, Math.round(area / 4000)));
  mask = fillHoles(mask, width, height, maxHole ?? Math.max(16, Math.round(area / 400)));
  if (featherRadius > 0) mask = feather(mask, width, height, featherRadius);
  return mask;
}

/**
 * Select the pixels that match the one at a point: the magic wand.
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @param {object} options
 * @param {number} options.x Where the person clicked.
 * @param {number} options.y
 * @param {number} options.tolerance In CIELAB. 0 takes only the exact colour.
 * @param {boolean} [options.contiguous] True, the default, takes only the
 *   touching run. False takes every matching pixel in the picture.
 * @returns {Uint8Array} KEEP where selected.
 */
export function magicWandMask(rgba, width, height, { x, y, tolerance, contiguous = true }) {
  const selection = createMask(width, height, DROP);
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return selection;

  const lab = toLab(rgba, width, height);
  const start = py * width + px;
  const L = lab[start * 3];
  const a = lab[start * 3 + 1];
  const b = lab[start * 3 + 2];
  const matches = (index) => labDeltaToColour(lab, index, L, a, b) <= tolerance;

  if (!contiguous) {
    for (let index = 0; index < width * height; index += 1) {
      if (matches(index)) selection[index] = KEEP;
    }
    return selection;
  }

  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  selection[start] = KEEP;
  queue[tail += 1] = start;

  while (head < tail) {
    head += 1;
    const from = queue[head];
    const fx = from % width;
    const fy = (from - fx) / width;
    const step = (to) => {
      if (selection[to] === KEEP || !matches(to)) return;
      selection[to] = KEEP;
      queue[tail += 1] = to;
    };
    if (fx > 0) step(from - 1);
    if (fx < width - 1) step(from + 1);
    if (fy > 0) step(from - width);
    if (fy < height - 1) step(from + width);
  }
  return selection;
}

/**
 * Read part-way alpha out of the boundary, instead of leaving it hard.
 *
 * A real photograph has no hard edges. The lens blurs the boundary over a
 * pixel or two, so those pixels hold a mixture of the subject and the
 * background. A hard mask has to call each one either subject or background,
 * and either choice is visibly wrong: keep them and the sticker wears a ring
 * of wall colour, drop them and it loses its outline.
 *
 * This measures the mixture instead. For each pixel near the boundary it takes
 * the average confident subject colour and the average confident background
 * colour nearby, then asks where between the two this pixel sits. That
 * position is the alpha.
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} mask The mask so far.
 * @param {object} [options]
 * @param {number} [options.radius] How wide a band to look at, in pixels.
 * @returns {Uint8Array} A new mask.
 */
export function refineEdgeAlpha(rgba, mask, width, height, { radius = 2 } = {}) {
  if (!(radius > 0)) return Uint8Array.from(mask);
  const result = Uint8Array.from(mask);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      if (!nearBoundary(mask, width, height, x, y, radius)) continue;

      // Gather the two sides from the window around this pixel.
      let keepR = 0;
      let keepG = 0;
      let keepB = 0;
      let keepCount = 0;
      let dropR = 0;
      let dropG = 0;
      let dropB = 0;
      let dropCount = 0;

      for (let dy = -radius; dy <= radius; dy += 1) {
        const sy = y + dy;
        if (sy < 0 || sy >= height) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const sx = x + dx;
          if (sx < 0 || sx >= width) continue;
          const sample = sy * width + sx;
          const rgbaAt = sample * 4;
          // Only fully confident pixels are used as a reference. A half-way
          // pixel is the thing being measured, not a yardstick for it.
          if (mask[sample] === KEEP) {
            keepR += rgba[rgbaAt];
            keepG += rgba[rgbaAt + 1];
            keepB += rgba[rgbaAt + 2];
            keepCount += 1;
          } else if (mask[sample] === DROP) {
            dropR += rgba[rgbaAt];
            dropG += rgba[rgbaAt + 1];
            dropB += rgba[rgbaAt + 2];
            dropCount += 1;
          }
        }
      }
      if (keepCount === 0 || dropCount === 0) continue;

      const fr = keepR / keepCount;
      const fg = keepG / keepCount;
      const fb = keepB / keepCount;
      const br = dropR / dropCount;
      const bg = dropG / dropCount;
      const bb = dropB / dropCount;

      // How far apart the two sides are. When they are the same colour there
      // is nothing to measure against, so leave the pixel as it was.
      const dr = fr - br;
      const dg = fg - bg;
      const db = fb - bb;
      const spread = dr * dr + dg * dg + db * db;
      if (spread < 1) continue;

      // Project this pixel onto the line from background to subject. 0 lands
      // on the background, 1 on the subject, and between is the mixture.
      const rgbaAt = at * 4;
      const along =
        ((rgba[rgbaAt] - br) * dr + (rgba[rgbaAt + 1] - bg) * dg + (rgba[rgbaAt + 2] - bb) * db) /
        spread;
      result[at] = Math.round(Math.min(1, Math.max(0, along)) * KEEP);
    }
  }
  return result;
}

/** Is this pixel within `radius` of a pixel on the other side of the mask? */
function nearBoundary(mask, width, height, x, y, radius) {
  const here = mask[y * width + x] >= 128;
  for (let dy = -radius; dy <= radius; dy += 1) {
    const sy = y + dy;
    if (sy < 0 || sy >= height) continue;
    for (let dx = -radius; dx <= radius; dx += 1) {
      const sx = x + dx;
      if (sx < 0 || sx >= width) continue;
      if (mask[sy * width + sx] >= 128 !== here) return true;
    }
  }
  return false;
}

/** Is this pixel close to any colour the border held? */
function nearBorderColour(lab, index, borderColours, edgeTolerance) {
  // No usable border colour, for example a picture whose edge is already
  // transparent. Nothing to measure against, so do not block the fill.
  if (borderColours.length === 0) return true;
  for (let group = 0; group < borderColours.length; group += 3) {
    const distance = labDeltaToColour(
      lab,
      index,
      borderColours[group],
      borderColours[group + 1],
      borderColours[group + 2],
    );
    if (distance <= edgeTolerance) return true;
  }
  return false;
}

/** Every pixel index on the one pixel frame around the picture. */
function borderIndices(width, height) {
  const indices = [];
  for (let x = 0; x < width; x += 1) {
    indices.push(x);
    if (height > 1) indices.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    indices.push(y * width);
    if (width > 1) indices.push(y * width + width - 1);
  }
  return indices;
}
