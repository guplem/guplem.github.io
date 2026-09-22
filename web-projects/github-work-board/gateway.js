// The only file in this project that touches the network.
//
// It asks GitHub and hands the answer over. It decides nothing: what an answer
// means lives in `workItems.js`, `relationships.js` and `githubErrors.js`, which
// are pure and tested. The board file is not read or written here: the shared
// cloud storage does that with its own gateway (root ADR 0016). Keeping the boundary in one file is what lets every
// other module run under `bun test` with no browser and no network, and it is
// the only place the token is ever attached to a request.
//
// Every call answers with the same shape, and never throws:
//   { ok: true, data }
//   { ok: false, status, message, need }
// `need` is the permission the call required, so the reader can be told which
// one to add. `status: 0` means the request never reached GitHub at all.

import { PERMISSIONS } from "./permissions.js";
import { childIssueIds } from "./relationships.js";

const API = "https://api.github.com";
const TIMEOUT_MS = 15000;

/**
 * Ask GitHub every time, and let GitHub answer "nothing changed".
 *
 * GitHub answers an authenticated REST call with `Cache-Control: private,
 * max-age=60`. Left alone, the browser serves its own copy for that whole
 * minute, so a board set to refresh every 30 seconds would show the same answer
 * twice and look broken (ADR 0025).
 *
 * `no-cache` is not `no-store`. The browser keeps the copy and asks GitHub
 * whether it is still good, sending the `ETag` it already holds. GitHub answers
 * `304 Not Modified` when nothing changed, the browser hands over the copy it
 * had, and **a 304 costs nothing against the rate limit**. So this makes the
 * board more correct and cheaper at the same time.
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


/**
 * Every open issue assigned to the token's owner, across every repository the
 * token can read. Pull requests come back in this answer too; `issues.js`
 * drops them.
 */
export function fetchAssignedIssues(token) {
  return call(token, "/issues?filter=assigned&state=open&sort=updated&per_page=100", {
    need: PERMISSIONS.issuesRead,
  });
}

/**
 * The work assigned to this token's owner that has already closed.
 *
 * The board otherwise asks only for open work, so a merged pull request never
 * reached it and "Done" was a column that could not fill (ADR 0017).
 *
 * `since` filters on when a thing was last touched, not on when it closed, so
 * this answer also holds work closed months ago that somebody commented on
 * this morning. `workItems.finishedSince` is what narrows it to the truth.
 */
export function fetchFinishedWork(token, since) {
  const from = encodeURIComponent(typeof since === "string" ? since : "");
  return call(token, `/issues?filter=assigned&state=closed&since=${from}&sort=updated&per_page=100`, {
    need: PERMISSIONS.issuesRead,
  });
}

/**
 * Everything GitHub itself links to an item: its parent issue, what blocks it,
 * and the pull requests that would close it.
 *
 * One call for a whole batch, keyed by the node ids the board already holds, so
 * no relationship costs a call of its own. GraphQL takes at most 100 ids at a
 * time, and the caller sends one batch per token: a node id from one owner is
 * not readable by another owner's token (ADR 0010).
 *
 * `includeClosedPrs` must stay true. A merged pull request is a closed one, so
 * leaving it out would hide exactly the work that belongs in "Done today".
 *
 * The two branch names are asked for because a stacked pull request is one
 * whose `baseRefName` is another's `headRefName`. That is the only honest way
 * to read a stack: a "depends on #4979" in a description is a guess (ADR 0016).
 *
 * The reviews are asked for because GitHub never clears `reviewDecision`. Only
 * the reviewers waited on right now, set beside the reviewers who asked for
 * changes, say whose turn it is (ADR 0011). `latestOpinionatedReviews` answers
 * one review per reviewer and leaves out plain comments, which carry no
 * verdict.
 *
 * `name` and `avatarUrl` are asked for on both the requested reviewer and the
 * review's author so a card can draw a face for each of them (ADR 0028).
 *
 * `mergeable` and the last commit's `statusCheckRollup` are asked for because
 * a branch that conflicts and a check that went red both want the author, so
 * both belong in "Needs attention" beside changes requested (ADR 0011). The
 * rollup hangs off the commit, not off the pull request, which is why one
 * commit comes back with each of them. GitHub works `mergeable` out only when
 * somebody asks, so the first answer for a quiet pull request is `UNKNOWN` and
 * the next refresh answers properly.
 *
 * `subIssues` names the children, and `closedAt` with `state` is what says
 * whether a child is finished. Twenty of them, because the list itself is free:
 * it adds no nested connection, so 10 and 50 both cost the same 13 points. What
 * it does spend is room in the second pass below, which is one batch of 100
 * ids, so twenty is five parents' worth of children before anybody loses a
 * state. Nothing else about a child is asked for here:
 * the second pass below asks about the children themselves, with this same
 * query, so a child is read exactly like any other card.
 *
 * **Five pull requests that would close an issue, not twenty.** GraphQL is
 * charged by how much a query could return, and that one number decided most
 * of the bill: a full batch of 100 items cost 42 points at twenty and costs 12
 * at five, measured with `rateLimit(dryRun: true)`. Nothing reads past the
 * merged one or the first open one (`columns.pullRequestState`), and the room
 * that made is what pays for the second pass below (ADR 0025).
 */
const RELATIONSHIPS_QUERY = `query($ids: [ID!]!) {
  nodes(ids: $ids) {
    __typename
    ... on Issue {
      id
      parent { id number title url repository { nameWithOwner } }
      blockedBy(first: 20) { nodes { id number title state url } }
      subIssuesSummary { total completed }
      subIssues(first: 20) {
        nodes { id number title url state closedAt repository { nameWithOwner } }
      }
      closedByPullRequestsReferences(first: 5, includeClosedPrs: true) {
        nodes {
          id number title state url merged reviewDecision mergeable headRefName baseRefName
          repository { nameWithOwner }
          commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
          reviewRequests(first: 20) { totalCount nodes { requestedReviewer { ... on User { login name avatarUrl } } } }
          latestOpinionatedReviews(first: 20) { nodes { state author { login avatarUrl ... on User { name } } } }
        }
      }
    }
    ... on PullRequest {
      id
      number
      title
      url
      state
      merged
      reviewDecision
      mergeable
      headRefName
      baseRefName
      repository { nameWithOwner }
      commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
      reviewRequests(first: 20) { totalCount nodes { requestedReviewer { ... on User { login name avatarUrl } } } }
      latestOpinionatedReviews(first: 20) { nodes { state author { login avatarUrl ... on User { name } } } }
      closingIssuesReferences(first: 20) { nodes { id number title state url } }
    }
  }
}`;

/** How many ids GraphQL accepts in one `nodes` call. */
export const RELATIONSHIP_BATCH = 100;

async function askAbout(token, ids) {
  const found = [];
  for (let start = 0; start < ids.length; start += RELATIONSHIP_BATCH) {
    const batch = ids.slice(start, start + RELATIONSHIP_BATCH);
    const answer = await call(token, "/graphql", {
      method: "POST",
      need: PERMISSIONS.issuesRead,
      body: { query: RELATIONSHIPS_QUERY, variables: { ids: batch } },
    });
    if (!answer.ok) return { ok: false, answer, found };
    // GraphQL answers 200 with an `errors` array when part of a query fails.
    // A partial answer is still worth keeping: the board shows what it got.
    found.push(...(Array.isArray(answer.data?.data?.nodes) ? answer.data.data.nodes : []));
  }
  return { ok: true, found };
}

export async function fetchRelationships(token, ids) {
  const wanted = Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id !== "") : [];
  if (wanted.length === 0) return { ok: true, data: [] };

  const first = await askAbout(token, wanted);
  if (!first.ok) return first.answer;

  // A child is not on the board and its id is not known until the answer above
  // arrives, so it takes a second pass. The same query, so a child is read
  // exactly like any other card, and only when a card on the board has children
  // at all (ADR 0010).
  const asked = new Set(wanted);
  // One batch, never more. A board of a hundred parents with ten children each
  // would otherwise spend ten more calls on work that is only mentioned on a
  // card. A child nobody asked about has no answer here, and `app.js` says
  // nothing about its column rather than guessing one (ADR 0025).
  const children = childIssueIds(first.found)
    .filter((id) => !asked.has(id))
    .slice(0, RELATIONSHIP_BATCH);
  if (children.length === 0) return { ok: true, data: first.found };

  // A failed second pass costs the children's columns and nothing else, so the
  // board keeps the answer it already has rather than reporting an error over
  // work that is only mentioned on a card.
  const second = await askAbout(token, children);
  return { ok: true, data: [...first.found, ...second.found] };
}

/**
 * Every open pull request waiting for a review from this token's owner.
 *
 * A review waiting on you is not assigned to you, so the issues endpoint never
 * shows it. Search is the only endpoint that answers "waiting on me", and it
 * answers in a slightly different shape: `workItems.js` reads both (ADR 0013).
 */
export function fetchReviewRequests(token) {
  const query = encodeURIComponent("is:open is:pr review-requested:@me archived:false");
  return call(token, `/search/issues?q=${query}&per_page=100&sort=updated&order=asc`, {
    need: PERMISSIONS.pullRequestsRead,
  });
}


