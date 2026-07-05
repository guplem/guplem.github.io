// Generates the crawler-facing static HTML fallback blocks inside index.html
// and web-projects/index.html, between `<!-- BEGIN GENERATED:<NAME> -->` /
// `<!-- END GENERATED:<NAME> -->` marker comments (root ADR 0014). The JSON in
// data/ stays the single hand-edited source of truth; these blocks are a
// derived mirror so crawlers see the content without executing JavaScript.
// The JS app clears each block and renders the dynamic version at load time.
//
// Run: bun scripts/generateSeoBlocks.js
//
// The builders are pure (no I/O) so generateSeoBlocks.test.js can drift-check
// the committed HTML against them; the writes happen only when this file is
// the entry point (import.meta.main).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { markdownToPlainText, capitalizeFirstLetter } from "../js/utils/textCore.js";
import { selectWebProjects, sortByDateDescending } from "../web-projects/discovery.js";
import { loadInfo, loadWorks } from "./portfolioData.js";

/**
 * Escape a string for safe use as HTML text or attribute content.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Markdown to escaped single-line plain text (newline runs become one space).
 * @param {string} markdown
 * @returns {string}
 */
function plainLine(markdown) {
  return escapeHtml(markdownToPlainText(markdown).replace(/\s+/g, " "));
}

/**
 * Replace the content between the GENERATED marker pair for a block. Throws
 * when the pair is missing so a renamed/deleted marker fails loudly instead of
 * silently dropping the block.
 * @param {string} documentHtml the full HTML document
 * @param {string} blockName the marker name (e.g. "HERO")
 * @param {string} blockHtml the new content to place between the markers
 * @returns {string} the updated HTML document
 */
export function injectBlock(documentHtml, blockName, blockHtml) {
  const begin = `<!-- BEGIN GENERATED:${blockName} -->`;
  const end = `<!-- END GENERATED:${blockName} -->`;
  const beginIndex = documentHtml.indexOf(begin);
  const endIndex = documentHtml.indexOf(end);
  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    throw new Error(`Marker pair GENERATED:${blockName} not found. Restore the "${begin}" ... "${end}" comments.`);
  }
  return documentHtml.slice(0, beginIndex + begin.length) + "\n" + blockHtml + "\n" + documentHtml.slice(endIndex);
}

/**
 * The hero block: one <h1> per line of the introduction, markdown stripped.
 * Mirrors the dynamic render (dataFiller.js maps paragraphs to h1).
 * @param {{ introduction: string }} info the parsed data/info.json
 * @returns {string}
 */
export function buildHeroHtml(info) {
  return info.introduction
    .split("\n")
    .map((line) => `<h1>${plainLine(line)}</h1>`)
    .join("\n");
}

/**
 * The about block: one <p> per aboutMe entry, markdown stripped.
 * @param {{ aboutMe: string[] }} info the parsed data/info.json
 * @returns {string}
 */
export function buildAboutHtml(info) {
  return info.aboutMe.map((entry) => `<p>${plainLine(entry)}</p>`).join("\n");
}

/**
 * One crawlable <article> per portfolio project (newest first): linked title,
 * date, plain-text description, skills, and the remaining links. Plain
 * semantic markup only -- the masonry layout stays a JS runtime concern
 * (root ADR 0004) and no element ids are set (the dynamic cards create their
 * own; duplicates must never exist).
 * @param {any[]} works the parsed portfolio projects
 * @returns {string}
 */
export function buildWorksHtml(works) {
  return sortByDateDescending(works)
    .map((work) => {
      const links = Array.isArray(work.links) ? work.links : [];
      const title = escapeHtml(work.title);
      const heading = links.length ? `<h3><a href="${escapeHtml(links[0].url)}">${title}</a></h3>` : `<h3>${title}</h3>`;

      const parts = [heading];
      if (work.date) parts.push(`<p>${escapeHtml(work.date)}</p>`);
      for (const paragraph of work.description ?? []) parts.push(`<p>${plainLine(paragraph)}</p>`);
      if (work.skills?.length) parts.push(`<p>Skills: ${escapeHtml(work.skills.join(", "))}</p>`);
      for (const link of links.slice(1)) {
        const label = link.type ? capitalizeFirstLetter(link.type, true, true) : "Website";
        parts.push(`<p><a href="${escapeHtml(link.url)}">${title} on ${escapeHtml(label)}</a></p>`);
      }
      return `<article>\n${parts.join("\n")}\n</article>`;
    })
    .join("\n");
}

/**
 * One crawlable <article> per locally hosted web-project, mirroring the cards
 * app.js renders (linked title relative to web-projects/, date, teaser, skills).
 * @param {any[]} works the parsed portfolio projects
 * @returns {string}
 */
export function buildWebProjectsIndexHtml(works) {
  return selectWebProjects(works)
    .map((project) => {
      const parts = [`<h3><a href="${escapeHtml(project.path)}">${escapeHtml(project.title)}</a></h3>`];
      if (project.date) parts.push(`<p>${escapeHtml(project.date)}</p>`);
      if (project.teaser) parts.push(`<p>${plainLine(project.teaser)}</p>`);
      if (project.skills.length) parts.push(`<p>Skills: ${escapeHtml(project.skills.join(", "))}</p>`);
      return `<article>\n${parts.join("\n")}\n</article>`;
    })
    .join("\n");
}

if (import.meta.main) {
  const repoRoot = join(import.meta.dir, "..");
  const info = loadInfo(repoRoot);
  const works = loadWorks(repoRoot);

  const indexPath = join(repoRoot, "index.html");
  let indexHtml = readFileSync(indexPath, "utf8");
  indexHtml = injectBlock(indexHtml, "HERO", buildHeroHtml(info));
  indexHtml = injectBlock(indexHtml, "ABOUT", buildAboutHtml(info));
  indexHtml = injectBlock(indexHtml, "WORKS", buildWorksHtml(works));
  writeFileSync(indexPath, indexHtml);

  const webProjectsIndexPath = join(repoRoot, "web-projects", "index.html");
  let webProjectsIndexHtml = readFileSync(webProjectsIndexPath, "utf8");
  webProjectsIndexHtml = injectBlock(webProjectsIndexHtml, "WEB-PROJECTS", buildWebProjectsIndexHtml(works));
  writeFileSync(webProjectsIndexPath, webProjectsIndexHtml);

  console.log("Static SEO blocks regenerated in index.html and web-projects/index.html");
}
