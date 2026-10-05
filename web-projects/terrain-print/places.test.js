// The place lists are data a person reads and jumps to; these checks keep
// them inside the conventions the map and the projection expect.
import { describe, expect, test } from "bun:test";
import { BODY_IDS } from "./bodies.js";
import { EARTH_SEA_PRESETS, MARS_SHORELINES, PLACES } from "./places.js";

const KINDS = ["landing", "crater", "mountain", "basin", "canyon", "sea", "volcano", "region"];

describe("places", () => {
  test("every world has a list", () => {
    for (const id of BODY_IDS) expect(PLACES[id].length).toBeGreaterThan(10);
  });
  test("ids are unique within a world, and every entry is complete", () => {
    for (const id of BODY_IDS) {
      const list = PLACES[id];
      expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
      for (const p of list) {
        expect(KINDS).toContain(p.kind);
        expect(p.lat).toBeGreaterThanOrEqual(-90);
        expect(p.lat).toBeLessThanOrEqual(90);
        // East longitudes in -180..180: the map and the projection expect it.
        expect(p.lon).toBeGreaterThanOrEqual(-180);
        expect(p.lon).toBeLessThan(180);
        expect(p.size).toBeGreaterThan(0);
        expect(p.name.length).toBeGreaterThan(2);
        expect(p.note.split(/\s+/).length).toBeLessThanOrEqual(15);
      }
    }
  });
  test("the sea presets sit inside the sea slider ranges", () => {
    for (const p of MARS_SHORELINES) expect(p.elevation).toBeLessThan(0);
    expect(EARTH_SEA_PRESETS.map((p) => p.elevation)).toEqual([0, -125, 70]);
  });
});
