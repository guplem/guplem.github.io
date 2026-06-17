// localStorage persistence for RPS Mind Reader, shared by the game page (app.js)
// and the statistics page (stats.js). The pure (de)serialization lives in game.js;
// this module only touches localStorage, wrapped so private-mode / quota / disabled
// storage degrades gracefully to an in-memory session. See ADR 0008.

import { serialize, deserialize, emptyState } from "./game.js";

export const STORAGE_KEY = "rps-mind-reader:state:v1";

export function loadState() {
  try {
    return deserialize(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state));
  } catch {
    // ignore quota / private-mode errors -- the game still works in-memory
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
