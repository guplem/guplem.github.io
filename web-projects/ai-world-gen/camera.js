// The camera over the map: where the grid sits on the canvas and how big a
// tile is drawn. Pure arithmetic, so a tap can be turned into a cell in a test.
//
// A camera is `{offsetX, offsetY, scale}`: the screen position of the grid's
// top-left corner, and how many screen pixels one sheet pixel takes. A tile is
// `TILE_SIZE * scale` pixels on screen.

export const CAMERA_LIMITS = { minScale: 0.5, maxScale: 12 };

function clampScale(scale) {
  return Math.min(CAMERA_LIMITS.maxScale, Math.max(CAMERA_LIMITS.minScale, scale));
}

/** A camera that shows the whole grid, centred, as large as the viewport allows. */
export function fitCamera(grid, tileSize, viewport) {
  const worldWidth = grid.width * tileSize;
  const worldHeight = grid.height * tileSize;
  const scale = clampScale(Math.min(viewport.width / worldWidth, viewport.height / worldHeight));
  return {
    scale,
    offsetX: (viewport.width - worldWidth * scale) / 2,
    offsetY: (viewport.height - worldHeight * scale) / 2,
  };
}

/**
 * The size of an image that holds the whole grid, and the camera that draws it.
 * The image has no border and no viewport, so the camera sits at the origin and
 * the scale is not clamped. `fitCamera` clamps and centres; this one must not.
 * @param {number} pixelsPerTile how many image pixels one tile takes
 */
export function wholeGridImage(grid, tileSize, pixelsPerTile) {
  return {
    width: grid.width * pixelsPerTile,
    height: grid.height * pixelsPerTile,
    camera: { offsetX: 0, offsetY: 0, scale: pixelsPerTile / tileSize },
  };
}

/** Where one cell is drawn, in screen pixels. */
export function cellRect(camera, tileSize, x, y) {
  const size = tileSize * camera.scale;
  return { x: camera.offsetX + x * size, y: camera.offsetY + y * size, size };
}

/** The cell under a screen point, or null when the point is off the grid. */
export function cellAtPoint(camera, tileSize, grid, px, py) {
  const size = tileSize * camera.scale;
  const x = Math.floor((px - camera.offsetX) / size);
  const y = Math.floor((py - camera.offsetY) / size);
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return null;
  return { x, y };
}

/** A camera zoomed by `factor` around a screen point, so that point stays put. */
export function zoomAt(camera, px, py, factor) {
  const scale = clampScale(camera.scale * factor);
  const ratio = scale / camera.scale;
  return {
    scale,
    offsetX: px - (px - camera.offsetX) * ratio,
    offsetY: py - (py - camera.offsetY) * ratio,
  };
}

export function panBy(camera, dx, dy) {
  return { ...camera, offsetX: camera.offsetX + dx, offsetY: camera.offsetY + dy };
}
