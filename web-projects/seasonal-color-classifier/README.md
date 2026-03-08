# Seasonal Color Classifier

A web tool that analyzes any color and classifies it into one of the four seasonal palettes (Spring, Summer, Autumn, Winter) used in personal color analysis.

## Features

- **Color input** via hex code or native color picker
- **Season scoring** with percentage-based affinity bars for each season
- **Palette visualization** in two modes: territory maps (hue vs. lightness canvas) or discrete color chip grids
- **Diagnostic wizard** — a 4-question quiz to determine your personal color season based on physical traits

## How to Run

No build step required. Serve the folder with any HTTP server:

```bash
# From the repository root
python -m http.server 8000
```

Then open `http://localhost:8000/web-projects/seasonal-color-classifier/` in a browser.

Alternatively, open `index.html` directly in a browser — all assets are self-contained.

## Tech Stack

Vanilla HTML, CSS, and JavaScript. No frameworks or dependencies.

## Live Version

[triunitystudios.com/web-projects/seasonal-color-classifier](https://triunitystudios.com/web-projects/seasonal-color-classifier/)
