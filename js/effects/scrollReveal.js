/**
 * Scroll-triggered reveal animations using Intersection Observer.
 * Elements with [data-reveal] animate in when they enter the viewport.
 */

const REVEAL_THRESHOLD = 0.08;
const STAGGER_DELAY_MS = 80;

/** @type {IntersectionObserver} */
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      const el = /** @type {HTMLElement} */ (entry.target);
      el.classList.add("revealed");
      observer.unobserve(el);
    }
  },
  { threshold: REVEAL_THRESHOLD, rootMargin: "0px 0px -40px 0px" }
);

/** @type {IntersectionObserver} */
const staggerObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      const el = /** @type {HTMLElement} */ (entry.target);
      const children = el.querySelectorAll(".work, .contactMethod, .additionalSection");
      children.forEach((child, i) => {
        /** @type {HTMLElement} */ (child).style.transitionDelay = `${i * STAGGER_DELAY_MS}ms`;
        child.classList.add("revealed");
      });

      staggerObserver.unobserve(el);
    }
  },
  { threshold: 0.05 }
);

/**
 * Initialize scroll reveal on all marked elements
 */
export function initScrollReveal() {
  document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
  document.querySelectorAll("[data-reveal-stagger]").forEach((el) => staggerObserver.observe(el));
}

/**
 * Re-observe dynamically added elements (call after content loads)
 */
export function refreshScrollReveal() {
  // Observe individual work cards
  document.querySelectorAll(".work:not(.revealed)").forEach((el) => {
    el.setAttribute("data-reveal", "");
    observer.observe(el);
  });

  // Re-check stagger containers
  document.querySelectorAll("[data-reveal-stagger]:not(.stagger-done)").forEach((el) => {
    staggerObserver.observe(el);
  });

  // Observe any new reveal elements
  document.querySelectorAll("[data-reveal]:not(.revealed)").forEach((el) => {
    observer.observe(el);
  });
}
