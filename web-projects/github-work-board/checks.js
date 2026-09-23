// How the checks on a pull request's last commit ended, as a dot and a sentence.
//
// GitHub runs checks on the last commit of a branch and rolls them all into one
// verdict. "Needs attention" already reads that verdict (ADR 0011), but a card
// never said which way the checks went while they were still running, or how
// many of them there were.
//
// **The colour is GitHub's rollup. The numbers are the board's count.** Those
// are two different questions, and mixing them is how the dot would come to
// argue with itself: the board reads the first `CHECKS_READ` checks and GitHub
// rolls up every one of them, so a sum done here could read green on a pull
// request GitHub calls red (ADR 0037).

/** How many checks the board asks GitHub for on one commit. */
export const CHECKS_READ = 50;

/** GitHub's rollup, in the board's own words. Anything else is no answer at all. */
const VERDICTS = new Map([
  ["SUCCESS", "passed"],
  ["FAILURE", "failed"],
  ["ERROR", "failed"],
  ["PENDING", "ongoing"],
  ["EXPECTED", "ongoing"],
]);

/**
 * What one check says, in the same three words.
 *
 * A check run that has not reached `COMPLETED` is still running, whatever it
 * says it will conclude. A completed one is read from its conclusion, where
 * `NEUTRAL` and `SKIPPED` are passes because GitHub's own rollup counts them as
 * passes: numbers that argue with the colour beside them are worse than no
 * numbers. An older commit status, which is not a check run, carries the same
 * five states the rollup does.
 */
const CONCLUSIONS = new Map([
  ["SUCCESS", "passed"],
  ["NEUTRAL", "passed"],
  ["SKIPPED", "passed"],
]);

function readOne(node) {
  if (!node || typeof node !== "object") return "";
  if (node.__typename === "CheckRun") {
    if (node.status !== "COMPLETED") return "ongoing";
    return CONCLUSIONS.get(node.conclusion) ?? "failed";
  }
  return VERDICTS.get(node.state) ?? "";
}

/**
 * The checks on one commit: GitHub's verdict, and how the ones the board read
 * ended.
 *
 * @param rollup the `statusCheckRollup` GitHub answered with, or nothing
 * @returns `{verdict, passed, failed, ongoing, counted, total}`, where `verdict`
 *   is "" for a pull request nothing ran on. Nothing ran is not a pass.
 */
export function readCheckSummary(rollup) {
  const summary = { verdict: "", passed: 0, failed: 0, ongoing: 0, counted: 0, total: 0 };
  if (!rollup || typeof rollup !== "object") return summary;
  summary.verdict = VERDICTS.get(rollup.state) ?? "";

  const nodes = Array.isArray(rollup.contexts?.nodes) ? rollup.contexts.nodes : [];
  for (const node of nodes) {
    const one = readOne(node);
    if (one === "") continue;
    summary[one] += 1;
    summary.counted += 1;
  }
  const total = rollup.contexts?.totalCount;
  summary.total = Number.isInteger(total) ? total : summary.counted;
  return summary;
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
