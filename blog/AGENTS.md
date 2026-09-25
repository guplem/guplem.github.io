# blog/AGENTS.md

> **SCOPE:** files under `blog/`. The blog is part of the main site, not a web-project: it reuses the site's tokens and font and it is indexed by the site's generators.

## What this is

Long-form posts by the site owner: experiments, niche solutions, findings. The reader is often a crawler or a language model, so a post is a **plain HTML page whose text is in the file** (root ADR 0015). Each post owns its look; a thin shared layer says "same site".

## Layout

| Path | Role |
|---|---|
| `index.html` | The list of posts. Static; the list is a `GENERATED:BLOG-POSTS` block, never hand-edited |
| `feed.xml` | Atom feed. Generated, never hand-edited |
| `blog.css` | The shared skeleton: top bar, index cards, byline, footer. Loaded by the index and by every post |
| `<slug>/index.html` | One post. Its `<head>` is the post's only metadata record |
| `<slug>/style.css` | That post's own look, loaded after `blog.css` |

`scripts/blogPosts.js` finds every `blog/<slug>/index.html` and reads its `<meta property="og:title">`, `<meta name="description">`, `<meta property="article:published_time">` and, when present, `<meta property="og:image">`. Those tags feed the index block, `feed.xml` and `sitemap.xml`. There is no manifest.

## Rules

- **The HTML is the post.** Write the text into `index.html`. Do not commit a markdown source next to it, and do not add a script that fetches or renders content at load time. A page with JavaScript disabled must show the whole post.
- **The head carries the record.** Every post has `og:title` (the bare title, no site suffix), `description`, `article:published_time` as a full UTC instant (`2026-09-20T12:00:00Z`), `canonical`, and a `BlogPosting` JSON-LD block that repeats the same values. The generators throw when a required tag is missing.
- **Every section heading is an anchor.** Each `h2` to `h4` of a post carries a unique kebab-case `id` and wraps its text in `<a class="heading-anchor" href="#that-id">`, so a tap puts the section in the address bar the way Wikipedia does, with no script. `scripts/blogPosts.test.js` checks every post. The look lives in `blog.css`.
- **Every post sets `--scroll-track` and `--scroll-thumb` on `:root`.** The blog puts back the scrollbar that `css/global/base.css` hides, because a post is long text and the reader needs to see how much is left. The scrollbar belongs to the page, so it cannot read a variable defined on the body: put the post's palette on `:root` and the body class keeps only what it paints. `scripts/blogPosts.test.js` checks every post.
- **A post that changes its background sets `::selection`.** `css/global/base.css` selects with a faint wash and dark text; on a dark page that is unreadable. Scope the rule under the post's body class.
- **Reuse images, never copy them.** A picture that exists elsewhere in the repository (a web-project's screenshots, `evaluation/results/`, `resources/images/`) is referenced by relative path. A picture that exists only for the post lives in the post's folder.
- **Style the parts of a drawing once for the whole post**, under the class the figures share (`.diagram` in the AI World Gen post), never under one figure's own class. A drawing that borrows a class name scoped to another figure gets no style at all: black boxes and 16-pixel black text, which is invisible on a dark page. After you add a drawing, open it and check that every label has a colour, a size under 15 pixels, and room inside its box.
- **An animation is CSS inside the inline SVG, never a script.** Animate with `@keyframes` and per-element `animation-delay`, and give it a still end state under `prefers-reduced-motion` (`css/global/base.css` cuts every animation short, so the page must end on the finished picture, not a half-drawn one). The fill loop in the AI World Gen post is the example.
- **Check an animation by pinning it, not by waiting.** A hidden browser pane runs no clock, and headless Chrome's `--virtual-time-budget` skips frames of animations that change in steps, so both show wrong frames. Load the post in a temporary same-origin page that calls `pause()` and sets `currentTime` on every animation of the post, screenshot that page, then delete it.
- **In the AI World Gen post, the three methods have one name, one colour and one shape each, everywhere.** Cell by cell: orange, solid line, circle. Batched: blue, dashed line, diamond. LLM: green, dashed line, square. Wrap every mention in the text in `.m-cell`, `.m-batch` or `.m-llm` (a coloured underline), and keep "the loop" for the evaluation loop only. The Galtea run codes (`v11-llm`, `v11-batch`) stay as they are.
- **Charts and diagrams are inline SVG with the numbers in HTML.** Put a `<title>` and `<desc>` on each SVG and a `<table>` or a paragraph with the values next to it. No chart library. A chart is written once: a post is dated content and does not update when the data changes.
- **Every post loads the self-hosted Inter font** (`../../resources/fonts/InterVariable.woff2` preload and `../../css/global/fonts.css`), even when its own look uses a system serif or monospace stack. `scripts/fontSelfHosted.test.js` checks every post through `loadPosts`. Never load a font from a third-party host.
- **Per-post styling goes in `<slug>/style.css`, on top of `blog.css`.** Scope it with a class on `<body>` (`.letter`, `.maptable`) so a rule cannot leak into another post. Keep the top bar, byline and footer from `blog.css` recognisable. Write a rule for a paragraph inside the post as `.post .your-class`. A bare class loses to the post's own `.post p` rule, so the paragraph keeps the body size and colour and the new rule looks broken.
- **Regenerate after any change to a post's head** and after adding a post: `bun scripts/generateSeoBlocks.js && bun scripts/generateSitemap.js && bun scripts/generateFeed.js` (automatic with lefthook). The drift tests in `scripts/` fail otherwise.
- **Posts carry no deploy stamp.** Their `article:published_time` is the date that matters.

Whenever you add a post, use the `add-blog-post` skill.
