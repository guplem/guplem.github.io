# ADR 0010: Pre-Commit Generated Static SEO Content

## Context

By mid-2026 Google had indexed almost nothing of the current site. A `site:triunitystudios.com` search returned the homepage plus dead pages from a pre-2021 version; no current web-project was indexed. The cause: the raw `index.html` served to crawlers contained no name, no project titles, and no descriptions -- everything was injected by JS at load time from ~70 JSON fetches plus the `marked` CDN import (ADR 0001, ADR 0005). Google renders JavaScript only in a deferred second pass with time budgets, unreliably for low-traffic sites; other crawlers render even less. The old static-HTML pages had been indexed completely, proving static markup is what works. `sitemap.xml` listed only the homepage, and the work cards used `window.open()` click handlers crawlers cannot follow.

Options considered:

1. **Do nothing / rely on Google's JS rendering.** Demonstrably failing.
2. **Move to a static site generator.** Rejected: reverses ADR 0002 for a problem that only affects crawlers.
3. **Generate crawler-facing static artifacts from the JSON at commit time.** Keeps JSON as the single hand-edited source of truth (ADR 0001) and the deploy pipeline build-free (ADR 0002).

## Decision

Two Bun scripts under `scripts/` regenerate committed, derived, crawler-facing artifacts from `data/`:

- **`scripts/generateSitemap.js`** rewrites `sitemap.xml`: homepage, `/web-projects/`, and one URL per locally hosted web-project (detected by reusing the pure `localWebProjectPath` from `web-projects/discovery.js`, per ADR 0008).
- **`scripts/generateSeoBlocks.js`** rewrites static HTML fallback blocks between `<!-- BEGIN GENERATED:<NAME> -->` / `<!-- END GENERATED:<NAME> -->` marker comments: hero, about, works grid, and additional sections in `index.html`, and the card list in `web-projects/index.html`. Three fidelity levels, chosen by whether users can see the swap:
  1. **Exact mirror, adopted** -- the hero and the web-projects cards mirror the dynamic markup exactly (same tags, classes, and stagger delays; inline markdown converted by `markdownToInlineHtml`), and the runtime **adopts** them when their text matches the freshly built version, so above-the-fold entrance animations play once on the static markup and never replay (no flicker).
  2. **Structured, swapped** -- the about and additional-sections blocks carry the real structure (headings, paragraphs, links, bold via `markdownToBlockHtml`; the additional sections also reuse the existing `section-label`/`additional-grid` classes so the fallback is styled) but are cleared and replaced by the JS render at load, which is invisible: about sits behind the scroll-reveal and the additional sections are below the fold. The printed additional sections always place the image before the text; the dynamic alternating order is a runtime visual concern, like the masonry.
  3. **Plain, swapped** -- the works block is plain markup (markdown stripped by the pure `markdownToPlainText` in `js/utils/textCore.js`), below the fold.

  No block replicates the JS masonry layout (ADR 0004) or sets element ids; on fetch failure every static fallback stays visible.

Both scripts export pure builders and write only under `import.meta.main`, so tests can import them without side effects.

**Enforcement is the CI drift test, not the hook.** `scripts/generateSitemap.test.js` and `scripts/generateSeoBlocks.test.js` assert the committed files exactly match freshly generated output; `bun test .` in CI (ADR 0009) fails on any drift, including commits made with `--no-verify` or without hooks installed. A root `lefthook.yml` pre-commit command is the local convenience: it regenerates and stages the artifacts whenever `data/` or `scripts/` files are staged. `lefthook` is a dev-only tool (like Bun, per the ADR 0009 carve-out), installed as a standalone binary (`winget install evilmartians.lefthook` / `brew install lefthook`, then `lefthook install`); there is no `package.json` to pin it, which is acceptable because nothing breaks when it is absent -- CI catches the drift.

This ADR qualifies (does not supersede) ADR 0001, ADR 0002, and ADR 0008; each carries a note pointing here.

## Consequences

**Positive:**

- Every crawler sees the name, about text, full project list, descriptions, and real links in the raw HTML, with zero JavaScript executed. SEO no longer depends on the esm.sh CDN.
- Users see readable content before JS loads; a failed fetch degrades to the static fallback instead of an empty page.
- The sitemap can never go stale silently: adding a web-project to the data updates it (or CI fails).

**Negative:**

- `index.html`, `web-projects/index.html`, and `sitemap.xml` now contain generated regions that must never be hand-edited; content edits in `data/` require running the generators (automatic with lefthook, otherwise CI fails with the fix command in the test name).
- The mirror contract between the two renderers (hero: `dataFiller.js` render vs `buildHeroHtml`; cards: `createProjectCard()` vs `buildWebProjectsIndexHtml()`) is enforced only by convention, code comments, and AGENTS.md rules -- no test compares them (the JS side needs a DOM and the CDN `marked`, unavailable under `bun test` without new dependencies). The runtime signals: a text mismatch falls back to the swap (correct content, flicker returns, `console.warn` fires); a markup-only mismatch is silent -- the adopted static copy masks the JS change on load.
- ADR 0002's "clone and serve" gains an optional tooling step for contributors who edit content.
- A commit-time generation step is a build step in disguise, just moved off the deploy pipeline; the derived HTML is duplicated data that exists only because crawlers need it.
