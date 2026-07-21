# ADR 0001: Data-Driven Content via JSON

## Context

The portfolio needs to display projects, personal info, and contact details. Options considered:
- A CMS (WordPress, Contentful, etc.)
- A static site generator (Hugo, Jekyll, Eleventy)
- Hand-coded HTML for each project
- JSON data files loaded at runtime by vanilla JS

The site is hosted on GitHub Pages (static files only). The owner wants full control over content without external service dependencies, and adding a new project should not require touching HTML.

## Decision

All portfolio content lives in JSON files under `data/`. One file per project (`data/projects/*.json`), a manifest (`data/projects/index.json`), and site metadata (`data/info.json`). A JSON Schema (`data/schemas/project.schema.json`) provides autocompletion and validation in VS Code. JavaScript modules fetch and render this data at page load.

**Rejected alternative:** a CMS or a static site generator (Hugo, Jekyll, Eleventy). Rejected because both add a build step or an external service to a static GitHub Pages site, and a CMS would move content out of version control and behind an API. Hand-coded HTML per project was also rejected: it forces HTML edits for every new project.

## Consequences

**Positive:**
- Adding a project is a single JSON file + one line in the manifest. No HTML editing.
- JSON Schema catches field errors before they reach the browser.
- No external CMS dependency, no API keys, no build step.
- Content is version-controlled alongside code.

**Negative:**
- All data is public in the repo (acceptable for a portfolio).
- No rich editor experience; content is edited as raw JSON.
- Initial page load fetches many small JSON files (mitigated by browser caching).

> **Note (2026-07):** the committed HTML now also carries crawler-facing static fallback blocks *generated from* this JSON (never hand-edited, drift-tested in CI). The JSON stays the single hand-edited source of truth. See ADR 0010.
