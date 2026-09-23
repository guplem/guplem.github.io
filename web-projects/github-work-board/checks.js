// How the checks on a pull request's last commit are going, as a dot and a
// sentence.
//
// **GitHub's own rollup is out of reach here.** `statusCheckRollup` needs the
// Checks permission, and GitHub does not offer that permission on a
// fine-grained token, which is the only kind this board asks for (ADR 0001).
// The board reads the Actions API instead: the workflow runs on the pull
// request's last commit, which a fine-grained token reads with "Actions: read"
// (ADR 0037).
//
// So the verdict is worked out here, from every run on that commit. The board
// sees all of them, which is what makes a sum an honest answer.

/** How many runs the board asks GitHub for on one commit. GitHub's own largest page. */
export const CHECKS_READ = 100;

/**
 * A run that has ended well. Anything else that has ended is a failure, which
 * is how GitHub's own rollup reads it: cancelled and timed out stop the work
 * just as surely as a red test.
 */
const PASSING = new Set(["success", "neutral", "skipped"]);

/**
 * What one workflow run says.
 *
 * A run that has not reached `completed` is still running, whatever it will
 * conclude. `waiting`, `requested`, `queued` and `pending` are all that.
 */
function readRun(run) {
  if (!run || typeof run !== "object") return "";
  if (run.status !== "completed") return "ongoing";
  return PASSING.has(run.conclusion) ? "passed" : "failed";
}

/**
 * Every workflow run on one commit, counted, with the verdict the dot takes its
 * colour from.
 *
 * Worst first: one red run is a red dot however many passed, because the work
 * cannot go forward. Then anything still running. A commit nothing has run on
 * has no verdict at all, and draws no dot: nothing ran is not a pass.
 */
export function readWorkflowRuns(runs) {
  const summary = { verdict: "", passed: 0, failed: 0, ongoing: 0, counted: 0, total: 0 };
  for (const run of Array.isArray(runs) ? runs : []) {
    const one = readRun(run);
    if (one === "") continue;
    summary[one] += 1;
    summary.counted += 1;
  }
  summary.total = summary.counted;
  if (summary.failed > 0) summary.verdict = "failed";
  else if (summary.ongoing > 0) summary.verdict = "ongoing";
  else if (summary.passed > 0) summary.verdict = "passed";
  return summary;
}

/**
 * How many times the board asks about a commit nothing has run on.
 *
 * A repository with no workflows answers "nothing ran" every single time, and
 * asking it again on every refresh, for every pull request in it, is exactly
 * the cost the rule below exists to avoid. Five is about five minutes on the
 * default schedule, which is long enough for a workflow that was going to
 * start to have started.
 */
export const MOST_ASKS = 5;

/**
 * Whether the board has to ask GitHub about this commit again.
 *
 * A commit the board has a final answer for is not asked about twice: a run
 * that has finished stays finished, and the commit id changes the moment
 * anybody pushes. That is what keeps this feature at about one call per pull
 * request in total rather than one on every refresh (ADR 0037).
 *
 * Runs still going are asked about until they end. A commit nothing has run on
 * is asked about a few more times and then left alone: a workflow can still
 * start on a pull request opened a second ago, but not for ever.
 *
 * @param summary what the board already holds for that commit, with `asks`
 *   counting how many times it has asked
 */
export function needsAsking(summary) {
  const verdict = summary?.verdict;
  if (verdict === "passed" || verdict === "failed") return false;
  if (verdict === "ongoing") return true;
  return (summary?.asks ?? 0) < MOST_ASKS;
}

/** Worst first, which is the order every other list of reasons on a card reads in. */
const PARTS = [
  { key: "failed", words: "failed" },
  { key: "ongoing", words: "still running" },
  { key: "passed", words: "passed" },
];

/** The verdict on its own, for a card whose checks the board could not count. */
const ALONE = {
  failed: "A check on the last commit came back red.",
  ongoing: "The checks on the last commit are still running.",
  passed: "Every check on the last commit passed.",
};

/**
 * What resting on the dot says.
 *
 * A dot nobody can read is a colour and nothing else, so the sentence carries
 * the same answer in words (ADR 0004). It names only the numbers that are not
 * zero, and it says so when it read part of a longer list rather than claiming
 * the rest.
 */
export function describeChecks(summary) {
  const verdict = summary?.verdict ?? "";
  if (verdict === "") return "";
  if (summary.counted === 0) return ALONE[verdict] ?? "";

  const said = PARTS.filter((part) => summary[part.key] > 0).map((part) => `${summary[part.key]} ${part.words}`);
  const rest = summary.total > summary.counted ? ` Read from the first ${summary.counted} of ${summary.total}.` : "";
  return `Checks: ${said.join(", ")}.${rest}`;
}
