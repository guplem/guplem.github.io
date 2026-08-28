// Builds the reference pictures the digit reader compares cells against.
//
// This is the one file in the vision folder that needs a browser: it draws the
// digits 1 to 9 in several typefaces on a canvas, then hands each drawing to the
// same `normalizeGlyph` the reader uses. Several typefaces matter because a
// sudoku app may use any of them, and a 1 with a serif looks nothing like a
// plain one.

import { BUILTIN_BOX, BUILTIN_DIGIT_PATHS, BUILTIN_STROKE } from "./builtinDigits.js";
import { GLYPH_SIZE, inkBoundingBox, normalizeGlyph } from "./digits.js";

/** Typefaces to render. Each adds one picture per digit. */
const FONT_STACKS = [
  '400 64px Arial, Helvetica, sans-serif',
  '700 64px Arial, Helvetica, sans-serif',
  '400 64px Verdana, Geneva, sans-serif',
  '600 64px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  '400 64px Georgia, "Times New Roman", serif',
  '700 64px Georgia, "Times New Roman", serif',
  '400 64px "Courier New", Courier, monospace',
  '300 64px "Helvetica Neue", Helvetica, Arial, sans-serif',
];

/** Read the canvas back as an ink mask and normalise whatever was drawn on it. */
function captureGlyph(context, canvasSize, glyphSize) {
  const { data } = context.getImageData(0, 0, canvasSize, canvasSize);
  const mask = new Uint8Array(canvasSize * canvasSize);
  for (let i = 0; i < canvasSize * canvasSize; i += 1) mask[i] = data[i * 4] < 128 ? 1 : 0;
  const box = inkBoundingBox(mask, canvasSize, canvasSize);
  if (!box) return null;
  return normalizeGlyph(mask, canvasSize, canvasSize, box, glyphSize);
}

/** Draw one of the built-in shapes, scaled from its 100 x 100 box to the canvas. */
function strokeBuiltinPath(context, path, canvasSize) {
  const unit = canvasSize / BUILTIN_BOX;
  context.lineWidth = canvasSize * BUILTIN_STROKE;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  for (const command of path) {
    const [kind, ...values] = command;
    if (kind === "M") context.moveTo(values[0] * unit, values[1] * unit);
    else if (kind === "L") context.lineTo(values[0] * unit, values[1] * unit);
    else if (kind === "Q") context.quadraticCurveTo(values[0] * unit, values[1] * unit, values[2] * unit, values[3] * unit);
    else if (kind === "A") {
      const [cx, cy, radius, from, to] = values;
      context.arc(cx * unit, cy * unit, radius * unit, (from * Math.PI) / 180, (to * Math.PI) / 180);
    }
  }
  context.stroke();
}

/**
 * Build the reference pictures: every digit in every typeface the device has,
 * plus the built-in shapes that do not depend on any typeface.
 * @param {{glyphSize?: number, canvasSize?: number}} [options]
 * @returns {Array<{digit: number, vector: Float32Array, aspect: number, fill: number}>}
 */
export function buildDigitTemplates(options = {}) {
  const { glyphSize = GLYPH_SIZE, canvasSize = 96 } = options;
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const templates = [];

  const clear = () => {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvasSize, canvasSize);
    context.fillStyle = "#000000";
    context.strokeStyle = "#000000";
  };

  for (const font of FONT_STACKS) {
    for (let digit = 1; digit <= 9; digit += 1) {
      clear();
      context.font = font;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(digit), canvasSize / 2, canvasSize / 2);
      const glyph = captureGlyph(context, canvasSize, glyphSize);
      if (glyph) templates.push({ digit, source: "font", ...glyph });
    }
  }

  for (const [digit, paths] of Object.entries(BUILTIN_DIGIT_PATHS)) {
    for (const path of paths) {
      clear();
      strokeBuiltinPath(context, path, canvasSize);
      const glyph = captureGlyph(context, canvasSize, glyphSize);
      if (glyph) templates.push({ digit: Number(digit), source: "builtin", ...glyph });
    }
  }

  return templates;
}
