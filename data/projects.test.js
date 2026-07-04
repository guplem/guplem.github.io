// Validates the portfolio data files against the project schema.
//
// The site fetches data/projects/*.json and renders it client-side with no
// runtime validation (deliberately -- see the "Deferred" note in the plan and
// root ADR 0002 "No build system"). This test is the safety net instead: it
// hand-enforces every constraint in data/schemas/project.schema.json plus the
// manifest/disk consistency the schema cannot express, so a malformed data
// file fails CI before it can merge and break the works grid.
//
// It is a plain Bun test (no dependency -- no ajv, per root ADR 0002); the
// validator mirrors the schema BY HAND. When a field is added to the schema,
// the allowed-key set and type checks below must be updated in the same change.

import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Resolve relative to this test file, not the working directory, so the test
// passes no matter where `bun test` is invoked from.
const projectsDir = join(import.meta.dir, "projects");
const manifestFile = "index.json";

// The exact set of keys the schema allows on a project object
// (additionalProperties: false). Keep in sync with project.schema.json.
const ALLOWED_PROJECT_KEYS = new Set([
  "$schema",
  "types",
  "date",
  "title",
  "description",
  "skills",
  "image",
  "imageStretched",
  "imageAlt",
  "links",
]);

// The keys required on every project object (schema "required").
const REQUIRED_PROJECT_KEYS = ["types", "date", "title", "description", "skills"];

// The keys a single links[] entry may have (link "additionalProperties": false).
const ALLOWED_LINK_KEYS = new Set(["type", "url"]);

// The exact type values used across the data. Extending this list is a
// deliberate decision (a genuinely new project category) -- see data/CLAUDE.md.
// "Misceallaneous" is intentional legacy spelling.
const ALLOWED_TYPES = new Set(["Web", "Mobile App", "Videogame", "Misceallaneous", "Minecraft"]);

/**
 * The project data filenames physically present in data/projects/, excluding
 * the manifest itself.
 *
 * @returns {string[]} sorted list of "<slug>.json" filenames
 */
function projectFilesOnDisk() {
  return readdirSync(projectsDir)
    .filter((name) => name.endsWith(".json") && name !== manifestFile)
    .sort();
}

/**
 * Read and JSON.parse a file inside data/projects/.
 *
 * @param {string} filename a filename inside data/projects/ (e.g. "index.json")
 * @returns {unknown} the parsed JSON value
 */
function readJson(filename) {
  return JSON.parse(readFileSync(join(projectsDir, filename), "utf8"));
}

/**
 * True when the value is an array of length >= 1 whose every element is a
 * string. Used for the non-empty string-array fields (types/description/skills).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length >= 1 && value.every((item) => typeof item === "string");
}

/**
 * Collect every schema-conformance problem for one project object, as
 * human-readable strings prefixed with the filename.
 *
 * @param {string} filename the "<slug>.json" file the object came from
 * @param {Record<string, unknown>} project the parsed project object
 * @returns {string[]} problem descriptions (empty when the file is valid)
 */
function schemaProblems(filename, project) {
  const problems = [];

  if (typeof project !== "object" || project === null || Array.isArray(project)) {
    return [`${filename}: root value must be a JSON object`];
  }

  // Required keys present.
  for (const key of REQUIRED_PROJECT_KEYS) {
    if (!(key in project)) {
      problems.push(`${filename}: missing required "${key}"`);
    }
  }

  // No keys outside the allowed set.
  for (const key of Object.keys(project)) {
    if (!ALLOWED_PROJECT_KEYS.has(key)) {
      problems.push(`${filename}: unexpected key "${key}"`);
    }
  }

  // Non-empty string arrays: types, description, skills.
  for (const key of ["types", "description", "skills"]) {
    if (key in project && !isNonEmptyStringArray(project[key])) {
      problems.push(`${filename}: "${key}" must be a non-empty array of strings`);
    }
  }

  // Plain string fields.
  for (const key of ["date", "title", "image", "imageAlt"]) {
    if (key in project && typeof project[key] !== "string") {
      problems.push(`${filename}: "${key}" must be a string`);
    }
  }

  // Boolean field.
  if ("imageStretched" in project && typeof project.imageStretched !== "boolean") {
    problems.push(`${filename}: "imageStretched" must be a boolean`);
  }

  // links: array of objects, each with a string url and only type/url keys.
  if ("links" in project) {
    if (!Array.isArray(project.links)) {
      problems.push(`${filename}: "links" must be an array`);
    } else {
      project.links.forEach((link, index) => {
        if (typeof link !== "object" || link === null || Array.isArray(link)) {
          problems.push(`${filename}: links[${index}] must be an object`);
          return;
        }
        if (typeof link.url !== "string") {
          problems.push(`${filename}: links[${index}] missing required string "url"`);
        }
        for (const key of Object.keys(link)) {
          if (!ALLOWED_LINK_KEYS.has(key)) {
            problems.push(`${filename}: links[${index}] has unexpected key "${key}"`);
          }
        }
      });
    }
  }

  return problems;
}

describe("portfolio project data", () => {
  const filesOnDisk = projectFilesOnDisk();

  it("keeps the manifest and the folder in sync", () => {
    const problems = [];
    const manifest = readJson(manifestFile);

    if (!Array.isArray(manifest.projects)) {
      problems.push(`${manifestFile}: "projects" must be an array`);
    } else {
      const manifestEntries = manifest.projects;

      // No duplicate manifest entries.
      const seen = new Set();
      for (const entry of manifestEntries) {
        if (seen.has(entry)) {
          problems.push(`${manifestFile}: duplicate entry "${entry}"`);
        }
        seen.add(entry);
      }

      // Every manifest entry exists on disk.
      const onDisk = new Set(filesOnDisk);
      for (const entry of manifestEntries) {
        if (!onDisk.has(entry)) {
          problems.push(`${manifestFile}: entry "${entry}" has no matching file on disk`);
        }
      }

      // Every file on disk appears in the manifest.
      for (const file of filesOnDisk) {
        if (!seen.has(file)) {
          problems.push(`${file}: file on disk is missing from ${manifestFile}`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("parses every project file as valid JSON", () => {
    const problems = [];
    for (const file of filesOnDisk) {
      try {
        readJson(file);
      } catch (error) {
        problems.push(`${file}: invalid JSON -- ${error.message}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("conforms to the project schema", () => {
    const problems = [];
    for (const file of filesOnDisk) {
      let project;
      try {
        project = readJson(file);
      } catch {
        // JSON validity is covered by its own test; skip parse failures here.
        continue;
      }
      problems.push(...schemaProblems(file, project));
    }
    expect(problems).toEqual([]);
  });

  it("uses only known type values", () => {
    const problems = [];
    for (const file of filesOnDisk) {
      let project;
      try {
        project = readJson(file);
      } catch {
        continue;
      }
      if (!Array.isArray(project.types)) continue;
      for (const type of project.types) {
        if (!ALLOWED_TYPES.has(type)) {
          problems.push(`${file}: unknown type "${type}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("has no repeated entries within a file's types or skills", () => {
    const problems = [];
    for (const file of filesOnDisk) {
      let project;
      try {
        project = readJson(file);
      } catch {
        continue;
      }
      for (const key of ["types", "skills"]) {
        if (!Array.isArray(project[key])) continue;
        const seen = new Set();
        for (const entry of project[key]) {
          if (seen.has(entry)) {
            problems.push(`${file}: repeated "${entry}" in ${key}`);
          }
          seen.add(entry);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
