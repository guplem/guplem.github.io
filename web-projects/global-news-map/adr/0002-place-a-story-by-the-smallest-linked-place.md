# ADR 0002: Place a story by the smallest place it links, and read no sentences

## Context

A story arrives as a sentence with links in it:

> A spokesperson for the [United States Central Command] reports that the
> [U.S. military] has launched strikes on two [Iranian] [rocket launchers] at
> [Larak Island] in the [Strait of Hormuz] ...

To pin it on a map, something has to decide where it happened. Two problems sit
inside that.

**Which words are places?** Reading the sentence to find out means named-entity
recognition, which needs either a model in the page or a service to call. Both
are heavy, and both are wrong sometimes in ways that are hard to explain.

**Which place is the right one?** A story usually names several at once. The
Sudan story links `Sudan`, `Barah, Sudan` and `North Kordofan`. Pinning the
country puts a village raid in the middle of a desert 400km away.

## Decision

**Do not read the sentence at all. Ask the API about every linked article.**

Wikipedia geotags articles about places and gives no coordinates to articles
about ideas. So the filter comes free: send all the linked titles, and whatever
comes back with coordinates is a place. Measured on a real day, `Larak Island`
and `Strait of Hormuz` came back with coordinates while `Rocket launcher` and
`United States Central Command` came back with none.

**Pick the smallest place.** Wikipedia stores a `dim` with each coordinate, the
size of the thing in metres. Ranking by it ascending gives the most specific
place:

| Article | `dim` | `type` |
|---|---|---|
| `Barah, Sudan` | 10,000 | city |
| `Sudan` | 1,000,000 | country |
| `Belgorod` | 1,000 | *(none)* |
| `Belgorod Oblast` | 100,000 | adm1st |
| `Russia` | 10,000,000 | *(none)* |

**Guard `dim` with a floor per `type`.** `dim` is editor-supplied and sometimes
wrong. A country tagged `dim=1000` would beat the town the story is about, so
`TYPE_FLOOR` in `places.js` raises the score of a country to country-sized
whatever the stored number claims. The code takes `max(dim, floor)`, never `min`.

**Prefer the sentence's own links over the topic trail.** The trail above a story
("2026 Iran war") is broader than the story, so it is only consulted when the
sentence names nowhere.

**Keep ties in reading order.** The comparison is strictly smaller-than, so the
place mentioned first wins an equal score.

## Consequences

**What this buys.**

- No model, no extra service, no sentence parsing. The whole decision is a sort.
- It is pure and fully testable. `places.test.js` pins each rule with the real
  numbers above, and no test needs the network.
- It explains itself. When a pin looks wrong, the answer is always "these were
  the linked places and these were their sizes".
- It is cheap: two batched requests cover a whole day.

**What it costs, and this is a real limit rather than a bug to fix later.**

- **A province with no `type` and a small `dim` can outrank the town inside it.**
  `North Kordofan` carries `dim=1000` and beats `Barah, Sudan` at `dim=10,000`.
  The pin lands in the right region, on the wrong spot.
- **An organisation's headquarters can win.** A story about a telescope launch was
  pinned at NASA's Washington headquarters, because that is the geotag NASA's
  article carries.
- **A story that names no place gets no pin.** Sport, markets and treaties often
  name none. These are listed under their own heading rather than dropped, because
  silently losing a story is worse than admitting it has no place.

Measured against a real day: 14 of 15 stories were placed, the one miss was a
field hockey final, and the wrong-spot cases were of the kinds above.

**Why not fix the limit.** Telling a town from a province properly means asking
Wikidata for each title's `P31` ("instance of"). That is one more request per
story, roughly fifteen extra round trips a day, to move a handful of pins from
the right region to the right spot. For a map at world scale that is the wrong
trade. If the map ever gains a street-level zoom, revisit it.
