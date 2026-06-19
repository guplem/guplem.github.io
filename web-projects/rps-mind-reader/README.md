# RPS Mind Reader

Rock-paper-scissors against an AI that learns your habits and tries to beat you. The more you play, the better it reads you — so the only way to win consistently is to stay genuinely unpredictable.

## Features

- **An opponent that learns** — a lightweight prediction engine studies your past moves and plays the counter to whatever it thinks you'll throw next. It starts near random and sharpens as it gathers data.
- **It predicts, and shows its hand** — the AI commits its move from your history *before* you reveal yours, and each round tells you what it predicted and how confident it was (e.g. "I predicted you'd throw Rock (62%)").
- **Full stats** — separate Wins / Losses / Ties counters with percentages, a three-segment progress bar, your win rate, and current/best win streaks.
- **Quick-reference pills** — a horizontally-scrollable strip of your recent throws (you vs AI, colour-coded by outcome) sits right under the buttons, so you can watch your own patterns while you pick.
- **Statistics page** — a dedicated page (linked from the stats card) that charts your wins, losses and ties over time with a hand-drawn **SVG line chart** (no charting library), plus win rate, recent form, best/worst streaks, and a breakdown of how predictable your move choices have been.
- **Colour-coded history** — recent rounds listed newest-first (green win / red loss / grey tie), each showing both hands plus what the AI predicted and its confidence that round.
- **Export your plays** — download your full match history as a JSON file, handy for sharing or offline analysis.
- **Remembers you** — your history and the AI's memory are saved on your device, so the bot keeps learning across visits. A **Reset** button wipes everything.
- **Plays everywhere** — responsive layout for phones and desktops, with `R` / `P` / `S` (or `1` / `2` / `3`) keyboard shortcuts.

## How the AI works

Instead of a heavy neural network, the bot is a small **Bayesian mixture of
variable-order context models**. Several cheap models each predict your *next-move
distribution* from a different slice of history — your own recent moves (a
variable-order **Markov / PPM** family), recent `(you, AI)` exchanges, recent
outcomes (win-stay/lose-shift), and the AI's last move (for when you chase or
counter it). Each model is weighted by how well it has *predicted you lately* (a
recency-decayed log-likelihood, softmaxed), and every model votes for the move with
the best **expected value** against its own forecast. Reasoning over the whole
distribution — not just the single most likely move — is what lets it punish even
50/50 habits like "never repeat the same throw." When there's no signal yet (or
against truly random play) it sits at the unexploitable ~even baseline.

This algorithm was chosen by an **objective benchmark** (`benchmark.js`, a battery
of opponent strategies) after pitting several from-scratch designs against each
other; it beats the earlier ensemble both on that battery and on held-out
opponents. It's tiny, trains instantly, runs fully offline, and is a better fit for
rock-paper-scissors than a neural network would be. See
[ADR 0010](../../adr/0010-custom-statistical-predictor-no-ml-library.md) for the
reasoning, and [ADR 0009](../../adr/0009-localstorage-for-private-session-persistence.md)
for why state is kept in `localStorage`.

## How to Run

This is a **fully static** site — HTML, CSS, and JavaScript that run entirely in
the browser, with no backend, no build step, and no external requests. It deploys
to **GitHub Pages as-is** (GitHub Pages just serves the files; everything else
happens client-side, and game state lives in `localStorage`).

For local preview, serve the files over HTTP with any static server — for example:

```bash
# From the repository root
python -m http.server 8000
```

Then open `http://localhost:8000/web-projects/rps-mind-reader/`.

> Note: the project uses native ES modules, so opening `index.html` straight from
> the filesystem (`file://`) is blocked by browsers. Use any HTTP server locally
> (the command above, `npx serve`, a VS Code Live Server, etc.) — or just the live
> GitHub Pages URL, which serves over HTTPS and works out of the box.

## Tests

The game rules and the prediction engine are covered by tests using Bun's
built-in test runner.

```bash
# From the project folder
bun test
```

## Benchmark

`benchmark.js` is a dev-only harness (not loaded by the game) that pits any
predictor against a battery of opponent strategies and reports net win rate. Use it
to measure and improve the AI over time:

```bash
# From the project folder
bun benchmark.js
```

It also benchmarks a `candidate.js` alongside the current `predictor.js` if one is
present, so a new algorithm can be compared head-to-head before replacing the
incumbent.

## Tech Stack

Vanilla HTML, CSS, and JavaScript (ES modules). No frameworks, no dependencies.

## Live Version

[triunitystudios.com/web-projects/rps-mind-reader](https://triunitystudios.com/web-projects/rps-mind-reader/)
