// What this board asks GitHub for, written once.
//
// The setup guide on the page and the check list are both built from
// `REQUIRED_PERMISSIONS`. Nothing spells a permission out in HTML, because a
// list written twice drifts: a later change adds a call, grants itself the
// access it needs, and the guide keeps telling new readers to create a token
// that cannot do the job. ADR 0005.
//
// **A token is judged by what it just did, never by what it was granted on the
// day it was made.** The board used to keep a fingerprint of the list as it
// stood when the reader added the token, and compare it later. It said nothing
// about the token itself: a reader who widened their token on GitHub was still
// told it was behind, for ever, because nothing on GitHub changes what this
// browser wrote down. Every permission is proved by a call the board makes on
// its ordinary read, and Settings shows the answer (ADR 0005).
//
// **Adding a call that needs new access means adding it here, and nowhere
// else.** The guide, the checks and what Settings says all follow.

/** The permission each call needs, as `githubErrors.js` names it to the reader. */
export const PERMISSIONS = {
  metadata: "Metadata: read",
  issuesRead: "Issues: read",
  issuesWrite: "Issues: write",
  pullRequestsRead: "Pull requests: read",
  actionsRead: "Actions: read",
};

/**
 * The permissions the reader has to grant, exactly as GitHub's own token form
 * labels them. `level` is one of "Read-only" or "Read and write".
 */
export const REQUIRED_PERMISSIONS = [
  {
    id: "metadata",
    name: "Metadata",
    level: "Read-only",
    why: "GitHub asks for it on every fine-grained token",
    without: "Without it, the token cannot read anything at all.",
  },
  {
    id: "issues",
    name: "Issues",
    level: "Read and write",
    why: "the board reads the issues assigned to you",
    without: "Without it, the board cannot show the issues assigned to you.",
  },
  {
    id: "pull-requests",
    name: "Pull requests",
    level: "Read-only",
    why: "the board shows the pull requests assigned to you, beside your issues",
    without: "Without it, the board cannot show your pull requests or the ones waiting for your review.",
  },
  {
    id: "actions",
    name: "Actions",
    level: "Read-only",
    why: "the board says how the checks on a pull request are going, and this is the only door GitHub opens to a fine-grained token",
    without: "Without it, the board cannot say how the checks on a pull request are going.",
  },
];

const BY_ID = new Map(REQUIRED_PERMISSIONS.map((one) => [one.id, one]));

/** One permission by its id, or null. The id comes from a check that proves it. */
export function permissionFor(id) {
  return BY_ID.get(id) ?? null;
}

// Contents is not here any more. The board file is written by the shared cloud
// storage, with its own token and its own permission list (root ADR 0016).

/**
 * What the board does with a token on an ordinary read, in order, one for each
 * permission the reader was asked to grant.
 *
 * `permission` names the entry in `REQUIRED_PERMISSIONS` this call proves, so
 * Settings can say green or red for every line of the setup guide. A test keeps
 * the two lists in step: a permission nothing proves would sit in Settings with
 * no answer beside it.
 */
export const CONNECTION_CHECKS = [
  { id: "identity", label: "Read your GitHub account", need: PERMISSIONS.metadata, permission: "metadata" },
  {
    id: "issues",
    label: "Read the issues and pull requests assigned to you",
    need: PERMISSIONS.issuesRead,
    permission: "issues",
  },
  {
    id: "reviews",
    label: "Read the pull requests waiting for your review",
    need: PERMISSIONS.pullRequestsRead,
    permission: "pull-requests",
  },
  {
    id: "checks",
    label: "Read how the checks on a pull request are going",
    need: PERMISSIONS.actionsRead,
    permission: "actions",
  },
];
