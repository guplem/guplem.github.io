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
| `geo.js` | yes | Degrees to pixels, pan, zoom, the grouping of pins that overlap, `groupMatesOf` to name every story sharing one marker, and `splitAtAntimeridian` to cut a coastline where it crosses the 180th meridian. |
| `reading.js` | yes | The list as the reader uses it: `summarise` folds a story to a summary, `topmostRow` says which row stands at the top of the scrolling list, and `tapUnfolds` says whether a tap on a row also opens it. |
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
- **Every coastline must be cut at the 180th meridian before it is drawn.** The
  180th meridian, or antimeridian, is where the map's east edge meets its west
  edge. Natural Earth spans it with a vertex at +180 next to one at -180, which
  is one place on a globe and two opposite sides of a flat picture. Draw the
  shape uncut and that pair becomes a straight line across the whole world. Four
  shapes carry such a pair: Eurasia where Chukotka runs past the meridian,
  Antarctica, Fiji and Wrangel Island. Three of them really did draw a line, for
  months, and a reader reported them. `geo.splitAtAntimeridian` cuts the shapes
  and `app.js` holds the result in `COASTLINES`, cut once at start-up because the
  answer depends on the data and never on the zoom. **Never draw `LAND_SHAPES`
  directly.** One closing edge across the world survives on purpose, and it is
  Antarctica's own bottom; `geo.test.js` allows that one and forbids a second.
- **The map moves when the reader has zoomed in, and holds still when they have
  not.** `moveMapToSelection` is the one place that moves it. Zoomed out, every
  pin is on screen and moving the map could only take the world away, which is
  what ADR 0004 first decided. Zoomed in, the map is a window and an off-window
  pin is invisible, which a reader reported. The zoom itself never changes when
  the map follows the list; only a tap on a row on a *wide* screen zooms in, to
  `CLOSE_ZOOM`. Never make the follow change the zoom: that is the exact thing
  ADR 0004 rejected.
- **The reader's hand always beats a slide.** `glideTo` runs one animation and
  `cancelGlide` stops it. Every input that sets `state.view` itself calls
  `cancelGlide` first: the drag, the pinch, the wheel, the two zoom buttons and
  the "whole world" button. Miss one and the slide fights the reader's finger.
- **The fold button carries an icon and no words.** It stands over the map's top
  left corner, and a word there covers a piece of the map: "Collapse map" took
  about a third of the width of a phone's map. It is a circle the size of the
  zoom buttons on the other corner, so every control over the map is the same
  target. Its name lives in `aria-label`, which is the only place a screen reader
  can now read it, so `renderChrome` **must not** write `textContent` on it: that
  would throw the icon away.
- **The collapsed map is still a live map, drawn and measured like the big one.**
  It is the same canvas, at 10rem wide or less, so `resizeCanvas` and `draw` run
  in both states and `renderMapCollapsed` calls them in that order on every
  change of size. `zoom` means "how many canvas widths the world is wide", so it is the
  same number at both sizes and the small map shows the same ground, drawn small.
  That is why it is worth keeping: zoomed in it is the neighbourhood of the story
  being read, and it follows the list exactly as the big map does.
- **`updateMarkers` must not run while the map is collapsed, and the small map
  must not group.** Both are the same trap seen from two sides. `clusterPoints`
  works in pixels, so on a canvas 160 wide every pin of the day falls into one
  marker; `state.pinGroup` is counted from that grouping and feeds the panel's
  "this pin also covers N more" note, which would then claim the whole day. So
  `updateMarkers` returns early on `state.mapCollapsed` and keeps the grouping
  the reader last saw at full size, and `draw` takes the `drawDots` path, which
  draws one plain dot per story straight from `state.pins`. `showDay` clears
  `state.markers`, because a grouping from a day that is gone must not be kept.
- **`drawDots` measures its dots against the canvas, never in fixed pixels.** The
  card gives the small map the width the day bar leaves, which is as little as 48
  pixels, and a fixed 2.5-pixel dot there covers a tenth of the world. A real day
  of fifteen stories drew Europe as one orange blob. The scale is the canvas width
  over 160, capped at one, so the map at the width it asks for keeps the dots it
  always had.
- **The small map is no map to work, and it is the one way back to the big one.**
  There is no "expand" button: the reader taps or clicks the small map itself.
  `pointerdown` and `wheel` return early on `state.mapCollapsed`, so a finger
  neither pans nor zooms it, and `style.css` puts `touch-action: auto` back on
  it, because with `none` a finger meaning to scroll the list is captured by a
  map too small to aim at. **A control needs a keyboard route, so
  `renderMapCollapsed` marks the canvas `role="button"` with `tabindex="0"` and
  the "Expand map" name for as long as it is small**, and gives back
  `role="img"` and the map's own name at full size. `canvas` answers Enter and
  Space there. Delete either half and the fold becomes a one-way door for a
  keyboard. **The focus passes between the two controls, in both directions.**
  The fold hides one and shows the other, and each stands where the other stood.
  Let the one the reader just pressed disappear under the focus and the focus
  falls to the document, which sends the next Tab back to the top of the page.
  `renderMapCollapsed` holds both hand-offs.
- **Collapsed, the whole stage is ONE card, and the day bar moves inside it.**
  A fold is a request for room to read, and a row of date buttons left above the
  card gives back most of the height the fold just won. Measured on a 360 by 780
  phone, with the map folded: everything above the list was 160 pixels tall and
  is now 88, so the scrolling list grew from 611 pixels to 674. Three parts carry
  it, and each one looks removable on its own:
  - `app.js` sets `data-collapsed` on `.stage`, **not** on `.map-wrap`, because
    the day bar is the wrapper's sibling and the card holds both.
  - `style.css` gives `.map-wrap` `display: contents` while the map is small, so
    the wrapper's box goes away and the day bar, the canvas and the pill stand in
    one flex row. Nothing moves between parents, so expanding puts every box
    back.
  - `.map-toggle` is hidden in the card. It only ever folds the map away now, so
    `renderChrome` writes its name once and `map.expand` names the canvas.
- **The pill stays in the card, and it takes a whole row of its own.** `flex: 1 1
  100%`. The pill is where "loading", "no news for this day" and "could not reach
  Wikipedia" are said, and a collapsed map must not swallow the one message the
  reader is waiting for. In the gap between the day and the small map, "Could not
  reach Wikipedia. Check your connection and try again." wrapped into a six-line
  ribbon. A full row also holds the card's shape steady: the pill comes and goes
  as a day loads, and the map must not hop between rows with it.
- **In the card the day is a stepper, and "Latest" is not in it.** The date box
  stands on top and the two arrows sit side by side under it, in a two-column
  grid. All four controls in one row beside the map left the map about 70 pixels
  wide, which is too small to read as a map. Stacked, the day takes the width of
  its own date box and the map keeps 128 by 64 pixels on any phone from 320
  pixels up. Four rules hold that block together:
  - **Place every cell by hand** (`grid-area` on `.day-field`, `#prev-day` and
    `#next-day`). Auto-placement gives the date box a row of its own the moment
    it spans two columns, so the arrows fall above and below it and the block
    grows to three rows and 106 pixels.
  - **"Latest" is dropped, not shrunk** (`display: none` on the card's
    `.text-button`). It is the one day control the reader can do without here,
    because the next-day arrow walks the same way, and dropping it is what buys
    the stepper its narrow column. The button is still on the full-size map, one
    tap away, so a reader deep in the past expands the map to jump back.
  - **A written `min-width` on the collapsed canvas is load-bearing.** A flex
    item's `min-width: auto` is its own content's width, a canvas carries an
    intrinsic width, and **a flex row wraps before it shrinks**. With `auto` the
    map refused to give up one pixel, wrapped onto a second line, and cost the
    height this card exists to save. The number is `3rem`, because the small map
    is the only way back to the big one and 48 by 24 pixels is the smallest
    target a finger should have to hit.
  - **The map stops at 8rem, which is the height of the stepper beside it.** The
    map is twice as wide as it is tall, so a wider map is a taller card, and this
    card should be no taller than the controls it holds.

  Measured at 320, 360, 390, 412, 768 and 1280 pixels, in both languages and at
  pixel ratios 2 and 3: one row every time, nothing overflowing and no clipped
  date. Measure it again after any change to the card, at those widths and in
  both languages: a native date box is wider at a higher pixel ratio.
- **The fold is not remembered, and that is deliberate.** No `localStorage`, no
  URL parameter. The credit line says "Nothing about you is stored or sent
  anywhere else", and that sentence is worth more than saving the reader one tap
  on their next visit. Storing the fold means rewriting that line first.
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
- **A mark on a row must never change how tall the row is.** The open row's frame
  is an inset `box-shadow`, not a thicker border: a border makes the text
  narrower, the row rewraps, and every row below it jumps while the reader
  scrolls. The same rule is why the "next place" button stands over the map and
  not in the layout: the reader scrolling the list makes it come and go.
- **The open row's mark is drawn INSIDE the row, and it is the same width on all
  four sides.** Two bugs met here, and both were reported as "one side is thicker
  than the other".
  - An **outer** ring (`box-shadow: 0 0 0 1px`) is cut off on the left and the
    right. The reading column scrolls, so it carries `overflow-y: auto`, and CSS
    then computes `overflow-x: auto` as well, which clips anything painted
    outside a row. The top and the bottom of such a ring still show, so the row
    looks framed on two sides only. Never mark a row from outside its own box.
  - A **bar down one edge** (`inset 4px 0 0`) reads as a thicker border, because
    a bar and a frame look the same when both are drawn in the accent colour.
    With the 1px border under it the left edge was 5px against the right edge's
    1px.

  What stands there now is `inset 0 0 0 2px` over the accent border: one 3px
  frame, equal on every side, costing no layout.
- **A tap on a row opens the row too, on a phone.** `tapUnfolds` in `reading.js`
  holds the rule and the two limits on it: a tap never folds a row back (the row
  a reader taps is also the row the map marks, so a tap on an open row is a
  request to go back to it), and a wide screen leaves the row folded (the panel
  above the list already prints the story in full, so opening the row as well
  would print it twice). The chevron is still what folds a row. `storyItem`
  unfolds **before** it scrolls the list: a row grows downwards, so its own top
  does not move and `revealInList` still aims true.
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
- **The "next place" button and the pill share the map's bottom left corner, and
  they are never on screen together.** The button sits there because a thumb
  reaches that corner and because the zoom buttons hold the other side. The pill
  sits there too, and on a phone it only ever says that the day is loading, is
  empty, or could not be reached. Each of those states has no pins, so nothing is
  chosen and `renderNextPlace` hides the button. Give the pill anything to say
  about a loaded day and the two will overlap.
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
  111 outlines and about 5,000 points, so it is cheap, and it removes the class of
  bugs where the screen and the state disagree. Do not add partial redrawing.
- **`world.js` is generated. Never hand-edit it.** `bun buildWorld.js` rebuilds it
  from the Natural Earth TopoJSON named at the top of that script. The page must
  keep working with no network beyond Wikipedia, so the coastlines ship with it.
  It holds 109 shapes, which is what the source says; the canvas draws 111,
  because `splitAtAntimeridian` cuts two of them in two. The cut belongs to the
  drawing and not to the data, so **do not move it into `buildWorld.js`**: keeping
  `world.js` a faithful copy of Natural Earth is what makes a regeneration a
  one-command job with nothing to re-derive.
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
