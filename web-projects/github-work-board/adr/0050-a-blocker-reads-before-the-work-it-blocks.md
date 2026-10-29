# ADR 0050: A blocker reads before the work it blocks, and the one that holds up most reads first

## Context

The smart order sank every blocked card below the work that can start now
(ADR 0026). It did nothing else with GitHub's "blocked by" links. So when two
cards in one column were both blocked, they kept the order that the earlier
passes gave them. A card could read above the very card that blocks it. In a
chain (#7110 blocked by #7108, which is blocked by #7107), the column read the
chain backwards.

## Decision

**In the smart order, the cards that block other work climb, and the card that
holds up most work reads first.** `raiseBlockingWork` in `priority.js` does it.

**"Holds up" is counted through the chain, and each card counts once.** A card
that blocks one card, which blocks two more, holds up three. Counted that way,
a blocker always holds up more than the card it blocks. So a blocker always
reads before the card it blocks, and a chain reads in the order its links can
start. Cards that hold up the same amount keep the order handed in.

**Only the cards on the board count.** A blocker that is somebody else's work is
not on the board, so the board cannot move it. A card that the filters hid is
not part of the question the reader asked. The count reads only open blockers,
through `openBlockers`, the same rule that draws the "Blocked by" pill.

**A stack climbs whole, in merge order** (ADR 0016), by the most that any card
in it holds up. A blocker named by a pull request nested in a card counts for
that card, because the card is what moves.

**The pass runs first among the rules:**

| Pass | Board |
|---|---|
| 1 | Stacks in merge order |
| 2 | **Blocking work rises** |
| 3 | Red checks rise |
| 4 | Blocked work sinks |
| 5 | High priority rises |
| 6 | Not a priority sinks |

- **Before the attention raise**, so a pull request that wants its author still
  reads first. That work is short and somebody waits on it.
- **Before the blocked sink**, so a card that nobody can start still goes below
  the work that can start now. The sink keeps the order handed in, so inside
  the blocked half a blocker still reads before what it blocks.
- **Before the reader's two marks**, so their hand still beats the rule
  (ADR 0044).

The review row does not run it. It holds pull requests alone, and GitHub has no
"blocked by" on a pull request.

## Consequences

- The board needs no new call. It reads `blockedBy`, which the relationships
  query already asks for (ADR 0010). It does not read `blocking`: every card on
  the board carries its own `blockedBy`, and that list alone draws the graph.
- A blocker that sits in a different column still gets the credit, because the
  pass runs over the whole board before `groupIntoColumns` splits it.
- A card that blocks a lot of work can climb above an older card that blocks
  nothing. That is the point of the pass, and it is why it is only in the
  smart order. Every other order names what it does and keeps doing it.
- `invariants.test.js` pins the place of the pass in `app.js`.
