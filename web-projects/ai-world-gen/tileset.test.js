import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  SHEET_COLUMNS,
  SHEET_ROWS,
  TILESET_FILE,
  TILE_OFFSET,
  TILE_PITCH,
  TILE_SIZE,
  UNKNOWN_TAG,
  VISUAL_TAGS,
  isVisualTag,
  tileFor,
  visualTagNames,
} from "./tileset.js";

/** Width and height read straight out of the PNG header. */
function pngSize(path) {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("the sheet geometry (Urizen 1-bit tileset, 12 px tiles on a 13 px pitch)", () => {
  test("the numbers are the ones the artist documents", () => {
    expect(TILE_SIZE).toBe(12);
    expect(TILE_PITCH).toBe(13);
    expect(TILE_OFFSET).toBe(1);
  });

  test("the sheet in this folder has the size the manifest assumes", () => {
    const size = pngSize(join(import.meta.dir, TILESET_FILE));
    expect(size.width).toBe(TILE_OFFSET + SHEET_COLUMNS * TILE_PITCH);
    expect(size.height).toBe(TILE_OFFSET + SHEET_ROWS * TILE_PITCH);
  });
});

describe("the manifest", () => {
  test("every tag has at least one tile inside the sheet", () => {
    for (const [tag, variants] of Object.entries(VISUAL_TAGS)) {
      expect(`${tag} has variants`).toBe(variants.length > 0 ? `${tag} has variants` : `${tag} is EMPTY`);
      for (const [column, row] of variants) {
        expect(column).toBeGreaterThanOrEqual(0);
        expect(column).toBeLessThan(SHEET_COLUMNS);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(SHEET_ROWS);
      }
    }
  });

  test("no tile sits on a separator column of the sheet", () => {
    const separators = [25, 51, 77, 103];
    for (const [tag, variants] of Object.entries(VISUAL_TAGS)) {
      for (const [column] of variants) {
        expect(`${tag} at column ${column}`).not.toBe(`${tag} at column ${separators.find((one) => one === column)}`);
      }
    }
  });

  test("tag names are kebab-case, so a model can copy them exactly", () => {
    for (const tag of visualTagNames()) expect(tag).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  test("carries the unknown tag, which is what a bad tag falls back to", () => {
    expect(isVisualTag(UNKNOWN_TAG)).toBe(true);
    expect(isVisualTag("grass")).toBe(true);
    expect(isVisualTag("Grass")).toBe(false);
    expect(isVisualTag("nope")).toBe(false);
  });

  test("covers the ground, structure, object and being categories every setting needs", () => {
    for (const tag of ["floor", "grass", "water", "wall", "door", "chest", "person", "monster", "metal-floor", "road"]) {
      expect(isVisualTag(tag)).toBe(true);
    }
  });
});

describe("tileFor", () => {
  test("returns sheet pixel coordinates for a tag", () => {
    const tile = tileFor("unknown", 0);
    const [column, row] = VISUAL_TAGS.unknown[0];
    expect(tile).toEqual({ sx: TILE_OFFSET + column * TILE_PITCH, sy: TILE_OFFSET + row * TILE_PITCH });
  });

  test("picks a variant from the seed and is stable for one seed", () => {
    const tag = Object.entries(VISUAL_TAGS).find(([, variants]) => variants.length > 1)[0];
    expect(tileFor(tag, 5)).toEqual(tileFor(tag, 5));
    const seen = new Set();
    for (let seed = 0; seed < 50; seed += 1) seen.add(JSON.stringify(tileFor(tag, seed)));
    expect(seen.size).toBeGreaterThan(1);
  });

  test("falls back to the unknown tile for a tag it does not know", () => {
    expect(tileFor("nope", 0)).toEqual(tileFor(UNKNOWN_TAG, 0));
  });
});
