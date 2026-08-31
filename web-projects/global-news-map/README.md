# Global News Map

A world map of the day's news. Every story is pinned where it happened.

The news comes from Wikipedia's [Current events portal](https://en.wikipedia.org/wiki/Portal:Current_events),
which volunteers write one page per day. Each story keeps the sources it was
reported by, so you can read the original article.

## Features

- **A pin per story**, placed on the most specific place the story names. A story
  about a town is pinned on the town, not on the country around it.
- **Pins that sit together become one numbered marker.** Choose it and every
  story standing on it is marked in the list, so a marker reading "5" points at
  five stories you can read in turn.
- **Any day**, back through the portal's whole history. Step a day at a time or
  type a date.
- **The sources**, linked, on every story. The page never becomes the source.
- **Stories with no place** are still listed, under their own heading, rather than
  being dropped.
- **Pan, zoom and pinch**, on a map drawn from coastline data the page carries
  itself. There is no tile server, so nothing is requested while you move around.
- **English and Spanish.**
- **A shareable link.** The day, the open story and the language all live in the
  address bar.
- **No key, no account, no tracking.** The page talks only to Wikipedia.

## How it places a story

Wikipedia gives coordinates to articles about places and gives none to articles
about ideas. So the articles a story links are its candidate locations, and
asking for their coordinates filters the places from the rest by itself. No text
is interpreted.

When a story names a town, its province and its country all at once, the most
specific one gets the pin. Wikipedia stores a `dim` with each coordinate, the
size of the thing in metres, and the smallest one wins.

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
- Coastlines: [Natural Earth](https://www.naturalearthdata.com/) 1:110m land
  polygons, public domain.
