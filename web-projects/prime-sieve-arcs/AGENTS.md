# web-projects/prime-sieve-arcs/AGENTS.md

> **SCOPE:** files under `web-projects/prime-sieve-arcs/`. Read `web-projects/AGENTS.md` first for the rules that cover every web-project.

## What this is

A canvas animation of the Sieve of Eratosthenes. Every number sits on the line as a chip.
A **scanner** walks the line and names a prime whenever it lands on a number that nothing
has crossed out. Each prime then **hops** over its own multiples, one half circle a hop,
alternating above and below the line. A hop that lands on a number crosses it out.

`README.md` explains the idea for a reader. This file holds the numbers and the rules that
the code must keep.

## The reference frames are the spec

The look copies frames of one video. The first frame is committed at
`reference/inspiration-frame.webp`, on purpose, so the source of the art style stays next
to the code. No page links to it. The original maker is unknown: the frames carry no author
and no title.

Nothing was copied from the source video. The construction and the palette were measured
out of those frames, pixel by pixel, with a Hough transform (a way to find shapes in an
image) for the arcs and direct pixel reads for the colours. **Treat the frames as the
reference for any change to the look.**

| Measured | Value |
|---|---|
| Scale of the first frame | 23.1 pixels per number, number 0 at x = 179 |
| Every arc diameter | Exactly a prime: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37 |
| Chain for a prime `p` | `p^2p`, `2p v 3p`, `3p^4p`, ... (`^` above the line, `v` below) |
| First hop | Always above the line, from `p` to `2p`, never from `p*p` |
| Arc core colour | Pale warm yellow, about 1.4 px wide |
| Arc companion strand | Red-orange, a couple of pixels beside the core |
| Background | `#050505` with faint dust and a vignette |

### What the later frames added

Three frames of the same run, later in the sweep, fixed the behaviour over time. They are
not committed (they came as pasted images with no files), so the measurements are here:

| Measured | Value |
|---|---|
| Numbers on screen | All of them, from the first frame, as white chips with digits |
| A crossed number | Loses its digits and its white face, leaving a bare glowing ring |
| A prime | Turns amber, with its digits, when its own chain leaves |
| 1 | Stays white for ever: neither prime nor a multiple |
| Zoom | 97, 68 and 26 pixels a number across three frames; 20, 29 and 78 numbers on screen |
| Camera anchor | 1 stays at the left edge, the leading pen sits near the right edge |
| Pens | Staggered, never one shared front; the newest chains trail the leading arcs |
| Amber against white | Amber ran to 17 while 19 was still white, and to 37 while 41 was still white |
| Lines | Not smooth where they cross the line: the two halves meet on the number, but at a corner |
| Digits | A serif face |

## The model

Everything is a function of one number, the seconds elapsed. That keeps the whole thing
testable and lets any frame be drawn directly.

- `scannerAt(t)` walks at `scanSpeed` numbers a second, after an intro where it waits on 2.
- `penAt(p, t)` runs at `penRatio` times that speed, from the moment the scanner reached `p`.
  2 is the exception: it leaves at once, which is the opening of the animation.
- `crossTime(n)` is when the chain of `n`'s smallest prime factor lands on it.
- `numberStateAt(n, t)` gives the chip its look: `unknown`, `prime` or `crossed`, plus a
  fade for the change between looks.

**The pens must stay faster than the scanner.** That single fact is what makes the sieve
honest: the chain of a composite's smallest prime factor left earlier and moves faster, so
it always crosses the number before the scanner arrives. A ratio of 1 or less would let the
scanner call a composite prime. Two tests hold this margin, one at the default pace and one
across a range of ratios.

## Files

| File | Role |
|---|---|
| `sieve.js` | Pure logic: primes, hop geometry, canvas sweep angles, pace, chip states, the kink, camera maths, timeline state machine. No DOM. |
| `sieve.test.js` | Bun tests for every export of `sieve.js`. |
| `render.js` | Canvas, input, HUD. Holds no maths of its own. |
| `index.html`, `style.css` | Page and overlay. |
| `reference/inspiration-frame.webp` | The first reference frame. Never delete it. |
| `adr/0001-...`, `adr/0002-...` | Why the construction and the renderer are what they are. |

## Rules

- **Keep maths out of `render.js`.** Anything checkable without a canvas belongs in
  `sieve.js` with a test. The pace, the chip states and the timeline all live there, because
  a browser could not be driven in the session that wrote them.
- **Redraw the whole frame.** The camera zooms out, so no drawing can be cached and reused
  (ADR 0002). Cache only what does not depend on the zoom: the background, and one glow
  sprite per chip look.
- **The picture must stay a pure function of the elapsed time.** No counters, no
  "already drawn" sets. That is what makes `?at=` and the resize path correct for free.
- **Chips mark every number.** Composites are not hidden, they are emptied to rings. The
  ring pattern is the result of the sieve, so do not skip drawing them.
- **Keep the kink, keep the join.** Each hop is drawn a hair flatter than a half circle
  (`hopArc(hop, bulge)`), which keeps both ends exactly on their numbers while the ends tilt
  off vertical, so two hops meet at a small corner. `hopWobble` varies the bulge hop by hop.
  Never fake the kink by moving a hop off the line: that leaves a step, and the two halves
  stop meeting. The strand beside the core is shifted across the screen for the same reason,
  not along the radius, or it would jump sides at the crossing.

## Gotchas

- **`Number(null)` is `0`, not `NaN`.** A missing URL parameter read with
  `Number(params.get(name))` silently becomes 0 and then clamps to the minimum. Guard with
  `params.has(name)` first. This bug once made `limit` 12 instead of 120.
- **Angles run in canvas order.** Canvas y grows downwards, so a hop above the line sweeps
  from `-PI` up to `0` (through `-PI/2`, the top) and a hop below the line from `PI` down to
  `0`. With a bulge the ends stop a little short of `-PI` and `PI`. `hopSweep` owns all of
  this; do not re-derive it.
- **A hidden tab never fires `requestAnimationFrame`.** A headless browser without a shown
  window renders one frame and stops, so the animation cannot be watched that way. Use
  `?at=<number>` to capture any frame instead. On Windows a headless window also cannot go
  narrower than 500 pixels, so a phone-width layout cannot be screenshotted there either.
