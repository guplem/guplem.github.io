import { displayFilteredWorks } from "./dataFiller.js";
import { init } from "../planetSimulation/simulation.js";

// === Resize handling ===
function onResizeWidthEnd() {
  displayFilteredWorks();
  init();
}

let lastWidth = window.innerWidth;
let debounceTimeout = 0;
window.addEventListener("resize", () => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    const currentWidth = window.innerWidth;
    if (currentWidth !== lastWidth) {
      lastWidth = currentWidth;
      onResizeWidthEnd();
    }
  }, 100);
});

document.addEventListener("DOMContentLoaded", () => {
  onResizeWidthEnd();
});

// === Sticky nav: show when scrolled past hero ===
const nav = document.getElementById("siteNav");
const hero = document.getElementById("introduction");

if (nav && hero) {
  const navObserver = new IntersectionObserver(
    ([entry]) => {
      nav.classList.toggle("visible", !entry.isIntersecting);
    },
    { threshold: 0 }
  );
  navObserver.observe(hero);
}
