// What this browser remembers: the token, and which repository holds the board
// file. Nothing else, and nothing here is ever sent anywhere (root ADR 0007).
//
// Every function takes the storage to use rather than reaching for
// `localStorage` itself. That is what makes this file testable without a
// browser, and it is also the honest shape: a browser in private mode throws on
// the first write, so every read and every write is wrapped and a refused write
// is simply forgotten.
//
// The token is a real credential, and keeping it here is a deliberate trade
// with a real cost. ADR 0001 states the threat model and why the alternative
// (retyping it every visit) was rejected.

export const STORAGE_KEYS = {
  token: "github-work-board.token",
  dataRepo: "github-work-board.dataRepo",
};

/** What the setup guide suggests calling the private repository. */
export const DEFAULT_DATA_REPO_NAME = "work-board-data";

/**
 * The storage a browser gives this page.
 *
 * It lives here so that no other file has to name `localStorage`, which keeps
 * every other module testable and keeps one file in charge of what is stored.
 * A browser with storage switched off answers null, and every function below
 * already treats null as "nothing saved".
 */
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

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

/** The saved token, or null. */
export function readToken(storage) {
  const stored = readRaw(storage, STORAGE_KEYS.token);
  const clean = typeof stored === "string" ? stored.trim() : "";
  return clean === "" ? null : clean;
}

/** Save the token. A pasted token carries spaces and newlines, so it is trimmed first. */
export function saveToken(storage, token) {
  const clean = typeof token === "string" ? token.trim() : "";
  if (clean === "") return;
  writeRaw(storage, STORAGE_KEYS.token, clean);
}

/** Forget the token. The button that calls this promises nothing survives. */
export function forgetToken(storage) {
  removeRaw(storage, STORAGE_KEYS.token);
}

/** The chosen data repository, or null when none is chosen or what is stored is not one. */
export function readDataRepo(storage) {
  const raw = readRaw(storage, STORAGE_KEYS.dataRepo);
  if (raw === null) return null;
  let stored = null;
  try {
    stored = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!stored || typeof stored !== "object") return null;
  const owner = typeof stored.owner === "string" ? stored.owner.trim() : "";
  const repo = typeof stored.repo === "string" ? stored.repo.trim() : "";
  return owner !== "" && repo !== "" ? { owner, repo } : null;
}

/** Save the data repository. An incomplete one is not stored. */
export function saveDataRepo(storage, value) {
  const owner = typeof value?.owner === "string" ? value.owner.trim() : "";
  const repo = typeof value?.repo === "string" ? value.repo.trim() : "";
  if (owner === "" || repo === "") return;
  writeRaw(storage, STORAGE_KEYS.dataRepo, JSON.stringify({ owner, repo }));
}
