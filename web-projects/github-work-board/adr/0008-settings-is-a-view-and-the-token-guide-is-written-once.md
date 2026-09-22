# ADR 0008: Settings is a view in the link, and the token guide is written once

## Context

Once the board holds a list of tokens (ADR 0007), managing them needs somewhere
to live. The first version put "add another token" inside the connection card,
which is on the same screen as the work. That card grows with every token, and
none of it is anything a person reads while working.

The obvious home is a settings screen, and that raises two questions.

**A second HTML file, or a second view?** A separate `settings.html` would need
its own copy of the head, the styles, the deploy stamp and the start-up code,
and the two pages would drift.

**How does the settings screen explain what to grant?** The welcome screen
already explains it, at length, and correctly. Copying that markup into a second
place recreates exactly the failure ADR 0005 removed from the permission list:
two copies of the same instructions, one of which will be updated and the other
will not.

## Decision

**Settings is a view of the one page, named in the address bar.** `?view=settings`,
alongside `?sort=` (root ADR 0006). `urlState.js` reads and writes both, the
default is left out, and `history.replaceState` is used, so opening settings is
not a place the back button returns to. A reload comes back to the same screen,
and a bookmark works.

Settings needs a token to manage, so before the first connection it is not
reachable: the welcome screen is the settings screen at that point.

**One control moves between the screens.** The masthead button is the only way
in and the only way out: it reads "Settings" on the board and "Back to the
board" in settings.

The first version put the way out at the top of the settings card. Settings was
taller than a window (about 1900 pixels against 840), so scrolling even once put
the only exit off the screen, with nothing below it to click. A reader who had
scrolled had no way back at all. The answer then was one toggle in a header that
stayed put, and it removed the second button that said the same thing.

**The header no longer stays put.** The token guide moved to its own screen
(ADR 0018) and settings shrank to about one screen with it, so the reason for
the stickiness went with it. ADR 0023 measured that and took it out. What
survives from this decision is the part that was never about scrolling: one
control moves between the views, and no screen carries a second one.

**The token guide is a `<template>` in the page, cloned into every slot.**
`index.html` holds it once; `app.js` clones it into the welcome screen and into
the add-token screen (ADR 0018), filling the permission list inside each copy
from `REQUIRED_PERMISSIONS`. `invariants.test.js` fails when the page holds more
than one guide, or more than one permission list.

The view names are permanent, like the sort ids: they travel in links.

## Consequences

**One page keeps one start-up path.** No second head to keep in step, no second
deploy stamp, and the styles, the token list and the board all read the same
state.

**The guide is written in one place and read in two.** Adding a step to it, or a
permission, changes both screens at once. The cost is that the guide is now HTML
that no screen shows directly, so somebody reading `index.html` top to bottom
meets it before they meet either place it appears.

**A `<template>` is inert until cloned**, so nothing inside it can be reached by
`getElementById`. Anything the code needs inside a copy has to be found through
the clone, by class, which is why the permission list inside it carries a class
and not an id.

**A sticky header cost vertical room on every screen**, including the board,
where nothing needed it. That was the price of a control always in reach, and
it stopped being worth paying once settings fitted on a screen (ADR 0023).

**Settings is not reachable before connecting.** Somebody who lands on
`?view=settings` with no token saved gets the welcome screen instead. That is
right for now, and it would be wrong if settings ever held something that
applies before a connection.

**Rejected: a separate `settings.html`.** Two heads, two start-ups, two deploy
stamps, and every shared part duplicated or extracted into a module that both
load, for a screen that shows a list and a form. **Rejected: a dialog over the
board.** The site has no dialog part (ADR 0004), the content is long enough to
scroll, and a link to it is worth having.

> **Note (2026-09):** the token guide in this page no longer mentions the board repository. The shared cloud storage panel carries its own guide, written once in `cloudSettingsPanel.js` and filled from its own permission list (root ADR 0016). Settings mounts that panel in full under "Where your half of the board is saved".
