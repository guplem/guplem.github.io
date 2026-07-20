# ADR 0005: CDN for Third-Party Dependencies

## Context

The project needs a markdown parser. Without a package manager (see ADR 0002), it cannot be installed locally via npm.

Options:
- Vendor the library files into the repo
- Use a CDN at runtime
- Add a package manager just for this dependency

## Decision

Import third-party ES modules from `esm.sh` CDN using standard `import` statements with pinned versions. Fonts are self-hosted (see `css/global/fonts.css`) instead of loaded from Google Fonts, to avoid a render-blocking cross-origin request and to greatly reduce the cold-cache flash of unstyled text (FOUT) the hero showed, by making the font arrive before paint on most loads.

The markdown library was specifically chosen for performance. `marked` was selected over heavier alternatives (unified/remark/rehype) because it is a single lightweight package. The import uses the pre-built ES2022 bundle (`marked@17.0.5/es2022/marked.bundle.mjs`) to minimize parse time and avoid additional network requests for sub-dependencies.

**Rejected alternative:** adding a package manager just for this dependency, or vendoring the library files into the repo. A package manager reintroduces the build tooling ADR 0002 avoids; vendored copies must be updated by hand and lose the caching benefit of a pinned CDN URL.

## Consequences

**Positive:**
- No local `node_modules/`, no `package.json`, consistent with the no-build-system decision.
- Pinned versions prevent surprise breakage from upstream updates.
- The `esm.sh` CDN caches `marked` for returning visitors. Self-hosted fonts carry no such CDN dependency: they are served from the site's own origin, so they cannot fail from a third-party outage.
- The pre-built bundle loads faster than importing the default entry point (which may trigger sub-dependency fetches).

**Negative:**
- Runtime dependency on the `esm.sh` CDN for `marked`. If `esm.sh` goes down, markdown rendering fails silently (descriptions render as raw markdown text). The self-hosted font has no such risk.
- No offline development without browser cache (applies to `marked`; the self-hosted font works offline).
- Version upgrades require finding and updating URL strings in source code rather than running `npm update`.
