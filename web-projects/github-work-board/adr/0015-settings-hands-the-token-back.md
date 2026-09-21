# ADR 0015: Settings hands the token back, behind one warning

## Context

GitHub shows a personal access token once, on the screen that creates it, and
never again. So the browser that holds the board holds the only copy.

That turned an ordinary mistake into a full set-up. A reader signed into the
wrong Chrome profile, set two tokens up there, and could no longer reach them:
a different profile is a different `localStorage`. The same wall stands in front
of a new laptop, a wiped machine and a second browser.

The board already stored the token where the reader could not read it, while
promising nothing more than "it stays in this browser". Showing it back was the
open question, and the fear behind it is worth stating plainly so it can be
answered:

**Does showing the token make the board less safe?** No. `localStorage` is
readable by any script on this origin and by anybody who opens the browser's
developer tools. An attacker who can read the Settings screen can already read
the token; an attacker who cannot is not stopped by hiding it. Nothing in the
threat model of ADR 0001 changes.

What does change is the number of eyes. A token on screen is a token in a
screen share, a screenshot and a photograph, and a token on the clipboard is a
token every application on the computer can read. Those are new risks, and they
are risks of the moment, not of the design.

## Decision

**Settings hands the token back, one token at a time, behind one warning.**

- Each row in Settings carries **Copy** and **Show**. Copy puts the token on the
  clipboard and puts nothing on screen. Show prints it in the row, selectable in
  one gesture, for the reader who would rather not use the clipboard.
- **One token is visible at a time.** Showing a second hides the first, leaving
  Settings hides it, and signing out hides it. Nothing about a reveal is stored,
  so the board never opens with a credential already on screen.
- **A warning dialog comes first**, once a visit. It says the token is a
  password, that the clipboard is shared with every application on the computer
  and kept in a history, and where to revoke the token. It is shown once because
  a warning on every press is a warning nobody reads.
- **Copy every token as a backup** writes all of them as one piece of text. The
  same box that takes a token also takes that text, on the welcome screen and in
  Settings, so moving to another browser is one copy and one paste.

**A backup carries only what the reader gave**: the token and the name they
typed. Which owners a token reached, how much work it found and whether it can
write the notes file are facts the board discovered, and a discovered fact is
already stale when it is written down. The board learns them again on the first
connection.

**A backup never leaves this browser by itself.** It is never written into
`board.json`, which would put a live credential into a GitHub repository, copy
it to every device and keep it in that file's history for ever. A test pins
this, because it is exactly the sort of thing a later "sync everything" pass
would do without meaning any harm.

## Consequences

**Losing the browser stops meaning losing the set-up**, which is the whole
point. The recovery is: copy the backup, paste it into the next browser.

**A screen share of Settings can leak a token.** That is the cost, and it is the
reader's to manage. The one-at-a-time rule and the never-stored reveal keep the
window as small as the feature allows, and the warning names the risk before it
can happen.

**A backup is a credential file.** Told to keep it in a password manager, and
nothing in the page writes it to disk: it goes to the clipboard, and no further.

**The board gained a `<dialog>`**, which is a fifth part beside the four of
ADR 0004. A modal is justified here and only here: the answer must come before
anything else happens. Any other question belongs on the page.

**Rejected: no way out at all.** It is where the board started, and the cost is
a token that cannot be recovered from a mistake anybody can make in a minute.
**Rejected: a warning on every press.** It trains the reader to click it away,
and a warning that is clicked away protects nobody. **Rejected: copy with no
warning.** Copying is the safer of the two, but the clipboard is shared and
remembered, and that is not common knowledge. **Rejected: a backup file the page
downloads.** A credential on disk outlives the reason it was written; the
clipboard does not, and a password manager is the right home.
