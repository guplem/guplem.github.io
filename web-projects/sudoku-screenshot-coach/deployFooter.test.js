// Tests for the drawing and the fallbacks of the "deployed at" line.
//
// `deployFooter.js` needs a browser, so it is marked impure in the module map.
// But it takes the element, the message lookup and the escaper as arguments, and
// it reaches the browser only through `fetch`, `localStorage` and `location`.
// Stubs for those are enough, and this is the layer the reported bug lived in:
// every call failed, and the line was left blank with nothing to read.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { MESSAGES } from "./i18n.js";

const PATH = "web-projects/sudoku-screenshot-coach";

/**
 * A fresh copy of the module for each test.
 * The module keeps the last record it drew, so that a language change can redraw
 * without asking GitHub again. One page has one footer, so that state is right
 * in the browser, but it must not leak from one test into the next.
 */
let counter = 0;
const loadFooter = () => import(`./deployFooter.js?test=${(counter += 1)}`);

/** The real English catalogue, so a renamed key fails here too. */
const say = (key, params = {}) =>
  (MESSAGES[key]?.en ?? key).replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));

const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Just enough of an element for the line to be drawn into. */
const stubElement = () => ({ innerHTML: "", textContent: "" });

const COMMIT = {
  sha: "e704597cea155f944da6cdb460240de881a38970",
  shortSha: "e704597",
  url: "https://github.com/guplem/guplem.github.io/commit/e704597",
  date: "2026-08-29T10:13:26Z",
};
const PULL = {
  number: 77,
  title: "fix: never show a candidate the coach can rule out",
  url: "https://github.com/guplem/guplem.github.io/pull/77",
  mergedAt: "2026-08-29T10:20:00Z",
};

const COMMITS_RESPONSE = [{ sha: COMMIT.sha, html_url: COMMIT.url, commit: { committer: { date: COMMIT.date } } }];
const PULLS_RESPONSE = [{ number: 77, title: PULL.title, html_url: PULL.url, merged_at: PULL.mergedAt }];

// ---------------------------------------------------------------- browser stubs

const realFetch = globalThis.fetch;
const realConsoleWarn = console.warn;
let store;

beforeEach(() => {
  store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  globalThis.location = { pathname: `/${PATH}/` };
  console.warn = () => {};
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realConsoleWarn;
  delete globalThis.localStorage;
  delete globalThis.location;
});

/**
 * Stand in for the network.
 * @param {object} answers `page` for the HEAD on this page, `commits` and
 *   `pulls` for the two GitHub calls. `false` makes that call fail.
 */
function stubFetch({ page = "Sat, 29 Aug 2026 10:16:34 GMT", commits = COMMITS_RESPONSE, pulls = PULLS_RESPONSE } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push(String(url));
    if (options.method === "HEAD") {
      if (page === false) throw new Error("offline");
      return { ok: true, headers: { get: (name) => (name === "Last-Modified" ? page : null) } };
    }
    const body = String(url).includes("/pulls") ? pulls : commits;
    if (body === false) return { ok: false, status: 403, json: async () => ({ message: "API rate limit exceeded" }) };
    return { ok: true, json: async () => body };
  };
  return calls;
}

const githubCalls = (calls) => calls.filter((url) => url.includes("api.github.com"));

// ---------------------------------------------------------------------- drawing

describe("renderDeployLine", () => {
  test("names the pull request and links it", async () => {
    const { renderDeployLine } = await loadFooter();
    const element = stubElement();
    renderDeployLine(element, { date: PULL.mergedAt, source: "pull", commit: COMMIT, pull: PULL }, "en", say, escape, PATH);
    expect(element.innerHTML).toContain("2026");
    expect(element.innerHTML).toContain(">#77<");
    expect(element.innerHTML).toContain(PULL.url);
  });

  test("names the commit when no pull request carried it", async () => {
    const { renderDeployLine } = await loadFooter();
    const element = stubElement();
    renderDeployLine(element, { date: COMMIT.date, source: "commit", commit: COMMIT, pull: null }, "en", say, escape, PATH);
    expect(element.innerHTML).toContain("e704597");
    expect(element.innerHTML).toContain(COMMIT.url);
  });

  test("shows the page's own publish time with a way to see what changed", async () => {
    const { renderDeployLine } = await loadFooter();
    const element = stubElement();
    renderDeployLine(element, { date: "2026-08-29T10:16:34Z", source: "page", commit: null, pull: null }, "en", say, escape, PATH);
    expect(element.innerHTML).toContain("2026");
    expect(element.innerHTML).toContain(`/commits/main/${PATH}`);
  });

  // The bug that was reported: the line was blank and read as a missing feature.
  test("still says something when nothing at all is known", async () => {
    const { renderDeployLine } = await loadFooter();
    const element = stubElement();
    renderDeployLine(element, null, "en", say, escape, PATH);
    expect(element.innerHTML.length).toBeGreaterThan(0);
    expect(element.innerHTML).toContain(`/commits/main/${PATH}`);
  });

  test("writes the line in the language asked for", async () => {
    const { renderDeployLine } = await loadFooter();
    const record = { date: PULL.mergedAt, source: "pull", commit: COMMIT, pull: PULL };
    const english = stubElement();
    const spanish = stubElement();
    const spanishSay = (key, params = {}) =>
      (MESSAGES[key]?.es ?? key).replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
    renderDeployLine(english, record, "en", say, escape, PATH);
    renderDeployLine(spanish, record, "es", spanishSay, escape, PATH);
    expect(spanish.innerHTML).not.toBe(english.innerHTML);
    expect(spanish.innerHTML).toContain(">#77<");
  });

  test("does nothing without an element, rather than throwing", async () => {
    const { renderDeployLine } = await loadFooter();
    expect(() => renderDeployLine(null, null, "en", say, escape, PATH)).not.toThrow();
  });
});

// ------------------------------------------------------------------ start-up

describe("startDeployLine", () => {
  test("shows the pull request when GitHub answers", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    const element = stubElement();
    stubFetch();
    await startDeployLine(element, PATH, "en", say, escape);
    expect(element.innerHTML).toContain(">#77<");
    expect(JSON.parse(store.get("sudoku-screenshot-coach.deploy")).record.source).toBe("pull");
  });

  // The reported failure. GitHub refusing must not blank the line.
  test("falls back to this page's publish time when GitHub refuses", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    const element = stubElement();
    stubFetch({ commits: false });
    await startDeployLine(element, PATH, "en", say, escape);
    expect(element.innerHTML).toContain("2026");
    expect(element.innerHTML).toContain(`/commits/main/${PATH}`);
  });

  test("says something even when every request fails", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    const element = stubElement();
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    await startDeployLine(element, PATH, "en", say, escape);
    expect(element.innerHTML.length).toBeGreaterThan(0);
    expect(element.innerHTML).toContain(`/commits/main/${PATH}`);
  });

  test("keeps the commit line when the pull request lookup alone fails", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    const element = stubElement();
    stubFetch({ pulls: false });
    await startDeployLine(element, PATH, "en", say, escape);
    expect(element.innerHTML).toContain("e704597");
  });

  test("never throws, whatever the network does", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    const element = stubElement();
    globalThis.fetch = async () => ({ ok: true, json: async () => { throw new Error("broken JSON"); } });
    expect(startDeployLine(element, PATH, "en", say, escape)).resolves.toBeUndefined();
  });

  test("asks GitHub once and then reads the answer from the cache", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    const calls = stubFetch();
    await startDeployLine(stubElement(), PATH, "en", say, escape);
    const afterFirst = githubCalls(calls).length;
    await startDeployLine(stubElement(), PATH, "en", say, escape);
    expect(githubCalls(calls).length).toBe(afterFirst);
  });

  // 60 anonymous calls an hour are shared by everyone behind one address. A
  // visitor who is out of them must not spend two more on every reload.
  test("backs off after a refusal instead of asking again on every load", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    const calls = stubFetch({ commits: false });
    const first = stubElement();
    await startDeployLine(first, PATH, "en", say, escape);
    const afterFirst = githubCalls(calls).length;
    const second = stubElement();
    await startDeployLine(second, PATH, "en", say, escape);
    expect(githubCalls(calls).length).toBe(afterFirst);
    // And the line is still filled in from the page's own headers.
    expect(second.innerHTML).toContain("2026");
  });

  test("keeps a stored answer through a later refusal", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    stubFetch();
    await startDeployLine(stubElement(), PATH, "en", say, escape);
    // Age the entry past the six hours so the next load asks again, and refuse it.
    const entry = JSON.parse(store.get("sudoku-screenshot-coach.deploy"));
    entry.fetchedAt = Date.now() - 7 * 60 * 60 * 1000;
    store.set("sudoku-screenshot-coach.deploy", JSON.stringify(entry));
    stubFetch({ commits: false });
    const element = stubElement();
    await startDeployLine(element, PATH, "en", say, escape);
    expect(element.innerHTML).toContain(">#77<");
    expect(JSON.parse(store.get("sudoku-screenshot-coach.deploy")).record.pull.number).toBe(77);
  });

  test("ignores a stored record from an older shape", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    store.set(
      "sudoku-screenshot-coach.deploy",
      JSON.stringify({ fetchedAt: Date.now(), record: { date: PULL.mergedAt, commit: COMMIT, pull: PULL } })
    );
    const calls = stubFetch();
    const element = stubElement();
    await startDeployLine(element, PATH, "en", say, escape);
    expect(githubCalls(calls).length).toBeGreaterThan(0);
    expect(element.innerHTML).toContain(">#77<");
  });

  test("survives storage that refuses to be read or written", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    globalThis.localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    stubFetch();
    const element = stubElement();
    await startDeployLine(element, PATH, "en", say, escape);
    expect(element.innerHTML).toContain(">#77<");
  });

  // The grid a player reported, in reverse: the page was new and the footer was
  // old. They loaded the page while pull request #78 was the newest, so #78 went
  // into the cache. Pull request #79 merged forty-seven minutes later and the
  // site republished, but the stored answer was still inside its six hours, so
  // every reload showed #78. The page's own `Last-Modified` proves the stored
  // answer wrong, and it is free to read, so it is the check that was missing.
  const PULL_78 = {
    number: 78,
    title: 'fix: never leave the "deployed at" line blank',
    url: "https://github.com/guplem/guplem.github.io/pull/78",
    mergedAt: "2026-08-29T10:37:43Z",
  };
  const RECORD_78 = { date: PULL_78.mergedAt, source: "pull", commit: COMMIT, pull: PULL_78 };
  /** The stamp the site carried while #78 was the newest deploy. */
  const PAGE_BEFORE = new Date("Sat, 29 Aug 2026 10:39:02 GMT").toISOString();
  /** GitHub's answer after pull request #79 merged. */
  const AFTER_79 = {
    commits: [
      {
        sha: "41cb58b86c23efceb1783b6aa60d422c1159d253",
        html_url: "https://github.com/guplem/guplem.github.io/commit/41cb58b",
        commit: { committer: { date: "2026-08-29T11:18:36Z" } },
      },
    ],
    pulls: [
      {
        number: 79,
        title: "feat: teach the sudoku coach ten more solving techniques",
        html_url: "https://github.com/guplem/guplem.github.io/pull/79",
        merged_at: "2026-08-29T11:24:33Z",
      },
    ],
    // GitHub Pages republished two minutes after the merge.
    page: "Sat, 29 Aug 2026 11:26:10 GMT",
  };

  test("asks GitHub again when the page was published after the stored answer", async () => {
    const { startDeployLine } = await loadFooter();
    store.set(
      "sudoku-screenshot-coach.deploy",
      JSON.stringify({ fetchedAt: Date.now() - 20 * 60 * 1000, record: RECORD_78, failed: false })
    );
    const calls = stubFetch(AFTER_79);
    const element = stubElement();
    await startDeployLine(element, PATH, "en", say, escape);
    expect(githubCalls(calls).length).toBeGreaterThan(0);
    expect(element.innerHTML).toContain(">#79<");
    expect(element.innerHTML).not.toContain(">#78<");
  });

  test("shows what it can prove, rather than the old pull request, when GitHub will not answer", async () => {
    // The same republish, but the visitor has spent their anonymous calls.
    // Naming #78 would be a confident wrong answer, so the line falls back to
    // the page's own publish time, which is true whatever GitHub says.
    const { startDeployLine } = await loadFooter();
    store.set(
      "sudoku-screenshot-coach.deploy",
      JSON.stringify({ fetchedAt: Date.now() - 60 * 1000, record: RECORD_78, failed: true, pageDate: PAGE_BEFORE })
    );
    stubFetch({ ...AFTER_79, commits: false });
    const element = stubElement();
    await startDeployLine(element, PATH, "en", say, escape);
    expect(element.innerHTML).not.toContain(">#78<");
    expect(element.innerHTML).toContain("2026");
    expect(element.innerHTML).toContain(`/commits/main/${PATH}`);
  });

  test("spends at most one lookup per republish when GitHub keeps refusing", async () => {
    // A republish is allowed through the fifteen-minute backoff, because the
    // stored answer is known to be out of date. That must cost one lookup, not
    // one on every reload: the failed attempt records the new publish stamp, so
    // the backoff takes over again until the site is published once more.
    const { startDeployLine } = await loadFooter();
    store.set(
      "sudoku-screenshot-coach.deploy",
      JSON.stringify({ fetchedAt: Date.now() - 60 * 1000, record: RECORD_78, failed: true, pageDate: PAGE_BEFORE })
    );
    const calls = stubFetch({ ...AFTER_79, commits: false });
    await startDeployLine(stubElement(), PATH, "en", say, escape);
    const afterFirst = githubCalls(calls).length;
    expect(afterFirst).toBeGreaterThan(0);
    await startDeployLine(stubElement(), PATH, "en", say, escape);
    expect(githubCalls(calls).length).toBe(afterFirst);
  });

  test("keeps the stored answer while the site has not been published again", async () => {
    // The ordinary case, and the one that protects the hourly allowance. The
    // page carries the same publish stamp as when the answer was stored, so the
    // answer still stands and GitHub is not asked. This must hold even though
    // the page is newer than the pull request: every push to `main` republishes
    // the whole site, including pushes that change nothing in this project.
    const { startDeployLine } = await loadFooter();
    store.set(
      "sudoku-screenshot-coach.deploy",
      JSON.stringify({
        fetchedAt: Date.now() - 20 * 60 * 1000,
        record: RECORD_78,
        failed: false,
        pageDate: new Date("Sat, 29 Aug 2026 10:38:00 GMT").toISOString(),
      })
    );
    const calls = stubFetch({ page: "Sat, 29 Aug 2026 10:38:00 GMT" });
    const element = stubElement();
    await startDeployLine(element, PATH, "en", say, escape);
    expect(githubCalls(calls).length).toBe(0);
    expect(element.innerHTML).toContain(">#78<");
  });

  test("asks once more after an entry stored before the stamp was kept", async () => {
    // Every visitor carrying an entry from the previous version has no stamp to
    // compare, so the first load after this ships asks GitHub once and stores
    // one. That is what clears the stale line the player reported.
    const { startDeployLine } = await loadFooter();
    store.set(
      "sudoku-screenshot-coach.deploy",
      JSON.stringify({ fetchedAt: Date.now() - 20 * 60 * 1000, record: RECORD_78, failed: false })
    );
    const calls = stubFetch(AFTER_79);
    const element = stubElement();
    await startDeployLine(element, PATH, "en", say, escape);
    expect(githubCalls(calls).length).toBeGreaterThan(0);
    expect(element.innerHTML).toContain(">#79<");
    await startDeployLine(stubElement(), PATH, "en", say, escape);
    expect(githubCalls(calls).length).toBe(2);
  });

  test("redraws in a new language without asking GitHub again", async () => {
    const { redrawDeployLine, startDeployLine } = await loadFooter();
    const calls = stubFetch();
    await startDeployLine(stubElement(), PATH, "en", say, escape);
    const afterStart = githubCalls(calls).length;
    const element = stubElement();
    const spanishSay = (key, params = {}) =>
      (MESSAGES[key]?.es ?? key).replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
    redrawDeployLine(element, "es", spanishSay, escape, PATH);
    expect(element.innerHTML).toContain(">#77<");
    expect(element.innerHTML).toContain("Desplegado");
    expect(githubCalls(calls).length).toBe(afterStart);
  });
});
