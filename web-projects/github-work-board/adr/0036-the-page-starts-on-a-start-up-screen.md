# ADR 0036: The page starts on a start-up screen, and every other screen starts hidden

## Context

A reader with a token, who hard-refreshed the board, saw the welcome screen for
a moment: "Connect it, once", the whole token guide, the empty token box. Then
it vanished and the board appeared.

Nothing was wrong. The browser paints `index.html` before it runs a line of the
board's own code, and `app.js` is a module with `defer`, which the browser
fetches, parses and runs after the page is parsed. That module imports about
thirty others. Until the last of them arrives, the page on screen is whatever
the HTML said, and the HTML said the welcome screen.

Two things are wrong with that, and the second is the worse one.

- **It is a lie.** The reader is connected, and the page tells them they are
  not. On a slow connection the lie lasts long enough to act on.
- **It says nothing about what is happening.** A flash of the wrong screen, then
  another screen, reads as a page that is broken rather than a page that is
  working.

The placeholder rule (ADR 0004) does not reach this. Placeholders are drawn by
the same code that has not arrived yet.

## Decision

**The HTML shows a start-up screen, and every other screen in the file starts
hidden.** `#boot` is the only section without a `hidden` attribute.
`invariants.test.js` checks all five, because the fix is one attribute and it is
one attribute away from coming back.

**The start-up screen is a bar and a line saying what is happening now.** Three
steps, in `messages.js` as `BOOT_STEPS`:

| Step | What the reader is waiting for |
|---|---|
| Loading the board's code | the modules the page imports |
| Reading what this browser saved | the saved tokens, the local mirror of the board file, and the hand-over from older versions |
| Opening your board | the screen the address bar asks for |

**The first step is written in `index.html`.** Nothing else can write it: the
code that would set it is the thing being waited for. The words live in
`BOOT_STEPS` as well, and a test keeps the two copies the same.

**The bar fills step by step. It never slides on its own, and it never starts
empty.** A bar that moves without being told anything says nothing about how far
along the page is, and a bar at zero reads as a page that has not started.

**The start-up screen ends where the board first knows which screen the reader
is on: `showView`.** One function takes it away, `finishBoot`, called from
there. A second place would take it away early, and a path that forgot to would
leave the reader looking at a bar for good. A `start()` that throws says so in
the same line, because the page cannot recover and a frozen bar explains
nothing.

**One watchdog, and it is the only script in `index.html`.** `app.js` cannot
report a failure to load itself: a module that does not resolve never runs a
line, so the `try` around `start()` is never reached and the screen sits there
for ever saying "Loading the board's code". A ten second timer in the page says
so instead. It was written after exactly that happened in a browser holding one
stale module.

**It hands over to the screen, not to the answer.** The reader with a token gets
the board with its placeholders and its turning refresh button (ADR 0004,
ADR 0029) while GitHub is asked; the reader without one gets the welcome screen.
The bar is about this browser, and the placeholders are about GitHub.

## Consequences

- **The welcome screen is now unreachable until the board has decided.** Adding
  a screen to `index.html` means adding `hidden` to it as well, which the
  invariant test is there to remind whoever forgets.
- **Every reader now waits on one more screen.** It is the honest one, and it is
  the same card as the screen that follows it, so the swap moves the words and
  nothing else.
- **The steps are coarse on purpose.** A step for each of the thirty imports
  would be truer and useless. Three steps name the three things that can be
  slow.
