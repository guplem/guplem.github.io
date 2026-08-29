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

The first attempt at a fix kept the plain candidates on screen and let the player
apply each elimination themselves. The reasoning was that reducing everything on
load would erase the teaching: on the reported puzzle, applying every elimination
the catalogue can prove leaves **no move at all**, so the coach runs out and falls
back to the verified solution.

The player reported the same 5s again. The grid still opened showing them, marked
as struck through because the first hint was the very move that removes them, and
that mark is too quiet to read at the size candidates are drawn. The reasoning
above was also wrong in its own terms: the teaching was not the *doing* of the
elimination, it was the *explanation* of it, and an explanation does not need the
player to press anything.

## Decision

**The grid never shows a candidate the coach can rule out, and the eliminations
are taught as the reason it looks that way.**

- `state.cands` is derived from the board by `reduceCandidates`, every time the
  board changes. It is never edited in place, so it cannot be stale, and it can
  never be reasoning left over from a grid the player has since corrected.
- `nextHint(board, lang, cands)` reads the same set. Since every provable
  elimination is already applied, the coach offers placements, or says honestly
  that its catalogue is exhausted. It can no longer contradict the grid, and it
  can no longer repeat itself.
- `reduceCandidates` returns **each elimination it applied, explained**, in the
  order it applied them. The page lists them under the move as "how the
  candidates were narrowed". Selecting one shows the technique, the cells that
  force it, and highlights them on the grid, exactly as a hint would.

So nothing is lost. Every Pointing Pair, Claiming and wing the catalogue can find
is still named and still explained. What changed is the tense: the coach used to
say "do this next", and now says "this is why that digit is gone".

## Consequences

**Positive:**

- The grid is truthful with nothing pressed. On the reported puzzle it opens with
  exactly the notes the player's own app showed, in all four cells where the two
  disagreed.
- The grid and the advice can no longer contradict each other, in any state.
- The candidates are a pure function of the board again, so no sequence of edits
  can leave them wrong.
- The elimination techniques are still all taught, and are now easier to study:
  they sit in a list the player can walk through, instead of appearing one at a
  time only if the player keeps pressing.

**Negative:**

- On a puzzle past what the catalogue can prove, the coach reaches "no technique
  applies" immediately rather than after a few elimination steps. It gets there
  either way; it is just faster and blunter now. The narrowing list is what keeps
  that from feeling empty.
- Reduction runs the whole technique search repeatedly until nothing more can be
  removed, on every board change. Measured at about 9 ms for a grid with 34 empty
  cells, against 0.01 ms for the plain candidates. That is cheap enough for a
  keystroke, but it is a thousand times the cost, so it must stay off the render
  path and be done only when the board really changes.
- A player who wants to practise spotting eliminations themselves no longer can:
  the grid hands them the answer. The narrowing list explains each one, which
  serves learning, but it does not test it.
