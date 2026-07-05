// Shared disk readers for the generator scripts (run with Bun, never in the
// browser). They read the same JSON the site fetches at runtime, using the
// manifest-driven approach of data/projects.test.js, so generators and site
// always agree on the data source.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Read and parse the site info file (data/info.json).
 * @param {string} repoRoot absolute path to the repository root
 * @returns {any} the parsed info object
 */
export function loadInfo(repoRoot) {
  return JSON.parse(readFileSync(join(repoRoot, "data", "info.json"), "utf8"));
}

/**
 * Load every portfolio project, in manifest order (data/projects/index.json).
 * @param {string} repoRoot absolute path to the repository root
 * @returns {any[]} the parsed project objects
 */
export function loadWorks(repoRoot) {
  const projectsDir = join(repoRoot, "data", "projects");
  const manifest = JSON.parse(readFileSync(join(projectsDir, "index.json"), "utf8"));
  return manifest.projects.map((file) => JSON.parse(readFileSync(join(projectsDir, file), "utf8")));
}
