# ADR 0001: Explain moves with human techniques, not with the solver's answer

## Context

The tool must tell a player the next move **and why that move is right**. A
backtracking solver can give the answer for any cell in milliseconds, but it
cannot say why. Its reason is always the same: "because the search says so."
That teaches nothing and a player cannot check it on the grid.

Three options were open:

- **Answer from the solver.** Show the digit the solved grid holds. Fast and
  always available, but the reason is unusable.
- **Answer from a general constraint engine.** Report the propagation step that
  fixed the cell. Closer to a reason, but the steps are machine steps
  (arc-consistency passes), not the moves a player knows by name.
- **Answer from the techniques a human uses.** Search the grid for the named
  patterns players learn, easiest first, and report the first that applies.

## Decision

**The coach explains with human solving techniques, and the solver is used only
to check the grid and as a last resort.**

`techniques.js` holds thirteen techniques, ordered by how hard they are:
naked single, hidden single, pointing, claiming, naked pair, hidden pair, naked
triple, hidden triple, naked quad, X-Wing, Y-Wing, Swordfish, XYZ-Wing.

Each technique is a `find(state)` function that returns a **Move** or null. A
Move carries the placements and eliminations it forces, and, just as important,
the evidence: the cells that form the pattern, the houses it lives in, and the
placed digits that block every other option. `explain.js` turns that evidence
into sentences that name the cells, so the player can verify the move on the
board without trusting the tool.

"Next best move" means **the easiest technique that makes progress**, the rule a
teacher follows. A player who is stuck rarely needs a clever pattern; they need
the simple move they missed.

The solver (`solver.js`) has three jobs and no others: prove the grid is legal,
prove the solution is unique, and finish a grid that runs past all thirteen
techniques. When the coach falls back to the solver, it says so plainly instead
of pretending it reasoned the digit out.

## Consequences

**Positive:**

- Every hint is checkable. The explanation names the exact cells that force it.
- The player learns a technique by name, which transfers to the next puzzle.
- The difficulty rating comes free: the hardest technique a solve needs is a
  meaningful measure, and it matches how puzzle apps label their puzzles.
- Techniques are pure functions over a candidate grid, so they are unit-testable
  one pattern at a time.

**Negative:**

- The catalogue is not complete. Puzzles that need chains, unique rectangles or
  other advanced patterns run out of techniques, and the coach must fall back to
  the solver for those cells.
- Every technique needs its own explanation and its own translations. Adding one
  is more work than extending a general solver.
- A technique with a wrong rule would give a confident wrong reason. This is
  guarded by the soundness sweep in `techniques.test.js`: across dozens of
  generated grids, no technique may ever eliminate a candidate that the real
  solution puts in that cell, or place a digit the solution disagrees with. That
  test would catch a wrong rule that no hand-written example covers.

## Scope

This decision covers this project only. The technique catalogue and its
explanations are the product here, so the cost of writing them is the point, not
overhead.
