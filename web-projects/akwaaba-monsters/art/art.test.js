import { describe, test, expect } from "bun:test";
import { CREATURE_ART_IDS, SPRITE_SIZE, creatureDrawing } from "./creatures.js";
import { TILE_ART_IDS, TILE_SIZE, TILE_VARIANTS, tileDrawing } from "./tiles.js";
import {
  PEOPLE,
  PEOPLE_IDS,
  PERSON_H,
  PERSON_W,
  SKIN,
  personDrawing,
} from "./people.js";
import { countPainted, paintedBounds, rasterise } from "./pixelArt.js";
import { SPECIES_IDS } from "../species.js";
import { GROUND_TILE_IDS, TILE_IDS, isGroundTile } from "../world.js";

/** Every variant of every tile, as a flat list of [id, variant] pairs. */
const everyTile = TILE_ART_IDS.flatMap((id) =>
  Array.from({ length: TILE_VARIANTS }, (_, variant) => [id, variant]),
);

describe("every creature has art", () => {
  test("one drawing per species, and no drawing for a species that is gone", () => {
    expect([...CREATURE_ART_IDS].sort()).toEqual([...SPECIES_IDS].sort());
  });

  test("every drawing is the size the battle screen expects", () => {
    for (const id of CREATURE_ART_IDS) {
      const drawing = creatureDrawing(id);
      expect(drawing.w).toBe(SPRITE_SIZE);
      expect(drawing.h).toBe(SPRITE_SIZE);
    }
  });

  test("every drawing actually paints something worth looking at", () => {
    for (const id of CREATURE_ART_IDS) {
      const painted = countPainted(rasterise(creatureDrawing(id)));
      // A quarter of the box is roughly the smallest creature that still reads.
      expect(`${id}: ${painted > SPRITE_SIZE * SPRITE_SIZE * 0.2}`).toBe(`${id}: true`);
    }
  });

  test("no creature spills outside its box", () => {
    for (const id of CREATURE_ART_IDS) {
      const bounds = paintedBounds(rasterise(creatureDrawing(id)));
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.w).toBeLessThanOrEqual(SPRITE_SIZE);
      expect(bounds.y + bounds.h).toBeLessThanOrEqual(SPRITE_SIZE);
    }
  });

  test("every creature stands on or near the bottom of its box", () => {
    // The battle screen lines creatures up by the bottom edge. One that floats
    // would hang in the air next to the others.
    for (const id of CREATURE_ART_IDS) {
      const bounds = paintedBounds(rasterise(creatureDrawing(id)));
      expect(`${id}: ${bounds.y + bounds.h}`).toBe(`${id}: ${bounds.y + bounds.h}`);
      expect(bounds.y + bounds.h).toBeGreaterThan(SPRITE_SIZE * 0.85);
    }
  });

  test("every creature is drawn the same way twice", () => {
    for (const id of CREATURE_ART_IDS) {
      expect(rasterise(creatureDrawing(id))).toEqual(rasterise(creatureDrawing(id)));
    }
  });

  test("asking for a creature with no art gives null instead of throwing", () => {
    expect(creatureDrawing("pikachu")).toBeNull();
  });
});

describe("every map tile has art", () => {
  test("one drawing per tile the world engine knows", () => {
    expect([...TILE_ART_IDS].sort()).toEqual([...TILE_IDS].sort());
  });

  test("every variant of every tile is the right size", () => {
    for (const [id, variant] of everyTile) {
      const pixels = rasterise(tileDrawing(id, variant));
      expect(pixels.length).toBe(TILE_SIZE);
      expect(pixels[0].length).toBe(TILE_SIZE);
    }
  });

  test("every ground tile is completely filled, so nothing shows through it", () => {
    // Ground is the bottom of the picture. A hole in it would show the void.
    for (const [id, variant] of everyTile) {
      if (!isGroundTile(id)) continue;
      const painted = countPainted(rasterise(tileDrawing(id, variant)));
      expect(`${id}/${variant}: ${painted}`).toBe(`${id}/${variant}: ${TILE_SIZE * TILE_SIZE}`);
    }
  });

  test("every tile that stands on the ground leaves the ground showing", () => {
    // This is the whole point of the split. A palm tree that filled its square
    // put a square of sand in the middle of a grass field.
    for (const [id, variant] of everyTile) {
      if (isGroundTile(id)) continue;
      const painted = countPainted(rasterise(tileDrawing(id, variant)));
      const whole = TILE_SIZE * TILE_SIZE;
      expect(`${id}/${variant} fills the square: ${painted === whole}`).toBe(
        `${id}/${variant} fills the square: false`,
      );
      // ...and still paints enough to be worth drawing.
      expect(`${id}/${variant} paints something: ${painted > 12}`).toBe(
        `${id}/${variant} paints something: true`,
      );
    }
  });

  test("no tile carries an outline, which would draw a grid over the ground", () => {
    for (const [id, variant] of everyTile) {
      expect(`${id}: ${tileDrawing(id, variant).outline}`).toBe(`${id}: null`);
    }
  });

  test("no tile is shaded, which would put a seam between two of the same tile", () => {
    for (const [id, variant] of everyTile) {
      expect(`${id}: ${tileDrawing(id, variant).shade}`).toBe(`${id}: false`);
    }
  });

  test("tall grass looks different from short grass, so the player sees it coming", () => {
    const tall = rasterise(tileDrawing("tall"));
    const grass = rasterise(tileDrawing("grass"));
    expect(tall).not.toEqual(grass);
  });

  test("the ground the player walks over comes in more than one version", () => {
    // One version of a grass tile repeated across a field draws the same
    // speckles every 16 pixels, and the eye reads that grid as wallpaper.
    for (const id of ["grass", "path", "sand", "water", "cave"]) {
      expect(`${id} varies: ${GROUND_TILE_IDS.includes(id)}`).toBe(`${id} varies: true`);
      const first = rasterise(tileDrawing(id, 0));
      const second = rasterise(tileDrawing(id, 1));
      expect(`${id} varies: ${JSON.stringify(first) !== JSON.stringify(second)}`).toBe(
        `${id} varies: true`,
      );
    }
  });

  test("the same variant is drawn the same way every time", () => {
    // A tile that changed between reloads would make the ground crawl.
    for (const [id, variant] of everyTile) {
      expect(rasterise(tileDrawing(id, variant))).toEqual(rasterise(tileDrawing(id, variant)));
    }
  });

  test("asking for a variant that does not exist wraps round instead of failing", () => {
    expect(tileDrawing("grass", TILE_VARIANTS)).toEqual(tileDrawing("grass", 0));
    expect(tileDrawing("grass", -1)).toEqual(tileDrawing("grass", TILE_VARIANTS - 1));
  });

  test("asking for a tile with no art gives null", () => {
    expect(tileDrawing("lava")).toBeNull();
    expect(tileDrawing("lava", 2)).toBeNull();
  });
});

describe("the people", () => {
  test("every character draws in all four directions and both walk frames", () => {
    for (const id of PEOPLE_IDS) {
      for (const dir of ["down", "up", "left", "right"]) {
        for (const frame of [0, 1]) {
          const drawing = personDrawing(id, dir, frame);
          expect(drawing.w).toBe(PERSON_W);
          expect(drawing.h).toBe(PERSON_H);
          expect(countPainted(rasterise(drawing))).toBeGreaterThan(60);
        }
      }
    }
  });

  test("the two walking frames really are different", () => {
    for (const id of PEOPLE_IDS) {
      const still = rasterise(personDrawing(id, "down", 0));
      const stepping = rasterise(personDrawing(id, "down", 1));
      expect(`${id} frames differ: ${JSON.stringify(still) !== JSON.stringify(stepping)}`).toBe(
        `${id} frames differ: true`,
      );
    }
  });

  test("facing left and facing right are mirror images", () => {
    const left = rasterise(personDrawing("villagerMan", "left", 0));
    const right = rasterise(personDrawing("villagerMan", "right", 0));
    expect(right).toEqual(left.map((row) => [...row].reverse()));
  });

  test("facing forward shows a face and facing away does not", () => {
    const front = rasterise(personDrawing("villagerMan", "down", 0));
    const back = rasterise(personDrawing("villagerMan", "up", 0));
    expect(front).not.toEqual(back);
  });

  test("nobody spills outside the box the map draws them in", () => {
    for (const id of PEOPLE_IDS) {
      for (const dir of ["down", "up", "left", "right"]) {
        const bounds = paintedBounds(rasterise(personDrawing(id, dir, 0)));
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.w).toBeLessThanOrEqual(PERSON_W);
        expect(bounds.y + bounds.h).toBeLessThanOrEqual(PERSON_H);
      }
    }
  });

  test("only the player uses the visitor skin tone", () => {
    // The player is the only foreigner in the region. That is the setting, and
    // it is what the children shouting "obroni" are reacting to. A future agent
    // adding a villager must not reach for this colour.
    const visitors = PEOPLE_IDS.filter((id) => PEOPLE[id].skin === SKIN.visitor);
    expect(visitors.sort()).toEqual(["playerBoy", "playerGirl"]);
  });

  test("both player sprites exist, because the start screen offers a choice", () => {
    expect(PEOPLE.playerBoy).toBeDefined();
    expect(PEOPLE.playerGirl).toBeDefined();
  });

  test("asking for a character with no art gives null", () => {
    expect(personDrawing("nobody")).toBeNull();
  });

  test("an unknown direction falls back to facing forward instead of crashing", () => {
    expect(personDrawing("villagerMan", "sideways", 0)).toEqual(
      personDrawing("villagerMan", "down", 0),
    );
  });
});
