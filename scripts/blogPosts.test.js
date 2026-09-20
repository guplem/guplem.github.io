// Unit tests for the blog post reader: a post's metadata is read from its own
// <head>, so the post is the one source of truth for its title, description
// and date (root ADR 0015). The disk reader is checked against the committed
// posts so a post with a broken head fails here, not in a crawler.

import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { loadPosts, readPostMetadata, sortByPublishedDescending } from "./blogPosts.js";

// Resolve relative to this test file, not the working directory, so the test
// passes no matter where `bun test` is invoked from.
const repoRoot = join(import.meta.dir, "..");

const postHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>A Post &amp; Its Title · Guillem Poy</title>
    <meta name="description" content="What the post says, in one &quot;short&quot; sentence." />
    <meta property="og:title" content="A Post &amp; Its Title" />
    <meta property="og:image" content="https://triunitystudios.com/blog/a-post/cover.png" />
    <meta property="article:published_time" content="2026-09-20T10:00:00Z" />
  </head>
  <body></body>
</html>`;

describe("readPostMetadata", () => {
  it("reads the title, description, date and cover from the head, with entities decoded", () => {
    expect(readPostMetadata(postHtml, "a-post")).toEqual({
      slug: "a-post",
      title: "A Post & Its Title",
      description: 'What the post says, in one "short" sentence.',
      published: "2026-09-20T10:00:00Z",
      image: "https://triunitystudios.com/blog/a-post/cover.png",
    });
  });

  it("accepts a post without a cover image", () => {
    const html = postHtml.replace(/<meta property="og:image"[^>]*>\n/, "");
    expect(readPostMetadata(html, "a-post").image).toBeNull();
  });

  it("throws, naming the post and the tag, when a required tag is missing", () => {
    const html = postHtml.replace(/<meta property="article:published_time"[^>]*>/, "");
    expect(() => readPostMetadata(html, "a-post")).toThrow(/a-post.*article:published_time/);
  });

  it("throws when the date is not a full ISO instant", () => {
    const html = postHtml.replace("2026-09-20T10:00:00Z", "2026-09-20");
    expect(() => readPostMetadata(html, "a-post")).toThrow(/a-post.*ISO/);
  });
});

describe("sortByPublishedDescending", () => {
  it("puts the newest post first and leaves the input untouched", () => {
    const older = { slug: "older", published: "2026-09-20T10:00:00Z" };
    const newer = { slug: "newer", published: "2026-09-20T12:00:00Z" };
    const input = [older, newer];
    expect(sortByPublishedDescending(input).map((post) => post.slug)).toEqual(["newer", "older"]);
    expect(input[0]).toBe(older);
  });
});

describe("loadPosts (the committed posts)", () => {
  const posts = loadPosts(repoRoot);

  it("finds every blog/<slug>/index.html and reads a full head from each", () => {
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(post.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(post.title.length).toBeGreaterThan(0);
      expect(post.description.length).toBeGreaterThan(0);
      expect(post.published).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    }
  });

  it("returns the posts newest first", () => {
    const dates = posts.map((post) => post.published);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
