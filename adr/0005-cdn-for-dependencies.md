# ADR 0005: CDN for Third-Party Dependencies

## Context

The project needs a markdown parser and fonts (Google Fonts). Without a package manager (see ADR 0002), these cannot be installed locally via npm.

Options:
- Vendor the library files into the repo
- Use a CDN at runtime
- Add a package manager just for this dependency

## Decision

Import third-party ES modules from `esm.sh` CDN using standard `import` statements with pinned versions. Google Fonts are loaded via their standard CDN.

The markdown library was specifically chosen for performance. `marked` was selected over heavier alternatives (unified/remark/rehype) because it is a single lightweight package. The import uses the pre-built ES2022 bundle (`marked@17.0.5/es2022/marked.bundle.mjs`) to minimize parse time and avoid additional network requests for sub-dependencies.

**Rejected alternative:** adding a package manager just for this dependency, or vendoring the library files into the repo. A package manager reintroduces the build tooling ADR 0002 avoids; vendored copies must be updated by hand and lose the caching benefit of a pinned CDN URL.

## Consequences

**Positive:**
- No local `node_modules/`, no `package.json`, consistent with the no-build-system decision.
- Pinned versions prevent surprise breakage from upstream updates.
- CDN caching benefits returning visitors.
- The pre-built bundle loads faster than importing the default entry point (which may trigger sub-dependency fetches).

**Negative:**
- Runtime dependency on external CDNs. If `esm.sh` goes down, markdown rendering fails silently (descriptions render as raw markdown text).
- No offline development without browser cache.
- Version upgrades require finding and updating URL strings in source code rather than running `npm update`.
