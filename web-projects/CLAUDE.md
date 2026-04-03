# web-projects/CLAUDE.md

> **SCOPE:** These rules apply when working on files under `web-projects/`. Each project inside is self-contained and independent from the main portfolio site.

## Overview

Collection of small, standalone web projects -- games, tools, experiments, demos. Often AI-generated. Each is fully self-contained and independent from the main portfolio site.

## Conventions

- **One folder per project** -- all assets live inside the project folder
- **Self-contained** -- own HTML, CSS, JS. No shared dependencies with the main site or other projects
- **No build tools, no frameworks** -- vanilla HTML/CSS/JS preferred
- **Works standalone** -- each project should work by opening its HTML file directly or via any HTTP server

## Test-Driven Development (mandatory)

All new web-projects use TDD with [Bun's built-in test runner](https://bun.sh/docs/cli/test) (`bun test`). No config or `package.json` required.

**Workflow:** When a feature is requested, write failing tests first (RED), then write the minimum code to pass (GREEN), then refactor if needed. Repeat for each feature.

**Tests are documentation.** Every non-visual feature must have corresponding tests. This ensures AI agents always have a complete picture of the project's expected behavior and constraints, not just the implementation.

**Structure:**
- Place test files next to source files: `script.test.js` alongside `script.js`
- Run tests with `bun test` from the project folder
- Tests must pass before a feature is considered complete

**Scope:** Test logic, calculations, data transformations, state management, and any non-visual behavior. Visual/DOM rendering does not need test coverage.


## Adding a New Web Project (full checklist)

1. **Create the project folder** in `web-projects/<slug>/`. Keep it self-contained -- no imports from outside the folder.
2. **Include a `README.md`** in the project folder explaining what the tool is, its features, and how to run it locally. Mandatory for every web-project.
3. **Write tests first** -- follow the TDD workflow above. Set up `script.test.js` (or equivalent) before implementing features.
4. **Add to the portfolio data** -- create `data/projects/<slug>.json` and add its filename to `data/projects/index.json`. See `data/CLAUDE.md` for schema, description style, and skills guidance.
5. **Create ADRs** for any architectural decisions made during development (e.g., choice of algorithm, data structure, rendering approach). Add them to `adr/` and update the ADR index in the root `CLAUDE.md`.
6. **Update this file** -- add the project to the "Existing Projects" list below.
7. **Update `README.md`** (root) -- add the project to the "Web Projects" list.

## Existing Projects

- **ChatGPTPong** -- Classic Pong game generated entirely by ChatGPT (GPT-3.5) in Dec 2022
- **gravity-sandbox** -- Interactive N-body gravitational simulation with slingshot spawning, merging, trails, and presets
- **photo-editor** -- Mobile photo editor with drawing, stickers, filters, and cropping
- **seasonal-color-classifier** -- Color analysis tool that classifies colors into seasonal palettes
- **github-stats-dashboard** -- GitHub repository analytics dashboard with issues, PRs, commits, contributors, and language breakdowns
