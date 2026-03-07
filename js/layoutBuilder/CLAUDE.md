# js/layoutBuilder/CLAUDE.md

## Overview

This directory handles all dynamic content rendering — fetching JSON data, building DOM elements, managing work filters, and laying out project cards.

## Module Responsibilities

| File | Purpose |
|---|---|
| `dataFiller.js` | Orchestrator. Wires up all data sources to DOM elements. Imports and delegates to the other modules. |
| `sectionFiller.js` | Generic section rendering: `fillWithData()` (JSON field to DOM element), `displayAdditionalSections()`, `displayContactInfo()` |
| `workCards.js` | Work card creation and masonry layout. `displayFilteredWorks()` builds the card grid. `getFilteredWorks()` applies current filter state. |
| `workFilters.js` | Filter state (`selectedWorkTypes`, `selectedWorkSkills`), filter button creation (`fillWithGroupedButtons`), click handlers, collapsible sections |
| `structure.js` | Window resize handler (debounced 100ms). Triggers `displayFilteredWorks()` and canvas `init()` on width change. |

## Data Flow

1. `dataFiller.js` runs on module load — calls `fillWithData()` for static sections and `fillWithGroupedButtons()` for filter buttons
2. `structure.js` fires `displayFilteredWorks()` on `DOMContentLoaded` and on resize
3. Filter clicks (`workFilters.js`) update `selectedWorkTypes`/`selectedWorkSkills` arrays, then call `displayFilteredWorks()`
4. `displayFilteredWorks()` reads all works via `fetchAllWorks()`, applies filters, sorts by date, and distributes cards across masonry columns

## Key Patterns

- **Circular dependency avoidance:** `workFilters.js` uses dynamic `import("./workCards.js")` to call `displayFilteredWorks()`, avoiding a circular import between filters and cards.
- **Masonry layout:** JS-based column balancing (not CSS Grid). Columns = `floor(windowWidth / 350px)`. Cards go into the shortest column.
- **Filter normalization:** All filter matching uses `idFromText()` from `textUtils.js` to normalize strings (capitalized, no spaces/punctuation).
