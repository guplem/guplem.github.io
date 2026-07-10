---
name: rename-symbol
description: Safely rename or refactor a symbol by searching every naming-case variant in code, tests, docs, and JSON data. Use when renaming any identifier so no reference is missed.
---

# Rename a symbol safely

When renaming or refactoring any symbol, search **all** naming variants (camelCase, PascalCase, snake_case, kebab-case, UPPER_CASE) across the entire project (including tests, docs, and every JSON file under `data/`), not just the obvious code references. A missed variant is the usual cause of a rename that loads but breaks at runtime.

Extra traps in this repo:

- **`data/` JSON is a schema.** Portfolio project fields must conform to `data/schemas/project.schema.json`; renaming a field means updating the schema, every `data/projects/*.json` file, and the rendering code together (the CI data-validation test catches drift).
- **Filter IDs are derived.** `idFromText()` strips punctuation/spaces and capitalizes to build element IDs and filter matches; renaming a type or skill string changes its derived ID everywhere it is matched.
- **Web-projects are self-contained.** A rename inside one web-project must not reach into another project or the main site (except the shared index page, root ADR 0011).
