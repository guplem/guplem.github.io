# web-projects/CLAUDE.md

> **SCOPE:** These rules apply when working on files under `web-projects/`. Each project inside is self-contained and independent from the main portfolio site.

## Overview

Collection of small, standalone web projects — games, tools, experiments, demos. Often AI-generated. Each is fully self-contained and independent from the main portfolio site.

## Conventions

- **One folder per project** — all assets live inside the project folder
- **Self-contained** — own HTML, CSS, JS. No shared dependencies with the main site or other projects
- **No build tools, no frameworks** — vanilla HTML/CSS/JS preferred
- **Works standalone** — each project should work by opening its HTML file directly or via any HTTP server


## Adding a New Web Project (full checklist)

1. **Create the project folder** in `web-projects/<slug>/`. Keep it self-contained — no imports from outside the folder.
2. **Include a `README.md`** in the project folder explaining what the tool is, its features, and how to run it locally. Mandatory for every web-project.
3. **Add to the portfolio data** — create `data/projects/<slug>.json` and add its filename to `data/projects/index.json`. See `data/CLAUDE.md` for schema, description style, and skills guidance.
4. **Update this file** — add the project to the "Existing Projects" list below.
5. **Update `README.md`** (root) — add the project to the "Web Projects" list.

## Existing Projects

- **ChatGPTPong** — Classic Pong game generated entirely by ChatGPT (GPT-3.5) in Dec 2022
- **gravity-sandbox** — Interactive N-body gravitational simulation with slingshot spawning, merging, trails, and presets
- **menu-management** — Weekly menu planner with recipe management, auto-generation, shopping lists, and step-by-step cooking guide. Ported from Flutter desktop app.
- **photo-editor** — Mobile photo editor with drawing, stickers, filters, and cropping
- **seasonal-color-classifier** — Color analysis tool that classifies colors into seasonal palettes
