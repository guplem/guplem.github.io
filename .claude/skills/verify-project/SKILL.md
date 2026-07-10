---
name: verify-project
description: Verify the site by running the full Bun test suite, and serve it locally when a change needs visual checking. Use after changing code and before creating a PR.
---

# Verify the site

| Step | Command | Run when |
|---|---|---|
| 1 | `bun test .` | Always. Runs every `*.test.js` in the repo (web-project suites + data validation). Expect all green |
| 2 | `python -m http.server 8000` then open `http://localhost:8000` | The change affects rendering, layout, or a web-project's UI; check the affected page in the browser |

There is no build step and no linter (root ADR 0002); the test suite plus a visual check is the whole verification.

If a test fails on code you did not touch, report it; do not "fix" unrelated code to make the run pass.
