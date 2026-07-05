// Unit tests for the sitemap builder, plus the drift guard: CI fails when the
// portfolio data changes without regenerating sitemap.xml
// (fix: bun scripts/generateSitemap.js).

import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSitemapXml } from "./generateSitemap.js";
import { loadWorks } from "./portfolioData.js";

// Resolve relative to this test file, not the working directory, so the test
// passes no matter where `bun test` is invoked from.
const repoRoot = join(import.meta.dir, "..");

/**
 * Normalize Windows line endings so drift checks compare content, not EOL
 * (a checkout with core.autocrlf=true may smudge committed files to CRLF).
 * @param {string} text
 * @returns {string}
 */
function normalizeEol(text) {
  return text.replace(/\r\n/g, "\n");
}

describe("buildSitemapXml", () => {
  const localProject = {
    title: "Local Game",
    date: "2026",
    links: [{ url: "web-projects/local-game/" }, { type: "github", url: "https://github.com/guplem/x/tree/main/web-projects/local-game" }],
  };
  const absoluteUrlProject = {
    title: "Older Local Tool",
    date: "2020",
    links: [{ url: "https://triunitystudios.com/web-projects/older-tool/page.html" }],
  };
  const externalProject = {
    title: "External Site",
    date: "2024",
    links: [{ url: "https://example.com/" }],
  };
  const githubOnlyProject = {
    title: "Source Only",
    date: "2023",
    links: [{ type: "github", url: "https://github.com/guplem/x/tree/main/web-projects/source-only" }],
  };

  it("always lists the homepage and the web-projects index first", () => {
    const xml = buildSitemapXml([]);
    const locs = xml.match(/<loc>[^<]*<\/loc>/g);
    expect(locs).toEqual(["<loc>https://triunitystudios.com/</loc>", "<loc>https://triunitystudios.com/web-projects/</loc>"]);
  });

  it("includes locally hosted web-projects, from relative and own-domain absolute links", () => {
    const xml = buildSitemapXml([localProject, absoluteUrlProject]);
    expect(xml).toContain("<loc>https://triunitystudios.com/web-projects/local-game/</loc>");
    expect(xml).toContain("<loc>https://triunitystudios.com/web-projects/older-tool/page.html</loc>");
  });

  it("orders project URLs newest first", () => {
    const xml = buildSitemapXml([absoluteUrlProject, localProject]);
    expect(xml.indexOf("local-game")).toBeLessThan(xml.indexOf("older-tool"));
  });

  it("excludes external-only and github-only projects", () => {
    const xml = buildSitemapXml([externalProject, githubOnlyProject]);
    expect(xml).not.toContain("example.com");
    expect(xml).not.toContain("source-only");
  });

  it("deduplicates repeated URLs", () => {
    const xml = buildSitemapXml([localProject, { ...localProject, title: "Duplicate" }]);
    expect(xml.split("web-projects/local-game/").length - 1).toBe(1);
  });
});

describe("sitemap.xml drift", () => {
  it("matches the committed sitemap.xml (fix: bun scripts/generateSitemap.js)", () => {
    const committed = normalizeEol(readFileSync(join(repoRoot, "sitemap.xml"), "utf8"));
    expect(buildSitemapXml(loadWorks(repoRoot))).toBe(committed);
  });
});
