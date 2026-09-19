// What this browser remembers: the OpenRouter key, which model does which
// job, and the chosen art style. Nothing else, and nothing here is ever sent
// anywhere but OpenRouter (root ADR 0007, ADR 0001).
//
// Every function takes the storage to use rather than reaching for
// `localStorage` itself. That is what makes this file testable without a
// browser, and it is also the honest shape: a browser in private mode throws
// on the first write, so every read and every write is wrapped and a refused
// write is simply forgotten.
//
// The key is a real credential with a card behind it. ADR 0001 states the
// threat model and why it is stored at all.

import { DEFAULT_DECISION_MODEL, DEFAULT_NARRATIVE_MODEL } from "./models.js";
import { readStyleId } from "./tileStyles.js";

export const STORAGE_KEYS = {
  apiKey: "ai-world-gen.apiKey",
  models: "ai-world-gen.models",
  style: "ai-world-gen.style",
};

function readRaw(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeRaw(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // A browser that refuses to store is not a problem the reader can act on.
  }
}

function removeRaw(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // Same as above: nothing to report and nothing to do.
  }
}

/**
 * The storage a browser gives this page.
 *
 * It lives here so that no other file has to name `localStorage`, which keeps
 * every other module testable and keeps one file in charge of what is stored.
 */
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The saved key, or an empty string. */
export function readApiKey(storage) {
  const raw = readRaw(storage, STORAGE_KEYS.apiKey);
  return typeof raw === "string" ? raw.trim() : "";
}

/** Save the key. A blank key is not stored. */
export function saveApiKey(storage, key) {
  const clean = typeof key === "string" ? key.trim() : "";
  if (clean === "") return;
  writeRaw(storage, STORAGE_KEYS.apiKey, clean);
}

/** Throw the key away. The button that calls this promises nothing survives. */
export function forgetApiKey(storage) {
  removeRaw(storage, STORAGE_KEYS.apiKey);
}

function cleanModelId(value, fallback) {
  const clean = typeof value === "string" ? value.trim() : "";
  return clean === "" ? fallback : clean;
}

/** Which model decides cells and which one writes the vocabulary. */
export function readModelChoices(storage) {
  const raw = readRaw(storage, STORAGE_KEYS.models);
  let stored = null;
  if (raw !== null) {
    try {
      stored = JSON.parse(raw);
    } catch {
      stored = null;
    }
  }
  return {
    decisionModel: cleanModelId(stored?.decisionModel, DEFAULT_DECISION_MODEL),
    narrativeModel: cleanModelId(stored?.narrativeModel, DEFAULT_NARRATIVE_MODEL),
  };
}

/** The art style the map is drawn in. A preference, so it is private and stays here. */
export function readStoredStyle(storage) {
  return readStyleId(readRaw(storage, STORAGE_KEYS.style));
}

export function saveStoredStyle(storage, styleId) {
  writeRaw(storage, STORAGE_KEYS.style, readStyleId(styleId));
}

export function saveModelChoices(storage, choices) {
  writeRaw(
    storage,
    STORAGE_KEYS.models,
    JSON.stringify({
      decisionModel: cleanModelId(choices?.decisionModel, DEFAULT_DECISION_MODEL),
      narrativeModel: cleanModelId(choices?.narrativeModel, DEFAULT_NARRATIVE_MODEL),
    }),
  );
}
