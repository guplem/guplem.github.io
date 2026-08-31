# ADR 0010: A machine is a tile you walk up to, and the box left the menu

## Context

The game had one way to heal a party: talk to the nurse in the Akwaaba Centre in
Bosua. The Centre opens after a village, a route, a river and a mine, so for the
whole first hour the only cure was an item bought with money the player does not
have yet.

The box had the opposite problem. It was an entry in the pause menu, so a player
could move creatures between the team and the box while standing in tall grass,
anywhere in the world, at any moment. The real games this one is shaped after do
not allow that, and the menu entry made the box feel like a spreadsheet rather
than a place.

Both are the same missing idea: **a thing in the world that the player uses**.
The game already had people (an NPC with a script) and signs (a position with
words). It had nothing for a machine, so the healing was written into one
person's dialogue and could not be put anywhere else.

## Decision

**A machine is a tile. Placing the tile places the machine.**

`world.js` gains two solid tiles, `healer` and `computer`. `objects.js` says what
each one does, as an ordinary script of the kind `events.js` already runs:

```js
export const OBJECTS = {
  healer: { name: "healing machine", script: [ ... ] },
  computer: { name: "storage computer", script: [ ... ] },
};
```

`app.js` checks `objectAt(map, x, y)` when the player presses A, before it looks
for a sign. An area author places a machine by writing its character into a map,
and by nothing else. There is no list to register, no script to copy and no
engine code to change, which is the same promise ADR 0003 makes for an area.

Two things follow from that decision:

- **The box moved out of the pause menu and onto the storage computer.** A new
  script step, `box`, opens the box screen and waits, the way `shop` does. The
  screen itself did not change.
- **Machines stand in Professor Abenaa's hut and in the Akwaaba Centre**, one of
  each in both. The hut is where the player chooses a first creature, so the
  first hour now has a free cure in the room the story starts in.

## Consequences

**A machine can go anywhere, including in an area nobody has written yet.** Area
7 writes `e` into a map and gets a working healing machine, in its own art, with
its own room around it.

**A player can no longer reorganise the team in the middle of a field.** That is
the point, and it is also a real cost: a player who catches a seventh creature
carries it in the box until the next computer. Both maps that heal also store,
and `areas/areas.test.js` fails if a future map ever heals without storing, so
the walk is never longer than the walk to a cure.

**The engine holds two scripts of dialogue**, which is a small hole in the line
that says the engine holds no words. A machine behaves the same in every area,
so its words belong with its rules; an area that wants its own machine with its
own voice can still write an NPC, exactly as the nurse in the Centre still does.

**The tile identifiers `healer` and `computer` are permanent.** A map legend
names them. Renaming one turns every machine already placed into a plain wall.
See ADR 0002.

**A machine has no state of its own.** It cannot be locked, broken, or paid for,
because a tile carries no fields. The moment a machine needs any of that, it
needs an `objects` list on the map with a position and its own data, the way
signs work. Nothing about placing a machine as a tile blocks that change.
