// What GitHub itself says one piece of work has to do with another.
//
// These are the real links, the ones GitHub's own "Relationships" panel shows,
// not anything read out of a description:
//
//   - **Parent issue**, from the sub-issues feature.
//   - **Blocked by**, from issue dependencies.
//   - **Development**, the pull requests that would close an issue, and from the
//     other side the issues a pull request closes.
//
// All of it arrives in one GraphQL call per token, keyed by the same node ids
// the board already holds for every item, so nothing has to be looked up twice
// and no relationship needs a call of its own. See ADR 0010.
//
// This module reads that answer and never throws: one unreadable node must not
// cost the relationships of every other item.

const EMPTY = Object.freeze({
  parent: null,
  blockedBy: [],
  blocking: [],
  closedBy: [],
  closes: [],
  subIssues: { total: 0, completed: 0 },
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** One linked item, or null when the answer does not describe one. */
function readLink(value) {
  if (!isPlainObject(value)) return null;
  const id = typeof value.id === "string" && value.id !== "" ? value.id : null;
  if (!id) return null;
  return {
    id,
    number: Number.isInteger(value.number) ? value.number : 0,
    title: typeof value.title === "string" ? value.title : "",
    url: typeof value.url === "string" ? value.url : "",
    // GitHub answers OPEN, CLOSED or MERGED. The board only ever asks whether
    // something is still open, so everything else settles to "closed".
    state: value.state === "OPEN" ? "open" : "closed",
    repository: typeof value.repository?.nameWithOwner === "string" ? value.repository.nameWithOwner : "",
  };
}

function readLinks(connection) {
  const nodes = isPlainObject(connection) && Array.isArray(connection.nodes) ? connection.nodes : [];
  return nodes.map(readLink).filter(Boolean);
}

/** The GraphQL answer as one lookup, keyed by node id. */
export function normalizeRelationships(nodes) {
  const byId = {};
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!isPlainObject(node)) continue;
    const id = typeof node.id === "string" && node.id !== "" ? node.id : null;
    if (!id) continue;
    byId[id] = {
      parent: readLink(node.parent),
      blockedBy: readLinks(node.blockedBy),
      blocking: readLinks(node.blocking),
      closedBy: readLinks(node.closedByPullRequestsReferences),
      closes: readLinks(node.closingIssuesReferences),
      subIssues: {
        total: Number.isInteger(node.subIssuesSummary?.total) ? node.subIssuesSummary.total : 0,
        completed: Number.isInteger(node.subIssuesSummary?.completed) ? node.subIssuesSummary.completed : 0,
      },
    };
  }
  return byId;
}

/** What is known about one item. An item nobody asked about reads as empty, never as missing. */
export function readRelationship(byId, key) {
  return (isPlainObject(byId) ? byId[key] : null) ?? EMPTY;
}

/**
 * The blockers that still block.
 *
 * A closed blocker is history. Counting it would leave half the board marked
 * blocked for ever, and the word would stop meaning anything.
 */
export function openBlockers(relationship) {
  const blockers = Array.isArray(relationship?.blockedBy) ? relationship.blockedBy : [];
  return blockers.filter((one) => one.state === "open");
}

export function isBlocked(relationship) {
  return openBlockers(relationship).length > 0;
}

/**
 * The list with each pull request tucked under the issue it closes.
 *
 * A pull request and the issue it closes are one piece of work, and two cards
 * for it is the board asking you to do the same thing twice. A pull request
 * whose issue is not on the board keeps its own place, because hiding it would
 * lose it.
 *
 * @returns {{item: object, children: object[]}[]} top level in the order given
 */
export function groupByLinkedIssue(items, byId) {
  const list = Array.isArray(items) ? items : [];
  const present = new Set(list.map((item) => item?.key));
  const childrenOf = new Map();
  const nested = new Set();

  for (const item of list) {
    if (item?.kind !== "pull-request") continue;
    const home = readRelationship(byId, item.key).closes.find((one) => present.has(one.id));
    if (!home) continue;
    if (!childrenOf.has(home.id)) childrenOf.set(home.id, []);
    childrenOf.get(home.id).push(item);
    nested.add(item.key);
  }

  return list
    .filter((item) => !nested.has(item?.key))
    .map((item) => ({ item, children: childrenOf.get(item?.key) ?? [] }));
}
