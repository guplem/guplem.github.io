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
 * Escape a markdown string and convert its inline markup to HTML: links
 * become real anchors, `**` becomes <strong>, `*` becomes <em>, newlines
 * become <br />. Used for the blocks that must look identical to the
 * marked-rendered dynamic version (hero, web-projects cards), so the runtime
 * can keep the static markup instead of swapping it (no animation replay).
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToInlineHtml(markdown) {
  return escapeHtml(markdown)
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
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
 * The hero block: a single <h1> that mirrors the dynamic render exactly
 * (dataFiller.js maps the introduction paragraph to h1; marked keeps the
 * bold as <strong> and the newline as <br>). Visual identity matters here:
 * the hero is above the fold, and fillWithData keeps this static markup when
 * its text matches, so the entrance animation never replays.
 * @param {{ introduction: string }} info the parsed data/info.json
 * @returns {string}
 */
export function buildHeroHtml(info) {
  return `<h1>${markdownToInlineHtml(info.introduction)}</h1>`;
}

/**
 * Markdown to structured block HTML: `#`-prefixed lines become headings
 * (level = number of `#`, clamped to 6), blank lines separate paragraphs,
 * and single newlines inside a paragraph become <br /> (matching marked's
 * breaks:true behavior). Inline markup goes through markdownToInlineHtml.
 * Used for printed blocks that need real structure (about, additional
 * sections) but are swapped, not adopted, at load.
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToBlockHtml(markdown) {
  const blocks = [];
  let paragraphLines = [];
  const flushParagraph = () => {
    if (paragraphLines.length) {
      blocks.push(`<p>${markdownToInlineHtml(paragraphLines.join("\n"))}</p>`);
      paragraphLines = [];
    }
  };

  for (const line of markdown.split("\n")) {
    const headingMatch = line.match(/^(#+)\s*(.*)$/);
    if (headingMatch) {
      flushParagraph();
      const level = Math.min(headingMatch[1].length, 6);
      blocks.push(`<h${level}>${markdownToInlineHtml(headingMatch[2])}</h${level}>`);
    } else if (line.trim() === "") {
      flushParagraph();
    } else {
      paragraphLines.push(line);
    }
  }
  flushParagraph();

  return blocks.join("\n");
}

/**
 * The about block: each aboutMe entry as structured blocks (headings,
 * paragraphs, links, bold), so crawlers and no-JS visitors get the real
 * structure. Swapped (not adopted) at load: the section sits behind the
 * scroll-reveal, so the swap is invisible and needs no exact mirror.
 * @param {{ aboutMe: string[] }} info the parsed data/info.json
 * @returns {string}
 */
export function buildAboutHtml(info) {
  return info.aboutMe.map(markdownToBlockHtml).join("\n");
}

/**
 * One <section> per additionalSections entry: section-label h2 title, image,
 * and the content entries as structured blocks. Reuses the existing
 * section-label / additional-grid / additional-text classes so the fallback
 * looks styled before JS runs, but the image always comes before the text --
 * the dynamic render's alternating order is a runtime visual concern the
 * printed block does not replicate. No element ids (the dynamic render
 * creates its own; duplicates must never exist).
 * @param {{ additionalSections?: Array<{ title?: string, image?: string, imageAlt?: string, content?: string[] }> }} info the parsed data/info.json
 * @returns {string}
 */
export function buildAdditionalSectionsHtml(info) {
  const sections = Array.isArray(info.additionalSections) ? info.additionalSections : [];
  return sections
    .map((section) => {
      const parts = [`<section class="section">`, `<div class="container">`];
      if (section.title) parts.push(`<div class="section-label"><h2>${escapeHtml(section.title)}</h2></div>`);
      parts.push(`<div class="additional-grid">`);
      if (section.image) {
        parts.push(`<img src="${escapeHtml(section.image)}" alt="${escapeHtml(section.imageAlt || `Image of ${section.title}`)}" />`);
      }
      parts.push(`<div class="additional-text">`);
      for (const entry of section.content ?? []) parts.push(markdownToBlockHtml(entry));
      parts.push(`</div>`, `</div>`, `</div>`, `</section>`);
      return parts.join("\n");
    })
    .join("\n");
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
 * One <article> per locally hosted web-project, mirroring the cards app.js
 * renders exactly (same classes, structure, stagger delay), so the page looks
 * identical before and after JS runs and app.js can adopt these cards instead
 * of swapping them (no entrance-animation replay).
 * @param {any[]} works the parsed portfolio projects
 * @returns {string}
 */
export function buildWebProjectsIndexHtml(works) {
  return selectWebProjects(works)
    .map((project, index) => {
      const parts = [`<article class="project-card" style="animation-delay: ${index * 50}ms">`];
      if (project.image) {
        const src = project.image.startsWith("http") ? project.image : `../${project.image}`;
        const alt = project.imageAlt || `Screenshot of ${project.title}`;
        parts.push(`<img class="project-image" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />`);
      }
      parts.push(`<div class="project-body">`);
      parts.push(`<h3 class="project-title"><a class="project-title-link" href="${escapeHtml(project.path)}">${escapeHtml(project.title)}</a></h3>`);
      if (project.date) parts.push(`<div class="project-date">${escapeHtml(project.date)}</div>`);
      if (project.teaser) parts.push(`<div class="project-teaser"><p>${markdownToInlineHtml(project.teaser)}</p></div>`);
      if (project.skills.length) {
        parts.push(`<div class="project-skills">${project.skills.map((skill) => `<span class="project-skill">${escapeHtml(skill)}</span>`).join("")}</div>`);
      }
      parts.push(`</div>`);
      parts.push(`</article>`);
      return parts.join("\n");
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
  indexHtml = injectBlock(indexHtml, "ADDITIONAL", buildAdditionalSectionsHtml(info));
  writeFileSync(indexPath, indexHtml);

  const webProjectsIndexPath = join(repoRoot, "web-projects", "index.html");
  let webProjectsIndexHtml = readFileSync(webProjectsIndexPath, "utf8");
  webProjectsIndexHtml = injectBlock(webProjectsIndexHtml, "WEB-PROJECTS", buildWebProjectsIndexHtml(works));
  writeFileSync(webProjectsIndexPath, webProjectsIndexHtml);

  console.log("Static SEO blocks regenerated in index.html and web-projects/index.html");
}
