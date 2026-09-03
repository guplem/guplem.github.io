// The cut-out mask, and every operation that shapes it.
//
// A mask is one byte per pixel: 255 keeps the pixel, 0 throws it away, and the
// values between are part-way, which is what makes a soft edge possible. It has
// the same layout as the alpha channel it eventually becomes, so turning a
// finished mask into a transparent picture is a copy and nothing more.
//
// Automatic detection alone never gets a photo right, so the mask is a stack of
// steps rather than one answer: the detector proposes, the person paints over
// what it got wrong, and the clean-up operations here fix the two faults that
// every threshold-based detector shares.
//
//   Speckle: a few stray pixels of background survive inside the subject, or a
//     few pixels of subject survive out in the background.
//     `removeSmallIslands` and `fillHoles` clear both.
//   A cut edge: the boundary is one pixel wide and perfectly hard, which reads
//     as cut out with scissors. `feather` softens it.
//
// Nothing in this file knows about a canvas. Every function takes a plain array
// with an explicit width and height, and returns a new one, which is what lets
// all of it be tested with no browser.

/** A pixel that survives into the sticker. */
export const KEEP = 255;

/** A pixel that becomes transparent. */
export const DROP = 0;

/** Anything at or above this counts as visible when measuring a shape. */
const VISIBLE = 8;

/**
 * A new mask.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} [value] KEEP by default, so a fresh mask changes nothing.
 * @returns {Uint8Array}
 */
export function createMask(width, height, value = KEEP) {
  return new Uint8Array(width * height).fill(value);
}

/**
 * A mask that keeps one rectangle. The crop tool uses this.
 *
 * @param {number} width
 * @param {number} height
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @returns {Uint8Array}
 */
export function maskFromRect(width, height, rect) {
  const mask = createMask(width, height, DROP);
  const left = Math.max(0, Math.floor(rect.x));
  const top = Math.max(0, Math.floor(rect.y));
  const right = Math.min(width, Math.floor(rect.x + rect.width));
  const bottom = Math.min(height, Math.floor(rect.y + rect.height));
  for (let y = top; y < bottom; y += 1) {
    mask.fill(KEEP, y * width + left, y * width + right);
  }
  return mask;
}

/**
 * Paint a round brush stroke into the mask, in place.
 *
 * @param {Uint8Array} mask Changed in place, because a drag calls this for
 *   every pointer move and a copy per call would stutter.
 * @param {number} width
 * @param {number} height
 * @param {object} brush
 * @param {number} brush.x Centre, in pixels. May sit outside the image.
 * @param {number} brush.y
 * @param {number} brush.radius
 * @param {number} brush.value KEEP to restore, DROP to erase.
 * @param {number} [brush.hardness] 1 is a hard edge. Below 1, the outer part
 *   of the brush fades, which is what blends a repair into a soft edge.
 */
export function paintCircle(mask, width, height, { x, y, radius, value, hardness = 1 }) {
  if (!(radius > 0)) return;
  // Only walk the box the brush can reach, clipped to the image. A brush the
  // person dragged off the canvas has part of its box outside.
  const left = Math.max(0, Math.floor(x - radius));
  const right = Math.min(width - 1, Math.ceil(x + radius));
  const top = Math.max(0, Math.floor(y - radius));
  const bottom = Math.min(height - 1, Math.ceil(y + radius));
  const solid = radius * Math.min(Math.max(hardness, 0), 1);

  for (let py = top; py <= bottom; py += 1) {
    for (let px = left; px <= right; px += 1) {
      const distance = Math.hypot(px - x, py - y);
      if (distance > radius) continue;
      // Coverage is 1 inside the solid core and falls to 0 at the rim.
      const coverage =
        distance <= solid ? 1 : 1 - (distance - solid) / Math.max(radius - solid, 1e-6);
      const at = py * width + px;
      mask[at] = Math.round(mask[at] + (value - mask[at]) * coverage);
    }
  }
}

/**
 * Fold a selection into a mask.
 *
 * @param {Uint8Array} mask The mask so far. Left unchanged.
 * @param {Uint8Array} selection The pixels the new step is about.
 * @param {"add"|"subtract"|"replace"} mode
 * @returns {Uint8Array} A new mask.
 */
export function combineMask(mask, selection, mode) {
  const result = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    if (mode === "replace") result[i] = selection[i];
    else if (mode === "subtract") result[i] = Math.min(mask[i], KEEP - selection[i]);
    // "add" takes whichever keeps more, so a soft selection stays soft
    // instead of snapping to fully kept.
    else result[i] = Math.max(mask[i], selection[i]);
  }
  return result;
}

/**
 * Grow the kept area by a radius.
 *
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} radius In pixels.
 * @returns {Uint8Array} A new mask.
 */
export function dilate(mask, width, height, radius) {
  return morph(mask, width, height, radius, Math.max, DROP);
}

/**
 * Shrink the kept area by a radius. Outside the image counts as dropped, so a
 * shape that reaches the border shrinks away from it.
 *
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @returns {Uint8Array} A new mask.
 */
export function erode(mask, width, height, radius) {
  return morph(mask, width, height, radius, Math.min, DROP);
}

/**
 * Soften the boundary, so the cut-out does not look cut with scissors.
 *
 * This blurs the whole mask, which sounds wasteful and is exactly right: the
 * blur of an area that is entirely 255 is still 255, and the blur of an area
 * that is entirely 0 is still 0. Only the boundary has anything to average, so
 * only the boundary changes.
 *
 * Two box blur passes stand in for a Gaussian. One pass leaves a visible
 * straight ramp; two look smooth and cost far less than a real Gaussian.
 *
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} radius In pixels. 0 leaves the mask alone.
 * @returns {Uint8Array} A new mask.
 */
export function feather(mask, width, height, radius) {
  if (!(radius > 0)) return Uint8Array.from(mask);
  let current = Uint8Array.from(mask);
  for (let pass = 0; pass < 2; pass += 1) {
    current = boxBlur(current, width, height, Math.max(1, Math.round(radius / 2)));
  }
  return current;
}

/**
 * Drop every kept blob smaller than `minArea`. This clears the speckle a
 * detector leaves out in the background.
 *
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} minArea In pixels. A blob of exactly this size survives.
 * @returns {Uint8Array} A new mask.
 */
export function removeSmallIslands(mask, width, height, minArea) {
  const result = Uint8Array.from(mask);
  for (const island of findIslands(mask, width, height, (value) => value >= VISIBLE)) {
    if (island.pixels.length < minArea) {
      for (const at of island.pixels) result[at] = DROP;
    }
  }
  return result;
}

/**
 * Fill every dropped pocket smaller than `maxArea` that the background cannot
 * reach. This closes the holes a detector punches inside the subject, for
 * example where a shirt happens to match the wall behind it.
 *
 * A pocket that touches the border is the background itself, never a hole, so
 * it is left alone however small the image is.
 *
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} maxArea In pixels.
 * @returns {Uint8Array} A new mask.
 */
export function fillHoles(mask, width, height, maxArea) {
  const result = Uint8Array.from(mask);
  for (const pocket of findIslands(mask, width, height, (value) => value < VISIBLE)) {
    if (pocket.touchesBorder || pocket.pixels.length > maxArea) continue;
    for (const at of pocket.pixels) result[at] = KEEP;
  }
  return result;
}

/**
 * Keep only the largest kept blob. Useful when the subject is one object and
 * the detector left pieces of background behind elsewhere.
 *
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array} A new mask.
 */
export function keepLargestIsland(mask, width, height) {
  const islands = findIslands(mask, width, height, (value) => value >= VISIBLE);
  if (islands.length === 0) return Uint8Array.from(mask);
  const largest = islands.reduce((best, island) =>
    island.pixels.length > best.pixels.length ? island : best,
  );
  const result = createMask(width, height, DROP);
  for (const at of largest.pixels) result[at] = mask[at];
  return result;
}

/**
 * The smallest box holding everything visible.
 *
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number, width: number, height: number } | null} Null
 *   when nothing is visible.
 */
export function contentBounds(mask, width, height) {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // A feathered edge trails off to 1 or 2. Counting that as content makes
      // the box wider than anything a person can see.
      if (mask[y * width + x] < VISIBLE) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Does the drawing reach the border, leaving no room for the white stroke
 * WhatsApp recommends around a sticker?
 *
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {object} [options]
 * @param {number} [options.margin] How many pixels of clear space to ask for.
 *   Asking for none still means the drawing must not sit on the border
 *   itself, so a margin of 0 is read as 1.
 * @returns {boolean}
 */
export function touchesEdge(mask, width, height, { margin = 0 } = {}) {
  const bounds = contentBounds(mask, width, height);
  if (!bounds) return false;
  const wanted = Math.max(margin, 1);
  return (
    bounds.x < wanted ||
    bounds.y < wanted ||
    width - (bounds.x + bounds.width) < wanted ||
    height - (bounds.y + bounds.height) < wanted
  );
}

/**
 * Walk the mask and group touching pixels that pass a test.
 *
 * Pixels join through their four sides, not their corners. Two pixels meeting
 * at a corner are two islands. Corner joining would chain speckle together
 * into one blob large enough to survive `removeSmallIslands`, which is the
 * opposite of what that function is for.
 */
function findIslands(mask, width, height, matches) {
  const seen = new Uint8Array(mask.length);
  const islands = [];
  // An explicit stack, not recursion: a blob can cover a whole 512 by 512
  // image, and that many nested calls overflows the stack.
  const stack = new Int32Array(mask.length);

  for (let start = 0; start < mask.length; start += 1) {
    if (seen[start] || !matches(mask[start])) continue;
    const pixels = [];
    let touchesBorder = false;
    let top = 0;
    stack[top += 1] = start;
    seen[start] = 1;

    while (top > 0) {
      const at = stack[top];
      top -= 1;
      pixels.push(at);
      const x = at % width;
      const y = (at - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;

      if (x > 0) push(at - 1);
      if (x < width - 1) push(at + 1);
      if (y > 0) push(at - width);
      if (y < height - 1) push(at + width);
    }
    islands.push({ pixels, touchesBorder });

    function push(next) {
      if (seen[next] || !matches(mask[next])) return;
      seen[next] = 1;
      stack[top += 1] = next;
    }
  }
  return islands;
}

/** Shared body of dilate and erode: take the pick of a square neighbourhood. */
function morph(mask, width, height, radius, pick, outside) {
  const steps = Math.round(radius);
  if (steps <= 0) return Uint8Array.from(mask);
  // A square neighbourhood separates into a horizontal pass and a vertical
  // one, which turns the cost from radius squared per pixel into radius.
  let current = Uint8Array.from(mask);
  for (let step = 0; step < steps; step += 1) {
    current = morphPass(current, width, height, pick, outside, true);
    current = morphPass(current, width, height, pick, outside, false);
  }
  return current;
}

function morphPass(mask, width, height, pick, outside, horizontal) {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      const before = horizontal
        ? x > 0
          ? mask[at - 1]
          : outside
        : y > 0
          ? mask[at - width]
          : outside;
      const after = horizontal
        ? x < width - 1
          ? mask[at + 1]
          : outside
        : y < height - 1
          ? mask[at + width]
          : outside;
      result[at] = pick(mask[at], before, after);
    }
  }
  return result;
}

/** A separable box blur: average a square, one axis at a time. */
function boxBlur(mask, width, height, radius) {
  const pass = new Uint8Array(mask.length);
  const result = new Uint8Array(mask.length);
  const span = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        // Repeat the edge pixel rather than treating outside as zero, so the
        // blur does not darken the border of a full-bleed mask.
        const sample = Math.min(width - 1, Math.max(0, x + offset));
        total += mask[y * width + sample];
      }
      pass[y * width + x] = Math.round(total / span);
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sample = Math.min(height - 1, Math.max(0, y + offset));
        total += pass[sample * width + x];
      }
      result[y * width + x] = Math.round(total / span);
    }
  }
  return result;
}
