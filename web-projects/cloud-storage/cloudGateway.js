// The only file in this module that touches the network.
//
// It asks GitHub and hands the answer over. It decides nothing: what an answer
// means lives in `envelope.js`, `merge.js` and `cloudMessages.js`, which are
// pure and tested. Keeping the boundary in one file is what lets every other
// module run under `bun test` with no browser and no network, and it is the
// only place the token is ever attached to a request. Lifted from
// github-work-board's `gateway.js`, storage calls only.
//
// Every call answers with the same shape, and never throws:
//   { ok: true, data }
//   { ok: false, status, message, need }
// `need` is the permission the call required, so the reader can be told which
// one to add. `status: 0` means the request never reached GitHub at all.

import { decodeBase64, encodeBase64 } from "./documentCodec.js";
import { PERMISSIONS } from "./cloudPermissions.js";

const API = "https://api.github.com";
const TIMEOUT_MS = 15000;

/**
 * Ask GitHub every time, and let GitHub answer "nothing changed".
 *
 * `no-cache` is not `no-store`. The browser keeps the copy and asks GitHub
 * whether it is still good, sending the `ETag` it already holds. A 304 costs
 * nothing against the rate limit (github-work-board ADR 0025).
 */
const CACHE_MODE = "no-cache";

async function call(token, path, { method = "GET", body = null, need = "" } = {}) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers,
      cache: CACHE_MODE,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
    });
  } catch {
    return { ok: false, status: 0, message: "The request never completed.", need };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : response.statusText;
    return { ok: false, status: response.status, message, need };
  }
  return { ok: true, data: payload };
}

/** Who the token belongs to. Also the cheapest proof that the token is valid at all. */
export function fetchViewer(token) {
  return call(token, "/user", { need: PERMISSIONS.metadata });
}

/** Whether the data repository exists and the token can see it. `data.private` says whether it is private. */
export function fetchRepository(token, { owner, repo }) {
  return call(token, `/repos/${owner}/${repo}`, { need: PERMISSIONS.metadata });
}

/** The path of one file or folder inside the repository, ready for the URL. */
function contentsPath({ owner, repo }, path) {
  return `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * What a folder holds. A folder that does not exist yet is not an error: the
 * first save creates it. `data.entries` is `{name, type, path, sha}` per entry.
 */
export async function fetchFolder(token, repository, path) {
  const result = await call(token, contentsPath(repository, path), { need: PERMISSIONS.contentsWrite });
  if (!result.ok) {
    if (result.status === 404) return { ok: true, data: { missing: true, entries: [] } };
    return result;
  }
  const entries = (Array.isArray(result.data) ? result.data : []).map((one) => ({
    name: String(one?.name ?? ""),
    type: String(one?.type ?? ""),
    path: String(one?.path ?? ""),
    sha: String(one?.sha ?? ""),
  }));
  return { ok: true, data: { missing: false, entries } };
}

/**
 * Read one file. A file that does not exist yet is not an error, so
 * `data.missing` says so and the caller creates it on the first save.
 */
export async function fetchFile(token, repository, path) {
  const result = await call(token, contentsPath(repository, path), { need: PERMISSIONS.contentsWrite });
  if (!result.ok) {
    if (result.status === 404) return { ok: true, data: { missing: true, text: null, sha: null } };
    return result;
  }
  const text = decodeBase64(result.data?.content ?? "");
  if (text === null) {
    return { ok: false, status: 422, message: `${path} in that repository is not readable text.`, need: PERMISSIONS.contentsWrite };
  }
  return { ok: true, data: { missing: false, text, sha: result.data?.sha ?? null } };
}

/**
 * Write one file.
 *
 * `sha` names the version being replaced. GitHub answers 409 when that is no
 * longer the current version, which is how two devices are kept from
 * overwriting each other. No `sha` creates the file.
 */
export function saveFile(token, repository, path, { text, sha, message }) {
  return call(token, contentsPath(repository, path), {
    method: "PUT",
    need: PERMISSIONS.contentsWrite,
    body: { message, content: encodeBase64(text), ...(sha ? { sha } : {}) },
  });
}
