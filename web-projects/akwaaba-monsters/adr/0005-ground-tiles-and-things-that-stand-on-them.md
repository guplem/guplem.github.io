# ADR 0005: A tile is either ground or a thing standing on it, and each screen declares its ground

## Context

Every map tile started as one opaque 16 by 16 picture that filled its own
square. That is right for grass, for sand and for a cave floor, because the
ground is the bottom of the picture and a hole in it would show the void.

It is wrong for everything that is not ground. A palm tree filled its square
with sand before it drew the trunk. Area 1 puts palm trees in a grass field, so
each palm left a square of sand around itself. A player reported it as the
palm trees having "a background fixed instead of being transparent", which is
exactly what it was.

The same fault ran through the whole tile set:

| Tile | Filled its square with | Sat on | What the player saw |
|---|---|---|---|
| `palm` | sand | grass | a sand square per palm |
| `tall` (tall grass) | a darker green | grass | a flat dark rectangle, not long grass |
| `ledge` | path colour | grass | a tan bar across a green field |
| `oreRock` | cave-wall colour | a cave floor | a dark square per boulder |
| `exit` | path colour | a cave floor | a bright square in a dark mine |
| `statue` | floor colour | the gym floor | a pale square under each statue |

Each one was fixable on its own by repainting its background to match one
particular map. That is what made the fault worth an architectural answer
instead of six touch-ups: repainting only moves the problem to the next map that
uses the tile on different ground.

## Decision

**Split the tile set in two, and make each map say what ground it is made of.**

- A **ground** tile is the surface itself. Its art fills the whole square, it
  carries no outline and no shading, and it tiles against a copy of itself with
  no seam. `grass`, `sand`, `cave`, `hut` and `water` are ground.
- A **thing standing on the ground** is everything else: a palm tree, a rock, a
  sign, a patch of tall grass, a bed. Its art has holes in it, and the ground
  shows through them.

`TILES` in `world.js` is the register. A tile with no `base` field is ground. A
tile with `base: MAP_GROUND` stands on whatever ground the screen is made of. A
tile may also name its own base instead: `door` names `hut`, because a doorway is
a hole in a wall and carries that wall with it wherever it is used.

Every map declares `base`, the ground the screen is made of: `grass` for the
routes and the towns, `cave` for the mine, `floor` inside a building,
`gymFloor` for the gym.

Two pure functions in `world.js` carry the decision:

- `tileStack(tileId, mapGround)` gives the one or two pictures to draw for a
  square, bottom first.
- `groundAt(map, x, y)` gives the ground at a position. It is the ground layer of
  the map where that layer holds ground, and the screen's own ground where the
  map wrote a thing straight into it. A sign written on the `over` layer above a
  path has to stand on that path, not on the grass the screen is mostly made of.

`render.js` draws the stack and remembers each flattened result, so a square is
still one copy per frame.

Two things follow from the split and are part of the same decision:

- **The ground comes in four versions.** One grass tile repeated across a field
  draws the same speckles every 16 pixels, and the eye reads that grid as
  wallpaper. `tileVariant(x, y, count)` in `ui.js` picks the version from the
  position, so it never changes under the player. `art/tiles.js` shifts its noise
  seeds by the version, and the gym floor puts its Adinkra mark on one version in
  four, which scatters the marks instead of tiling them.
- **Anything solid drops a strip of shade onto the square below it**
  (`castsShadow` in `world.js`). Without it a hut, now that it no longer carries
  a hard edge of its own, looks painted flat onto the grass. Water is solid but
  lies flat, so it casts nothing.

## Consequences

**Good**

- A palm tree, a rock and a patch of tall grass now look right on any ground,
  including ground no map uses yet.
- Tall grass is no longer a flat rectangle of a second colour. Its shade is a
  dither over the ground, so the edge of a patch breaks up, and its blades carry
  the read. It also works on sand.
- An area author gets the right result by default. Writing a palm tree into a
  desert map needs no new tile and no new art.
- The gain compounds. Each new thing added to `art/tiles.js` is drawn once and
  works everywhere, rather than once per ground it might sit on.

**Costs**

- A map without a `base` renders the void through every palm tree.
  `validateMap` refuses one, and `areas/areas.test.js` checks every map, so the
  mistake cannot reach a player.
- `art/tiles.js` has to agree with `world.js` about which tiles are ground.
  `art/art.test.js` checks both directions: every ground tile fills its square,
  and every other tile leaves some of the ground showing.
- A square can cost two copies instead of one. `render.js` flattens each pair
  once and remembers it, so the map still draws one picture per square.

**Left out on purpose**

- **No base more than one deep.** A base is always a ground tile, so a square is
  at most two pictures. `world.test.js` checks it. A chain invites a loop and
  buys nothing area 1 needs.
- **No shoreline tiles.** Water still meets sand along a straight line. Softening
  it needs corner tiles, which is content work rather than a change to this
  decision. See `ROADMAP.md`.
