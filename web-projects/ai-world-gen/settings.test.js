import { describe, expect, test } from "bun:test";
import { DEFAULT_DECISION_MODEL, DEFAULT_NARRATIVE_MODEL } from "./models.js";
import {
  STORAGE_KEYS,
  forgetApiKey,
  readApiKey,
  readModelChoices,
  saveApiKey,
  saveModelChoices,
} from "./settings.js";

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
