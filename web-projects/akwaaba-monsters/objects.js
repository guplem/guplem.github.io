// The machines that stand in the world: the healing machine and the storage
// computer.
//
// An object is a tile the player presses A on. It is not a person and it is not
// a sign. `world.js` says the tile is solid furniture, and this file says what
// happens when somebody faces it.
//
// A map author places one by writing its tile into the map, and nothing else.
// There is no list to keep in sync and no script to copy: the tile *is* the
// machine, so the same healing machine works in a hut in area 1 and in a
// hospital in area 7. That is the whole point of this file.
//
// Each object runs an ordinary script, the same kind an NPC runs (`events.js`),
// so a machine can say a line, ask a question, heal the party or open the box.
// The engine holds these scripts rather than an area file, because a machine
// behaves the same wherever it is put.

import { tileAt } from "./world.js";

/**
 * Every machine, by the tile identifier that draws it.
 *
 * The identifiers are permanent: a map legend names them, and a renamed tile
 * turns every machine already placed into a wall. See ADR 0002.
 */
export const OBJECTS = {
  healer: {
    name: "healing machine",
    script: [
      [
        "if",
        { partyEmpty: true },
        [
          ["say", "The healing machine hums to itself. You have no creatures for it yet."],
          ["end"],
        ],
      ],
      ["say", "A healing machine, with a tray of six hollows and a row of lamps above it."],
      [
        "ask",
        "Rest your creatures here?",
        [
          {
            label: "Yes please",
            then: [
              ["heal"],
              ["say", "The lamps run along the tray and go out. Every creature is on its feet."],
            ],
          },
          {
            label: "Not now",
            then: [["say", "The lamps dim, and the machine goes back to humming."]],
          },
        ],
      ],
    ],
  },

  computer: {
    name: "storage computer",
    script: [
      [
        "if",
        { partyEmpty: true },
        [
          ["say", "A storage computer. There is nothing to store until you have a creature."],
          ["end"],
        ],
      ],
      ["say", "A storage computer. The box opens on the screen."],
      ["box"],
      ["say", "The screen goes dark, and the fan winds down."],
    ],
  },
};

/** Every tile identifier that is a machine. */
export const OBJECT_TILE_IDS = Object.keys(OBJECTS);

/** True when the tile is a machine the player can use. */
export function isObjectTile(id) {
  return Object.prototype.hasOwnProperty.call(OBJECTS, id);
}

/**
 * The machine standing at a position, or null.
 *
 * @param {object} map the map the player is on
 * @returns {{id: string, name: string, script: Array}|null}
 */
export function objectAt(map, x, y) {
  const id = tileAt(map, x, y);
  if (id === null || !isObjectTile(id)) return null;
  return { id, ...OBJECTS[id] };
}

/**
 * Every machine standing on a map, in reading order.
 *
 * `areas.test.js` uses this to check the world: that each machine has a square
 * in front of it, and that an area gives the player somewhere to heal.
 *
 * @returns {{id: string, x: number, y: number}[]}
 */
export function objectPositions(map) {
  const found = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const id = tileAt(map, x, y);
      if (id !== null && isObjectTile(id)) found.push({ id, x, y });
    }
  }
  return found;
}
