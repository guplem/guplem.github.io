// Generates the machine-readable head block of every web-project page: a
// JSON-LD WebApplication description (schema.org, read by search engines) and
// the Open Graph tags (read by WhatsApp, LinkedIn, X and others to draw a link
// preview). Both are written between `<!-- BEGIN GENERATED:WEB-PROJECT-META -->`
// / `<!-- END GENERATED:WEB-PROJECT-META -->` in the page's <head> (root ADR
// 0010), from the project's data/projects/*.json, so the page and the
// portfolio card never disagree.
//
// Run: bun scripts/generateWebProjectMeta.js
//
// The builders are pure (no I/O) so generateWebProjectMeta.test.js can
// drift-check every committed page; the writes happen only when this file is
// the entry point (import.meta.main).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { markdownToPlainText } from "../js/utils/textCore.js";
import { localWebProjectPath, teaserMarkdown } from "../web-projects/discovery.js";
import { escapeHtml, injectBlock } from "./generateSeoBlocks.js";
import { loadInfo, loadWorks } from "./portfolioData.js";

const SITE_ORIGIN = "https://triunitystudios.com";
const BLOCK = "WEB-PROJECT-META";

/**
 * Make a data/ image path absolute, because link previews and search engines
 * read the URL outside the page. Full URLs pass through unchanged.
 * @param {string} image
 * @returns {string}
 */
function absoluteImageUrl(image) {
  return /^https?:\/\//i.test(image) ? image : `${SITE_ORIGIN}/${image.replace(/^\/+/, "")}`;
}

/**
 * The head block for one web-project page.
 * @param {{ types?: string[], title: string, description?: string[], image?: string, imageAlt?: string, links?: Array<{ url?: string, type?: string }> }} work
 * @param {{ name: string }} info the site info (data/info.json); only the name is read
 * @returns {string}
 */
export function buildWebProjectMetaHtml(work, info) {
  const url = `${SITE_ORIGIN}/web-projects/${localWebProjectPath(work)}`;
  const description = markdownToPlainText(teaserMarkdown(work)).replace(/\s+/g, " ").trim();
  const image = work.image ? absoluteImageUrl(work.image) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: work.title,
    url,
    description,
    ...(image ? { image } : {}),
    // Google's software vocabulary has no "general web tool" value; every
    // non-game here is a small utility or experiment.
    applicationCategory: (work.types || []).includes("Videogame") ? "GameApplication" : "UtilitiesApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    author: { "@type": "Person", name: info.name, url: `${SITE_ORIGIN}/` },
  };
  // A literal "<" inside the JSON could close the <script> early; < is
  // the same character to a JSON parser.
  const jsonText = JSON.stringify(jsonLd, null, 2).replace(/</g, "\\u003c").replace(/\n/g, "\n  ");

  const lines = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(work.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
  ];
  if (image) {
    lines.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
    if (work.imageAlt) lines.push(`<meta property="og:image:alt" content="${escapeHtml(work.imageAlt)}" />`);
  }
  lines.push(`<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`);
  lines.push(`<script type="application/ld+json">\n  ${jsonText}\n  </script>`);
  return lines.map((line) => `  ${line}`).join("\n");
}

/**
 * Every local web-project, paired with the page file that carries its block
 * (relative to the repository root). A path ending in "/" means its index.html.
 * @param {any[]} works the portfolio projects
 * @returns {Array<{ file: string, work: any }>}
 */
export function webProjectPages(works) {
  const pages = [];
  for (const work of works) {
    const path = localWebProjectPath(work);
    if (!path) continue;
    const pagePath = path.endsWith("/") ? `${path}index.html` : path;
    pages.push({ file: `web-projects/${pagePath}`, work });
  }
  return pages;
}

if (import.meta.main) {
  const repoRoot = join(import.meta.dir, "..");
  const info = loadInfo(repoRoot);
  for (const { file, work } of webProjectPages(loadWorks(repoRoot))) {
    const fullPath = join(repoRoot, file);
    const documentHtml = readFileSync(fullPath, "utf8");
    writeFileSync(fullPath, injectBlock(documentHtml, BLOCK, buildWebProjectMetaHtml(work, info)));
  }
  console.log("Web-project head blocks regenerated.");
}
