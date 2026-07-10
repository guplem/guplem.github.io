# js/planetSimulation/CLAUDE.md

## Overview

Interactive canvas-based particle physics background displayed behind the introduction section. Purely decorative — no user interaction beyond visual effect.

## Architecture

- **`simulation.js`** — Entry point. Manages canvas sizing, the animation loop (60 fps via `setInterval`), and planet creation. Exports `init()` (called on resize) and `updateCentralPoint()`.
- **`elements/vector.js`** — 2D vector math (add, scale, magnitude, normalize, distance)
- **`elements/particle.js`** — Particle with position, velocity, mass, radius, color. Has `draw(space)` method.
- **`elements/space.js`** — Canvas abstraction. Maps simulation coordinates to pixel coordinates. Handles `drawPoint()` and `clear()`.
- **`elements/gravity.js`** — Gravitational force calculation between a particle and an attraction point.
- **`elements/time.js`** — Euler integration: updates particle position/velocity given a force and time step.

## Configuration

Constants in `simulation.js`:
- `spaceSize`: simulation coordinate range (10x10)
- `planetsQuantityTarget`: 120 particles
- `attractionPoints`: array of gravity centers (currently 1 at origin)
- Particles are created gradually: 3 per frame until target is reached

## Integration

- Canvas element: `<canvas id="simCanvas">` inside `#introduction`
- `init()` is called from `structure.js` on window resize (debounced 100ms)
- Canvas is resized to match the `#introduction` div dimensions

## Performance Notes

120 particles at 60 fps with gravity calculations each frame. No spatial partitioning — all particles are checked against all attraction points every frame. Currently lightweight enough but would need optimization if particle count increased significantly.
