# ADR 0012: The card menu lives in the top layer, and one menu serves the board

## Context

Moving a card between columns started as a dropdown on every card. It worked and
it was wrong in two ways: a dropdown is a form control, not a menu, so it cannot
grow to hold anything else a card might offer; and six lines of column names sat
on every card whether or not anybody wanted to move it.

The obvious replacement is a small button that opens a menu, with "Move to"
opening the columns beside it. That runs into one hard constraint and two
browser behaviours that are easy to get wrong.

**The columns scroll sideways.** `.columns` has `overflow-x: auto`, which clips
everything inside it. A menu positioned inside a card is cut off at the column's
edge, and the last column's menu is cut off by the window.

## Decision

**The menu is a `popover`, which puts it in the browser's top layer**, where no
ancestor's overflow can clip it. Nothing positions a popover, so `app.js` places
it against the button that opened it and clamps it to the window.

**One menu serves the whole board**, pointed at whichever card opened it. A board
of forty cards would otherwise carry eighty menus nobody has opened.

Three things had to be right, and each was wrong first:

1. **The browser opens the menu, through `popovertarget`.** Calling
   `showPopover()` from a click handler means the same click then reaches the
   page, and the browser light-dismisses the menu it has just opened. The menu
   flashes and closes, with no error anywhere.
2. **The submenu is nested inside the menu in the DOM.** Two auto popovers that
   are not nested are unrelated, so opening the second closes the first. As
   siblings, hovering "Move to" closed the menu it lives in.
3. **A nested pull request keeps the menu, with no move in it.** It travels in
   its issue's column, because the pair is one piece of work (ADR 0010), so a
   move would write to the document and change nothing on screen. Copying its
   branch does mean something, which is why the menu stays (ADR 0021).

**The columns reach the real edge of the window.** The track is pulled out to the
full width with negative margins and carries the page's gutter as its own
padding, so the first column lines up with the heading above it and the last one
scrolls all the way over instead of stopping in dead space. Negative margins, not
`100vw`: `vw` counts the scrollbar and makes the whole page scroll sideways.

## Consequences

**The menu can grow.** Today it holds one row. Anything else a card should offer
(open on GitHub, copy a link, hide it) is another row, and the columns stay one
level down where they do not crowd it.

**Every position is computed in JavaScript.** CSS anchor positioning would do
this natively and is not in enough browsers yet. The cost is a `placeMenu` call
on each open, and a menu that does not follow the page if it scrolls underneath;
the browser closes it on scroll-away in practice because the click that scrolls
dismisses it.

**A card's button is invisible until the card is approached**, and always
present where there is no pointer (`hover: none`), because a button that appears
on hover never appears at all on a phone.

**This was found by opening the page, not by a test.** All three mistakes above
left every test green: the suite does not execute `app.js`, and none of them
throws. The procedure in `.claude/skills/change-the-board/SKILL.md` already said
to open the page after touching `app.js`; this is the change that proved why.

**Rejected: a dropdown.** It cannot grow and it is a form control pretending to
be a menu. **Rejected: one menu per card.** Eighty elements for a board of
forty. **Rejected: dragging.** Still the gesture people expect from a kanban
board, still a lot of code to do properly on touch as well as with a mouse
(ADR 0011); the menu is what makes moving possible at all in the meantime.
