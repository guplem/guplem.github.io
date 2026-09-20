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

/**
 * Which repository an item is in.
 *
 * The issues endpoint answers with a whole repository object. The search
 * endpoint, which is what finds the reviews waiting on you, answers with an API
 * address instead, and nothing else (ADR 0013). Both have to read the same.
 */
function readRepository(raw) {
  if (typeof raw?.repository?.full_name === "string") return raw.repository.full_name;
  const url = typeof raw?.repository_url === "string" ? raw.repository_url : "";
  const after = url.split("/repos/")[1] ?? "";
  return after.split("/").slice(0, 2).join("/");
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
    repository: readRepository(raw),
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

/**
 * The items in `wanted` that are not already on the board.
 *
 * A pull request can be assigned to you and waiting for your review at once.
 * Showing it in both places would put the same work on screen twice, and the
 * board is the place that can move it, so the board keeps it.
 */
export function withoutItems(wanted, already) {
  const taken = new Set((Array.isArray(already) ? already : []).map((item) => item?.key));
  return (Array.isArray(wanted) ? wanted : []).filter((item) => !taken.has(item?.key));
}

/** How many of each kind the list holds, so the page can say what is on it. */
export function countByKind(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    issues: list.filter((item) => item?.kind === "issue").length,
    pullRequests: list.filter((item) => item?.kind === "pull-request").length,
  };
}

/**
 * The owners behind a list of `owner/name` repositories, each once.
 *
 * Where a token found work. It is only the board's suggestion for that token's
 * name, which the reader can then change: GitHub does not say which owner a
 * token is scoped to, and no call answers it honestly (ADR 0007).
 */
export function ownersOf(fullNames) {
  // Only a name shaped `owner/repository` names an owner. A bare word is a
  // broken answer, and reading it as an owner would put it on screen as one.
  const owners = (Array.isArray(fullNames) ? fullNames : [])
    .map((name) => (typeof name === "string" && name.includes("/") ? name.split("/")[0] : ""))
    .filter((owner) => owner !== "");
  return [...new Set(owners)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
