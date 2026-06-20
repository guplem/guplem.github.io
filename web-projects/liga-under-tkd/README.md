# Liga UNDER — Tournament Web App

Public website for the **Liga UNDER** taekwondo tournament (Cadet and Junior, 27 June 2026,
Premià de Mar). It shows, in near real time, the running order of combats, the standings of each
group, and every athlete's profile — read live from a shared Google Sheet, hosted as static files
with no server and no paid hosting.

## Features

- **Home** — event info (date, place, free entry), logo, tagline, Instagram link, sponsors, and a
  live countdown to the event.
- **By tatami** — each tatami's combats in running order, clearly marking the combat **on now** and
  the **next** one. There is no clock schedule; combats run one after another.
- **By group** — the round-robin cross-table (combat grid) plus the group's standings (played, won,
  drawn, lost, points for/against, difference, league points).
- **Athletes** — search by name or Player ID; each profile shows the athlete's group, group
  position, record, next combat, and past combats. Names everywhere are tappable links.
- **Three languages** — Catalan, Spanish, English. Auto-detects the browser language and falls back
  to Spanish; a switcher in the header overrides it (and remembers the choice).
- **Live updates** — the combats data refreshes about every 25 seconds, pausing while the browser
  tab is hidden and keeping the last good data if a refresh fails.

## How to Run

No build step. Open from any static server (ES modules need `http://`, not `file://`):

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/web-projects/liga-under-tkd/`.

Out of the box the app runs on **bundled sample data** ("Demo mode"). To connect the live Google
Sheet, follow **[SETUP.md](SETUP.md)** — it is a one-line change in `config.js`.

## Tests

Pure logic (scoring engine, Google Sheet parsing, i18n) is covered by tests with
[Bun](https://bun.sh):

```bash
bun test
```

## Tech Stack

Vanilla HTML, CSS, and JavaScript (ES modules). No framework, no build step. Data is read from a
Google Sheet through the public **gviz** endpoint (no API key). See
[ADR 0001](adr/0001-google-sheet-as-database.md) for why the Sheet is the database.
