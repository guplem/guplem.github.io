// Draws the "deployed at" line in the page footer.
//
// This is the only file that fetches, stores or draws anything for that line.
// The decisions behind it live in the pure `deployInfo.js` next door, so the
// awkward parts here are only the ones that need a browser.
//
// It must never matter if this fails, and it must never go blank either. The
// first version had only one source, GitHub's API, and drew nothing when that
// source said nothing. A player read the blank line as a missing feature and
// reported it. So the line is built from three sources, best first:
//
//   1. the pull request that last changed this project  (GitHub API, 2 calls)
//   2. the commit that last changed it                  (GitHub API, 1 call)
//   3. the moment this page was published               (its own headers)
//
// Source 3 is same-origin, so nothing throttles it and no other service has to
// answer. It is the floor: the line always ends up with at least a date and a
// link to the history. See root ADR 0013.

import {
  CACHE_TTL_MS,
  FAILURE_TTL_MS,
  buildCommitsUrl,
  buildHistoryUrl,
  buildPullsUrl,
  deployRecord,
  formatDeployDate,
  isFresh,
  parseLatestCommit,
  parseMergedPull,
  parsePageDate,
} from "./deployInfo.js";

/** Where the lookup is kept between visits. Root ADR 0007. */
const STORAGE_KEY = "sudoku-screenshot-coach.deploy";

/** How long to wait for any one request before giving up on it. */
const REQUEST_TIMEOUT_MS = 8000;

/** The last record worked out, so a language change can redraw without asking again. */
let current = null;

const readCache = () => {
  try {
    const entry = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!entry || typeof entry !== "object") return null;
    // A record stored before it grew a `source` cannot be drawn. Ask again.
    if (entry.record && typeof entry.record.source !== "string") return null;
    return entry;
  } catch {
    return null; // private browsing, or a value this version cannot read
  }
};

/**
 * Remember the answer, and remember whether the lookup failed, so a refusal
 * backs off for minutes while a good answer is kept for hours.
 */
const writeCache = (record, failed = false) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fetchedAt: Date.now(), record, failed }));
  } catch {
    // Storage may be full or blocked. The line still shows; it just asks again.
  }
};

/** A request that gives up rather than leave the footer waiting for ever. */
const withTimeout = (url, options) => {
  // `AbortSignal.timeout` is not in every browser this page still has to serve.
  const signal = typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
  return fetch(url, { ...options, signal });
};

/** One GitHub call. Returns null for anything other than a clean answer. */
async function getJson(url) {
  const response = await withTimeout(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) return null;
  return response.json();
}

/**
 * When this page was published, from the page's own address.
 * GitHub Pages sends `Last-Modified` on every file it serves, and sets it to the
 * time of the deploy. Same origin, so no allowance limits it.
 * @returns {Promise<string|null>} the moment, or null when it cannot be read
 */
async function readPageDate() {
  try {
    // Drop the query string: the puzzle in the address does not change the file,
    // and the plain address is the one the browser already has in its cache.
    const response = await withTimeout(location.pathname, { method: "HEAD" });
    if (!response.ok) return null;
    return parsePageDate(response.headers.get("Last-Modified"));
  } catch {
    return null; // opened from a file, or offline
  }
}

/** Ask GitHub when this project last changed, and which pull request did it. */
async function lookUp(path) {
  const commit = parseLatestCommit(await getJson(buildCommitsUrl({ path })));
  if (!commit) return null;
  // A commit with no pull request is still worth showing, so this call is
  // allowed to come back empty.
  const pull = parseMergedPull(await getJson(buildPullsUrl({ sha: commit.sha })).catch(() => null));
  return deployRecord(commit, pull);
}

/**
 * Put the line on the page.
 * @param {HTMLElement} element where the line goes
 * @param {object|null} record the deploy record, or null when nothing is known yet
 * @param {string} lang the language the page is in
 * @param {(key: string, params?: object) => string} t the message lookup
 * @param {(text: string) => string} escape the HTML escaper the page uses
 * @param {string} path the project folder, for the link to its history
 */
export function renderDeployLine(element, record, lang, t, escape, path = "") {
  if (!element) return;
  const link = (url, text) => `<a href="${escape(url)}" target="_blank" rel="noopener">${escape(text)}</a>`;
  const history = link(buildHistoryUrl({ path }), t("ui.deployHistory"));
  if (!record) {
    element.innerHTML = t("ui.deployedUnknown", { history });
    return;
  }
  const date = escape(formatDeployDate(record.date, lang));
  if (record.source === "pull") {
    element.innerHTML = t("ui.deployed", { date, pr: link(record.pull.url, `#${record.pull.number}`) });
  } else if (record.source === "commit") {
    element.innerHTML = t("ui.deployedNoPull", { date, commit: link(record.commit.url, record.commit.shortSha) });
  } else {
    element.innerHTML = t("ui.deployedDateOnly", { date, history });
  }
}

/** Redraw the line in a new language, without asking GitHub again. */
export function redrawDeployLine(element, lang, t, escape, path = "") {
  renderDeployLine(element, current, lang, t, escape, path);
}

/**
 * Fill the line in, from the cache when it is fresh and from the network
 * otherwise. Never throws, and never leaves the line blank.
 */
export async function startDeployLine(element, path, lang, t, escape) {
  if (!element) return;
  const draw = () => renderDeployLine(element, current, lang, t, escape, path);

  const cached = readCache();
  // A refusal is remembered for far less time than a good answer, so a visitor
  // who is out of anonymous calls recovers on their own.
  const fresh = isFresh(cached, Date.now(), cached?.failed ? FAILURE_TTL_MS : CACHE_TTL_MS);

  // Take the stored answer, even when it is stale, so the line does not flicker
  // away on every visit.
  if (cached?.record) current = cached.record;

  // Draw before anything is asked for, so the line is never blank while the
  // network is working. With nothing known yet this draws the plain link.
  draw();

  // The floor. Same-origin and cheap, so the line carries a date before GitHub
  // is even asked, and keeps one if GitHub never answers.
  if (!current) {
    current = deployRecord(null, null, await readPageDate());
    draw();
  }

  // Either a good answer worth keeping, or a refusal too recent to retry.
  if (fresh) return;

  try {
    const record = await lookUp(path);
    if (record) {
      current = record;
      writeCache(record);
      draw();
      return;
    }
  } catch {
    // Offline, blocked, or out of anonymous calls.
  }
  // Say so where a developer will see it. The visitor still sees a date. Keep
  // any answer GitHub gave before, rather than dropping back to the page time.
  console.warn("[deployFooter] GitHub did not answer. Showing what the page itself knows.");
  writeCache(current && current.source !== "page" ? current : null, true);
}
