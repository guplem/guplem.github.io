# ADR 0003: Web Worker for Particle Simulation

## Context

The portfolio background features an interactive particle simulation with ~120 particles, gravitational attraction, and collision detection. Running the physics loop on the main thread would block DOM updates and cause jank during scrolling and filtering.

## Decision

The physics simulation runs in a Web Worker (`simulation.worker.js`). The main thread owns the canvas and handles rendering. The worker computes particle positions each frame and posts results back. Communication uses `postMessage` with transferable data.

## Consequences

**Positive:**
- Physics calculations never block the main thread. Scrolling, filtering, and animations stay smooth.
- The simulation can scale to more particles without affecting UI responsiveness.

**Negative:**
- Worker cannot access the DOM or canvas directly; rendering must happen on the main thread after receiving position data.
- Debugging is harder (separate execution context, no direct console in some dev tools).
- Data must be serialized for each frame's `postMessage`, adding a small overhead.
