# ADR 0002: The host plays the bots and the forced moves, outside the reducer

## Context

In online-sync, every change arrives as an intent on a link, and the reducer
checks that the sender is the player on turn (root ADR 0017). Two kinds of move
have no sender:

- A **bot** has no device and no link.
- A **forced move**: when the die allows exactly one move, the reference game
  plays it by itself after a short pause, so nobody taps for nothing.

A bot could pretend to be a player, but then the reducer would need a way to
accept an intent "from" a bot, and a guest could send that intent too.

## Decision

**The host's page drives bots and forced moves with `host.update(fn)`, and the
reducer never accepts an intent for a bot.**

- `botStep(table, { rollDie, choose })` and `forcedStep(table)` in `table.js` are
  pure. Each returns the next table, or null when it has nothing to do.
- `app.js` schedules them after every change (about one second apart, so people
  can follow the play). It skips a step when the version changed while it waited
  or while a piece still walks.
- A person on the host's own phone (a `local` seat) acts through intents with
  `as: seatId`. The reducer accepts this only from the host's own link.

## Consequences

- No guest can move for a bot or for somebody else. The reducer's sender check
  has no exception.
- Bots and forced moves stop when the host's page is closed. That is correct,
  because the host holds the round.
- The pause before a bot or forced move lives in `app.js`, so the tests cover the
  decisions but not the timing.
