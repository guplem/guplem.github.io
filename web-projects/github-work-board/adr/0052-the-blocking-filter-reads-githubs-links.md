# ADR 0052: The blocking filter reads GitHub's links, and "Not blocked" hides what nobody can start

## Context

The board marks a card "Blocked" when GitHub says an open issue blocks it
(ADR 0010). The smart order sinks those cards and raises the work that blocks
them (ADR 0026, ADR 0050). A reader who wants to see only the work they can
start now still has to read past the blocked cards. No filter could hide them,
because every filter read a field on the item, and "blocked" lives in the
relationships.

## Decision

**The filter bar has a "Blocking" menu with three states.** `filters.js` holds
them in `BLOCKING_FILTERS`, and `blockingStates` works them out.

| Id | Words | Means |
|---|---|---|
| `not-blocked` | Not blocked | No open blocker. Work with no relationships read counts here. |
| `blocked` | Blocked | An open blocker, read through `openBlockers`, the rule that draws the "Blocked" pill. |
| `blocking` | Blocks other work | An open blocker of other work on the board. |

- **"Not blocked" is the answer to "hide the blocked work".** The filters only
  include (ADR 0009), so the way to leave something out is a state that names
  the rest.
- **The states follow ADR 0009.** Two states widen: "Not blocked" and "Blocks
  other work" together still keep every blocker. The menu narrows against the
  other menus.
- **A pull request is as blocked as an issue that it would close.** It travels
  in that issue's card (ADR 0016). Without this rule, "Not blocked" would hide
  the issue and leave its pull request alone on the board.
- **"Blocks other work" counts only the work on the board**, the same rule as
  the smart order (ADR 0050). The board does not ask for `blocking`, so
  somebody else's blocked work is not known.
- **The menu shows only when some work is blocked or blocks.** On a board with
  no blocked work, "Not blocked" alone could narrow nothing. A chosen state
  always stays, so the reader can see it and undo it (ADR 0049).
- **The ids travel in the link as `blocking=`**, one parameter for each state.
  They are permanent, and `invariants.test.js` pins them.

## Consequences

- The filter needs no new call. It reads `state.links`, which the
  relationship query already fills.
- `connectAll` sets the items and the links together, so the filter never
  runs on items without their links. When the relationship query fails for a
  token, every card of that token reads as "Not blocked".
- **The menu has no press on a card**, against the rule in ADR 0049. "Not
  blocked" has no pill to press, and the "Blocked by" pill already holds links
  to the blockers.
- **Rejected: an exclude state on each chip.** The board's filters only
  include (ADR 0009), and one menu of three states says the same thing.
