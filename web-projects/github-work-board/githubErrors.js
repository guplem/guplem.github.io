// Turning a failed GitHub call into a sentence that says what to do next.
//
// A fine-grained token that is missing one permission fails with 403 and the
// words "Resource not accessible by personal access token". That sentence names
// neither the permission nor the repository, so a reader who sees it has no way
// forward. Every call this page makes therefore says which permission it needs,
// and the failure is reported with that permission named. The permissions
// themselves live in `permissions.js`. See ADR 0001 and ADR 0005.

/**
 * One failed call as a sentence for the reader.
 * @param failure `{ status, message, need }`; `need` is the permission the call
 *   required, taken from `PERMISSIONS`.
 */
export function describeFailure(failure) {
  const status = Number(failure?.status) || 0;
  const message = typeof failure?.message === "string" ? failure.message : "";
  const need = typeof failure?.need === "string" ? failure.need : "";

  if (status === 0) return "The call did not reach GitHub. Check your connection and try again.";
  if (status === 401) {
    return "GitHub rejected the token. It may have expired or been revoked. Create a new one and paste it again.";
  }
  // A rate limit is also a 403, and the advice is the opposite: wait, do not go
  // and change the token.
  if (status === 403 && /rate limit/i.test(message)) {
    return "GitHub is holding this token back: it made too many calls. Wait a few minutes, then try again.";
  }
  if (status === 403) {
    return need
      ? `GitHub refused the call. The token is missing the permission "${need}". Open the token page, add it, and save.`
      : "GitHub refused the call. The token is missing a permission this page needs.";
  }
  if (status === 404) {
    return need
      ? `GitHub cannot see it. Either it does not exist, or your token's repository list leaves it out. Check that list, and that "${need}" is granted.`
      : "GitHub cannot see it. Either it does not exist, or your token cannot reach it.";
  }
  if (status === 409) {
    return "Another device saved first. The board read the newer file and merged your change into it. Save again.";
  }
  if (status === 422) return `GitHub rejected the request: ${message || "it did not say why."}`;
  return `GitHub answered ${status}. ${message || "It gave no reason."}`;
}

/**
 * A failed check in Settings, as a sentence that says exactly what to tick.
 *
 * GitHub answers a missing permission with 403 and "Resource not accessible by
 * personal access token". The reader is then looking at a form with dozens of
 * permissions on it, so the row names the one to add and its level, spelled the
 * way that form spells them, and says what stops working without it (ADR 0005).
 *
 * Everything that is not a missing permission keeps its own advice: a dead
 * token, a rate limit and a lost connection are all answered by
 * `describeFailure`, and none of them is fixed by editing a permission.
 *
 * @param failure `{ status, message }` from the call that failed
 * @param permission the `REQUIRED_PERMISSIONS` entry the call proves, or null
 */
export function describeMissingPermission(failure, permission) {
  const status = Number(failure?.status) || 0;
  const message = typeof failure?.message === "string" ? failure.message : "";
  const named = permission ? `${permission.name} → ${permission.level}` : "";

  if (status === 403 && !/rate limit/i.test(message) && named !== "") {
    return `Add "${named}" to this token on GitHub, then check again. ${permission.without}`;
  }
  if (status === 404 && named !== "") {
    return `GitHub cannot see it. Check that this token's repository list covers the work you want, and that "${named}" is granted. ${permission.without}`;
  }
  return describeFailure({ ...failure, need: named });
}
