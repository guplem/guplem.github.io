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
// the right region but not on the exact spot. Fixing it needs a second source, a
// Wikidata `P31` ("instance of") lookup, which one batched query can answer for a
// whole day. See ADR 0002: the limit is open, and the cost is one request plus
// deciding which classes outrank which.

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
        // Always null here. Wikipedia's own `country` field exists but is not
        // trusted: it is editor-supplied and tags the article "Turkey" as a city,
        // which made the page print "Turkey, Türkiye". `dataSource.js` fills this
        // in from Wikidata, for every place, so one source answers.
        country: null,
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
 * Name a country from its two-letter ISO code, in the reader's language.
 *
 * The code is what travels, never a name. `Intl.DisplayNames` is in the browser
 * already, so one code gives "France" and "Francia" with no table to keep and no
 * translation to maintain. It also means the two sources of country codes
 * (Wikipedia's own field and Wikidata) can never disagree about spelling.
 *
 * @returns {string} an empty string for anything unusable, so a caller can
 *   simply leave the country out
 */
export function countryName(code, lang = "en") {
  if (typeof code !== "string" || !/^[A-Za-z]{2}$/.test(code)) return "";
  const upper = code.toUpperCase();
  for (const locale of [lang, "en"]) {
    try {
      const name = new Intl.DisplayNames([locale], { type: "region" }).of(upper);
      if (name && name !== upper) return name;
    } catch {
      // An unusable locale falls through to English.
    }
  }
  return "";
}

/**
 * How a place is written on screen: "Caen, France".
 *
 * The country is left out when it would only repeat the place. "Niger, Niger"
 * reads as a mistake, and a title such as "Barah, Sudan" already carries it.
 */
export function placeLabel(place, lang = "en") {
  const title = String(place?.title ?? "").trim();
  if (!title) return "";
  // A country needs no country after it. The query that supplies the code already
  // excludes countries, so this is belt and braces rather than the main guard.
  if (String(place?.type ?? "").toLowerCase() === "country") return title;
  const country = countryName(place?.country, lang);
  if (!country) return title;

  // The title is always in English, but the country is named in the reader's
  // language, so both spellings have to be checked. Compare only against the
  // reader's language and "Barah, Sudan" becomes "Barah, Sudan, Sudán".
  const spellings = [country, countryName(place?.country, "en")]
    .filter(Boolean)
    .map((name) => name.toLowerCase());
  const lower = title.toLowerCase();
  const lastPart = lower.split(",").pop().trim();
  if (spellings.some((name) => lower === name || lastPart === name)) return title;
  return `${title}, ${country}`;
}

/**
 * Article title to country code, read from a Wikidata answer.
 *
 * A place that touches several countries is left out rather than credited to one
 * of them: the Strait of Hormuz comes back as Iran, Oman and the UAE, and naming
 * any single one of those would be wrong.
 *
 * @param {object|null} response a SPARQL JSON result
 * @returns {Map<string, string>}
 */
export function buildCountryIndex(response) {
  const seen = new Map();
  for (const row of response?.results?.bindings ?? []) {
    const title = row?.title?.value;
    const code = row?.code?.value;
    if (!title || !code) continue;
    if (!seen.has(title)) seen.set(title, new Set());
    seen.get(title).add(code.toUpperCase());
  }
  const index = new Map();
  for (const [title, codes] of seen) if (codes.size === 1) index.set(title, [...codes][0]);
  return index;
}

/**
 * Each place that actually carries a pin, named once.
 *
 * This is what the country lookup asks about, and the difference is not small.
 * A day finds about forty places but pins only about sixteen of them, because a
 * story names its country and its province as well as its town. Measured against
 * a real day, asking about all forty took 6.0 seconds and asking about the
 * sixteen took 0.28: a SPARQL query's cost climbs faster than its length, so the
 * places nobody can see were most of the wait.
 */
export function placeTitlesOf(pins) {
  const titles = [];
  const seen = new Set();
  for (const pin of pins ?? []) {
    const title = pin?.place?.title;
    if (title && !seen.has(title)) {
      seen.add(title);
      titles.push(title);
    }
  }
  return titles;
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
