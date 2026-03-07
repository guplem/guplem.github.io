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
  { threshold: 0, rootMargin: "0px 0px -40px 0px" }
);

function observe() {
  document.querySelectorAll(".reveal:not(.visible)").forEach((el) => {
    observer.observe(el);
  });
}

// Mark sections for reveal — only ones that start off-screen
document.addEventListener("DOMContentLoaded", () => {
  const selectors = ["#aboutMe", "#contact", "#additionalSections .section"];
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
