// The one-time hand-over from the board's own data repository to cloud storage.
//
// Before the shared cloud storage existed (root ADR 0016), the board kept its
// own `dataRepo` and remembered which of its tokens could write the board
// file. That token and that repository are exactly what cloud storage wants,
// so a reader who set the board up before the change sets nothing up again:
// on the first visit after it, the writing token becomes the cloud token and
// the old key is cleared. The board's own token list is not touched; it still
// reads work with every token in it (ADR 0007).

import { readRepo, readToken, saveRepo, saveToken } from "../cloud-storage/cloudSettings.js";
import { LEGACY_KEYS, STORAGE_KEYS, readLegacyDataRepo } from "./settings.js";

/**
 * Hand the old repository and its writing token to cloud storage, once.
 * @returns whether anything was adopted
 */
export function adoptLegacyStorage(storage) {
  let repo = null;
  let entries = [];
  try {
    repo = readLegacyDataRepo(storage);
    if (!repo) return false;
    entries = JSON.parse(storage.getItem(STORAGE_KEYS.tokens) ?? "[]");
    storage.removeItem(LEGACY_KEYS.dataRepo);
  } catch {
    return false;
  }
  if (readToken(storage) || readRepo(storage)) return false;
  const writer = (Array.isArray(entries) ? entries : []).find((one) => one && one.canWriteBoard === true && typeof one.token === "string");
  if (!writer) return false;
  saveToken(storage, { token: writer.token, name: writer.name ?? "", login: repo.owner });
  saveRepo(storage, repo);
  return true;
}
