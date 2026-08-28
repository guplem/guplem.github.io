# ADR 0003: Tell pencil marks from digits by measured size, and repair the rest with the rules

## Context

A screenshot from a real sudoku app is not a clean grid. A player who is midway
through a puzzle has written **pencil marks**: the small candidate digits they
note in a corner of a cell. Those marks are digits, in the same typeface, inside
the cells. A reader that takes any ink in a cell as its value fills the grid with
digits the player never placed.

Measured on a real screenshot, in the flattened grid where a trimmed cell is 32
pixels across:

| What it is | Tallest connected shape | Ink pixels |
|---|---|---|
| A placed digit | 22 to 23 pixels | 83 to 180 |
| A pencil mark | 3 to 9 pixels | 8 to 42 |
| The highlight on the selected cell | 32 pixels, filling the cell | 691 |

Two facts came out of that measurement. First, a placed digit is always **one**
connected shape of nearly the full cell height, while a cell of pencil marks is
several small shapes. Second, the sizes do not overlap: nothing sits between 9
and 22 pixels.

A second, separate problem: even with the marks gone, one digit in eighty-one may
still be read wrong, and a single wrong digit makes the coaching worthless.

## Decision

**Separate pencil marks from digits by size, calibrated on the grid being read;
then check the whole reading against the rules of sudoku and repair it.**

Size, in `vision/digits.js`:

1. Find the connected shapes inside each cell and take the tallest. A shape that
   fills the cell corner to corner is dropped first: that is a highlight, not a
   digit.
2. Keep a piece that sits directly above or below the tallest shape and overlaps
   it sideways. That is how a digit breaks apart when a thin stroke drops out of
   the threshold, and it is not how two pencil marks sit.
3. Measure how tall the digits of **this** grid are: the tall end of what the
   grid shows, taking the ninetieth percentile so one odd shape cannot move the
   mark.
4. A shape is a digit when it reaches both 35 percent of the cell and 55 percent
   of that measured height. The first test carries a grid that is all marks and
   no digits; the second carries a grid whose digits are drawn small.

Repair, in `recognize.js`: after reading, check the grid. A real puzzle has
exactly one solution. When the reading breaks a rule or cannot be completed, try
the cells the reader was least sure about, one and then two at a time, swapping
each for its runner-up digit or for blank, and keep the first change that makes
the grid a proper puzzle again. A reading that is already one proper puzzle is
never touched.

The page always shows the grid it read, marks the doubtful cells, says which
cells it repaired, and lets the player edit any of it.

## Consequences

**Positive:**

- On the real screenshot this was measured from, the reader now returns all 81
  cells correctly, with ten pencil-marked cells and a highlighted cell present.
- The size rule calibrates itself, so it holds for a small grid in a large
  screenshot as well as a full-screen one.
- Using only the tallest shape's pixels means a pencil mark that shares a cell
  with a digit never reaches the classifier at all.
- The repair step turns a common silent failure, one digit misread, into a
  correction the player can see.

**Negative:**

- A grid holding only pencil marks and no placed digits would read the marks as
  digits. The absolute floor of 35 percent limits this, and the rules check
  usually rejects the result, but it is not impossible.
- The repair can only fix a misreading that breaks the rules. A wrong digit that
  happens to leave the grid solvable passes through, which is why the page marks
  doubtful cells rather than hiding its uncertainty.
- The repair calls the solver several times, so a badly broken reading costs more
  work than a clean one. The search is bounded by the shortlist sizes.

## Scope

This covers the digit reading in this project. `vision/testFixtures.js` can draw
pencil marks and a selected-cell highlight at the sizes measured above, so the
tests hold this behaviour in place.
