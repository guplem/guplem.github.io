// The promises this shared module must not break by accident.
//
// Every test here guards a decision that is cheap to undo without noticing and
// expensive to discover later: a renamed storage key that logs every project
// out at once, a second file that quietly starts calling the network, a token
// that ends up inside a synced file. A normal unit test says "this function
// works". These say "this decision still holds". When one fails, read root
// ADR 0016 before you change the test. This module is imported by many pages,
// so one slip here reaches every one of them.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { DATA_FOLDER, STORAGE_KEYS } from "./cloudSettings.js";
import { SCHEMA_VERSION, emptyDocument, migrate } from "./envelope.js";
import { REQUIRED_PERMISSIONS } from "./cloudPermissions.js";
import { encodeBundle } from "./exportBundle.js";

const FOLDER = import.meta.dir;
const sourceFiles = readdirSync(FOLDER).filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"));
const read = (name) => readFileSync(join(FOLDER, name), "utf8");

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

describe("the stored keys and paths (root ADR 0016)", () => {
  test("the storage keys are exactly these, because renaming one logs every project out", () => {
    expect(STORAGE_KEYS).toEqual({
      token: "triunity-studios.cloud.token",
      repo: "triunity-studios.cloud.repo",
      reconciled: "triunity-studios.cloud.reconciled",
    });
  });

  test("the folder in the repository never changes, because every project's path starts with it", () => {
    expect(DATA_FOLDER).toBe("triunity-studios-data");
  });

  test("the schema version only ever goes up", () => {
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  // Additive only. A build that drops a map it does not know deletes the work
  // of every newer build the moment an older tab saves.
  test("migrate keeps every record map, including ones it has never heard of", () => {
    const doc = migrate({ schemaVersion: 99, invented: { a: { updatedAt: "2026-01-01T00:00:00.000Z" } } }, ["known"], "now");
    expect(doc.invented).toBeDefined();
    expect(doc.known).toBeDefined();
  });
});

describe("the shape of the module (root ADR 0016)", () => {
  // One file touches the network. That is what makes every other module pure,
  // testable without a browser, and unable to leak the token by accident.
  test("only cloudGateway.js calls the network", () => {
    const callers = sourceFiles.filter((name) => name !== "cloudGateway.js" && /\bfetch\s*\(/.test(read(name)));
    expect(callers).toEqual([]);
  });

  test("only cloudSettings.js names localStorage", () => {
    const callers = sourceFiles.filter((name) => name !== "cloudSettings.js" && /localStorage/.test(read(name)));
    expect(callers).toEqual([]);
  });

  test("the token key appears in one file only", () => {
    const holders = sourceFiles.filter((name) => read(name).includes(STORAGE_KEYS.token));
    expect(holders).toEqual(["cloudSettings.js"]);
  });

  // A page that holds a token must load no code it does not own (github-work-board
  // ADR 0001). This module is that code for every page that imports it.
  test("nothing is imported from outside this folder, and nothing from a CDN", () => {
    for (const name of sourceFiles) {
      expect(read(name)).not.toMatch(/from\s+["']\.\.\//);
      expect(read(name)).not.toMatch(/from\s+["']https?:/);
      expect(read(name)).not.toMatch(/import\s*\(\s*["']https?:/);
    }
  });
});

describe("the token never leaves the browser except toward GitHub (github-work-board ADR 0001)", () => {
  test("no module writes the token into the address bar", () => {
    for (const name of sourceFiles) {
      expect(read(name)).not.toMatch(/(searchParams|URLSearchParams)[\s\S]{0,80}token/i);
    }
  });

  test("an export file carries documents, never the token", () => {
    const text = encodeBundle({ exportedAt: "now", projects: { p: { "a.json": emptyDocument([], "now") } } });
    expect(text).not.toMatch(/token/i);
  });
});

describe("the permission list lives in the code (github-work-board ADR 0005)", () => {
  test("every required permission has an id, a level GitHub's form uses, and a reason", () => {
    for (const one of REQUIRED_PERMISSIONS) {
      expect(typeof one.id).toBe("string");
      expect(["Read-only", "Read and write"]).toContain(one.level);
      expect(one.why.length).toBeGreaterThan(0);
    }
  });
});
