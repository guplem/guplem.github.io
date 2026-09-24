// Pure rules for when the top nav shows. structure.js wires them to the DOM.
// Scrolling down reveals the nav and scrolling up hides it, so a reader who
// wants the full screen only has to scroll up a little.

/**
 * @typedef {Object} NavScrollState
 * @property {boolean} revealed - Whether scrolling has revealed the nav.
 * @property {number} anchorY - The furthest scroll position in the current direction.
 */

/**
 * Returns the nav state after the page scrolls to `scrollY`. The direction
 * flips only after the reader moves `threshold` pixels from the anchor, so
 * small jitters (trackpad inertia, rubber-band bounce) change nothing.
 * @param {NavScrollState} state
 * @param {number} scrollY
 * @param {number} threshold
 * @returns {NavScrollState}
 */
export function nextNavScrollState(state, scrollY, threshold) {
  if (scrollY <= 0) return { revealed: false, anchorY: 0 };

  const movedDown = scrollY > state.anchorY;
  const keepsSameDirection = movedDown === state.revealed;
  if (keepsSameDirection) return { revealed: state.revealed, anchorY: scrollY };

  if (Math.abs(scrollY - state.anchorY) < threshold) return state;
  return { revealed: movedDown, anchorY: scrollY };
}

/**
 * Whether a mouse at `pointerY` (pixels from the window top) sits in the band
 * where the nav appears on hover.
 * @param {number} pointerY
 * @param {number} zoneHeight
 * @returns {boolean}
 */
export function isPointerInNavRevealZone(pointerY, zoneHeight) {
  return pointerY <= zoneHeight;
}
