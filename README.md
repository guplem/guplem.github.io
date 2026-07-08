# Guillem Poy — Portfolio

Personal portfolio website hosted on GitHub Pages.

**Live site:** [triunitystudios.com](https://triunitystudios.com)

## Structure

- **Main site** (`index.html`) — Data-driven portfolio. Content is loaded from JSON files (`data/`) and rendered dynamically with vanilla JS.
- **`web-projects/`** — Standalone mini-apps, separate from the main site.

## Local Development

No build step. Serve files with any HTTP server.

**Recommended: [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for VS Code** — install the extension, then either click "Go Live" in the bottom status bar or right-click `index.html` and select "Open with Live Server". It auto-reloads the browser on file changes.

Alternatively, from the terminal:

```bash
python -m http.server 8000
```

### Generated files (SEO)

`sitemap.xml` and the `GENERATED` comment-marked blocks inside `index.html` and `web-projects/index.html` are derived from the `data/` JSON so search engines can read the content without running JavaScript. Never edit them by hand. After changing `data/`, regenerate them with [Bun](https://bun.sh):

```bash
bun scripts/generateSitemap.js
bun scripts/generateSeoBlocks.js
```

To make this automatic on every commit, install [lefthook](https://github.com/evilmartians/lefthook) once (`winget install evilmartians.lefthook` on Windows, `brew install lefthook` on macOS) and run `lefthook install` in the repo. If you skip this, CI fails with a message telling you which script to run.

## Web Projects

Self-contained mini-apps in `web-projects/`. Browse them all at [triunitystudios.com/web-projects/](https://triunitystudios.com/web-projects/), an index page that lists every project automatically from the portfolio data.

- **`ChatGPTPong/`** — Canvas-based Pong game
- **`gravity-sandbox/`** — Interactive N-body gravitational simulation
- **`photo-editor/`** — Mobile photo editor with drawing, stickers, filters, and cropping
- **`seasonal-color-classifier/`** — Classify hex colors into seasonal palettes
- **`github-stats-dashboard/`** — GitHub repository analytics dashboard
- **`random-option-picker/`** — Slot-machine style picker with shareable URLs and reproducible seeds
- **`taboo-game/`** — Deterministic multiplayer Taboo game across phones, no server required
- **`liga-under-tkd/`** — Live taekwondo tournament site (standings, combats, athlete profiles) read from a shared Google Sheet, in CA/ES/EN
- **`rps-mind-reader/`** — Rock-paper-scissors against an AI that learns your habits and adapts
- **`street-name-history/`** — Search any street for all its names across languages, its former names, and its etymology (OpenStreetMap + Wikidata + OpenHistoricalMap)

## Deployment

GitHub Pages with custom domain. Push to `main` deploys automatically.

Pull requests are tested automatically: a GitHub Actions workflow runs the full test suite (`bun test .` -- the web-project tests plus the portfolio data validation) on every pull request, and a pull request cannot be merged while a test fails.
