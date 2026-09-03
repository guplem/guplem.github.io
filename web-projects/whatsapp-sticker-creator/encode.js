// Hitting the file size WhatsApp allows.
//
// A still sticker may be 100KB and an animated one 500KB. A 512 by 512 photo
// at full quality is usually well over the first, so a quality has to be
// chosen rather than assumed. Nothing predicts the size of a WebP file from
// its contents, so the only way to know is to encode and look.
//
// Encoding is the expensive part: each attempt is a real pass over 262144
// pixels, and the person waits for every one. So the search matters. Walking
// the quality ladder from the top costs one encode per rung; a binary search
// over the same ladder costs four at most, whatever its length.
//
// The encoder is passed in rather than called here. `canvas.toBlob` needs a
// browser, and this way the whole search is covered by tests with a stand-in
// encoder. `app.js` supplies the real one.

/**
 * The qualities to try, best first.
 *
 * Coarse at the bottom and fine at the top: the difference between 0.95 and
 * 0.9 is visible on a sticker, while the difference between 0.2 and 0.15 is
 * not, so the rungs are placed where they can be seen.
 */
export const QUALITY_LADDER = [0.95, 0.9, 0.85, 0.8, 0.72, 0.64, 0.55, 0.45, 0.35, 0.25, 0.15];

/** Bytes each frame costs in an animation, on top of its pixels. */
const FRAME_HEADER_BYTES = 24;

/** The container's own header: RIFF, VP8X and ANIM. */
const CONTAINER_BYTES = 40;

/**
 * Encode at the best quality that fits a byte budget.
 *
 * @param {(quality: number) => Promise<Uint8Array>} encodeAt Encodes the
 *   picture at one quality and hands back the bytes.
 * @param {object} options
 * @param {number} options.maxBytes The budget.
 * @param {number[]} [options.ladder] Qualities to try, best first.
 * @returns {Promise<{ bytes: Uint8Array, quality: number, attempts: number }>}
 * @throws {Error & { smallestBytes: number }} When no quality fits. The error
 *   carries the smallest size reached, so the page can say how far off it is.
 */
export async function encodeWithinBudget(encodeAt, { maxBytes, ladder = QUALITY_LADDER }) {
  const tried = new Map();
  const sizeAt = async (index) => {
    if (!tried.has(index)) tried.set(index, await encodeAt(ladder[index]));
    return tried.get(index);
  };

  // Find the first rung that fits. Sizes fall as quality falls, so the rungs
  // that fit form the tail of the ladder and a binary search finds its start.
  let low = 0;
  let high = ladder.length - 1;
  let best = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const bytes = await sizeAt(middle);
    if (bytes.length <= maxBytes) {
      // This one fits, so remember it and look for something better.
      best = middle;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }

  if (best < 0) {
    // A real encoder is not perfectly predictable, so before giving up check
    // the bottom rung directly. The search may have stepped over it.
    const last = ladder.length - 1;
    const bytes = await sizeAt(last);
    if (bytes.length <= maxBytes) best = last;
  }

  if (best < 0) {
    const smallestBytes = Math.min(...[...tried.values()].map((bytes) => bytes.length));
    const failure = new Error(
      `This picture does not fit in ${maxBytes} bytes at any quality. The smallest was ${smallestBytes}.`,
    );
    failure.smallestBytes = smallestBytes;
    throw failure;
  }

  return { bytes: tried.get(best), quality: ladder[best], attempts: tried.size };
}

/**
 * How many bytes each frame of an animation may take.
 *
 * The frames share the total, less what the container and the frame headers
 * cost. Handing every frame the plain share would overshoot the total by
 * exactly that overhead, which is enough to fail a sticker that looked fine.
 *
 * @param {number} maxBytes The whole animation's budget.
 * @param {number} frameCount
 * @returns {number} Bytes for one frame, always at least 1.
 */
export function estimateFrameBudget(maxBytes, frameCount) {
  const count = Math.max(1, frameCount);
  const overhead = CONTAINER_BYTES + FRAME_HEADER_BYTES * count;
  return Math.max(1, Math.floor((maxBytes - overhead) / count));
}
