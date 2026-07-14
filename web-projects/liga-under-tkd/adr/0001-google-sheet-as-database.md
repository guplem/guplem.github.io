# ADR 0001: Google Sheet as the Live Database for Liga UNDER

## Context

`web-projects/liga-under-tkd` is a public site for a one-day taekwondo tournament. During the event,
several assistants must update combat results **live and simultaneously**, and 20-100 spectators
watch the standings update in near real time. Constraints: no paid hosting, no server to operate,
and non-technical assistants entering data.

Options considered for the data layer:

- **A real backend + database** (Node/Postgres, Firebase, etc.). Real-time and robust, but needs
  hosting, accounts, and maintenance. That is overkill for a single day, and not free/zero-ops.
- **An all-in Google Apps Script web app.** One platform, but its free quotas and
  simultaneous-execution caps become a risk at ~100 concurrent viewers polling.
- **A Google Sheet read directly by the browser.** Free, zero-ops, and assistants already know how
  to edit a spreadsheet with built-in multi-user real-time collaboration.

Two ways to read a Sheet from the browser:

- **"Publish to web" CSV**: simple, but Google caches it for minutes, which is bad for live scores.
- **The gviz endpoint** (`/gviz/tq?tqx=out:json`): reflects edits within seconds, needs no API key,
  and is served from Google's CDN so reads do not consume any Apps Script quota.

The official Sheets API was rejected: its per-minute quota could be exhausted by ~100 polling
visitors, and it requires an API key.

## Decision

The **Google Sheet is the database**. Static files on GitHub Pages are the host. The browser reads
the Sheet directly through the **gviz endpoint** and **polls** the live `Combats` tab about every
25 seconds (the static `Players` and `Groups` tabs are read once at load). The Sheet is shared
"anyone with the link: Viewer".

The gviz response (JSON wrapped in a JS function call) is parsed by a pure module (`sheet.js`) and
normalized into typed records by exact header strings. The website computes all derived data
(results, league points, standings, cross-table); only raw scores and statuses are typed by hand.

Resilience rules: keep the last good data on a failed fetch and retry next cycle; pause polling
while the tab is hidden (Page Visibility API); re-render only the data region so the user's scroll
and search input are not disturbed. When no Sheet ID is configured, the app falls back to bundled
mock data ("Demo mode").

## Consequences

**Positive:**

- Zero hosting cost and zero server operations; assistants edit a familiar spreadsheet.
- Edits appear on the site within seconds (gviz is not cached like the published CSV).
- No API key, no quota tied to viewer count (reads come from Google's CDN).
- The data contract is testable: the parser and the scoring engine are pure and unit-tested.

**Negative:**

- gviz is an **unofficial** endpoint. It has been stable for years; if it ever breaks, the fallback
  is the published CSV (accepting its cache lag). This risk is the reason parsing is isolated in one
  module.
- All sheet data is public. This is acceptable here (names and results only; consent given), but private
  fields must never be added to the sheet.
- Column headers are a hard contract: renaming a header in the Sheet breaks the matching normalizer
  until updated. Documented in SETUP.md and the project AGENTS.md.
