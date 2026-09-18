// What this browser remembers: the tokens, and which repository holds the board
// file. Nothing else, and nothing here is ever sent anywhere (root ADR 0007).
//
// **There is a list of tokens, not one token.** A fine-grained token belongs to
// exactly one resource owner: your personal account, or one organisation. A
// token owned by your account cannot see an organisation's repositories at all,
// whatever permissions it carries. So anybody whose work lives in an
// organisation needs at least two: one for the organisation's issues, and one
// for their own account, which is where the private notes repository lives.
// ADR 0007 tells the whole story.
//
// Every function takes the storage to use rather than reaching for
// `localStorage` itself. That is what makes this file testable without a
// browser, and it is also the honest shape: a browser in private mode throws on
// the first write, so every read and every write is wrapped and a refused write
// is simply forgotten.
//
// A token is a real credential, and keeping them here is a deliberate trade
// with a real cost. ADR 0001 states the threat model.

export const STORAGE_KEYS = {
  tokens: "github-work-board.tokens",
  dataRepo: "github-work-board.dataRepo",
  lastCounts: "github-work-board.lastCounts",
};

/** Where the one-token version kept things. Read once, then cleared. */
export const LEGACY_KEYS = {
  token: "github-work-board.token",
  grantedPermissions: "github-work-board.grantedPermissions",
};

/** What the setup guide suggests calling the private repository. */
export const DEFAULT_DATA_REPO_NAME = "work-board-data";

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

/** One stored token, or null when what is stored is not one. */
function readEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const token = typeof value.token === "string" ? value.token.trim() : "";
  if (id === "" || token === "") return null;
  return {
    id,
    token,
    grantedPermissions: typeof value.grantedPermissions === "string" ? value.grantedPermissions : null,
    name: typeof value.name === "string" ? value.name.trim() : "",
    owners: Array.isArray(value.owners) ? value.owners.filter((one) => typeof one === "string") : [],
    itemCount: Number.isFinite(value.itemCount) ? value.itemCount : 0,
    canWriteBoard: value.canWriteBoard === true,
  };
}

/**
 * Every saved token, oldest first.
 *
 * A token saved by the one-token version of this page is read as the first
 * entry, so nobody has to set the board up again. The caller saves the list
 * back, which is what clears the old keys.
 */
export function readTokens(storage) {
  const raw = readRaw(storage, STORAGE_KEYS.tokens);
  if (raw !== null) {
    let stored = null;
    try {
      stored = JSON.parse(raw);
    } catch {
      return [];
    }
    return Array.isArray(stored) ? stored.map(readEntry).filter(Boolean) : [];
  }

  const legacy = readRaw(storage, LEGACY_KEYS.token);
  const clean = typeof legacy === "string" ? legacy.trim() : "";
  if (clean === "") return [];
  return [
    {
      id: "legacy",
      token: clean,
      grantedPermissions: readRaw(storage, LEGACY_KEYS.grantedPermissions),
      name: "",
      owners: [],
      itemCount: 0,
      canWriteBoard: false,
    },
  ];
}

/** Save the list, and clear anything the one-token version left behind. */
export function saveTokens(storage, list) {
  const clean = (Array.isArray(list) ? list : []).map(readEntry).filter(Boolean);
  writeRaw(storage, STORAGE_KEYS.tokens, JSON.stringify(clean));
  removeRaw(storage, LEGACY_KEYS.token);
  removeRaw(storage, LEGACY_KEYS.grantedPermissions);
}

/** Throw every token away. The button that calls this promises nothing survives. */
export function forgetAllTokens(storage) {
  removeRaw(storage, STORAGE_KEYS.tokens);
  removeRaw(storage, LEGACY_KEYS.token);
  removeRaw(storage, LEGACY_KEYS.grantedPermissions);
  removeRaw(storage, STORAGE_KEYS.dataRepo);
  removeRaw(storage, STORAGE_KEYS.lastCounts);
}

/**
 * How many of each thing the board held last time.
 *
 * It is remembered for one reason: the placeholders drawn while the board waits
 * for GitHub are the right size, so the page barely moves when the real thing
 * arrives (ADR 0004). Nothing else reads it, and a wrong number costs nothing.
 */
export function readLastCounts(storage) {
  const raw = readRaw(storage, STORAGE_KEYS.lastCounts);
  if (raw === null) return {};
  let stored = null;
  try {
    stored = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const counts = {};
  for (const [name, value] of Object.entries(stored)) {
    if (Number.isFinite(value) && value >= 0) counts[name] = value;
  }
  return counts;
}

export function saveLastCounts(storage, counts) {
  if (!counts || typeof counts !== "object") return;
  writeRaw(storage, STORAGE_KEYS.lastCounts, JSON.stringify(counts));
}

/**
 * The list with one more token. The list handed in is not changed.
 *
 * The same token twice is refused: it would return the same items twice and
 * look like a syncing fault rather than a slip of the clipboard.
 */
export function addToken(list, entry) {
  const current = Array.isArray(list) ? list : [];
  const clean = readEntry({ ...entry, token: typeof entry?.token === "string" ? entry.token.trim() : "" });
  if (!clean) return current;
  if (current.some((one) => one.token === clean.token)) return current;
  return [...current, clean];
}

/** The list without one token. */
export function removeToken(list, id) {
  return (Array.isArray(list) ? list : []).filter((one) => one.id !== id);
}

/**
 * The list with one entry changed.
 *
 * The token itself and its id cannot be changed here: everything else about an
 * entry is something the board learned, and those two are what the reader gave.
 */
export function updateToken(list, id, changes) {
  return (Array.isArray(list) ? list : []).map((one) =>
    one.id === id ? (readEntry({ ...one, ...changes, id: one.id, token: one.token }) ?? one) : one,
  );
}

/**
 * The list with one token renamed.
 *
 * The name is the reader's, so it is the one thing the board never overwrites
 * when it reconnects. An empty name means "use the suggestion" (ADR 0007).
 */
export function renameToken(list, id, name) {
  const clean = typeof name === "string" ? name.trim() : "";
  return (Array.isArray(list) ? list : []).map((one) => (one.id === id ? { ...one, name: clean } : one));
}

/**
 * The token that reads and writes the notes file.
 *
 * The file lives in one repository, so exactly one token can reach it. Picking
 * another would fail every save with a permission error.
 */
export function boardWritingToken(list) {
  return (Array.isArray(list) ? list : []).find((one) => one.canWriteBoard) ?? null;
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
