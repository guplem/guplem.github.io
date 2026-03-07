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
- **`seasonal-color-classifier/`** — Classify hex colors into seasonal palettes

## Deployment

GitHub Pages with custom domain. Push to `main` deploys automatically.
