# web-projects/global-news-map/AGENTS.md

> **SCOPE:** files under `web-projects/global-news-map/`. Read `web-projects/AGENTS.md` first for the rules that cover every web-project.

## What this is

A world map of one day's news. The stories come from Wikipedia's Current Events
portal, one page per day, and each story is pinned on the most specific place it
names. Vanilla ES modules, no build step.

Human docs: [README.md](README.md). Decision records:
[ADR 0001](adr/0001-wikipedia-current-events-as-the-news-source.md),
[ADR 0002](adr/0002-place-a-story-by-the-smallest-linked-place.md),
[ADR 0003](adr/0003-draw-the-map-from-carried-coastlines.md),
[ADR 0004](adr/0004-on-a-phone-the-list-drives-the-map.md),
[ADR 0005](adr/0005-a-fixed-set-of-ten-categories-with-a-fallback.md).

## Module map (pure logic is separated from the DOM so it can be unit-tested)

| File | Pure? | Responsibility |
|---|---|---|
| `calendar.js` | yes | Which day is shown, and its Wikipedia page title. Every date is UTC. |
| `stories.js` | yes | One day's portal HTML into stories: text, category, topic trail, sources, linked titles. |
| `categories.js` | yes (data) | The ten categories the portal uses, the words that name each one (`classifyCategory`), and an icon for each (`CATEGORY_ICONS`). See ADR 0005. |
| `places.js` | yes | Which point a story belongs to: candidate titles, the coordinate index, the specificity ranking, how a place is written (`placeLabel`, `countryName`), which places need a country (`placeTitlesOf`), and grouping by place (`storyIdsAtPlace`, `nextPlaceOnMarker`). |
| `geo.js` | yes | Degrees to pixels, pan, zoom, the grouping of pins that overlap, and `groupMatesOf` to name every story sharing one marker. |
| `reading.js` | yes | The list as the reader uses it: `summarise` folds a story to a summary, and `topmostRow` says which row stands at the top of the scrolling list. |
| `world.js` | yes (data) | The world's coastlines. Generated; see `buildWorld.js`. |
| `i18n.js` | yes | Every word the page says, in English and Spanish. |
| `urlState.js` | yes | Reading and writing the address bar (root ADR 0006). |
| `deployStamp.js` | yes | The "deployed at" line (root ADR 0013). |
| `portalFixture.js` | yes | Test-only. A real portal page, kept as the parser's spec. |
| `dataSource.js` | no | The **only** file that calls `fetch`. Three requests a day: the portal page, the coordinates, and the Wikidata country lookup. Only the first two block. |
| `buildWorld.js` | no | Dev-only. Rebuilds `world.js` from Natural Earth. Never runs in the page. |
| `app.js` | no | The page: canvas, pointer, elements. |

Data flow: `app.js` → `dataSource.loadDay` → `stories.parseCurrentEvents` →
`places.collectTitles` → the coordinates request → `places.buildGeoIndex` →
`places.locateStories` → `geo.project` → `geo.clusterPoints` → canvas, and
`geo.groupMatesOf` off the same grouping → the list's highlight.

The two layouts: `app.js` asks `matchMedia("(min-width: 60rem)")` and `style.css`
uses the same query, once each, so they can never disagree about which layout is
on screen. Wide puts the map and the reading column side by side. Narrow fixes
the day and the map to the top of the screen and scrolls only the list, where
`reading.topmostRow` decides which story the map marks. See ADR 0004.

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
- **The country lookup must never block the map. Never `await` it in `loadDay`.**
  A country is a label on a pin, not the pin. An earlier version awaited it and a
  reader reported the page as stuck on "Looking up where it happened": the map took
  6.5 seconds to appear. It now runs behind the finished map and calls
  `onCountries`, which rewrites the labels in place. Measured after the fix: the
  map draws in 1.06s and the names arrive 0.4s later.
- **Ask only about the places that carry a pin.** `placeTitlesOf` picks them. A day
  finds about forty places and pins about sixteen, because a story names its
  country and province as well as its town. Measured on one real day: forty titles
  took 6032ms, sixteen took 279ms. A SPARQL query's cost climbs faster than its
  length, so the invisible places were most of the wait.
- **A place spanning several countries gets none.** The Strait of Hormuz really
  answers Iran, Oman and the UAE, and picking one would be wrong.
- **A country is never written after itself.** "Niger, Niger" reads as a mistake,
  and a title such as "Barah, Sudan" already carries it. `placeLabel` holds both
  checks.
- **The language is chosen once, at start-up, and the page shows no picker.**
  `pickLanguage` reads the `lang` parameter, then the browser's own languages.
  There is no `setLanguage` and nothing rewrites the page's words after start-up,
  so a picker cannot be added back without one. ADR 0004 says why it went.
  A place label is still language-dependent ("Caen, France" becomes "Caen,
  Francia"), which is why `renderLists` runs again when the countries arrive.
- **The page opens on yesterday, not today.** Editors fill today's page as the day
  goes on, so at 01:00 UTC it is nearly empty and the map looks broken.
  `defaultDay()` is what encodes that; do not "fix" it to today.
- **Every date is handled in UTC.** The portal's day boundary is UTC, so a local
  reading shows a reader in Sydney a different day from a reader in Los Angeles,
  and shows one of them an empty map for part of every day. `calendar.js` has no
  local-time call in it; keep it that way.
- **The portal writes a category heading two ways, and both must be read.** A day
  since about 2019 writes `'''Law and crime'''`, which arrives as `<p><b>…</b></p>`.
  Every day before that writes `;Law and crime`, which arrives as
  `<div class="current-events-content-heading">`. `stories.js` read only the bold
  form for a long time, so **every story before 2019 carried no category at all**.
  The bug hid because the category was shown only inside an opened row. Never
  drop either branch, and check any parser change against a day from each era.
- **The set of categories is a convention, not a rule.** Ten headings carry more
  than 99% of every story, but nothing on Wikipedia enforces them, and about one
  new typo appears each year ("Sience and technology" is real). `classifyCategory`
  answers null for a heading it cannot read, and the page then prints the portal's
  own words with no icon. Null is a normal answer; never make it throw, and never
  make the code guess between two categories. ADR 0005 holds the survey the ten
  came from.
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
  which is why `style.css` sets `aspect-ratio: 2 / 1` rather than a height. Give
  it no floor either: a `min-height` did exactly that on a phone, and a reader
  reported the empty ocean it made. A `max-height` is safe, because it only
  crops the map on a screen too short for the world's own shape.
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
- **Both groups are captured once, not recomputed on every frame.** `captureGroup`
  writes them when the selection changes, and `clearSelection` empties them. Only
  `pinGroup` depends on the zoom, and it must not move under the reader, so
  `captureGroup` runs **before** any centring moves the view: the marker it reads
  is the one the reader chose.
- **One marker on screen is NOT one location. Never confuse the two.** This is the
  most important rule in this file, because breaking it looks fine in every test
  written from made-up data. `clusterPoints` groups pins by distance in pixels, so
  a marker can cover several real places: Aarau in Switzerland and Amsterdam in
  the Netherlands land about six pixels apart at the opening zoom on a phone. A
  reader saw a Swiss shooting listed under the heading "Amsterdam, Netherlands".
  - `state.group` is the stories at **one place**, keyed on `place.title` through
    `storyIdsAtPlace`. The panel and the list marks use this, and only this, so
    the panel's heading is always true of every story under it.
  - `state.pinGroup` is the stories on **one marker**, which may span places. It is
    used for two things only: the note saying the pin covers more, and stepping to
    the next place when the marker is chosen again.
- **Choosing a marker again steps to the next PLACE on it**, through
  `nextPlaceOnMarker`, never to the next story. Stepping by story meant a pin
  holding two Amsterdam stories and one Aarau story took three taps to reach
  Aarau.
- **Keep the "this pin also covers N more" note.** Without it the other places on a
  marker are unreachable in practice, because nothing on screen hints that they
  exist. The panel shows one place; the marker may hold several. The narrow
  layout shows no panel, so it carries the same fact as the "next place" button
  over the map. Both must stay.
- **The chosen location's stories all appear in the panel above the day's list**,
  on a wide screen. `renderSelectedPanel` builds it, one block per story, each
  with its own sources. A reader reported this twice: first that only one story
  was highlighted, then that only one appeared under the map. The whole place
  belongs in the panel. The narrow layout hides the panel and opens each row in
  place instead; the rows sharing the place still carry `data-grouped`.
- **The panel marks no story as "the one you tapped".** It used to draw a bar down
  the side of it, and a reader asked what the bar meant. That was the answer:
  nothing worth a mark. Every story in the panel is at the same place, and all of
  them are meant to be read.
- **The day's list always keeps the portal's own order.** An earlier version lifted
  the chosen group to the top of it. That is now wrong: the panel already shows
  those stories in full, so promoting them again printed each of them twice.
- **`refreshHighlight` toggles attributes on existing rows; it never rebuilds.**
  Rebuilding would throw away keyboard focus, fold up any story the reader had
  opened, and move the list under a reader who is scrolling it. `selectStory` and
  `clearSelection` therefore call `refreshHighlight`, never `renderLists`. Only a
  new day and the arrival of the countries rebuild the rows.
- **A mark on a row must never change how tall the row is.** The open row's bar is
  an inset `box-shadow`, not a thicker border: a border makes the text narrower,
  the row rewraps, and every row below it jumps while the reader scrolls. The same
  rule is why the "next place" button stands over the map and not in the layout:
  the reader scrolling the list makes it come and go.
- **A folded row carries the place and the category, and the chip is the quieter
  of the two.** `.item-head` puts the place on the left and the category chip on
  the right. The chip's icon takes the accent colour and its name is muted, so the
  row still leads with where the story happened. A chip in the same loud orange as
  the place made the two compete, and the full name shouted over the headline.
- **The chip is the only place the category is written.** It stands on the folded
  row and widens to the full name when the row opens, so `item-more` holds the
  sources and nothing else. Putting a category line back inside the opened row
  prints it twice.
- **`toggleStory` eases the row's height, and that is the only way to ease it.**
  Opening a row swaps the summary for the whole text **and** reveals the sources
  at the same moment. Neither of those can be transitioned on its own, so
  `animateHeight` measures the row before and after the change and animates
  between the two numbers. The row already clips what it holds, which is what
  makes the content slide rather than jump. Both `animateHeight` and `fadeIn`
  return early under `prefers-reduced-motion`, and `style.css` makes the same
  check for the chevron's turn, so the two halves always agree.

### The narrow layout (ADR 0004)

- **The story at the top of the list is the one the map marks, and the two are
  linked both ways.** `followList` reads the top of the list on each scrolled
  frame; `revealInList` scrolls the list when the map is tapped. Breaking either
  half leaves the reader with a map and a list that disagree.
- **`travellingTo` is what stops the two halves fighting.** A scroll started by
  the map passes over other rows on its way, and each of those would otherwise be
  read as a new choice and undo the tap. It is cleared when the story arrives, or
  the moment the reader touches the list themselves.
- **Never show the panel on a phone, and never rebuild the list while it
  scrolls.** Both live inside the scrolling column, so either one resizes that
  column as the selection follows the scrolling, which scrolls it again. That is
  a loop, not a glitch.
- **Nothing that the selection changes may take room in the phone's layout.**
  The same trap, one step out: the selection follows the scrolling, so a box that
  grows or appears with it moves the list under the reader's eyes. Anything the
  selection changes goes over the map, the way the "next place" button does. A
  line under the map held the chosen place for one version, and it went for this
  reason and because the reader is reading that place in the list anyway.
- **The counts stay off the phone.** `renderCounts` marks the pill
  `data-state="counts"` and `style.css` hides that one state on a narrow screen,
  so the pill still carries the loading line, the empty day and the failure.
  Nobody waits for the counts, and the pill stands over the map.
- **The footer carries a `min-height` of nearly a screen, and it is load-bearing.**
  The last story can only reach the top of the list, and so be the story the map
  marks, when something below it can still scroll. Delete that rule and the last
  rows can never be chosen, and a pin tapped for one of them scrolls as far as it
  can and is then overruled by `followList`.
- **The address bar is written once the scrolling stops.** Browsers cap how often
  a page may call `history.replaceState`, and a long scroll changes the open story
  many times a second. `selectStory({ url: false })` is what defers it.
- **A story the reader opened stays open when the rows are rebuilt.** The ids live
  in `state.expanded`, not in the DOM, because the countries land about half a
  second after the map and rebuild every row.
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

Every pure module that holds logic has a sibling `*.test.js`, and new behaviour
goes in test-first (root ADR 0012). Two pure files carry data instead of logic and
so have no test of their own: `world.js` is generated, and `stories.test.js` reads
`portalFixture.js`. `app.js`, `dataSource.js` and `buildWorld.js` have
none by design; anything in them worth a test belongs in a pure module instead.

`categories.test.js` also guards `i18n.js`: it fails when one of the ten
categories has no short or full name in a language, or when a short name is
longer than the full one it stands in for.

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
| [0004](adr/0004-on-a-phone-the-list-drives-the-map.md) | On a phone the map holds still and the list drives it |
| [0005](adr/0005-a-fixed-set-of-ten-categories-with-a-fallback.md) | A fixed set of ten categories, and the portal's own words when it is none of them |
