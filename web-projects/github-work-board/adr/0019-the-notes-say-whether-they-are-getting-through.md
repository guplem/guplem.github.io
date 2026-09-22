# ADR 0019: The notes say whether they are getting through

## Context

The reader's half of the board (notes, moved cards, and how it looks) belongs
to the reader alone. Everything else on screen is GitHub's, and GitHub will
still be there if this page breaks. That half lives in one file in one
repository, and nothing on the screen said whether that file was reachable.

Both ends of it are out of sight. The file is read once, while connecting. It
is written a second after a keystroke, by a timer, and the only sign is a line
of status text on the board that a reader in Settings cannot see. A token whose
`Contents` permission was never granted, a repository renamed on GitHub, a
typo in the repository name: all three look exactly like everything working.

The answer already existed. Every token runs a board-file check on connecting,
and after ADR 0018 that check sits folded inside the token it belongs to. That
is the right home for "what did this token prove" and the wrong home for "is
my board safe": it asks the reader to know which token owns the board
repository, unfold it, and read.

## Decision

**A badge beside the "Board repository" heading, with the reason under the
box.** It answers on opening Settings and again after "Save and reconnect".

Three states:

| Badge | When |
|---|---|
| **Saving** | A token reached the file |
| **Not saving** | No token did |
| **Checking** | The board has not finished asking |

**The detail is the check's own sentence**, not a new one. Those sentences
already name what to fix, because `githubErrors.js` writes them from the failed
call and the permission it needed: "Add Contents: Read and write to this
token", "work-board-data is public. Your notes would be readable by anyone."
The badge is therefore the whole answer, not a prompt to go looking.

**Silence is the loudest answer.** A token that cannot reach the repository
pushes no board-file check at all, on purpose: an organisation's token is not
broken for failing to hold somebody's private notes (ADR 0007). So no answer
from any token, once they have all been asked, means no token reached it. That
is why `describeNotesSync` takes an `asked` flag: without it, "nobody could
reach your notes" and "still asking" are the same empty list.

**One success is enough.** Exactly one token can write the file, so one "Saving"
settles it however loudly the others say nothing.

## Consequences

**Every check row now carries the id of the check it answers.** They were
matched only by their label before, and this needed to find one row among
several without matching on wording that changes.

**The badge says "Checking" and not the last answer, while the board is
asking.** `renderLoading` clears the collected checks, the way every other list
draws a placeholder rather than holding yesterday's content (ADR 0004). A stale
green "Saving" during a reconnect is worse than no answer, because the reader
pressed the button precisely to find out.

**A check that is still passing is stated, not implied.** The badge is on
screen in both states. A warning that appears only when something is wrong
cannot be told apart from a warning that is broken.

**Rejected: a badge on the board too.** The board already says "Notes save by
themselves" and turns that line into the failure when a save fails. Settings is
where somebody goes to ask the question.
**Rejected: leaving it in the folded checks.** It is there, and it asks the
reader to know which token owns the repository before they can read it.
**Rejected: writing a new sentence for each failure.** `githubErrors.js`
already turns a failed call into a sentence naming the permission to add, and a
second wording would drift from it.

> **Note (2026-09):** the badge now lives in the shared cloud storage panel that Settings mounts, driven by `cloudMessages.describeSync` over the three checks the store runs (identity, repository, folder). The board itself speaks only when a save is not getting through: the store's `onStatus` puts that sentence in the board's status line. "This device only" is a state the badge shows, not a fault (root ADR 0016).
