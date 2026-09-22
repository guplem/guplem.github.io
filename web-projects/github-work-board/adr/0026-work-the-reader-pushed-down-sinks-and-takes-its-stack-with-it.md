# ADR 0026: Work the reader pushed down sinks, and takes what waits on it

## Context

The board decides the order from facts: how long something has waited, and what
has to merge before what (ADR 0016). It had no way to say the one thing only the
reader knows, which is that a piece of work does not matter this week. A card
nobody plans to touch sat in the middle of the list and was read, and skipped,
every time the reader looked at the board.

The reader can already move a card to another column by hand (ADR 0011). That is
a different statement: it says where the work *is*, not how much it matters.

## Decision

**The reader can mark any card "not a priority", from the card's own menu.** The
mark does two things, and they are deliberately not the same thing.

**It draws the card fainter, in every order, everywhere the card appears.** That
half is not an order, so no order gets to opt out of it. A marked card keeps
full opacity while the pointer is on it, or while anything inside it has focus,
so the mark never gets in the way of reading or using the card.

**It sinks the card to the bottom of its list, and only in the smart order.**
Every other order says what it does in its own name and has to keep doing
exactly that (ADR 0016). Somebody who picks "Least recently updated" asked for a
date order, and a card pushed down is not a date.

**Marking one card can move more than one: everything stacked on top of it sinks
with it.** A stacked pull request cannot merge until the one below it does, so a
top left high on the board reads as ready to pick up when it is not. That is the
exact failure ADR 0016 was written to prevent, and sinking only the marked card
would produce it by a new route.

This keeps ADR 0016 true rather than bending it. The cards that sink are always
a whole top of a stack, never a piece out of the middle, so the part that stays
up is the part that can still be picked up. Read the board from the top and a
stack is still bottom first, wherever its parts ended up:

| Stack | Marked | Reads |
|---|---|---|
| #1, #2, #3 | nothing | #1, #2, #3 |
| #1, #2, #3 | #1, the bottom | the whole stack sinks, still #1, #2, #3 |
| #1, #2, #3 | #2, the middle | #1 stays up; #2 and #3 sink, in that order |
| #1, #2, #3 | #3, the top | #1 and #2 stay up; #3 sinks |

**The cards that sank keep the order they had.** The reader asked for an order
and then pushed some cards down. Both halves of the list are still in the order
they asked for, which for the smart order means each half still reads its stacks
in merge order.

**The card that carries the mark is the card that moves.** A pull request nested
inside the issue it closes travels in that issue's card (ADR 0016), so marking
the nested one only makes it fainter. That is the same rule the move menu
follows, and it is why the nested card is offered the mark at all: it is the
reader's judgement about that pull request, and it shows on that pull request.

**The mark lives in `board.json`**, in a new `priorities` record map keyed by the
item's node id, beside the notes and the hand-moved columns. It is the reader's
opinion about a piece of work, exactly like a note, so it belongs with the notes
and it follows them to every machine (ADR 0022, ADR 0024). Taking the mark off
writes a record saying so rather than deleting the key, because a key that
disappears reads as "this device never saw it" and the older value comes back
(ADR 0002).

Adding the map was the whole storage change: `migrate`, `sync.planSave` and
every invariant are generic over `RECORD_MAPS`, which is what ADR 0002 built
them for.

## Consequences

- The board has one more thing it will not decide for the reader. Everything
  else in the order comes from a fact; this comes from an opinion, and it is the
  only part of the order that does.
- **A marked card is never hidden.** Faint and last is a hint. A filter that
  removed it would make the board lie about how much work there is, and the
  reader would have to remember what they hid.
- **The two halves can be undone separately in the code, and both fail
  silently.** Widen the guard and an order named after a date stops giving one;
  drop the pass and the mark quietly becomes decoration. `invariants.test.js`
  pins both, naming this ADR.
- **The review row fades but never sinks.** The row does run the smart order's
  stack pass (ADR 0016), so "there is nothing to reorder there" is no longer the
  reason. The reason is what the row is for: it reports how long other people
  have waited on the reader. A stack's order is a fact about what can merge, and
  it belongs there. The reader's own ranking is an opinion about their week, and
  hiding somebody else's wait behind it would make the row answer a different
  question than the one it asks. The fade still applies, because the mark belongs
  to the work.
- **A mark on a mid-stack pull request moves two cards.** That surprises until
  the reason is read, which is why it is written on the menu row's comment and
  here. The alternative, moving nothing at all, was rejected: it makes the menu
  row do nothing on the exact cards a reader most wants to push away.
