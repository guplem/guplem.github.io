# ADR 0001: Wikipedia's Current Events portal as the news source, not a news API

## Context

The project needs a feed of world news with locations, read straight from the
browser. That last part rules out most of the options before quality is even
considered. A web-project here is a static page on GitHub Pages, so:

- **A key cannot be secret.** Anything in the page's JavaScript is public, so an
  API that needs a key is an API that leaks its key.
- **The service has to send CORS headers.** Without
  `Access-Control-Allow-Origin` a browser refuses to read the response, even
  though the same request works from a terminal.

Each candidate was tested live rather than taken from its documentation, in
August 2026:

| Source | Result |
|---|---|
| **Wikipedia Current Events portal + GeoData** | Works. No key. CORS with `origin=*`. Curated by people, about 15 stories a day, each with real sources. |
| Wikidata SPARQL | Works, no key, CORS `*`. Good for enriching one place; too slow and too complex as the feed. |
| GDELT DOC 2.0 | Works, no key, CORS `*`, enormous volume. But it reports the **publisher's** country, not where the event happened. Wrong data for a map. |
| GDELT GEO 2.0 | **Dead.** Its own documented URL returns `404`, including `?query=trump&mode=country`. This was the ideal endpoint on paper. |
| ReliefWeb | **Out.** Now answers `403: You are not using an approved appname`. Needs registration. |
| USGS earthquakes | Works, CORS `*`. Real disaster data, but it is not news. |

## Decision

Read the news from Wikipedia's Current Events portal, and get locations from
Wikipedia's own GeoData for the articles each story links.

One day costs three requests: one `action=parse` for the day's page, and two
`action=query&prop=coordinates` calls covering about 90 linked titles in batches
of 50.

Nothing else is federated in. A second source would need its own location model,
its own licence line and its own failure mode, and the portal already answers the
question the project asks.

## Consequences

**What this buys.**

- No key, no account, no registration, no rate-limit deal to strike.
- The stories are written and checked by people, so the text is readable and the
  sources are real. A volume feed would need summarising before it could be shown.
- Locations are the event's, not the publisher's. This is the thing GDELT could
  not give.
- One organisation to credit, one licence to honour, one failure mode to handle.

**What it costs.**

- **About 15 stories a day, not thousands.** This is a curated digest, not a
  firehose. It is the right size for a map a person reads, and it means the map is
  never crowded.
- **Today's page fills in as the day goes on.** At 01:00 UTC it is nearly empty.
  The page therefore opens on *yesterday*, which is always complete.
- **The portal is English Wikipedia's.** The interface speaks Spanish too, but the
  stories themselves are in English. Translating them is not on the table: they
  are quoted text under CC BY-SA.
- **A day before the portal existed has no page.** The page says so and offers the
  day before, rather than showing an empty map.
- **Wikipedia's editorial choices are inherited**, including which stories are
  considered notable enough to list.

**Obligations.** Portal text is CC BY-SA 4.0. The footer credits the portal, links
the exact day's page, and names the licence. Removing that credit is a licence
breach, not a design tweak.

**If this ever needs replacing**, `dataSource.js` is the only file that fetches,
and `stories.js` is the only file that knows the portal's shape. A different
source means rewriting those two and nothing else.
