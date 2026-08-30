# Roadmap

What this first iteration left out, and where to add it.

The game is built to grow one area at a time. This file is the handover note:
read it before you add anything, because most of the things below already have
a place waiting for them, and a few of them were left out on purpose.

---

## Read this first: how to add area 2

Area 1 is `areas/area1.js`. It holds its maps, its people, its trainers and
every line anybody says. Nothing outside `areas/` knows Aduma exists.

To add area 2:

1. Write `areas/area2.js`, exporting `MAPS`, `TRAINERS` and, if it awards one,
   `BADGES`. Copy the shape from `area1.js`.
2. Add one line to `areas/index.js`: import it and put it in `AREAS`.
3. Join it to area 1 with a warp. The north road out of Bosua is the intended
   seam: Nana Kofi's last line already points that way, and the gym map has room
   for an exit at the top.
4. Add species to `species.js`, moves to `moves.js` and art to
   `art/creatures.js`. `art/art.test.js` fails until every new species has a
   drawing, which is the reminder.
5. Run `bun test .` from the repository root. `areas/areas.test.js` checks the
   new maps join up, that every warp leads back, that no trainer stands on the
   only path and that difficulty climbs. It found seven real mistakes in area 1.

`areas/balance.test.js` checks the difficulty of what you add. Its rules copy
measured numbers out of Pokemon Emerald, and ADR 0005 lists every one with the
number it came from. The rules that bite hardest when you write a new area are
these: a route holds nothing that out-hits what the player carries, and no
script poisons the party and then starts a battle.

Two rules are not negotiable, because save files hold them:

- **Never rename an identifier.** Species, move, item, map, flag and badge
  identifiers are permanent. See `adr/0002-one-versioned-save-additive-only.md`.
- **Only add fields to the save document**, and give each one a default in
  `migrate` in `save.js`. A save written today has to load in area 7.

---

## Left out on purpose, and asked for later

These four are memories from the trip. They were deliberately held back from
this iteration so they can be built properly rather than squeezed in.

### The tuk tuk

A three-wheel tuk tuk replaces the bicycle: it doubles walking speed and its
driver haggles the fare before he will take you. Unlocked somewhere in a later
area, not this one.

Where it plugs in: `updateField` in `app.js` sets `STEP_FRAMES` per step. Make
it read a value from the save (`state.player.vehicle`) instead of the constant.
The `world.js` tile table already has room for a "no tuk tuk here" flag, which
buildings and the mine will want.

### The bridge toll man

A man stands on the rope bridge and will not let you across until you pay him.
You can haggle him down, or find the path around that a child tells you about.

Where it plugs in: `river` in `area1.js` already has a bridge at x=12, and the
only gate mechanism in the area (the Equip Galamsey guard at 22,8) shows the
pattern: an NPC with `hideWhen`, plus a script that refuses to move. A toll
needs one more thing the script engine does not have yet: a step that takes
money only if the player has it. Add a `condition` of `{ moneyAtLeast: n }`
around the branch; `evaluateCondition` already supports it.

### The children shouting "obroni"

A group of children run at the player shouting "Obroni! Obroni!" and follow for
a few steps, and one of them gives you something if you talk to all of them.

There is a single child on Route 1 who says the word, as a seed. The set piece
is the group: several children who follow the player for a few tiles. That
needs NPCs that walk on their own, which `updateWanderers` deliberately does not
do (a person who wandered into a doorway would shut the player out of a
building). Add a proper follow behaviour rather than loosening the wanderer.

Note on the word: "obroni" is Twi for a foreigner, and in Ghana children shout
it at visitors warmly, not as an insult. The player is the only light-skinned
person in the region, and `art/art.test.js` enforces that: only `playerBoy` and
`playerGirl` use `SKIN.visitor`. Keep it that way or the joke stops making
sense.

### The market

A busy market map with jollof, fufu, plantain and a woman selling water in bags
on her head. Food items heal creatures, which the items table already does:
`sachetWater`, `jollof` and `kelewele` are in `items.js` and buyable in Bosua.
What is missing is the map itself and the stalls to talk to.

---

## Built but with no screen yet

These already exist in the data and in the save file. They need a screen and
nothing else.

- **The field guide.** Every species has an `entry`, a height and a weight in
  `species.js`, and the save keeps `seen` and `caught` lists that are already
  filled in as you play. The player screen shows the counts. There is no screen
  that lists them.
- **Nicknames.** `monster.nickname` is honoured everywhere by `displayName`, and
  the save keeps it. Nothing ever asks for one.
- **Where a creature was met.** `metAt` and `metLevel` are recorded on every
  creature. Nothing shows them.

---

## Not built at all

Roughly in the order they would help.

### Play

- **A town map screen.** There is no map item and no map screen.
- **Fishing and swimming.** Water is solid. `world.js` marks the water tile
  with `water: true` for exactly this.
- **Ground items.** There is nothing to pick up off the floor; everything is
  given by a person. A map would need an `items` array and a small sprite.
- **Move tutors and machines.** A creature learns moves only by levelling.
- **A move relearner**, for a move turned down at level up.
- **Running.** There is one walking speed.
- **Day and night**, and creatures that only appear at one of them.

### Battle

The engine follows Gen 3 in shape but leaves out four systems on purpose, to
keep the first iteration finishable. Each one is a change to `calcDamage` and
its neighbours in `battle.js`, and to nothing else:

- **Abilities**
- **Held items**
- **Natures**
- **Effort values.** `statsAtLevel` in `monsters.js` has the hidden talent
  numbers already; effort values would go in the same formula.

Also missing: double battles, multi-hit moves, recoil, moves that take two
turns, weather, and a move that hits every creature on the field.

### Elsewhere

- **More languages.** The game is English only. The words are written inline
  where they are used, not in a catalogue, which was the right call for one
  language and is the first thing to change for two. `deployText.js` shows the
  shape a catalogue takes. `art/font.js` has no accented letters yet, and
  `art/font.test.js` will fail loudly the moment a translated string needs one.
- **More save slots.** There is one save, plus the exported file.
- **More music.** Eight songs cover the whole game. Each area could have its
  own, and the gym leader could have a theme of his own.
- **A proper ending.** Beating Nana Kofi ends the content. There is no credits
  screen and no "to be continued".

---

## Known rough edges

Honest list of things that work but could be better.

- **The box holds one page and no groups.** Every creature sits in one long
  list that scrolls six rows at a time. The real games give you several boxes
  with names and a wallpaper. One list is enough for the numbers area 1 can
  produce, and `state.box` is a plain array, so a later iteration can group it
  without touching the save format.
- **Losing a battle** heals the party and moves the player home (or to the
  Akwaaba Centre once the mine is cleared). It costs no money, which the real
  games do charge.
- **Trainers do not re-fight.** Once beaten they stay beaten, and they keep
  standing where they were.
- **The wild encounter rate** is a flat 13 percent per step in grass. There is
  no "you have walked a long way" smoothing, so a run of five in a row happens.
- **A trainer walking to the player** always walks in a straight line. It cannot
  go round a corner, which is why every trainer in area 1 has a clear line to
  where the player will be. `areas.test.js` checks that line exists.
- **The battle backdrop** is the same everywhere. A cave battle looks like a
  battle in a field.
- **No shoreline.** Water meets sand along a straight line, one square wide, and
  so does every other pair of grounds. The tile set now splits ground from the
  things standing on it (ADR 0007), so softening a join means new art and no new
  design: draw a `shore` tile that stands on the ground, holes and all, and lay
  it along the water's edge on the `over` layer. The join between two *grounds*
  still needs a picture per corner, which is why it was left.
- **Tall grass is a rectangle.** Its shade is a dither over the ground rather
  than a fill, so the edge of a patch breaks up rather than ruling a line, but a
  patch is still the rectangle the map wrote. Rounding a patch needs edge tiles
  in the same way a shoreline does.
