# ADR 0001: Draw every picture from code, not from image files

## Context

This is a creature-collecting game in the shape of a Game Boy Advance title. A
game like that normally ships hundreds of files: a sprite sheet per creature, a
tile sheet per area, a font, and a picture for every icon. That is how the real
ones are built, and it is the obvious way to build this one.

Three things made it the wrong way here.

First, the licence. The look is modelled on Pokemon Emerald. Nintendo's actual
art cannot be used, so every picture would have to be made from nothing anyway.

Second, the repository. `web-projects/` holds small, self-contained pages in a
site with no build step (root ADR 0002). A folder of binary files is not
reviewable in a pull request: a reviewer sees "creature.png changed" and has to
take it on trust.

Third, the agents. This project is meant to grow one area at a time, each area
built by a different agent in a different session. An agent can write a text
file. It cannot draw a sprite sheet.

## Decision

**The game ships no image files and no font files. Every picture is generated
in the browser when the page loads.**

Pictures come from a shape list. A creature is a short list of ellipses,
polygons, lines and single pixels, which `art/pixelArt.js` rasterises at start
up and then wraps in one dark contour and shades along the top and bottom rims.
That last pass is what gives the whole game one look, drawn from Adinkra symbols
and printed cloth: bold flat colour inside a heavy line.

Two rules hold the creatures together: every one is forty by forty and faces the
viewer, so the battle screen can flip the player's side rather than needing a
second drawing; and the middle is 19.5, not 20, so `sym: true` pairs an eye with
its twin exactly.

People come from one builder, so a new villager is a handful of colours rather
than a drawing, and "facing right" is "facing left" read the other way round.

Letters come from a five by seven bitmap alphabet in `art/font.js`, written as
strings of `#` and `.`. A system font would also have broken the look, because
it would be the one smooth thing on a screen of hard pixels.

Sound is generated too, for related but not identical reasons. See ADR 0004.

## Consequences

**Good.**

- A creature is a diff a person can read. "Move the ear two pixels left" is a
  line change, not a new binary.
- The whole game is text, so it works with the site's no-build rule.
- A later agent can add a creature, a tile or a person with nothing but a text
  editor.
- Nothing to download at run time. The page makes no network calls at all.
- The rasteriser and the font metrics are pure, so they are tested.
  `art/art.test.js` cross-checks that every species and every tile has a
  drawing, that no tile has a hole in it that would show the page behind the
  map, that a tile carries no outline that would draw a grid over the ground,
  and that only the player uses the visitor skin tone.

**Bad.**

- The art has a ceiling. Shapes and flat colour cannot do what a pixel artist
  does by hand, and a creature that needs fine texture will not get it.
- Everything is rasterised at start up. Twenty one creatures, thirty three tiles
  and fourteen people take a few milliseconds, which is fine, and would not stay
  fine at ten times the size. The atlas in `render.js` is where to look if it
  ever does.
- Writing a creature is slower than drawing one, for a person who can draw.

**Watch for.** If a later area needs art this cannot make, the answer is not to
add one image file quietly. It is to write a new ADR that changes this decision
for the whole game, so the project does not end up half one thing and half the
other.
