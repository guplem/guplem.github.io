# ADR 0015: Blog posts are plain HTML, and the page is the only record of the post

## Context

The site gained a blog in September 2026 (`blog/`). The first post explains
the reason: a page about a niche problem no longer has to win a keyword
ranking to be read, because language models read the open web and pass on
what answers a question. The reader of a post is therefore often a crawler
with a time budget or a model with a text scraper, and both read the raw
HTML, not what JavaScript builds after load. ADR 0010 records what happened
when this site's content lived behind JavaScript: Google indexed none of it.

The site has no build step (ADR 0002). The author wanted each post to look
different, with visuals that add to its story, and did not want the post text
copied in two places.

Options considered for the post itself:

1. **Markdown files rendered in the browser** by a script, like the portfolio
   renders `data/` through `marked`. Rejected: the text is not in the file a
   crawler fetches, and the render depends on a CDN import.
2. **Markdown sources committed next to generated HTML.** Rejected: two
   copies of the same text drift after the first edit, and the repository's
   rule is one source of truth.
3. **Plain HTML written once**, by hand or by an agent from a draft that is
   not committed. Chosen.

Options considered for the list of posts and the feed:

1. **A hand-written list** in `blog/index.html`. Rejected: a second copy of
   each title, date and summary.
2. **A manifest** (`posts.json`) as the source, with a test that each post's
   head matches it. Rejected: the manifest repeats what the post's own
   `<head>` already states for crawlers.
3. **Read the posts' own `<head>` tags** and generate the list, the feed and
   the sitemap entries from them. Chosen.

## Decision

- **A post is `blog/<slug>/index.html`, and its text is in the file.** No
  script fetches or renders content at load time. A post may use JavaScript
  only for an extra that hides nothing when it is absent.
- **The post's `<head>` is its only metadata record.** `og:title` is the
  title, `description` the summary, `article:published_time` the date (a full
  UTC instant, so two posts on one day still order), `og:image` the optional
  cover. `scripts/blogPosts.js` reads them and throws when one is missing.
- **Three generated artifacts follow from the posts**, in the pattern of ADR
  0010: the `GENERATED:BLOG-POSTS` block in `blog/index.html`
  (`scripts/generateSeoBlocks.js`), `blog/feed.xml`, an Atom feed
  (`scripts/generateFeed.js`), and the blog URLs in `sitemap.xml`
  (`scripts/generateSitemap.js`). Drift tests in `scripts/` compare the
  committed files with fresh output; `lefthook.yml` regenerates them on
  commit. Unlike the portfolio blocks, no JavaScript ever replaces the blog
  block: the static list is the page.
- **Each post owns its look, on a shared skeleton.** `blog/blog.css` holds
  the top bar, the index cards, the byline and the footer. A post's
  `style.css` is loaded after it and is scoped by a class on `<body>`. The
  Inter font stays self-hosted on every post (ADR 0005), and
  `scripts/fontSelfHosted.test.js` covers every post through the same reader
  the generators use.
- **Charts and diagrams are inline SVG with the data in HTML** (a table or a
  paragraph), so a reader without the picture still has the numbers. They
  are written once; a post is dated content.
- **Images are reused by relative path**, never copied into the blog. The
  AI World Gen post points at the maps committed under
  `web-projects/ai-world-gen/evaluation/results/`.
- **Posts carry no deploy stamp** (ADR 0013 covers web-projects); the
  publication date is the date that matters.

## Consequences

**Positive:**

- Every crawler and every model sees the full post, its title, its date and
  its structured data (`BlogPosting` JSON-LD) in the raw HTML, with no
  JavaScript executed and no CDN reached.
- One source of truth per post. Adding a post is one folder plus running
  the generators; nothing else lists it by hand.
- A post can look like its subject (a letter on paper, a map table at night)
  without a theme system.

**Negative:**

- Writing a post means writing HTML. A draft in markdown has to be
  converted once, by a person or an agent, and the draft is not kept.
- Three more generated artifacts can drift, and a post with a broken head fails
  CI instead of silently disappearing from the list. That is the intended
  trade.
- Per-post CSS means per-post maintenance. A change to the shared skeleton
  has to be checked against every post's overrides.
