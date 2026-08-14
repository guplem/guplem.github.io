# web-projects/prime-sieve-arcs/AGENTS.md

> **SCOPE:** files under `web-projects/prime-sieve-arcs/`. Read `web-projects/AGENTS.md` first for the rules that cover every web-project.

## What this is

A canvas animation of the Sieve of Eratosthenes. A front sweeps along the number line. Each prime hops over its own multiples, and each hop is a half circle. `README.md` explains the idea for a reader; this file holds the numbers and the rules that the code must keep.

## The reference frame is the spec

The look copies one video frame. That frame lives at `reference/inspiration-frame.webp`, committed on purpose so the source of the art style stays next to the code. No page links to it. The original maker is unknown: the frame carries no author or title.

Nothing was copied from the source video. The construction and the palette were measured out of that frame, pixel by pixel, with a Hough transform (a way to find shapes in an image) for the arcs and direct pixel reads for the colours. **Treat the frame as the reference for any change to the look.** These are the measurements:

| Measured | Value |
|---|---|
| Scale of the frame | 23.1 pixels per number, number 0 at x = 179 |
| Every arc diameter | Exactly a prime: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37 |
| Chain for a prime `p` | `p^2p`, `2p v 3p`, `3p^4p`, ... (`^` above the line, `v` below) |
| First hop | Always above the line, from `p` to `2p`, never from `p*p` |
| Arc core colour | `#e6e689`, a pale yellow-green, about 1.3 px wide |
| Arc companion strand | Red-orange, a couple of pixels beside the core |
| Violet halo under a prime | `(138,88,138)` half a number out, `(75,49,79)` one number out, `(17,14,17)` three numbers out |
| Background | `#050505` with faint dust and a vignette |
| Number line | A single faint violet-grey row of pixels |

`sieve.test.js` pins the chains that were measured in the frame, so a change to the hop rule fails a test.

## Files

| File | Role |
|---|---|
| `sieve.js` | Pure logic: primes, hop geometry, canvas sweep angles, the camera maths and the timeline state machine. No DOM. |
| `sieve.test.js` | Bun tests for every export of `sieve.js`. |
| `render.js` | Canvas, layers, input, HUD. Holds no maths of its own. |
| `index.html`, `style.css` | Page and overlay. |
| `reference/inspiration-frame.webp` | The frame the look comes from. Never delete it. |
| `adr/0001-...`, `adr/0002-...` | Why the construction and the layering are what they are. |

## Rules

- **Keep maths out of `render.js`.** Anything that can be checked without a canvas belongs in `sieve.js` with a test. The timeline (sweep, hold, fade, restart) lives there for this reason, because a browser could not be driven in the session that wrote it.
- **Light painting, not redraw.** A finished hop is stroked once onto the trail layer and never again. Cost per frame stays flat as the picture fills up. Only the hops still growing are drawn every frame.
- **`replay()` rebuilds both painted layers** from the timeline alone. Call it after anything that invalidates them: a resize, a seek, a restart. The picture must always be a pure function of `(frontier, view size)`.
- **The camera never zooms during a sweep.** `CAMERA_FILL` fits a little less than the whole sweep, so the front leaves the right edge before the end and the finished picture is a crop, like the reference frame. Changing this breaks the light painting, which assumes a fixed scale.
- **Chips only mark primes** (and 1). Composites stay unmarked: the empty spots are the point of the sieve.

## Gotchas

- **`Number(null)` is `0`, not `NaN`.** A missing URL parameter read with `Number(params.get(name))` silently becomes 0 and then clamps to the minimum. Guard with `params.has(name)` first. This bug once made `limit` 12 instead of 120.
- **Angles run in canvas order.** Canvas y grows downwards, so a hop above the line sweeps from `PI` to `2*PI` (through `3*PI/2`, the top) and a hop below the line from `PI` down to `0`. `hopSweep` owns this; do not re-derive it.
- **A hidden tab never fires `requestAnimationFrame`.** A headless browser without a shown window renders one frame and stops, so the animation cannot be checked that way. Use `?at=<number>` to capture a frame instead.
