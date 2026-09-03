# ADR 0002: Find the background by colour from the frame edges

## Context

A sticker is a cut-out. WhatsApp's own first line about them says so: "A sticker
is an image that has a transparent background". So the tool's most important job
is removing a background, and the quality of that one step decides whether the
result looks like a sticker or like a photograph in a box.

Every tool that does this well runs a trained segmentation model. The model has
learned what a person, a pet or a bottle looks like, so it can cut round hair and
between fingers. Nothing here can match that, and pretending otherwise would be
the wrong promise to make.

A model is not available. Root ADR 0002 rules out a build step, so it would come
from a content delivery network at page load: several megabytes before the page
works, a second network dependency, and the reader's photograph passing through
code nobody in this repository can read. Sending the photo to a service is worse
again, and would break the promise every sibling project here makes.

## Decision

**Solve the smaller problem honestly, rather than the larger one vaguely.**

The tool does not look for a subject. It looks for the background, defined as
*the region that touches the edge of the frame and holds together by colour*. For
the photographs people actually turn into stickers, a subject against a wall, a
floor or the sky, that is the same answer a model would give. When it is not, the
brush and the tolerance move the line: **automatic detection is a first guess,
not a verdict**, and the interface is built around correcting it.

**The fill takes a pixel only when two separate tests agree, and each covers the
other's blind spot.**

- **The neighbour test** (`tolerance`) asks whether a pixel is close in colour to
  the one the fill arrived from. This carries the fill across a background that
  shades from light to dark, where the far side no longer resembles the corner it
  started from. On its own it walks up any gradient, including one leading into
  the subject.
- **The border test** (`edgeTolerance`) asks whether a pixel is close to a colour
  the border of the picture actually held. This stops the fill halfway up that
  gradient. On its own it fails on any background that is not one flat colour.

Each test has a test of its own that fails if the other is removed.

**Colour is measured in CIELAB, not RGB.** CIELAB is built so that equal steps
look like equal steps, which is what a tolerance has to mean. The same RGB step
of 52 reads as deltaE 13.4 in shadow and 10.6 in highlight, and a test pins both
numbers. In RGB one tolerance setting therefore behaves differently in a dark
photograph and a bright one, and the slider feels broken. Distance is plain
CIE76, not CIEDE2000: this runs over every pixel on every drag, and CIE76 is
close enough to guide a fill.

**Three faults are cleaned up afterwards, because every threshold detector has
them.**

1. Speckle, a few stray pixels on the wrong side of the line, on either side.
   `removeSmallIslands` and `fillHoles` clear both. A pocket that reaches the
   border is the background itself and is never filled.
2. A one pixel hard edge, which reads as cut with scissors. `feather` softens it.
3. The part-way pixels a lens leaves at any real boundary. `refineEdgeAlpha`
   measures the mixture instead of forcing each pixel to be all subject or all
   background: it takes the confident subject colour and the confident background
   colour nearby and asks where between them the pixel sits. Keeping those pixels
   rings the sticker in wall colour; dropping them loses its outline.

**The person can always paint.** A brush erases or brings back, with a softness
so a repair blends into a feathered edge; a magic wand takes everything of one
colour; and twelve steps of undo are kept. The brush is sized in sticker pixels
and divided by the placement scale, so a zoomed-in brush does not paint a giant
patch.

## Consequences

- **A subject touching the edge of the frame is taken as background.** That is the
  definition working as written. The "keep the whole picture" and brush controls
  are the answer, and the hint under the picker asks for a photograph with the
  subject away from the edges.
- **Hair, fur and anything translucent are where this loses to a model.** The
  edge refinement helps and does not solve it.
- **A picture of one flat colour would swallow itself.** Every pixel passes both
  tests, and the honest result is an empty sticker. So a fill that takes
  everything is discarded and the picture is handed back whole, for the person to
  cut by hand.
- **A pixel that arrived transparent is background whatever its colour.** A PNG
  already cut out somewhere else keeps its holes rather than having them filled
  back in.
- **The two clean-up limits scale with the picture's area**, so they mean the same
  thing on a thumbnail and on a full sized photograph.
- **Every step is a pure function over a plain array with an explicit width and
  height.** No canvas, no `ImageData`. That is what lets all of it be tested under
  Bun with synthetic pictures built in the test file, the way
  `sudoku-screenshot-coach/vision/testFixtures.js` does, and root ADR 0012
  requires.
- **The tolerance sliders re-run the search; the brush does not.** Detection is
  the expensive step, so it runs on `change` rather than `input`, and only when a
  mask already exists.
- **Working size is capped at 1024 pixels on the long side.** A phone photograph
  is 4000 across, and every pass over its pixels would cost thirty times what a
  512 pixel result needs.
