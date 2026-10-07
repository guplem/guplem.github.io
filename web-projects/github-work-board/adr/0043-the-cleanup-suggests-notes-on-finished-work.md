# ADR 0043: The cleanup suggests the notes on finished work, and deletes nothing it cannot prove

## Context

A note is filed under the node id of an issue or a pull request (ADR 0022).
When that work closes or merges, the card leaves the board, but the note stays
in `board.json` in the data repository. Nothing on the board shows it again, so
nobody reads it, and the file only grows.

The reader asked for a place that suggests what to clean up. Three facts shape
the answer:

- **The board file does not say whether an item is open.** It holds the
  reader's half only. GitHub holds the state, so the board has to ask.
- **A note's item may be unreadable.** A token reaches one owner (ADR 0007).
  An item that no token in this browser reads may be deleted, or may sit behind
  a token that lives in another browser. The two answers look the same.
- **A deleted note must keep its key** (ADR 0002). A removed key reads as
  "never had it", and the other device's older copy comes back on the next
  merge.

## Decision

**A fourth view, `?view=cleanup`, lists the notes on closed and merged work.**
Settings opens it from the cloud storage card, which is where the data
repository lives. The masthead toggle goes back to Settings, as it does from
the add-token screen (ADR 0018).

- **The board asks GitHub when the reader opens the view**, and again on
  "Check again". It never asks on a refresh. `gateway.fetchItemStates` asks
  each token about every note in one `nodes` query per 100 notes, with the
  fields of the item and nothing linked to it. The tokens are asked together,
  and the answers merge in token-list order (ADR 0040).
- **Only a note on work that a token saw closed is suggested.** A note on work
  that no token could read is counted in one line, and the board leaves it
  alone. When a token failed, the board does not count unreadable notes at all,
  because the token that failed may be the one that reads them.
- **Each row offers Delete and Keep.** Delete writes an empty note through
  `cleanup.deleteNotes`, so the key stays (ADR 0002). Keep writes a record in a
  new map, `cleanup`, keyed by the node id: `{ suggested: false }`. The map
  travels in `board.json`, so another device does not suggest the same note.
- **"Delete all" asks first**, in a dialog, because one press empties many
  notes. One Delete on one row does not ask: the row shows what it deletes.
- **The oldest closed work comes first.** It is the note least likely to be
  read again.

`cleanup.js` holds the rules and is pure. `messages.describeCleanup` holds the
sentences.

## Consequences

- **A cleanup costs one GraphQL call per token per 100 notes, once.** A full
  batch is one point, and the refresh budget does not change (ADR 0025).
  `invariants.test.js` fails if the refresh path ever asks.
- **A deleted note still takes a line in `board.json`.** The key and an empty
  body stay. That is the price of a merge that cannot lose a note (ADR 0002).
  The data repository's history keeps the old text.
- **"Keep" has no undo on screen yet.** The record can say `suggested: true`
  again, and `writeNoteSuggested` writes it, but no button does. A note the
  reader kept still shows on its card if the work reopens.
- **Only notes are suggested for now.** The other maps keyed by an item (a card
  moved by hand, a priority mark) can join the same screen later, through the
  same item states.
- **Rejected: suggest a note on work no token can read.** The board cannot tell
  "deleted" from "behind a token in another browser", and a wrong guess deletes
  the reader's words.
- **Rejected: remove the key of a deleted note.** It would shrink the file and
  bring the note back from the other device.
- **Rejected: ask on every refresh.** It multiplies by the tokens and by the
  schedule, for a list that the reader opens rarely.
