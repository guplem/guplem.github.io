# web-projects/CLAUDE.md

> **SCOPE:** These rules apply when working on files under `web-projects/`. Each project inside is self-contained and independent from the main portfolio site -- except the `index.html` directory index (see "The Index Page" below).

## Overview

Collection of small, standalone web projects -- games, tools, experiments, demos. Often AI-generated. Each is fully self-contained and independent from the main portfolio site, except the directory index (`index.html`) described below.

## Conventions

- **One folder per project** -- all assets live inside the project folder
- **Self-contained** -- own HTML, CSS, JS. No shared dependencies with the main site or other projects
- **No build tools, no frameworks** -- vanilla HTML/CSS/JS preferred
- **Works standalone** -- each project should work by opening its HTML file directly or via any HTTP server

## The Index Page (`index.html`)

`web-projects/index.html` is the landing page for `https://triunitystudios.com/web-projects/`. It is the **one deliberate exception** to the self-contained rule above: it is a portfolio-level directory index, so it reads the portfolio data (`../data/projects/*.json`) and reuses the site's global tokens (`../css/global/variables.css`, `../css/global/base.css`). See ADR 0011.

- **Never hardcode the project list.** It is derived live: a project is listed when it has a link that is **not** `type: "github"` whose URL (after stripping the `triunitystudios.com` origin) starts with `web-projects/`. Adding such a project to the portfolio data makes it appear here automatically.
- The grid also carries a **generated static fallback block** between `GENERATED:WEB-PROJECTS` markers so crawlers see the list without JS (root ADR 0014). Never hand-edit it; regenerate with `bun scripts/generateSeoBlocks.js`. The static cards mirror the `app.js` card markup exactly; at load `app.js` **adopts** them when their text matches the live-derived cards (wiring search to them, no entrance-animation replay) and only swaps them when they drift.
- The fragile matching/selection logic is pure and Bun-tested in `discovery.js` / `discovery.test.js`; `app.js` only fetches and renders. Keep new logic in `discovery.js` with tests.
- Do **not** make individual projects depend on the index, and do not import the index's files into a project.

## Architecture Decision Records (ADRs)

A decision specific to one web-project lives in that project's own `adr/` folder (`web-projects/<project>/adr/`), **numbered per project from `0001`** -- not in the root `adr/`. Cross-cutting web-project patterns (e.g. URL-as-state, localStorage) and main-site decisions stay in root `adr/`.

Reference convention so per-project numbers stay unambiguous: inside a project, `ADR 000N` means that project's own ADR; a root ADR is written `root ADR 00NN`; links always use the full path (which includes the project). The root `CLAUDE.md` keeps a master index of every ADR (root and per-project).

## Test-Driven Development (mandatory)

All new web-projects use TDD with [Bun's built-in test runner](https://bun.sh/docs/cli/test) (`bun test`). No config or `package.json` required.

**Workflow:** When a feature is requested, write failing tests first (RED), then write the minimum code to pass (GREEN), then refactor if needed. Repeat for each feature.

**Tests are documentation.** Every non-visual feature must have corresponding tests. This ensures AI agents always have a complete picture of the project's expected behavior and constraints, not just the implementation.

**Structure:**
- Place test files next to source files: `script.test.js` alongside `script.js`
- Run tests with `bun test` from the project folder
- Tests must pass before a feature is considered complete

**Scope:** Test logic, calculations, data transformations, state management, and any non-visual behavior. Visual/DOM rendering does not need test coverage.


## Adding a New Web Project

**Use the `/add-web-project` command.** It automates the full scaffolding checklist. This command must be used whenever creating a new web-project.

## Existing Projects

- **ChatGPTPong** -- Classic Pong game generated entirely by ChatGPT (GPT-3.5) in Dec 2022
- **gravity-sandbox** -- Interactive N-body gravitational simulation with slingshot spawning, merging, trails, and presets
- **photo-editor** -- Mobile photo editor with drawing, stickers, filters, and cropping
- **seasonal-color-classifier** -- Color analysis tool that classifies colors into seasonal palettes
- **github-stats-dashboard** -- GitHub repository analytics dashboard with issues, PRs, commits, contributors, and language breakdowns
- **random-option-picker** -- Slot-machine style random picker with shareable URLs and reproducible seeds (TDD-covered, mulberry32 PRNG)
- **taboo-game** -- Deterministic multiplayer Taboo game with no server; every client derives the same state from shared seed + turn (TDD-covered, see taboo-game ADR 0001)
- **liga-under-tkd** -- Live taekwondo tournament site; reads a shared Google Sheet via the gviz endpoint and computes standings/combats/profiles in CA/ES/EN (TDD-covered pure modules, see liga-under-tkd ADR 0001)
- **rps-mind-reader** -- Rock-paper-scissors against an adaptive AI that learns your patterns (a Bayesian mixture of variable-order context models weighted by predictive log-likelihood, each voting for the expected-value-optimal counter; algorithm chosen and guarded by `benchmark.js`, a dev-only opponent-battery harness); state persists in localStorage, with a statistics page charting win/loss/tie trends and AI prediction confidence over time (TDD-covered, see root ADR 0009 and rps-mind-reader ADR 0001)
