// The canvas work: drawing a sticker, and turning it into a WebP file.
//
// This is one of the two files that touch the browser instead of plain arrays,
// and it stays thin on purpose. Every decision it needs has already been made
// somewhere that is covered by tests: `geometry.js` says where the picture
// goes, `filters.js` says what to do to its colours, `mask.js` and `compose.js`
// shape the cut-out, `textLayout.js` says where each line of a caption sits.
// This file only calls `drawImage`, `fillText`, `getImageData` and `toBlob`.
//
// The pipeline for one frame, in order, and the order matters:
//
//   1. Draw the source picture onto the working canvas.
//   2. Colour adjustments, then the cut-out mask, then defringe. All at the
//      working size, which is the picture's own, so the mask survives a change
//      of crop.
//   3. Scale that onto the 512 by 512 sticker canvas.
//   4. The white outline, at sticker size, because "8 pixels" has to mean 8
//      pixels of the finished sticker and not 8 of the source.
//   5. The captions, on top. They are not part of the silhouette the outline
//      traces, and each text style carries its own outline instead.
//
// The preview is drawn at the real 512 by 512 and then shown at whatever size
// fits the screen, so what a person sees is the sticker itself rather than an
// approximation of it.

import { CANVAS_SIZE } from "./geometry.js";
import { addOutline, applyMask, defringe } from "./compose.js";
import { applyMatrix } from "./filters.js";
import { layoutText, styleById } from "./textLayout.js";

/**
 * The longest side a source picture is held at. A phone photo is 4000 pixels
 * across, and every pass over its pixels would then cost thirty times what it
 * needs to for a 512 pixel result.
 */
export const WORK_MAX = 1024;

/** The font stack captions are drawn in. Heavy, because sticker text is. */
export const TEXT_FONT =
  '800 {size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * A fresh canvas and its context.
 *
 * @param {number} width
 * @param {number} height
 * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }}
 */
export function createSurface(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // `willReadFrequently` tells the browser this canvas is read back rather
  // than only shown, which keeps it off a path that makes every read slow.
  return { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true }) };
}

/**
 * Read a picture file into a bitmap, scaled down to the working size.
 *
 * @param {File | Blob} file
 * @returns {Promise<{ canvas: HTMLCanvasElement, rgba: Uint8ClampedArray, width: number, height: number }>}
 * @throws When the file is not a picture this browser can open.
 */
export async function loadPicture(file) {
  const bitmap = await decodeToBitmap(file);
  const scale = Math.min(1, WORK_MAX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const { canvas, ctx } = createSurface(width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === "function") bitmap.close();

  return { canvas, rgba: ctx.getImageData(0, 0, width, height).data, width, height };
}

/**
 * Put a pixel array on a canvas of its own.
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */
export function surfaceFromPixels(rgba, width, height) {
  const { canvas, ctx } = createSurface(width, height);
  ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas;
}

/**
 * Everything that happens to a frame's own picture, before it is placed on the
 * sticker: colour, then the cut-out, then the edge tidy-up.
 *
 * @param {object} frame
 * @param {Uint8ClampedArray} frame.rgba The source pixels.
 * @param {number} frame.width
 * @param {number} frame.height
 * @param {Uint8Array} [frame.mask] The cut-out. Nothing is cut without it.
 * @param {Float32Array} [frame.matrix] Colour adjustments.
 * @param {number} [frame.defringeRadius]
 * @returns {Uint8ClampedArray} New pixels, the same size as the source.
 */
export function developFrame({ rgba, width, height, mask, matrix, defringeRadius = 2 }) {
  let pixels = matrix ? applyMatrix(rgba, matrix) : Uint8ClampedArray.from(rgba);
  if (mask) {
    pixels = applyMask(pixels, mask);
    // Only worth doing once something has been cut: with no mask there is no
    // boundary to carry the wall colour.
    pixels = defringe(pixels, width, height, { radius: defringeRadius });
  }
  return pixels;
}

/**
 * Draw one developed frame onto the sticker canvas, add the outline, and draw
 * the captions on top.
 *
 * @param {CanvasRenderingContext2D} ctx A 512 by 512 context.
 * @param {object} options
 * @param {HTMLCanvasElement} options.picture The developed frame.
 * @param {{ scale: number, dx: number, dy: number }} options.placement
 * @param {number} [options.outlineWidth] 0 for none.
 * @param {string} [options.outlineColour]
 * @param {object[]} [options.texts] Caption layers.
 * @param {number} [options.canvasSize]
 */
export function drawSticker(
  ctx,
  {
    picture,
    placement,
    outlineWidth = 0,
    outlineColour = "#ffffff",
    texts = [],
    canvasSize = CANVAS_SIZE,
  },
) {
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.translate(placement.dx, placement.dy);
  ctx.scale(placement.scale, placement.scale);
  ctx.drawImage(picture, 0, 0);
  ctx.restore();

  if (outlineWidth > 0) {
    // At sticker size, so 8 pixels means 8 pixels of the finished sticker.
    const before = ctx.getImageData(0, 0, canvasSize, canvasSize);
    const after = addOutline(before.data, canvasSize, canvasSize, {
      radius: outlineWidth,
      colour: parseColour(outlineColour),
    });
    ctx.putImageData(new ImageData(after, canvasSize, canvasSize), 0, 0);
  }

  for (const text of texts) drawTextLayer(ctx, text, canvasSize);
}

/**
 * Draw one caption layer.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer
 * @param {number} canvasSize
 */
export function drawTextLayer(ctx, layer, canvasSize) {
  const text = String(layer.text ?? "");
  if (!text.trim()) return;

  const style = styleById(layer.style);
  const fontSize = layer.fontSize;
  const font = TEXT_FONT.replace("{size}", String(fontSize));
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = "alphabetic";

  const layout = layoutText({
    text,
    fontSize,
    maxWidth: layer.maxWidth ?? canvasSize * 0.9,
    // The real measurer: the same context the text is drawn with, so the
    // layout matches what appears.
    measure: (piece) => ctx.measureText(piece).width,
    style: layer.style,
    align: layer.align ?? "centre",
    padding: layer.padding ?? fontSize * 0.28,
  });

  // The layer's position is the centre of its block, so a caption stays put
  // when its text grows or its style changes.
  ctx.translate(layer.x * canvasSize, layer.y * canvasSize);
  if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.translate(-layout.width / 2, -layout.height / 2);

  const backgroundColour = layer.backgroundColour ?? style.backgroundColour ?? "#ffffff";
  for (const box of layout.boxes) {
    ctx.fillStyle = backgroundColour;
    fillRoundedRect(ctx, box);
  }

  const colour = layer.colour ?? style.colour ?? "#ffffff";
  const outline = (style.outline ?? 0) * fontSize;
  for (const line of layout.lines) {
    if (!line.text) continue;
    if (style.shadow) {
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = style.shadow * fontSize * 2;
      ctx.shadowOffsetY = style.shadow * fontSize;
      ctx.fillStyle = colour;
      ctx.fillText(line.text, line.x, line.baseline);
      ctx.restore();
      continue;
    }
    if (outline > 0) {
      // Stroke under the fill, and with a round join, or every corner of
      // every letter grows a spike.
      ctx.lineJoin = "round";
      ctx.lineWidth = outline * 2;
      ctx.strokeStyle = layer.outlineColour ?? style.outlineColour ?? "#000000";
      ctx.strokeText(line.text, line.x, line.baseline);
    }
    ctx.fillStyle = colour;
    ctx.fillText(line.text, line.x, line.baseline);
  }
  ctx.restore();
}

/**
 * Measure a caption's block without drawing it, so the editor can tell
 * whether a tap landed on it.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer
 * @param {number} canvasSize
 * @returns {{ x: number, y: number, width: number, height: number }} In canvas
 *   pixels.
 */
export function textLayerBounds(ctx, layer, canvasSize) {
  const fontSize = layer.fontSize;
  ctx.save();
  ctx.font = TEXT_FONT.replace("{size}", String(fontSize));
  const layout = layoutText({
    text: String(layer.text ?? " "),
    fontSize,
    maxWidth: layer.maxWidth ?? canvasSize * 0.9,
    measure: (piece) => ctx.measureText(piece).width,
    style: layer.style,
    align: layer.align ?? "centre",
    padding: layer.padding ?? fontSize * 0.28,
  });
  ctx.restore();
  return {
    x: layer.x * canvasSize - layout.width / 2,
    y: layer.y * canvasSize - layout.height / 2,
    width: layout.width,
    height: layout.height,
  };
}

/**
 * Encode a canvas as WebP.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} quality 0 to 1.
 * @returns {Promise<Uint8Array>}
 * @throws When this browser cannot write WebP.
 */
export function encodeCanvas(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("This browser did not produce a WebP picture."));
          return;
        }
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      "image/webp",
      quality,
    );
  });
}

/**
 * Can this browser write WebP at all?
 *
 * Every WhatsApp sticker is WebP, so a browser that cannot write it cannot
 * make one. Asking a one pixel canvas is the only reliable test: a browser
 * that does not know the type quietly hands back a PNG instead of failing.
 *
 * @returns {Promise<boolean>}
 */
export async function supportsWebp() {
  try {
    const { canvas } = createSurface(1, 1);
    const bytes = await encodeCanvas(canvas, 0.5);
    // "RIFF" at the start and "WEBP" four bytes later. A PNG starts 0x89 P N G.
    return (
      String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
    );
  } catch {
    return false;
  }
}

/**
 * Shrink a finished sticker to the 96 by 96 PNG WhatsApp shows for a pack.
 *
 * @param {HTMLCanvasElement} sticker A 512 by 512 canvas.
 * @param {number} size
 * @returns {Promise<{ png: Uint8Array, width: number, height: number }>}
 */
export async function makeTrayIcon(sticker, size) {
  const { canvas, ctx } = createSurface(size, size);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sticker, 0, 0, size, size);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const buffer = await blob.arrayBuffer();
  return { png: new Uint8Array(buffer), width: size, height: size };
}

/**
 * Hand a file to the person.
 *
 * @param {Uint8Array} bytes
 * @param {string} filename
 * @param {string} type
 */
export function downloadFile(bytes, filename, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the URL goes.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Turn "#rrggbb" into the three numbers `compose.js` takes. */
export function parseColour(colour) {
  const hex = String(colour).replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => character + character)
          .join("")
      : hex;
  return [
    Number.parseInt(full.slice(0, 2), 16) || 0,
    Number.parseInt(full.slice(2, 4), 16) || 0,
    Number.parseInt(full.slice(4, 6), 16) || 0,
  ];
}

/** A rectangle with rounded corners, falling back where `roundRect` is missing. */
function fillRoundedRect(ctx, box) {
  const radius = Math.min(box.radius ?? 0, box.width / 2, box.height / 2);
  ctx.beginPath();
  if (radius > 0 && typeof ctx.roundRect === "function") {
    ctx.roundRect(box.x, box.y, box.width, box.height, radius);
  } else {
    ctx.rect(box.x, box.y, box.width, box.height);
  }
  ctx.fill();
}

/** Decode a picture file, preferring the path that does not block the page. */
async function decodeToBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Some browsers refuse certain files here but manage through an <img>,
      // so fall through rather than giving up on the picture.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("This picture could not be opened."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
