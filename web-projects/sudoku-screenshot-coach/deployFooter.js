// Draws the "deployed at" line in the page footer.
//
// This is the only file that fetches, stores or draws anything for that line.
// The decisions behind it live in the pure `deployInfo.js` next door, so the
// awkward parts here are only the ones that need a browser.
//
// It must never matter if this fails. GitHub may be unreachable, or the visitor
// may have spent their hourly allowance of anonymous calls. The line simply
// stays empty, and the page carries on. See adr/0007.

import {
  buildCommitsUrl,
  buildPullsUrl,
  deployRecord,
  formatDeployDate,
  isFresh,
  parseLatestCommit,
  parseMergedPull,
} from "./deployInfo.js";

/** Where the lookup is kept between visits. Root ADR 0007. */
const STORAGE_KEY = "sudoku-screenshot-coach.deploy";

/** The last record fetched, so a language change can redraw without asking again. */
let current = null;

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null; // private browsing, or a value from an older shape
  }
};

const writeCache = (record) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fetchedAt: Date.now(), record }));
  } catch {
    // Storage may be full or blocked. The line still shows; it just asks again.
  }
};

/** One GitHub call. Returns null for anything other than a clean answer. */
async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) return null;
  return response.json();
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
 * @param {object} record the deploy record, or null to leave it empty
 * @param {string} lang the language the page is in
 * @param {(key: string, params?: object) => string} t the message lookup
 * @param {(text: string) => string} escape the HTML escaper the page uses
 */
export function renderDeployLine(element, record, lang, t, escape) {
  if (!element) return;
  if (!record) {
    element.textContent = "";
    return;
  }
  const date = escape(formatDeployDate(record.date, lang));
  const link = (url, text) => `<a href="${escape(url)}" target="_blank" rel="noopener">${escape(text)}</a>`;
  element.innerHTML = record.pull
    ? t("ui.deployed", { date, pr: link(record.pull.url, `#${record.pull.number}`) })
    : t("ui.deployedNoPull", { date, commit: link(record.commit.url, record.commit.shortSha) });
}

/** Redraw the line in a new language, without asking GitHub again. */
export function redrawDeployLine(element, lang, t, escape) {
  renderDeployLine(element, current, lang, t, escape);
}

/**
 * Fill the line in, from the cache when it is fresh and from GitHub otherwise.
 * Never throws: a failure leaves the line as it was.
 */
export async function startDeployLine(element, path, lang, t, escape) {
  const cached = readCache();
  if (isFresh(cached)) {
    current = cached.record;
    renderDeployLine(element, current, lang, t, escape);
    return;
  }
  // Show the stale value while the new one is on its way, so the line does not
  // flicker away on every visit.
  if (cached?.record) {
    current = cached.record;
    renderDeployLine(element, current, lang, t, escape);
  }
  try {
    const record = await lookUp(path);
    if (!record) return;
    current = record;
    writeCache(record);
    renderDeployLine(element, current, lang, t, escape);
  } catch {
    // Offline, blocked, or out of anonymous calls. Whatever is on screen stays.
  }
}
