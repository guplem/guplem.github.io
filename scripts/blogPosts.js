// Disk reader for the blog, shared by the generator scripts (run with Bun,
// never in the browser). A post is `blog/<slug>/index.html`, and its title,
// description, date and cover are read from its own <head>: there is no
// manifest to keep in step with the page (root ADR 0015).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The tags a post's <head> must carry, and the attribute each one is found by. */
const REQUIRED_TAGS = [
  { key: "title", attribute: `property="og:title"` },
  { key: "description", attribute: `name="description"` },
  { key: "published", attribute: `property="article:published_time"` },
];

const OPTIONAL_TAGS = [{ key: "image", attribute: `property="og:image"` }];

/**
 * Decode the entities `escapeHtml` in generateSeoBlocks.js writes, so a title
 * read from a page and written into another page is escaped exactly once.
 * @param {string} text
 * @returns {string}
 */
function unescapeHtml(text) {
  return text.replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

/**
 * The `content` of the <meta> tag that carries the given attribute, or null.
 * @param {string} html
 * @param {string} attribute e.g. `property="og:title"`
 * @returns {string | null}
 */
function metaContent(html, attribute) {
  const tag = (html.match(/<meta[^>]*>/g) ?? []).find((one) => one.includes(attribute));
  const content = tag?.match(/content="([^"]*)"/);
  return content ? unescapeHtml(content[1]) : null;
}

/**
 * Read a post's metadata from its page. Throws, naming the post, when a
 * required tag is missing, so a broken head fails the generator and CI
 * instead of publishing an entry with a hole in it.
 * @param {string} html the post's full index.html
 * @param {string} slug the post's folder name
 * @returns {{slug: string, title: string, description: string, published: string, image: string | null}}
 */
export function readPostMetadata(html, slug) {
  const post = { slug };
  for (const { key, attribute } of REQUIRED_TAGS) {
    const value = metaContent(html, attribute);
    if (value === null || value.trim() === "") {
      throw new Error(`Post "${slug}" is missing <meta ${attribute} content="..."> (${attribute.split('"')[1]}) in its <head>.`);
    }
    post[key] = value;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(post.published)) {
    throw new Error(`Post "${slug}" has article:published_time "${post.published}"; write a full ISO instant in UTC, like 2026-09-20T10:00:00Z.`);
  }
  for (const { key, attribute } of OPTIONAL_TAGS) post[key] = metaContent(html, attribute);
  return post;
}

/**
 * A copy of the posts, newest first.
 * @template {{published: string}} T
 * @param {T[]} posts
 * @returns {T[]}
 */
export function sortByPublishedDescending(posts) {
  return [...posts].sort((a, b) => b.published.localeCompare(a.published));
}

/**
 * Every post under blog/: each sub-folder that holds an index.html, read and
 * sorted newest first.
 * @param {string} repoRoot absolute path to the repository root
 * @returns {ReturnType<typeof readPostMetadata>[]}
 */
export function loadPosts(repoRoot) {
  const blogDir = join(repoRoot, "blog");
  const posts = readdirSync(blogDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(blogDir, entry.name, "index.html")))
    .map((entry) => readPostMetadata(readFileSync(join(blogDir, entry.name, "index.html"), "utf8"), entry.name));
  return sortByPublishedDescending(posts);
}
