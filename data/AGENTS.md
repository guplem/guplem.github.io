# data/AGENTS.md

## Overview

All portfolio content is data-driven. The site never hardcodes content in HTML. Everything comes from these JSON files.

## Files

- **`info.json`**: Site metadata, introduction text, about me content, additional sections (e.g. Triunity Studios), and contact methods. Single flat object.
- **`projects/index.json`**: Manifest listing all project filenames. The `title` field is displayed as the section heading.
- **`projects/*.json`**: One file per portfolio project. Each conforms to `schemas/project.schema.json`.
- **`schemas/project.schema.json`**: JSON Schema for project files. Editors (VS Code) use this for autocompletion and validation.

## Adding a New Project

1. Create `data/projects/<slug>.json` (kebab-case filename derived from the title)
2. Add `"$schema": "../schemas/project.schema.json"` as the first field for editor support
3. Add the filename to the `projects` array in `data/projects/index.json`
4. Regenerate the derived SEO artifacts: `bun scripts/generateSitemap.js && bun scripts/generateSeoBlocks.js` (automatic with the lefthook pre-commit hook; CI drift tests fail if skipped -- root ADR 0014)

If the project is a **web-project** hosted in `web-projects/`, follow the full checklist in `web-projects/AGENTS.md` instead. It includes these data steps plus the additional steps for the project folder, README, and documentation updates.

## Writing Project Descriptions

Each `description` array should follow this structure (one paragraph per element):

1. **Project Name & Concept**: What the project is and its purpose. Mention the product type (app, game, web, etc.). Use italics for the project name, bold for key terms.
2. **Role & Responsibilities**: Guillem's role (e.g. lead developer, front-end developer). Key tasks and technologies used.
3. **Outcome or Impact**: Results, metrics, lessons learned, or notable achievements.

### Style rules (extracted from existing projects):
- **Short and direct**: typically 2–4 paragraphs, rarely more
- **First person** when describing role ("I built…", "I focused on…"), **third person** for the project itself ("The app features…")
- **Bold** key terms and technologies: `**React**`, `**CI/CD**`, `**real-time synchronization**`
- **Italic** for project names: `*Bondy*`, `*DishForge*`
- Use markdown links for external references: `[Lablab Hackathon](https://...)`
- Focus on **what Guillem did**, not generic project descriptions
- Mention concrete constraints when relevant: "delivered in 48 hours", "developed in a week", "won top prize at a Game Jam"

## Choosing Skills (Tags)

- **Reuse existing skills**: always check what skills are already used across other projects before adding a new one. Only introduce a new skill tag when no existing tag covers the concept and it is highly relevant to the project.
- **Keep it relevant**: only assign skills that are central to the project, not tangentially related.
- **Tags reflect Guillem's work**: skills represent technologies Guillem personally worked with, not technologies present in the final product. The purpose of tags is to let people find projects where Guillem used a specific technology.
- **Vibe Coded projects**: always include the "Vibe Coded" tag. Add an area tag (e.g. "Frontend", "UI/UX", "Architecture") ONLY for areas where Guillem gave substantial creative or architectural direction (shaped the design, behavior, or structure through iteration), NOT for technology that merely appears in the AI's output. A single-prompt experiment gets "Vibe Coded" alone. Never tag raw output tech the agent wrote (e.g. "React", "PowerShell", "HTML/CSS", "JS/TS"). Use "AI Integration" only when AI is a feature of the final product (e.g. AI opponents), not because AI was the build tool. Keep prose consistent with tags: do not write "I built X with React" if React is not tagged as Guillem's work. Describe vibe-coded output in the third person ("The game is built with…").
- **Consistent naming**: skill names must exactly match those used in other projects (e.g. "JS/TS" not "JavaScript", "AI Integration" not "AI"). Grep existing project files to confirm spelling.
- **Types**: valid values are `Web`, `Mobile App`, `Videogame`, `Misceallaneous` (note: intentional legacy spelling), `Minecraft`. Assign one or more as appropriate.

## Field Reference

See `schemas/project.schema.json` for the full typed schema. Key points:

- **Required:** `types`, `date`, `title`, `description`, `skills`
- **Optional:** `image`, `imageStretched`, `imageAlt`, `links`
- `description` is an array of markdown strings: each element becomes a paragraph
- `types` and `skills` must use consistent naming across projects (check existing files for spelling)
- `links[].type` maps to an icon file at `resources/images/icons/{type}.webp`

## Gotchas

- JSON fetches are cached in memory. Clear browser cache after editing data files during development.
- `idFromText()` normalizes strings for element IDs and filter matching: capitalized, no spaces/punctuation. Skill/type names must be consistent across all project files.
- CI validates every project file against the schema via `data/projects.test.js`. Run `bun test ./data` locally after editing data.
