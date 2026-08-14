# guplem.github.io

Personal portfolio website for Guillem Poy, hosted on GitHub Pages at `triunitystudios.com`. Vanilla HTML/CSS/JavaScript -- no build system, no bundler, no framework.

Delegate to these agents at the right moment (each agent's own description says what it does). They fall into two groups, by when they run.

**Before you implement (explore agents, launched as preparation):**

- **pattern-scout**: before implementing any non-trivial feature, and any time you ask "how do we do X here?". Returns real code examples with the rules distilled from them.
- **adr-checker** (consult mode): before implementing in an area an ADR (Architecture Decision Record, a short note on why a design choice was made) covers. The "Architecture Decision Records (ADRs)" section lists them. Returns the decisions the work must follow.

**After you implement, before you ship:**

- **docs-checker**: after a change that could affect documented content. Checks every documentation location (code comments, `README.md` files, `AGENTS.md` files, ADRs) against the code and fixes drift.
- **validate**: just before creating a PR or pushing. Runs the repo's checks the way CI does (`bun test .`) and reports pass or fail.
- **adr-checker** (maintain mode): after you introduce a new architectural pattern or change one an ADR records. Creates or updates the ADR.

Beyond these, spawn subagents freely: hand off research, code exploration, and parallel analysis so the files they read stay out of your own context. Give each subagent one task.

When the user's request is broad or exploratory, ask whether they'd like to run multi-agent research (`/research-agents`) before proceeding.

## Writing style

The people who read your output may read English as a second language and may be new to the area. Two layers apply. This section is the one home for both: no other file restates them.

**Layer 1 covers every piece of prose you write**: chat replies, PR and issue text, review comments, commit messages, and every document below. It follows Zinsser's four principles, which are simplicity, brevity, clarity, and humanity.

- **Short sentences, one idea each.** Use common words. Avoid idioms, slang, and cultural references.
- **Lead with the answer**, then only the detail that changes what the reader does. Cut filler and hedging. Do not use em dashes.
- **Assume a short attention span.** The reader usually skims to make a quick decision (which PR to review, which issue to pick), with little context and little time; put the single most important thing first, and make each part land even if they stop after the first line.
- **Gloss each jargon term, acronym, or tool/library name on first use** in one short clause, or pick a simpler word.
- **Explain a concept briefly before going deeper.** Do not assume a flow, tool, or pattern is already known.
- **Assume junior-level knowledge of the area.** Name the things you reference (files, commands, terms) instead of assuming the reader can guess.

**Layer 2 adds ASD-STE100 on top, for technical documents only**: `AGENTS.md` and area docs, ADRs, `README.md`, skills, subagents, and code comments. ASD-STE100 (Simplified Technical English) is a controlled-English standard from the aerospace industry. A maintenance manual must carry one reading and one only, and these documents have the same job.

- **Active voice only.** Name the actor: "the hook formats the file", not "the file gets formatted".
- **One meaning per word, and the same word for the same thing every time.** Never swap in a synonym for variety.
- **One instruction per sentence, and start the sentence with the verb.** Write "Run the migration", not "The migration should be run".
- **No `-ing` verb form as a noun or as a sentence opener.** Write "Use the skill to create a branch", not "Creating a branch is done with the skill".
- **About 20 words per sentence at most** (25 in descriptive text).
- **Leave out no word that guards the meaning.** Write "the file that you changed" when "the file you changed" could be misread.

Both layers cover prose only. Neither covers code identifiers or text you quote word for word.

## Documentation Structure

**README.md** files are human-facing. **AGENTS.md** (root) and the child **AGENTS.md** files (one per area, each loaded through a one-line `CLAUDE.md` shim) are agent-facing. They are complementary, not overlapping.

| Content | README.md | AGENTS.md |
|---|---|---|
| What the project is, key features | Yes | No |
| How to install, run, deploy | Yes | Only as quick reference |
| Architecture, data flow, layers | No | Yes |
| Coding patterns, conventions, rules | No | Yes |
| Gotchas an agent would hit | No | Yes |
| Adding a new project (full procedure) | No | Yes |
| List of projects/tools (for discoverability) | Yes | Yes (with agent context) |

When adding new content, ask: "Would a human need this to get started?" (README) or "Would an agent need this to avoid breaking patterns?" (AGENTS.md).

### File map

| File | Scope |
|---|---|
| `AGENTS.md` (this file) | Global: architecture, patterns, gotchas, pointers to child docs |
| `data/AGENTS.md` | Portfolio data: schema, description style, skills/tags guidance, adding projects |
| `js/layoutBuilder/AGENTS.md` | Layout modules: responsibilities, data flow, key patterns |
| `js/planetSimulation/AGENTS.md` | Particle simulation: architecture, config, performance |
| `web-projects/AGENTS.md` | Web projects: conventions, TDD with Bun, full checklist for adding a new web-project |
| `web-projects/rps-mind-reader/AGENTS.md` | rps-mind-reader: predictor architecture + contracts, R&D workflow, strategies tried/rejected |
| `web-projects/prime-sieve-arcs/AGENTS.md` | prime-sieve-arcs: the measured reference frames as spec, the scanner and pen model, geometry gotchas |
| `adr/*.md`, `web-projects/*/adr/*.md` | Architecture Decision Records: why behind key choices (root = main-site/cross-cutting; per-project = project-specific) |
| `README.md` (root) | Human-facing: what the site is, how to run locally, project list |
| `web-projects/*/README.md` | Human-facing: per-project features, how to run |
| `CLAUDE.md` (root + each area) | One-line `@AGENTS.md` shim so Claude Code loads the sibling map on demand; never edit it |
| `.claude/skills/*/SKILL.md` | On-demand procedures (how to do X); load only when the task matches |

**All of these files are living: keep them true.** When you learn something that helps future agents, update the right file in the same session. When a file holds wrong or outdated information, fix it or remove it. This covers code comments too. After implementation, the **docs-checker** agent catches drift you missed.

## Development

**No build step.** Serve files locally with any HTTP server:
```bash
python -m http.server 8000
```
No linter or package manager for the main site. Web-projects use Bun's test runner (`bun test`) for their pure logic -- see `web-projects/AGENTS.md`.

**CI:** `.github/workflows/test.yml` runs `bun test .` (the whole suite: web-projects tests, the data validation test, the `textCore` tests, and the SEO-artifact drift tests in `scripts/`) on every pull request and push to `main`, and it is a required status check on `main` -- a PR with a failing test cannot be merged. Keep tests green; a new web-project's tests are picked up automatically. See ADR 0009.

Whenever you need to confirm the code still passes, delegate to the `validate` agent (it runs the checks the way CI does).

## Architecture

### Data-Driven Content

All portfolio content lives in JSON files -- never edit HTML to change content:
- `data/info.json` -- Site metadata, personal info, contact details
- `data/projects/index.json` -- Manifest of all project filenames
- `data/projects/*.json` -- One file per portfolio project (conforms to `data/schemas/project.schema.json`)

See `data/AGENTS.md` for field reference and detailed guidance.

`js/layoutBuilder/dataFiller.js` orchestrates page rendering at load time, delegating to focused modules. `textUtils.fetchAllWorks()` loads all projects from the manifest.

### JavaScript Module System

All JS uses ES6 modules (`type="module"` with `defer`). Key modules:

| Directory | Purpose |
|---|---|
| `js/layoutBuilder/` | Content generation -- see `js/layoutBuilder/AGENTS.md` for module breakdown |
| `js/planetSimulation/` | Canvas-based interactive particle physics background (120 particles, gravity, collisions) |
| `js/utils/` | `textCore.js` (pure text/filter helpers, Bun-tested), `textUtils.js` (fetch + markdown->HTML via marked, re-exports `textCore`), `uiUtils.js` (DOM helpers) |

### CSS Structure

- `css/global/variables.css` -- Design tokens: palette (`--bg-dark`, `--accent`, `--accent-secondary`), spacing, typography, shadows, radii, transitions
- `css/global/layout.css` -- Navigation, section containers, scroll-reveal animations
- `css/global/base.css` -- Base typography
- `css/sections/` -- Per-section styles (hero, works, about, contact, additional)

### Web Projects

`web-projects/` contains standalone mini-apps -- small games, tools, and experiments, often AI-generated. Each project is fully self-contained (own HTML/CSS/JS) with no shared dependencies with the main portfolio site -- except the `web-projects/index.html` directory index, which is data-driven and reuses the site's global CSS (see ADR 0008). See `web-projects/AGENTS.md` for detailed guidance when working there.

## Key Patterns and Gotchas

**External CDN dependency:** `marked` is imported via `esm.sh` CDN -- no local node_modules. Network failure breaks markdown rendering.

**Self-hosted font:** the Inter font is self-hosted at `resources/fonts/InterVariable.woff2` (not Google Fonts). Every HTML page that uses the site font must include both a `<link rel="preload" ... as="font" ... crossorigin>` for it and a link to `css/global/fonts.css`. `scripts/fontSelfHosted.test.js` enforces this.

**Caching:** Both JSON fetches and markdown->HTML conversions are cached in `Map` objects. Clear browser cache after updating data files during development.

**Filter normalization:** `idFromText()` in `textUtils.js` strips punctuation/spaces/special chars and capitalizes -- used for element IDs and type/skill button filter matching. Must be consistent across button-based filter code. The free-text work search (`workMatchesText` in `textUtils.js`) intentionally does NOT use `idFromText()` -- it matches raw lowercase substrings so users can type naturally.

**Masonry layout:** Work cards use JS-based column balancing (not CSS Grid). `displayFilteredWorks()` recalculates on resize (debounced 100ms).

**Generated SEO artifacts (never hand-edit):** `sitemap.xml` and the `<!-- BEGIN GENERATED:<NAME> -->` ... `<!-- END GENERATED:<NAME> -->` blocks in `index.html` and `web-projects/index.html` are derived from `data/` by `bun scripts/generateSitemap.js` and `bun scripts/generateSeoBlocks.js` (see ADR 0010). After any edit to `data/info.json` or `data/projects/*.json`, run both scripts (automatic with the lefthook pre-commit hook); CI drift tests fail otherwise. The static head metadata in `index.html` (title/description) must stay identical to `web-title`/`web-description` in `data/info.json` (enforced by a drift test in `scripts/generateSeoBlocks.test.js`).

**Adding a new project:** For web-projects, use the `/add-web-project` command -- it automates the full scaffolding checklist. For other projects, see `data/AGENTS.md` for the data-only steps.

## Test-Driven Development (mandatory for testable logic)

New behaviour in pure logic is developed **test-first, red-green**: write a failing Bun test that pins the behaviour you want (**red**), make it pass with the smallest change (**green**), then clean up with the test as your safety net. Bug fixes in tested areas start with a test that reproduces the bug.

- Applies to all pure logic: web-project game/tool logic, `js/utils/textCore.js`-style modules, data validation, predictor logic. `web-projects/AGENTS.md` holds the per-project test checklist.
- The existing exemption stands: visual/DOM rendering code does not need test coverage. Keep DOM glue thin and push anything worth testing into a pure module so it is testable.
- The gate: CI runs `bun test .` on every PR and the `test` check is required on `main` (root ADR 0009), so red tests cannot merge. Rationale: `adr/0012-red-green-tdd-for-testable-logic.md`.

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
| [0005](adr/0005-cdn-for-dependencies.md) | esm.sh CDN for the marked JS dependency; fonts are self-hosted, not CDN-loaded |
| [0006](adr/0006-url-as-state-for-web-projects.md) | URL query params as source of truth for shareable web-projects |
| [0007](adr/0007-localstorage-for-private-session-persistence.md) | localStorage for private-session persistence in web-projects |
| [0008](adr/0008-web-projects-index-from-portfolio-data.md) | Web-projects index page derived from portfolio data (not self-contained) |
| [0009](adr/0009-github-actions-ci-for-bun-tests.md) | GitHub Actions CI runs the full Bun test suite on pull requests |
| [0010](adr/0010-pre-commit-generated-static-seo-content.md) | Pre-commit generated static SEO content (sitemap + HTML fallback blocks) |
| [0011](adr/0011-agent-docs-structure.md) | AGENTS.md root map + shim, skills, area docs are AGENTS.md + CLAUDE.md shim pairs |
| [0012](adr/0012-red-green-tdd-for-testable-logic.md) | Red-green TDD mandatory for pure logic; DOM rendering exempt |

### Per-project ADRs

| ADR | Topic |
|---|---|
| [taboo-game 0001](web-projects/taboo-game/adr/0001-deterministic-multiplayer-without-server.md) | Deterministic multiplayer without a server |
| [liga-under-tkd 0001](web-projects/liga-under-tkd/adr/0001-google-sheet-as-database.md) | Google Sheet as the live database via gviz |
| [rps-mind-reader 0001](web-projects/rps-mind-reader/adr/0001-custom-statistical-predictor-no-ml-library.md) | Custom statistical predictor instead of an ML library |
| [rps-mind-reader 0002](web-projects/rps-mind-reader/adr/0002-predictor-evaluation-methodology.md) | Predictor evaluation methodology: switching battery + held-out real sessions |
| [street-name-history 0001](web-projects/street-name-history/adr/0001-federated-geodata-sources.md) | Federate Nominatim + Wikidata + OpenHistoricalMap client-side; Nominatim (not Overpass) as sole OSM tag source |
| [prime-sieve-arcs 0001](web-projects/prime-sieve-arcs/adr/0001-reference-frame-measured-as-the-spec.md) | Recover the construction by measuring the reference frame, and keep that frame as the spec |
| [prime-sieve-arcs 0002](web-projects/prime-sieve-arcs/adr/0002-redraw-every-frame-zooming-camera.md) | Redraw every frame because the camera zooms out, so any frame can be drawn directly |

**Create a new ADR** when making an architectural decision with trade-offs worth preserving. A decision specific to one web-project goes in that project's `adr/` (next per-project number); a main-site or cross-cutting decision (including web-project-wide patterns like URL-as-state or localStorage) goes in root `adr/` (next global number).

**Keep ADRs current.** When a change affects an existing decision, update the relevant ADR. ADRs are living: when a change affects a decision, update its ADR in place so it always describes the current design. Do not create successor ADRs or "superseded by" chains; history lives in git. Both index tables above must reflect the contents of `adr/` and every `web-projects/*/adr/`.

## GitHub Issues, PRs, and Other Artifacts

- **Always self-assign PRs** when creating them.
- **Always link PRs to issues** using `Closes #N` in the PR body so issues auto-close on merge.
- **Always add the `waiting-for-human-check` label** when creating GitHub issues, pull requests, or any other reviewable artifact. This signals that no human has verified the content yet -- it is direct AI output. Once a human reviews it, the label is removed. The label communicates state (unreviewed), not origin.

If the repository does not have a `waiting-for-human-check` label, create it first:
```bash
gh label create "waiting-for-human-check" --description "No human has verified this yet -- direct AI output" --color "D93F0B"
```

Whenever you create a GitHub issue, use the `create-issue` skill. Whenever you implement one, use the `implement-issue` skill. Whenever you review a PR, use the `review-pr` skill.

## Git Workflow

- Branch from `main`, PR back to `main` (merging deploys the live site via GitHub Pages). **Never push to `main`.** Whenever you create a branch, use the `create-branch` skill.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`. Whenever you commit, use the `write-commit` skill.
- CI runs `bun test .` on every PR; the `test` check is required on `main`, so a PR with failing tests cannot merge.
- **PRs merge automatically, with no human review gate.** `auto-merge.yml` flags every non-draft PR for GitHub auto-merge, repo-wide, so a PR merges the moment the required `test` check passes. The tests are the review, which is what makes the TDD protocol above non-negotiable. This flow fits how most work here is produced: fast, AI-generated ("vibe-coded") changes, concentrated in `web-projects/` but not limited to it. The rule does not depend on who wrote the code: a hand-coded project can live in `web-projects/`, and a vibe-coded change can land elsewhere; either way a green `test` check is the only gate. The `waiting-for-human-check` label still marks a PR as unverified but does not block the merge. Open a PR as a draft if you do not want it to merge yet.

## Refactoring Safety

Whenever you rename or refactor a symbol, use the `rename-symbol` skill.

## Debugging

Whenever a fix attempt fails or a bug needs root-causing, use the `debug` skill.

## Writing Prompts for Agents and Rules

Whenever you author or edit an AI-facing file (root `AGENTS.md`, the child `AGENTS.md` files, skills under `.claude/skills/`, subagents under `.claude/agents/`, spawned-agent prompts), use the `write-ai-instructions` skill.

## Self-Updating Rules

Whenever you discover something **extremely hard to find, deeply non-obvious, and time-saving for future sessions**, hit a pattern that **diverges from what an AI would write by default**, the user says **"every time" / "always" / "never"**, or **feedback on your own work reveals a standard you should have followed** (a PR review comment, a user correction, a failed check), persist it immediately (narrowest scope that fits: the relevant child `AGENTS.md` over this file when it is area-specific) instead of applying it only this session. Persist it in these shared, committed files, never in personal memory or the global config, so the whole team gets the lesson. For where to write it, use the `write-ai-instructions` skill.

## Deployment

GitHub Pages with custom domain (`CNAME` -> `triunitystudios.com`). HTTPS is enforced by GitHub Pages itself (repository Pages settings), not by any file in the repo. Push to `main` deploys automatically. There is no server-side routing; every URL maps directly to a file.
