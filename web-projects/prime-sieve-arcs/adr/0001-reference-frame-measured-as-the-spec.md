# ADR 0001: The Reference Frames, Measured, Are the Spec (Prime Sieve Arcs)

## Context

This project started from a single screenshot of a video: a black field with glowing
arcs jumping along a number line, with numbers on chips. The request was an animation
in a "very similar art style", with the lines growing and jumping the numbers from
left to right. The frame carried no author, no title, and no explanation of the rule
behind the arcs, and a search for the source found nothing that matched.

Three more frames of the same run arrived after the first version shipped, and they
settled the parts one frame could not show: what the animation does over time. They are
described in `AGENTS.md` under "What the later frames added", and they forced two changes
that are recorded here and in ADR 0002.

So there were two unknowns: **what the picture means**, and **how it is drawn**. Both
had to be settled before any code, because they decide everything else: the geometry,
the timing, the camera and the palette.

Options considered:

1. **Guess a plausible rule and match the mood.** Fast, and a viewer might not notice.
   But the picture would mean nothing, the numbers on the chips would be decoration,
   and any later change would have no standard to answer to.
2. **Ask the person who asked for it.** They had a screenshot, not the maths. The
   request was also explicitly to work autonomously.
3. **Measure the frame and recover the rule from it.** Slower up front. It gives an
   exact answer, and the answer keeps paying off later.

## Decision

**Recover the construction from the pixels, then treat the measured frame as the
specification.** The frame is committed at `reference/inspiration-frame.webp` and is
never deleted. No page links to it, so it stays out of the site while staying next to
the code that it explains.

How the rule was recovered:

- A **Hough transform** (a way to find shapes in an image) was run over the frame,
  scored against half circles centred on the number line, once for the upper half and
  once for the lower half. Full circles scored almost nothing; half circles scored
  1.00 on 173 candidates. So the shapes are half circles that sit on the line.
- Grouping those by radius showed that **every arc diameter is exactly a prime**, and
  that arcs of the same diameter chain end to end: `2^4 4v6 6^8`, `3^6 6v9 9^12`,
  `7^14 14v21 21^28`, and so on, alternating above and below the line.

That is the **Sieve of Eratosthenes**: every prime hops over its own multiples, and a
number that no hop lands on is prime. The numbers on the chips are the primes, in
their true positions on a linear number line at 23.1 pixels per number.

The palette was read straight out of the same frame, and the code carries the measured
values: a pale warm core with a red-orange strand beside it, over a glow on the number line
whose falloff was traced point by point.

The later frames added the behaviour over time, and each point became a rule in the code:

- **Every number is on screen from the start**, as a white chip with its digits. A chip
  empties out to a bare ring once a hop lands on it, and turns amber once its own chain
  leaves. So the picture shows candidates, decided primes and crossed-out composites at a
  glance, and the numbers that vanish are exactly the composites.
- **Two speeds, not one front.** The pens are staggered, and a chain launches well behind
  the leading arcs. That is a scanner walking the line slower than the pens draw. The
  scanner decides: whatever it lands on with nothing crossing it is prime. Because every
  pen is faster than the scanner, the chain of a composite's smallest prime factor always
  gets there first, so the scanner can never be wrong. `crossTime` and its tests hold that
  margin for any ratio above 1.
- **The camera zooms out**, keeping 1 at the left. See ADR 0002.
- **The lines are not smooth where they cross.** The two halves do meet on the number, but
  the line has a corner there. Each hop is drawn a hair flatter than a half circle, which
  keeps its ends on their numbers and tilts them off vertical; `hopWobble` varies it. This is
  a signature of the source, not a defect to fix. The first attempt shifted whole hops off
  the line instead, which left a visible step, and a step is a defect.

Two consequences follow for the code:

- `sieve.test.js` pins the exact chains measured in the frame, so a change to the hop
  rule fails a test rather than drifting quietly.
- `render.js` carries the measured colours as constants with a comment saying where
  they come from.

## Consequences

**Positive:**

- The animation is a true rendering of a real algorithm, so the chips, the gaps and the
  growing fan all mean something. It teaches instead of decorating.
- The look was reproduced closely: the geometry matches exactly, and the glow falloff of the
  finished render was matched against the frame to within about 20% at every distance
  measured.
- Any future change to the look has a reference to answer to, which is committed and
  will not disappear.
- The measurement itself was cheap to redo and is written down in `AGENTS.md`, so nobody
  has to guess again.

**Negative:**

- The recovery took real work up front, before a single line of the animation existed.
- The frame is a third-party video still with an unknown maker, kept for reference. It is
  unlisted, but it does sit in a public repository. Should the maker ever object or be
  identified, the file is one delete or one credit away, and nothing in the code depends
  on it at runtime.
- A frame fixes only the moment it captured. The first version had to invent the behaviour
  over time and got the camera wrong (it held still) and the pens wrong (one shared front).
  The later frames corrected both. The exact speeds of the source are still unknown: the
  ratio of pen speed to scanner speed was fitted so that the composition matches the frames,
  not derived.
- Only the first frame is committed. The three later ones arrived as pasted images with no
  files behind them, so they live in this repository as the written measurements above
  rather than as pictures.

## Scope

Specific to `prime-sieve-arcs`. The reusable principle: **when a visual request arrives
as an image with no explanation, measure the image before writing code.** A picture of a
mathematical object usually holds the rule that made it, and recovering that rule turns a
vague "make it look like this" into a specification that tests can hold in place.
