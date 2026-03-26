// Get the area to get the correct canvas size
const area = document.getElementById("introduction");
// Get the canvas element
const simCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById("simCanvas"));

/** @type {Worker | null} */
let worker = null;
/** @type {boolean} */
let canvasTransferred = false;

/**
 * Returns the desired canvas dimensions based on the introduction area.
 * @returns {{ width: number, height: number }}
 */
function getCanvasSize() {
  if (!area) throw new Error('Area to draw the simulation (div with id "introduction") not found');
  if (!simCanvas) throw new Error('Canvas element (canvas with id "simCanvas") not found');
  return { width: area.offsetWidth, height: area.offsetHeight };
}

/**
 * Resolves the worker script URL relative to this module.
 * @returns {string}
 */
function getWorkerUrl() {
  return new URL("./simulation.worker.js", import.meta.url).href;
}

/**
 * Initializes the planet simulation.
 * Transfers the canvas to a Web Worker so all physics and drawing
 * happen off the main thread.
 */
export function init() {
  const { width, height } = getCanvasSize();

  if (!canvasTransferred) {
    // First init: create worker and transfer the OffscreenCanvas
    if (worker) worker.terminate();
    const offscreen = simCanvas.transferControlToOffscreen();
    worker = new Worker(getWorkerUrl());
    worker.postMessage({ type: "init", canvas: offscreen, width, height }, [offscreen]);
    canvasTransferred = true;
  } else if (worker) {
    // Subsequent inits (e.g. resize): just send new dimensions
    worker.postMessage({ type: "resize", width, height });
  }
}

/**
 * Updates the central point of attraction.
 * Given a value between -1 and 1 for both x and y.
 *
 * @param {number} index - The index of the central point to update.
 * @param {number} newX - The new position of the central point along the x-axis.
 * @param {number} newY - The new position of the central point along the y-axis.
 */
export function updateCentralPoint(index, newX, newY) {
  if (worker) {
    worker.postMessage({ type: "updateCentralPoint", index, x: newX, y: newY });
  }
}
