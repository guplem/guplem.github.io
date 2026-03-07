# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website for Guillem Poy, hosted on GitHub Pages at `triunitystudios.com`. Vanilla HTML/CSS/JavaScript — no build system, no bundler, no framework.

## Development

**No build step.** Serve files locally with any HTTP server:
```bash
python -m http.server 8000
```
No tests, no linter, no package manager configured.

## Architecture

### Data-Driven Content

All portfolio content lives in JSON files — never edit HTML to change content:
- `data/info.json` — Site metadata, personal info, contact details
- `data/myWork.json` — Portfolio projects (title, date, description, skills, types, links, images)

`js/layoutBuilder/dataFiller.js` fetches JSON at page load, converts markdown fields to HTML, and populates the DOM dynamically.

### JavaScript Module System

All JS uses ES6 modules (`type="module"` with `defer`). Key modules:

| Directory | Purpose |
|---|---|
| `js/layoutBuilder/` | Content generation: `dataFiller.js` (JSON→DOM), `structure.js` (layout/resize), `scrollUpdates.js` (scroll events) |
| `js/planetSimulation/` | Canvas-based interactive particle physics background (120 particles, gravity, collisions) |
| `js/utils/` | `textUtils.js` (markdown→HTML via unified/remark), `uiUtils.js` (DOM helpers) |

### CSS Structure

- `css/global/variables.css` — Color variables (`--background-dark`, `--primary-accent-color`, etc.)
- `css/global/properties.css` — `@property` declarations with typed CSS custom properties
- `css/global/base.css` — Base typography
- `css/sections/` — Per-section styles (introduction, works, contact, etc.)

### Embedded Web Projects

`web-projects/` contains standalone mini-apps (not integrated into main site): `ChatGPTPong/`, `seasonal-color-classifier/`.

## Key Patterns and Gotchas

**External CDN dependency:** npm packages (unified, remark-parse, rehype-stringify) are imported via `esm.sh` CDN — no local node_modules. Network failure breaks markdown rendering.

**Caching:** Both JSON fetches and markdown→HTML conversions are cached in `Map` objects. Clear browser cache after updating data files during development.

**Filter normalization:** `idFromText()` in `textUtils.js` strips punctuation/spaces/special chars and capitalizes — used for element IDs and filter matching. Must be consistent across all filter-related code.

**Masonry layout:** Work cards use JS-based column balancing (not CSS Grid). `displayFilteredWorks()` recalculates on resize (debounced 100ms).

**Adding a new project:** Add an entry to `data/myWork.json`. The `Prompts/` directory contains example prompts showing the expected description structure (concept → role → outcome, short and direct). Optional fields (`image`, `imageStretched`, `imageAlt`, `links`) are gracefully skipped if absent.

## Deployment

GitHub Pages with custom domain (`CNAME` → `triunitystudios.com`). `.htaccess` enforces HTTPS and handles clean URL routing. Push to `main` deploys automatically.
