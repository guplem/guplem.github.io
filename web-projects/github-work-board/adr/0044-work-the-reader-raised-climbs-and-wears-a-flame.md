# ADR 0044: Work the reader raised climbs with its stack, and wears a flame

## Context

The reader could push a card down with "not a priority" (ADR 0026). They had no
way to say the opposite: this piece of work matters this week. A card that the
reader wanted to do first sat wherever the smart order put it, and the reader had
to find it again on every visit.

## Decision

**The reader can mark any card "high priority", from the card's own menu.** Like
the mark that pushes work down, it does two separate things.

**It draws the card with an orange border and a flame in its top corner, in
every order, everywhere the card appears.** That half is not an order, so no
order opts out of it. The flame sits where the card's menu button sits, and on
a raised card the button moves one place left, so neither covers the other.
Resting on the flame says what the mark does.

**It raises the card to the top of its list, and only in the smart order.**
Every other order names what it does and must keep doing exactly that
(ADR 0016, ADR 0026).

**Orange and a flame, not red and a warning sign.** The board already uses red
for what GitHub says is wrong (a red check, changes requested) and amber for a
stack and a conflict (ADR 0011, ADR 0027). A warning sign would read as a fault.
This mark is the reader's own word about the work, so it takes a colour and a
shape that nothing else on the card uses.

**A raised card takes its whole stack up, in merge order.** It is the same move
as the red-check raise. Nothing in a stack merges before the one below it
(ADR 0016), so a raised top over its own base would show work that reads as
ready and is not.

**The raised cards keep the smart order among themselves.** The raise takes the
list in the order the earlier passes left it and keeps that order inside both
halves. Inside the raised group a stack still reads bottom first, a red check
still reads first, and a blocked card still reads last.

**The reader's two marks run last: the raise, then the sink.**

| Pass | Board | Review row |
|---|---|---|
| 1 | Stacks in merge order | Stacks in merge order |
| 2 | Red checks rise | Reviews the reader started rise (ADR 0042) |
| 3 | Blocked work sinks | - |
| 4 | **High priority rises** | **High priority rises** |
| 5 | Not a priority sinks | Not a priority sinks |

- **After the rules**, so the reader's hand beats them: a blocked card the
  reader raised reads first.
- **Before the sink**, so a pushed-down base still takes a raised top down with
  it. A raised pull request that waits on a sunk one cannot merge first, so it
  must not read as ready. The base mark wins because it is the one that decides
  what can merge.

**The menu offers the two priorities the card is not in**, always in the order
high, normal, low. A row names the priority it sets ("High priority", "Normal
priority", "Not a priority"), so every press changes something and the words
never depend on the card's present state. The single toggle row that ADR 0026
used ("Make it a priority") stopped working with three states: it could not say
which priority it meant.

**The mark is the value `high` in the existing `priorities` record map.** No new
map and no merge change: ADR 0002 already made every map generic. A build that
does not know `high` reads it as normal (`knownPriority`), so an older tab shows
the card plain and never strands it.

## Consequences

- The flame and the border take the corner that the menu button had. On a
  raised card the button moves left; on touch screens, where the button is
  always visible, both show side by side.
- A lit stack (ADR 0027) and a lit reference (ADR 0035) still repaint the border
  for as long as the pointer rests, because their rules come later in
  `style.css`. The flame stays, so the mark is never lost.
- The counts do not change. A raised card is counted like any other; only the
  pushed-down mark has a counting choice (ADR 0030).
- `invariants.test.js` pins the order of the passes in both lists. Swap the raise
  and the sink, or move the raise before the rules, and a test fails naming this
  ADR.
