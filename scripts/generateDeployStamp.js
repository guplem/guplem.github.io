// Writes the pull request number and date into the pages that show a "deployed
// at" line, inside a `<!-- BEGIN GENERATED:DEPLOY -->` block in the `<head>`
// (root ADR 0010 for the marker convention, root ADR 0013 for the decision).
//
// Run inside a pull request branch, before it merges:
//   bun scripts/generateDeployStamp.js --pr 82 --date 2026-08-29T12:05:00Z
//   bun scripts/generateDeployStamp.js --pr 82 --date 2026-08-29T12:05:00Z --check
//
// `--check` writes nothing and exits non-zero when a page is not stamped with
// those values. The `test` job runs it that way on every pull request, so a
// pull request cannot merge carrying somebody else's number.
//
// Why the number is written into the page rather than fetched at load: a stamp
// inside the file is a property of the file. A browser serving a cached page
// serves that page's own stamp, so the line cannot claim a version the reader is
// not looking at. Root ADR 0013 has the history, including the two bugs the
// fetched version produced.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { injectBlock } from "./generateSeoBlocks.js";

const ROOT = join(import.meta.dir, "..");
/** The one folder that holds pages with a deploy line. */
const PAGES_ROOT = join(ROOT, "web-projects");
const BLOCK = "DEPLOY";
const MARKER = `<!-- BEGIN GENERATED:${BLOCK} -->`;

/**
 * The two meta tags, as they are written into the page.
 * @param {number} pr the pull request number
 * @param {string} date an ISO moment
 */
export function buildDeployBlock(pr, date) {
  return `  <meta name="deploy-pull-request" content="${pr}" />\n  <meta name="deploy-date" content="${date}" />`;
}

/**
 * Stamp one document.
 * @throws {Error} when the marker pair is missing, so a deleted marker fails
 *   loudly instead of dropping the line
 */
export function stampDocument(documentHtml, pr, date) {
  return injectBlock(documentHtml, BLOCK, buildDeployBlock(pr, date));
}

/**
 * Check the arguments before anything is written. A bad number or a bad date
 * would otherwise be stamped into every page and merged.
 * @returns {{pr: number, date: string}}
 */
export function parseArguments(argv) {
  const value = (name) => {
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? null : argv[index + 1];
  };
  const pr = Number(value("pr"));
  const date = value("date");
  if (!Number.isInteger(pr) || pr <= 0) throw new Error("Pass --pr with the pull request number.");
  if (!date || Number.isNaN(new Date(date).getTime())) throw new Error("Pass --date with an ISO moment.");
  return { pr, date: new Date(date).toISOString(), check: argv.includes("--check") };
}

/** Every page under web-projects/ that carries the marker. */
export function findStampedPages(root = PAGES_ROOT) {
  const pages = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html") && readFileSync(full, "utf8").includes(MARKER)) pages.push(full);
    }
  };
  walk(root);
  return pages.sort();
}

if (import.meta.main) {
  const { pr, date, check } = parseArguments(process.argv.slice(2));
  const pages = findStampedPages();
  if (pages.length === 0) {
    console.error(`No page carries the ${MARKER} marker. Nothing to stamp.`);
    process.exit(1);
  }
  const stale = [];
  for (const page of pages) {
    const before = readFileSync(page, "utf8");
    const after = stampDocument(before, pr, date);
    if (after === before) continue;
    if (check) stale.push(page);
    else writeFileSync(page, after);
  }
  if (check && stale.length > 0) {
    console.error(`These pages are not stamped with pull request #${pr} of ${date}:`);
    for (const page of stale) console.error(`  ${page.replace(`${ROOT}/`, "")}`);
    console.error(`\nRun: bun scripts/generateDeployStamp.js --pr ${pr} --date ${date}`);
    console.error("Then commit the change. It is what puts the right number in the page footer.");
    process.exit(1);
  }
  if (!check) console.log(`Stamped ${pages.length} page(s) with pull request #${pr} of ${date}.`);
}
