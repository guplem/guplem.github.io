# Gravity Sandbox

An interactive N-body gravitational simulation built with vanilla HTML, CSS, and Canvas.

## Features

- **N-body gravity** — every body attracts every other body with realistic gravitational physics
- **Slingshot spawning** — click/tap and drag to launch bodies with initial velocity
- **Adjustable mass** — slider to control the mass of newly spawned bodies
- **Body merging** — overlapping bodies merge with conservation of momentum
- **Motion trails** — toggleable trails show orbital paths
- **Presets** — orbital system, binary stars, asteroid field, and three-body figure-eight
- **Mobile friendly** — full touch support with responsive UI

## How to Run

Open `index.html` directly in a browser, or serve locally:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/web-projects/gravity-sandbox/`.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Spawn body | Click | Tap |
| Launch with velocity | Click & drag | Tap & drag |
| Adjust mass | Mass slider | Mass slider |

Use the top-bar buttons to clear all bodies, pause/resume, toggle trails, or load a preset configuration.
