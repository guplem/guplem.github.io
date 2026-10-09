# ADR 0046: The menu speaks in icons, and a card moved by hand wears a dot

## Context

The card menu was a list of words. With the reader's own lines (ADR 0031) and
three priorities (ADR 0044) it grew to eight rows or more, and every visit the
reader read it from the top to find one row.

The two priority marks did not look alike. A raised card wore a flame in its
corner (ADR 0044). A card pushed down was only fainter (ADR 0026), so a faint
card could read as a card still loading, and nothing on it said why.

A card moved by hand gave no sign of it at all. The reader's choice outranks the
rules for ever (ADR 0011), so a card moved last week can sit in the wrong column
today, and the board looked exactly as it does when a rule is wrong.

## Decision

**Every row in the card menu leads with an icon.** The icon is drawn from SVG
paths that the module owning its meaning holds: `cardMenu.MENU_ICON_PATHS` for
the note, the branch and the move, `priority.PRIORITY_PATHS` for the
priorities, and `copyActions.COPY_ICONS` for the reader's lines. `app.js` draws
every icon through one function, `drawIcon`.

**One icon per priority, shared by the menu and the card.** High is the flame,
normal is a level line, and "not a priority" is an arrow to the bottom line,
because the bottom is where the smart order takes the card. A card marked high
or low wears its icon in the top corner, and the menu button moves one place
left. The low mark fades with the rest of the card. An ordinary card wears no
mark, so the level line appears only in the menu.

**A line the reader wrote can carry an icon: one from a list, or one emoji.**
The list is twelve icons in `COPY_ICONS`. The emoji is whatever the keyboard
sends, and the last emoji typed is kept, because a line has one icon. A line
with no icon, or with an icon this build does not know, draws the plain copy
icon, so every row in the menu lines up. The icon is stored on the line's own
record in `board.json`, as the icon's id or as the emoji itself.

**A card moved by hand wears a blue dot on its menu button, and on the "Move
to" row.** The dot keeps the menu button in sight, which otherwise appears only
on hover, because a dot that shows only on hover tells the reader nothing. The
pointer on the dot names both columns: the one the reader chose, and the one
the rules would choose. `cardMenu.cardMenuRows` decides when the dot shows, with
every other row (ADR 0022). `columns.handMove` gives the two names.

**Blue, because no verdict on the board is blue.** Red, amber, orange and green
already say something about the work. The dot says something about the reader's
own choice, and must not read as a fault.

## Consequences

- **An icon id is permanent**, like a placeholder (ADR 0031). It is written into
  `board.json` the moment the reader picks it, so a renamed id would draw the
  plain copy icon on every line that used it. `invariants.test.js` pins the ids.
- **An older build drops the icon when it edits a line.** It writes the label
  and the template and nothing else. The line still works; it loses its icon.
- **A moved card is noisier on purpose.** Its menu button is always in sight.
  Moved cards are few, and each one is a choice that can go stale (ADR 0011).
- **A card moved to the column the rules would pick still wears the dot.** The
  record still outranks the rules, and the next change on GitHub will show it.
  The words say "the same column today", and "Automatic" removes the dot.
- **Rejected: any SVG or picture the reader uploads.** A picture is a file to
  store and a thing to sanitise, on a page that holds a credential (ADR 0001).
  Twelve icons and every emoji cover what a menu row needs.
- **Rejected: a free text box for the icon.** Letters in the icon box would
  draw as a word in the menu. Text that is not one emoji draws the plain icon.
