# ADR 0001: The Reference Frame, Measured, Is the Spec (Prime Sieve Arcs)

## Context

This project started from a single screenshot of a video: a black field with glowing
arcs jumping along a number line, with numbers on chips. The request was an animation
in a "very similar art style", with the lines growing and jumping the numbers from
left to right. The frame carried no author, no title, and no explanation of the rule
behind the arcs, and a search for the source found nothing that matched.

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
values: a pale yellow-green core (`#e6e689`) with a red-orange strand beside it, and a
violet halo under each prime whose falloff was traced point by point.

Two consequences follow for the code:

- `sieve.test.js` pins the exact chains measured in the frame, so a change to the hop
  rule fails a test rather than drifting quietly.
- `render.js` carries the measured colours as constants with a comment saying where
  they come from.

## Consequences

**Positive:**

- The animation is a true rendering of a real algorithm, so the chips, the gaps and the
  growing fan all mean something. It teaches instead of decorating.
- The look was reproduced closely: the violet falloff of the finished render matches the
  frame within about 20% at every distance measured, and the geometry matches exactly.
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
- The frame fixes only the moment it captured. The timing of the source video, its camera
  behaviour over time and its ending were not recoverable, so those were designed here
  (see ADR 0002) and are not claimed to match the source.

## Scope

Specific to `prime-sieve-arcs`. The reusable principle: **when a visual request arrives
as an image with no explanation, measure the image before writing code.** A picture of a
mathematical object usually holds the rule that made it, and recovering that rule turns a
vague "make it look like this" into a specification that tests can hold in place.
