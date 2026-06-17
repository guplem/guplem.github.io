# RPS Mind Reader

Rock-paper-scissors against an AI that learns your habits and tries to beat you. The more you play, the better it reads you — so the only way to win consistently is to stay genuinely unpredictable.

## Features

- **An opponent that learns** — a lightweight prediction engine studies your past moves and plays the counter to whatever it thinks you'll throw next. It starts near random and sharpens as it gathers data.
- **It predicts, it doesn't cheat** — the AI commits its move from your history *before* you reveal yours. Each round it even tells you what it guessed (e.g. "I predicted you'd throw Rock").
- **Full stats** — separate Wins / Losses / Ties counters with percentages, a three-segment progress bar, your win rate, and current/best win streaks.
- **Statistics page** — a dedicated page (linked from the game) that charts your wins, losses and ties over time with a hand-drawn **SVG line chart** (no charting library), plus win rate, recent form, best/worst streaks, and a breakdown of how predictable your move choices have been.
- **Colour-coded history** — recent rounds listed newest-first, green for wins, red for losses, grey for ties, showing both hands.
- **Remembers you** — your history and the AI's memory are saved on your device, so the bot keeps learning across visits. A **Reset** button wipes everything.
- **Plays everywhere** — responsive layout for phones and desktops, with `R` / `P` / `S` (or `1` / `2` / `3`) keyboard shortcuts.

## How the AI works

Instead of a heavy neural network, the bot uses an ensemble of simple pattern
predictors — overall move frequency, variable-order **Markov chains** (what you
tend to play after a given recent sequence), and reactive models (how you respond
to the AI's last move and to the last result). Each prediction spawns three
"rotation experts" so the meta-layer can learn the right counter even against a
player who is trying to out-think the bot. A recency-weighted score tracks which
expert has been winning lately, and the AI follows it; when nothing has a positive
track record it plays uniformly at random — an unexploitable baseline.

This approach is tiny, trains instantly, runs fully offline, and is a better fit
for rock-paper-scissors than a neural network would be. See
[ADR 0009](../../adr/0009-custom-statistical-predictor-no-ml-library.md) for the
reasoning, and [ADR 0008](../../adr/0008-localstorage-for-private-session-persistence.md)
for why state is kept in `localStorage`.

## How to Run

No build step required. Serve the repository with any HTTP server:

```bash
# From the repository root
python -m http.server 8000
```

Then open `http://localhost:8000/web-projects/rps-mind-reader/` in a browser.

Alternatively, open `index.html` directly — all assets are self-contained.

## Tests

The game rules and the prediction engine are covered by tests using Bun's
built-in test runner.

```bash
# From the project folder
bun test
```

## Tech Stack

Vanilla HTML, CSS, and JavaScript (ES modules). No frameworks, no dependencies.

## Live Version

[triunitystudios.com/web-projects/rps-mind-reader](https://triunitystudios.com/web-projects/rps-mind-reader/)
