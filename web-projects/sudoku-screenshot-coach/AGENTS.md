# web-projects/sudoku-screenshot-coach/AGENTS.md

Reads a sudoku out of a screenshot and explains the next move with the technique
a human player would use, in English or Spanish. Vanilla ES modules, no build
step, nothing fetched at run time.
Human docs: [README.md](README.md). Decision records: [ADR 0001](adr/0001-explain-with-human-techniques-not-a-solver.md),
[ADR 0002](adr/0002-read-digits-by-template-match-not-an-ocr-library.md),
[ADR 0003](adr/0003-tell-pencil-marks-from-digits-by-measured-size.md),
[ADR 0004](adr/0004-one-message-catalogue-for-generated-explanations.md),
[ADR 0005](adr/0005-judge-the-grid-at-full-resolution-and-each-cell-against-itself.md).

## Module map (pure logic is separated from the DOM so it can be unit-tested)

| File | Pure? | Responsibility |
|---|---|---|
| `board.js` | yes | The 9x9 model: houses, peers, candidate masks, parse and format, conflict checks. |
| `solver.js` | yes | Backtracking solver. Proves a grid is legal, unique, and finishes what techniques cannot. |
| `techniques.js` | yes | The 13 solving techniques. Each `find(state)` returns a Move with its evidence, or null. |
| `explain.js` | yes | Move plus evidence to sentences, through `i18n.js`. Writes no text of its own. |
| `coach.js` | yes | Picks the next best move, walks a whole solve, rates difficulty. |
| `recognize.js` | yes | Screenshot to 81 digits: joins the vision steps, then repairs the reading with the rules. |
| `i18n.js` | yes | The one message catalogue, `t()` and `joinList()`. Root of all text. |
| `urlState.js` | yes | Parse and serialize `p` (puzzle), `m` (mode) and `lang`. Root ADR 0006. |
| `vision/imaging.js` | yes | Grayscale, downscale, integral image, adaptive threshold, dilate. |
| `vision/detect.js` | yes | Connected shapes, corner finding, homography, warp, grid scoring. |
| `vision/digits.js` | yes | Cell cropping, per-cell thresholding, shape picking, glyph normalising, nearest-template match. |
| `vision/builtinDigits.js` | yes | Digit shapes as stroke paths, so the reader needs no system font. |
| `vision/fonts.js` | no | Draws the reference pictures on a canvas, from device fonts and the built-in paths. |
| `vision/testFixtures.js` | yes | Test-only. Draws synthetic screenshots with clutter, pencil marks and highlights. |
| `app.js` | no | DOM controller: input, board painting, coaching output, language switch. |
| `*.test.js` | no | Bun tests. Run `bun test` here. |

Data flow: `app.js` gets an image -> `recognize.readPuzzleFromImage` ->
`vision/detect.findGrid` (locate and flatten) -> `vision/digits.readGrid` (read
81 cells) -> `recognize.repairReading` (check against the rules) -> the player
edits -> `coach.nextHint` -> `techniques` find a Move -> `explain` writes it ->
`app.js` paints it.

## Non-obvious conventions and gotchas

- **A technique must never guess.** A Move reports only what the rules force,
  plus the evidence that forces it. The soundness sweep in `techniques.test.js`
  runs every technique against dozens of generated grids and fails if any move
  ever eliminates a candidate the real solution needs. Add a technique and that
  sweep covers it at once. Do not weaken it.
- **`explain.js` contains no sentences.** Every string is a key in `i18n.js`.
  Adding a technique means adding `technique.<id>.name`, `.summary`, `.how` and
  its explanation keys in **every** language, or `i18n.test.js` fails. See ADR 0004.
- **Phrase a message so its slots keep their order in every language.** The
  explanation code fills slots by name and never reorders them.
- **`normalizeGlyph` must ignore ink outside the box it is given.** A narrow
  digit such as a 1 is scaled up a lot, and without that hard edge the sampling
  reaches sideways into other ink in the cell. That bug turned a real 1 into a 4.
  There is a test for it; do not remove the bounds check.
- **Pencil marks are told from digits by height, not by position.** Take the
  tallest connected shape in the cell, then compare it with the digit height
  measured across this grid. The numbers behind the thresholds are in ADR 0003,
  measured from a real screenshot. Change them only against new measurements.
- **The reference pictures must not depend on device fonts.** `fonts.js` merges
  the browser's typefaces with the built-in stroke paths. On a machine where
  every family falls back to one face, the built-ins are all that keeps the
  reader working. See ADR 0002.
- **The grid finder tries both polarities and three amounts of gap-closing.** A
  dark-mode screenshot is a light grid on a dark page, and a hairline rule breaks
  into pieces unless the ink is grown first. The winner is the candidate whose
  flattened square really holds ten lines each way, not the biggest shape.
- **Candidates are found on the small image but scored on the full-size one.**
  Do not move the scoring back onto the downscaled image to save time. A phone
  screenshot is tall, so fitting its longest side to the working limit shrinks
  the width by more than half, and a hairline rule averages away. Measured, the
  same grid scores 0.70 small and 1.00 full size. See ADR 0005.
- **A candidate must be mostly empty, not just full of lines.** A solid block has
  a dense row at every position and would score a perfect grid. The ink-share
  check is what rejects it; keep it ahead of the line count.
- **Each cell is thresholded against its own pixels** (`cellInkMask`, Otsu). An
  app paints a block of colour behind a digit, and a threshold taken across the
  page marks part of that block as ink, where it merges with the digit into one
  cell-filling shape. Never go back to a single mask for the whole grid.
- **The coach always offers the easiest technique that applies.** That ordering
  is the product, not an implementation detail. `TECHNIQUES` is sorted by rank
  and `findEasiestMove` takes the first hit.
- **An elimination move changes no digit.** The "apply" button walks past
  eliminations to the first placement they make possible, or says plainly that
  the grid does not change yet.
- **All external text is escaped through `escapeHtml` before `innerHTML`.** The
  explanations are generated, but they carry digits and cell names built from
  user-editable state. Keep the escaping.

## Adding a technique

1. Write `find(state)` in `techniques.js`, returning a Move with its evidence.
2. Add the catalogue entry with its `id`, `rank` and `categoryKey`.
3. Add `technique.<id>.name`, `.summary` and `.how` to `i18n.js` in every language.
4. Add an explainer to `EXPLAINERS` in `explain.js` and its sentence keys.
5. Write a focused test that builds a candidate grid holding just that pattern.
   The soundness sweep then covers it automatically.
