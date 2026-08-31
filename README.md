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

Self-contained mini-apps in `web-projects/`. Browse them all in the **Playground** at [triunitystudios.com/web-projects/](https://triunitystudios.com/web-projects/), an index page that lists every project automatically from the portfolio data. "Playground" is the visitor-facing name of that page; the folder and the URL keep the `web-projects` name.

- **`global-news-map/`** — A world map of the day's news, pinned where it happened, read from Wikipedia's Current Events portal; any past day, with the original sources on every story
- **`akwaaba-monsters/`** — A handheld-style creature-collecting game set in tropical Ghana, from the first village to the first gym; no image or audio files anywhere, every creature and note is generated in the browser
- **`unit-converter/`** — Type an amount and a unit in one box (`100 km`, `5'10"`, `1 1/2 cup`, `100 USD`) and see every unit it can be at once, currencies included
- **`sudoku-screenshot-coach/`** — Reads a sudoku out of a screenshot and explains the next best move, in English or Spanish
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
- **`prime-sieve-arcs/`** — The Sieve of Eratosthenes as an animation: every prime hops over its multiples in glowing arcs
- **`whatsapp-no-contact/`** — Open a WhatsApp chat with any phone number without saving it as a contact: searchable country selector, number field, one button

## Deployment

GitHub Pages with custom domain. Push to `main` deploys automatically.

Pull requests are tested automatically: a GitHub Actions workflow runs the full test suite (`bun test .` -- the web-project tests plus the portfolio data validation) on every pull request, and a pull request cannot be merged while a test fails.
