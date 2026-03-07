/**
 * Magnetic hover effect on buttons and interactive elements.
 * Elements subtly pull toward the cursor when hovering nearby.
 */

const MAGNETIC_STRENGTH = 0.3;
const MAGNETIC_DISTANCE = 60;

export function initMagneticButtons() {
  // Apply to filter buttons and contact methods
  const selectors = "#myWorkTypes button, #myWorkSkills button, .contactMethod, #arrowPointingDown";

  document.addEventListener("mousemove", (e) => {
    const elements = document.querySelectorAll(selectors);
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distX = e.clientX - centerX;
      const distY = e.clientY - centerY;
      const distance = Math.sqrt(distX * distX + distY * distY);

      const htmlEl = /** @type {HTMLElement} */ (el);

      if (distance < MAGNETIC_DISTANCE) {
        const pull = (1 - distance / MAGNETIC_DISTANCE) * MAGNETIC_STRENGTH;
        htmlEl.style.transform = `translate(${distX * pull}px, ${distY * pull}px)`;
      } else {
        htmlEl.style.transform = "";
      }
    }
  });
}
