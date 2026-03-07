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
- `data/projects/index.json` — Manifest of all project filenames
- `data/projects/*.json` — One file per portfolio project (conforms to `data/schemas/project.schema.json`)

See `data/CLAUDE.md` for field reference and detailed guidance.

`js/layoutBuilder/dataFiller.js` orchestrates page rendering at load time, delegating to focused modules. `textUtils.fetchAllWorks()` loads all projects from the manifest.

### JavaScript Module System

All JS uses ES6 modules (`type="module"` with `defer`). Key modules:

| Directory | Purpose |
|---|---|
| `js/layoutBuilder/` | Content generation — see `js/layoutBuilder/CLAUDE.md` for module breakdown |
| `js/planetSimulation/` | Canvas-based interactive particle physics background (120 particles, gravity, collisions) |
| `js/utils/` | `textUtils.js` (markdown→HTML via unified/remark), `uiUtils.js` (DOM helpers) |

### CSS Structure

- `css/global/variables.css` — Color variables (`--background-dark`, `--primary-accent-color`, etc.)
- `css/global/properties.css` — `@property` declarations with typed CSS custom properties
- `css/global/base.css` — Base typography
- `css/sections/` — Per-section styles (introduction, works, contact, etc.)

### Web Projects

`web-projects/` contains standalone mini-apps — small games, tools, and experiments, often AI-generated. Each project is fully self-contained (own HTML/CSS/JS) with no shared dependencies with the main portfolio site. See `web-projects/CLAUDE.md` for detailed guidance when working there.

## Key Patterns and Gotchas

**External CDN dependency:** npm packages (unified, remark-parse, rehype-stringify) are imported via `esm.sh` CDN — no local node_modules. Network failure breaks markdown rendering.

**Caching:** Both JSON fetches and markdown→HTML conversions are cached in `Map` objects. Clear browser cache after updating data files during development.

**Filter normalization:** `idFromText()` in `textUtils.js` strips punctuation/spaces/special chars and capitalizes — used for element IDs and filter matching. Must be consistent across all filter-related code.

**Masonry layout:** Work cards use JS-based column balancing (not CSS Grid). `displayFilteredWorks()` recalculates on resize (debounced 100ms).

**Adding a new project:** Create a JSON file in `data/projects/`, add it to `data/projects/index.json`, and follow the schema in `data/schemas/project.schema.json`. See `data/CLAUDE.md` for the full process and description writing guidelines.

## Deployment

GitHub Pages with custom domain (`CNAME` → `triunitystudios.com`). `.htaccess` enforces HTTPS and handles clean URL routing. Push to `main` deploys automatically.
