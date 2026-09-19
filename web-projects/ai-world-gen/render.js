// Drawing the map on a canvas. Visual code, exempt from tests (root ADR 0012);
// every number it needs comes from `camera.js` and `tileset.js`, which are not.
//
// The sheet's tiles are 12 pixels and drawn many times larger, so image
// smoothing is off: a blurred 1-bit tile is mud.

import { cellRect } from "./camera.js";
import { hashCoordinate } from "./random.js";
import { TILE_SIZE, TILESET_FILE, tileFor } from "./tileset.js";
import { typeById } from "./vocabulary.js";

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

  function draw({ grid, vocabulary, camera, selected = null, latest = null }) {
    const ratio = resize();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#0b0b0d";
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
        const { sx, sy } = tileFor(tagFor(vocabulary, cell), hashCoordinate(x, y));
        context.drawImage(sheet, sx, sy, TILE_SIZE, TILE_SIZE, rect.x, rect.y, rect.size, rect.size);
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

/** A small canvas showing one tag's tile, for legends and the inspector. */
export function tileThumbnail(sheet, tag, seed = 0, scale = 2) {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE * scale;
  canvas.height = TILE_SIZE * scale;
  canvas.className = "tile-thumb";
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  const { sx, sy } = tileFor(tag, seed);
  context.drawImage(sheet, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, canvas.width, canvas.height);
  return canvas;
}
