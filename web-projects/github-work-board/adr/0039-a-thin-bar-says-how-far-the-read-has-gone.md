# ADR 0039: A thin bar says how far the read has gone

## Context

A full read of GitHub can take several seconds. For each token, `inspectToken`
makes six calls: who the token belongs to, the open work, the finished work,
the reviews, the relationships and the checks. The first four go together, and
every token reads at the same time (ADR 0040). The board draws nothing new
until the last call ends.

During that wait the reader saw placeholders (ADR 0004) and nothing that moved
forward. Placeholders say "something is coming". They do not say "it is nearly
here".

## Decision

**A thin bar on the top edge of the window fills as the read goes.**
`readProgress.js` holds the rules, and `app.js` moves the bar.

- **The bar moves by real steps, never by a timer.** One step is one call that
  `inspectToken` makes, so `READ_STEPS` lists those calls. A bar that moves
  on a timer says nothing about the read, which is the rule the start-up bar
  follows too (ADR 0036).
- **It starts at a small floor, never at zero.** A bar with nothing in it reads
  as a read that has not started.
- **It stops short of full until the board is drawn.** Every call answered is
  not the board on the screen: the merge and the render still come. Only
  `finishReadBar` fills it, so a full bar always means a drawn board.
- **The bar counts the steps of every token together.** The tokens read at
  the same time and answer in any order, so `readProgress.stepsDone` counts
  each finished step once, whatever order it ended in (ADR 0040).
- **A token that fails early counts all of its steps as done.** The steps it
  never took would otherwise never end, and the bar would stall short of them.
- **It covers nothing.** It is three pixels tall, `position: fixed` on the top
  edge, and takes no pointer events.
- **Every read shows it, the quiet ones included.** That covers the schedule,
  the refresh button and a tab that comes back into view. The refresh button
  sits in a masthead that scrolls away (ADR 0023), so a reader halfway down the
  board could not see that a read was running. A quiet read still draws no
  placeholders and no status line (ADR 0025); the bar is the only thing it
  adds, and a reader who turned motion down sees it jump instead of slide.
- **The refresh button's tooltip names the step that the read waits on.** The
  bar says how far the read has gone; the tooltip says what it waits on. That
  is the earliest step that some token has not finished. With one token left on
  it, the tooltip names the token, for example "Reading the reviews waiting for
  you, with Acme (token 2 of 3)". With several, it counts them: "with 2 of 3
  tokens" (ADR 0040). After the
  last call it says "Drawing the board". `readProgress.readingNow` picks the
  step and `messages.describeReading` writes the words. An open tooltip takes
  each new line at once, so a reader who rests the pointer on the button
  watches the read move. With no read running, the tooltip says when the board
  last read, as before (ADR 0029).
- **The pointer still reaches the busy refresh button.** Every disabled
  `.button` takes no pointer events, so the pointer would reach the row behind
  it and no tooltip would open. `#refresh-now:disabled` is the one exception.
  The browser sends no click to a disabled button, and the click handler
  refuses a press during a read too. `invariants.test.js` pins the exception.

## Consequences

- A new call in `inspectToken` needs a new entry in `READ_STEPS`, an
  `onStep("<step>")` call when it ends, and words in `READ_STEP_WORDS` in
  `messages.js`. Without them, the bar still works but jumps at the end of
  each token, and the tooltip says "Reading GitHub" for that step.
- The checks step is one step, although it makes one call per commit in
  parallel. That keeps the count fixed and known before the read starts.
- The steps are not equal in time. The bar shows how many steps are done, not
  how many seconds are left.
- While the start-up screen is up, the `#boot` rule in `style.css` hides the
  bar too, so the reader never sees two bars at once.
