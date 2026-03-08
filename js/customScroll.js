// Self-contained custom scrollbar — creates its own DOM and styles.

(function () {
  // --- Inject styles ---
  const style = document.createElement("style");
  style.textContent = `
    .custom-scroll {
      position: fixed;
      top: 0;
      right: 0;
      width: 14px;
      height: 100%;
      z-index: 200;
      pointer-events: none;
    }
    .custom-scroll__thumb {
      position: absolute;
      right: 4px;
      width: 6px;
      border-radius: 3px;
      background: rgba(0, 0, 0, 0.2);
      pointer-events: auto;
      cursor: grab;
      transition: top 80ms ease-out, background 150ms ease-out, width 150ms ease-out, right 150ms ease-out;
    }
    .custom-scroll__thumb:hover {
      background: rgba(0, 0, 0, 0.35);
      width: 8px;
      right: 3px;
    }
    .custom-scroll__thumb.dragging {
      background: rgba(0, 0, 0, 0.4);
      width: 8px;
      right: 3px;
      cursor: grabbing;
      transition: background 150ms ease-out, width 150ms ease-out, right 150ms ease-out;
    }
  `;
  document.head.appendChild(style);

  // --- Create DOM ---
  const track = document.createElement("div");
  track.className = "custom-scroll";
  const thumb = document.createElement("div");
  thumb.className = "custom-scroll__thumb";
  track.appendChild(thumb);
  document.body.appendChild(track);

  // --- State ---
  let dragging = false;
  let dragOffsetY = 0;
  let rafId = 0;

  function getMetrics() {
    const doc = document.documentElement.scrollHeight;
    const view = window.innerHeight;
    const thumbH = Math.max(30, (view / doc) * view);
    const padding = 4;
    const maxThumbTop = view - thumbH - padding * 2;
    const maxScroll = doc - view;
    return { doc, view, thumbH, maxThumbTop, maxScroll, padding };
  }

  function updateThumb() {
    if (dragging) return;
    const { doc, view, thumbH, maxThumbTop, maxScroll, padding } = getMetrics();
    if (doc <= view) { thumb.style.display = "none"; return; }
    thumb.style.display = "";
    thumb.style.height = thumbH + "px";
    thumb.style.top = padding + (window.scrollY / maxScroll) * maxThumbTop + "px";
  }

  function scheduleUpdate() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateThumb);
  }

  // --- Scroll / resize ---
  document.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });

  // --- Drag ---
  thumb.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    dragOffsetY = e.clientY - thumb.getBoundingClientRect().top;
    thumb.classList.add("dragging");
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    e.preventDefault();
    const { thumbH, maxThumbTop, maxScroll, padding } = getMetrics();
    const newTop = Math.min(Math.max(0, e.clientY - dragOffsetY - padding), maxThumbTop);
    thumb.style.top = padding + newTop + "px";
    window.scrollTo(0, (newTop / maxThumbTop) * maxScroll);
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove("dragging");
    document.body.style.userSelect = "";
  });

  // --- Track click ---
  track.addEventListener("click", (e) => {
    if (e.target === thumb) return;
    const { thumbH, maxThumbTop, maxScroll, padding } = getMetrics();
    const clickTop = Math.min(Math.max(0, e.clientY - thumbH / 2 - padding), maxThumbTop);
    window.scrollTo({ top: (clickTop / maxThumbTop) * maxScroll, behavior: "smooth" });
  });

  // Re-check when DOM content changes (dynamic content loaded by dataFiller.js)
  let mutationRafId = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(mutationRafId);
    mutationRafId = requestAnimationFrame(updateThumb);
  }).observe(document.body, { childList: true, subtree: true });

  updateThumb();
})();
