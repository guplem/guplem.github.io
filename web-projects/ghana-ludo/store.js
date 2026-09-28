// What this device keeps (storage tier "This device", root ADR 0016).
//
//   ghana-ludo.name       the name the player typed, to fill the box next time
//   ghana-ludo.playerId   this browser's player id: a guest who reloads gets
//                         the same seat back, because the host knows the id
//   ghana-ludo.table      the host's table and its version, so a host who
//                         reloads mid-round can resume and re-invite
//
// Nothing here is worth syncing across devices, and the table goes stale
// in half a day.

import { readJson, removeKey, projectKey, writeJson } from "../cloud-storage/localStore.js";

const PROJECT = "ghana-ludo";
const TABLE_KEEP_MS = 12 * 3600 * 1000;
const key = (name) => projectKey(PROJECT, name);

export function loadName(storage) {
  const name = readJson(storage, key("name"), "");
  return typeof name === "string" ? name : "";
}

export function saveName(storage, name) {
  writeJson(storage, key("name"), String(name).slice(0, 24));
}

/**
 * This browser's player id, made once by `makeId` and kept.
 *
 * @param {Storage | null} storage
 * @param {() => string} makeId
 */
export function loadPlayerId(storage, makeId) {
  const known = readJson(storage, key("playerId"), null);
  if (typeof known === "string" && known) return known;
  const id = makeId();
  writeJson(storage, key("playerId"), id);
  return id;
}

/** Keeps the host's table. */
export function saveTable(storage, { room, state, version }, now = Date.now) {
  writeJson(storage, key("table"), { room, state, version, savedAt: now() });
}

/** The host's saved table, or null when there is none or it is stale. */
export function loadTable(storage, now = Date.now) {
  const saved = readJson(storage, key("table"), null);
  if (!saved || typeof saved.room !== "string" || now() - saved.savedAt > TABLE_KEEP_MS) return null;
  return saved;
}

export function clearTable(storage) {
  removeKey(storage, key("table"));
}
