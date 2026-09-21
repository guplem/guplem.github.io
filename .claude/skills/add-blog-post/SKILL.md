---
name: add-blog-post
description: Write a new blog post under blog/<slug>/ as plain HTML with its own look, then regenerate the index, feed and sitemap
argument-hint: "<topic, or the path of a draft>"
---

# Add Blog Post

Create one post under `blog/<slug>/` and register it through the generators. Follow the rules in `blog/AGENTS.md` and root ADR 0015. Use this skill whenever the user asks for a new blog post.

## 1. Gather the post

If `$ARGUMENTS` names a topic or a draft file, use it. Otherwise ask, using `AskUserQuestion`:

> "What is the post about? Give me the topic, or the path of a draft I should turn into the page."

Then ask, using `AskUserQuestion`, for the slug (kebab-case, short, no date), offering two derivations from the title. Store `SLUG`, `TITLE`, a one-sentence `DESCRIPTION` (under 200 characters; it is the meta description and the feed summary) and `PUBLISHED`, a full UTC instant (`2026-09-20T12:00:00Z`; use now, rounded to the hour, unless the user gives a date).

Read the two existing posts before you write, so the new one matches their head and their skeleton: `blog/why-a-blog-now/index.html` and `blog/ai-world-gen-thousands-of-tiny-decisions/index.html`.

## 2. Collect the data and the pictures

- Numbers that the post cites come from the repository or from the tool the post is about. Compute them; do not estimate.
- Find pictures that already exist in the repository (a web-project's screenshots, `evaluation/results/`, `resources/images/`) and reference them by relative path from `blog/<slug>/`. Create a new image only when none exists, and put it in `blog/<slug>/`.
- For a chart, write the SVG once from the data (a throwaway script is fine) and put the numbers in a `<table>` next to it.

## 3. Write `blog/<slug>/index.html`

The page is plain HTML: the whole text in the file, no script that renders content. Copy the `<head>` shape from an existing post and set:

- `<title>TITLE · Guillem Poy</title>`
- `<meta name="description" content="DESCRIPTION" />`
- `<link rel="canonical" href="https://triunitystudios.com/blog/SLUG/" />` and the Atom `alternate` link to `../feed.xml`
- `og:type` `article`, `og:title` = `TITLE` (no site suffix), `og:description`, `og:url`, `og:image` when the post has a cover, `article:published_time` = `PUBLISHED`, `article:author`
- the `BlogPosting` JSON-LD block with the same headline, description, date and author
- the font preload and `fonts.css` at `../../resources/fonts/InterVariable.woff2` and `../../css/global/fonts.css`, then `variables.css`, `base.css`, `../blog.css`, `style.css`

Body: every `h2` to `h4` as `<h2 id="kebab-case-of-the-text"><a class="heading-anchor" href="#kebab-case-of-the-text">Text</a></h2>` (the test in `scripts/blogPosts.test.js` checks this), the `.topbar` with the back link to `../` and the feed link, an `<article class="post">` with `.post-header` (kicker, `<h1>`, standfirst, `.post-byline` with the author link, a `<time>` and the reading time), sections with `<h2>`, `<figure>` with `<figcaption>` for every picture, inline SVG with `<title>` and `<desc>` for every diagram, and the `.page-footer`.

Write the prose under the "Writing style" section of the root `AGENTS.md`, in the first person: it is the site owner's voice.

## 4. Write `blog/<slug>/style.css`

Give the post a look that serves its story. Scope every rule under a class you put on `<body>` (`.letter`, `.maptable`, a new one for this post) so nothing leaks into another post. Keep the top bar, byline and footer from `blog.css` recognisable. Fonts come from the system or from the self-hosted Inter; never from a third-party host. When the post changes the page background, set `::selection` under the body class so selected text stays readable.

## 5. Register the post

```bash
bun scripts/generateSeoBlocks.js && bun scripts/generateSitemap.js && bun scripts/generateFeed.js
```

Then run the **validate** agent. The drift tests, `scripts/blogPosts.test.js` and `scripts/fontSelfHosted.test.js` all read the new post.

## 6. Check it in the browser

Serve the repository root (`preview_start`), open `blog/<slug>/` and `blog/`, and check the page at phone width and at desktop width. Read the console for errors. For every drawing, check in the page that each label has a colour, a size under 15 pixels and room inside its box: a class that is scoped to another figure leaves black 16-pixel text that a screenshot may hide. Confirm that the page shows the whole text with JavaScript disabled (there is none to disable; check that no content depends on a script).

## 7. Report

List the files created (`blog/<slug>/index.html`, `blog/<slug>/style.css`, any new image) and the generated files that changed (`blog/index.html`, `blog/feed.xml`, `sitemap.xml`). Name the URL the post will have.
