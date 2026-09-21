# ADR 0018: Five columns, two headings, and a screen for adding a token

## Context

The board worked and read badly. Six changes, all of them the same complaint in
different places: the screen spends its room on things nobody is reading.

- The columns were a fixed width, so how many fitted depended on the window and
  the answer was usually "four and a bit".
- A pull request nested inside its issue repeated the repository name the issue
  above it had already given, in the narrowest card on the board.
- The page carried a tagline and a heading ("Assigned to you") that named the
  whole screen, while the two lists on it, the reviews and the columns, had
  nothing above them to tell them apart.
- Settings held the whole token guide inline, so the tokens, the backup, the
  board repository and the guide all competed in one card.
- The connection checks were one list at the bottom of Settings, merged from
  every token, so reading them meant working out which line belonged to which.

## Decision

**Five columns fill the window, and the sixth is the one you rarely want.**
`grid-auto-columns: max(17rem, calc((100% - 4 * 0.75rem) / 5))`. The window
less the four gaps, split five ways, so everything up to "Ready to merge" is on
screen and "Done today" is a scroll away. `max` keeps a column usable on a
phone, where a fifth of the screen is not a column at all, and the row scrolls
sideways there as it always did.

**A nested pull request says `PR #5093`, and holds its repository one hover
away.** It is inside the card of the issue it closes, which already names the
repository, and the two being different is rare enough that the name is
repetition taking the width the title needs. Only nested cards lose it: a card
standing on its own still says where it lives.

**Two headings, one per list.** "Waiting for you" above the review row, "Your
issues and pull requests" above the columns, with the sort control beside the
second. The tagline and "Assigned to you" are gone: the masthead already names
the tool, and a heading that names the whole screen tells a reader nothing they
did not know.

**The sort control later moved out of this row.** ADR 0023 put it in the
masthead instead, at the top of the page rather than in the middle of the
board. What stands from this decision is the two headings themselves.

**Adding a token is its own screen**, `?view=add-token`, with the guide as four
numbered steps. It was a block inside Settings, where it buried the tokens, the
backup and the board repository under a wall of instructions somebody reads
twice a year. The guide itself is still written once, as the `token-guide`
template cloned into both screens (ADR 0008). Nothing was dropped in the move;
the steps around it were added.

The new screen also asks for **an optional name**. GitHub does not say which
owner a token belongs to (ADR 0007), so the reader is the only one who can name
it, and the moment they are holding the token is the moment they know what it
is for. Left empty, the board still suggests a name from where the token found
work.

**The masthead toggle still goes back, and now it knows where from.** Board to
Settings, Settings to the board, add-token to Settings. One control, as
ADR 0008 requires, and no second exit inside a screen.

**Each token's checks fold into its own row.** One line while shut, and it
names the failure rather than counting it when exactly one thing failed, so
nobody has to open every token to find the broken one. A row with trouble says
so in the destructive colour while it is still shut.

**"Sign out and forget every token" is gone.** Every token has **Remove**, and
removing the last one signs out, so the capability is unchanged. What is gone
is a red button that wipes everything, sitting under a list where the ordinary
action is to remove one. ADR 0001 called that button visible on purpose; that
was written when the board held exactly one token and the button removed
exactly that one.

**The board repository has a link out.** The board names the repository and
never shows it, so a reader who wants to look had no way in.

## Consequences

**A sliver of "Done today" shows at the right edge.** The five columns fit
inside the window and the gutter leaves a little room, so the sixth peeks. That
is worth keeping: it is the only sign on the page that the row scrolls.

**Settings lost the one place ad-hoc messages went.** They now go to a notice
line in the screen that raised them: one in Settings, one on the add-token
screen. A message about pasting a token belongs beside the box it was pasted
into.

**The placeholder had to follow.** `renderLoading` wrote check placeholders
into a list that no longer exists, which threw and left the board stuck on
"Reading GitHub..." with every test green. The token row's placeholder now
carries the folded line instead. This is the third time a change to `app.js`
has been caught by opening the page and not by the suite.

**Rejected: removing "Done today" from the row instead of scrolling to it.**
The column is a log worth having; it just is not worth a fifth of the screen
every minute of the day. **Rejected: hiding the repository on every card.** On
a card standing alone it is the only thing saying where the work is.
**Rejected: keeping the guide in Settings behind a fold.** A fold is right for
something read often and skipped sometimes; this is read twice and then never.
