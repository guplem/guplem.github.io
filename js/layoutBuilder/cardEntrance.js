// Pure rules for the work cards' entrance. workCards.js wires them to the DOM.
// The grid re-renders on every filter click, every pause in typing and every
// width change, so the entrance plays only once: motion on a surface used
// that often reads as delay. The stagger stays inside the 300ms budget for a
// group entrance, so no card waits at opacity 0 for seconds (issue #419).
// web-projects/discovery.js repeats the stagger for the Playground; a test in
// scripts/interfaceRules.test.js keeps the two equal.

const STAGGER_MS = 30;
const MAX_DELAY_MS = 300;

/**
 * Returns how long the card at `index` waits before its entrance starts.
 * @param {number} index - the card's position in the rendered order
 * @returns {number}
 */
export function cardEntranceDelayMs(index) {
  return Math.min(index * STAGGER_MS, MAX_DELAY_MS);
}

/**
 * Returns whether a render of the grid plays the entrance. Only the first one
 * does; later renders answer a filter, a search or a resize.
 * @param {number} previousRenders - how many renders started before this one
 * @returns {boolean}
 */
export function playsCardEntrance(previousRenders) {
  return previousRenders === 0;
}
