# ADR 0002: One versioned save document, only ever added to

## Context

The game keeps its state on the player's device, and the player can download
that state as a file and load it on another one. Root ADR 0007 covers
localStorage for private per-session state; root ADR 0006 puts shareable state
in the URL. A saved game is neither: it is private, and far too big for a URL.

The harder problem is time. This game is built to grow: area 2, area 3, more
species, more items, each added months apart by a different agent. Somebody will
be four hours into a save when area 2 ships. That save has to still work.

The obvious failure is the one that is easy to cause and hard to notice: an
agent renames a species identifier for tidiness, and every save holding that
creature quietly loses it.

## Decision

**One save document, carrying its own version, and only ever added to.**

Three rules, all enforced in `save.js`:

1. **Identifiers are permanent.** Species, move, item, map, flag and badge
   identifiers are written into save files. They are never renamed and never
   reused for something else.
2. **Fields are only ever added**, and every new field gets a default in
   `migrate`. A save written before the field existed still loads.
3. **`migrate` keeps what it does not recognise.** A save touched by a newer
   build loses nothing when an older build opens it. That is what lets a player
   move a file between two devices running different versions.

`migrate` never throws. A field of the wrong type is replaced with a sensible
default, a number outside its range is pulled back in, and a creature whose
species this build does not have is dropped. Losing one creature beats losing
the whole game.

A file from a newer version than the build reading it is refused with a message
that says what to do, rather than being half-read.

## Consequences

**Good.**

- A save survives new areas, which is the whole point.
- A corrupt or hand-edited file cannot break the game. `save.test.js` throws
  rubbish at `migrate` on purpose: wrong types, silly numbers, missing halves,
  a party of ten.
- The exported file is plain indented JSON. A player can read it, and so can a
  person debugging a report.

**Bad.**

- The identifiers are ugly forever. A species named badly in area 1 keeps its
  name. Only its display name can change.
- `migrate` grows a little with every version, and nothing ever gets deleted
  from it.
- Nothing stops a player editing the file to give themselves anything. This is a
  single-player game with no leaderboard, so that is their business.

**Not decided here.** Save slots. There is one save plus the exported file. See
`ROADMAP.md`.
