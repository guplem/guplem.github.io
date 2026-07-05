# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal portfolio website for Guillem Poy, hosted on GitHub Pages at `triunitystudios.com`. Vanilla HTML/CSS/JavaScript -- no build system, no bundler, no framework.

Before implementing any non-trivial feature, delegate to the **pattern-scout** agent.

Before implementing features that touch architectural areas covered by an ADR, delegate to the **adr-checker** agent in **consult mode**. After such changes, delegate in **maintain mode**.

After writing or modifying code in `web-projects/`, delegate to the **test-runner** agent.

After completing changes that affect documented content, delegate to the **docs-checker** agent.

When the user's request is broad or exploratory, ask whether they'd like to run multi-agent research (`/research-agents`) before proceeding.

## Living Document

This file and all child `CLAUDE.md` files are self-improving. Update them when you discover something worth recording:

| Discovery | Where to write |
|---|---|
| Cross-project preference or pattern | `~/.claude/CLAUDE.md` |
| Project-specific constraint, gotcha, or pattern | This file or the relevant child `CLAUDE.md` |
| Architectural decision with trade-offs | `adr/NNNN-*.md` (main-site/cross-cutting) or `web-projects/<project>/adr/NNNN-*.md` (project-specific) + update the ADR index below |
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
| `web-projects/rps-mind-reader/CLAUDE.md` | rps-mind-reader: predictor architecture + contracts, R&D workflow, strategies tried/rejected |
| `adr/*.md`, `web-projects/*/adr/*.md` | Architecture Decision Records: why behind key choices (root = main-site/cross-cutting; per-project = project-specific) |
| `README.md` (root) | Human-facing: what the site is, how to run locally, project list |
| `web-projects/*/README.md` | Human-facing: per-project features, how to run |

## Development

**No build step.** Serve files locally with any HTTP server:
```bash
python -m http.server 8000
```
No linter or package manager for the main site. Web-projects use Bun's test runner (`bun test`) for their pure logic -- see `web-projects/CLAUDE.md`.

**CI:** `.github/workflows/test.yml` runs `bun test .` (the whole suite: web-projects tests, the data validation test, the `textCore` tests, and the SEO-artifact drift tests in `scripts/`) on every pull request and push to `main`, and it is a required status check on `main` -- a PR with a failing test cannot be merged. Keep tests green; a new web-project's tests are picked up automatically. See ADR 0013.

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
| `js/utils/` | `textCore.js` (pure text/filter helpers, Bun-tested), `textUtils.js` (fetch + markdown->HTML via marked, re-exports `textCore`), `uiUtils.js` (DOM helpers) |

### CSS Structure

- `css/global/variables.css` -- Design tokens: palette (`--bg-dark`, `--accent`, `--accent-secondary`), spacing, typography, shadows, radii, transitions
- `css/global/layout.css` -- Navigation, section containers, scroll-reveal animations
- `css/global/base.css` -- Base typography
- `css/sections/` -- Per-section styles (hero, works, about, contact, additional)

### Web Projects

`web-projects/` contains standalone mini-apps -- small games, tools, and experiments, often AI-generated. Each project is fully self-contained (own HTML/CSS/JS) with no shared dependencies with the main portfolio site -- except the `web-projects/index.html` directory index, which is data-driven and reuses the site's global CSS (see ADR 0011). See `web-projects/CLAUDE.md` for detailed guidance when working there.

## Key Patterns and Gotchas

**External CDN dependency:** `marked` is imported via `esm.sh` CDN -- no local node_modules. Network failure breaks markdown rendering.

**Caching:** Both JSON fetches and markdown->HTML conversions are cached in `Map` objects. Clear browser cache after updating data files during development.

**Filter normalization:** `idFromText()` in `textUtils.js` strips punctuation/spaces/special chars and capitalizes -- used for element IDs and type/skill button filter matching. Must be consistent across button-based filter code. The free-text work search (`workMatchesText` in `textUtils.js`) intentionally does NOT use `idFromText()` -- it matches raw lowercase substrings so users can type naturally.

**Masonry layout:** Work cards use JS-based column balancing (not CSS Grid). `displayFilteredWorks()` recalculates on resize (debounced 100ms).

**Generated SEO artifacts (never hand-edit):** `sitemap.xml` and the `<!-- BEGIN GENERATED:<NAME> -->` ... `<!-- END GENERATED:<NAME> -->` blocks in `index.html` and `web-projects/index.html` are derived from `data/` by `bun scripts/generateSitemap.js` and `bun scripts/generateSeoBlocks.js` (see ADR 0014). After any edit to `data/info.json` or `data/projects/*.json`, run both scripts (automatic with the lefthook pre-commit hook); CI drift tests fail otherwise. The static head metadata in `index.html` (title/description) must stay identical to `web-title`/`web-description` in `data/info.json`.

**Adding a new project:** For web-projects, use the `/add-web-project` command -- it automates the full scaffolding checklist. For other projects, see `data/CLAUDE.md` for the data-only steps.

## Architecture Decision Records (ADRs)

ADRs capture the **why** behind architectural choices (format: Context, Decision, Consequences). They live in two places:

- **Root `adr/`** -- main-site and cross-cutting decisions. Numbered globally; gaps are fine (numbers are stable identifiers and are never reused).
- **`web-projects/<project>/adr/`** -- decisions specific to one web-project. Numbered **per project** from `0001`.

Reference a project ADR with its project so the number is unambiguous (path, or "rps-mind-reader ADR 0001"). Inside a project, `ADR 000N` means that project's own; a root ADR is written `root ADR 00NN`.

### Root ADRs

| ADR | Topic |
|---|---|
| [0001](adr/0001-data-driven-content-via-json.md) | Data-driven content via JSON instead of CMS or SSG |
| [0002](adr/0002-no-build-system.md) | No build system -- vanilla JS with CDN imports |
| [0003](adr/0003-web-worker-for-particle-simulation.md) | Web Worker for particle simulation physics |
| [0004](adr/0004-js-masonry-layout.md) | JS-based masonry layout instead of CSS Grid |
| [0005](adr/0005-cdn-for-dependencies.md) | esm.sh CDN for third-party dependencies |
| [0006](adr/0006-url-as-state-for-web-projects.md) | URL query params as source of truth for shareable web-projects |
| [0009](adr/0009-localstorage-for-private-session-persistence.md) | localStorage for private-session persistence in web-projects |
| [0011](adr/0011-web-projects-index-from-portfolio-data.md) | Web-projects index page derived from portfolio data (not self-contained) |
| [0013](adr/0013-github-actions-ci-for-bun-tests.md) | GitHub Actions CI runs the full Bun test suite on pull requests |
| [0014](adr/0014-pre-commit-generated-static-seo-content.md) | Pre-commit generated static SEO content (sitemap + HTML fallback blocks) |

### Per-project ADRs

| ADR | Topic |
|---|---|
| [taboo-game 0001](web-projects/taboo-game/adr/0001-deterministic-multiplayer-without-server.md) | Deterministic multiplayer without a server |
| [liga-under-tkd 0001](web-projects/liga-under-tkd/adr/0001-google-sheet-as-database.md) | Google Sheet as the live database via gviz |
| [rps-mind-reader 0001](web-projects/rps-mind-reader/adr/0001-custom-statistical-predictor-no-ml-library.md) | Custom statistical predictor instead of an ML library |
| [rps-mind-reader 0002](web-projects/rps-mind-reader/adr/0002-predictor-evaluation-methodology.md) | Predictor evaluation methodology: switching battery + held-out real sessions |

**Create a new ADR** when making an architectural decision with trade-offs worth preserving. A decision specific to one web-project goes in that project's `adr/` (next per-project number); a main-site or cross-cutting decision (including web-project-wide patterns like URL-as-state or localStorage) goes in root `adr/` (next global number).

**Keep ADRs current.** When a change affects an existing decision, update the relevant ADR. If a decision is superseded, mark the old ADR as superseded and reference the new one. Both index tables above must reflect the contents of `adr/` and every `web-projects/*/adr/`.

## GitHub Issues, PRs, and Other Artifacts

- **Always self-assign PRs** when creating them.
- **Always link PRs to issues** using `Closes #N` in the PR body so issues auto-close on merge.
- **Always add the `waiting-for-human-check` label** when creating GitHub issues, pull requests, or any other reviewable artifact. This signals that no human has verified the content yet -- it is direct AI output. Once a human reviews it, the label is removed. The label communicates state (unreviewed), not origin.

If the repository does not have a `waiting-for-human-check` label, create it first:
```bash
gh label create "waiting-for-human-check" --description "No human has verified this yet -- direct AI output" --color "D93F0B"
```

## Self-Updating Rules

When you discover something during a task that was **non-obvious and would save time in future sessions**, add it to the relevant `CLAUDE.md`. Examples: an undocumented implicit dependency, a silent failure mode, a config quirk that causes hard-to-diagnose bugs.

This also applies when the user tells you to do something **"every time"**, **"always"**, or **"never"**: immediately persist it rather than applying it only for the current session. Always prefer the most specific scope: project-level over global when the rule only applies to this repo.

**Also add** a rule whenever the codebase does something in a way that diverges from what a software developer or an AI would naturally write. If the correct approach here is not the standard/obvious one, a future agent will implement it the wrong way without an explicit rule.

**Do NOT add:**
- Standard patterns discoverable via normal code reading or search
- Things already covered by existing rules
- One-off context unlikely to recur

The bar: if a future agent could reasonably figure it out within a few seconds of exploration, don't add it. Only record knowledge that took a painful detour to uncover, or that diverges from what any competent developer would write by default.

## Deployment

GitHub Pages with custom domain (`CNAME` -> `triunitystudios.com`). HTTPS is enforced by GitHub Pages itself (repository Pages settings), not by any file in the repo. Push to `main` deploys automatically. There is no server-side routing; every URL maps directly to a file.
