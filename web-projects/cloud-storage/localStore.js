// Reading and writing JSON in a browser's storage without ever throwing.
//
// A browser with storage switched off, a full disk, or a private window all
// throw on the first call. The project must keep working; it only forgets
// (root ADR 0007). Four web-projects carried their own copy of these lines
// before this module existed, which is what the promotion rule in
// `web-projects/AGENTS.md` is for.
//
// Every function takes the storage as an argument, so it is testable without a
// browser and so that this file never names the browser storage object itself:
// `cloudSettings.browserStorage()` is the one place that does.

/**
 * Read and parse a key, or give back the fallback.
 * @param storage the browser storage object, or null
 */
export function readJson(storage, key, fallback) {
  try {
    const raw = storage?.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const value = JSON.parse(raw);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

/**
 * Write a value under a key.
 * @returns whether it was stored
 */
export function writeJson(storage, key, value) {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Forget one key. */
export function removeKey(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing to report and nothing to do.
  }
}

/** The key a project uses for a value that stays on this device: `<slug>.<name>`. */
export function projectKey(project, name) {
  return `${project}.${name}`;
}
