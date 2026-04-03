# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Living Document

This file and all child `CLAUDE.md` files are self-improving. Update them when you discover something worth recording:

| Discovery | Where to write |
|---|---|
| Cross-project preference or pattern | `~/.claude/CLAUDE.md` |
| Project-specific constraint, gotcha, or pattern | This file or the relevant child `CLAUDE.md` |
| Architectural decision with trade-offs | `adr/NNNN-descriptive-title.md` + update the ADR index below |
| Human-facing change (new feature, project, setup step) | `README.md` (root or per-project) |
| Wrong or outdated instruction | Correct it in place, whichever file it's in |

Keep documentation current: when you add a feature, fix a bug, or change behavior, update the relevant `README.md` and `CLAUDE.md` files in the same change. Do not leave documentation updates for a separate step.

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
| `web-projects/CLAUDE.md` | Web projects: conventions, TDD with Bun, full checklist for adding a new web-project |
| `adr/*.md` | Architecture Decision Records: why behind key choices |
| `README.md` (root) | Human-facing: what the site is, how to run locally, project list |
| `web-projects/*/README.md` | Human-facing: per-project features, how to run |

## Project Overview

Personal portfolio website for Guillem Poy, hosted on GitHub Pages at `triunitystudios.com`. Vanilla HTML/CSS/JavaScript -- no build system, no bundler, no framework.

## Development

**No build step.** Serve files locally with any HTTP server:
```bash
python -m http.server 8000
```
No tests, no linter, no package manager configured.

## Architecture

### Data-Driven Content

All portfolio content lives in JSON files -- never edit HTML to change content:
- `data/info.json` -- Site metadata, personal info, contact details
- `data/projects/index.json` -- Manifest of all project filenames
- `data/projects/*.json` -- One file per portfolio project (conforms to `data/schemas/project.schema.json`)

See `data/CLAUDE.md` for field reference and detailed guidance.

`js/layoutBuilder/dataFiller.js` orchestrates page rendering at load time, delegating to focused modules. `textUtils.fetchAllWorks()` loads all projects from the manifest.

### JavaScript Module System

All JS uses ES6 modules (`type="module"` with `defer`). Key modules:

| Directory | Purpose |
|---|---|
| `js/layoutBuilder/` | Content generation -- see `js/layoutBuilder/CLAUDE.md` for module breakdown |
| `js/planetSimulation/` | Canvas-based interactive particle physics background (120 particles, gravity, collisions) |
| `js/utils/` | `textUtils.js` (markdown->HTML via marked), `uiUtils.js` (DOM helpers) |

### CSS Structure

- `css/global/variables.css` -- Design tokens: palette (`--bg-dark`, `--accent`, `--accent-secondary`), spacing, typography, shadows, radii, transitions
- `css/global/layout.css` -- Navigation, section containers, scroll-reveal animations
- `css/global/base.css` -- Base typography
- `css/sections/` -- Per-section styles (hero, works, about, contact, additional)

### Web Projects

`web-projects/` contains standalone mini-apps -- small games, tools, and experiments, often AI-generated. Each project is fully self-contained (own HTML/CSS/JS) with no shared dependencies with the main portfolio site. See `web-projects/CLAUDE.md` for detailed guidance when working there.

## Pattern Scout (mandatory)

**Before implementing any new feature or component**, run the `pattern-scout` agent (`.claude/agents/pattern-scout.md`). Do not skip this step. It analyzes the codebase for similar implementations and reports the established patterns, naming conventions, file locations, and DOM/CSS conventions. Treat its output as a strong baseline -- follow it unless you have a concrete reason to deviate, and explain that reasoning when you do.

## Key Patterns and Gotchas

**External CDN dependency:** `marked` is imported via `esm.sh` CDN -- no local node_modules. Network failure breaks markdown rendering.

**Caching:** Both JSON fetches and markdown->HTML conversions are cached in `Map` objects. Clear browser cache after updating data files during development.

**Filter normalization:** `idFromText()` in `textUtils.js` strips punctuation/spaces/special chars and capitalizes -- used for element IDs and filter matching. Must be consistent across all filter-related code.

**Masonry layout:** Work cards use JS-based column balancing (not CSS Grid). `displayFilteredWorks()` recalculates on resize (debounced 100ms).

**Adding a new project:** For web-projects, follow the full checklist in `web-projects/CLAUDE.md` (covers project folder, README, portfolio JSON, index manifest, and documentation updates). For other projects, see `data/CLAUDE.md` for the data-only steps.

## Architecture Decision Records (ADRs)

ADRs live in `adr/` and capture the **why** behind architectural choices. Format: Context, Decision, Consequences.

| ADR | Topic |
|---|---|
| [0001](adr/0001-data-driven-content-via-json.md) | Data-driven content via JSON instead of CMS or SSG |
| [0002](adr/0002-no-build-system.md) | No build system -- vanilla JS with CDN imports |
| [0003](adr/0003-web-worker-for-particle-simulation.md) | Web Worker for particle simulation physics |
| [0004](adr/0004-js-masonry-layout.md) | JS-based masonry layout instead of CSS Grid |
| [0005](adr/0005-cdn-for-dependencies.md) | esm.sh CDN for third-party dependencies |

**Consult ADRs** before making changes that touch their areas. Run the `adr-checker` agent (`.claude/agents/adr-checker.md`) to identify relevant ADRs.

**Create a new ADR** when making an architectural decision with trade-offs worth preserving. Use the next sequential number. This includes decisions made within web-projects (e.g., choosing a physics engine, a rendering approach, or a data structure).

**Keep ADRs current.** When a change affects an existing decision, update the relevant ADR. If a decision is superseded, mark the old ADR as superseded and reference the new one. The ADR index table above must always reflect the contents of `adr/`.

## Deployment

GitHub Pages with custom domain (`CNAME` -> `triunitystudios.com`). `.htaccess` enforces HTTPS and handles clean URL routing. Push to `main` deploys automatically.
