---
name: add-web-project
description: Scaffold a new web-project with folder, README, tests, portfolio data, ADRs, and documentation updates
argument-hint: "<project name or description>"
---

# Add Web Project

Scaffold a new self-contained web-project end-to-end, following the full checklist from `web-projects/AGENTS.md`.

This command must be used automatically whenever the user asks to create a new web-project.

## 1. Gather Project Details

If `$ARGUMENTS` contains a project name or description, use it. Otherwise, ask using `AskUserQuestion`:

> "What web-project do you want to create? Describe the tool, game, or experiment in a sentence or two."

Then ask using `AskUserQuestion`:

> "What should I call it? This becomes the folder name and URL slug."

Options:
1. **<suggested-slug>** - Based on the description (kebab-case, short).
2. **<alternative-slug>** - A different derivation.
3. **Other** - The user will type a custom slug.

Store as `PROJECT_SLUG` and `PROJECT_DESCRIPTION`.

## 2. Run Pattern Scout

Delegate to the **pattern-scout** agent to find how existing web-projects are structured:

> Analyze existing web-projects in `web-projects/` to find the established patterns for: folder structure, HTML boilerplate, CSS conventions, JS module structure, test file setup, and README format.

Follow the patterns found.

## 3. Check Existing Skills and Types

Before creating the portfolio data file, grep existing project files to find all skills and types currently in use:

```bash
grep -h '"skills"' data/projects/*.json
grep -h '"types"' data/projects/*.json
```

Store as `EXISTING_SKILLS` and `EXISTING_TYPES` for Step 6.

## 4. Scaffold the Project Folder

Create `web-projects/<PROJECT_SLUG>/` with:

1. **`index.html`** - HTML boilerplate following patterns from existing web-projects. Include:
   - Proper `<title>` and meta tags
   - Link to local CSS
   - Script tag with `type="module"` and `defer`

2. **`style.css`** - Minimal starter CSS following existing project conventions.

3. **`script.js`** - Main JS module. Export testable functions separately from DOM logic.

4. **`script.test.js`** - Initial test file with at least one placeholder test:
   ```javascript
   import { describe, test, expect } from "bun:test";

   describe("<PROJECT_SLUG>", () => {
     test.todo("first feature");
   });
   ```

5. **`README.md`** - Project README following existing web-project READMEs:
   ```markdown
   # <Project Title>

   <One-sentence description.>

   ## Features

   - <Planned feature 1>

   ## How to Run

   Open `index.html` in a browser or serve with any HTTP server.

   ## Tests

   ```bash
   bun test
   ```
   ```

**Do not implement features yet.** The scaffold is a starting point for TDD. Features come after tests.

## 5. Verify Tests Run

```bash
cd web-projects/<PROJECT_SLUG> && bun test
```

Confirm the test file loads without errors (the todo test should be pending, not failing).

## 6. Create Portfolio Data

### 6a. Create the project JSON

Create `data/projects/<PROJECT_SLUG>.json` conforming to `data/schemas/project.schema.json`.

- Set `"$schema": "../schemas/project.schema.json"` as the first field
- Write a brief initial description following the style rules in `data/AGENTS.md`
- **Reuse existing skills** from `EXISTING_SKILLS` -- only introduce new tags when no existing tag fits
- **Reuse existing types** from `EXISTING_TYPES`
- Follow the `data/AGENTS.md` guidance for Vibe Coded projects if applicable

### 6b. Add to the manifest

Add the filename to the `projects` array in `data/projects/index.json`.

## 7. Update Documentation

### 7a. Update `web-projects/AGENTS.md`

Add the project to the "Existing Projects" list with a one-line description.

### 7b. Update root `README.md`

Add the project to the "Web Projects" list.

### 7c. Run the docs-checker agent

Delegate to the **docs-checker** agent to verify all documentation is consistent after the additions.

## 8. Create ADRs (if applicable)

Ask using `AskUserQuestion`:

> "Does this project involve any architectural decisions worth recording? (e.g., choice of algorithm, physics engine, data structure, rendering approach)"

Options:
1. **Yes** - The user will describe the decision. Create an ADR and update the index.
2. **Not yet** - Skip for now. ADRs can be added during implementation.

## 9. Report

Present to the user:

```
## New Web Project Created: <PROJECT_SLUG>

### Files created
- web-projects/<PROJECT_SLUG>/index.html
- web-projects/<PROJECT_SLUG>/style.css
- web-projects/<PROJECT_SLUG>/script.js
- web-projects/<PROJECT_SLUG>/script.test.js
- web-projects/<PROJECT_SLUG>/README.md
- data/projects/<PROJECT_SLUG>.json

### Files updated
- data/projects/index.json (manifest)
- web-projects/AGENTS.md (existing projects list)
- README.md (web projects list)

### Next steps
The project is scaffolded with TDD ready. Start by writing tests in
`script.test.js`, then implement features to make them pass.
```

## Important Rules

- **TDD first.** The scaffold includes a test file but no implementation. Features are built test-first after scaffolding.
- **Self-contained.** No imports from outside the project folder.
- **Reuse skills.** Always check existing tags before inventing new ones.
- **Follow patterns.** The pattern-scout output is the baseline for structure and style.
- **Documentation is part of the scaffold.** README, portfolio data, and AGENTS.md updates are not optional follow-ups.
