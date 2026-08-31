// The only file that calls `fetch`.
//
// A day of news takes three requests. The first asks Wikipedia for the Current
// Events portal page for that day. The second asks for the coordinates of every
// article that page linked, in batches of fifty titles. The third asks Wikidata
// for the country of each place that carries a pin, because Wikipedia's own
// country field is too unreliable to mix in (see `fetchCountries`).
//
// Only the first two block. The third runs behind the finished map and the names
// appear when they arrive: awaiting it held the map back by six seconds on a real
// day, which reads as a broken page rather than a slow one.
//
// Every one of them needs no key and no account. The two Wikipedia calls work
// from a browser because `origin=*` makes the API answer with the CORS header
// that lets a page on another domain read the response. Leave `origin=*` out and
// every request fails in the browser while still working from a terminal, which
// is a confusing way to lose an afternoon. Wikidata sends that header always, so
// it needs no such parameter.
//
// Only the first two are load-bearing. If Wikidata is slow or down the day still
// loads, just without country names.
//
// Everything here returns plain data. The parsing lives in `stories.js` and
// `places.js` so it can be tested without a network.

import { portalPageTitle } from "./calendar.js";
import {
  TITLES_PER_REQUEST,
  buildCountryIndex,
  buildGeoIndex,
  chunk,
  collectTitles,
  locateStories,
  placeTitlesOf,
} from "./places.js";
import { parseCurrentEvents } from "./stories.js";

const API = "https://en.wikipedia.org/w/api.php";
const WIKIDATA = "https://query.wikidata.org/sparql";

/** Raised when Wikipedia has no page for the day asked about. */
export class NoNewsForDay extends Error {}

/** One day of news, kept so stepping back and forth costs no requests. */
const dayCache = new Map();

/**
 * Ask the API one question.
 * `origin=*` is what makes the answer readable from a browser on another domain.
 * `maxage` lets Wikipedia's own caches answer a repeat, which keeps this page a
 * polite user of a free service.
 */
async function ask(params, signal) {
  const query = new URLSearchParams({
    format: "json",
    origin: "*",
    maxage: "600",
    smaxage: "600",
    ...params,
  });
  const response = await fetch(`${API}?${query}`, { signal, redirect: "follow" });
  if (!response.ok) throw new Error(`Wikipedia answered ${response.status}`);
  return response.json();
}

/**
 * The raw HTML of one day of the Current Events portal.
 * @throws {NoNewsForDay} when the day has no page yet, which is normal for today
 */
export async function fetchPortalHtml(date, signal) {
  const payload = await ask({ action: "parse", page: portalPageTitle(date), prop: "text" }, signal);
  if (payload?.error) {
    if (payload.error.code === "missingtitle") throw new NoNewsForDay(payload.error.code);
    throw new Error(payload.error.info ?? payload.error.code ?? "Wikipedia refused the request");
  }
  // `parse.text` is an object under the default format and a string under
  // formatversion 2. Accept either, so a future change of format cannot break it.
  const text = payload?.parse?.text;
  return typeof text === "string" ? text : (text?.["*"] ?? "");
}

/**
 * Coordinates for a list of article titles.
 *
 * `coprop=type|dim` is why this asks for more than a point: `dim` is the size of
 * the place in metres, and it is what lets `places.js` pin a story on the town it
 * happened in rather than the country around it. `country` is deliberately not
 * asked for; see `fetchCountries` for why it is not trusted.
 */
export async function fetchCoordinates(titles, signal) {
  const batches = chunk(titles, TITLES_PER_REQUEST);
  const responses = await Promise.all(
    batches.map((batch) =>
      ask(
        {
          action: "query",
          prop: "coordinates",
          coprop: "type|dim",
          colimit: "max",
          redirects: "1",
          titles: batch.join("|"),
        },
        signal,
      // One failed batch must not lose the whole day, so a batch that fails
      // simply contributes no places.
      ).catch(() => null),
    ),
  );
  return responses.filter(Boolean);
}

/** A title inside a SPARQL string literal. */
const sparqlString = (title) => `"${String(title).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"@en`;

/**
 * The country of each place, as an ISO code, from Wikidata.
 *
 * `P17` is the country and `P297` its ISO 3166-1 alpha-2 code, so what comes back
 * is a code and every country is still named by `Intl.DisplayNames`. One request
 * covers the whole day.
 *
 * Three decisions are load-bearing here.
 *
 * It asks for the **code**, never the country's name. A name would arrive in one
 * language and would not match the names the codes produce.
 *
 * It asks Wikidata for **every** place, not only those Wikipedia had no country
 * for. Wikipedia's own field is editor-supplied and wrong in ways that show: it
 * tags the article "Turkey" as a city, which made the page print
 * "Turkey, Türkiye". Mixing the two sources is what produced that, so only this
 * one answers.
 *
 * `FILTER NOT EXISTS { ?item wdt:P297 ?own }` drops any place that has an ISO
 * country code **of its own**, which is exactly the set of countries. That is why
 * "Turkey", "Jordan" and "Niger" come back with nothing, and it is a structural
 * test rather than a comparison of names. Comparing names cannot work: "Turkey"
 * and "Türkiye" are the same country, and "Jordan" is "Jordania" in Spanish.
 *
 * @returns {Promise<Map<string, string>>} empty when the service is unreachable,
 *   because a missing country is a smaller loss than a day that will not load
 */
export async function fetchCountries(titles, signal) {
  if (!titles.length) return new Map();
  const query = `SELECT ?title ?code WHERE {
  VALUES ?title { ${titles.map(sparqlString).join(" ")} }
  ?sitelink schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  ?item wdt:P17/wdt:P297 ?code .
  FILTER NOT EXISTS { ?item wdt:P297 ?own }
}`;
  try {
    const response = await fetch(`${WIKIDATA}?${new URLSearchParams({ query, format: "json" })}`, {
      signal,
      headers: { Accept: "application/sparql-results+json" },
    });
    if (!response.ok) return new Map();
    return buildCountryIndex(await response.json());
  } catch {
    return new Map();
  }
}

/**
 * Everything the page needs for one day.
 *
 * @param {Date} date the day, in UTC
 * @param {{signal?: AbortSignal, onProgress?: (stage: string) => void}} options
 * @returns {Promise<{stories: Array<object>, pins: Array<object>, unplaced: Array<object>}>}
 */
/**
 * Write the countries onto the places the pins point at.
 *
 * Several aliases in the index can share one place object, so this works on the
 * objects themselves: filling one fills every alias pointing at it.
 *
 * @returns {Promise<boolean>} whether anything changed, so a caller knows whether
 *   redrawing is worth it
 */
async function fillCountries(pins, signal) {
  const titles = placeTitlesOf(pins);
  if (!titles.length) return false;
  const countries = await fetchCountries(titles, signal);
  if (!countries.size) return false;
  for (const place of new Set(pins.map((pin) => pin.place))) {
    place.country = countries.get(place.title) ?? null;
  }
  return true;
}

export async function loadDay(date, { signal, onProgress, onCountries } = {}) {
  const key = date.toISOString().slice(0, 10);
  const cached = dayCache.get(key);
  if (cached) {
    // A day already loaded has its countries, so there is nothing to wait for.
    if (cached.countriesLoaded) onCountries?.();
    return cached;
  }

  onProgress?.("loading");
  const html = await fetchPortalHtml(date, signal);
  const stories = parseCurrentEvents(html);
  if (!stories.length) throw new NoNewsForDay(key);

  onProgress?.("locating");
  const responses = await fetchCoordinates(collectTitles(stories), signal);
  const geoIndex = buildGeoIndex(responses);
  const located = locateStories(stories, geoIndex);

  const day = { stories, ...located, countriesLoaded: false };
  dayCache.set(key, day);

  // The countries are deliberately NOT awaited. They are a label on a pin, not
  // the pin, so the map draws as soon as the coordinates are in and the names
  // fill in behind it. Awaiting this held the whole map back by six seconds on a
  // real day, which read as a broken page rather than a slow one.
  fillCountries(located.pins, signal)
    .then((changed) => {
      day.countriesLoaded = true;
      if (changed && !signal?.aborted) onCountries?.();
    })
    .catch(() => {
      // A country is optional. Nothing to report and nothing to redraw.
      day.countriesLoaded = true;
    });

  return day;
}
