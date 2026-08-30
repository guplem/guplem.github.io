# ADR 0003: An area is one file, and adding one changes no engine code

## Context

The brief was explicit: this iteration covers the start of the game to the first
gym, and later iterations, built by later agents, add the second area, the
third, and so on.

That makes the seam between engine and content the most important design
decision in the project. If area 2 needs changes in the battle engine, the world
engine and the game loop, then every area is a rewrite risk, and an agent
opening this repository in six months has to understand all of it before it can
add a town.

## Decision

**Everything about an area lives in one file under `areas/`, and adding an area
is a new file plus one line in the register.**

`areas/area1.js` holds the maps, the people, the trainers, the badge and every
line anybody says. `areas/index.js` imports it and merges it. Nothing outside
`areas/` knows Aduma village exists.

Three things make that possible:

- **Maps are data.** A map is a grid of characters plus a legend. `world.js`
  holds the rules every map obeys and no map of its own.
- **Conversations are data.** Every line, question, cut scene and gym door is a
  list of steps that `events.js` walks, handing out one effect at a time.
  `app.js` carries the effects out. Adding a kind of step means one case in each
  and nothing else.
- **Creatures, moves and items are data**, in tables with tests that check the
  tables rather than the code.

The register refuses two areas that share a map, trainer or badge identifier,
because a save file holds those names and a collision would move a player to the
wrong place without any error.

## Consequences

**Good.**

- Area 2 is one file and one line. `ROADMAP.md` has the recipe.
- `areas/areas.test.js` checks the content rather than the code: every map joins
  up and can be reached from the start, every warp leads back, no trainer stands
  on the only path, every sign sits on something solid, every trainer can
  actually see the player walk past, and difficulty climbs to the gym leader. It
  found seven real mistakes while area 1 was being written.
- An agent can read one file and understand a whole area.

**Bad.**

- The area file is long. Area 1 is around a thousand lines, most of it map grids
  and dialogue.
- A step the script engine cannot express has to be added to the engine. That is
  the intended pressure: it keeps the vocabulary small and shared.
- Anything two areas share has to live outside `areas/`, and there is no obvious
  home for it yet. The first time area 2 wants a person from area 1, decide then
  rather than guessing now.
