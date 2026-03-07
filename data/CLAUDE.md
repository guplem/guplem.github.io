# data/CLAUDE.md

## Overview

All portfolio content is data-driven. The site never hardcodes content in HTML — everything comes from these JSON files.

## Files

- **`info.json`** — Site metadata, introduction text, about me content, additional sections (e.g. Triunity Studios), and contact methods. Single flat object.
- **`projects/index.json`** — Manifest listing all project filenames. The `title` field is displayed as the section heading.
- **`projects/*.json`** — One file per portfolio project. Each conforms to `schemas/project.schema.json`.
- **`schemas/project.schema.json`** — JSON Schema for project files. Editors (VS Code) use this for autocompletion and validation.

## Adding a New Project

1. Create `data/projects/<slug>.json` (kebab-case filename derived from the title)
2. Add `"$schema": "../schemas/project.schema.json"` as the first field for editor support
3. Add the filename to the `projects` array in `data/projects/index.json`

## Writing Project Descriptions

Each `description` array should follow this structure (one paragraph per element):

1. **Project Name & Concept** — What the project is and its purpose. Mention the product type (app, game, web, etc.). Use italics for the project name, bold for key terms.
2. **Role & Responsibilities** — Guillem's role (e.g. lead developer, front-end developer). Key tasks and technologies used.
3. **Outcome or Impact** — Results, metrics, lessons learned, or notable achievements.

### Style rules (extracted from 55 existing projects):
- **Short and direct** — typically 2–4 paragraphs, rarely more
- **First person** when describing role ("I built…", "I focused on…"), **third person** for the project itself ("The app features…")
- **Bold** key terms and technologies: `**React**`, `**CI/CD**`, `**real-time synchronization**`
- **Italic** for project names: `*Bondy*`, `*DishForge*`
- Use markdown links for external references: `[Lablab Hackathon](https://...)`
- Focus on **what Guillem did**, not generic project descriptions
- Mention concrete constraints when relevant: "delivered in 48 hours", "developed in a week", "won top prize at a Game Jam"

## Field Reference

See `schemas/project.schema.json` for the full typed schema. Key points:

- **Required:** `types`, `date`, `title`, `description`, `skills`
- **Optional:** `image`, `imageStretched`, `imageAlt`, `links`
- `description` is an array of markdown strings — each element becomes a paragraph
- `types` and `skills` must use consistent naming across projects (check existing files for spelling)
- `links[].type` maps to an icon file at `resources/images/icons/{type}.webp`

## Gotchas

- The old monolithic `myWork.json` still exists but is no longer used at runtime. `fetchAllWorks()` in `textUtils.js` loads from `projects/index.json` + individual files.
- JSON fetches are cached in memory. Clear browser cache after editing data files during development.
- `idFromText()` normalizes strings for element IDs and filter matching — capitalized, no spaces/punctuation. Skill/type names must be consistent across all project files.
