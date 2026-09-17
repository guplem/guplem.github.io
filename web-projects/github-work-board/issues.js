// Reading GitHub's answer about issues into the shape the board shows.
//
// `gateway.js` asks; this file decides what the answer means. It never throws:
// an entry it cannot read is dropped, so one odd issue cannot empty the board.
//
// The key is the issue's `node_id`, GitHub's own permanent identifier, and not
// "repository#number". An issue that moves to another repository keeps its node
// id and changes its number, so a note filed under the node id follows it and a
// note filed under the number would attach itself to a different issue. ADR
// 0002 holds that rule; `invariants.test.js` guards it.

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readLabel(value) {
  if (!isPlainObject(value) || typeof value.name !== "string") return null;
  return { name: value.name, color: typeof value.color === "string" ? value.color : "" };
}

/** One issue, or null when the answer does not describe one. */
export function normalizeIssue(raw) {
  if (!isPlainObject(raw)) return null;
  const key = typeof raw.node_id === "string" && raw.node_id !== "" ? raw.node_id : null;
  if (!key) return null;
  return {
    key,
    number: Number.isInteger(raw.number) ? raw.number : 0,
    title: typeof raw.title === "string" ? raw.title : "",
    repository: typeof raw.repository?.full_name === "string" ? raw.repository.full_name : "",
    url: typeof raw.html_url === "string" ? raw.html_url : "",
    state: raw.state === "closed" ? "closed" : "open",
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : "",
    labels: Array.isArray(raw.labels) ? raw.labels.map(readLabel).filter(Boolean) : [],
    isPullRequest: isPlainObject(raw.pull_request),
  };
}

/**
 * A list of issues out of whatever GitHub sent.
 *
 * `GET /issues` answers with pull requests mixed in, marked only by a
 * `pull_request` field. They are dropped here: a board that shows them turns
 * every open review into a card nobody asked for.
 */
export function normalizeIssues(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const items = [];
  for (const raw of rawList) {
    const item = normalizeIssue(raw);
    if (!item || item.isPullRequest || seen.has(item.key)) continue;
    seen.add(item.key);
    items.push(item);
  }
  return items;
}

/** The same issues, most recently touched first. The list handed in is not reordered. */
export function sortByRecentActivity(items) {
  const moment = (item) => {
    const parsed = Date.parse(item?.updatedAt ?? "");
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const left = moment(a);
    const right = moment(b);
    if (left === right) return 0;
    return right > left ? 1 : -1;
  });
}
