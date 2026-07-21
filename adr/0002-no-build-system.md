# ADR 0002: No Build System

## Context

GitHub Pages serves static files directly -- it renders `index.html` and serves assets as-is, with no server-side build step. There is no built-in support for bundlers, transpilers, or package managers at deploy time (unless you add a CI pipeline like GitHub Actions).

This project also hosts multiple standalone sub-projects under `web-projects/`. A build system would complicate this multi-project structure, requiring either a monorepo build tool or per-project build configs.

Options considered:
- Add a bundler (Webpack, Vite) with a GitHub Actions CI step
- Use a static site generator (Jekyll, which GitHub Pages supports natively)
- Stay with raw HTML/CSS/JS and no build step

## Decision

No build system, no bundler, no package manager. ES6 modules are used natively (`type="module"`). Third-party dependencies are loaded from CDN (`esm.sh`) instead of installed locally. Each sub-project in `web-projects/` is self-contained raw HTML/JS/CSS.

This is the simplest approach that supports hosting multiple independent sub-projects on a single GitHub Pages site with no build step in the deploy pipeline. (A separate, test-only CI workflow runs `bun test` on pull requests and pushes to `main` -- see ADR 0009 -- but it never builds or deploys, so the deploy pipeline stays build-free.)

**Rejected alternative:** a bundler (Webpack, Vite) with a CI build step, or a static site generator such as Jekyll. Rejected because a build step complicates hosting many independent sub-projects and adds dev-tooling dependencies and security advisories that a raw static site never carries.

## Consequences

**Positive:**
- Zero configuration. Clone and serve. GitHub Pages deploys the repo as-is.
- Adding a new sub-project is just a folder with HTML files -- no build config needed.
- No dependency updates, no security advisories for dev tooling.
- Any HTTP server works for local development.

**Negative:**
- No tree-shaking, minification, or bundle optimization.
- CDN dependencies (`esm.sh`) are a runtime single point of failure. If the CDN is down, markdown rendering breaks.
- No TypeScript, no JSX, no CSS preprocessing.
- Cannot use npm packages that require a bundler or Node.js APIs.

> **Note (2026-07):** a commit-time generation step now exists: Bun scripts under `scripts/` regenerate committed SEO artifacts (`sitemap.xml` and static HTML fallback blocks), kept in sync by CI drift tests and, locally, an optional lefthook pre-commit hook. The deploy pipeline itself stays build-free, but "clone and serve" gains an optional tooling step for content edits. See ADR 0010.
