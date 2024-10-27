import { displayFilteredWorks } from "./dataFiller.js";
import { setProperCanvasSize } from "../planetSimulation/simulation.js";

function onResizeWidthEnd() {
  console.log("Computing new width...");
  // Needs to be called since the number of columns is calculated based on the screen width
  displayFilteredWorks();
  // Needs to be called since the canvas size is calculated based on the screen width
  setProperCanvasSize();
}
// Inspired by https://stackoverflow.com/a/5490021/7927429
let lastWidth = window.innerWidth;
var debounceTimeout;
window.addEventListener("resize", function () {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    const currentWidth = window.innerWidth;
    if (currentWidth !== lastWidth) {
      lastWidth = currentWidth;
      onResizeWidthEnd();
    }
  }, 100);
});

// Ensure the script runs after the DOM is fully loaded
document.addEventListener("DOMContentLoaded", (event) => {
  onResizeWidthEnd(); // Initial call to set sizes correctly
});
