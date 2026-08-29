# ADR 0013: "Deployed at" footer read from the GitHub API at run time

## Context

A visitor looking at a web-project cannot tell how old it is, or what change
produced the version in front of them. The wish was for a footer line naming the
deploy time **and the pull request that caused it**, so a reader can jump from the
live page to the change that made it.

The site has no build step (ADR 0002) and is published by classic GitHub Pages,
straight from the `main` branch. Nothing runs between the merge and the page
going live, so there is no natural moment to stamp a version into the HTML.

The options:

- **Generate it at commit time**, the way `sitemap.xml` and the static SEO blocks
  are generated (ADR 0010). It does not work here. That machinery is a pre-commit
  hook plus a CI drift test, and it depends on the artifact being a pure function
  of the committed data. A deploy time is not: the commit does not know when it
  will merge, and it cannot know its own pull request number, because the pull
  request does not exist yet. The drift test would also fail on every commit,
  since the stamp changes each time.
- **Write it from a workflow on push to `main`**, committing the result back.
  That works, but it puts a machine commit on `main` after every merge, and it
  needs care to avoid a loop. It buys accuracy the page does not need.
- **Switch Pages to an Actions deployment** and generate the stamp into the
  artifact. Cleanest technically, but it replaces a built-in service with a
  workflow the repository has to own, to add a footer line.
- **Ask GitHub at run time.** The facts are already in the repository's history,
  and the public API serves them without a key.

## Decision

**The footer asks the GitHub API, in the visitor's browser, for the newest commit
that touched the project's folder and the pull request that carried it.**

Two calls, both anonymous:

1. `GET /repos/{repo}/commits?path={project}&sha=main&per_page=1`
2. `GET /repos/{repo}/commits/{sha}/pulls`

The pull request's `merged_at` is the deploy time, because merging into `main` is
what publishes the site. With no pull request, the commit's own date is used and
the line links the commit instead.

Rules the line follows:

- **It may never matter that it failed.** GitHub can be unreachable, or the
  visitor may have spent their hourly allowance of anonymous calls. The line then
  stays empty and nothing else changes. It is started without being awaited.
- **The answer is cached in `localStorage` for six hours** (root ADR 0007).
  Anonymous callers get 60 calls an hour per address and this needs two, so a
  visitor who reloads often must not spend them. A stale value is shown while a
  fresh one is on its way, so the line does not flicker away.
- **The parsing is pure and tested** (`deployInfo.js`), against payloads copied
  from real API responses. Only `deployFooter.js` fetches, stores or draws.

## Consequences

**Positive:**

- No build step, no workflow, no machine commits: the page reads facts that
  already exist.
- The line is accurate per project. It reports the last change to *that* folder,
  not the last change to the site.
- A reader can go from the live page to the pull request, its description and its
  diff, in one click.

**Negative:**

- The page now makes a network call it did not make before. For a tool that
  advertises doing its work locally, the footer text must stay precise: the
  picture is still read in the browser and never uploaded, and the wording says
  exactly that rather than claiming the page never talks to anything.
- Anonymous API calls are rate limited. The cache keeps a normal visitor far
  inside the limit, but a shared address behind one gateway could exhaust it, and
  the line then stays empty.
- The line depends on GitHub being up and the repository being public.
- The lookup runs per project folder, so a change elsewhere in the repository
  does not move the date even though the deploy republished the whole site. This
  is deliberate: "when did this project last change" is the useful answer.

## Scope and how it spreads

The first project to carry it is `sudoku-screenshot-coach`. New web-projects
should carry it too: `web-projects/AGENTS.md` describes the two files to copy.

The two files are **copied into each project**, not shared, because a web-project
is self-contained by rule and must not depend on another project or on the main
site. That rule has exactly one exception today, the directory index (ADR 0008).

**When a third project adopts this footer, promote it**: move the two files to a
shared place under `web-projects/`, and record the second exception to the
self-contained rule in an ADR of its own. Two copies is cheaper than a new
architectural exception; four copies is not.
