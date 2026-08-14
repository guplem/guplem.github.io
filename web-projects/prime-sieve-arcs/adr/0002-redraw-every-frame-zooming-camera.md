# ADR 0002: Redraw Every Frame, Because the Camera Zooms Out (Prime Sieve Arcs)

## Context

The animation only ever adds marks. By the time the scanner reaches 60 there are a few
hundred arcs on screen, and the count keeps climbing. Each arc needs three strokes with
additive blending to get the glow, so the cost of one frame is the whole picture.

That invites caching: stroke each finished arc once onto a kept canvas and never touch it
again, the way a long-exposure photograph builds up. It works only while the mapping from
numbers to pixels holds still.

The reference frames settle that question. Measuring the number spacing across three
frames of the same run gives 97, 68 and 26 pixels a number, while the count of numbers on
screen goes 20, 29, 78. **The camera zooms out as the picture grows**, keeping 1 pinned at
the left and the leading pen near the right edge. Number 1 never moves; every other number
slides left and the arcs shrink with them.

That is also the shape of the thing. The fan growing to the right, with tiny loops at the
left and wide arcs at the right, only reads if the whole sweep is visible at once.

## Decision

**Redraw the whole picture every frame at the current zoom.** No cached arc layer.

- Only the background (dust, motes, vignette, number line) is cached, because it does not
  depend on the zoom. It is repainted on a resize.
- The chip glow is one small sprite per look, stretched to whatever size a chip needs. It
  costs one `drawImage` instead of building a gradient for every chip on every frame.
- The glow on the arcs is three strokes of decreasing width in `lighter` blend mode. No
  `shadowBlur` anywhere: it is far cheaper and matched the measured colours better.
- Arcs and chips that fall past the right edge are skipped rather than drawn and clipped.

The cost stays comfortable because the pens run ahead of the scanner, so a sweep to 60
draws roughly 150 arcs plus 130 chips, and one to 120 roughly 400 arcs. At about three
strokes an arc that is a few hundred strokes a frame, well inside a 60 frames a second
budget on a phone.

The gain that pays for the redraw: **the picture is a pure function of one number, the
seconds elapsed.** Nothing accumulates, so any moment can be drawn directly. That is what
makes `?at=<number>` work, and it is the only reason the render could be checked at all in
the session that wrote it, since a hidden browser tab never fires
`requestAnimationFrame`.

The camera keeps two rules:

- It fits `CAMERA_FILL` (0.92) of the leading pen, so the picture is a crop with arcs
  running off the right edge, as in the frames.
- It never shows fewer than `MIN_SPAN` (20) numbers. The opening frame of the reference
  shows about 20 numbers waiting while a single line hops over the first few, and without
  a floor the camera would instead open on a giant close-up of 1, 2 and 3.

## Consequences

**Positive:**

- The zoom-out is free, and with it the self-similar growth that the reference frames show.
- Any frame can be produced on demand: deep links, screenshots, and a still picture for
  readers who ask for reduced motion.
- No cache to invalidate. A resize is just a new frame, so the resize path cannot drift out
  of step with the animation path.
- No state accumulates in the renderer, so pausing, seeking and restarting are all the same
  operation: change the elapsed time.

**Negative:**

- Cost per frame grows with the picture, unlike a cached layer. A very large `limit` (the
  parameter allows up to 1200) would eventually drop frames; the default is sized to the
  window instead, and the sweep loops before it gets heavy.
- The glow cannot build up by accumulation, so it is tuned by hand to match the frames
  rather than emerging from repeated strokes.
- Every arc is stroked again for every frame it stays visible, which is wasted work in the
  strict sense. It buys the zoom, and the zoom is the look.

## Scope

Specific to `prime-sieve-arcs`. The reusable principle: **a moving camera and a cached
drawing layer cannot both be had.** Decide which one the design actually needs before
reaching for the cache, because a zoom that arrives later invalidates every pixel kept.
