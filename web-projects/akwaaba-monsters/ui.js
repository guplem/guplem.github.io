// The arithmetic behind the menus.
//
// Moving a cursor, scrolling a list, working out how wide a health bar should
// be. None of it draws anything, which is the point: `render.js` draws, `app.js`
// decides, and the fiddly off-by-one work lives here where it can be tested.

/**
 * Move a cursor up or down a list.
 *
 * @param {number} index where the cursor is
 * @param {number} delta -1 for up, 1 for down
 * @param {number} length how many entries there are
 * @param {boolean} [wrap] whether the bottom joins back to the top
 */
export function moveCursor(index, delta, length, wrap = true) {
  if (length <= 0) return 0;
  const next = index + delta;
  if (wrap) return ((next % length) + length) % length;
  return Math.max(0, Math.min(length - 1, next));
}

/**
 * Move a cursor around a grid, the way the four move buttons are laid out.
 *
 * A move sideways from the last item on an odd row stays put rather than
 * jumping to another row, which is what the real games do and what a thumb
 * expects.
 *
 * @param {number} index where the cursor is
 * @param {"up"|"down"|"left"|"right"} direction
 * @param {number} cols how many columns the grid has
 * @param {number} length how many entries there are
 */
export function moveGridCursor(index, direction, cols, length) {
  if (length <= 0) return 0;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const rows = Math.ceil(length / cols);
  let nextRow = row;
  let nextCol = col;
  if (direction === "up") nextRow = row - 1;
  else if (direction === "down") nextRow = row + 1;
  else if (direction === "left") nextCol = col - 1;
  else if (direction === "right") nextCol = col + 1;
  if (nextRow < 0 || nextRow >= rows) return index;
  if (nextCol < 0 || nextCol >= cols) return index;
  const next = nextRow * cols + nextCol;
  return next < length ? next : index;
}

/**
 * Where a list should be scrolled to so the cursor stays on screen.
 *
 * @param {number} index where the cursor is
 * @param {number} scroll the first entry currently drawn
 * @param {number} visible how many entries fit
 * @param {number} length how many entries there are
 */
export function clampScroll(index, scroll, visible, length) {
  if (length <= visible) return 0;
  let next = scroll;
  if (index < next) next = index;
  if (index >= next + visible) next = index - visible + 1;
  return Math.max(0, Math.min(length - visible, next));
}

/** How wide to draw a bar that is `value` out of `max`, inside `width` pixels. */
export function barWidth(value, max, width) {
  if (max <= 0) return 0;
  const share = Math.max(0, Math.min(1, value / max));
  if (share === 0) return 0;
  // Never round a creature that is still alive down to nothing.
  return Math.max(1, Math.round(share * width));
}

/** Green while healthy, amber below half, red below a fifth. */
export function healthColor(value, max) {
  if (max <= 0) return "#c0392b";
  const share = value / max;
  if (share > 0.5) return "#4fbf46";
  if (share > 0.2) return "#e3b23a";
  return "#c0392b";
}

/** True when the creature is hurt enough for the screen to flash a warning. */
export function isCritical(value, max) {
  return max > 0 && value > 0 && value / max <= 0.2;
}

/** How many of an item the player can pay for. */
export function affordable(money, price) {
  if (price <= 0) return 0;
  return Math.max(0, Math.floor(money / price));
}

/**
 * Move the quantity in a shop, keeping it between one and what is affordable.
 * Wraps at both ends, which is how the real shop counter behaves.
 */
export function stepQuantity(quantity, delta, max) {
  if (max <= 0) return 0;
  let next = quantity + delta;
  if (next > max) next = 1;
  if (next < 1) next = max;
  return next;
}

/**
 * Which page of a message the box is on, and whether there is another.
 * @returns {{page: string[], last: boolean}}
 */
export function messagePage(pages, index) {
  const safe = Math.max(0, Math.min(pages.length - 1, index));
  return { page: pages[safe] ?? [""], last: safe >= pages.length - 1 };
}

/**
 * How far along a tile a walking creature is, from 0 to 1.
 * @param {number} elapsed frames since the step started
 * @param {number} duration frames a step takes
 */
export function stepProgress(elapsed, duration) {
  if (duration <= 0) return 1;
  return Math.max(0, Math.min(1, elapsed / duration));
}

/**
 * Where the camera should sit so the player is in the middle, without ever
 * showing anything past the edge of the map.
 *
 * A map smaller than the screen is centred instead, so a small room does not
 * sit in the top left with a black gap beside it.
 */
export function cameraFor({ centreX, centreY, viewW, viewH, mapW, mapH }) {
  const x = mapW <= viewW ? (mapW - viewW) / 2 : clamp(centreX - viewW / 2, 0, mapW - viewW);
  const y = mapH <= viewH ? (mapH - viewH) / 2 : clamp(centreY - viewH / 2, 0, mapH - viewH);
  return { x, y };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * How wide each game pixel is drawn, in the page's own pixels.
 *
 * A whole number is what you want: every game pixel then covers the same square
 * of screen, and the picture stays even. A fraction draws some game pixels one
 * screen pixel wider than their neighbours.
 *
 * Whole numbers alone are not enough on a phone. A phone is about 390 wide, and
 * the screen is 240, so the biggest whole number that fits is 1. The game fills
 * 240 of the 390 and the player is asked to read a stamp. This is why the
 * fraction exists, and it is allowed under two conditions together:
 *
 *   1. the whole number wastes real room (it uses less than `WHOLE_ENOUGH` of
 *      what is free), and
 *   2. `pixelRatio` says the screen packs at least two of its own pixels into
 *      each page pixel, which is every phone and no ordinary monitor.
 *
 * On such a screen one game pixel covers four or five screen pixels, so a
 * neighbour one screen pixel wider is far too small a difference to see. On a
 * monitor the same difference is plain, so a monitor never gets the fraction.
 */
const WHOLE_ENOUGH = 0.9;

export function pixelScale(availableW, availableH, screenW, screenH, options = {}) {
  const { max = 6, pixelRatio = 1 } = options;
  const fit = Math.min(max, availableW / screenW, availableH / screenH);
  const whole = Math.max(1, Math.floor(fit));
  if (whole / fit >= WHOLE_ENOUGH) return whole;
  return pixelRatio >= 2 ? fit : whole;
}

/**
 * Which of the three page layouts to use. See `style.css`, which draws them.
 *
 *   `page`     the screen, then the pad under it, then the notes. The ordinary
 *              page, for a machine with a mouse.
 *   `theater`  the screen at the top at full width, the pad held at the bottom
 *              of the window where a thumb reaches it. For a phone held upright.
 *   `overlay`  the screen fills the window and the pad floats over it, faint.
 *              For fullscreen, and for a phone held sideways: sideways there is
 *              no room under the screen for a pad, so the pad has to float.
 */
export function layoutMode({ fullscreen = false, width = 0, height = 0, coarsePointer = false }) {
  if (fullscreen) return "overlay";
  if (!coarsePointer) return "page";
  return width > height ? "overlay" : "theater";
}

/**
 * The list of things the field menu offers.
 * The field guide and the map are not built yet, so they are not listed. See
 * ROADMAP.md.
 */
export function fieldMenuItems(state) {
  const items = [];
  if ((state.party ?? []).length > 0) {
    items.push({ id: "party", label: "Creatures" });
    // The box is where a creature caught with a full team waits. Without this
    // entry there is no way to bring one back, and it is stranded for good.
    items.push({ id: "box", label: "Box" });
  }
  items.push({ id: "bag", label: "Bag" });
  items.push({ id: "player", label: state.player?.name ?? "Player" });
  items.push({ id: "save", label: "Save" });
  items.push({ id: "options", label: "Options" });
  items.push({ id: "close", label: "Close" });
  return items;
}
