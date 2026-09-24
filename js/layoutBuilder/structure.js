import { displayFilteredWorks } from "./dataFiller.js";
import { init } from "../planetSimulation/simulation.js";
import { nextNavScrollState, isPointerInNavRevealZone } from "./navReveal.js";

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

// === Sticky nav: scrolling down reveals it, scrolling up hides it, and a mouse near the top edge shows it ===
const nav = document.getElementById("siteNav");
const NAV_SCROLL_THRESHOLD_PX = 16;
const NAV_HOVER_ZONE_EXTRA_PX = 24;

if (nav) {
  /** @type {import("./navReveal.js").NavScrollState} */
  let navScrollState = { revealed: false, anchorY: window.scrollY };
  let isPointerNearTop = false;
  let isScrollFramePending = false;

  const updateNavVisibility = () => {
    nav.classList.toggle("visible", navScrollState.revealed || isPointerNearTop);
  };

  window.addEventListener(
    "scroll",
    () => {
      if (isScrollFramePending) return;
      isScrollFramePending = true;
      requestAnimationFrame(() => {
        isScrollFramePending = false;
        navScrollState = nextNavScrollState(navScrollState, window.scrollY, NAV_SCROLL_THRESHOLD_PX);
        updateNavVisibility();
      });
    },
    { passive: true }
  );

  // Hover only: touch has no pointer to rest near the top, so it relies on scrolling.
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const hoverZoneHeight = nav.offsetHeight + NAV_HOVER_ZONE_EXTRA_PX;
    const isNearTop = isPointerInNavRevealZone(event.clientY, hoverZoneHeight);
    if (isNearTop === isPointerNearTop) return;
    isPointerNearTop = isNearTop;
    updateNavVisibility();
  });

  document.documentElement.addEventListener("mouseleave", () => {
    isPointerNearTop = false;
    updateNavVisibility();
  });
}
