// The only file in this project that touches the network.
//
// It asks GitHub and hands the answer over. It decides nothing: what an answer
// means lives in `issues.js`, `boardDocument.js` and `githubErrors.js`, which
// are pure and tested. Keeping the boundary in one file is what lets every
// other module run under `bun test` with no browser and no network, and it is
// the only place the token is ever attached to a request.
//
// Every call answers with the same shape, and never throws:
//   { ok: true, data }
//   { ok: false, status, message, need }
// `need` is the permission the call required, so the reader can be told which
// one to add. `status: 0` means the request never reached GitHub at all.

import { DOCUMENT_PATH } from "./boardDocument.js";
import { decodeBase64, encodeBase64 } from "./documentCodec.js";
import { PERMISSIONS } from "./permissions.js";

const API = "https://api.github.com";
const TIMEOUT_MS = 15000;

async function call(token, path, { method = "GET", body = null, need = "" } = {}) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers,
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

/** Whether the data repository exists and the token can see it. */
export function fetchRepository(token, { owner, repo }) {
  return call(token, `/repos/${owner}/${repo}`, { need: PERMISSIONS.metadata });
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
 */
const RELATIONSHIPS_QUERY = `query($ids: [ID!]!) {
  nodes(ids: $ids) {
    __typename
    ... on Issue {
      id
      parent { id number title url repository { nameWithOwner } }
      blockedBy(first: 20) { nodes { id number title state url } }
      subIssuesSummary { total completed }
      closedByPullRequestsReferences(first: 20, includeClosedPrs: true) {
        nodes {
          id number title state url merged reviewDecision headRefName baseRefName
          repository { nameWithOwner }
          reviewRequests(first: 20) { totalCount nodes { requestedReviewer { ... on User { login } } } }
          latestOpinionatedReviews(first: 20) { nodes { state author { login } } }
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
      headRefName
      baseRefName
      repository { nameWithOwner }
      reviewRequests(first: 20) { totalCount nodes { requestedReviewer { ... on User { login } } } }
      latestOpinionatedReviews(first: 20) { nodes { state author { login } } }
      closingIssuesReferences(first: 20) { nodes { id number title state url } }
    }
  }
}`;

/** How many ids GraphQL accepts in one `nodes` call. */
export const RELATIONSHIP_BATCH = 100;

export async function fetchRelationships(token, ids) {
  const wanted = Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id !== "") : [];
  if (wanted.length === 0) return { ok: true, data: [] };

  const found = [];
  for (let start = 0; start < wanted.length; start += RELATIONSHIP_BATCH) {
    const batch = wanted.slice(start, start + RELATIONSHIP_BATCH);
    const answer = await call(token, "/graphql", {
      method: "POST",
      need: PERMISSIONS.issuesRead,
      body: { query: RELATIONSHIPS_QUERY, variables: { ids: batch } },
    });
    if (!answer.ok) return answer;
    // GraphQL answers 200 with an `errors` array when part of a query fails.
    // A partial answer is still worth keeping: the board shows what it got.
    found.push(...(Array.isArray(answer.data?.data?.nodes) ? answer.data.data.nodes : []));
  }
  return { ok: true, data: found };
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

/**
 * The board file, with the sha of the version read.
 *
 * A repository with no board file yet is not a failure: it answers
 * `{ missing: true }`, which is what the first save turns into a create.
 */
export async function fetchBoardFile(token, { owner, repo }) {
  const path = `/repos/${owner}/${repo}/contents/${DOCUMENT_PATH}`;
  const result = await call(token, path, { need: PERMISSIONS.contentsWrite });
  if (!result.ok) {
    if (result.status === 404) return { ok: true, data: { missing: true, text: null, sha: null } };
    return result;
  }
  const text = decodeBase64(result.data?.content ?? "");
  if (text === null) {
    return {
      ok: false,
      status: 422,
      message: "The board file in that repository is not readable text.",
      need: PERMISSIONS.contentsWrite,
    };
  }
  return { ok: true, data: { missing: false, text, sha: result.data?.sha ?? null } };
}

/**
 * Write the board file.
 *
 * `sha` names the version being replaced. GitHub answers 409 when that is no
 * longer the current one, which is the signal that another device saved first.
 * Leaving it out is only correct when the file does not exist yet.
 */
export function saveBoardFile(token, { owner, repo, text, sha, message }) {
  const path = `/repos/${owner}/${repo}/contents/${DOCUMENT_PATH}`;
  return call(token, path, {
    method: "PUT",
    need: PERMISSIONS.contentsWrite,
    body: { message, content: encodeBase64(text), ...(sha ? { sha } : {}) },
  });
}
