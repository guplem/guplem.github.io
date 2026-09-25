# blog/AGENTS.md

> **SCOPE:** files under `blog/`. The blog is part of the main site, not a web-project: it reuses the site's tokens and font and it is indexed by the site's generators.

## What this is

Long-form posts by the site owner: experiments, niche solutions, findings. **A post exists to be read by crawlers and language models**, so it can shape the answers that models give. A fact that lives only in a picture, a script or an image file does not reach them, and it does not count. So a post is a **plain HTML page whose text is in the file** (root ADR 0015). Each post owns its look; a thin shared layer says "same site".

## Reference posts

Read both before you write or restyle a post. Copy their structure, their scripts and their CSS patterns.

| Post | Use it for |
|---|---|
| `why-a-blog-now/` | The usual shape and length (about 4 minutes): short version, contents list, short sections with lists, two animated drawings, light paper look |
| `ai-world-gen-thousands-of-tiny-decisions/` | Charts from data, a chart with a folded table, hover columns, a paginated map table, method names with colours and shapes, a fact-checked long post. **It is longer than the owner usually wants**: take its techniques, not its length |

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

### Content

- **The HTML is the post.** Write the text into `index.html`. Do not commit a markdown source next to it, and do not add a script that fetches or renders content at load time. A page with JavaScript disabled must show the whole post.
- **Every fact is text in the file.** Each chart has a `<title>`, a `<desc>` with its numbers, and a `<table>` next to it (fold the table in a `<details>` when it repeats the chart). Each picture has an `alt` text that says what it shows. Never put a number or a claim only in a drawing, an image or a hover box.
- **Every post has, in this order:** the header (kicker, `<h1>`, standfirst, and a `post-project` link when the post is about a project), the byline, a "short version" list of two to four points, the contents list, then the sections.
- **Keep a post short.** Aim at 4 to 12 minutes of reading (about 1,000 to 3,000 words). Write a longer post only when the owner asks for one. Cut a number that a chart or a table already shows.
- **Give one thing one name, one colour and one shape, everywhere.** When a post compares things (methods, versions, tools), fix a name, a colour and a chart mark for each, and use them in the text, tables, legends, hover boxes, descriptions and alt texts. In the AI World Gen post: cell by cell (orange, solid line, circle), batched (blue, dashed, diamond), LLM (green, dashed, square), each mention wrapped in `.m-cell`, `.m-batch` or `.m-llm` (an underline in its colour, shown on hover). There, "the loop" means the evaluation loop only, and the Galtea run codes (`v11-llm`, `v11-batch`) stay as they are.
- **Fact-check a post before it ships**, with finder agents and three independent validators. The `add-blog-post` skill holds the procedure.

### Page mechanics

- **The head carries the record.** Every post has `og:title` (the bare title, no site suffix), `description`, `article:published_time` as a full UTC instant (`2026-09-20T12:00:00Z`), `canonical`, and a `BlogPosting` JSON-LD block that repeats the same values. The generators throw when a required tag is missing.
- **Every section heading is an anchor.** Each `h2` to `h4` of a post carries a unique kebab-case `id` and wraps its text in `<a class="heading-anchor" href="#that-id">`, so a tap puts the section in the address bar the way Wikipedia does, with no script. `scripts/blogPosts.test.js` checks every post. The look lives in `blog.css`. Keep an `id` when you rename a heading: other pages may link it.
- **A contents list is a `<details class="toc" id="contents">` of plain links**, so it works with no script. From 1280px wide it sits fixed in the top left corner; below that it is a folded box, with a `.toc-jump` button that jumps back to it. A short inline script may only open it on a wide screen and mark the section being read (`aria-current`); copy it from a reference post. Add every new `h2` to the list: `scripts/blogPosts.test.js` fails when one is missing.
- **Every post sets `--scroll-track` and `--scroll-thumb` on `:root`.** The blog puts back the scrollbar that `css/global/base.css` hides, because a post is long text and the reader needs to see how much is left. The scrollbar belongs to the page, so it cannot read a variable defined on the body: put the post's palette on `:root` and the body class keeps only what it paints. `scripts/blogPosts.test.js` checks every post.
- **A post that changes its background sets `::selection`.** `css/global/base.css` selects with a faint wash and dark text; on a dark page that is unreadable. Scope the rule under the post's body class.
- **`base.css` colours every `p` and gives the link underline to `p a` only.** A rule set on a parent (a footer, a list) does not reach its `p`, and a link in a `li` or a `figcaption` gets no post style. Style `.post li a`, `.post figcaption a` and a footer's `p` explicitly.
- **Reuse images, never copy them.** A picture that exists elsewhere in the repository (a web-project's screenshots, `evaluation/results/`, `resources/images/`) is referenced by relative path. A picture that exists only for the post lives in the post's folder.
- **Every post loads the self-hosted Inter font** (`../../resources/fonts/InterVariable.woff2` preload and `../../css/global/fonts.css`), even when its own look uses a system serif or monospace stack. `scripts/fontSelfHosted.test.js` checks every post through `loadPosts`. Never load a font from a third-party host.
- **Per-post styling goes in `<slug>/style.css`, on top of `blog.css`.** Scope it with a class on `<body>` (`.letter`, `.maptable`) so a rule cannot leak into another post. Keep the top bar, byline and footer from `blog.css` recognisable. Write a rule for a paragraph inside the post as `.post .your-class`. A bare class loses to the post's own `.post p` rule, so the paragraph keeps the body size and colour and the new rule looks broken.
- **Regenerate after any change to a post's head** and after adding a post: `bun scripts/generateSeoBlocks.js && bun scripts/generateSitemap.js && bun scripts/generateFeed.js` (automatic with lefthook). The drift tests in `scripts/` fail otherwise.
- **Posts carry no deploy stamp.** Their `article:published_time` is the date that matters.

### Drawings and animations

- **Charts and diagrams are inline SVG.** No chart library. A chart is written once from the data (a throwaway script is fine): a post is dated content and does not update when the data changes. Use a logarithmic axis when the series differ by more than ten times, and say so on the chart.
- **Style the parts of a drawing once for the whole post**, under the class the figures share (`.diagram` in the AI World Gen post), never under one figure's own class. A drawing that borrows a class name scoped to another figure gets no style at all: black boxes and 16-pixel black text, which is invisible on a dark page. After you add a drawing, check in the page that every label has a colour, a size under 15 pixels, and room inside its box, and that no two labels or label lines cross.
- **An animation is CSS inside the inline SVG, never a script.** Animate with `@keyframes` and per-element `animation-delay`, and give it a still end state under `prefers-reduced-motion` (`css/global/base.css` cuts every animation short, so the page must end on the finished picture, not a half-drawn one). The fill loop in the AI World Gen post and both drawings in `why-a-blog-now/` are the examples.
- **Put two things that must stay in step in one keyframe rule on one element.** A second, delayed animation drifted behind in real browsers (the fill loop's outline and tile).
- **Check an animation by pinning it, not by waiting.** A hidden browser pane runs no clock, and headless Chrome's `--virtual-time-budget` skips frames of animations that change in steps, so both show wrong frames. Load the post in a temporary same-origin page that calls `pause()` and sets `currentTime` on every animation of the post, screenshot that page, then delete it. Pinning proves the design but hides drift, because it sets every animation to the same moment.

Whenever you add or rework a post, use the `add-blog-post` skill.
