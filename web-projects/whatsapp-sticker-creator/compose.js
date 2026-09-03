// Turning a picture and a mask into a finished sticker.
//
// `mask.js` decides which pixels survive. This file carries that decision into
// the picture, and then fixes the two things that go wrong at the boundary
// between a cut-out and nothing:
//
//   The pale ring. A pixel on the edge of the subject holds a mixture of the
//     subject and the wall behind it, because a lens has no hard edges. Keep
//     the mixture and the sticker wears a faint outline of the wall it was
//     photographed against. `defringe` replaces the colour of those pixels
//     with the colour just inside them, and keeps their alpha, so the edge
//     stays soft but stops carrying the wall.
//
//   Nothing to read against. A sticker lands on a light chat, a dark chat and
//     a photo background. WhatsApp's own guidance: "we recommend you add a 8px
//     #FFFFFF stroke to the outside of each sticker". `addOutline` draws it.
//
// Every function takes a plain RGBA array with an explicit width and height,
// and returns a new one. None of them touch a canvas.

import { KEEP, dilate } from "./mask.js";

/** Alpha at or above this counts as solid. */
const SOLID = 255;

/**
 * A picture is a cut-out only if some pixel is meaningfully see-through. A
 * lossy encoder can leave alpha at 254 across a solid picture, and calling
 * that transparency would silence the warning that a sticker has none.
 */
const TRANSPARENT_ENOUGH = 250;

/** Alpha at or above this counts as visible when measuring a shape. */
const VISIBLE = 8;

/**
 * Carry a mask into a picture's alpha channel.
 *
 * @param {Uint8ClampedArray} rgba Left unchanged.
 * @param {Uint8Array} mask One byte per pixel.
 * @returns {Uint8ClampedArray} A new picture.
 */
export function applyMask(rgba, mask) {
  const out = Uint8ClampedArray.from(rgba);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    // Take the lower of the two. A picture that arrived with holes in it, a
    // PNG cut out somewhere else, must keep them: writing the mask straight
    // in would fill a transparent pixel back up.
    out[pixel * 4 + 3] = Math.min(rgba[pixel * 4 + 3], mask[pixel]);
  }
  return out;
}

/**
 * Read a picture's transparency back out as a mask.
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function readAlphaMask(rgba, width, height) {
  const mask = new Uint8Array(width * height);
  for (let pixel = 0; pixel < mask.length; pixel += 1) mask[pixel] = rgba[pixel * 4 + 3];
  return mask;
}

/**
 * Is any part of this picture see-through?
 *
 * WhatsApp: "A sticker is an image that has a transparent background". A
 * picture with none still installs, so this drives a warning and not a block.
 *
 * @param {Uint8ClampedArray} rgba
 * @returns {boolean}
 */
export function hasTransparency(rgba) {
  for (let at = 3; at < rgba.length; at += 4) {
    if (rgba[at] < TRANSPARENT_ENOUGH) return true;
  }
  return false;
}

/**
 * The smallest box holding everything visible in a picture.
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
export function alphaBounds(rgba, width, height) {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] < VISIBLE) continue;
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
 * Draw a solid ring around everything visible, behind the picture.
 *
 * The ring is built by growing the picture's own shape outwards by the radius
 * and filling the new area, then laying the picture back on top. Laying it on
 * top rather than replacing it is what lets a soft edge show the ring through
 * itself, the way two stacked layers do.
 *
 * @param {Uint8ClampedArray} rgba Left unchanged.
 * @param {number} width
 * @param {number} height
 * @param {object} options
 * @param {number} options.radius Ring width in pixels. 0 changes nothing.
 * @param {[number, number, number]} options.colour The ring's colour.
 * @returns {Uint8ClampedArray} A new picture.
 */
export function addOutline(rgba, width, height, { radius, colour }) {
  if (!(radius > 0)) return Uint8ClampedArray.from(rgba);
  const [sr, sg, sb] = colour;
  const grown = dilate(readAlphaMask(rgba, width, height), width, height, radius);
  const out = new Uint8ClampedArray(rgba.length);

  for (let pixel = 0; pixel < grown.length; pixel += 1) {
    const at = pixel * 4;
    const strokeAlpha = grown[pixel] / SOLID;
    const topAlpha = rgba[at + 3] / SOLID;
    // The picture over the stroke: the standard "source over" formula.
    const alpha = topAlpha + strokeAlpha * (1 - topAlpha);
    if (alpha <= 0) continue;
    out[at] = (rgba[at] * topAlpha + sr * strokeAlpha * (1 - topAlpha)) / alpha;
    out[at + 1] = (rgba[at + 1] * topAlpha + sg * strokeAlpha * (1 - topAlpha)) / alpha;
    out[at + 2] = (rgba[at + 2] * topAlpha + sb * strokeAlpha * (1 - topAlpha)) / alpha;
    out[at + 3] = alpha * SOLID;
  }
  return out;
}

/**
 * Take the wall colour out of the edge pixels.
 *
 * For each part-way transparent pixel, this looks outwards for the nearest
 * fully solid pixel and copies its colour, leaving the alpha alone. A pixel
 * with no solid pixel near it is left as it is: there is nothing to copy from,
 * and a guess would look worse than the ring it was meant to remove.
 *
 * @param {Uint8ClampedArray} rgba Left unchanged.
 * @param {number} width
 * @param {number} height
 * @param {object} [options]
 * @param {number} [options.radius] How far to look for a solid pixel.
 * @returns {Uint8ClampedArray} A new picture.
 */
export function defringe(rgba, width, height, { radius = 2 } = {}) {
  const out = Uint8ClampedArray.from(rgba);
  if (!(radius > 0)) return out;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      const alpha = rgba[at + 3];
      // Only the in-between pixels carry the ring. A solid pixel is the
      // subject and an empty one shows nothing at all.
      if (alpha >= SOLID || alpha < VISIBLE) continue;

      let bestDistance = Infinity;
      let source = -1;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const sy = y + dy;
        if (sy < 0 || sy >= height) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const sx = x + dx;
          if (sx < 0 || sx >= width) continue;
          const sample = (sy * width + sx) * 4;
          if (rgba[sample + 3] < SOLID) continue;
          const distance = dx * dx + dy * dy;
          if (distance < bestDistance) {
            bestDistance = distance;
            source = sample;
          }
        }
      }
      if (source < 0) continue;
      out[at] = rgba[source];
      out[at + 1] = rgba[source + 1];
      out[at + 2] = rgba[source + 2];
      // The alpha stays exactly as it was: it is what makes the edge soft.
      out[at + 3] = alpha;
    }
  }
  return out;
}

/** Re-exported so a caller can name a full mask value without a second import. */
export { KEEP };
