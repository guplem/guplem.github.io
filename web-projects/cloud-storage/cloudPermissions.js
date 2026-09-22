// What cloud storage asks GitHub for, written once.
//
// The setup guide on the page and the check list are both built from
// `REQUIRED_PERMISSIONS`. Nothing spells a permission out in HTML, because a
// list written twice drifts. Lifted from github-work-board ADR 0005.
//
// A token is approved against the list as it stood on the day the reader made
// it. When the list grows, `permissionsFingerprint` changes, and the page asks
// the reader to add the new permission and reconnect. The fingerprint ignores
// the wording of `why` and follows `id` and `level` only: rewriting a sentence
// must not tell everybody their token is out of date.
//
// **Adding a call that needs new access means adding it here, and nowhere else.**

/** The permission each call needs, as `cloudMessages.js` names it to the reader. */
export const PERMISSIONS = {
  metadata: "Metadata: read",
  contentsWrite: "Contents: read and write",
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
    id: "contents",
    name: "Contents",
    level: "Read and write",
    why: "your data, in the private repository you own",
  },
];

/** The calls the settings panel makes, in order, to prove the token works. */
export const CONNECTION_CHECKS = [
  { id: "identity", label: "Read your GitHub account", need: PERMISSIONS.metadata },
  { id: "repository", label: "See the data repository, and that it is private", need: PERMISSIONS.metadata },
  { id: "folder", label: "Read and write the data folder", need: PERMISSIONS.contentsWrite },
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
 * already, and telling them their token is out of date would be nonsense.
 */
export function tokenNeedsUpdate(granted, current = permissionsFingerprint()) {
  if (typeof granted !== "string" || granted.trim() === "") return false;
  return granted !== current;
}

/** The permissions a token does not already carry, so the prompt can name them. */
export function newPermissionsSince(granted, list = REQUIRED_PERMISSIONS) {
  const known = new Set(String(granted ?? "").split("|"));
  return list.filter((permission) => !known.has(`${permission.id}:${String(permission.level).toLowerCase()}`));
}
