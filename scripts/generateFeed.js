// Generates blog/feed.xml, an Atom feed of the blog posts, so feed readers and
// crawlers learn about a new post without visiting the index (root ADR 0015).
// The posts' own <head> tags are the source (scripts/blogPosts.js).
//
// Run: bun scripts/generateFeed.js
//
// The builder is pure (no I/O) so generateFeed.test.js can drift-check the
// committed blog/feed.xml against it; the write happens only when this file is
// the entry point (import.meta.main).

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadPosts, sortByPublishedDescending } from "./blogPosts.js";
import { escapeHtml } from "./generateSeoBlocks.js";
import { loadInfo } from "./portfolioData.js";

const SITE_ORIGIN = "https://triunitystudios.com";
const BLOG_URL = `${SITE_ORIGIN}/blog/`;
const FEED_URL = `${BLOG_URL}feed.xml`;

/**
 * Build the Atom feed: one entry per post, newest first. The feed's own
 * `updated` time is the newest post's date, so a reader that saw the feed
 * before sees a change only when a post was added.
 * @param {Array<{slug: string, title: string, description: string, published: string}>} posts
 * @param {{name: string}} info the parsed data/info.json (the author's name)
 * @returns {string} the full XML document
 */
export function buildAtomFeed(posts, info) {
  const sorted = sortByPublishedDescending(posts);
  const updated = sorted[0]?.published ?? "1970-01-01T00:00:00Z";
  const entries = sorted.map((post) => {
    const url = `${BLOG_URL}${post.slug}/`;
    return [
      `  <entry>`,
      `    <title>${escapeHtml(post.title)}</title>`,
      `    <link href="${url}" />`,
      `    <id>${url}</id>`,
      `    <published>${post.published}</published>`,
      `    <updated>${post.published}</updated>`,
      `    <summary>${escapeHtml(post.description)}</summary>`,
      `  </entry>`,
    ].join("\n");
  });
  return [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<!-- GENERATED FILE - do not edit by hand. Regenerate with: bun scripts/generateFeed.js (root ADR 0015) -->`,
    `<feed xmlns="http://www.w3.org/2005/Atom">`,
    `  <title>${escapeHtml(info.name)} · Blog</title>`,
    `  <subtitle>Experiments, niche solutions and findings, written to be read by people and by the models that answer them.</subtitle>`,
    `  <link href="${FEED_URL}" rel="self" />`,
    `  <link href="${BLOG_URL}" />`,
    `  <id>${BLOG_URL}</id>`,
    `  <updated>${updated}</updated>`,
    `  <author><name>${escapeHtml(info.name)}</name></author>`,
    ...entries,
    `</feed>`,
    ``,
  ].join("\n");
}

if (import.meta.main) {
  const repoRoot = join(import.meta.dir, "..");
  const posts = loadPosts(repoRoot);
  writeFileSync(join(repoRoot, "blog", "feed.xml"), buildAtomFeed(posts, loadInfo(repoRoot)));
  console.log(`blog/feed.xml regenerated (${posts.length} posts)`);
}
