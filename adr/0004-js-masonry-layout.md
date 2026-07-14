# ADR 0004: JS-Based Masonry Layout

## Context

The portfolio work cards need a masonry-style grid where cards of varying height pack tightly without gaps. Options:
- CSS Grid with `masonry` value (experimental, not widely supported)
- CSS columns (breaks card order, hard to control)
- A JS library like Masonry.js
- Custom JS column balancing

CSS-based approaches (Grid masonry, columns) were tested but did not produce the desired visual result -- card distribution, ordering, and spacing did not match the intended design.

## Decision

Custom JS implementation in `workCards.js`. Column count is calculated as `floor(windowWidth / 360px)`. Cards are distributed one at a time to the shortest column. Layout recalculates on window resize (debounced 100ms).

This gives full control over how cards are ordered and distributed across columns, which the CSS alternatives could not achieve.

**Rejected alternative:** CSS Grid `masonry`, CSS columns, or a library such as Masonry.js. The CSS approaches were tested but did not match the intended card distribution, ordering, and spacing; a library would add an external dependency the custom code avoids.

## Consequences

**Positive:**
- Exact control over card placement, ordering, and column balancing.
- No external library dependency.
- Works across all browsers without feature detection.

**Negative:**
- Layout is not visible until JS executes (no CSS-only fallback).
- Must manually trigger recalculation on resize, filter changes, and card additions.
- More code to maintain than a pure CSS solution would require (once CSS masonry is widely supported and matches the desired behavior).

> **Note (2026-07):** two SEO-driven qualifications (see ADR 0014). Card titles and images are now wrapped in real `<a href>` anchors (`workCards.js`) instead of `window.open()` click handlers, so crawlers can follow them; the masonry algorithm itself is unchanged. And the works grid now carries a generated *plain-markup* static fallback that softens the "not visible until JS executes" negative for crawlers and no-JS visitors -- it deliberately does not replicate the masonry column balancing, which remains a JS runtime concern.
