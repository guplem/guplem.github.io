// The sentences cloud storage says to the reader.
//
// A fine-grained token that is missing one permission fails with 403 and the
// words "Resource not accessible by personal access token". That sentence names
// neither the permission nor the repository, so a reader who sees it has no way
// forward. Every call therefore says which permission it needs, and the failure
// is reported with that permission named. Lifted from github-work-board
// (its ADR 0001, 0005 and 0019).

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
    return "Another device saved first. This page read the newer file and merged your change into it. Nothing was lost.";
  }
  if (status === 422) return `GitHub rejected the request: ${message || "it did not say why."}`;
  return `GitHub answered ${status}. ${message || "It gave no reason."}`;
}

/** The check rows in one line. */
export function summariseChecks(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((one) => one && typeof one === "object");
  if (list.length === 0) return "Not connected yet";
  const failed = list.filter((one) => one.ok !== true);
  if (failed.length === 0) return `All ${list.length} checks passed`;
  if (failed.length === 1) return `${failed[0].label ?? "One check"} did not pass`;
  return `${failed.length} of ${list.length} checks did not pass`;
}

/**
 * Whether the data is reaching the cloud, in one badge.
 *
 * Nothing else on the screen says whether a save got through: the file is read
 * on opening and written a second after a change, both out of sight. So the
 * badge answers, and the detail names what to fix (github-work-board ADR 0019).
 *
 * "This device only" is a state, not a fault. A person who never set cloud
 * storage up is not broken.
 *
 * @param rows the connection checks, by `id` from `CONNECTION_CHECKS`
 * @param configured whether a token and a repository are saved
 * @param asked whether every check has answered yet
 */
export function describeSync(rows, { configured = false, asked = false } = {}) {
  if (!configured) {
    return {
      state: "local",
      label: "This device only",
      detail: "No cloud storage is set up. Everything is saved in this browser.",
    };
  }
  const list = (Array.isArray(rows) ? rows : []).filter((one) => one && typeof one === "object");
  const failed = list.find((one) => one.ok === false);
  if (failed) return { state: "broken", label: "Not saving", detail: String(failed.detail ?? "") };
  const folder = list.find((one) => one.id === "folder" && one.ok === true);
  if (folder) return { state: "ok", label: "Saving to the cloud", detail: String(folder.detail ?? "") };
  if (!asked) return { state: "checking", label: "Checking", detail: "Asking GitHub about the data repository." };
  return {
    state: "broken",
    label: "Not saving",
    detail: "The token did not reach the data folder. It needs Contents: Read and write, and the repository in its list.",
  };
}
