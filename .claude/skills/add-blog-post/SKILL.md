---
name: add-blog-post
description: Write a new blog post under blog/<slug>/, or rework an existing one, as plain HTML in the owner's style (short version, contents list, animated SVG drawings, every fact in text), fact-check it with independent agents, then regenerate the index, feed and sitemap
argument-hint: "<topic, the path of a draft, or the slug of a post to rework>"
---

# Add Blog Post

Create one post under `blog/<slug>/`, or rework an existing one, and register it through the generators. Follow the rules in `blog/AGENTS.md` and root ADR 0015. Use this skill whenever the user asks for a new post or for a change to the shape or style of a post.

## 1. Gather the post

If `$ARGUMENTS` names a topic, a draft file or a post, use it. Otherwise ask, using `AskUserQuestion`:

> "What is the post about? Give me the topic, or the path of a draft I should turn into the page."

For a new post, ask, using `AskUserQuestion`, for the slug (kebab-case, short, no date), offering two derivations from the title. Store `SLUG`, `TITLE`, a one-sentence `DESCRIPTION` (under 200 characters; it is the meta description and the feed summary) and `PUBLISHED`, a full UTC instant (`2026-09-20T12:00:00Z`; use now, rounded to the hour, unless the user gives a date).

Read both reference posts in full before you write: `blog/why-a-blog-now/` (the usual shape and length) and `blog/ai-world-gen-thousands-of-tiny-decisions/` (charts, tables, method names; too long to copy its length).

## 2. Collect the data and the pictures

- Compute every number that the post cites from the repository or from the tool the post is about. Do not estimate. When a number can only be an estimate, say so in the text, and say how it was made.
- Find pictures that already exist in the repository (a web-project's screenshots, `evaluation/results/`, `resources/images/`) and reference them by relative path from `blog/<slug>/`. Create a new image only when none exists, and put it in `blog/<slug>/`.
- Plan one or two animated drawings that explain the main idea (a flow, a before and after, a comparison). A drawing is worth adding only when it makes the idea faster to grasp than the text alone.

## 3. Write the text in the owner's style

The root `AGENTS.md` "Writing style" applies. On top of it, the owner wants these in every post:

- **The purpose first, then the steps in the order they happen.** Open each section with what it answers, then say what happens, step by step.
- **A short clause for each term at first use**, such as "coverage (the share of tile types that reach the map)". The short version counts as first use.
- **Lists with a bold label for findings and steps**, one idea per line: "**Rules: broken more often** (0.76 against 0.99). Jev is never offered…".
- **A number only when it carries a finding.** Leave out a number that a chart or a table already shows, and give the reader one key number per claim.
- **A fair comparison.** State the measured lead and its limits. Call a gap smaller than the noise a tie, and say what the noise is.
- **No rhetorical lines**, no clever closing sentences, and no weight on how many versions it took or how many hours.
- **First person**, in the owner's voice.

Keep the post between 4 and 12 minutes of reading unless the owner asks for more. Count the words (about 250 per minute) and put the reading time in the byline.

## 4. Build `blog/<slug>/index.html`

Copy the `<head>` from a reference post and set:

- `<title>TITLE · Guillem Poy</title>` and `<meta name="description" content="DESCRIPTION" />`
- `<link rel="canonical" href="https://triunitystudios.com/blog/SLUG/" />` and the Atom `alternate` link to `../feed.xml`
- `og:type` `article`, `og:title` = `TITLE` (no site suffix), `og:description`, `og:url`, `og:image` when the post has a cover, `article:published_time` = `PUBLISHED`, `article:author`
- the `BlogPosting` JSON-LD block with the same headline, description, date and author
- the font preload and `fonts.css` at `../../resources/fonts/InterVariable.woff2` and `../../css/global/fonts.css`, then `variables.css`, `base.css`, `../blog.css`, `style.css`

Build the body in this order (the reference posts show each part):

1. The `.topbar` with the back link to `../` and the feed link.
2. `<article class="post">` with `.post-header`: kicker, `<h1>`, standfirst, then a `<p class="post-project">` link when the post is about a project ("Try <Project> →"), then `.post-byline` (author link, `<time>`, reading time).
3. The short version: `<p class="short-version-lead">` and a `<ul class="short-version">` of two to four points, each with a bold label.
4. The contents list, `<details class="toc" id="contents">` with a `<nav>` and an `<ol>` of every `h2` (and an `h3` nested under its `h2`), then `<a class="toc-jump" href="#contents">&uarr; Contents</a>`.
5. The sections: every `h2` to `h4` as `<h2 id="kebab-case-of-the-text"><a class="heading-anchor" href="#kebab-case-of-the-text">Text</a></h2>`. A `<figure>` with a `<figcaption>` for every picture and drawing.
6. `.post-footer`, then `.page-footer`.
7. The contents script at the end of `<body>`, copied from a reference post. It only opens the list on a wide screen and marks the current section.

For every drawing: inline SVG with `role="img"`, a `<title>`, and a `<desc>` that states the numbers and the idea in words. Put a `<table>` with the values next to every chart; fold it in `<details class="numbers-fold">` when it repeats the chart.

When the post is about a project, link both ways: the `post-project` line in the post, and a `{ "type": "blog", "url": "blog/<slug>/" }` entry in the project's `data/projects/*.json` right after its main link (see `data/AGENTS.md`), then regenerate the SEO blocks.

## 5. Write `blog/<slug>/style.css`

- Give the post a look that serves its story: a map table, a letter on paper, a lab notebook. Scope every rule under a class on `<body>`.
- Copy the contents list, `.toc-jump`, short-version and list rules from the reference post whose palette is closest, and change only the colours.
- Put the palette on `:root`, with `--scroll-track` and `--scroll-thumb`.
- Animate with `@keyframes` in this file. Write the cycle in a comment above each animation (what happens, in which part of the cycle). Add a `prefers-reduced-motion: reduce` block that shows every drawing finished.

## 6. Check it in the browser

Serve the repository root (`preview_start`) and open `blog/<slug>/`. Run these checks and fix what fails:

- **Labels:** in the page, run `getBBox()` on every SVG `<text>`. Check that no two labels overlap, that no label crosses the edge of its box, that every label has a colour (not black) and a size under 15 pixels, and that label lines do not cross.
- **Animations:** create a temporary `blog/<slug>/_shot.html` that loads the post in an `<iframe>`, scrolls it to a figure, and calls `pause()` and sets `currentTime` on every animation from `document.getAnimations()`. Screenshot it with headless Chrome at a few moments of each cycle (`chrome --headless=new --screenshot=… --window-size=820,480 "…/_shot.html?…"`), look at each frame, then delete `_shot.html`. Never commit it.
- **Layouts:** screenshot the post at 1440 wide (the contents list in the corner, the current section marked) and at 390 wide (the folded box and the jump button).
- **Crawlability:** read the page as text only (strip the tags). Check that every fact, number and claim of the post is in that text, including each chart's numbers and each picture's description.
- **Console:** read it for errors.

## 7. Fact-check with independent agents

Run this before the post ships, and again after a large rework.

1. **Finders.** Launch three agents in parallel, in a single message. Give each one part of the post (split it by sections). Tell each: do not edit files; check every number, name and claim against the data, the code and the rest of the post; report only real mistakes (not style); for each, give the exact quote, where it is, why it is wrong with evidence, and a fix. Give them any fact that is not in the repository (a bill, a log) as a known fact.
2. **Merge.** Write the reported mistakes to one numbered list in a scratch file (for example `A1`, `B3`), with the sources to use.
3. **Validators.** Launch three more agents in parallel, in a single message. Each checks **every** item of the list on its own, and answers one line per item: `ID | CONFIRMED, REJECTED or PARTLY | evidence | correct value or wording`. Ask one to work in reverse order and one to read every code function that a claim names. Wait until every validator has reported; a validator may hand its work to its own agents and report later.
4. **Apply.** Fix an item only when at least two of the three validators confirm it, fully or partly. Leave the rest as it is, and tell the owner which items you left out and why.

## 8. Register and ship

```bash
bun scripts/generateSeoBlocks.js && bun scripts/generateSitemap.js && bun scripts/generateFeed.js
```

Run the **validate** agent. The drift tests, `scripts/blogPosts.test.js` (anchors, scrollbar, contents list) and `scripts/fontSelfHosted.test.js` all read the post. Then ship it as the root `AGENTS.md` "Git Workflow" section describes.

## 9. Report

List the files created or changed (`blog/<slug>/index.html`, `blog/<slug>/style.css`, any new image, `blog/index.html`, `blog/feed.xml`, `sitemap.xml`, and the project JSON when linked). Name the URL of the post, the reading time, and the fact-check items that you did not apply.
