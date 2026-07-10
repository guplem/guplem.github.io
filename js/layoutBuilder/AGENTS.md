# js/layoutBuilder/CLAUDE.md

## Overview

This directory handles all dynamic content rendering — fetching JSON data, building DOM elements, managing work filters, and laying out project cards.

## Module Responsibilities

| File | Purpose |
|---|---|
| `dataFiller.js` | Orchestrator. Wires up all data sources to DOM elements. Imports and delegates to the other modules. |
| `sectionFiller.js` | Generic section rendering: `fillWithData()` (JSON field to DOM element), `displayAdditionalSections()`, `displayContactInfo()` |
| `workCards.js` | Work card creation and masonry layout. `displayFilteredWorks()` builds the card grid. `getFilteredWorks()` applies current filter state. Card images/titles are real `<a href>` anchors to the primary link (crawler-followable, issue #37), not click handlers. |
| `workFilters.js` | Filter state (`selectedWorkTypes`, `selectedWorkSkills` arrays; `workSearchQuery` string via `getWorkSearchQuery`/`setWorkSearchQuery`), filter button creation (`fillWithGroupedButtons`), click handlers, collapsible sections |
| `structure.js` | Window resize handler (debounced 100ms). Triggers `displayFilteredWorks()` and canvas `init()` on width change. Also manages sticky nav visibility via IntersectionObserver. |

## Data Flow

1. `dataFiller.js` runs on module load — calls `fillWithData()` for static sections and `fillWithGroupedButtons()` for filter buttons
2. `structure.js` fires `displayFilteredWorks()` on `DOMContentLoaded` and on resize, also toggles `#siteNav.visible` when scrolling past the hero
3. Filter clicks (`workFilters.js`) update `selectedWorkTypes`/`selectedWorkSkills` arrays, then call `displayFilteredWorks()`; typing in the `#myWorkSearch` box updates `workSearchQuery` (debounced) and re-renders the same way
4. `displayFilteredWorks()` reads all works via `fetchAllWorks()`, applies filters (type AND skill AND free-text search over title/description/skills), sorts by date, and distributes cards across masonry columns

## Key Patterns

- **Circular dependency avoidance:** `workFilters.js` uses dynamic `import("./workCards.js")` to call `displayFilteredWorks()`, avoiding a circular import between filters and cards.
- **Masonry layout:** JS-based column balancing (not CSS Grid). Columns = `floor(windowWidth / 360px)`. Cards go into the shortest column.
- **Filter normalization:** Type/skill button matching uses `idFromText()` from `textUtils.js` to normalize strings (capitalized, no spaces/punctuation).
- **Free-text search:** the `#myWorkSearch` box filters by raw, case-insensitive substring match over title/description/skills (`textUtils.workMatchesText`), combined (AND) with the type/skill buttons. It deliberately does NOT use `idFromText()` — that normalization is only for button matching, not human-readable search. The re-render is debounced ~120ms (`setWorkSearchQuery` in `workFilters.js`).
- **Card stagger animation:** Each card gets an `animationDelay` based on its index for a staggered entrance effect.
- **SEO fallback replacement:** target containers start with static `GENERATED:*` fallback blocks (root ADR 0014). `fillWithData()`, `displayFilteredWorks()`, and `displayAdditionalSections()` clear the container right before injecting the dynamic content — never before the data is ready (a failed fetch must leave the fallback visible) and never by appending after it (that duplicates content). The hero is special: its static markup mirrors the dynamic render, and `fillWithData(..., keepMatchingStaticFallback = true)` keeps it when the text matches, so the `heroIn` animation never replays (no flicker). The comparison strips ALL whitespace: generated markup has newlines between elements, DOM-built fragments do not.
- **Mirror sync rule (nothing enforces this automatically):** the hero render and `buildHeroHtml()` in `scripts/generateSeoBlocks.js` must produce the same output. Changing the hero's TEXT out of sync makes the swap (and the flicker) return — a `console.warn` fires. Changing only its MARKUP out of sync is worse and silent: the text still matches, the old static markup gets adopted, and your change never appears on load. Any change to the hero render goes together with the same change in the generator + regeneration.
