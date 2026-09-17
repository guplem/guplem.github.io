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
import { normalizeIssue } from "./issues.js";
import { REQUIRED_PERMISSIONS } from "./permissions.js";
import { STORAGE_KEYS } from "./settings.js";

const FOLDER = import.meta.dir;
const sourceFiles = readdirSync(FOLDER).filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"));
const read = (name) => readFileSync(join(FOLDER, name), "utf8");

describe("the note key is permanent (ADR 0002)", () => {
  test("a note is keyed by the GitHub node id, never by repository and number", () => {
    const raw = { node_id: "I_permanent", number: 42, title: "t", html_url: "u" };
    expect(normalizeIssue(raw).key).toBe("I_permanent");
    expect(normalizeIssue(raw).key).not.toContain("42");
  });

  test("an issue moved to another repository keeps the key its note is filed under", () => {
    const before = normalizeIssue({ node_id: "I_permanent", number: 42, repository: { full_name: "me/old" } });
    const after = normalizeIssue({ node_id: "I_permanent", number: 7, repository: { full_name: "me/new" } });
    expect(after.key).toBe(before.key);
  });
});

describe("the stored document (ADR 0002)", () => {
  test("the storage keys are exactly these, because renaming one loses the saved value", () => {
    expect(STORAGE_KEYS).toEqual({
      token: "github-work-board.token",
      dataRepo: "github-work-board.dataRepo",
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
    const holders = sourceFiles.filter((name) => read(name).includes(STORAGE_KEYS.token));
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

  test("an issue card answers the pointer and a focus inside it", () => {
    expect(css).toContain(".issue:hover");
    expect(css).toContain(".issue:focus-within");
  });

  // Feedback is not decoration: a reader who asked for less motion still needs
  // to see which control is under the pointer, so only the movement goes.
  test("reduced motion drops the movement and keeps the colours", () => {
    expect(css).toContain("prefers-reduced-motion");
    const block = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(block).toContain("transition-duration");
    expect(block).not.toContain(":hover");
  });
});

// A permission list written twice is a permission list that drifts. The code
// asks GitHub for the access; the page and the README only report what the code
// asks for. ADR 0005.
describe("the permission list is written once (ADR 0005)", () => {
  test("the page does not spell out the permissions, it carries the slot the code fills", () => {
    const page = read("index.html");
    expect(page).toContain('id="permissions"');
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

  test("the reader is offered the token page wherever a permission is named", () => {
    expect(read("index.html")).toContain("settings/personal-access-tokens");
    expect(read("README.md")).toContain("settings/personal-access-tokens");
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
