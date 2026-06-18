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

## Web Projects

Self-contained mini-apps in `web-projects/`:

- **`ChatGPTPong/`** — Canvas-based Pong game
- **`gravity-sandbox/`** — Interactive N-body gravitational simulation
- **`photo-editor/`** — Mobile photo editor with drawing, stickers, filters, and cropping
- **`seasonal-color-classifier/`** — Classify hex colors into seasonal palettes
- **`github-stats-dashboard/`** — GitHub repository analytics dashboard
- **`random-option-picker/`** — Slot-machine style picker with shareable URLs and reproducible seeds
- **`taboo-game/`** — Deterministic multiplayer Taboo game across phones, no server required
- **`liga-under-tkd/`** — Live taekwondo tournament site (standings, combats, athlete profiles) read from a shared Google Sheet, in CA/ES/EN
- **`rps-mind-reader/`** — Rock-paper-scissors against an AI that learns your habits and adapts

## Deployment

GitHub Pages with custom domain. Push to `main` deploys automatically.
