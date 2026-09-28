# web-projects/ghana-ludo/AGENTS.md

> **SCOPE:** These rules apply to `web-projects/ghana-ludo/`. The networking is the shared module `../online-sync/`; read `../online-sync/AGENTS.md` before you change anything that crosses the network.

Ghana Ludo is Ludo with the Ghanaian house rules (back kick, side kick, home kick). It plays alone against bots, on one shared phone, or online through `online-sync/`. The rules replicate the game at `just-lads.com/ludo`; ADR 0001 records how, and what counts as the spec.

## Module map

| File | Job |
|---|---|
| `rules.js` | The rules, pure. Geometry, `newGame`, `legalMoves`, `roll`, `playMove`, `chooseSide`, `removePlayer`, `movePath`. |
| `table.js` | The shared state: seats, options, the round. `admit` and `makeReducer` plug into `online-sync`. `botStep` and `forcedStep` run on the host (ADR 0002). |
| `bot.js` | The greedy computer player: `chooseAction(state, random)`. |
| `demo.js` | `demoTable()`: a seeded round in progress, opened by `#demo`. The portfolio image uses it. |
| `captions.js` | Every sentence the game says. |
| `store.js` | What this device keeps: name, player id, the host's table. |
| `render.js` | The SVG board, the piece walk, the die. DOM only. |
| `app.js` | Screens and clicks, the host and guest roles. DOM only. |

## Rules

- **Keep every function in `rules.js` pure.** It returns a new state and never changes its input; `rules.test.js` checks this.
- **Store a ring piece's `step` from its own start field (0-39), not the absolute field.** The back kick past one's own start depends on the wrap to 39.
- **Pass the die value into `roll`.** Only the host rolls, with `fairDie()` in `table.js`.
- **Put a new house rule in `DEFAULT_OPTIONS`, `OPTION_LABELS` in `app.js`, and the rules text in `index.html`.** Test it on and off.
- **Add a test to the random-games block in `rules.test.js` when you add a board invariant.**

## Gotchas

- **An inner corner of the cross faces two fields.** Field 4 faces 14 and 34 across two houses, so `LATERALS[4]` has two entries.
- **Any piece in the house cell between blocks a side kick,** whoever owns it.
- **A side kick after a `backstep` is compulsory.** `chooseSide(state, null)` then returns the state unchanged.
- **Draw the target layer above the pieces in `render.js`.** A kick's target stands on the piece it knocks out.
- **Two players sit at seats 0 and 2,** so the lobby colour of the second seat is seat 2's colour.
