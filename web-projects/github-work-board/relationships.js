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

import { reviewPeople } from "./people.js";

const EMPTY = Object.freeze({
  self: null,
  parent: null,
  blockedBy: [],
  blocking: [],
  closedBy: [],
  closes: [],
  subIssues: { total: 0, completed: 0, children: [] },
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

/**
 * What the checks on a pull request's last commit add up to.
 *
 * GitHub rolls every check on a commit into one verdict, and it hangs off the
 * commit rather than off the pull request, so the query asks for the last
 * commit to reach it. A pull request with no checks at all has no rollup, and
 * that reads as "" rather than as a pass (ADR 0011).
 */
function readChecksState(value) {
  const commit = isPlainObject(value) ? value.commits?.nodes?.[0]?.commit : null;
  const state = commit?.statusCheckRollup?.state;
  return typeof state === "string" ? state : "";
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
    // Whether the branch still merges cleanly, and how the checks on its last
    // commit ended. Both put a card in "Needs attention" (ADR 0011). GitHub
    // works `mergeable` out only when asked, so its first answer is often
    // UNKNOWN, which claims nothing.
    mergeable: typeof value.mergeable === "string" ? value.mergeable : "",
    checksState: readChecksState(value),
    // The branch this pull request adds, and the one it targets. A stack is
    // read from these and from nothing else (ADR 0016).
    headRefName: typeof value.headRefName === "string" ? value.headRefName : "",
    baseRefName: typeof value.baseRefName === "string" ? value.baseRefName : "",
    askedAgain: askedToLookAgain(value.latestOpinionatedReviews?.nodes, value.reviewRequests?.nodes),
    // Everybody in the review, and what each of them is doing about it. The
    // card draws them so the reader can see who is blocking it and who they
    // can chase (ADR 0028).
    reviewers: reviewPeople(value.reviewRequests, value.latestOpinionatedReviews),
  };
}

/**
 * One child issue, as a work item rather than as a link.
 *
 * A parent's card lists its children and says which column each one is in, and
 * that column is worked out by the rule every other card uses. The rule reads a
 * work item: it asks for `kind`, and for `closedAt` to tell finished work from
 * open work (ADR 0011, ADR 0017). A link, the shape `parent` and `blockedBy`
 * come in, carries neither, so a child is read into the shape the rule expects.
 *
 * Sub-issues are issues, so `kind` is never anything else.
 */
export function readChildIssue(value) {
  if (!isPlainObject(value)) return null;
  const id = typeof value.id === "string" && value.id !== "" ? value.id : null;
  if (!id) return null;
  return {
    key: id,
    kind: "issue",
    number: Number.isInteger(value.number) ? value.number : 0,
    title: typeof value.title === "string" ? value.title : "",
    url: typeof value.url === "string" ? value.url : "",
    repository: typeof value.repository?.nameWithOwner === "string" ? value.repository.nameWithOwner : "",
    state: value.state === "OPEN" ? "open" : "closed",
    closedAt: typeof value.closedAt === "string" ? value.closedAt : "",
    mergedAt: "",
    labels: [],
    assignees: [],
  };
}

function readChildren(connection) {
  const nodes = isPlainObject(connection) && Array.isArray(connection.nodes) ? connection.nodes : [];
  return nodes.map(readChildIssue).filter(Boolean);
}

/**
 * Every child in one graph answer, once each.
 *
 * The board asks GitHub again about these, in the same pass, so a child is read
 * exactly like any other card: the pull requests that would close it, and
 * whether the reviewer who asked for changes has been asked to look again. The
 * ids are not known until the first answer arrives, which is why it takes a
 * second batch and not a second query shape (ADR 0010).
 */
export function childIssueIds(nodes) {
  const ids = [];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!isPlainObject(node)) continue;
    for (const child of readChildren(node.subIssues)) {
      if (!ids.includes(child.key)) ids.push(child.key);
    }
  }
  return ids;
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
        // The summary counts every child; this holds the ones GitHub was asked
        // for, so a parent with more children than that still says how many.
        children: readChildren(node.subIssues),
      },
    };
  }
  return byId;
}

/** What is known about one item. An item nobody asked about reads as empty, never as missing. */
/**
 * Whether the board asked GitHub about this item at all.
 *
 * Not the same question as "what does it link to": an item nobody asked about
 * and an item with no links both read as empty. A child listed on its parent's
 * card is the case that needs the difference, because the board asks about at
 * most one batch of children and a failed second pass asks about none. Without
 * this, every child the board knows nothing about would read as work with no
 * pull request, which is a state, and a wrong one (ADR 0010).
 */
export function knowsAbout(byId, key) {
  return isPlainObject(byId) && Object.hasOwn(byId, key);
}

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
 * The pull request an item's column and its review are read from, or null when
 * there is none.
 *
 * For a pull request, itself. For an issue, the pull requests GitHub says would
 * close it: the merged one if there is one, and otherwise the open one. A pull
 * request that was closed without merging is abandoned work and counts for
 * nothing: reading it as progress would park the issue in a column it is not in
 * (ADR 0011).
 *
 * One rule, asked twice: `columns.js` asks it for the column, and the card asks
 * it for the people, because the people a card draws are the people in that
 * pull request's review (ADR 0028). Two rules would let the two disagree.
 */
export function pullRequestFor(item, relationship) {
  if (item?.kind === "pull-request") return item;
  const linked = Array.isArray(relationship?.closedBy) ? relationship.closedBy : [];
  return linked.find((one) => one.merged) ?? linked.find((one) => one.state === "open") ?? null;
}

/**
 * The items again, with what GitHub knows about a pull request's review put on
 * the item the board draws.
 *
 * The issues endpoint does not carry a review verdict, so a pull request on the
 * board would otherwise have no column of its own. The graph answer does carry
 * it, keyed by the same node id, so it is copied across once and every later
 * step reads one shape (ADR 0011).
 *
 * **An issue gets the review of the pull request that decides its column**, and
 * nothing else from it. On the board the question a face answers is "who am I
 * waiting for", and for an issue the answer is in that pull request, not in its
 * assignees. Putting the list on the item is what keeps the face, the filter
 * chips and the filter itself reading the same people (ADR 0028).
 */
export function applyPullRequestState(items, byId) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item?.kind !== "pull-request") {
      if (item?.kind !== "issue") return item;
      const pull = pullRequestFor(item, readRelationship(byId, item.key));
      return { ...item, reviewers: pull?.reviewers ?? [] };
    }
    const self = readRelationship(byId, item.key).self;
    if (!self) return item;
    return {
      ...item,
      merged: self.merged,
      reviewDecision: self.reviewDecision,
      mergeable: self.mergeable,
      checksState: self.checksState,
      reviewRequestCount: self.reviewRequestCount,
      headRefName: self.headRefName,
      baseRefName: self.baseRefName,
      askedAgain: self.askedAgain,
      reviewers: self.reviewers,
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
