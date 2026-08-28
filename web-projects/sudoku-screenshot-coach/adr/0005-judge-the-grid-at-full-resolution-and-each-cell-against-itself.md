# ADR 0005: Judge the grid at full resolution, and each cell against itself

## Context

Two screenshots from a phone failed. One found no grid at all; the other found a
patch of texture instead of the puzzle and read nonsense. Both were the same app
and the same puzzle as a screenshot that already worked, so the difference was
worth measuring rather than guessing.

Two separate causes came out of the measurements.

**The working resolution destroyed the rules.** The search shrinks an image so
its longest side fits a limit, then looks for connected shapes. A phone
screenshot is tall: 912 by 2046. Fitting 2046 into 900 scales the image by 0.44,
which shrinks the *width*, and the width is where the grid lives. A hairline rule
then falls below one pixel and averages into its neighbours. Measured on the two
failing images, at that size the vertical rules read between 0.10 and 0.39 of the
row as ink, far short of the 0.55 a rule needs:

| Longest side | Score, image 1 | Score, image 2 |
|---|---|---|
| 900 (the limit in use) | 0.75 | 0.70 |
| 1400 | 0.90 | 0.90 |
| full size | 1.00 | 1.00 |

The screenshot that already worked scored 0.75 at that size, exactly the minimum
it had to clear. It had been passing by a hundredth all along.

**A highlight behind a digit swallowed the digit.** The app paints a block of
colour on every cell holding the digit the player picked. The ink mask was taken
over the whole flattened grid, and a threshold judged that way marks the outer
band of such a block as ink, because the window it compares against reaches into
the white cells nearby. That band joins the digit into one shape that fills the
cell, and the shape is then thrown out as a highlight. Every cell of that kind
read as empty or as the wrong digit. Measured inside one such cell, the pixels
are cleanly split: 775 of them at brightness 176, the block, and 84 at 48, the
digit. The information was there. The threshold lost it.

## Decision

**Locate the grid on the small image, but score it on the full-resolution one.
Judge each cell against its own pixels, not against the page.**

For the grid:

- Connected shapes are still labelled on the downscaled image, because labelling
  every shape is the expensive step and finding a big square blob does not need
  detail.
- Each candidate's corners are then moved to full-resolution coordinates and the
  candidate is warped and scored there. Warping costs the same either way: the
  flattened square is 432 pixels on a side whatever the source is, so this is
  close to free.
- A candidate must also be mostly empty. A shape filled with ink has a dense row
  at every position, so it would pass for a rule everywhere and score perfectly.
  That is exactly what a block of highlight, or a dark page seen through the
  inverted pass, looks like. Anything covering more than half the square with ink
  scores zero.
- When two candidates score alike, the larger one wins. A small patch of texture
  can imitate a grid once it is blown up; the real puzzle is the biggest thing
  that looks like one.

For the cells: `cellInkMask` splits each cell by Otsu's method, the brightness
cut that best separates that cell's own pixels into two groups. A cell is a small
patch with at most two populations, so this is well suited to it. When the two
groups sit closer together than `MIN_CELL_CONTRAST`, the cell holds one shade
with a little wobble, which is an empty cell, plain or highlighted, and it is
reported as holding nothing.

## Consequences

**Positive:**

- All three real screenshots now read all 81 cells correctly, including ten
  pencil-marked cells, eight cells highlighted behind their digits, and a
  highlighted empty cell.
- A cell is read on its own terms, so what surrounds it in the page cannot change
  what it says. That is the property the old code lacked.
- The margin is no longer thin. The grids that scraped past at 0.75 now score
  1.00, so a slightly harder screenshot no longer tips over the edge.
- The empty-square check also removes a whole class of false positives that the
  line count alone would accept.

**Negative:**

- Scoring reads from the full-resolution image, so a very large photograph costs
  more memory traffic per candidate than before. The number of candidates is
  capped, and the flattened square is a fixed size, so the extra cost is bounded.
- Otsu assumes a cell holds two brightness groups. A cell crossed by a strong
  shadow, as a photograph taken at an angle might be, has three, and the cut
  would fall in the wrong place. Screenshots, the case this tool is for, do not
  do that.
- `MIN_CELL_CONTRAST` is a measured number, not a derived one. Too low and the
  noise in an empty cell becomes a digit; too high and a faint digit is lost. It
  sits at 45, between the 128 that separates a digit from its highlight and the
  wobble of about 12 that a flat cell shows.

## Scope

This covers the vision pipeline of this project. It refines ADR 0002, which chose
template matching over an OCR library, and ADR 0003, which separates pencil marks
from digits by size: both still hold, and both now work on a mask taken cell by
cell rather than across the whole grid.
