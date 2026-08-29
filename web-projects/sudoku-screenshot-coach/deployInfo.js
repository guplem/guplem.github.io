// Works out when the page you are looking at was deployed, and which pull
// request deployed it.
//
// The site is published by classic GitHub Pages, straight from the `main`
// branch, so there is no build step that could stamp a version into the page
// (root ADR 0002). The facts live in the repository's own history instead, and
// GitHub's public API serves them. Two calls answer it:
//
//   1. the newest commit on `main` that touched this project's folder
//   2. the pull request that carried that commit
//
// The pull request's merge time is the deploy time: merging into `main` is what
// publishes the site. When no pull request is found, the commit's own date is
// the best answer left.
//
// Everything here is pure. `deployFooter.js` does the fetching, the caching and
// the drawing, so this file can be tested without a browser or a network.

/** The repository this page is published from. */
export const DEFAULT_REPO = "guplem/guplem.github.io";
/** The branch GitHub Pages publishes. */
export const DEFAULT_BRANCH = "main";
/**
 * How long a lookup stays good. GitHub allows 60 unauthenticated calls an hour
 * per address, and this page needs two, so a visitor who reloads often must not
 * spend them. A deploy is rare; six hours of staleness costs nothing.
 */
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** The newest commit on a branch that touched one path. */
export function buildCommitsUrl({ repo = DEFAULT_REPO, path, branch = DEFAULT_BRANCH }) {
  const query = new URLSearchParams({ path, sha: branch, per_page: "1" });
  return `https://api.github.com/repos/${repo}/commits?${query}`;
}

/** The pull requests that carried one commit. */
export function buildPullsUrl({ repo = DEFAULT_REPO, sha }) {
  return `https://api.github.com/repos/${repo}/commits/${sha}/pulls`;
}

/**
 * Pull the one commit out of a commits response.
 * @returns {{sha: string, shortSha: string, url: string, date: string}|null}
 */
export function parseLatestCommit(payload) {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const entry = payload[0];
  const sha = entry?.sha;
  // The committer's date is when the commit landed in the history, which is
  // closer to the deploy than the author's date on a rebased or amended commit.
  const date = entry?.commit?.committer?.date ?? entry?.commit?.author?.date;
  if (typeof sha !== "string" || typeof date !== "string") return null;
  return {
    sha,
    shortSha: sha.slice(0, 7),
    url: entry.html_url ?? `https://github.com/${DEFAULT_REPO}/commit/${sha}`,
    date,
  };
}

/**
 * Pull the merged pull request out of a pulls response.
 * A commit can appear in several pull requests. The one that deployed it is the
 * one that merged, and when more than one did, the first to merge.
 * @returns {{number: number, title: string, url: string, mergedAt: string}|null}
 */
export function parseMergedPull(payload) {
  if (!Array.isArray(payload)) return null;
  const merged = payload
    .filter((entry) => typeof entry?.merged_at === "string" && typeof entry?.number === "number")
    .sort((a, b) => Date.parse(a.merged_at) - Date.parse(b.merged_at));
  if (merged.length === 0) return null;
  const pull = merged[0];
  return {
    number: pull.number,
    title: typeof pull.title === "string" ? pull.title : "",
    url: pull.html_url ?? `https://github.com/${DEFAULT_REPO}/pull/${pull.number}`,
    mergedAt: pull.merged_at,
  };
}

/**
 * Join a commit and its pull request into the one record the footer shows.
 * @returns {{date: string, commit: object, pull: object|null}|null}
 */
export function deployRecord(commit, pull = null) {
  if (!commit) return null;
  return { date: pull?.mergedAt ?? commit.date, commit, pull };
}

/**
 * Write a moment the way a reader of this language expects it.
 * Falls back to the plain date when the language is not one the browser knows.
 */
export function formatDeployDate(iso, lang = "en") {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "long", timeStyle: "short" }).format(when);
  } catch {
    return when.toISOString().slice(0, 10);
  }
}

/** True while a stored lookup is still worth trusting. */
export function isFresh(entry, now = Date.now(), ttl = CACHE_TTL_MS) {
  return Boolean(entry) && typeof entry.fetchedAt === "number" && now - entry.fetchedAt < ttl;
}
