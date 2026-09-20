// Unit tests for the Atom feed builder, plus the drift guard: CI fails when a
// post changes without regenerating blog/feed.xml (fix: bun scripts/generateFeed.js).

import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildAtomFeed } from "./generateFeed.js";
import { loadPosts } from "./blogPosts.js";
import { loadInfo } from "./portfolioData.js";

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

const info = { name: "Guillem Poy" };
const posts = [
  { slug: "newer", title: "Newer & Better", description: 'The "second" post.', published: "2026-09-20T12:00:00Z", image: null },
  { slug: "older", title: "Older", description: "The first post.", published: "2026-09-20T10:00:00Z", image: "https://triunitystudios.com/blog/older/cover.png" },
];

describe("buildAtomFeed", () => {
  const xml = buildAtomFeed(posts, info);

  it("names the feed, its self link and its author", () => {
    expect(xml).toContain(`<feed xmlns="http://www.w3.org/2005/Atom">`);
    expect(xml).toContain(`<link href="https://triunitystudios.com/blog/feed.xml" rel="self" />`);
    expect(xml).toContain(`<link href="https://triunitystudios.com/blog/" />`);
    expect(xml).toContain(`<author><name>Guillem Poy</name></author>`);
  });

  it("takes the feed's updated time from the newest post", () => {
    expect(xml).toContain(`<updated>2026-09-20T12:00:00Z</updated>`);
    expect(xml.indexOf("<updated>2026-09-20T12:00:00Z</updated>")).toBeLessThan(xml.indexOf("<entry>"));
  });

  it("writes one entry per post, newest first, with the post URL as its id", () => {
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g);
    expect(entries.length).toBe(2);
    expect(entries[0]).toContain(`<id>https://triunitystudios.com/blog/newer/</id>`);
    expect(entries[0]).toContain(`<link href="https://triunitystudios.com/blog/newer/" />`);
    expect(entries[0]).toContain(`<published>2026-09-20T12:00:00Z</published>`);
    expect(entries[1]).toContain(`<id>https://triunitystudios.com/blog/older/</id>`);
  });

  it("escapes the XML-significant characters in titles and summaries", () => {
    expect(xml).toContain(`<title>Newer &amp; Better</title>`);
    expect(xml).toContain(`<summary>The &quot;second&quot; post.</summary>`);
  });

  it("orders the entries by date even when the input is not sorted", () => {
    const reversed = buildAtomFeed([...posts].reverse(), info);
    expect(reversed.indexOf("blog/newer/")).toBeLessThan(reversed.indexOf("blog/older/"));
  });

  it("gives an empty blog a valid feed with no entries", () => {
    const empty = buildAtomFeed([], info);
    expect(empty).toContain("</feed>");
    expect(empty).not.toContain("<entry>");
  });
});

describe("blog/feed.xml drift", () => {
  it("matches the committed feed (fix: bun scripts/generateFeed.js)", () => {
    const committed = normalizeEol(readFileSync(join(repoRoot, "blog", "feed.xml"), "utf8"));
    expect(buildAtomFeed(loadPosts(repoRoot), loadInfo(repoRoot))).toBe(committed);
  });
});
