# ADR 0002: The link carries the setup, never the position

## Context

Root ADR 0006 says a web-project keeps shareable state in the address bar. A
board game has two candidates for that, and they are not equally useful.

The **setup** is the rule set and who sits in each seat. It is short, it is
stable, and it is what somebody wants to send: "play Ba-awa against Chief".

The **position** is twelve pit counts, two scores, whose turn it is, the pit
ownership and the round number. In Ba-awa it also needs the round's starter and
the count of turns since the last capture, because two ending rules read them.

## Decision

**Put the setup in the query string. Keep the position out of the link.**

`urlState.js` reads and writes four parameters: `mode`, `blue`, `red` and
`rounds`. Anything it does not recognise falls back to the default, and a value
equal to the default is never written, so the common case has a clean URL.

`app.js` uses `history.replaceState`, so choosing an opponent does not fill the
back button with setups.

## Consequences

- A link opens a table already laid out, which is what a person wants to send.
- A reload keeps the game you set up, and `localStorage` remembers it for the
  next visit even when the link is bare (root ADR 0007).
- You cannot hand somebody a half-played game. A mancala game is short and both
  players are usually at the same device, so the loss is small.
- A position link would go stale. Every one of the fields above is part of an
  engine's state shape, and this project has already changed a Ba-awa ending
  rule once. An old link would then either fail to load or, worse, load a
  position the current rules could not have produced.
