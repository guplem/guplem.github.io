# ADR 0013: GitHub Actions CI to Run Bun Tests on Pull Requests

## Context

The repository has a test suite (Bun's built-in runner) covering the pure logic
of several web-projects and the web-projects index. Until now nothing ran these
tests automatically: a pull request could change a tested module, break a test,
and still be merged, because the only signal was a contributor remembering to run
`bun test` locally. A real example existed on `main` when this ADR was written --
a stale test in `random-option-picker` had been failing since the
"ensure-distinct toggle" change (commit `ca6bc08e`) and no one noticed.

The goal is to block merging any pull request whose changes make tests fail. A
reference monorepo solves this by detecting which sub-project changed and running
only that project's tests, plus per-service toolchains and deployment gating. That
complexity is justified there (many languages, slow real-LLM tests, deployments)
but not here.

Options considered:

1. **Per-project change detection.** Use `git diff` to find which
   `web-projects/<project>/` folders changed and run only those suites (mirrors
   the reference repo and the local `validate` agent).
2. **Run the whole suite on every pull request.** One job runs
   `bun test .`, which discovers and runs every `*.test.js`.

## Decision

A single GitHub Actions workflow (`.github/workflows/test.yml`) runs the **entire**
test suite on every pull request and on pushes to `main`. It installs Bun and runs
`bun test .`. If any test fails, the job fails.

- **Run-all, not change-detection.** The full suite is ~266 tests across 10 files
  and finishes in well under a second with no install step (no `package.json`;
  Bun's built-in runner). Change-detection would add path-matching logic and a
  job matrix to save a fraction of a second, and it would miss failures when a
  change in the main portfolio data breaks a web-project test (the index's
  `discovery.js` reads `data/projects/*.json`). Running everything is both simpler
  and safer here.
- **Enforced as a required status check.** Branch protection on `main` marks this
  check as required, so a pull request cannot be merged while a test fails. The
  workflow alone only reports a pass/fail; the branch rule is what blocks the merge.
- **Test-only, no build step.** The workflow runs tests; it never builds, bundles,
  or deploys. Deployment stays the plain GitHub Pages push-to-`main` flow
  (ADR 0002). Bun is a dev/test tool inside the runner, not a runtime or browser
  dependency (unrelated to ADR 0005's CDN imports).

## Consequences

**Positive:**

- A pull request that breaks any test is blocked from merging -- the stated goal.
- One short workflow file, nothing to maintain per project. A new web-project's
  tests are picked up automatically, the same way `bun test .`
  discovers them locally.
- Catches cross-cutting breakage (a main-portfolio change breaking a web-project
  test), which change-detection would miss.
- The suite now also validates every `data/projects/*.json` file against
  `data/schemas/project.schema.json` (via `data/projects.test.js`), so a
  malformed data file is blocked from merging instead of reaching production.

**Negative:**

- Every pull request runs the full suite even for an unrelated one-line change.
  Acceptable: the suite runs in under a second and needs no dependency install.
- The check depends on GitHub Actions and the `oven-sh/setup-bun` action being
  available; an outage blocks merges until it recovers.
- Branch protection must be configured in repository settings (it is not stored in
  the repo), so this enforcement is not reproduced automatically on a fork.

## Scope

Specific to running this repository's tests in CI. The reusable principle --
**when the full suite is cheap, run all of it on every change instead of building
change-detection machinery** -- applies to future test or check additions; revisit
only if the suite grows slow enough that selective runs would meaningfully help.
