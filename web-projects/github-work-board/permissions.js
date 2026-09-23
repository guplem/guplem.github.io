// What this board asks GitHub for, written once.
//
// The setup guide on the page and the check list are both built from
// `REQUIRED_PERMISSIONS`. Nothing spells a permission out in HTML, because a
// list written twice drifts: a later change adds a call, grants itself the
// access it needs, and the guide keeps telling new readers to create a token
// that cannot do the job. ADR 0005.
//
// A token is approved against the list as it stood on the day the reader made
// it. When the list grows, `permissionsFingerprint` changes, and the page asks
// the reader to add the new permission and reconnect. That is why the
// fingerprint ignores the wording of `why` and follows `id` and `level` only:
// rewriting a sentence must not tell everybody their token is out of date.
//
// **Adding a call that needs new access means adding it here, and nowhere
// else.** The guide, the fingerprint and the reader's prompt all follow.

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
  },
  {
    id: "issues",
    name: "Issues",
    level: "Read and write",
    why: "the board reads the issues assigned to you",
  },
  {
    id: "pull-requests",
    name: "Pull requests",
    level: "Read-only",
    why: "the board shows the pull requests assigned to you, beside your issues",
  },
  {
    id: "actions",
    name: "Actions",
    level: "Read-only",
    why: "the board says how the checks on a pull request are going, and this is the only door GitHub opens to a fine-grained token",
  },
];

// Contents is not here any more. The board file is written by the shared cloud
// storage, with its own token and its own permission list (root ADR 0016).

/** The calls the setup panel makes, in order, to prove the token works. */
export const CONNECTION_CHECKS = [
  { id: "identity", label: "Read your GitHub account", need: PERMISSIONS.metadata },
  { id: "issues", label: "Read the issues and pull requests assigned to you", need: PERMISSIONS.issuesRead },
];

/** A stable short string for one set of permissions, ignoring the order and the wording. */
export function permissionsFingerprint(list = REQUIRED_PERMISSIONS) {
  return list
    .map((permission) => `${permission.id}:${String(permission.level).toLowerCase()}`)
    .sort()
    .join("|");
}

/**
 * Whether the reader has to go back to GitHub and widen their token.
 *
 * A reader who has never connected gets `false`: they are in the setup guide
 * already, and telling them their token is out of date would be nonsense. A
 * token that carries more than the list asks for gets `false` too: the list
 * shrank once, when Contents moved to cloud storage, and there was nothing to
 * ask those readers to add.
 */
export function tokenNeedsUpdate(granted, current = permissionsFingerprint()) {
  if (typeof granted !== "string" || granted.trim() === "") return false;
  const held = new Set(granted.split("|"));
  return current.split("|").some((one) => !held.has(one));
}

/** The permissions a token does not already carry, so the prompt can name them. */
export function newPermissionsSince(granted, list = REQUIRED_PERMISSIONS) {
  const known = new Set(String(granted ?? "").split("|"));
  return list.filter((permission) => !known.has(`${permission.id}:${String(permission.level).toLowerCase()}`));
}
