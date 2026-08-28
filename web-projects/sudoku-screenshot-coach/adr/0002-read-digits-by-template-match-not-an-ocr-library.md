# ADR 0002: Read the digits by template match, with shapes the tool carries itself

## Context

The tool must read a sudoku out of a screenshot that also holds other things: a
header bar, a timer, buttons, an advertisement. Two steps are needed, finding the
grid and reading the digits, and the second one is where a normal answer would be
"use an OCR library" (OCR is optical character recognition, software that turns a
picture of text into text).

The options for reading the digits:

- **An OCR library, such as Tesseract compiled to WebAssembly.** It handles any
  text in any layout. It also downloads several megabytes, starts slowly, and is
  built for words: on single digits with no surrounding context it is easy to get
  wrong answers, and tuning it is a black box. Root ADR 0002 rules out a build
  system, so it would come from a CDN at page load.
- **A small neural network shipped as weights.** Accurate, but the weights are a
  binary blob nobody in this repository can read or change, and training one
  needs tooling this project does not have.
- **Template matching.** A sudoku holds nine shapes only, drawn large and clean
  inside a known cell. Normalise each cell to a small fixed picture, compare it
  with pictures of the digits 1 to 9, and take the nearest.

For the reference pictures there was a further choice. The first version drew
them with the browser's own typefaces, which is free and matches whatever the
device shows. Measured on a font-poor machine, that failed: every family fell
back to one face whose "1" carries a foot serif, so a plain "1" from a sudoku app
matched "4" better than it matched "1". A tool that must run on any phone or
desktop cannot depend on which fonts the device installed.

## Decision

**Read the digits by template match, and carry the digit shapes in the
repository.**

- `vision/digits.js` normalises a cell to a 16 by 16 picture of ink coverage and
  picks the nearest reference by squared distance, with a small penalty for a
  different width-to-height ratio. It reports the runner-up and a confidence,
  which later steps use.
- `vision/fonts.js` builds the references two ways and merges them: from the
  browser's typefaces, which matches the device when it has good fonts, and from
  `vision/builtinDigits.js`, a table of stroke paths this project owns. The
  built-in table carries the variants that typefaces really disagree on: a 1 with
  and without a foot, a 7 with and without a bar, a 9 with a straight and a
  curled tail.
- Nothing is downloaded at run time and nothing leaves the device.

## Consequences

**Positive:**

- The reader works the same on every device, because the shapes travel with it.
- It is fast: no library to fetch, no model to start.
- A wrong reading is explainable. It is a nearest-match distance between two
  pictures, and both pictures can be printed and looked at.
- The whole path is pure and testable. `vision/testFixtures.js` draws a synthetic
  screenshot with a pixel font, and the tests read it back through the same
  `normalizeGlyph` the page uses.

**Negative:**

- It reads printed digits only. Handwriting in a photo of a newspaper is out of
  reach, and so is any glyph far from the shapes carried here.
- New shape variants must be added by hand to `builtinDigits.js`.
- Template matching gives no confidence guarantee of its own. That gap is covered
  by the repair step in `recognize.js`, which checks the reading against the
  rules of sudoku and corrects the cells the reader was least sure about, and by
  the page always letting the player edit the grid.

## Scope

This covers the digit reading in this project. The grid finding step
(`vision/detect.js`) is separate: it uses connected shapes and line counting, and
does not depend on this decision.
