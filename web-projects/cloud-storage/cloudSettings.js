// What this browser remembers about cloud storage: one token, one repository,
// and which documents it has already reconciled. Nothing here is ever sent
// anywhere but api.github.com (root ADR 0007, root ADR 0016).
//
// **One token, for every web-project on this site.** The projects share one
// origin, so they share one localStorage, and a person has one GitHub account.
// The token belongs to that account and the data repository lives in it.
// github-work-board keeps its own list of tokens for reading issues across
// organisations (its ADR 0007); that is a different job, and this file knows
// nothing about it.
//
// Every function takes the storage to use rather than reaching for
// `localStorage` itself. That is what makes this file testable without a
// browser, and it is also the honest shape: a browser in private mode throws on
// the first write, so every read and every write is wrapped and a refused write
// is simply forgotten.
//
// A token is a real credential, and keeping it here is a deliberate trade with
// a real cost. github-work-board ADR 0001 states the threat model, and root
// ADR 0016 widens it to every page that imports this module.

import { readJson, removeKey, writeJson } from "./localStore.js";

export const STORAGE_KEYS = {
  token: "triunity-studios.cloud.token",
  repo: "triunity-studios.cloud.repo",
  reconciled: "triunity-studios.cloud.reconciled",
};

/** The folder in the data repository that holds one sub-folder per web-project. */
export const DATA_FOLDER = "triunity-studios-data";

/** What the setup guide suggests calling the private repository. Same word as the folder. */
export const DEFAULT_REPO_NAME = "triunity-studios-data";

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

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** One stored token, or null when what is stored is not one. */
function cleanToken(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const token = trimmed(value.token);
  if (token === "") return null;
  return {
    token,
    name: trimmed(value.name),
    login: trimmed(value.login),
    grantedPermissions: typeof value.grantedPermissions === "string" ? value.grantedPermissions : null,
  };
}

/** The saved token with what the page learned about it, or null. */
export function readToken(storage) {
  return cleanToken(readJson(storage, STORAGE_KEYS.token, null));
}

/** Save the token. An empty one is not stored. */
export function saveToken(storage, entry) {
  const clean = cleanToken(entry);
  if (clean) writeJson(storage, STORAGE_KEYS.token, clean);
}

/**
 * Throw the token away, with the repository and every reconciled flag.
 *
 * A different token or repository means a different cloud copy, so every
 * earlier answer to "which copy do you want" is void. The mirrors stay: they
 * are the reader's data, and the button that calls this says so.
 */
export function forgetToken(storage) {
  removeKey(storage, STORAGE_KEYS.token);
  removeKey(storage, STORAGE_KEYS.repo);
  removeKey(storage, STORAGE_KEYS.reconciled);
}

/** One `{owner, repo}`, or null when what was handed in is not one. */
function cleanRepo(value) {
  const owner = trimmed(value?.owner);
  const repo = trimmed(value?.repo);
  return owner !== "" && repo !== "" ? { owner, repo } : null;
}

/** The chosen data repository, or null when none is chosen or what is stored is not one. */
export function readRepo(storage) {
  return cleanRepo(readJson(storage, STORAGE_KEYS.repo, null));
}

/**
 * Save the data repository. An incomplete one is not stored. A different one
 * clears every reconciled flag, for the reason `forgetToken` gives.
 */
export function saveRepo(storage, value) {
  const clean = cleanRepo(value);
  if (!clean) return;
  const before = readRepo(storage);
  if (before && (before.owner !== clean.owner || before.repo !== clean.repo)) removeKey(storage, STORAGE_KEYS.reconciled);
  writeJson(storage, STORAGE_KEYS.repo, clean);
}

/** Where one project's document lives in the repository. */
export function documentPath(project, file) {
  return `${DATA_FOLDER}/${project}/${file}`;
}

/** The localStorage key of one project's local mirror of a document. */
export function mirrorKey(project, file) {
  return `${DATA_FOLDER}.${project}.${file}`;
}

function readFlags(storage) {
  const flags = readJson(storage, STORAGE_KEYS.reconciled, {});
  return flags && typeof flags === "object" && !Array.isArray(flags) ? flags : {};
}

/** Whether this device has already answered "which copy" for one document. */
export function isReconciled(storage, project, file) {
  return typeof readFlags(storage)[`${project}/${file}`] === "string";
}

/** Remember that this device answered, and when. */
export function markReconciled(storage, project, file, now) {
  writeJson(storage, STORAGE_KEYS.reconciled, { ...readFlags(storage), [`${project}/${file}`]: String(now) });
}

/**
 * Every local mirror this browser holds, read by its key.
 *
 * The settings page has no list of projects: a project that adopts the standard
 * registers nowhere. So the page reads the storage keys that start with the
 * folder name, which is the one thing every mirror key shares.
 */
export function listMirrors(storage) {
  const found = [];
  try {
    const prefix = `${DATA_FOLDER}.`;
    for (let index = 0; index < (storage?.length ?? 0); index += 1) {
      const key = storage.key(index);
      if (typeof key !== "string" || !key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const dot = rest.indexOf(".");
      if (dot <= 0) continue;
      const document = readJson(storage, key, null);
      if (document) found.push({ project: rest.slice(0, dot), file: rest.slice(dot + 1), document });
    }
  } catch {
    return [];
  }
  return found;
}

/** GitHub's own form for a new private repository, with the name filled in. */
export function newRepoUrl(name) {
  return `https://github.com/new?name=${encodeURIComponent(name)}&visibility=private`;
}

/** The repository on GitHub. */
export function repoUrl({ owner, repo }) {
  return `https://github.com/${owner}/${repo}`;
}
