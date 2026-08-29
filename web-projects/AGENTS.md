# web-projects/AGENTS.md

> **SCOPE:** These rules apply when working on files under `web-projects/`. Each project inside is self-contained and independent from the main portfolio site -- except the `index.html` directory index (see "The Index Page" below).

## Overview

Collection of small, standalone web projects -- games, tools, experiments, demos. Often AI-generated. Each is fully self-contained and independent from the main portfolio site, except the directory index (`index.html`) described below.

## Conventions

- **One folder per project** -- all assets live inside the project folder
- **Self-contained** -- own HTML, CSS, JS. No shared dependencies with the main site or other projects
- **No build tools, no frameworks** -- vanilla HTML/CSS/JS preferred
- **Works standalone** -- each project should work by opening its HTML file directly or via any HTTP server

## The Index Page (`index.html`)

`web-projects/index.html` is the landing page for `https://triunitystudios.com/web-projects/`. It is the **one deliberate exception** to the self-contained rule above: it is a portfolio-level directory index, so it reads the portfolio data (`../data/projects/*.json`) and reuses the site's global tokens (`../css/global/variables.css`, `../css/global/base.css`). See ADR 0008.

- **Never hardcode the project list.** It is derived live: a project is listed when it has a link that is **not** `type: "github"` whose URL (after stripping the `triunitystudios.com` origin) starts with `web-projects/`. Adding such a project to the portfolio data makes it appear here automatically.
- The grid also carries a **generated static fallback block** between `GENERATED:WEB-PROJECTS` markers so crawlers see the list without JS (root ADR 0010). Never hand-edit it; regenerate with `bun scripts/generateSeoBlocks.js`. The static cards mirror the `app.js` card markup exactly; at load `app.js` **adopts** them when their text matches the live-derived cards (wiring search to them, no entrance-animation replay) and only swaps them when they drift.
- **Mirror sync rule (nothing enforces this automatically):** `createProjectCard()` in `app.js` and `buildWebProjectsIndexHtml()` in `scripts/generateSeoBlocks.js` must produce the same cards. A TEXT mismatch triggers the swap (flicker returns, a `console.warn` fires). A MARKUP-only mismatch is silent and worse: the old static markup gets adopted and the `app.js` change never appears on load. Change both together and regenerate.
- The fragile matching/selection logic is pure and Bun-tested in `discovery.js` / `discovery.test.js`; `app.js` only fetches and renders. Keep new logic in `discovery.js` with tests.
- Do **not** make individual projects depend on the index, and do not import the index's files into a project.

## The "deployed at" footer (recommended for new projects)

Every new web-project should end with a footer line saying when it was last
deployed and which pull request deployed it, linked. There is no build step to
stamp that in, so the page works it out at load, from three sources, best first:
the pull request that last touched the project's folder (GitHub API), the commit
that did (GitHub API), and the `Last-Modified` header of the page itself
(same-origin, so nothing throttles it). Root ADR 0013 holds the reasoning and the
rules it must follow.

To add it, copy two files from `sudoku-screenshot-coach`:

- `deployInfo.js` -- pure: builds the URLs, parses the responses, ranks the
  sources, formats the date. Copy its tests too.
- `deployFooter.js` -- the only file that fetches, caches and draws. Call
  `startDeployLine(element, "web-projects/<slug>", ...)` at the end of start-up.
  Copy its tests too: it takes the element, the message lookup and the escaper as
  arguments, so stubs for `fetch`, `localStorage` and `location` test it fully.

Rules that matter:

- **Never await it and never let it throw**, and **never let it go blank**. Those
  are two different rules. A player reported the footer as missing when it was
  merely empty, because a blank line and an absent feature look the same. Always
  draw something: the date from the page's own headers at worst, and a link to
  the folder's commit history.
- **Keep the six-hour `localStorage` cache, and cache refusals for fifteen
  minutes.** Anonymous callers get 60 calls an hour per address and each page
  load needs two. Without the short negative cache a visitor who runs out spends
  two more on every reload and never recovers.
- **Do not promise more than is true.** A page that says it does everything
  locally must word that precisely once it calls an API for its footer.

**When a third project adopts this, promote it** to a shared module under
`web-projects/` and record the exception to the self-contained rule in an ADR,
the way the directory index did. Two copies is cheaper than a new exception;
four copies is not.

## Architecture Decision Records (ADRs)

A decision specific to one web-project lives in that project's own `adr/` folder (`web-projects/<project>/adr/`), **numbered per project from `0001`** -- not in the root `adr/`. Cross-cutting web-project patterns (e.g. URL-as-state, localStorage) and main-site decisions stay in root `adr/`.

Reference convention so per-project numbers stay unambiguous: inside a project, `ADR 000N` means that project's own ADR; a root ADR is written `root ADR 00NN`; links always use the full path (which includes the project). The root `AGENTS.md` keeps a master index of every ADR (root and per-project).

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

- **sudoku-screenshot-coach** -- Reads a sudoku out of a screenshot that holds other things too, then explains the next best move with the technique a human player would use, in English or Spanish. Own computer-vision pipeline (no OCR library) that ignores pencil marks and repairs misreadings with the rules of sudoku; 23 solving techniques with generated justifications, including chains and the two that argue from the puzzle having a single answer; carries the "deployed at" footer described above (TDD-covered, see sudoku-screenshot-coach ADR 0001-0007 and root ADR 0013)
- **whatsapp-no-contact** -- Opens a WhatsApp chat with any phone number, with no saved contact, by building an `api.whatsapp.com/send` link. Holds a searchable 227-country dial-code list, the trunk-zero and E.164 rules, URL state and a localStorage recents list, all in TDD-covered pure modules (see root ADR 0006 and 0007)
- **prime-sieve-arcs** -- The Sieve of Eratosthenes as a canvas animation: each prime hops over its multiples in glowing half-circle arcs, and the numbers no hop lands on are the primes. The art style was measured out of a committed reference frame, which is the spec (TDD-covered pure logic, see prime-sieve-arcs ADR 0001 and 0002)
- **street-name-history** -- Search any street to see all its names across languages, its former names, and its etymology; federates OpenStreetMap (Nominatim), Wikidata, and OpenHistoricalMap client-side (TDD-covered pure modules, see street-name-history ADR 0001)
- **ChatGPTPong** -- Classic Pong game generated entirely by ChatGPT (GPT-3.5) in Dec 2022
- **gravity-sandbox** -- Interactive N-body gravitational simulation with slingshot spawning, merging, trails, and presets
- **photo-editor** -- Mobile photo editor with drawing, stickers, filters, and cropping
- **seasonal-color-classifier** -- Color analysis tool that classifies colors into seasonal palettes
- **github-stats-dashboard** -- GitHub repository analytics dashboard with issues, PRs, commits, contributors, and language breakdowns
- **random-option-picker** -- Slot-machine style random picker with shareable URLs and reproducible seeds (TDD-covered, mulberry32 PRNG)
- **taboo-game** -- Deterministic multiplayer Taboo game with no server; every client derives the same state from shared seed + turn (TDD-covered, see taboo-game ADR 0001)
- **liga-under-tkd** -- Live taekwondo tournament site; reads a shared Google Sheet via the gviz endpoint and computes standings/combats/profiles in CA/ES/EN (TDD-covered pure modules, see liga-under-tkd ADR 0001)
- **rps-mind-reader** -- Rock-paper-scissors against an adaptive AI that learns your patterns (a Bayesian mixture of variable-order context models weighted by predictive log-likelihood, each voting for the expected-value-optimal counter; algorithm chosen and guarded by `benchmark.js`, a dev-only opponent-battery harness); state persists in localStorage, with a statistics page charting win/loss/tie trends and AI prediction confidence over time (TDD-covered, see root ADR 0007 and rps-mind-reader ADR 0001)
