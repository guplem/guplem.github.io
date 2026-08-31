# Global News Map

A world map of the day's news. Every story is pinned where it happened.

The news comes from Wikipedia's [Current events portal](https://en.wikipedia.org/wiki/Portal:Current_events),
which volunteers write one page per day. Each story keeps the sources it was
reported by, so you can read the original article.

## Features

- **A pin per story**, placed on the most specific place the story names. A story
  about a town is pinned on the town, not on the country around it.
- **Choose a pin and every story at that place appears in full**, beside the map
  on a wide screen and in the list itself on a phone, each with its own sources.
  Pins that sit close together share one numbered marker, so a marker can cover
  more than one place: the page says when it does, and choosing the marker again
  moves to the next place on it.
- **Every story folds to a summary**, and a "show more" button opens the rest of
  it with the sources that reported it.
- **Made for a phone.** The day and the map hold the top of the screen and never
  move. Only the list of stories scrolls under them, and the story at the top of
  that list is the one the map marks, so scrolling the list walks the map. Choose
  a pin and the list scrolls to its story.
- **Places are named with their country**, so "Caen" reads as "Caen, France".
- **Any day**, back through the portal's whole history. Step a day at a time or
  type a date.
- **The sources**, linked, on every story. The page never becomes the source.
- **Stories with no place** are still listed, under their own heading, rather than
  being dropped.
- **Pan, zoom and pinch**, on a map drawn from coastline data the page carries
  itself. There is no tile server, so nothing is requested while you move around.
- **English and Spanish**, chosen by your browser. The page shows no language
  picker; add `?lang=es` or `?lang=en` to the address to override it.
- **A shareable link.** The day, the open story and the language all live in the
  address bar.
- **No key, no account, no tracking.** The page talks only to Wikipedia and
  Wikidata, and to nothing else at all once the day has loaded.

## How it places a story

Wikipedia gives coordinates to articles about places and gives none to articles
about ideas. So the articles a story links are its candidate locations, and
asking for their coordinates filters the places from the rest by itself. No text
is interpreted.

When a story names a town, its province and its country all at once, the most
specific one gets the pin. Wikipedia stores a `dim` with each coordinate, the
size of the thing in metres, and the smallest one wins.

The country shown next to a place comes from Wikidata. A place that spans several
countries, such as the Strait of Hormuz, is shown without one, and a country is
never labelled with itself.

## How to Run

Open `index.html` in a browser, or serve it with any HTTP server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/web-projects/global-news-map/`.

## Tests

```bash
bun test
```

## Credits

- News text: Wikipedia's Current Events portal, used under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Country of each place: [Wikidata](https://www.wikidata.org/) (CC0). Country
  names come from the browser's own `Intl.DisplayNames`, so they follow the
  page's language.
- Coastlines: [Natural Earth](https://www.naturalearthdata.com/) 1:110m land
  polygons, public domain.
