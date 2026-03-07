/**
 * Master orchestrator for all visual effects.
 * Initializes effects after DOM is ready and content is loaded.
 */

import { initScrollReveal, refreshScrollReveal } from "./scrollReveal.js";
import { initTiltCards } from "./tiltCards.js";
import { initCursorGlow } from "./cursorGlow.js";
import { initMagneticButtons } from "./magneticButtons.js";

document.addEventListener("DOMContentLoaded", () => {
  initCursorGlow();

  // Delay to let dynamic content render first
  setTimeout(() => {
    initScrollReveal();
    initTiltCards();
    initMagneticButtons();
  }, 400);
});

// Watch for dynamically added work cards and refresh reveals
const worksContainer = document.getElementById("myWorkFiltered");
if (worksContainer) {
  const mutationObserver = new MutationObserver(() => {
    refreshScrollReveal();
  });
  mutationObserver.observe(worksContainer, { childList: true, subtree: true });
}

// Also watch additionalSections for dynamic content
const additionalContainer = document.getElementById("additionalSections");
if (additionalContainer) {
  const mutationObserver = new MutationObserver(() => {
    refreshScrollReveal();
  });
  mutationObserver.observe(additionalContainer, { childList: true, subtree: true });
}

// Refresh on resize (works get re-rendered)
let resizeTimeout = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = window.setTimeout(() => {
    refreshScrollReveal();
  }, 300);
});
