# web-projects/global-news-map/AGENTS.md

> **SCOPE:** files under `web-projects/global-news-map/`. Read `web-projects/AGENTS.md` first for the rules that cover every web-project.

## What this is

A world map of one day's news. The stories come from Wikipedia's Current Events
portal, one page per day, and each story is pinned on the most specific place it
names. Vanilla ES modules, no build step.

Human docs: [README.md](README.md). Decision records:
[ADR 0001](adr/0001-wikipedia-current-events-as-the-news-source.md),
[ADR 0002](adr/0002-place-a-story-by-the-smallest-linked-place.md),
[ADR 0003](adr/0003-draw-the-map-from-carried-coastlines.md).

## Module map (pure logic is separated from the DOM so it can be unit-tested)

| File | Pure? | Responsibility |
|---|---|---|
| `calendar.js` | yes | Which day is shown, and its Wikipedia page title. Every date is UTC. |
| `stories.js` | yes | One day's portal HTML into stories: text, category, topic trail, sources, linked titles. |
| `places.js` | yes | Which point a story belongs to: candidate titles, the coordinate index, the specificity ranking, how a place is written (`placeLabel`, `countryName`), and the list order (`pinsWithGroupFirst`). |
| `geo.js` | yes | Degrees to pixels, pan, zoom, the grouping of pins that overlap, and `groupMatesOf` to name every story sharing one marker. |
| `world.js` | yes (data) | The world's coastlines. Generated; see `buildWorld.js`. |
| `i18n.js` | yes | Every word the page says, in English and Spanish. |
| `urlState.js` | yes | Reading and writing the address bar (root ADR 0006). |
| `deployStamp.js` | yes | The "deployed at" line (root ADR 0013). |
| `portalFixture.js` | yes | Test-only. A real portal page, kept as the parser's spec. |
| `dataSource.js` | no | The **only** file that calls `fetch`. Three requests a day: the portal page, the coordinates, and the Wikidata country lookup. |
| `buildWorld.js` | no | Dev-only. Rebuilds `world.js` from Natural Earth. Never runs in the page. |
| `app.js` | no | The page: canvas, pointer, elements. |

Data flow: `app.js` → `dataSource.loadDay` → `stories.parseCurrentEvents` →
`places.collectTitles` → the coordinates request → `places.buildGeoIndex` →
`places.locateStories` → `geo.project` → `geo.clusterPoints` → canvas, and
`geo.groupMatesOf` off the same grouping → the list's highlight.

## Non-obvious conventions and gotchas

- **`origin=*` is required on every Wikipedia request.** Without it Wikipedia
  answers without the CORS header, so every request fails in the browser while
  still working from a terminal. That asymmetry is a confusing way to lose an
  afternoon. `dataSource.js` sets it once, for every call; keep it there. Wikidata
  sends the header always and needs no such parameter.
- **A place's country comes from Wikidata alone, as an ISO code.** Wikipedia's own
  `country` field exists and is **not** read. It is editor-supplied and wrong in
  ways that show: it tags the article "Turkey" as a `city`, and mixing it in made
  the page print "Turkey, Türkiye". `buildGeoIndex` therefore sets `country: null`
  always, and `fetchCountries` asks Wikidata for every place in one request.
  Asking for the country's **name** instead of its code would arrive in one
  language and would not match the names the codes produce, so **never** switch it
  to a label. `countryName` turns a code into a name with `Intl.DisplayNames`, so
  both languages come free and every country is spelled one way.
- **The query excludes countries structurally, never by comparing names.**
  `FILTER NOT EXISTS { ?item wdt:P297 ?own }` drops any place holding an ISO
  country code of its own, which is exactly the countries, so "Turkey", "Jordan"
  and "Niger" come back with nothing. A name comparison cannot do this job:
  "Turkey" and "Türkiye" are one country, and "Jordan" is "Jordania" in Spanish.
  Both of those really did print wrongly before the filter went in.
- **`placeLabel` compares against the country name in both the reader's language
  and English.** The title is always English, the country follows the page, so
  "Barah, Sudan" turns into "Barah, Sudan, Sudán" if only one is checked.
- **Wikidata is optional; Wikipedia is not.** `fetchCountries` returns an empty map
  on any failure, and the day still loads showing bare place names. Keep it that
  way: a country is a smaller loss than a day that will not open. It does mean no
  countries at all when Wikidata is down, which is the accepted price of not
  mixing in Wikipedia's unreliable field.
- **A place spanning several countries gets none.** The Strait of Hormuz really
  answers Iran, Oman and the UAE, and picking one would be wrong.
- **A country is never written after itself.** "Niger, Niger" reads as a mistake,
  and a title such as "Barah, Sudan" already carries it. `placeLabel` holds both
  checks.
- **A place label is language-dependent, so the list is rebuilt on a language
  change.** "Caen, France" becomes "Caen, Francia". `setLanguage` calls
  `renderLists` for exactly this reason; dropping that call leaves stale rows.
- **The page opens on yesterday, not today.** Editors fill today's page as the day
  goes on, so at 01:00 UTC it is nearly empty and the map looks broken.
  `defaultDay()` is what encodes that; do not "fix" it to today.
- **Every date is handled in UTC.** The portal's day boundary is UTC, so a local
  reading shows a reader in Sydney a different day from a reader in Los Angeles,
  and shows one of them an empty map for part of every day. `calendar.js` has no
  local-time call in it; keep it that way.
- **The leaves of the portal's list are the stories.** An item that holds a list
  is a running topic, not a story. Parsing every `<li>` as a story invents
  headline-shaped entries such as "2026 Iran war" that have no text of their own.
- **Cut the page down to the content block before parsing.** The portal's heading
  carries an "edit / history / watch" list whose items look exactly like story
  items, so parsing the whole page invents a story called "edit".
- **A story's place comes from its links, and nothing reads the sentence.**
  Wikipedia geotags places and not ideas, so asking the API for coordinates on
  every linked title separates the places from the rest for free. See ADR 0002.
- **`dim` decides which place wins, and `TYPE_FLOOR` guards it.** `dim` is the
  size of a place in metres and it is editor-supplied, so a country occasionally
  carries a tiny one. The floors in `places.js` say "whatever the number claims, a
  country is country-sized". Never change `max` to `min` there.
- **Known limit, do not treat it as a bug:** a province with no `type` and a small
  `dim` can outrank the town inside it, and an organisation's headquarters can win
  a story that is really about somewhere else. The pin lands in the right region
  rather than on the exact spot. Measured against a real day, 14 of 15 stories were
  placed and the misses were of this kind. Fixing it needs a Wikidata `P31`
  lookup, which one batched query answers for a whole day, so it costs one request,
  not one per story. ADR 0002 carries the corrected reasoning.
- **`buildGeoIndex` must follow `normalized` and `redirects` back.** Wikipedia
  answers under the title it prefers, not the one we asked about. Skip the
  follow-back and every story that links a redirect silently loses its pin.
- **Titles go out in batches of 50.** That is the API's limit for one request. A
  day is about 90 titles, so a day costs two coordinate requests plus one for the
  page.
- **`clusterPoints` sorts before grouping.** Greedy grouping depends on the order
  it sees points in, so without the sort the same day could group differently
  between two redraws and pins would appear to jump while the reader did nothing.
- **The projection is equirectangular and the canvas is 2:1.** The height of the
  world is always half its width; that ratio *is* the projection. Give the canvas
  another shape and the map sits in a band of empty ocean at the opening zoom,
  which is why `style.css` sets `aspect-ratio: 2 / 1` rather than a height.
- **`app.js` never writes `innerHTML`.** Story text comes from Wikipedia, which
  anyone can edit. Every string reaches the screen through `textContent`, so
  there is nothing to escape and no way for an edit to become markup. The one
  exception is the deploy line, which needs a link inside a sentence and carries
  its own escaper. A new `innerHTML` here is a new escaping bug.
- **The credit sentence is built by splitting the message on its own slots.** It
  holds two links, and `textContent` cannot carry a link. `say` with no values
  leaves `{portal}` and `{licence}` in place, which is what makes that work.
- **The story list is the accessible copy of the map.** The canvas is
  `role="img"` with a label, and every story is a real button in the list, so a
  keyboard and a screen reader reach every story without touching the canvas.
  Never move a story's only route to the screen into the canvas.
- **A marker holding several stories must highlight all of them in the list.**
  One marker reading "5" stands for five stories, and marking only the open one
  makes the other four look unrelated to the pin the reader just tapped. This was
  reported. Two marks carry it: `aria-current` on the one open story, and
  `data-grouped` on the others sharing its marker. `refreshHighlight` owns both,
  so `storyItem` must not set either while building a row.
- **The chosen group is captured once, not recomputed on every frame.** It lives
  in `state.group`, written by `captureGroup` when the selection changes and
  cleared when it clears. The grouping does depend on the zoom, so an earlier
  version re-read it on every draw. That became wrong the moment the list started
  putting the group at the top: re-reading it mid-pinch reshuffled the rows under
  the reader. Choosing again is what re-reads it. `captureGroup` therefore runs
  **before** any centring moves the view, so the group is the one the reader saw.
- **The list puts the chosen group at the top, as one block.** `pinsWithGroupFirst`
  does it, and both halves keep the portal's own order. This is what a reader asked
  for: a marker reading "5" should put its five stories where they are already
  looking, not leave them scattered down the list.
- **`refreshHighlight` toggles attributes on existing rows; it never rebuilds.**
  Rebuilding would throw away keyboard focus.
- **A tap is told from a drag by distance, not by time.** Without that check a
  drag that ends over a pin opens a story the reader never asked for.
- **The map redraws from scratch every frame that changes.** The whole world is
  109 outlines and about 5,000 points, so it is cheap, and it removes the class of
  bugs where the screen and the state disagree. Do not add partial redrawing.
- **`world.js` is generated. Never hand-edit it.** `bun buildWorld.js` rebuilds it
  from the Natural Earth TopoJSON named at the top of that script. The page must
  keep working with no network beyond Wikipedia, so the coastlines ship with it.
- **`portalFixture.js` is a real response, not a hand-written sample.** Refresh it
  only with another real response. The parser has to survive the portal's actual
  nesting, its redirect links and its non-breaking spaces.

## Tests

Every module marked "Pure" above has a sibling `*.test.js`, and new behaviour goes
in test-first (root ADR 0012). `app.js`, `dataSource.js` and `buildWorld.js` have
none by design; anything in them worth a test belongs in a pure module instead.

```bash
cd web-projects/global-news-map && bun test
```

No test reaches the network. `dataSource.js` is the only file that could, and the
parsing it feeds is tested against `portalFixture.js` instead. Keep it that way:
a test that needs Wikipedia fails in CI for reasons of its own.

## Architecture Decision Records

| ADR | Topic |
|---|---|
| [0001](adr/0001-wikipedia-current-events-as-the-news-source.md) | Wikipedia's Current Events portal as the news source, not a news API |
| [0002](adr/0002-place-a-story-by-the-smallest-linked-place.md) | Place a story by the smallest place it links, and read no sentences |
| [0003](adr/0003-draw-the-map-from-carried-coastlines.md) | Draw the map from coastlines the page carries, not from map tiles |
