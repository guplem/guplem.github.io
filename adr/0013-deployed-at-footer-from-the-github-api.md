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

A first version asked GitHub and nothing else. A player then reported that the
line was not there at all. The code was correct and deployed, but the API had not
answered, and the page drew an empty line. **A blank line is indistinguishable
from a missing feature**, so "fail quietly" turned out to mean "fail invisibly",
and the reader had nothing to act on.

## Decision

**The footer names the pull request when GitHub answers, and always shows at
least the moment this page was published, which it reads from the page itself.**

Three sources, best first. The first one that answers wins:

1. **The pull request that last changed this project.** Two anonymous calls:
   `GET /repos/{repo}/commits?path={project}&sha=main&per_page=1`, then
   `GET /repos/{repo}/commits/{sha}/pulls`. The pull request's `merged_at` is the
   deploy time, because merging into `main` is what publishes the site.
2. **The commit that last changed it**, when no pull request carried it. The line
   links the commit instead.
3. **The `Last-Modified` header of this page**, read with one `HEAD` request to
   the page's own address. GitHub Pages sets it to the moment the site was
   published. It is same-origin, so no allowance limits it and no other service
   has to answer.

With none of the three, the line still names the branch and links the folder's
commit history, so a reader always has somewhere to go.

Rules the line follows:

- **It may never matter that it failed, and it may never be blank.** Those are
  two rules, not one. It is started without being awaited and it never throws, so
  a failure changes nothing else on the page; and it always draws, because a
  blank line reads as a bug. A failed lookup also writes a line to the console,
  so the next report is diagnosable.
- **The answer is cached in `localStorage` for six hours** (root ADR 0007).
  Anonymous callers get 60 calls an hour per address and this needs two, so a
  visitor who reloads often must not spend them. A stale value is shown while a
  fresh one is on its way, so the line does not flicker away.
- **A refusal is cached too, for fifteen minutes.** Without that, a visitor who
  is out of anonymous calls spends two more on every single reload and never
  recovers. Fifteen minutes is short enough to heal on its own.
- **Every request gives up after eight seconds**, so a hanging call cannot leave
  the line waiting for ever.
- **The parsing is pure and tested** (`deployInfo.js`), against payloads copied
  from real API responses. Only `deployFooter.js` fetches, stores or draws, and
  it is tested too: it takes the element, the message lookup and the escaper as
  arguments, so stubs for `fetch`, `localStorage` and `location` are enough. The
  reported bug lived in that file, not in the pure one.

## Consequences

**Positive:**

- No build step, no workflow, no machine commits: the page reads facts that
  already exist.
- The line is accurate per project. It reports the last change to *that* folder,
  not the last change to the site.
- A reader can go from the live page to the pull request, its description and its
  diff, in one click.

- The line survives GitHub being down, blocked or exhausted. It loses the pull
  request number and keeps the date.

**Negative:**

- The page now makes network calls it did not make before. For a tool that
  advertises doing its work locally, the footer text must stay precise: the
  picture is still read in the browser and never uploaded, and the wording says
  exactly that rather than claiming the page never talks to anything.
- Anonymous API calls are rate limited. The cache keeps a normal visitor far
  inside the limit, but a shared address behind one gateway could exhaust it, and
  the line then shows the publish time without the pull request.
- The pull request number depends on GitHub being up and the repository being
  public. The date does not.
- The two dates answer different questions. Sources 1 and 2 answer "when did this
  project last change"; source 3 answers "when was this site last published".
  They agree when the last deploy carried this project, and drift apart when it
  did not. Each wording says which one it is showing, and neither claims the
  other.
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
