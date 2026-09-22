// The promises this project must not break by accident.
//
// Every test here guards a decision that is cheap to undo without noticing and
// expensive to discover later: a renamed storage key that loses every saved
// setting, a note keyed by something that is not permanent, a second file that
// quietly starts calling the network. A normal unit test says "this function
// works". These say "this decision still holds". When one fails, read the ADR
// it names before you change the test.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { DOCUMENT_PATH, RECORD_MAPS, SCHEMA_VERSION, migrate } from "./boardDocument.js";
import { DEFAULT_REFRESH, OFF } from "./refresh.js";
import { SORT_OPTIONS, reviewSortId } from "./sorting.js";
import { buildSearch, readStateFromSearch } from "./urlState.js";
import { COLUMN_IDS } from "./columns.js";
import { KIND_FILTERS } from "./filters.js";
import { normalizeWorkItem } from "./workItems.js";
import { REQUIRED_PERMISSIONS } from "./permissions.js";
import { LEGACY_KEYS, STORAGE_KEYS } from "./settings.js";
import { PLACEHOLDERS } from "./copyActions.js";

const FOLDER = import.meta.dir;
const sourceFiles = readdirSync(FOLDER).filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"));
const read = (name) => readFileSync(join(FOLDER, name), "utf8");

/** Each `@media (prefers-reduced-motion...)` block, by its own braces. */
function reducedMotionBlocks(css) {
  const blocks = [];
  for (const match of css.matchAll(/@media[^{]*prefers-reduced-motion[^{]*\{/g)) {
    let depth = 1;
    let at = match.index + match[0].length;
    while (at < css.length && depth > 0) {
      if (css[at] === "{") depth += 1;
      if (css[at] === "}") depth -= 1;
      at += 1;
    }
    blocks.push(css.slice(match.index, at));
  }
  return blocks;
}

describe("the note key is permanent (ADR 0002)", () => {
  test("a note is keyed by the GitHub node id, never by repository and number", () => {
    const raw = { node_id: "I_permanent", number: 42, title: "t", html_url: "u" };
    expect(normalizeWorkItem(raw).key).toBe("I_permanent");
    expect(normalizeWorkItem(raw).key).not.toContain("42");
  });

  test("an issue moved to another repository keeps the key its note is filed under", () => {
    const before = normalizeWorkItem({ node_id: "I_permanent", number: 42, repository: { full_name: "me/old" } });
    const after = normalizeWorkItem({ node_id: "I_permanent", number: 7, repository: { full_name: "me/new" } });
    expect(after.key).toBe(before.key);
  });
});

describe("the stored document (ADR 0002)", () => {
  test("the storage keys are exactly these, because renaming one loses the saved value", () => {
    expect(STORAGE_KEYS).toEqual({
      tokens: "github-work-board.tokens",
      dataRepo: "github-work-board.dataRepo",
      lastCounts: "github-work-board.lastCounts",
      autoRefresh: "github-work-board.autoRefresh",
    });
  });

  // The one-token version of the board wrote these two, and `readTokens` still
  // reads them so that nobody has to set the board up again. Dropping the
  // migration strands every reader who connected before the change.
  test("the keys the one-token version wrote are still read", () => {
    expect(LEGACY_KEYS).toEqual({
      token: "github-work-board.token",
      grantedPermissions: "github-work-board.grantedPermissions",
    });
  });

  test("the file name in the data repository never changes", () => {
    expect(DOCUMENT_PATH).toBe("board.json");
  });

  test("the schema version only ever goes up", () => {
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  // Additive only. A build that drops a map it does not know about deletes the
  // work of every newer build the moment an older tab saves.
  test("migrate keeps every record map, including ones it has never heard of", () => {
    const doc = migrate({ schemaVersion: 99, invented: { a: { updatedAt: "2026-01-01T00:00:00.000Z" } } }, "now");
    expect(doc.invented).toBeDefined();
    for (const map of RECORD_MAPS) expect(doc[map]).toBeDefined();
  });
});

// The one failure that reaches the reader as a blank page.
//
// `app.js` and `gateway.js` have no unit tests by design: anything worth a test
// belongs in a pure module. So nothing ever loaded them, a syntax error in
// either passed every test, and the browser then refused the whole module and
// left every button dead. A parse is not a test of behaviour; it is the floor
// under one (ADR 0003).
describe("every file the browser loads can be parsed", () => {
  test("every source file parses", () => {
    const transpiler = new Bun.Transpiler({ loader: "js" });
    for (const name of sourceFiles) {
      expect(`${name} parses`).toBe(
        (() => {
          try {
            transpiler.scan(read(name));
            return `${name} parses`;
          } catch (error) {
            return `${name} does NOT parse: ${error.message}`;
          }
        })(),
      );
    }
  });
});

describe("the shape of the project (ADR 0001, ADR 0003)", () => {
  // One file touches the network. That is what makes every other module pure,
  // testable without a browser, and unable to leak the token by accident.
  test("only gateway.js calls the network", () => {
    const callers = sourceFiles.filter((name) => name !== "gateway.js" && /\bfetch\s*\(/.test(read(name)));
    expect(callers).toEqual([]);
  });

  // Reaching for localStorage directly is how a value ends up stored under a
  // key nothing else knows about, and how a module stops being testable.
  test("only settings.js touches localStorage", () => {
    const callers = sourceFiles.filter((name) => name !== "settings.js" && /localStorage/.test(read(name)));
    expect(callers).toEqual([]);
  });

  test("the token key appears in one file only", () => {
    const holders = sourceFiles.filter((name) => read(name).includes(STORAGE_KEYS.tokens));
    expect(holders).toEqual(["settings.js"]);
  });

  // Root ADR 0002 and the web-projects rule: a project imports nothing from
  // outside its own folder, and loads nothing from a CDN.
  test("nothing is imported from outside this folder", () => {
    for (const name of sourceFiles) {
      expect(read(name)).not.toMatch(/from\s+["']\.\.\//);
      expect(read(name)).not.toMatch(/from\s+["']https?:/);
    }
  });
});

describe("the token never leaves the browser except toward GitHub (ADR 0001)", () => {
  test("no module writes the token into the address bar", () => {
    for (const name of sourceFiles) {
      const source = read(name);
      expect(source).not.toMatch(/(searchParams|URLSearchParams)[\s\S]{0,80}token/i);
    }
  });

  test("gateway.js sends it to api.github.com and nowhere else", () => {
    const hosts = [...read("gateway.js").matchAll(/https?:\/\/([a-z0-9.-]+)/g)].map((match) => match[1]);
    expect([...new Set(hosts)]).toEqual(["api.github.com"]);
  });
});

// Cheap to delete, and the damage is invisible: the board keeps working, every
// test stays green, and the reader simply sees an answer that is up to a minute
// old. That is the failure this project exists to prevent (ADR 0003).
describe("the browser never answers for GitHub (ADR 0025)", () => {
  // GitHub answers an authenticated call with `Cache-Control: max-age=60`. With
  // no `cache` option the browser serves its own copy for that minute, so a
  // board refreshing every 30 seconds shows the same answer twice.
  test("every call asks GitHub, rather than reading the browser's own copy", () => {
    const source = read("gateway.js");
    expect(source).toMatch(/cache:\s*(CACHE_MODE|["']no-cache["'])/);
    expect(source).toContain('"no-cache"');
  });

  // `no-store` would also be fresh, and would cost a full call every time.
  // `no-cache` revalidates with the ETag the browser already holds, and a 304
  // costs nothing against the rate limit. The difference is the whole point.
  test("it revalidates rather than refusing to store", () => {
    expect(read("gateway.js")).not.toMatch(/cache:\s*["']no-store["']/);
  });
});

// Visual work is exempt from TDD (root ADR 0012), and this is not a test of how
// the page looks. It is a test that every part a person can point at answers
// them. The first version of this page shipped with no hover state on any
// button at all, which reads as a dead control, and nothing caught it.
describe("every control answers the pointer and the keyboard (ADR 0004)", () => {
  const css = read("style.css");

  test("each button variant has a hover state", () => {
    const variants = [...css.matchAll(/^\.(button-[a-z]+)\s*\{/gm)].map((match) => match[1]);
    expect(variants.length).toBeGreaterThan(0);
    for (const variant of variants) {
      expect(`${variant} has :hover`).toBe(
        css.includes(`.${variant}:hover`) ? `${variant} has :hover` : `${variant} has NO :hover`,
      );
    }
  });

  test("buttons answer a press and a keyboard focus", () => {
    expect(css).toContain(".button:active");
    expect(css).toContain(".button:focus-visible");
  });

  test("text boxes answer hover and focus", () => {
    expect(css).toContain(".input:hover");
    expect(css).toContain(".input:focus");
  });

  // The header was sticky because the settings screen was taller than a window
  // and the only way out sat at the top of it (ADR 0008). The token guide moved
  // to its own screen (ADR 0018), settings shrank to about a screen, and the
  // header scrolls with the page again (ADR 0023). What still has to hold: the
  // one screen that is still long carries a way back at the end of it.
  test("every screen carries a way back, and the long one carries it twice", () => {
    const page = read("index.html");
    expect(page).toContain('id="view-toggle"');
    expect(page).toContain('id="cancel-add-token"');
  });

  // Without this one rule, every element the page hides with `hidden` and also
  // gives a `display` to stays on screen: an empty filter row, a "clear the
  // filters" button with no filters, a settings button inside settings. The
  // author rule beats the browser's own, and nothing errors.
  test("the hidden attribute actually hides", () => {
    expect(css).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  });

  test("a filter chip answers hover, a press and a keyboard focus", () => {
    expect(css).toContain(".chip:hover");
    expect(css).toContain(".chip:active");
    expect(css).toContain(".chip:focus-visible");
  });

  // Nothing may appear out of nothing after a pause. Every list the board is
  // about to fill draws a placeholder in the shape of what is coming first.
  test("there are placeholders, and they hold still for a reader who asked for less motion", () => {
    expect(css).toContain(".skeleton");
    expect(css).toContain("@keyframes skeleton-sweep");
    const quiet = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(quiet).toContain(".skeleton");
    expect(quiet).toContain("animation: none");
  });

  test("the card's own button and its menu answer hover, a press and a focus", () => {
    expect(css).toContain(".icon-button:hover");
    expect(css).toContain(".icon-button:active");
    expect(css).toContain(".icon-button:focus-visible");
    expect(css).toContain(".menu-item:hover");
    expect(css).toContain(".menu-item:focus-visible");
  });

  // A menu inside a card would be clipped by the columns, which scroll
  // sideways. Only the top layer escapes that (ADR 0012).
  test("the card menu is a popover, so the scrolling columns cannot clip it", () => {
    const page = read("index.html");
    expect(page).toContain('id="card-menu"');
    expect(page).toContain('popover="auto"');
    expect(css).toContain(":popover-open");
  });

  // A finger has no hover, so a button that appears on hover would never appear
  // at all on a phone.
  test("the card's button is always there without a pointer", () => {
    expect(css).toContain("(hover: none)");
  });

  test("the sort dropdown answers hover and focus", () => {
    expect(css).toContain(".select:hover");
    expect(css).toContain(".select:focus-visible");
  });

  test("an issue card answers the pointer and a focus inside it", () => {
    expect(css).toContain(".issue:hover");
    expect(css).toContain(".issue:focus-within");
  });

  // Feedback is not decoration: a reader who asked for less motion still needs
  // to see which control is under the pointer, so only the movement goes.
  test("reduced motion drops the movement and keeps the colours", () => {
    const blocks = reducedMotionBlocks(css);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((block) => block.includes("transition-duration"))).toBe(true);
    // Read the blocks themselves, not the rest of the file after them. The
    // first version sliced to the end and failed on the next rule anybody
    // appended, which says nothing about this decision.
    for (const block of blocks) expect(block).not.toContain(":hover");
  });
});

describe("a sort order named in a link keeps its name (ADR 0006)", () => {
  // The chosen order travels in the address bar, so a renamed id silently
  // breaks every link anybody saved or shared.
  test("these are the orders, and an id is never renamed", () => {
    expect(SORT_OPTIONS.map((option) => option.id).sort()).toEqual([
      "created-asc",
      "created-desc",
      "label",
      "noted-first",
      "repository",
      "smart",
      "title",
      "updated-asc",
      "updated-desc",
    ]);
  });
});

// Both halves of this are one line each in `app.js`, and both fail silently:
// widen the guard and an order named after a date stops giving a date order,
// drop the pass and the mark quietly becomes decoration.
describe("only the smart order moves a card the reader pushed down (ADR 0026)", () => {
  const source = read("app.js");

  test("the sink runs behind the same guard as the stack pass (ADR 0016)", () => {
    const guarded = /state\.sortId === "smart"[\s\S]{0,240}sinkLowPriority/;
    expect(source).toMatch(guarded);
  });

  // The bug this caught, in the pass that added the rule: a doc comment written
  // between `.column` and `.issue[data-priority="low"]` collapsed to nothing, so
  // the rule silently became `.column .issue[...]` and a marked review card
  // never faded. Nothing failed, because CSS has no test (root ADR 0012).
  test("the faint card fades outside a column too, so the review row fades", () => {
    const selectors = [...read("style.css").matchAll(/([^{}]*data-priority[^{}]*)\{/g)].map((match) =>
      match[1].replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    );
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      for (const one of selector.split(",")) expect(one.trim().startsWith(".issue")).toBe(true);
    }
  });

  // Fainter is not an order, so it is the one half that every order gets.
  test("the faint card is drawn whatever the order", () => {
    expect(source).toMatch(/data-priority/);
    const paints = source.slice(source.indexOf("card.className = \"issue\""), source.indexOf("data-priority") + 200);
    expect(paints).not.toContain("sortId");
  });
});

// The reader can choose dark on a light machine (ADR 0024). A rule written
// only inside the media query never reaches them, and the page stays half
// light: the ground is dark and the badge on it keeps its light colour.
// Nothing errors, and it is invisible unless somebody sets both the other way
// round.
describe("a dark rule reaches the reader who chose dark (ADR 0024)", () => {
  test("every dark block also answers the explicit choice", () => {
    const css = read("style.css");
    const blocks = [...css.matchAll(/@media \(prefers-color-scheme: dark\)\s*\{/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      // The first selector inside the block, which is what the guard sits on.
      const after = css.slice(block.index + block[0].length, block.index + block[0].length + 160);
      expect(after).toContain(':root:not([data-theme="light"])');
    }
  });

  // Each of those has a twin outside the media query, or choosing dark on a
  // dark machine would be the only way to see it.
  test("the explicit choice is answered as often as the machine is asked", () => {
    const css = read("style.css");
    const asked = [...css.matchAll(/:root:not\(\[data-theme="light"\]\)/g)].length;
    const chosen = [...css.matchAll(/:root\[data-theme="dark"\]/g)].length;
    expect(chosen).toBeGreaterThanOrEqual(asked);
  });
});

// This one really happened, and nothing caught it. `applyAutoRefresh` read
// `state.refreshId === DEFAULT_REFRESH` to mean "off", which was true only
// while the default was "off". The day the default became a real schedule, the
// line inverted: no timer on the default, and a useless timer on "off". Every
// test stayed green, because no test runs `app.js` (ADR 0025).
describe("off is not whatever the default happens to be (ADR 0025)", () => {
  test("the page asks whether the schedule is off, never whether it is the default", () => {
    const source = read("app.js");
    expect(source).not.toMatch(/refreshId\s*===\s*DEFAULT_REFRESH/);
    expect(source).toMatch(/refreshId\s*===\s*OFF/);
  });

  test("the two are different values, so the mistake is visible", () => {
    expect(OFF).not.toBe(DEFAULT_REFRESH);
  });
});

// The row shipped without this, and it was invisible because the badge is
// right: a card badged "1 of 3" sat last, and only somebody who read the badges
// noticed the order disagreed with them (ADR 0016).
describe("the review row is ordered by the same rules as a column (ADR 0016, ADR 0026)", () => {
  test("the smart order runs the stack pass on the row, not only on the board", () => {
    const source = read("app.js");
    expect(source).toMatch(/sortId === "smart"[\s\S]{0,160}orderItemsForMerging/);
  });

  // The row drifted away from the columns once already, one pass at a time.
  // Both halves of the smart order run in both places, in the same order:
  // the stacks first, then the cards the reader pushed down.
  test("the row sinks what the reader pushed down, exactly as a column does", () => {
    const source = read("app.js");
    expect(source).toMatch(/sinkLowPriorityItems\(\s*orderItemsForMerging/);
    expect(source).toMatch(/sinkLowPriority\(\s*orderStacksForMerging/);
  });

  // The comparator half of smart is still the date order the row is built
  // from. Only the pass is new.
  test("the row still compares by how long something has waited", () => {
    expect(reviewSortId("smart")).toBe("updated-asc");
  });
});

// Two filters over two different lists, sharing one address bar. A reader
// seeing `?assignee=octocat&reviewer=octocat` must be able to learn from the
// code, not from guesswork, that these narrow two different lists (ADR 0028).
describe("the two person filters keep their names (ADR 0009, ADR 0028)", () => {
  test("assignee narrows the review row, reviewer narrows the board", () => {
    const search = buildSearch({ assignees: ["octocat"], reviewers: ["hubot"] });
    expect(search).toContain("assignee=octocat");
    expect(search).toContain("reviewer=hubot");
    expect(readStateFromSearch(search).assignees).toEqual(["octocat"]);
    expect(readStateFromSearch(search).reviewers).toEqual(["hubot"]);
  });

  // One parameter per person, never a comma-joined value (ADR 0009).
  test("each person is their own parameter", () => {
    expect(buildSearch({ reviewers: ["a", "b"] })).toBe("?reviewer=a&reviewer=b");
  });

  test("the two names are not each other, and not one of the older five", () => {
    const names = ["view", "sort", "kind", "repo", "label", "assignee", "reviewer"];
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("a filter named in a link keeps its name (ADR 0009)", () => {
  // The chosen kind travels in the address bar, so a renamed id silently
  // breaks every link anybody saved.
  test("these are the kinds, and an id is never renamed", () => {
    expect(KIND_FILTERS.map((one) => one.id)).toEqual(["all", "issue", "pull-request"]);
  });

  // The two ids that also name a work item's own kind. Renaming one of these
  // would break the filter and the badge on every card at the same time.
  test("the kind ids match what a work item calls itself", () => {
    expect(normalizeWorkItem({ node_id: "I_x" }).kind).toBe("issue");
    expect(normalizeWorkItem({ node_id: "P_x", pull_request: {} }).kind).toBe("pull-request");
  });
});

// A permission list written twice is a permission list that drifts. The code
// asks GitHub for the access; the page and the README only report what the code
// asks for. ADR 0005.
// A column id is written into board.json the moment a card is moved by hand,
// so it is as permanent as a storage key (ADR 0011).
describe("a column a card was moved to keeps its name (ADR 0011)", () => {
  // The set, not the order: the order is only how they read left to right, and
  // moving one costs nothing. Renaming or dropping one strands every card that
  // was moved into it by hand.
  test("these are the columns, and an id is never renamed or dropped", () => {
    expect([...COLUMN_IDS].sort()).toEqual([
      "awaiting-review",
      "done",
      "needs-changes",
      "ongoing",
      "ready-to-merge",
      "todo",
    ]);
  });

  test("the saved document carries a map for them", () => {
    expect(RECORD_MAPS).toContain("columns");
  });
});

describe("the permission list is written once (ADR 0005)", () => {
  test("the page does not spell out the permissions, it carries the slot the code fills", () => {
    const page = read("index.html");
    expect(page).toContain('class="permissions"');
    for (const permission of REQUIRED_PERMISSIONS) {
      expect(`index.html names ${permission.name}: ${page.includes(`<code>${permission.name}</code>`)}`).toBe(
        `index.html names ${permission.name}: false`,
      );
    }
    expect(page).not.toContain("Read and write");
    expect(page).not.toContain("Read-only");
  });

  // The README is read by a person setting the board up for the first time,
  // before the page can tell them anything.
  test("the README names every permission the code asks for, at the level it asks for", () => {
    const readme = read("README.md");
    for (const permission of REQUIRED_PERMISSIONS) {
      expect(`README covers ${permission.name}`).toBe(
        readme.includes(`\`${permission.name}\` → ${permission.level}`)
          ? `README covers ${permission.name}`
          : `README is MISSING ${permission.name} → ${permission.level}`,
      );
    }
  });

  // The welcome screen and Settings both explain how to make a token. One
  // `<template>`, cloned into every slot, is what stops the two drifting apart
  // (ADR 0008).
  test("the guide for making a token is written once", () => {
    const page = read("index.html");
    expect(page.match(/id="token-guide"/g).length).toBe(1);
    expect(page.match(/class="token-guide-slot"/g).length).toBeGreaterThan(1);
    expect(page.match(/class="permissions"/g).length).toBe(1);
  });

  test("the reader is offered the token page wherever a permission is named", () => {
    expect(read("index.html")).toContain("settings/personal-access-tokens");
    expect(read("README.md")).toContain("settings/personal-access-tokens");
  });
});

// Settings can hand a token back, because GitHub never will. That is a
// deliberate trade and it rests on two things that a tidying pass would remove
// without any test going red (ADR 0015).
describe("handing a token back (ADR 0015)", () => {
  test("the warning stands between the reader and a readable token", () => {
    expect(read("index.html")).toContain('id="token-warning"');
    expect(read("app.js")).toContain("askBeforeShowing");
  });

  // A token belongs in this browser and in a password manager. Writing one
  // into `board.json` would put a live credential in a GitHub repository,
  // where it is copied to every device and kept in the file's history.
  test("a backup is never written to the notes file and never sent anywhere", () => {
    expect(RECORD_MAPS).not.toContain("tokens");
    for (const name of ["gateway.js", "boardDocument.js", "sync.js"]) {
      expect(`${name} knows about backups: ${read(name).includes("Backup")}`).toBe(`${name} knows about backups: false`);
    }
  });
});

// GitHub's own links, not anything read out of a description. The moment this
// is done by reading text, it is wrong for every issue whose description is
// written differently (ADR 0010).
describe("relationships come from GitHub's graph (ADR 0010)", () => {
  test("nothing parses a description looking for a linked issue", () => {
    for (const name of sourceFiles) {
      const source = read(name);
      expect(source).not.toMatch(/\b(closes|fixes|resolves)\s*#/i);
      expect(source).not.toMatch(/body[\s\S]{0,40}match[\s\S]{0,40}#/i);
    }
  });

  test("the relationship query asks GitHub for each kind by name", () => {
    const query = read("gateway.js");
    for (const field of ["parent", "blockedBy", "closedByPullRequestsReferences", "closingIssuesReferences"]) {
      expect(query).toContain(field);
    }
  });

  // Trim either of these from the query and `askedAgain` is false on every
  // card. Nothing errors, every test that builds its own answer stays green,
  // and answered work sits in "Needs changes" for ever (ADR 0011).
  test("the query asks who is waited on and who asked for changes", () => {
    const query = read("gateway.js");
    expect(query).toContain("latestOpinionatedReviews");
    expect(query).toContain("requestedReviewer");
  });
});

describe("the page itself", () => {
  test("carries the deploy stamp block the generator looks for (root ADR 0013)", () => {
    const page = read("index.html");
    expect(page).toContain("<!-- BEGIN GENERATED:DEPLOY -->");
    expect(page).toContain("<!-- END GENERATED:DEPLOY -->");
    expect(page).toContain('id="deploy-line"');
  });
});

// A placeholder is written into board.json the moment the reader saves a line,
// so renaming one silently empties that part of every line they already wrote
// (ADR 0031). The same rule a column id lives under (ADR 0011).
describe("a placeholder the reader typed keeps its name (ADR 0031)", () => {
  test("these are the placeholders, and a name is never changed or dropped", () => {
    expect(PLACEHOLDERS.map((one) => one.token)).toEqual(["{N}", "{URL}", "{TITLE}", "{REPO}", "{BRANCH}"]);
  });

  test("the saved document carries a map for the lines themselves", () => {
    expect(RECORD_MAPS).toContain("copyActions");
  });

  // The rule that decides which line a card offers lives in `cardMenu.js`, with
  // every other row. Three ad-hoc conditions in `app.js` is what ADR 0022 was
  // written to stop, and a fourth would start it again.
  test("app.js asks the menu module which lines a card offers", () => {
    const page = read("app.js");
    expect(page).toContain("cardMenuRows");
    expect(page).not.toContain("canFillTemplate");
  });
});
