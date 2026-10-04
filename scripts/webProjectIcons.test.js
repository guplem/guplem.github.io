// Guard test: every web-project page declares a tab icon. Without a
// <link rel="icon">, the browser asks for /favicon.ico, which does not exist on
// this site, so the tab shows no icon at all.

import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

// Resolve relative to this test file, not the working directory, so the test
// passes no matter where `bun test` is invoked from.
const repoRoot = join(import.meta.dir, "..");
const webProjectsDir = join(repoRoot, "web-projects");

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

describe("every web-project page has a tab icon", () => {
  for (const htmlFile of findHtmlFiles(webProjectsDir)) {
    it(relative(repoRoot, htmlFile).replaceAll("\\", "/"), () => {
      const html = readFileSync(htmlFile, "utf8");
      const linkTags = html.match(/<link[^>]*>/g) ?? [];
      const iconLink = linkTags.find((tag) => /rel="[^"]*\bicon\b[^"]*"/.test(tag));
      expect(iconLink).toBeDefined();

      // A file href must point at a file that exists; an inline data: icon
      // needs no file.
      const href = iconLink.match(/href="([^"]+)"/)?.[1];
      expect(href).toBeDefined();
      if (!href.startsWith("data:")) {
        expect(existsSync(join(dirname(htmlFile), href))).toBe(true);
      }
    });
  }
});
