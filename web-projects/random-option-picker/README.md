# Random Option Picker

A sleek, shareable web tool that picks one or more random options from a list. Same seed, same result -- so a single link reproduces the same draw.

## Features

- **In-page editor** -- type your options in a textarea, the URL updates live so any link is shareable
- **Slot-machine reveal** -- vertical reels spin and ease to a stop on the picked option(s)
- **Configurable count** -- pick more than one option in a single draw, with an "Ensure distinct" toggle (on by default) to disallow repeats
- **Optional seed** -- fix a seed in the URL for reproducible picks (e.g. one seed per day for a daily moderator). Leave blank for a fresh random pick each time.
- **Copy share link** -- one click puts the current state on the clipboard

## How to Run

No build step required. Serve the folder with any HTTP server:

```bash
# From the repository root
python -m http.server 8000
```

Then open `http://localhost:8000/web-projects/random-option-picker/` in a browser.

Alternatively, open `index.html` directly in a browser -- all assets are self-contained.

## Tests

Logic is covered by tests using Bun's built-in test runner.

```bash
# From the project folder
bun test
```

## URL Parameters

- `o` -- one occurrence per option (e.g. `?o=Alice&o=Bob&o=Carol`)
- `n` -- pick count (defaults to 1)
- `s` -- optional seed; same seed + same options always produce the same result
- `d` -- distinct picks. Defaults to `1` (on). Set `d=0` to allow repeats when `n > 1`

Example: `?o=Alice&o=Bob&o=Carol&n=1&s=monday2026`

## Tech Stack

Vanilla HTML, CSS, and JavaScript. No frameworks or dependencies.

## Live Version

[triunitystudios.com/web-projects/random-option-picker](https://triunitystudios.com/web-projects/random-option-picker/)
