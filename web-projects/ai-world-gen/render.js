// Drawing the map on a canvas. Visual code, exempt from tests (root ADR 0012);
// every number it needs comes from `camera.js`, `tileset.js` and
// `tileStyles.js`, which are not.
//
// Four styles draw the same grid (ADR 0003). The sprite style copies a tile
// from the Urizen sheet; the emoji, roguelike and flat-block styles draw from
// the glyph table. A cell knows only its type, and the type only its visual
// tag, so a style switch is a redraw and nothing more.
//
// The sheet's tiles are 12 pixels and drawn many times larger, so image
// smoothing is off: a blurred 1-bit tile is mud.

import { cellRect } from "./camera.js";
import { hashCoordinate } from "./random.js";
import { TILE_SIZE, TILESET_FILE, tileFor } from "./tileset.js";
import { DEFAULT_STYLE_ID, glyphFor } from "./tileStyles.js";
import { typeById } from "./vocabulary.js";

const BACKGROUND = "#0b0b0d";
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

/** Load the sheet once. Resolves to the image, or rejects when the file is missing. */
export function loadTilesheet() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${TILESET_FILE}.`));
    image.src = TILESET_FILE;
  });
}

/** The visual tag for a cell's type, or the fallback when the type is unknown. */
function tagFor(vocabulary, cell) {
  return typeById(vocabulary, cell?.typeId)?.visualTag ?? "unknown";
}

/**
 * Draw one tag into a square, in one style.
 * @param {CanvasRenderingContext2D} context
 * @param {string} styleId one of `VISUAL_STYLES`
 * @param {HTMLImageElement} sheet the Urizen sheet
 * @param {string} tag a visual tag
 * @param {number} seed picks the sprite variant
 * @param {{x: number, y: number, size: number}} rect where to draw, in context pixels
 */
export function drawTag(context, styleId, sheet, tag, seed, rect) {
  const { x, y, size } = rect;
  if (styleId === "blocks") {
    context.fillStyle = glyphFor(tag).colour;
    context.fillRect(x, y, size, size);
    context.strokeStyle = "rgba(0, 0, 0, 0.35)";
    context.lineWidth = Math.max(1, size * 0.04);
    context.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    return;
  }
  if (styleId === "roguelike") {
    const row = glyphFor(tag);
    context.fillStyle = "#000000";
    context.fillRect(x, y, size, size);
    context.fillStyle = row.colour;
    context.font = `bold ${Math.floor(size * 0.8)}px ${MONO}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(row.glyph, x + size / 2, y + size * 0.54);
    return;
  }
  if (styleId === "emoji") {
    context.fillStyle = "#1a1a1e";
    context.fillRect(x, y, size, size);
    context.font = `${Math.floor(size * 0.72)}px ${EMOJI}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(glyphFor(tag).emoji, x + size / 2, y + size * 0.56);
    return;
  }
  const { sx, sy } = tileFor(tag, seed);
  context.imageSmoothingEnabled = false;
  context.drawImage(sheet, sx, sy, TILE_SIZE, TILE_SIZE, x, y, size, size);
}

/**
 * A renderer bound to one canvas.
 * `draw()` paints the whole grid; it is cheap enough to call on every decision.
 */
export function createRenderer(canvas, sheet) {
  const context = canvas.getContext("2d");

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return ratio;
  }

  function draw({ grid, vocabulary, camera, selected = null, latest = null, styleId = DEFAULT_STYLE_ID }) {
    const ratio = resize();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    if (!grid) return;

    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const rect = cellRect(camera, TILE_SIZE, x, y);
        if (rect.x + rect.size < 0 || rect.y + rect.size < 0 || rect.x > canvas.clientWidth || rect.y > canvas.clientHeight) continue;
        const cell = grid.cells[y * grid.width + x];
        if (cell === null) {
          context.fillStyle = (x + y) % 2 === 0 ? "#17171b" : "#131316";
          context.fillRect(rect.x, rect.y, rect.size, rect.size);
          continue;
        }
        drawTag(context, styleId, sheet, tagFor(vocabulary, cell), hashCoordinate(x, y), rect);
        if (cell.source === "fallback") {
          context.fillStyle = "rgba(255, 140, 0, 0.9)";
          context.fillRect(rect.x, rect.y, Math.max(2, rect.size * 0.2), Math.max(2, rect.size * 0.2));
        }
        if (cell.source === "hand") {
          context.fillStyle = "rgba(80, 200, 255, 0.9)";
          context.fillRect(rect.x + rect.size * 0.8, rect.y, Math.max(2, rect.size * 0.2), Math.max(2, rect.size * 0.2));
        }
      }
    }

    if (latest) {
      const rect = cellRect(camera, TILE_SIZE, latest.x, latest.y);
      context.strokeStyle = "rgba(255, 255, 255, 0.85)";
      context.lineWidth = 2;
      context.strokeRect(rect.x + 1, rect.y + 1, rect.size - 2, rect.size - 2);
    }
    if (selected) {
      const rect = cellRect(camera, TILE_SIZE, selected.x, selected.y);
      context.strokeStyle = "#f5c84b";
      context.lineWidth = 3;
      context.strokeRect(rect.x + 1.5, rect.y + 1.5, rect.size - 3, rect.size - 3);
    }
  }

  return { draw, resize };
}

/** A small canvas showing one tag in one style, for legends and the inspector. */
export function tileThumbnail(sheet, tag, seed = 0, scale = 2, styleId = DEFAULT_STYLE_ID) {
  const canvas = document.createElement("canvas");
  const size = TILE_SIZE * scale;
  canvas.width = size;
  canvas.height = size;
  canvas.className = "tile-thumb";
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  drawTag(context, styleId, sheet, tag, seed, { x: 0, y: 0, size });
  return canvas;
}
