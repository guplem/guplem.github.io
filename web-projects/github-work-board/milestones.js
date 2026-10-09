// The milestone a piece of work is in, and how far that milestone has gone.
//
// GitHub's issues and search endpoints both send the milestone inside the
// answer the board already reads, with its link and its open and closed
// counts. So the pill on a card and the share on it cost no call of their own,
// and they are as fresh as the rest of the card (ADR 0045).
//
// The pill has two halves. The icon and the share are a link to the milestone
// on GitHub. The name is a filter chip, and pressing it narrows the board to
// that milestone, by name, the way a label filter does (ADR 0009, ADR 0045).

/** The icon on the pill: a signpost, drawn from paths (ADR 0001). */
export const MILESTONE_PATHS = [
  "M12 13v8",
  "M12 3v3",
  "M4 6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h13a2 2 0 0 0 1.152-.365l3.424-2.317a1 1 0 0 0 0-1.635l-3.424-2.318A2 2 0 0 0 17 6z",
];

const GITHUB_PAGE = "https://github.com/";

function wholeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

/**
 * One milestone out of GitHub's answer, or null when the work is in none.
 *
 * The link goes straight into `a.href`, so only a page on GitHub is kept.
 */
export function readMilestone(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.title !== "string" || raw.title === "") return null;
  return {
    title: raw.title,
    url: typeof raw.html_url === "string" && raw.html_url.startsWith(GITHUB_PAGE) ? raw.html_url : "",
    openCount: wholeCount(raw.open_issues),
    closedCount: wholeCount(raw.closed_issues),
  };
}

/**
 * The share of the milestone that is closed, as GitHub's milestone page counts
 * it: issues and pull requests together.
 *
 * Rounded down, so the pill says 100% only when nothing is left open. An empty
 * milestone has no share, and the pill then shows the icon alone.
 */
export function milestoneProgress(milestone) {
  const open = wholeCount(milestone?.openCount);
  const closed = wholeCount(milestone?.closedCount);
  const total = open + closed;
  if (total === 0) return { percent: null, label: "" };
  const percent = Math.floor((closed / total) * 100);
  return { percent, label: `${percent}%` };
}

/** The tooltip on the link half: how far the milestone is, and where the link goes. */
export function milestoneLinkTip(milestone) {
  const closed = wholeCount(milestone?.closedCount);
  const total = wholeCount(milestone?.openCount) + closed;
  const counted = total === 0 ? "" : `: ${closed} of ${total} closed`;
  return `${milestone?.title ?? ""}${counted}. Open it on GitHub`;
}

/** The tooltip on the name half, which is a filter. */
export function milestoneFilterTip(milestone, pressed) {
  const name = milestone?.title ?? "";
  return pressed ? `Show everything again, not only ${name}` : `Show only the work in ${name}`;
}
