import { describe, expect, test } from "bun:test";
import { DEFAULT_DECISION_MODEL, DEFAULT_NARRATIVE_MODEL } from "./models.js";
import {
  STORAGE_KEYS,
  forgetApiKey,
  readApiKey,
  readModelChoices,
  readStoredStyle,
  readStoredSpriteVariation,
  saveApiKey,
  saveModelChoices,
  saveStoredStyle,
  saveStoredSpriteVariation,
} from "./settings.js";
import { DEFAULT_STYLE_ID } from "./tileStyles.js";

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    map,
  };
}

const refusingStorage = {
  getItem: () => {
    throw new Error("refused");
  },
  setItem: () => {
    throw new Error("refused");
  },
  removeItem: () => {
    throw new Error("refused");
  },
};

describe("the api key", () => {
  test("is saved trimmed and read back", () => {
    const storage = fakeStorage();
    saveApiKey(storage, "  sk-or-v1-abc  ");
    expect(readApiKey(storage)).toBe("sk-or-v1-abc");
    expect(storage.map.get(STORAGE_KEYS.apiKey)).toBe("sk-or-v1-abc");
  });

  test("an empty key is not stored, and forgetting removes it", () => {
    const storage = fakeStorage();
    saveApiKey(storage, "   ");
    expect(readApiKey(storage)).toBe("");
    saveApiKey(storage, "sk-or-v1-abc");
    forgetApiKey(storage);
    expect(readApiKey(storage)).toBe("");
    expect(storage.map.has(STORAGE_KEYS.apiKey)).toBe(false);
  });

  test("a storage that refuses never throws", () => {
    expect(() => saveApiKey(refusingStorage, "x")).not.toThrow();
    expect(readApiKey(refusingStorage)).toBe("");
    expect(() => forgetApiKey(refusingStorage)).not.toThrow();
    expect(readApiKey(null)).toBe("");
  });
});

describe("the model choices", () => {
  test("default to Jev for decisions and Claude Sonnet for narrative", () => {
    expect(readModelChoices(fakeStorage())).toEqual({
      decisionModel: DEFAULT_DECISION_MODEL,
      narrativeModel: DEFAULT_NARRATIVE_MODEL,
    });
  });

  test("are saved and read back, with a missing half falling back", () => {
    const storage = fakeStorage();
    saveModelChoices(storage, { decisionModel: "openai/gpt-5-nano", narrativeModel: "" });
    expect(readModelChoices(storage)).toEqual({
      decisionModel: "openai/gpt-5-nano",
      narrativeModel: DEFAULT_NARRATIVE_MODEL,
    });
  });

  test("garbage in storage reads as the defaults", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEYS.models, "{not json");
    expect(readModelChoices(storage).decisionModel).toBe(DEFAULT_DECISION_MODEL);
    expect(readModelChoices(refusingStorage).narrativeModel).toBe(DEFAULT_NARRATIVE_MODEL);
  });
});

describe("the art style", () => {
  test("defaults to the sprite sheet and is read back once saved", () => {
    const storage = fakeStorage();
    expect(readStoredStyle(storage)).toBe(DEFAULT_STYLE_ID);
    saveStoredStyle(storage, "emoji");
    expect(readStoredStyle(storage)).toBe("emoji");
    expect(storage.map.get(STORAGE_KEYS.style)).toBe("emoji");
  });

  test("an unknown or refused value falls back to the default", () => {
    const storage = fakeStorage();
    saveStoredStyle(storage, "nope");
    expect(readStoredStyle(storage)).toBe(DEFAULT_STYLE_ID);
    expect(readStoredStyle(refusingStorage)).toBe(DEFAULT_STYLE_ID);
  });
});

describe("sprite variation", () => {
  test("is on by default, and off once switched off", () => {
    const storage = fakeStorage();
    expect(readStoredSpriteVariation(storage)).toBe(true);
    saveStoredSpriteVariation(storage, false);
    expect(readStoredSpriteVariation(storage)).toBe(false);
    saveStoredSpriteVariation(storage, true);
    expect(readStoredSpriteVariation(storage)).toBe(true);
  });

  test("garbage or a refused storage reads as on", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEYS.spriteVariation, "maybe");
    expect(readStoredSpriteVariation(storage)).toBe(true);
    expect(readStoredSpriteVariation(refusingStorage)).toBe(true);
  });
});
