// The pixel art rasteriser.
//
// This game ships no image files. Every creature, tile, person and icon is a
// short list of shapes, and this module turns that list into a grid of pixels
// at load time. ADR 0001 says why.
//
// A drawing looks like this:
//
//   { w: 32, h: 32, outline: "#1a120b", shade: true, shapes: [
//     { k: "ellipse", cx: 16, cy: 20, rx: 9, ry: 7, c: "#c2762f" },
//     { k: "px", pts: [[12, 16]], c: "#ffffff", sym: true },
//   ]}
//
// `sym: true` draws the shape a second time mirrored across the vertical middle,
// which halves the work for anything that faces the viewer. Most creatures do.
//
// Two passes finish the job and give the whole game one look:
//   outline  wraps the silhouette in a dark line, the way West African cloth
//            prints and Adinkra symbols carry a heavy contour
//   shade    lightens the top rim of every shape and darkens the bottom rim,
//            so a flat colour reads as round
//
// Everything here is pure. It takes numbers and gives back an array of colour
// strings, which is why it can be tested with no browser at all.

import { Rng } from "../rng.js";

/** How much lighter the top rim gets, out of 255. */
export const DEFAULT_LIGHT = 26;

/** How much darker the bottom rim gets, out of 255. */
export const DEFAULT_DARK = 30;

/** Read "#rrggbb" into three numbers. Anything unreadable comes back black. */
export function parseColor(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  if (!match) return { r: 0, g: 0, b: 0 };
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Write three numbers back as "#rrggbb". */
export function toHex({ r, g, b }) {
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** The same colour, lighter for a positive amount and darker for a negative one. */
export function shiftColor(hex, amount) {
  const { r, g, b } = parseColor(hex);
  return toHex({ r: r + amount, g: g + amount, b: b + amount });
}

/** An empty picture: one entry per pixel, all transparent. */
export function blankPixels(w, h) {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => null));
}

/** Put one pixel down, ignoring anything outside the picture. */
function put(pixels, x, y, color) {
  const row = pixels[Math.round(y)];
  if (!row) return;
  const column = Math.round(x);
  if (column < 0 || column >= row.length) return;
  row[column] = color;
}

function drawRect(pixels, shape) {
  const { x, y, w, h, c } = shape;
  for (let row = 0; row < h; row++) {
    for (let column = 0; column < w; column++) put(pixels, x + column, y + row, c);
  }
}

function drawEllipse(pixels, shape) {
  const { cx, cy, rx, ry, c } = shape;
  if (rx <= 0 || ry <= 0) return;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1.02) put(pixels, x, y, c);
    }
  }
}

function drawLine(pixels, shape) {
  const [[x1, y1], [x2, y2]] = shape.pts;
  const thickness = shape.w ?? 1;
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let i = 0; i <= steps; i++) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    if (thickness <= 1) {
      put(pixels, x, y, shape.c);
    } else {
      const radius = (thickness - 1) / 2;
      drawEllipse(pixels, { cx: x, cy: y, rx: radius, ry: radius, c: shape.c });
    }
  }
}

function drawPoly(pixels, shape) {
  const points = shape.pts;
  if (!points || points.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const crossings = [];
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % points.length];
      if (ay === by) continue;
      // Sample at the whole number, not at the middle of the pixel. Mirroring
      // maps x to w-1-x, which is exact for whole numbers and half a pixel out
      // for anything else. A creature drawn with `sym` has to come out the same
      // read either way, and `pixelArt.test.js` checks that it does.
      if (y >= Math.min(ay, by) && y < Math.max(ay, by)) {
        crossings.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      for (let x = Math.ceil(crossings[i]); x <= Math.floor(crossings[i + 1]); x++) {
        put(pixels, x, y, shape.c);
      }
    }
  }
}

function drawNoise(pixels, shape) {
  // A seed makes the speckles on a grass tile the same every time the page
  // loads, which is what stops the ground flickering between reloads.
  const rng = new Rng(shape.seed ?? 1);
  for (let y = shape.y; y < shape.y + shape.h; y++) {
    for (let x = shape.x; x < shape.x + shape.w; x++) {
      if (rng.next() < (shape.density ?? 0.15)) put(pixels, x, y, shape.c);
    }
  }
}

/** Mirror one shape across the vertical middle of a picture `w` wide. */
export function mirrorShape(shape, w) {
  const flipX = (x) => w - 1 - x;
  const copy = { ...shape, sym: false };
  if (copy.cx !== undefined) copy.cx = flipX(copy.cx);
  if (copy.k === "rect") copy.x = flipX(copy.x + copy.w - 1);
  else if (copy.k === "noise") copy.x = flipX(copy.x + copy.w - 1);
  else if (copy.x !== undefined) copy.x = flipX(copy.x);
  if (copy.pts) copy.pts = copy.pts.map(([x, y]) => [flipX(x), y]);
  return copy;
}

function drawShape(pixels, shape, w) {
  switch (shape.k) {
    case "rect":
      drawRect(pixels, shape);
      break;
    case "ellipse":
      drawEllipse(pixels, shape);
      break;
    case "line":
      drawLine(pixels, shape);
      break;
    case "poly":
      drawPoly(pixels, shape);
      break;
    case "noise":
      drawNoise(pixels, shape);
      break;
    case "px":
      for (const [x, y] of shape.pts ?? []) put(pixels, x, y, shape.c);
      break;
    default:
      // An unknown shape is skipped. A missing ear beats a blank screen.
      break;
  }
  if (shape.sym) drawShape(pixels, mirrorShape(shape, w), w);
}

/** True when nothing has been painted at this position. */
function isEmpty(pixels, x, y) {
  const row = pixels[y];
  if (!row) return true;
  if (x < 0 || x >= row.length) return true;
  return row[x] === null;
}

/**
 * Wrap the painted shape in a dark line, growing it by one pixel all round.
 * Returns a new picture and leaves the old one alone.
 */
export function addOutline(pixels, color) {
  const height = pixels.length;
  const width = pixels[0]?.length ?? 0;
  const out = pixels.map((row) => row.slice());
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isEmpty(pixels, x, y)) continue;
      const touching =
        !isEmpty(pixels, x - 1, y) ||
        !isEmpty(pixels, x + 1, y) ||
        !isEmpty(pixels, x, y - 1) ||
        !isEmpty(pixels, x, y + 1);
      if (touching) out[y][x] = color;
    }
  }
  return out;
}

/**
 * Lighten the top rim of every painted area and darken the bottom rim.
 *
 * `edges` is the picture as it was before the outline went on, so the shading
 * reads the real silhouette and not the line around it.
 */
export function addShading(pixels, edges, { light = DEFAULT_LIGHT, dark = DEFAULT_DARK } = {}) {
  const out = pixels.map((row) => row.slice());
  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < (pixels[y]?.length ?? 0); x++) {
      const color = pixels[y][x];
      if (color === null) continue;
      if (isEmpty(edges, x, y)) continue; // an outline pixel: leave it dark
      if (isEmpty(edges, x, y - 1)) out[y][x] = shiftColor(color, light);
      else if (isEmpty(edges, x, y + 1)) out[y][x] = shiftColor(color, -dark);
    }
  }
  return out;
}

/**
 * Turn a drawing into a grid of colours.
 *
 * @param {object} drawing { w, h, shapes, outline, shade }
 * @returns {(string|null)[][]} one row per line, one colour or null per pixel
 */
export function rasterise(drawing) {
  const { w, h, shapes = [], outline = null, shade = true } = drawing;
  const pixels = blankPixels(w, h);
  for (const shape of shapes) drawShape(pixels, shape, w);

  const silhouette = pixels.map((row) => row.slice());
  let result = pixels;
  if (outline) result = addOutline(result, outline);
  if (shade) {
    const options = typeof shade === "object" ? shade : {};
    result = addShading(result, silhouette, options);
  }
  return result;
}

/** How many pixels a drawing actually paints. Used by the art tests. */
export function countPainted(pixels) {
  let total = 0;
  for (const row of pixels) for (const color of row) if (color !== null) total++;
  return total;
}

/**
 * The smallest box that holds everything painted.
 * @returns {{x:number,y:number,w:number,h:number}|null} null for an empty picture
 */
export function paintedBounds(pixels) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < pixels[y].length; x++) {
      if (pixels[y][x] === null) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Draw a picture onto a canvas that is `scale` times its size.
 *
 * This is the one function here that touches the browser, and it is kept apart
 * so everything above it stays testable.
 */
export function pixelsToCanvas(pixels, scale = 1, documentRef = globalThis.document) {
  const height = pixels.length;
  const width = pixels[0]?.length ?? 0;
  const canvas = documentRef.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = pixels[y][x];
      if (color === null) continue;
      context.fillStyle = color;
      context.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas;
}
