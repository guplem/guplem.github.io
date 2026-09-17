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
