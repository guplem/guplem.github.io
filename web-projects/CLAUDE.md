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


## Adding a New Web Project

**Use the `/add-web-project` command.** It automates the full scaffolding checklist. This command must be used whenever creating a new web-project.

## Existing Projects

- **ChatGPTPong** -- Classic Pong game generated entirely by ChatGPT (GPT-3.5) in Dec 2022
- **gravity-sandbox** -- Interactive N-body gravitational simulation with slingshot spawning, merging, trails, and presets
- **photo-editor** -- Mobile photo editor with drawing, stickers, filters, and cropping
- **seasonal-color-classifier** -- Color analysis tool that classifies colors into seasonal palettes
- **github-stats-dashboard** -- GitHub repository analytics dashboard with issues, PRs, commits, contributors, and language breakdowns
- **random-option-picker** -- Slot-machine style random picker with shareable URLs and reproducible seeds (TDD-covered, mulberry32 PRNG)
- **taboo-game** -- Deterministic multiplayer Taboo game with no server; every client derives the same state from shared seed + turn (TDD-covered, see ADR 0007)
