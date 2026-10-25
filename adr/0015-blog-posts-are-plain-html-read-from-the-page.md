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
  only for an extra, and with no script the post must still show everything.
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
  Inter font stays self-hosted on every post (ADR 0005). A post may add a
  second self-hosted font in `resources/fonts/`, with its licence beside it
  (`tu-primer-agente/` adds Plus Jakarta Sans).
  `scripts/fontSelfHosted.test.js` covers every post through the same reader
  the generators use. The blog also puts back the scrollbar that
  `css/global/base.css` hides for the portfolio, themed by each post, because
  a reader of long text needs to see how much of it is left.
- **An interactive post holds every variant as text, and its script only
  hides.** `tu-primer-agente/` has one block per example and per app
  (`.variant[data-example]`, `.variant[data-app]`). With no script, all of
  them show. `tutorial.js` hides the ones the reader did not choose, reads
  every sentence it shows from the page, and keeps the choice in the address
  (`?app=`, and `?ejemplo=` or `?example=`), so a link repeats the choice.
  The decisions (which app fits, what the address carries) are in the pure
  module `agentCore.js`, tested with Bun first (ADR 0012); `tutorial.js` is
  DOM glue.
- **A post in two languages is two posts with two slugs**
  (`tu-primer-agente/`, `your-first-agent/`), linked by
  `<link rel="alternate" hreflang>` and a language link in the top bar. The
  second imports the first one's `style.css` and loads its `tutorial.js`.
  Each page then has its own URL, head and language for a crawler, and the
  generators list both with no language rule.
- **A post may ship example folders for the reader to download.** Each
  folder is committed beside a `.zip` of it, so a crawler reads every file
  and a reader takes one download. `examples.test.js` fails when a zip and
  its folder differ. The files in them are reader content, not instructions
  for the agents that work on this repository.
- **Every section heading is a link to itself.** Each `h2` to `h4` carries
  an id and wraps its text in an anchor to that id, so a tap puts the section
  in the address bar (as Wikipedia does) and a reader can share one section,
  with no script. `scripts/blogPosts.test.js` checks every post.
- **Charts and diagrams are inline SVG with the data in HTML** (a table or a
  paragraph), so a reader without the picture still has the numbers. They
  are written once; a post is dated content. An animation is CSS inside that
  SVG, never a script, and it ends on the finished picture when the reader
  asks for less motion.
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
- An interactive post still reads fully with no script, so a crawler sees
  every variant.

**Negative:**

- Writing a post means writing HTML. A draft in markdown has to be
  converted once, by a person or an agent, and the draft is not kept.
- Three more generated artifacts can drift, and a post with a broken head fails
  CI instead of silently disappearing from the list. That is the intended
  trade.
- A post with every variant in the HTML is long, and a two-language post
  must be edited twice. The texts can drift. Only the zips have a test, so
  the owner keeps the two texts in step.
- Per-post CSS means per-post maintenance. A change to the shared skeleton
  has to be checked against every post's overrides.
