# Sudoku Screenshot Coach

Drop in a screenshot that has a sudoku somewhere in it. The tool finds the grid,
reads the digits, and tells you the next move to make and why that move is
forced. In English or Spanish.

It is a coach, not just a solver. Every hint names the technique a human player
would use, and the exact cells that force the move, so you can check it yourself
on the board.

## Features

- **Reads a screenshot, not just a clean grid.** The sudoku can sit anywhere in
  the picture, next to a header, a timer, buttons or an advertisement. Drop a
  file, paste from the clipboard with `Ctrl+V`, or choose a file.
- **Ignores your pencil marks.** The small candidate digits you write in the
  corners are measured and skipped, so they never become placed digits.
- **Reads highlighted cells.** Apps paint a block of colour behind the digit you
  picked, or behind the cell you are on. Each cell is read on its own, so the
  colour behind a digit does not hide it.
- **Fixes its own misreadings.** After reading, it checks the grid against the
  rules of sudoku. When a reading breaks them, it corrects the cell it was least
  sure about and tells you what it changed.
- **Explains the next best move.** It always offers the easiest technique that
  works on your grid, names it, explains how the technique works in general, and
  then names the cells that force it here.
- **Candidates you can trust.** The grid never lists a digit the tool can prove
  impossible, so the notes are as tight as a good player's from the moment you
  open it. Under the move, "how the candidates were narrowed" walks you through
  every elimination it applied and the technique behind each one.
- **Every cell explains its own notes.** Select a cell and the panel under the
  grid shows what the rules alone allow, what is still possible, and the
  technique that ruled out each of the rest. These notes are worked out from the
  grid and never read from your picture, so a shorter list than your sudoku app's
  means the tool proved something extra, not that it misread a digit.
- **Knows twenty-three techniques**, from Naked Single up through Swordfish,
  Jellyfish, the wings, Skyscraper, Simple Coloring, XY-Chain, Unique Rectangle
  and BUG+1. Every one has a plain-language description in the glossary at the
  bottom of the page. The last two argue from the puzzle having a single answer,
  so the coach uses them only after it has checked that the grid does.
- **Full solution too**, with every step in order, the technique each step used,
  and a difficulty rating drawn from the hardest technique the puzzle needed.
- **English and Spanish**, chosen from the picker or from your browser, and
  carried in the link.
- **Works on a phone and on a desktop.** Type with the keyboard or tap the digit
  pad under the grid.
- **Your picture is never uploaded.** It is read in your browser and never leaves
  your device. The only network calls the page makes are for the "deployed at"
  line in the footer: one to its own address, and up to two to GitHub.
- **Says when it was deployed**, and links the pull request that deployed it. If
  GitHub does not answer, the line still shows the date, read from the page's own
  headers, with a link to what changed.

## How to Run

Open `index.html` in a browser, or serve it with any HTTP server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/web-projects/sudoku-screenshot-coach/`.

No build step, no dependencies.

## Sharing a grid

The puzzle lives in the address bar, so any grid is a link:

```
?p=53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79&lang=es
```

## Tests

```bash
bun test
```

The sudoku engine and the whole image pipeline are covered. The image tests draw
their own synthetic screenshots, including pencil marks and a highlighted cell,
so no picture files are needed.
