# ADR 0002: Light-Painting Layers and a Fixed Camera (Prime Sieve Arcs)

## Context

The animation adds arcs and never takes them away. By the end of a sweep to 120 there
are about 300 arcs on screen, and the count grows with the limit. Each arc needs three
strokes with additive blending to get the glow, so a naive renderer redraws roughly a
thousand strokes every frame, and the cost grows as the picture fills up.

The camera is the other half of the problem. The signature of the reference frame is a
fan that **grows to the right while number 1 stays pinned at the left**, which means the
whole sweep is visible at once. Two ways to hold that:

1. **Zoom out as the front advances**, fitting `0..frontier` to the width at all times.
   The picture then looks the same at every moment and could run forever. But the scale
   changes every frame, so nothing drawn earlier can be kept: every arc must be redrawn
   at the new scale, every frame. Cost grows without bound.
2. **Fix the scale for the whole sweep**, fitting `0..limit` to the width once. Early on
   there is empty space to the right, which fills in as the front advances.

## Decision

**Fix the camera for a sweep, and paint the light once.**

Three canvases stack up:

- `background`, repainted only on a resize: dust, motes, vignette, number line.
- `glow`, painted once per prime: the violet halo.
- `trail`, painted once per hop: a finished hop is stroked and then never touched again.

Only the hops still growing are drawn on the visible canvas each frame, at most one per
prime found so far, which is about 30 arcs at limit 120. Cost per frame is flat as the
picture fills up, and the accumulated layers give the long-exposure look for free: it is
the same trick as a light-painting photograph.

Two rules keep this honest:

- `replay()` rebuilds `glow` and `trail` from the timeline alone. The painted picture is
  a pure function of the front position and the view size, so a resize, a seek or a
  restart just calls it.
- `CAMERA_FILL = 0.93` fits a little less than the whole sweep. The front leaves the
  right edge before the sweep ends, so the finished picture is a crop with arcs running
  off the edge, which is how the reference frame is framed.

A sweep therefore ends. It holds on the finished picture, fades and starts again, which
is what `advanceTimeline` in `sieve.js` does. `?limit=` changes how far one sweep goes,
and with it the zoom.

## Consequences

**Positive:**

- Flat cost per frame regardless of how full the picture is, so it holds 60 frames per
  second on a phone.
- The glow builds up by accumulation, which matches the reference frame better than any
  per-frame blur would, and costs nothing extra.
- No `shadowBlur` anywhere: the glow is three strokes of decreasing width in `lighter`
  blend mode, which is far cheaper and gave a closer match to the measured colours.
- Because the picture is a pure function of the front position, `?at=<number>` can
  produce any frame directly. That is how the render was checked at all, since a hidden
  browser tab never fires `requestAnimationFrame`.

**Negative:**

- The animation is not endless. It loops instead, and a sweep must be chosen up front
  through `limit`.
- Early in a sweep the right side of the screen is empty. The growing fan is the point,
  so this reads as intended rather than as a fault, but it is a real difference from a
  zooming camera.
- A resize replays every arc drawn so far. At the default limit that is a few hundred
  strokes, so the resize handler is debounced by 120 ms and the cost is invisible. A very
  large `limit` would make a resize visibly slow.
- Tall arcs run off the top and bottom of a narrow window. The reference frame does the
  same, so this was kept rather than fought.

## Scope

Specific to `prime-sieve-arcs`. The reusable principle: **when an animation only ever
adds marks, paint each mark once onto a kept layer and hold the camera still.** Every
sweep, pan or zoom during the run forces a full redraw and throws that saving away.
