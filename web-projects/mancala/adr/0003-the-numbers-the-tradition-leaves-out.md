# ADR 0003: Decide the numbers the tradition leaves to the players, and measure them

## Context

Ba-awa is played by people who can agree on the spot. Three points in the rules
need a number before a program can play at all.

**1. The quiet endgame.** Captures take four seeds off the board, so the board
drains. Eight seeds spread round twelve pits can hardly be gathered into a four
again, and they can circle for ever. Real players stop and split them. The
version of the rules recorded on Wikipedia stops the round at eight seeds and
gives them to the player who began it.

**2. The spare pit.** After a round, four captured seeds buy one pit. 48 seeds
do not always divide into fours: one player can hold 1 seed spare and the other
3, or both can hold 2. One pit is then unclaimed.

**3. A relay that never ends.** Nothing in the rules stops relay sowing from
looping. A browser tab must not freeze.

The first of these was measured, twice, and both first attempts were wrong.

An invented rule came first: after 24 turns with no capture, each player keeps
the seeds in their own pits. Over 75 self-played rounds it decided 26 of them.
Four rounds in ten settled by a number this project made up is not the game.

The documented eight-seed rule came second, checked before the main ending. It
decided **every single round**, 75 out of 75, in about 12 moves each. The reason
is plain once measured: the board always falls to eight seeds before a player
runs out of them, so the main ending, the one a Ba-awa player describes first,
could never happen at all.

## Decision

**Check the main ending first. Stop only a quiet endgame. Measure the number.**

1. A round ends when the player to move owns no seed. The other player takes
   every seed left. This is checked first, so it is the ending the game reaches
   whenever it can.
2. If eight or fewer seeds go `ENDGAME_QUIET_TURNS` turns with nobody capturing,
   the round stops and the player who started it takes them. Both halves of the
   test matter: a quiet endgame stops, and a lively one plays on.
3. `ENDGAME_QUIET_TURNS` is 18. It was chosen from a measured table, over the
   same 75 self-played rounds:

   | Quiet turns | Reached the main ending | Moves per round |
   |---|---|---|
   | 6 | 23% | 17.6 |
   | 12 | 36% | 22.7 |
   | 18 | 44% | 26.4 |
   | 24 | 56% | 30.1 |

   A higher number lets more rounds be decided by play instead of by the luck of
   who started the round, and adds quiet moves at the end that nobody enjoys
   watching. 18 buys most of the first without much of the second.
4. The spare pit goes to the bigger leftover. An even 2 and 2 goes to the player
   who moved **second** in the round that just ended, because moving first is an
   advantage.
5. A relay is cut off after 300 lifts. The move then ends where it stands and
   the turn passes.
6. `STALL_TURNS` is 40 and is a backstop only: after 40 turns with no capture at
   any seed count, each player keeps the seeds in their own pits. It has not
   fired in any measured round since rule 2 arrived.

Every one of these is a named constant at the top of `baawa.js` or `match.js`,
with the reason next to it, and every one has a test.

## Consequences

- The ending a Ba-awa player describes first is the ending the game usually
  reaches. That was not true of either earlier attempt.
- Nothing this project invented decides a round any more. Rule 6 is the only
  invented ending left, and it does not fire.
- The numbers are honest about being choices. The README lists all three as
  house rules, and the how-to-play card states the endgame rule in a sentence,
  so a player is never surprised by a round that stops.
- Re-run the numbers after any change to the capture rule or to the opponents.
  A change that makes captures easier or harder moves the whole table, and 18
  would then be the answer to a question nobody is asking.
