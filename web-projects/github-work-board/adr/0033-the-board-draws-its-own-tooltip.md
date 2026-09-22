# ADR 0033: The board draws its own tooltip

## Context

The board explains a lot on hover: which pull request a stack number is, what a
column means, whose face that is, what a line will copy, which counts add up to
the number beside the title. Every one of those was a `title` attribute.

A `title` is not the page's tooltip. It is the operating system's. The page
cannot set its font, its colour, its size, its delay, or where it appears, and
it cannot follow the theme the reader chose: on a dark board, Chrome on Windows
still draws a pale yellow-white box in the system font.

It also reads the one tooltip that matters least well. The number beside the
title breaks down into a line per part of the board, and a `title` renders that
as a cramped block in a box sized by somebody else.

There is no way to improve a `title`. There is no CSS for it, and the
replacement the HTML standard is discussing has not shipped anywhere.

## Decision

**The board draws its own tooltip, and nothing on the page sets `title`.**

- **One element for the whole page**, `#tooltip`, in the top layer as a
  `popover`. The columns scroll, so a tooltip drawn inside a card would be
  clipped by the column it sits in, which is the same reason the card menu is a
  popover (ADR 0012). It is a **manual** popover, so opening it never
  light-dismisses the menu, which is an auto one.
- **One way to write a tooltip**: `explain(element, words)`, which sets
  `data-tip`. `invariants.test.js` fails if any module writes `title`, or if
  `index.html` carries the attribute, because one `title` left behind means the
  reader gets two tooltips at once, one of them the system's.
- **One set of listeners, on the page, not on the elements.** The board rebuilds
  every card each time it asks GitHub, so a listener per element would be a
  listener per card per minute. Asking the page also covers everything drawn
  after start-up.
- **A pointer rests 350 milliseconds first; a focus says it at once.** A pointer
  crossing the board must leave nothing behind it, and a reader who tabs to
  something has no way to rest a pointer on it.
- **A finger gets nothing.** `title` does nothing on touch, and that is the one
  thing it gets right: a tap that leaves a tooltip behind is a tooltip the
  reader has to dismiss.
- **`tooltip.js` places it, and it is pure.** Above the thing it is about and
  centred on it, under it when there is no room above, and never off any edge.
  That arithmetic is a test rather than something somebody checks by hovering.

## Consequences

**The board looks like itself on hover**, in both themes: dark box with light
text on a light board, and the other way round on a dark one, which is what
shadcn's tooltip does (ADR 0004).

**A tooltip is extra, never the name.** An interactive element still carries its
own accessible name in `aria-label` or in its text, because a tooltip that is
also the label is a label a screen reader may never read. Nothing was moved out
of `aria-label` into a tooltip.

**A rebuilt board closes it.** `renderBoard` hides the tooltip before it replaces
the cards, or it would point at an element that no longer exists. So would a
scroll or a resize, and both close it too.

**Escape closes it**, like the menu.

**Rejected: keeping `title` as a fallback.** Both would show, one of them the
system's, at different times and in different places.

**Rejected: a tooltip element per card.** Forty cards is forty elements nobody
has hovered, rebuilt every minute.

**Rejected: waiting for the browsers.** There is a proposal to let a page style
this, and no browser ships it. The board is used today.
