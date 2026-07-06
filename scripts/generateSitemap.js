// Generates sitemap.xml from the portfolio data, so crawlers can discover
// every locally hosted web-project without executing JavaScript (root ADR 0014).
//
// Run: bun scripts/generateSitemap.js
//
// The builder is pure (no I/O) so generateSitemap.test.js can drift-check the
// committed sitemap.xml against it; the write happens only when this file is
// the entry point (import.meta.main).

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { localWebProjectPath, sortByDateDescending } from "../web-projects/discovery.js";
import { loadWorks } from "./portfolioData.js";

const SITE_ORIGIN = "https://triunitystudios.com";

/**
 * Build the sitemap.xml contents: the homepage, the web-projects index, and
 * one URL per locally hosted web-project (newest first, deduplicated).
 * @param {any[]} works the parsed portfolio projects
 * @returns {string} the full XML document
 */
export function buildSitemapXml(works) {
  const urls = [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/web-projects/`];
  const seen = new Set(urls);

  for (const work of sortByDateDescending(works)) {
    const path = localWebProjectPath(work);
    if (!path) continue;
    const url = `${SITE_ORIGIN}/web-projects/${path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  const entries = urls.map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`).join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- GENERATED FILE - do not edit by hand. Regenerate with: bun scripts/generateSitemap.js (root ADR 0014) -->`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    entries,
    `</urlset>`,
    ``,
  ].join("\n");
}

if (import.meta.main) {
  const repoRoot = join(import.meta.dir, "..");
  const xml = buildSitemapXml(loadWorks(repoRoot));
  writeFileSync(join(repoRoot, "sitemap.xml"), xml);
  console.log(`sitemap.xml regenerated (${xml.split("<loc>").length - 1} URLs)`);
}
