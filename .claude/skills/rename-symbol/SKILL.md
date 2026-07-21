---
name: rename-symbol
description: Rename or refactor a symbol safely by searching every naming-case variant across code, tests, docs, configs, and JSON. Use when renaming any identifier so no reference is missed.
---

# Rename a symbol safely

When you rename or refactor any symbol, search **all** naming variants (camelCase, PascalCase, snake_case, kebab-case, UPPER_CASE) across the whole project (code, tests, docs, configs, and JSON), not just the obvious code references. This repo has no compiler, so a missed variant does not fail a build: it loads fine and then breaks at runtime in the browser. A missed variant in a config key or a data file is the usual cause.

Extra traps in this repo:

- **JSON data keys in `data/` are a schema.** Portfolio project fields conform to `data/schemas/project.schema.json`. Renaming a field means updating the schema, every `data/projects/*.json` file, and the rendering code together (the CI data-validation test catches drift).
- **Generated SEO artifacts must be regenerated, never hand-edited.** `sitemap.xml` and the `<!-- BEGIN GENERATED:<NAME> -->` ... `<!-- END GENERATED:<NAME> -->` blocks in `index.html` and `web-projects/index.html` derive from `data/` (root ADR 0010). If a renamed name feeds them, re-run `bun scripts/generateSitemap.js` and `bun scripts/generateSeoBlocks.js`, then confirm no stale name remains (CI drift tests fail otherwise).
- **CDN and global names are matched by string.** `marked` is imported by name via the esm.sh CDN (root ADR 0005); a rename there must match the import. Filter IDs are derived: `idFromText()` in `js/utils/textUtils.js` strips punctuation/spaces and capitalizes to build element IDs and filter matches, so renaming a type or skill string changes its derived ID everywhere it is matched.
- **Persisted keys are storage, not just code.** localStorage keys in web-projects hold real user data (root ADR 0007); renaming the code symbol is safe, but renaming the stored key breaks existing data and needs an explicit migration.
- **Web-projects are self-contained.** A rename inside one web-project must not reach into another project or the main site (except the shared index page, root ADR 0008).
