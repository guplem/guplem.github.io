# ADR 0012: Red-green TDD for testable logic, DOM rendering exempt

## Context

The repo had roughly 400 Bun tests (399 across 16 files when this ADR was written) and a required CI check (root ADR 0009), plus a documented convention that visual/DOM rendering code is not tested. Nothing, however, required tests to be written first, so logic could still land test-last or untested until review caught it. Merging to `main` deploys the live site immediately.

## Decision

New behaviour in pure logic (web-project game/tool logic, pure JS utility modules such as `js/utils/textCore.js`, data validation, predictor logic) is developed test-first, red-green: a failing Bun test pins the behaviour, then the smallest change makes it pass. Bug fixes in tested areas start with a reproducing test. The DOM exemption stands: rendering/glue code is kept thin and untested, and anything worth testing is pushed into a pure module. The required `test` check on `main` is the enforcement point.

**Rejected alternatives:** mandatory DOM/visual-regression testing (needs a headless browser + snapshot baselines; heavy and brittle for a portfolio site; revisit only if rendering regressions become frequent); coverage thresholds (measure quantity, not behaviour; punish the honest thin-DOM convention).

## Consequences

**Positive:** logic regressions are pinned before fixes; the "extract logic into a testable module" pressure keeps DOM glue thin (the `textCore.js` extraction is the worked example).

**Trade-offs:** test-first is enforceable only by review discipline, since CI sees only the final state; rendering bugs still rely on manual browser checks (the `validate` agent).
