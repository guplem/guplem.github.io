// Which point on the map a story belongs to.
//
// A story names several articles, and Wikipedia geotags only the ones that are
// places. So the candidates are already filtered for us: ask the API for
// coordinates on every linked title, and whatever comes back is a place. An idea
// such as "Rocket launcher" simply has no coordinates.
//
// That leaves one real decision: a sentence often names a town, its province and
// its country all at once, and only one of them should carry the pin. Wikipedia
// stores a `dim` with each coordinate, the size of the thing in metres, so the
// most specific place is the one with the smallest `dim`. `Barah, Sudan` is
// 10,000 and `Sudan` is 1,000,000, so the pin lands on the town.
//
// Known limit: `dim` is editor-supplied and sometimes wrong. A province with no
// `type` and a small `dim` can outrank the town inside it, which puts the pin in
// the right region but not on the exact spot. Fixing it needs a second source
// (a Wikidata `P31` lookup per title), which costs a request per story and is not
// worth it for a map at this scale.

/** The API takes at most this many titles in one request. */
export const TITLES_PER_REQUEST = 50;

/**
 * The smallest size we are willing to believe for a kind of place.
 *
 * A country tagged `dim=1000` would otherwise beat the town the story is about.
 * These floors say "whatever the number claims, a country is country-sized".
 */
const TYPE_FLOOR = {
  country: 1_000_000,
  adm1st: 100_000,
  adm2nd: 50_000,
  waterbody: 100_000,
  mountainrange: 100_000,
  city: 10_000,
  isle: 10_000,
  airport: 3_000,
  landmark: 1_000,
  edu: 1_000,
  event: 1_000,
};

/** Used when a coordinate carries neither a dim nor a known type. */
const DEFAULT_SCALE = 20_000;

/**
 * How big a place is, in metres. Smaller means more specific, so the pin goes to
 * the lowest score.
 */
export function placeScale(place) {
  const dim = Number(place?.dim);
  const floor = TYPE_FLOOR[String(place?.type ?? "").toLowerCase()] ?? 0;
  const claimed = Number.isFinite(dim) && dim > 0 ? dim : 0;
  // `max`, not `min`: the floor exists to stop a wrong dim winning.
  const scale = Math.max(claimed, floor);
  return scale > 0 ? scale : DEFAULT_SCALE;
}

/** A coordinate has to be a real point on Earth before it can be drawn. */
function isOnEarth(place) {
  const lat = Number(place?.lat);
  const lon = Number(place?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * Every article title worth asking about, in the order they matter.
 * Sentence links come before topic links, which keeps a request that gets cut
 * short useful: the important titles are already in it.
 */
export function collectTitles(stories) {
  const titles = [];
  const seen = new Set();
  const add = (title) => {
    if (title && !seen.has(title)) {
      seen.add(title);
      titles.push(title);
    }
  };
  for (const story of stories) for (const title of story.links ?? []) add(title);
  for (const story of stories) for (const title of story.topicLinks ?? []) add(title);
  return titles;
}

/** Split a list into request-sized pieces. */
export function chunk(items, size = TITLES_PER_REQUEST) {
  const pieces = [];
  for (let i = 0; i < items.length; i += size) pieces.push(items.slice(i, i + size));
  return pieces;
}

/**
 * One lookup table from article title to its coordinate, built from however many
 * API responses were needed.
 *
 * Wikipedia answers under the title it prefers, not the one we asked about: it
 * reports the rename in `normalized` and the redirect in `redirects`. Both have
 * to be followed back, or a story that links a redirect loses its pin.
 *
 * @param {Array<object|null|undefined>} responses raw `action=query` payloads
 * @returns {Map<string, {title: string, lat: number, lon: number, dim: number|null, type: string|null}>}
 */
export function buildGeoIndex(responses) {
  const byTitle = new Map();
  /** Every alias that should end up pointing at a final title. */
  const aliases = [];

  for (const response of responses ?? []) {
    const query = response?.query;
    if (!query) continue;
    for (const hop of [...(query.normalized ?? []), ...(query.redirects ?? [])]) {
      if (hop?.from && hop?.to) aliases.push([hop.from, hop.to]);
    }
    for (const page of Object.values(query.pages ?? {})) {
      // `primary` marks the coordinate the article itself is about; it comes first.
      const coordinate = (page?.coordinates ?? [])[0];
      if (!page?.title || !coordinate) continue;
      const place = {
        title: page.title,
        lat: Number(coordinate.lat),
        lon: Number(coordinate.lon),
        dim: coordinate.dim ?? null,
        type: coordinate.type ?? null,
      };
      if (isOnEarth(place)) byTitle.set(page.title, place);
    }
  }

  // Follow each alias to the end of its chain. Two passes is not enough when a
  // normalization feeds a redirect, so walk it with a guard against a loop.
  for (const [from] of aliases) {
    let current = from;
    for (let step = 0; step < 10 && !byTitle.has(current); step += 1) {
      const next = aliases.find(([alias]) => alias === current)?.[1];
      if (!next || next === current) break;
      current = next;
    }
    const place = byTitle.get(current);
    if (place && !byTitle.has(from)) byTitle.set(from, place);
  }
  return byTitle;
}

/**
 * The one place a story is about.
 * @returns {{title: string, lat: number, lon: number}|null} null when the story
 *   names nowhere, which is normal for a story about a company or a treaty
 */
export function choosePlace(story, geoIndex) {
  const pick = (titles) => {
    let best = null;
    let bestScale = Infinity;
    for (const title of titles ?? []) {
      const place = geoIndex.get(title);
      if (!place || !isOnEarth(place)) continue;
      const scale = placeScale(place);
      // Strictly smaller, so the earlier mention keeps a tie.
      if (scale < bestScale) {
        best = place;
        bestScale = scale;
      }
    }
    return best;
  };
  // The sentence describes the event; the topic trail is only a fallback.
  return pick(story?.links) ?? pick(story?.topicLinks) ?? null;
}

/**
 * Turn the day's stories into map pins.
 * @returns {{pins: Array<object>, unplaced: Array<object>}} every story lands in
 *   exactly one of the two lists
 */
export function locateStories(stories, geoIndex) {
  const pins = [];
  const unplaced = [];
  for (const story of stories ?? []) {
    const place = choosePlace(story, geoIndex);
    if (place) pins.push({ story, place, title: place.title, lat: place.lat, lon: place.lon });
    else unplaced.push(story);
  }
  return { pins, unplaced };
}
