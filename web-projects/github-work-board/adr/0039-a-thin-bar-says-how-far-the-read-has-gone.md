# ADR 0039: A thin bar says how far the read has gone

## Context

A full read of GitHub can take several seconds. For each token, `inspectToken`
waits on six calls one after another: who the token belongs to, the open work,
the finished work, the reviews, the relationships and the checks. The tokens go
one after another too. The board draws nothing new until the last call ends.

During that wait the reader saw placeholders (ADR 0004) and nothing that moved
forward. Placeholders say "something is coming". They do not say "it is nearly
here", and a reader with three tokens waits three times as long as a reader
with one.

## Decision

**A thin bar on the top edge of the window fills as the read goes.**
`readProgress.js` holds the rules, and `app.js` moves the bar.

- **The bar moves by real steps, never by a timer.** One step is one call that
  `inspectToken` waits on, so `READ_STEPS` lists those calls. A bar that moves
  on a timer says nothing about the read, which is the rule the start-up bar
  follows too (ADR 0036).
- **It starts at a small floor, never at zero.** A bar with nothing in it reads
  as a read that has not started.
- **It stops short of full until the board is drawn.** Every call answered is
  not the board on the screen: the merge and the render still come. Only
  `finishReadBar` fills it, so a full bar always means a drawn board.
- **A token that fails early jumps the bar to where the next token starts.**
  The steps it never took count as done, so the bar does not stall.
- **It covers nothing.** It is three pixels tall, `position: fixed` on the top
  edge, and takes no pointer events.
- **Only a read that draws placeholders shows it.** A quiet read replaces a
  good board with another good board, and the refresh button already says that
  it is reading (ADR 0025, ADR 0029). A bar that slides across the top every
  minute would be motion that tells the reader nothing new.

## Consequences

- A new call in `inspectToken` needs a new entry in `READ_STEPS` and an
  `onStep()` call after its `await`. Without both, the bar still works but
  jumps at the end of each token.
- The checks step is one step, although it makes one call per commit in
  parallel. That keeps the count fixed and known before the read starts.
- The steps are not equal in time. The bar shows how many steps are done, not
  how many seconds are left.
- While the start-up screen is up, the `#boot` rule in `style.css` hides the
  bar too, so the reader never sees two bars at once.
