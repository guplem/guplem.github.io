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
| `battlePlayback.js` | What the battle screen shows: a copy of the battle that events move forward one at a time |
| `monsters.js` | One creature: stats, experience curves, levelling, evolution, moves |
| `species.js`, `moves.js`, `items.js`, `types.js` | The data tables |
| `save.js` | The save document, its checking, and its migration |
| `rng.js` | The seeded generator whose position the save keeps |
| `ui.js` | Menu arithmetic: cursors, scrolling, bars, the camera |
| `music.js` | The songs, the notation, and the creature cries |
| `art/pixelArt.js` | The rasteriser: shapes to pixels, outline, shading |
| `art/creatures.js`, `art/tiles.js`, `art/people.js`, `art/font.js` | The pictures |
| `render.js` | Canvas drawing, and where each box and panel sits. Holds no rules and makes no decisions |
| `audio.js` | Web Audio scheduling. Holds no notes |
| `app.js` | The loop, the input and every screen. The only file with mutable state |

Everything above `render.js` in that table is pure and tested. `render.js`,
`audio.js` and `app.js` touch the browser and have no tests, which is why they
are kept thin: anything worth testing was pushed next door. The one thing the
tests do read from `render.js` is its geometry: `BOX`, `PROMPT_W` and `PANELS`
are plain numbers, and `art/font.test.js` measures the game's words against
them. Keep the top of `render.js` free of anything that touches the browser, or
those tests stop loading.

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

`areas/balance.test.js` is the other unusual one. `areas.test.js` checks that
the world joins up. `balance.test.js` checks that the world can be beaten, and
every rule in it copies a measured number out of Pokemon Emerald. Read ADR 0005
before you change any level, learnset or base stat.

`art/font.test.js` reads every string in the game and fails if any character is
missing from the font, if any line needs more than four pages of the message
box, or if any description needs more rows than the panel that shows it. That
catches a pasted curly quote before a player sees a question mark, and a blurb
one word too long before a player loses the end of it.

## The balance rules, in one place

A level 5 starter is the fixed point. Emerald is the reference for each rule.

- **The first grass stays below the starter's level.** Emerald runs Route 101 at
  Lv 2-3 against a Lv 5 starter.
- **The first grass holds no creature stronger than the weakest starter**, and
  none of the seven friend creatures. Emerald tops Route 101 out at Zigzagoon,
  240 points against a 310 starter.
- **Nothing on the first route out-hits the starter's own best move.** Emerald
  holds Bite and Wing Attack, both 60 power, back to level 13. Both once sat at
  level 5 here, and one Sumsu ended the grass starter in a single turn.
- **Nothing in the first grass can leave a lasting condition.** Emerald teaches
  Wurmple its Poison Sting at Lv 5 and stops Route 101 at Lv 3, so the move is
  one level out of reach.
- **No early trainer fields a party that beats one starter's element outright.**
  The player still has one creature and cannot switch out of a bad matchup.
- **The three starters carry the same base stat total.** Treecko, Torchic and
  Mudkip all carry exactly 310.
- **A script never poisons the party and then starts a battle.** The player
  cannot reach the bag between the two steps.

## Gotchas

- **A panel that turns no page must show every line.** The starter blurb, the
  bag description and the shop description have no arrow and no key to press, so
  a line they leave out is a line the player never reads. Each one takes its
  width and its row count from `PANELS` in `render.js`, and each row count comes
  from the height the panel really has. `paginate(text, w, 2)[0]` is the shape
  of the bug that cut the end off all three: it asks for two rows and throws the
  rest away without a word. Use `wrapText` and give the panel its real height.
- **Give `renderer.message` a string, not lines.** The box then breaks the
  string to its own width. Hand it an array only when you paged the text
  yourself, which is what `say` does. A string passed as one line used to run
  off the box, and on the battle screen the action menu drawn next to it hid the
  ending.
- **The shop hint sits on the last row of the description box.** `PANELS.shop`
  stops above it. Move one and you must move the other.
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
- **In `battle.js`, a `message` event comes before the event that changes the
  picture.** The battle screen draws `battleView.shown`, a copy of the battle
  that `battlePlayback.js` moves forward one event at a time, so the order the
  events carry is the order the player sees. Push a `damage` before the line
  that names the move and both health bars fall while the box still reads
  "Nacho used Tackle!". The one exception is `faint`: the creature drops, and
  the log then names it. `battle.test.js` pins the rule under "the order of the
  events". See ADR 0006.
- **An event that changes the picture carries the value it lands on**, not only
  the step: `damage` carries the health left, `exp` the new total, `levelUp` the
  health a level gained. `applyBattleEvent` copies those values across rather
  than redoing the engine's arithmetic, so the two can never disagree. Teach
  `applyBattleEvent` about any new event of this kind.
- **The player is the only light-skinned person in the region.** That is the
  setting, and it is what the children shouting "obroni" are reacting to.
  `art/art.test.js` fails if any other character uses `SKIN.visitor`.
- **Only tall grass starts a battle outdoors.** A cave sets
  `encounters.anywhere` instead, because it has no grass to grow.
- **Each column of the box screen ends in one empty slot.** That slot is not
  decoration. It is the only target that makes a move with no partner: drop a
  creature on the empty box row to put it away, drop a boxed creature on the
  empty team row to bring it out. Remove the slot and the screen can only swap.
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
| [0005](adr/0005-early-game-balance-copies-emerald.md) | The early game copies Pokemon Emerald, number for number |
| [0006](adr/0006-the-screen-trails-the-engine-by-one-event.md) | The screen keeps its own copy of the battle and trails the engine by one event |
