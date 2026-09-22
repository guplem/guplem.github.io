// Where a tooltip goes, and how long the pointer rests before it appears.
//
// The board draws its own tooltips rather than using the browser's `title`
// (ADR 0033). A `title` is the operating system's: no font, no colour, no
// theme, no line breaks worth the name, and no way to reach any of it from
// CSS. One tooltip on this board is a breakdown with a line per part of the
// board, which is exactly what a native tooltip reads worst.
//
// Drawing them means placing them, and this file is that part: pure, so the
// arithmetic that keeps a tooltip on the screen is a test rather than something
// somebody checks by hovering.

/** How long a pointer rests on something before its tooltip appears. */
export const TOOLTIP_DELAY_MS = 350;

/** The room left between a tooltip and the thing it is about, and the screen edge. */
export const TOOLTIP_GAP = 8;

function size(value, key) {
  const found = value && typeof value === "object" ? value[key] : 0;
  return Number.isFinite(found) ? found : 0;
}

/**
 * Where to put a tooltip, in the coordinates a fixed element uses.
 *
 * Above the thing it is about and centred on it, because that is where the
 * pointer is not. Under it when there is no room above, which is every card at
 * the top of a column. Never off the screen in any direction: a tooltip half
 * over the edge is a tooltip nobody can read.
 *
 * @param anchor the `getBoundingClientRect()` of the thing the tooltip is about
 * @param tip the `getBoundingClientRect()` of the tooltip itself
 * @param viewport `{width, height}` of the window
 * @returns `{left, top, side}` where side is "top" or "bottom"
 */
export function tipPlacement(anchor, tip, viewport) {
  const left = size(anchor, "left");
  const top = size(anchor, "top");
  const width = size(anchor, "width");
  const height = size(anchor, "height");
  const tipWidth = size(tip, "width");
  const tipHeight = size(tip, "height");
  const screenWidth = size(viewport, "width");
  const screenHeight = size(viewport, "height");

  const fitsAbove = top - tipHeight - TOOLTIP_GAP >= TOOLTIP_GAP;
  const side = fitsAbove ? "top" : "bottom";
  const wanted = fitsAbove ? top - tipHeight - TOOLTIP_GAP : top + height + TOOLTIP_GAP;

  const room = (space, length) => Math.max(TOOLTIP_GAP, space - length - TOOLTIP_GAP);
  return {
    left: Math.max(TOOLTIP_GAP, Math.min(left + width / 2 - tipWidth / 2, room(screenWidth, tipWidth))),
    top: Math.max(TOOLTIP_GAP, Math.min(wanted, room(screenHeight, tipHeight))),
    side,
  };
}
