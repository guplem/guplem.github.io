/**
 * 3D perspective tilt effect on work cards.
 * Cards tilt toward the cursor on hover with a subtle shine overlay.
 */

const MAX_TILT_DEG = 6;
const SHINE_OPACITY = 0.12;

/**
 * Initialize tilt effect on all work cards.
 * Call this after cards are rendered.
 */
export function initTiltCards() {
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseleave", resetAll, true);
}

/** @param {MouseEvent} e */
function onMouseMove(e) {
  const cards = document.querySelectorAll(".work");
  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    const isHovering =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    const el = /** @type {HTMLElement} */ (card);

    if (isHovering) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * MAX_TILT_DEG;
      const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * MAX_TILT_DEG;

      el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;

      // Shine effect position
      const shineX = ((e.clientX - rect.left) / rect.width) * 100;
      const shineY = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--shine-x", `${shineX}%`);
      el.style.setProperty("--shine-y", `${shineY}%`);
      el.style.setProperty("--shine-opacity", String(SHINE_OPACITY));
    } else {
      el.style.transform = "";
      el.style.setProperty("--shine-opacity", "0");
    }
  }
}

function resetAll() {
  document.querySelectorAll(".work").forEach((card) => {
    const el = /** @type {HTMLElement} */ (card);
    el.style.transform = "";
    el.style.setProperty("--shine-opacity", "0");
  });
}
