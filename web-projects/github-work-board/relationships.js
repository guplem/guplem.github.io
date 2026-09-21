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
  self: null,
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

/**
 * Whether every reviewer who asked for changes has been asked to look again.
 *
 * GitHub never clears `reviewDecision`. A pull request that had changes
 * requested keeps that verdict for ever, even after the author does the work
 * and re-requests the review, and GitHub shows both at once: the red "Changes
 * requested" badge, and "Awaiting requested review from <name>". So the
 * verdict alone cannot say whose turn it is, and only this can.
 *
 * **Every** reviewer, not any one of them. Two reviewers asking for changes is
 * two people to satisfy; answering one and calling the work reviewed would
 * hide the other's changes.
 *
 * @param reviews `latestOpinionatedReviews.nodes`, one per reviewer
 * @param requests `reviewRequests.nodes`, who is being waited on right now
 */
export function askedToLookAgain(reviews, requests) {
  const waiting = new Set();
  for (const request of Array.isArray(requests) ? requests : []) {
    // A team has a name and no login, so it can never be the reviewer who
    // asked for changes, and it never satisfies this rule.
    const login = isPlainObject(request) ? request.requestedReviewer?.login : null;
    if (typeof login === "string" && login !== "") waiting.add(login);
  }

  const asked = [];
  for (const review of Array.isArray(reviews) ? reviews : []) {
    if (!isPlainObject(review) || review.state !== "CHANGES_REQUESTED") continue;
    const login = review.author?.login;
    // A review whose author is gone cannot be matched, so it is never answered.
    asked.push(typeof login === "string" && login !== "" ? login : "");
  }

  return asked.length > 0 && asked.every((login) => waiting.has(login));
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
    // Only a pull request carries these. They are what decides a column
    // (ADR 0011), and `reviewDecision` is GitHub's own verdict rather than
    // anything this board works out from a list of reviews.
    merged: value.merged === true,
    reviewDecision: typeof value.reviewDecision === "string" ? value.reviewDecision : "",
    reviewRequestCount: Number.isInteger(value.reviewRequests?.totalCount) ? value.reviewRequests.totalCount : 0,
    // The branch this pull request adds, and the one it targets. A stack is
    // read from these and from nothing else (ADR 0016).
    headRefName: typeof value.headRefName === "string" ? value.headRefName : "",
    baseRefName: typeof value.baseRefName === "string" ? value.baseRefName : "",
    askedAgain: askedToLookAgain(value.latestOpinionatedReviews?.nodes, value.reviewRequests?.nodes),
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
      self: readLink({ ...node, id }),
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
 * The items again, with what GitHub knows about a pull request's review put on
 * the pull request's own item.
 *
 * The issues endpoint does not carry a review verdict, so a pull request on the
 * board would otherwise have no column of its own. The graph answer does carry
 * it, keyed by the same node id, so it is copied across once and every later
 * step reads one shape (ADR 0011).
 */
export function applyPullRequestState(items, byId) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item?.kind !== "pull-request") return item;
    const self = readRelationship(byId, item.key).self;
    if (!self) return item;
    return {
      ...item,
      merged: self.merged,
      reviewDecision: self.reviewDecision,
      reviewRequestCount: self.reviewRequestCount,
      headRefName: self.headRefName,
      baseRefName: self.baseRefName,
      askedAgain: self.askedAgain,
    };
  });
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
