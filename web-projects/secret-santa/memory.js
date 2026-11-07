// The memory of who you are, per draw, on this device.
//
// When a person confirms the warning, this device remembers their choice for
// that draw. If they open the same link again, the page goes straight to their
// own present. A small "I made a mistake" link on the present screen forgets
// the choice.
//
// The memory is keyed by the draw (names, exclusions and seed), not by the
// whole link. A title edit keeps the memory, and a new draw starts fresh. All
// draws share one storage key, `secret-santa.chosen`, and only the most recent
// MAX_REMEMBERED draws stay. The memory stays on this device (root ADR 0007).

import { readJson, writeJson, projectKey } from "../cloud-storage/localStore.js";
import { canonicalEvent, hashString } from "./draw.js";

export const STORAGE_KEY = projectKey("secret-santa", "chosen");
export const MAX_REMEMBERED = 50;

/** A short identifier for one draw. The title is not part of it. */
export function drawId({ names, forbidden, seed }) {
  return hashString(canonicalEvent(names, forbidden, seed)).toString(36);
}

function readAll(storage) {
  const saved = readJson(storage, STORAGE_KEY, {});
  return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
}

/** Remember that, on this device, the person at `giver` opened this draw. */
export function rememberGiver(storage, event, giver, now = Date.now()) {
  const all = { ...readAll(storage), [drawId(event)]: { g: giver, at: now } };
  const kept = Object.entries(all)
    .sort(([, a], [, b]) => (b?.at ?? 0) - (a?.at ?? 0))
    .slice(0, MAX_REMEMBERED);
  writeJson(storage, STORAGE_KEY, Object.fromEntries(kept));
}

/** The person this device chose for this draw, or null. */
export function recallGiver(storage, event) {
  const giver = readAll(storage)[drawId(event)]?.g;
  return Number.isInteger(giver) && giver >= 0 && giver < event.names.length ? giver : null;
}

/** Forget the choice for this draw only. */
export function forgetGiver(storage, event) {
  const all = readAll(storage);
  delete all[drawId(event)];
  writeJson(storage, STORAGE_KEY, all);
}
