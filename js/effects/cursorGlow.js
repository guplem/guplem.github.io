/**
 * Soft ambient glow that follows the cursor.
 * Creates a radial gradient blob under the mouse pointer.
 */

/** @type {HTMLElement | null} */
let glowElement = null;
let mouseX = 0;
let mouseY = 0;
let currentX = 0;
let currentY = 0;
let rafId = 0;

const LERP_SPEED = 0.12;

export function initCursorGlow() {
  glowElement = document.getElementById("cursorGlow");
  if (!glowElement) return;

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Hide on mobile / touch devices
  if (window.matchMedia("(pointer: coarse)").matches) {
    glowElement.style.display = "none";
    return;
  }

  tick();
}

function tick() {
  currentX += (mouseX - currentX) * LERP_SPEED;
  currentY += (mouseY - currentY) * LERP_SPEED;

  if (glowElement) {
    glowElement.style.transform = `translate(${currentX - 200}px, ${currentY + window.scrollY - 200}px)`;
  }

  rafId = requestAnimationFrame(tick);
}
