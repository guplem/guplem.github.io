/**
 * Minimal scroll-reveal effect.
 * Sections fade in as they enter the viewport.
 */

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
);

function observe() {
  document.querySelectorAll(".reveal:not(.visible)").forEach((el) => {
    observer.observe(el);
  });
}

// Mark key sections for reveal
document.addEventListener("DOMContentLoaded", () => {
  const selectors = ["#aboutMe", "#myWork", "#contact", "#additionalSections .section"];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => el.classList.add("reveal"));
  }
  observe();
});

// Re-observe when additional sections are dynamically added
const additional = document.getElementById("additionalSections");
if (additional) {
  new MutationObserver(() => {
    additional.querySelectorAll(".section:not(.reveal)").forEach((el) => el.classList.add("reveal"));
    observe();
  }).observe(additional, { childList: true });
}
