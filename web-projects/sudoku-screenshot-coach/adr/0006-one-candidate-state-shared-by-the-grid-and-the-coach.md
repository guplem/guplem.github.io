# ADR 0006: One candidate state, shared by the grid and the coach

## Context

A player reported that the candidate grid showed a 5 in r7c6 and r9c6 that their
sudoku app did not show. The reading of the screenshot was correct, and so were
the candidates by the rules alone: nothing in those rows, columns or boxes held a
5 yet.

The coach disagreed with its own grid. The first move it offered on that puzzle
was a Pointing Pair that ruled out exactly those two 5s. So the tool could prove
the 5s impossible, and displayed them anyway.

Two things caused that:

- The grid drew the **plain** candidates, worked out from the rules alone, every
  time it rendered. The coach worked out its move from the same plain candidates,
  then threw the result away.
- Nothing kept an elimination once it was applied. The "apply" button had no way
  to show an elimination, because the board does not change, so it quietly
  searched forward for the next move that *placed* a digit and did that instead.
  A player pressing it on a Pointing Pair saw a digit appear somewhere else, and
  never saw the candidates it was told about leave the grid.

The question was not only how to fix the display. Fully reducing the candidates
on load was the obvious answer, and it is wrong. On the reported puzzle, applying
every elimination the catalogue can prove leaves **no move at all**: the coach
runs out and falls back to the verified solution. Reducing by default would erase
the teaching, which is the product.

## Decision

**The page holds one candidate state. The grid draws it and the coach reads it.**

- `state.cands` starts as the plain candidates and travels with the board.
- `nextHint(board, lang, cands)` takes it, so the coach never offers an
  elimination that has already been applied.
- Applying an elimination now applies it. The candidates leave the grid, in
  front of the player, and the coach moves on to the next step.
- `reduceCandidates(board, cands)` applies every elimination the catalogue can
  prove, in one go. It is offered as a button, **not** run automatically, for the
  reason above. It reports how many candidates went and which techniques took
  them, so the player learns what happened rather than watching numbers vanish.

When the board changes, the candidates follow the change:

- A digit the **coach proved** keeps the eliminations already applied. They were
  proved from the same grid and still hold.
- A digit the **player typed** throws them away and starts again from the rules.
  The player may be correcting a misread clue, and an elimination reasoned from a
  wrong grid is worthless.

## Consequences

**Positive:**

- The grid and the advice can no longer contradict each other. Whatever the coach
  can prove is what the grid shows, once the player has taken the step.
- An elimination is finally visible. Pointing Pairs, Naked Triples and the rest
  teach something, instead of quietly skipping to a placement.
- A player who only wants notes as good as their app's presses one button. On the
  reported puzzle that produces exactly the notes the app showed, in all four
  cells where the two disagreed.
- The coach stops repeating itself, because an applied elimination is gone from
  the state it reads.

**Negative:**

- The candidate state is now real state, so it can be stale in a way a derived
  value cannot. The rule above, on which edits keep it and which throw it away,
  is the whole defence, and it errs towards throwing away.
- Pressing the reduce button can end the coaching on a hard puzzle, as it does on
  the reported one. That is honest, but it is a sharp edge: the button says what
  it does, and the coach then says plainly that its catalogue is exhausted.
- Reduction runs the whole technique search repeatedly until nothing more can be
  removed. It is bounded by the number of candidates on the grid, and it only
  runs when the button is pressed.
