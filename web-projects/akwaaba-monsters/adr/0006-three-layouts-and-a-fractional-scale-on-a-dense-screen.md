# ADR 0006: Three layouts, and a fractional pixel scale on a dense screen

## Context

The game draws into a canvas of 240 by 160, which is the size of a Game Boy
Advance screen. The page then scales that canvas up. The first version scaled it
by whole numbers only, and put the touch pad in the page under the screen.

A player reported that the game was hard to control on a phone. Two separate
faults caused it.

**The screen was tiny.** A common phone is 390 page pixels wide. 390 divided by
240 is 1.62, so the biggest whole number that fits is 1. The game filled 240 of
the 390 and left the rest empty. The player was asked to read a stamp.

**The pad fell off the bottom.** The screen, the pad and the notes were one
column in an ordinary scrolling page. The screen was at the top, so the pad was
pushed down past the bottom of a phone window. Scrolling to the pad pushed the
screen out of sight instead.

Whole-number scaling was not an arbitrary rule. A fraction makes some game
pixels one screen pixel wider than their neighbours, and on a monitor that is
plain to see.

## Decision

**The page has three layouts, and `layoutMode` in `ui.js` picks one from the
window shape, the pointer type and whether the player asked for fullscreen.**

| Layout | When | What it does |
|---|---|---|
| `page` | a machine with a mouse | the screen, the pad under it, then the notes |
| `theater` | a touch screen held upright | the screen at full width, the pad on the bottom edge |
| `overlay` | fullscreen, or a touch screen held sideways | the screen fills the window, the pad floats over it |

`app.js` writes the answer on `<body data-layout>` and `style.css` draws each
one. The pad is outlined and faint in `overlay`, so the game stays readable
through it.

Sideways is `overlay` and not `theater` because a phone held sideways is about
390 pixels tall. The screen alone wants all of that, so there is no room under
it for a pad. The pad has to float or it has nowhere to go.

**`pixelScale` may return a fraction, but only when both of two things hold:**

1. the whole number wastes real room. It has to use less than 90 percent of what
   is free. At 4.16 times, scale 4 uses 96 percent, so the fraction buys almost
   nothing and costs an even pixel.
2. `devicePixelRatio` is 2 or more.

On a screen that dense, one game pixel covers four or five screen pixels. A
neighbour one screen pixel wider is far too small a difference to see. An
ordinary monitor is not that dense, so a monitor never gets the fraction and
keeps the even picture the first version had.

## Consequences

**Good.**

- The game is 390 pixels wide on a 390 pixel phone, not 240. That is 2.6 times
  the area.
- The pad is always on screen, and on the bottom edge where a thumb reaches it.
- Fullscreen works on an iPhone too. `overlay` covers the window on its own, so
  the browser's refusal to grant real fullscreen costs only its own bars. `app.js`
  holds the player's wish separately from the browser's answer, which is what
  lets both cases share one layout.
- The three layouts are one pure function, so the rules are tested and no test
  needs a browser.

**Bad.**

- A phone draws some game pixels one screen pixel wider than others. This is the
  price of filling the width, and the 90 percent rule keeps it off every screen
  that would show it.
- Three layouts is three times the CSS to keep true. Each has its own block in
  `style.css`, named after the mode, so a change lands in one place.

**Watch out.**

- A tap on the screen sends `pointerdown` first and a `click` after it. The game
  acts on the `pointerdown`, and if the page moves in between, the browser hands
  that `click` to whatever now sits under the finger. This was real: one tap on
  the screen started the game AND pressed the Fullscreen button that had slid
  into that spot. `preventDefault` on the `pointerdown` does not stop it, because
  it never suppresses `click`. `app.js` catches the click on the way down and
  drops it. Read the comment there before you add a second control near the
  screen.
