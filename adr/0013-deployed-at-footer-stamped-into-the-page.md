# ADR 0013: "Deployed at" footer stamped into the page

## Context

A visitor looking at a web-project cannot tell how old it is, or what change
produced the version in front of them. The wish was for a footer line naming the
deploy date **and the pull request that caused it**, so a reader can jump from the
live page to the change that made it.

The site has no build step (ADR 0002) and is published by classic GitHub Pages,
straight from the `main` branch. Nothing runs between the merge and the page
going live.

The first design read the facts from the GitHub API at load time, because they
already exist in the repository's history. It worked, and then it was wrong three
times in a row:

1. **It went blank.** GitHub did not answer, and the line drew nothing. A blank
   line is indistinguishable from a missing feature, so the reader had nothing to
   act on. Fixed by adding fallbacks: the commit, then the page's own
   `Last-Modified` header.
2. **It named the previous pull request for hours.** The answer was cached in
   `localStorage` for six hours to protect the 60 anonymous API calls an hour. A
   reader who loaded the page shortly before a deploy kept seeing the old number
   long after the new one shipped, and reloading did not help, because a reload
   does not clear `localStorage`. Fixed by storing the page's publish stamp
   beside the answer and re-asking when it changed.
3. **It could name a pull request the reader was not running.** The stamp check
   asks the server, so it sees what is published now. The browser may still be
   serving files it cached up to ten minutes earlier, because Pages sends
   `max-age=600` and this site has no hashed filenames to force a refetch. Old
   page, new number.

The third one has no fix inside that design. The line describes the server, and
the reader is looking at their browser's copy. Every patch made the machinery
larger: two source files and two test files had grown to 995 lines, holding a
cache, a backoff, a three-source fallback chain and a rate-limit budget, to print
one sentence.

Rejected alternatives, and why they lose to stamping the page:

- **Ask the API at load time.** The three failures above are inherent: an answer
  fetched at run time describes the site, not the file being read.
- **Write the stamp from a workflow on push to `main`.** It works, but it puts a
  machine commit on `main` after every merge and needs care to avoid a loop.
- **Switch Pages to an Actions deployment.** Cleanest technically, but it
  replaces a built-in service with a workflow the repository has to own, to add
  a footer line.

## Decision

**The pull request number and its date are written into the page's own `<head>`
before the pull request merges. Nothing is fetched at run time.**

- `scripts/generateDeployStamp.js --pr N --date ISO` writes two meta tags into a
  `<!-- BEGIN GENERATED:DEPLOY -->` block, using the marker convention of ADR
  0010. Every page under `web-projects/` that carries the marker is stamped.
- The `test` job runs the same script with `--check` on every pull request, using
  the number and creation date from the event. It fails when a page is not
  stamped with them. That check is inside the already-required job, so an
  unstamped or wrongly stamped pull request cannot merge.
- `deployStamp.js` reads the two tags and writes the line. It is pure, it makes
  no request, and it stores nothing.
- A page with no stamp still names the branch and links the folder's history, so
  the line is never blank. That happens only when the file is opened straight
  from the repository, where the committed placeholder reads as "no stamp".

**The stamp must live in the same file as the page it describes.** A separate
`deploy.json` fetched at load would be cached independently of the HTML, which
brings back failure 3 exactly.

**The date is the pull request's creation date, not its merge time.** A merge
time cannot be known before merging, and nothing dynamic is allowed. These pull
requests auto-merge on green CI, so the two are minutes apart, and the link goes
to the pull request where the exact merge time is shown.

## Consequences

**Positive:**

- The number is a property of the file. A browser serving a cached page serves
  that page's own stamp, so the line cannot describe a version the reader is not
  looking at. All three failures above become impossible rather than mitigated.
- The page makes **no network requests at all** now. For a tool whose selling
  point is that your picture never leaves your device, the claim is absolute
  again instead of carrying an exception for the footer.
- 995 lines of code and tests are deleted, along with the cache, the backoff, the
  fallback ranking and the rate-limit budget. What replaces them is roughly 100
  lines that read two meta tags.
- No API allowance to spend, so a popular page cannot exhaust it for its readers.

**Negative:**

- **Every pull request must stamp itself**, in a second commit after the pull
  request exists, because the number is not knowable before then. The required
  check makes this loud rather than silent, but it is a step that did not exist.
- **Two pull requests open at once conflict on the stamp**, since both rewrite
  the same two lines. The conflict is trivial (re-run the script), but it is
  friction the fetched version did not have.
- **The line is now site-wide, not per project.** Every stamped page gets the
  number of whichever pull request last shipped, even one that changed nothing in
  that project. The old design reported the last change to *that* folder. This
  says "the version you are reading came from #N", which is the more useful of
  the two for a reader and the only one a cached page can answer honestly.
- The committed page always shows a placeholder between deploys, so a developer
  opening `index.html` locally sees the "published from the main branch"
  fallback rather than a number.
