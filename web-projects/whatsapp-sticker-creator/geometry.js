// Where the picture sits on the 512 by 512 sticker canvas.
//
// A sticker is always exactly 512 by 512 (see `spec.js`), and a photo almost
// never is. Something has to decide the scale and the offset, and getting it
// wrong is the difference between a sticker that fills its square and one that
// floats in the middle as a postage stamp.
//
// Two ideas run through this file:
//
//   Fit to the content, not to the photo. After the background is removed,
//     most of the photo is empty. Fitting the photo would leave the subject
//     tiny; fitting the subject's own box makes it as large as it can be.
//   Leave a margin. WhatsApp recommends an 8 pixel white stroke around a
//     sticker so it reads on any chat background, and a subject already
//     touching the border has nowhere to put one. The margin is a little
//     wider than the stroke by default, so the stroke has room and the
//     sticker still does not look cramped.
//
// Every function here is arithmetic on plain numbers. The canvas work that
// uses these numbers lives in `app.js`.

/** WhatsApp's fixed sticker size. */
export const CANVAS_SIZE = 512;

/**
 * Clear space kept around the drawing, in canvas pixels. WhatsApp's own
 * recommendation is an 8 pixel stroke; 16 leaves the stroke somewhere to go
 * and still fills the square.
 */
export const DEFAULT_PADDING = 16;

/**
 * The largest centred square inside a rectangle. This is the starting crop for
 * any photo, because the sticker is square and the photo usually is not.
 *
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function centredSquare(width, height) {
  const side = Math.min(width, height);
  return {
    x: Math.round((width - side) / 2),
    y: Math.round((height - side) / 2),
    width: side,
    height: side,
  };
}

/**
 * Keep a crop rectangle inside the picture, and no smaller than a minimum.
 *
 * A crop is dragged by hand, so it arrives half off the edge and sometimes
 * inverted. This pulls it back rather than refusing it, because a drag that
 * stops responding at the edge feels broken.
 *
 * @param {{ x: number, y: number, width: number, height: number }} crop
 * @param {number} width Picture width.
 * @param {number} height
 * @param {object} [options]
 * @param {number} [options.minSize] Smallest side allowed, in pixels.
 * @param {boolean} [options.square] Force the crop to stay square.
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function clampCrop(crop, width, height, { minSize = 16, square = false } = {}) {
  const limit = Math.min(width, height);
  const smallest = Math.min(minSize, limit);

  let cropWidth = Math.round(Math.min(Math.max(Math.abs(crop.width), smallest), width));
  let cropHeight = Math.round(Math.min(Math.max(Math.abs(crop.height), smallest), height));
  if (square) {
    const side = Math.min(cropWidth, cropHeight, limit);
    cropWidth = side;
    cropHeight = side;
  }

  return {
    x: Math.round(Math.min(Math.max(crop.x, 0), width - cropWidth)),
    y: Math.round(Math.min(Math.max(crop.y, 0), height - cropHeight)),
    width: cropWidth,
    height: cropHeight,
  };
}

/**
 * Move a crop rectangle without letting it leave the picture.
 *
 * @param {{ x: number, y: number, width: number, height: number }} crop
 * @param {number} dx
 * @param {number} dy
 * @param {number} width Picture width.
 * @param {number} height
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function moveCrop(crop, dx, dy, width, height) {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, width, height, {
    minSize: Math.min(crop.width, crop.height),
  });
}

/**
 * How to draw a source picture so a chosen part of it lands centred on the
 * sticker canvas, as large as the margin allows.
 *
 * @param {{ x: number, y: number, width: number, height: number }} content The
 *   part that matters, in source pixels. Usually the box around what survived
 *   the background removal.
 * @param {object} [options]
 * @param {number} [options.canvas] Canvas side, 512 by default.
 * @param {number} [options.padding] Clear pixels to keep on every side.
 * @param {number} [options.maxScale] A ceiling on enlargement. A small
 *   subject blown up to fill the square looks soft, so a caller that cares
 *   can cap it.
 * @returns {{ scale: number, dx: number, dy: number, width: number, height: number }}
 *   Draw the source at `dx + sourceX * scale`, `dy + sourceY * scale`.
 */
export function placeOnCanvas(
  content,
  { canvas = CANVAS_SIZE, padding = DEFAULT_PADDING, maxScale = Infinity } = {},
) {
  const room = Math.max(1, canvas - padding * 2);
  const longest = Math.max(content.width, content.height, 1);
  const scale = Math.min(room / longest, maxScale);
  const drawnWidth = content.width * scale;
  const drawnHeight = content.height * scale;

  return {
    scale,
    // Centre the drawn content, then step back by where the content starts in
    // the source, so the caller can draw the whole source in one call.
    dx: (canvas - drawnWidth) / 2 - content.x * scale,
    dy: (canvas - drawnHeight) / 2 - content.y * scale,
    width: drawnWidth,
    height: drawnHeight,
  };
}

/**
 * How to draw a whole picture so it covers or fits inside a square.
 *
 * "cover" fills the square and loses whatever falls outside it, which is what
 * a photo wants. "contain" shows all of the picture and leaves empty space,
 * which is what a drawing that is already a cut-out wants.
 *
 * @param {number} width Source width.
 * @param {number} height
 * @param {object} [options]
 * @param {number} [options.canvas]
 * @param {"cover"|"contain"} [options.mode]
 * @param {number} [options.padding] Only used by "contain": "cover" has no
 *   empty space to spare.
 * @returns {{ scale: number, dx: number, dy: number, width: number, height: number }}
 */
export function fitToCanvas(
  width,
  height,
  { canvas = CANVAS_SIZE, mode = "cover", padding = 0 } = {},
) {
  const room = mode === "contain" ? Math.max(1, canvas - padding * 2) : canvas;
  const scale =
    mode === "contain"
      ? Math.min(room / width, room / height)
      : Math.max(room / width, room / height);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  return {
    scale,
    dx: (canvas - drawnWidth) / 2,
    dy: (canvas - drawnHeight) / 2,
    width: drawnWidth,
    height: drawnHeight,
  };
}

/**
 * Grow a box on every side, stopping at the edges of the picture.
 *
 * The box around a cut-out is tight against the drawing. Growing it a little
 * before scaling keeps a soft edge from being clipped.
 *
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {number} by Pixels to add on each side.
 * @param {number} width Picture width.
 * @param {number} height
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function growBox(box, by, width, height) {
  const left = Math.max(0, Math.round(box.x - by));
  const top = Math.max(0, Math.round(box.y - by));
  const right = Math.min(width, Math.round(box.x + box.width + by));
  const bottom = Math.min(height, Math.round(box.y + box.height + by));
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

/**
 * Turn a point on the shown canvas into a point in the source picture.
 *
 * The editor shows the sticker at whatever size the screen allows, and the
 * brush has to land where the person's finger did. Without this, every stroke
 * on a phone lands somewhere else.
 *
 * @param {number} x Position on the shown element, in its own pixels.
 * @param {number} y
 * @param {{ scale: number, dx: number, dy: number }} placement From
 *   `placeOnCanvas` or `fitToCanvas`.
 * @param {number} [displayScale] Shown size divided by canvas size.
 * @returns {{ x: number, y: number }} A point in source pixels.
 */
export function toSourcePoint(x, y, placement, displayScale = 1) {
  const canvasX = x / displayScale;
  const canvasY = y / displayScale;
  return {
    x: (canvasX - placement.dx) / placement.scale,
    y: (canvasY - placement.dy) / placement.scale,
  };
}
