// Reading GitHub's answer into the items the board shows.
//
// An item is an issue or a pull request. GitHub's issues endpoint returns both
// in one list and marks a pull request only with a `pull_request` field, so the
// board keeps both and says which is which. They belong together: both are
// assigned to you, both are work, and a board that hid your reviews would be
// answering a question nobody asked.
//
// `gateway.js` asks; this file decides what the answer means. It never throws:
// an entry it cannot read is dropped, so one odd item cannot empty the board.
//
// The key is the item's `node_id`, GitHub's own permanent identifier, and not
// "repository#number". An item that moves to another repository keeps its node
// id and changes its number, so a note filed under the node id follows it and a
// note filed under the number would attach itself to something else. ADR 0002
// holds that rule; `invariants.test.js` guards it.

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readLabel(value) {
  if (!isPlainObject(value) || typeof value.name !== "string") return null;
  return { name: value.name, color: typeof value.color === "string" ? value.color : "" };
}

/** One item, or null when the answer does not describe one. */
export function normalizeWorkItem(raw) {
  if (!isPlainObject(raw)) return null;
  const key = typeof raw.node_id === "string" && raw.node_id !== "" ? raw.node_id : null;
  if (!key) return null;
  const isPullRequest = isPlainObject(raw.pull_request);
  return {
    key,
    kind: isPullRequest ? "pull-request" : "issue",
    isDraft: isPullRequest && raw.draft === true,
    number: Number.isInteger(raw.number) ? raw.number : 0,
    title: typeof raw.title === "string" ? raw.title : "",
    repository: typeof raw.repository?.full_name === "string" ? raw.repository.full_name : "",
    url: typeof raw.html_url === "string" ? raw.html_url : "",
    state: raw.state === "closed" ? "closed" : "open",
    createdAt: typeof raw.created_at === "string" ? raw.created_at : "",
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : "",
    labels: Array.isArray(raw.labels) ? raw.labels.map(readLabel).filter(Boolean) : [],
  };
}

/** A list of items out of whatever GitHub sent, in the order it sent them. */
export function normalizeWorkItems(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const items = [];
  for (const raw of rawList) {
    const item = normalizeWorkItem(raw);
    if (!item || seen.has(item.key)) continue;
    seen.add(item.key);
    items.push(item);
  }
  return items;
}

/** How many of each kind the list holds, so the page can say what is on it. */
export function countByKind(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    issues: list.filter((item) => item?.kind === "issue").length,
    pullRequests: list.filter((item) => item?.kind === "pull-request").length,
  };
}

/** The full names of the repositories an answer lists. */
export function normalizeRepositories(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((one) => (isPlainObject(one) && typeof one.full_name === "string" ? one.full_name : ""))
    .filter((name) => name !== "");
}

/**
 * The owners behind a list of `owner/name` repositories, each once.
 *
 * This is how a token is named on screen. A fine-grained token reaches exactly
 * one owner, so this is normally one name, and it is the only name a reader can
 * match against their own list of tokens on GitHub (ADR 0007).
 */
export function ownersOf(fullNames) {
  // Only a name shaped `owner/repository` names an owner. A bare word is a
  // broken answer, and reading it as an owner would put it on screen as one.
  const owners = (Array.isArray(fullNames) ? fullNames : [])
    .map((name) => (typeof name === "string" && name.includes("/") ? name.split("/")[0] : ""))
    .filter((owner) => owner !== "");
  return [...new Set(owners)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
