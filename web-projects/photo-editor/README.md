# Snap Editor

A Snapchat-inspired mobile photo editor that runs entirely in the browser. Take photos with your camera or pick from gallery, then edit with drawing tools, emoji stickers, text overlays, filters, and cropping.

## Features

- **Camera capture** — Opens rear camera by default, tap to capture, flip to front camera
- **Gallery import** — Pick any image from your device
- **Drawing** — Freehand drawing with multiple colors and brush sizes, undo support
- **Emoji stickers** — Drag-and-drop emoji placement with pinch-to-resize
- **Text overlays** — Add colored text anywhere on the image
- **Filters** — 10 filters: B&W, Sepia, Warm, Cool, Vivid, Fade, Drama, Invert, Blur
- **Crop** — Free or constrained (1:1, 4:3, 16:9) cropping
- **Save locally** — Download edited photo as JPEG

## Running Locally

Serve with any HTTP server (camera requires HTTPS or localhost):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in a mobile browser or desktop with camera.

## Tech

Vanilla HTML/CSS/JS. No frameworks, no dependencies, no build step.
