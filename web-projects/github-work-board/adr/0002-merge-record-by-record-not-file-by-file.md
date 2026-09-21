# ADR 0002: Merge record by record, and let the remote side win a tie

## Context

The board keeps its private half (notes, the column a card is moved to, the
colour on each part of the board, light or dark, and which cards the reader
pushed down, now; tags and a "what's next" queue later) in one file,
`board.json`, inside a private repository the reader owns.
GitHub's Contents API stores that file and hands back a **sha**, a fingerprint of
the version just read. A write must name the sha of the version it replaces.
GitHub answers **409** when that sha is no longer current, which means somebody
saved in between.

No other web-project has this problem. Every save on this site so far is local:
one browser, one copy, nothing to reconcile (`akwaaba-monsters` ADR 0002 is the
closest, and its save only has to survive different *builds*, not different
*devices*). Here the same person edits from a laptop and a phone, both tabs can
stay open for hours, and each holds a copy that drifts.

The one-line answer is to treat the newest whole file as the truth. It is wrong
in the ordinary case: the phone writes a note on issue A, the laptop writes one
on issue B, and whoever saves second deletes the other note. Nothing warns
anybody. The note is simply gone next time it is looked for.

## Decision

**Merge per record, settle a contest by `updatedAt`, and give a tie to the
remote side.**

- **Every record in every map carries its own `updatedAt`.** A record without one
  is unreadable and is dropped (`boardDocument.js`).
- **The merge walks the union of both sides.** A record only one side has is
  kept. The same record on both sides is settled by `updatedAt`, newest wins.
  Two devices editing two different issues both keep their work.
- **A tie keeps the remote record.** This rule looks arbitrary and is not. Both
  devices must reach the same answer without talking to each other, or each
  keeps pushing its own version back at the other for ever. "The remote side
  wins" is the only rule both can apply alone and agree on.
- **A save re-reads first, merges, then writes with the sha from that read.**
  Not a remembered sha: the remembered one is exactly how a save overwrites what
  arrived in between.
- **A 409 retries the whole cycle once**, because the file it was going to
  replace is already stale by the time GitHub says so.

`sync.js` holds all of it, pure and tested. `gateway.js` only carries the bytes.

## Consequences

**Nothing a person wrote is deleted by another device.** The worst case is two
edits to the *same* note within the same second, where one loses. That is a real
loss and a rare one, and git history in the data repository keeps the losing
version, so it can be recovered by hand.

**A clear is a record, not a deletion.** Clearing a note keeps its key and gives
it a new timestamp. Deleting the key instead would read as "this device never had
it", and the other device's older text would come back. This is what makes the
document additive only, the same rule as `akwaaba-monsters` ADR 0002, for a
different reason.

**Every save is a commit.** The data repository grows one commit per save, which
is why saves are debounced rather than made on every keystroke, and why the
history is worth having: a note can be recovered from any past version.

**The merge is generic over record maps.** Adding tags, columns or queue order
later is one entry in `RECORD_MAPS` and no change to `sync.js`. A map this build
has never heard of is carried through untouched, so an old tab cannot delete what
a new build wrote.

**Rejected: last-write-wins on the whole file.** One line of code, and it loses
notes on the ordinary two-device day. **Rejected: a three-way merge of the text.**
It needs a common ancestor, which nothing here stores, and it can produce a file
that is not valid JSON. **Rejected: one file per issue.** It removes the contest
almost entirely, and it costs one API call per issue to read a board, which the
rate limit and the page load both refuse.
