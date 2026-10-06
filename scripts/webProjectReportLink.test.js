// Guard test: a "Report a problem" link in a web-project names its own project.
//
// The link opens the repository's issue form with the project field filled in
// from the address. The likely mistake is a link copied from another project
// with its folder name left unchanged, which files every report against the
// wrong project and fails nowhere else. See "Report a problem" in
// web-projects/AGENTS.md.

import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

// Resolve relative to this test file, not the working directory, so the test
// passes no matter where `bun test` is invoked from.
const repoRoot = join(import.meta.dir, "..");
const webProjectsDir = join(repoRoot, "web-projects");
const issueFormPath = join(repoRoot, ".github", "ISSUE_TEMPLATE", "web-project.yml");
const ISSUE_FORM_LINK = "https://github.com/guplem/guplem.github.io/issues/new?template=web-project.yml";

/**
 * List every .html file under a directory, skipping dependency folders.
 * @param {string} directory absolute directory to walk
 * @returns {string[]} absolute paths of the HTML files found
 */
function findHtmlFiles(directory) {
  const htmlFiles = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) htmlFiles.push(...findHtmlFiles(entryPath));
    else if (entry.name.endsWith(".html")) htmlFiles.push(entryPath);
  }
  return htmlFiles;
}

/**
 * Every link in a page that opens the web-project issue form.
 * @param {string} html the page source
 * @returns {URL[]} the links, with `&amp;` read back as `&`
 */
function findReportLinks(html) {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  return hrefs.filter((href) => href.startsWith(ISSUE_FORM_LINK)).map((href) => new URL(href));
}

describe("the web-project issue form", () => {
  // Every link fills this field in by its id, so renaming the id breaks every
  // link at once, and GitHub then opens the form with the field empty.
  it("has a field with the id `project`", () => {
    const form = readFileSync(issueFormPath, "utf8");
    expect(form).toMatch(/^\s*id: project\s*$/m);
  });
});

describe("every report link names the web-project that it is in", () => {
  for (const htmlFile of findHtmlFiles(webProjectsDir)) {
    const links = findReportLinks(readFileSync(htmlFile, "utf8"));
    if (links.length === 0) continue;
    const projectFolder = relative(webProjectsDir, htmlFile).split(sep)[0];
    it(relative(repoRoot, htmlFile).replaceAll("\\", "/"), () => {
      for (const link of links) {
        expect(link.searchParams.get("project")).toBe(projectFolder);
        expect(link.searchParams.get("title")).toStartWith(`[${projectFolder}]`);
      }
    });
  }
});

describe("the projects that carry the link", () => {
  // The first adopter. A new web-project adds the link from the start (see
  // the add-web-project skill).
  it("github-work-board", () => {
    const html = readFileSync(join(webProjectsDir, "github-work-board", "index.html"), "utf8");
    expect(findReportLinks(html).length).toBeGreaterThan(0);
  });
});
