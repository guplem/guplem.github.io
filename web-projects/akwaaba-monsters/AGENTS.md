# web-projects/akwaaba-monsters/AGENTS.md

> **SCOPE:** These rules apply when working inside
> `web-projects/akwaaba-monsters/`. Read `web-projects/AGENTS.md` first for the
> rules every web-project follows.

A creature-collecting role playing game set in tropical Ghana, in the shape of a
Game Boy Advance title. It is built to grow one area at a time.

**Read `ROADMAP.md` before you add anything.** It lists what this iteration left
out on purpose, what is already built and only needs a screen, and the recipe
for adding area 2.

## The one rule that breaks saved games

Species, move, item, map, flag and badge **identifiers are permanent**. They are
written into save files. Renaming one for tidiness loses a player's creature
with no error. Only display names may change. See ADR 0002.

Adding a field to the save document is fine, as long as `migrate` in `save.js`
gives it a default.

## Where everything lives

The line that matters most is between the **engine** and the **content**. The
engine holds rules and no world; the content holds a world and no rules.

| File | What it holds |
|---|---|
| `areas/area1.js` | **All of area 1**: maps, people, trainers, badge, every line of dialogue |
| `areas/index.js` | The register that merges areas and refuses clashing identifiers |
| `world.js` | Tiles, collision, ledges, sight lines, encounters, map checking |
| `events.js` | The script engine every conversation and cut scene runs on |
| `battle.js` | Turn resolution, damage, status, stat stages, catching, the foe's choices |
| `monsters.js` | One creature: stats, experience curves, levelling, evolution, moves |
| `species.js`, `moves.js`, `items.js`, `types.js` | The data tables |
| `save.js` | The save document, its checking, and its migration |
| `rng.js` | The seeded generator whose position the save keeps |
| `ui.js` | Menu arithmetic: cursors, scrolling, bars, the camera |
| `music.js` | The songs, the notation, and the creature cries |
| `art/pixelArt.js` | The rasteriser: shapes to pixels, outline, shading |
| `art/creatures.js`, `art/tiles.js`, `art/people.js`, `art/font.js` | The pictures |
| `render.js` | Canvas drawing. Holds no rules and makes no decisions |
| `audio.js` | Web Audio scheduling. Holds no notes |
| `app.js` | The loop, the input and every screen. The only file with mutable state |

Everything above `render.js` in that table is pure and tested. `render.js`,
`audio.js` and `app.js` touch the browser and have no tests, which is why they
are kept thin: anything worth testing was pushed next door.

## Adding an area

1. Write `areas/areaN.js` exporting `MAPS`, `TRAINERS` and any `BADGES`.
2. Add one line to `areas/index.js`.
3. Join it with a warp. The north road out of Bosua is the intended seam.
4. Add species to `species.js` and art to `art/creatures.js`.
5. Run `bun test .` from the repository root.

No engine file should need to change. If one does, that is worth a moment's
thought: the vocabulary is deliberately small.

## The tests check the content, not just the code

`areas/areas.test.js` is the unusual one. It reads the maps and the scripts as
data and checks the *world*: every map joins up and can be reached from where a
new game starts, every warp leads back, no trainer stands on the only path, no
person stands on a warp, every sign sits on something solid so the player can
face it, every trainer has a line of sight somebody can walk into, difficulty
climbs to the gym leader, and all seven friend creatures appear somewhere.

It found seven real mistakes while area 1 was being written. Keep it fed.

`art/font.test.js` reads every string in the game and fails if any character is
missing from the font, or if any line needs more than four pages of the message
box. That catches a pasted curly quote before a player sees a question mark.

## Gotchas

- **Tiles carry no outline and no shading.** Both draw a seam between two copies
  of the same tile. `art/art.test.js` enforces it.
- **A creature faces the viewer and is symmetric about 19.5**, not 20. The
  battle screen flips the player's side rather than holding a second drawing.
- **A person is 16 by 20 and the map lifts them 4 pixels**, so the head overlaps
  the tile above. Hair must stop at the hairline or all four directions look the
  same.
- **`updateWanderers` turns people but never walks them.** Somebody who wandered
  into a doorway would shut the player out of a building.
- **Cosmetic randomness uses `Math.random`, never `game.rng`.** The saved
  generator decides encounters; moving it along for decoration would change
  which creature the next patch of grass holds.
- **A battle is never saved**, so `battle.rng` is allowed to be a live object.
  The real games do not let you save mid-fight either.
- **The player is the only light-skinned person in the region.** That is the
  setting, and it is what the children shouting "obroni" are reacting to.
  `art/art.test.js` fails if any other character uses `SKIN.visitor`.
- **Only tall grass starts a battle outdoors.** A cave sets
  `encounters.anywhere` instead, because it has no grass to grow.
- **Each column of the box screen ends in one empty slot, except the team
  column when the team is full.** That slot is not decoration. It is the only
  target that makes a move with no partner: drop a creature on the empty box
  row to put it away, drop a boxed creature on the empty team row to bring it
  out. Remove the slot and the screen can only swap.
- **The party always keeps one creature that can fight.** `depositToBox` and
  `swapWithBox` refuse a move that leaves the team empty, or that leaves only
  fainted creatures. `createBattle` throws on a party where everything has
  fainted, so without this guard the next patch of tall grass crashes the game.

## Architecture Decision Records

| ADR | Topic |
|---|---|
| [0001](adr/0001-draw-and-play-everything-from-code.md) | Draw every picture from code, not from image files |
| [0002](adr/0002-one-versioned-save-additive-only.md) | One versioned save document, only ever added to |
| [0003](adr/0003-an-area-is-one-file.md) | An area is one file, and adding one changes no engine code |
| [0004](adr/0004-generated-audio-not-audio-files.md) | Generate the music, do not ship it |
