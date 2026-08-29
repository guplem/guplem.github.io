# ADR 0007: Uniqueness techniques run only on a grid with one answer

## Context

The catalogue grew from 13 techniques to 23. Two of the new ones, Unique
Rectangle and BUG+1, are not like the rest.

Every other technique argues from the rules of sudoku alone. A Naked Pair is true
of any grid, finished or not, correct or not. These two argue from something
outside the rules: **this puzzle has exactly one answer**. A Unique Rectangle says
that four cells cannot end up holding only two digits, because the two digits
could then be swapped around the rectangle and the puzzle would have a second
answer. BUG+1 says the same thing in another shape.

That argument is sound for a published puzzle. It is wrong for a grid that has
two answers, and the tool meets such grids all the time:

- The reader misses a clue in a screenshot, so the grid it hands the coach is a
  weaker puzzle than the real one. Very often that grid has several answers.
- The player types a grid in by hand and has not finished.
- The player clears a cell to check something.

On any of those, an ungated Unique Rectangle can remove a candidate that one of
the real answers needs. The tool would then be lying with confidence, which is
the one thing the whole project is built not to do.

The soundness sweep in `techniques.test.js` cannot catch this either. It builds
its grids by punching random holes in a solved grid, so many of them have several
answers. A correct uniqueness technique would fail that sweep, and a check
written to let it pass would stop testing anything.

## Decision

**A technique that argues from uniqueness runs only when the caller has proved
the grid has exactly one solution.**

- The state every technique reads carries a `unique` flag. `makeState` defaults
  it to **false**, so the proof has to be supplied, never assumed.
- `findUniqueRectangle` and `findBugPlusOne` return `null` at once when the flag
  is false. Nothing else in the catalogue reads it.
- The coach supplies the proof. `nextHint` and `solvePath` already run
  `analyseBoard`, which counts solutions, and set the flag from
  `status === "ok"`. `reduceCandidates` calls `hasOneSolution` itself when the
  caller does not pass an answer, so a caller cannot get the unsafe behaviour by
  forgetting.
- The soundness sweep keeps its random grids and therefore keeps `unique` false.
  A second sweep digs holes only while the grid still has one completion, and
  runs the two uniqueness techniques against that.

## Consequences

**Positive:**

- The two techniques are used exactly where their reasoning holds. On the grid a
  player reported, the Unique Rectangle is what finally cracks it.
- A misread screenshot degrades safely. The grid loses the two techniques, keeps
  the other 21, and never gets an unsound elimination.
- The gate is one flag with one default, so a new uniqueness technique gets the
  protection by reading the same flag.

**Negative:**

- `reduceCandidates` now counts solutions on every board change, because it works
  the flag out for itself. Measured at about 78 ms for the reported grid, against
  9 ms before the catalogue grew. Still cheap enough for a keystroke, and still
  off the render path.
- The techniques are silent on a grid with several answers even when their
  eliminations would happen to be harmless. That is the right trade: the tool
  cannot tell the harmless case from the wrong one without solving the puzzle
  twice.
- A caller that builds a state by hand and forgets the flag loses the two
  techniques quietly. Silence is the safe failure, but it is silent, so the
  fixture-driven tests in `techniqueFixtures.js` set the flag on purpose and a
  test checks both techniques go quiet without it.
