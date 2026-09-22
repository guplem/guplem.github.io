// The save as the shared cloud storage carries it (root ADR 0016).
//
// The game keeps one save, and losing hours of it hurts, so this is the one
// project on the playground whose data follows the player between devices.
// The shared standard stores record maps; a save is one blob, so it travels
// as one record, `saves.main`, with the whole save under its `save` field.
// That buys it the standard's merge, question dialog and settings panel for
// nothing.
//
// One blob means one rule between devices: the copy written later wins, and
// `savedAt`, which the game stamps on every save, is the clock. `newerSave`
// says which copy that is. A battle is never saved, and an open game keeps
// playing on its own copy: the cloud copy is applied at the title screen only.

import { defineDocument } from "../cloud-storage/envelope.js";
import { parseSave } from "./save.js";

/** The file in the cloud storage folder for this project. */
export const SAVE_FILE = "save.json";

/** The one record map, and the one record in it. */
export const RECORD_MAPS = ["saves"];
export const SAVE_RECORD = "main";

const shape = defineDocument(RECORD_MAPS);

/** The same document with the save written into it. The document handed in is not changed. */
export function documentWithSave(document, state, now) {
  return shape.write(document, RECORD_MAPS[0], SAVE_RECORD, { save: state }, now);
}

/**
 * The save a document holds, checked the way a loaded file is checked, or
 * null when there is none or it is not this game's.
 */
export function saveInDocument(document) {
  const record = shape.read(document, RECORD_MAPS[0], SAVE_RECORD);
  if (!record || typeof record.save !== "object" || record.save === null) return null;
  const result = parseSave(JSON.stringify(record.save));
  return result.ok ? result.state : null;
}

/** The save written later. A tie keeps the local one; a save with no time counts as the oldest. */
export function newerSave(local, cloud) {
  if (!local) return cloud ?? null;
  if (!cloud) return local;
  const at = (state) => (typeof state.savedAt === "string" ? state.savedAt : "");
  return at(cloud) > at(local) ? cloud : local;
}
