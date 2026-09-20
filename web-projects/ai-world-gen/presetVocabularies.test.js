import { describe, expect, test } from "bun:test";
import { PRESET_VOCABULARIES, presetVocabularyFor } from "./presetVocabularies.js";
import { SETTING_PRESETS, presetMatching } from "./presets.js";
import { visualTagNames } from "./tileset.js";
import { normaliseVocabulary } from "./vocabulary.js";

const tags = visualTagNames();

describe("the shipped vocabularies", () => {
  test("there is exactly one per setting preset, keyed by the preset id", () => {
    expect(Object.keys(PRESET_VOCABULARIES).sort()).toEqual(SETTING_PRESETS.map((one) => one.id).sort());
  });

  for (const preset of SETTING_PRESETS) {
    test(`${preset.id} passes the same validation a generated vocabulary must pass`, () => {
      const result = normaliseVocabulary(PRESET_VOCABULARIES[preset.id], tags);
      expect(result.errors ?? []).toEqual([]);
      expect(result.ok).toBe(true);
    });

    test(`${preset.id} declares a placement for every type and at least one structure with a door`, () => {
      const vocabulary = PRESET_VOCABULARIES[preset.id];
      for (const one of vocabulary.elements) expect(one.placement?.zone).toMatch(/^(indoor|outdoor|wall|any)$/);
      expect(vocabulary.structures.length).toBeGreaterThan(0);
      expect(vocabulary.structures.some((one) => one.door !== null)).toBe(true);
      for (const structure of vocabulary.structures) {
        expect(vocabulary.elements.find((one) => one.id === structure.wall)?.placement.zone).toBe("wall");
        expect(vocabulary.elements.find((one) => one.id === structure.floor)?.placement.zone).not.toBe("wall");
      }
    });

    test(`${preset.id} has a common walkable ground, a barrier, and something interactable with instance fields`, () => {
      const { elements } = PRESET_VOCABULARIES[preset.id];
      expect(elements.some((one) => one.walkable && !one.isBarrier && !one.interactable)).toBe(true);
      expect(elements.some((one) => one.isBarrier)).toBe(true);
      expect(elements.some((one) => one.interactable && one.instanceFields.length > 0)).toBe(true);
    });
  }
});

describe("presetVocabularyFor", () => {
  test("gives a deep copy, so editing the result does not change the shipped one", () => {
    const copy = presetVocabularyFor("medieval-village");
    copy.elements[0].label = "changed";
    expect(PRESET_VOCABULARIES["medieval-village"].elements[0].label).not.toBe("changed");
  });

  test("is null for an unknown preset", () => {
    expect(presetVocabularyFor("nope")).toBeNull();
  });
});

describe("presetMatching", () => {
  test("finds the preset whose three fields a setting equals, spaces aside", () => {
    const preset = SETTING_PRESETS[1];
    expect(presetMatching({ location: ` ${preset.location} `, era: preset.era, notes: preset.notes })?.id).toBe(preset.id);
  });

  test("is null when any field was edited", () => {
    const preset = SETTING_PRESETS[1];
    expect(presetMatching({ location: preset.location, era: preset.era, notes: `${preset.notes} and dragons` })).toBeNull();
    expect(presetMatching(null)).toBeNull();
  });
});
