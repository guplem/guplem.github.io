// The "deployed at" line, read from the page itself.
//
// The pull request number and its date are written into this page's `<head>` by
// `scripts/generateDeployStamp.js` before the pull request merges, inside a
// `GENERATED:DEPLOY` block. Nothing is fetched and nothing is stored, so the
// line is a property of the file you are reading.
//
// That is the whole point. The earlier version asked the GitHub API at load and
// cached the answer, and it was wrong twice: it showed the previous pull request
// for six hours after a deploy, and it could name a newer pull request than the
// files the browser had actually cached. A stamp inside the file cannot do
// either, because a cached page carries its own stamp. See root ADR 0013.

/** The repository this page is published from. */
export const DEFAULT_REPO = "guplem/guplem.github.io";
/** The branch GitHub Pages publishes. */
export const DEFAULT_BRANCH = "main";

/** The `name` of the two meta tags the generator writes. */
export const PULL_META = "deploy-pull-request";
export const DATE_META = "deploy-date";

/**
 * Check a stamp read from the page.
 * @returns {{pr: number, date: string}|null} null when either half is missing or
 *   unreadable, which is what an unstamped page looks like
 */
export function parseStamp(pull, date) {
  const number = Number(pull);
  if (!Number.isInteger(number) || number <= 0) return null;
  if (typeof date !== "string" || Number.isNaN(new Date(date).getTime())) return null;
  return { pr: number, date };
}

/**
 * Read the stamp out of a document's `<head>`.
 * @param {Document} doc the page to read
 */
export function readStamp(doc) {
  const content = (name) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? null;
  return parseStamp(content(PULL_META), content(DATE_META));
}

/** Where a reader can see the pull request, its description and its diff. */
export function buildPullUrl({ repo = DEFAULT_REPO, pr }) {
  return `https://github.com/${repo}/pull/${pr}`;
}

/**
 * Where a reader can see what changed. A page on github.com, not an API call, so
 * it always works. It is what the line offers when the page carries no stamp.
 */
export function buildHistoryUrl({ repo = DEFAULT_REPO, path = "", branch = DEFAULT_BRANCH }) {
  const base = `https://github.com/${repo}/commits/${branch}`;
  return path ? `${base}/${path}` : base;
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

/**
 * Put the line on the page.
 *
 * It must never go blank. A player once reported the line as missing when it was
 * merely empty, so a page with no stamp still names the branch and links the
 * folder's history.
 *
 * @param {HTMLElement} element where the line goes
 * @param {{pr: number, date: string}|null} stamp the stamp read from the page
 * @param {string} lang the language the page is in
 * @param {(key: string, params?: object) => string} t the message lookup
 * @param {(text: string) => string} escape the HTML escaper the page uses
 * @param {string} path the project folder, for the link to its history
 */
export function renderDeployLine(element, stamp, lang, t, escape, path = "") {
  if (!element) return;
  const link = (url, text) => `<a href="${escape(url)}" target="_blank" rel="noopener">${escape(text)}</a>`;
  if (!stamp) {
    element.innerHTML = t("ui.deployedUnknown", { history: link(buildHistoryUrl({ path }), t("ui.deployHistory")) });
    return;
  }
  element.innerHTML = t("ui.deployed", {
    date: escape(formatDeployDate(stamp.date, lang)),
    pr: link(buildPullUrl({ pr: stamp.pr }), `#${stamp.pr}`),
  });
}
