---
name: add-web-project
description: Scaffold a new web-project with folder, README, tests, portfolio data, ADRs, and documentation updates
argument-hint: "<project name or description>"
---

# Add Web Project

Scaffold (create all the starting files and folders for) a new self-contained web-project from start to finish. Follow the full checklist in `web-projects/AGENTS.md`.

This command must be used automatically whenever the user asks to create a new web-project.

## 1. Gather Project Details

If `$ARGUMENTS` contains a project name or description, use it. Otherwise, ask using `AskUserQuestion`:

> "What web-project do you want to create? Describe the tool, game, or experiment in a sentence or two."

Then ask using `AskUserQuestion`:

> "What should I call it? This becomes the folder name and the URL slug (the short name used in the web address)."

Options:
1. **<suggested-slug>** - Based on the description (kebab-case: lowercase words joined by hyphens, kept short).
2. **<alternative-slug>** - A different derivation.
3. **Other** - The user will type a custom slug.

Store as `PROJECT_SLUG` and `PROJECT_DESCRIPTION`.

Then decide where the project's data lives (root ADR 0016 and the "Storage" section of `web-projects/AGENTS.md`). **Ask the user with `AskUserQuestion`**, every time, unless the description makes the answer plain (a toy with no state, or a project whose whole point is a history that follows the person):

> "Where should this project keep its data? Cloud sync costs the person a GitHub token and a repository, once, and on a phone that is real work. It pays off only when losing the data would hurt, or when following you across devices is the point."

Options:
1. **This device (Recommended for most projects)** - Storage tier **This device**. `localStorage` through `cloud-storage/localStore.js`. Right for preferences, recents, small histories, anything a person would not mind losing.
2. **Cloud, it follows me across devices** - Storage tier **Cloud**. The project saves through the shared `web-projects/cloud-storage/` module, to this browser and to the reader's private repository. Right for hours of progress, notes written over weeks, or a history that is the feature.
3. **Nothing worth keeping** - Storage tier **None**. State that is worth sharing goes in the URL (root ADR 0006).

Secrets, caches of remote data, multi-MB binaries and shareable state never go to the cloud, whatever the answer. Store as `STORAGE_TIER`.

## 2. Run Pattern Scout

Delegate to the **pattern-scout** agent to find how existing web-projects are structured:

> Analyze existing web-projects in `web-projects/` to find the established patterns for: folder structure, HTML boilerplate, CSS conventions, JS module structure, test file setup, and README format.

Follow the patterns found.

## 3. Check Existing Skills and Types

Before creating the portfolio data file, search the existing project files with `grep` to find all skills and types currently in use:

```bash
grep -h '"skills"' data/projects/*.json
grep -h '"types"' data/projects/*.json
```

Store as `EXISTING_SKILLS` and `EXISTING_TYPES` for Step 6.

## 4. Scaffold the Project Folder

Create `web-projects/<PROJECT_SLUG>/` with:

1. **`index.html`** - HTML boilerplate (the standard starting HTML) following patterns from existing web-projects. Include:
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

5. **`deployStamp.js`** - Copy it and its test file from `web-projects/sudoku-screenshot-coach/`. It puts a "deployed at <date> by pull request #N" line in the footer, read from two meta tags in this page's own `<head>`. It fetches nothing. Add a `<p id="deploy-line" class="deploy-line"></p>` to the footer, add the `GENERATED:DEPLOY` block to the `<head>` (copy it with its placeholder values), and call `renderDeployLine(element, readStamp(document), lang, say, escapeHtml, "web-projects/<PROJECT_SLUG>")` at start-up and on every language change. `scripts/generateDeployStamp.js` finds the block automatically, so there is nothing to register. Remember that the pull request stamps itself in a second commit, after it is opened. See root ADR 0013 and the section in `web-projects/AGENTS.md`.

6. **`README.md`** - Project README following existing web-project READMEs:
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

7. **Storage, by `STORAGE_TIER`.** Follow the adoption checklist in `web-projects/cloud-storage/AGENTS.md`.
   - **None**: nothing.
   - **This device**: import `readJson` / `writeJson` from `../cloud-storage/localStore.js`, and key every value `<PROJECT_SLUG>.<name>` with `projectKey`.
   - **Cloud**: create `document.js` with `const shape = defineDocument([...maps])` from `../cloud-storage/envelope.js` and typed read and write helpers over `shape.read` / `shape.write`, plus `document.test.js` (red first). In `script.js`, call `openStore({ project: PROJECT_SLUG, file: "<name>.json", recordMaps, onChange, onStatus, onQuestion: askCopyQuestion })` from `../cloud-storage/cloudStore.js` at start-up and `store.write(...)` on every change. Link `../cloud-storage/cloudSettingsPanel.css` in `index.html` and mount `mountCloudSettings(host, { mode: "compact", pageHref: "../cloud-storage/", onConfigured: () => store.reconnect() })` where the project's settings are. The page then holds a token, so it loads no third-party script.

**Do not implement features yet.** The scaffold is a starting point for TDD (test-driven development: write the tests first, then the code). Features come after tests.

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
- **Reuse existing skills** from `EXISTING_SKILLS`. Only introduce new tags when no existing tag fits
- **Reuse existing types** from `EXISTING_TYPES`
- Follow the `data/AGENTS.md` guidance for Vibe Coded projects if applicable

### 6b. Add to the manifest (the list file of all projects)

Add the filename to the `projects` array in `data/projects/index.json`.

### 6c. Give the listing an image

Every web-project in the portfolio gets an image in the pull request that adds it to `data/projects/index.json`. Make it when the page first shows its main feature. A scaffold with nothing on screen is not ready: make the image in the pull request that ships the first working version.

**Choose the form first.** The portfolio card shows the image at about 400 px wide, so a full-page screenshot turns the page's own text into noise.

| Form | Use it when | Example |
|---|---|---|
| **Framed screenshot** (the default) | The page has a real UI to show. A headline says what the project does; a cropped screenshot sits below it. | `sources/wildfireWatch/` |
| **Composed scene** | The idea is a flow or a gesture that one screenshot cannot show. A headline, numbered steps, and a drawn mock of the key UI. | `margin-notes.webp` |
| **Plain screenshot** | The page is a picture already (a map, a game, generated art) and it reads at card size with no words. | `globalNewsMap.webp` |
| **Drawn output** | The page cannot show its point on screen (a page behind a key). Draw the output with the project's own code. | `aiWorldGen.webp` |

**The capture tool.** A browser pane screenshot never reaches the disk, so capture every file with `scripts/captureProjectImage.js`. It opens any page in the repo in headless Chrome, presses one `--click` per button text, in order, and writes a WebP:

```bash
bun scripts/captureProjectImage.js --page web-projects/<PROJECT_SLUG>/ --out <file>.webp --click "<button text>" --width 1240 --height 700
```

**Steps for a crafted image** (framed screenshot or composed scene):

1. Open the page in the browser pane, and find the view that shows the most of the project (layers on, a result shown, a game mid-play).
2. Capture that view to `resources/images/projects/sources/<projectSlugCamelCase>/screenshot.webp`. Keep the viewport small (about 1240 x 700), so the UI stays large after the crop. Pin the data when the page has a demo or seeded mode (`?mode=demo`), so a re-render gives the same picture.
3. Write `resources/images/projects/sources/<projectSlugCamelCase>/index.html`, a fixed 1280 x 800 page. Copy `sources/wildfireWatch/index.html` as the start. Use the project's own colours, a headline of a few words that says the benefit, one short line under it, and the screenshot cropped so the page footer is out of the frame.
   The script cannot type or upload. Reach a filled-in state through URL parameters when the project has them. Otherwise, copy the view's markup with fixed values into a `mock.html` beside it that loads the project's own CSS, as `sources/githubStatsDashboard/` does. Never put made-up numbers under a real name (a real repository, person, or place); use a clearly fictional one.
4. Put both capture commands in a comment at the top of that `index.html`, so the next agent can re-render the image when the project changes.
5. Render it: `bun scripts/captureProjectImage.js --page resources/images/projects/sources/<projectSlugCamelCase>/ --out resources/images/projects/<projectSlugCamelCase>.webp --width 1280 --height 800 --quality 80`.

**Then, for every form:**

1. Read the final WebP back, and check it at card size: the headline must read, and nothing may be cut off. Adjust and re-render until it does.
2. Add `image`, `imageStretched: true` and a concrete `imageAlt` (what the picture shows, not the project name) to the project JSON.
3. Run the three generators from root `AGENTS.md` ("Generated SEO artifacts"), because the image appears in the generated blocks.

Tell the user when the project ships without an image, and why.

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
- web-projects/<PROJECT_SLUG>/document.js and document.test.js (cloud tier only)
- web-projects/<PROJECT_SLUG>/README.md
- data/projects/<PROJECT_SLUG>.json
- resources/images/projects/<projectSlugCamelCase>.webp (or why there is none yet)

### Storage tier
<STORAGE_TIER>, and why.

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
- **Self-contained.** No imports from outside the project folder, except `../cloud-storage/` (root ADR 0016).
- **Storage tier is decided at creation, with the user.** Cloud is the exception: only for data whose loss hurts or when following the person is the point.
- **Reuse skills.** Always check existing tags before inventing new ones.
- **Follow patterns.** The pattern-scout output is the baseline for structure and style.
- **Documentation is part of the scaffold.** README, portfolio data, and AGENTS.md updates are not optional follow-ups.
