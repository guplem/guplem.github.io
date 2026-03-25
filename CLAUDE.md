# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Structure

**README.md** files are human-facing. **CLAUDE.md** files are agent-facing. They are complementary, not overlapping.

| Content | README.md | CLAUDE.md |
|---|---|---|
| What the project is, key features | Yes | No |
| How to install, run, deploy | Yes | Only as quick reference |
| Architecture, data flow, layers | No | Yes |
| Coding patterns, conventions, rules | No | Yes |
| Gotchas an agent would hit | No | Yes |
| Adding a new project (full procedure) | No | Yes |
| List of projects/tools (for discoverability) | Yes | Yes (with agent context) |

When adding new content, ask: "Would a human need this to get started?" (README) or "Would an agent need this to avoid breaking patterns?" (CLAUDE.md).

### File map

| File | Scope |
|---|---|
| `CLAUDE.md` (this file) | Global: architecture, patterns, gotchas, pointers to child docs |
| `data/CLAUDE.md` | Portfolio data: schema, description style, skills/tags guidance, adding projects |
| `js/layoutBuilder/CLAUDE.md` | Layout modules: responsibilities, data flow, key patterns |
| `js/planetSimulation/CLAUDE.md` | Particle simulation: architecture, config, performance |
| `web-projects/CLAUDE.md` | Web projects: conventions, full checklist for adding a new web-project |
| `README.md` (root) | Human-facing: what the site is, how to run locally, project list |
| `web-projects/*/README.md` | Human-facing: per-project features, how to run |

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

- `css/global/variables.css` — Design tokens: palette (`--bg-dark`, `--accent`, `--accent-secondary`), spacing, typography, shadows, radii, transitions
- `css/global/layout.css` — Navigation, section containers, scroll-reveal animations
- `css/global/base.css` — Base typography
- `css/sections/` — Per-section styles (hero, works, about, contact, additional)

### Web Projects

`web-projects/` contains standalone mini-apps — small games, tools, and experiments, often AI-generated. Each project is fully self-contained (own HTML/CSS/JS) with no shared dependencies with the main portfolio site. See `web-projects/CLAUDE.md` for detailed guidance when working there.

## Key Patterns and Gotchas

**External CDN dependency:** npm packages (unified, remark-parse, rehype-stringify) are imported via `esm.sh` CDN — no local node_modules. Network failure breaks markdown rendering.

**Caching:** Both JSON fetches and markdown→HTML conversions are cached in `Map` objects. Clear browser cache after updating data files during development.

**Filter normalization:** `idFromText()` in `textUtils.js` strips punctuation/spaces/special chars and capitalizes — used for element IDs and filter matching. Must be consistent across all filter-related code.

**Masonry layout:** Work cards use JS-based column balancing (not CSS Grid). `displayFilteredWorks()` recalculates on resize (debounced 100ms).

**Adding a new project:** For web-projects, follow the full checklist in `web-projects/CLAUDE.md` (covers project folder, README, portfolio JSON, index manifest, and documentation updates). For other projects, see `data/CLAUDE.md` for the data-only steps.

## Deployment

GitHub Pages with custom domain (`CNAME` → `triunitystudios.com`). `.htaccess` enforces HTTPS and handles clean URL routing. Push to `main` deploys automatically.
