// The only file that calls `fetch`.
//
// Two requests make a day of news. The first asks Wikipedia for the Current
// Events portal page for that day. The second asks for the coordinates of every
// article that page linked, in batches of fifty titles.
//
// Both go to the same public endpoint, need no key and no account, and work from
// a browser because `origin=*` makes the API answer with the CORS header that
// lets a page on another domain read the response. Leave `origin=*` out and every
// request fails in the browser while still working from a terminal, which is a
// confusing way to lose an afternoon.
//
// Everything here returns plain data. The parsing lives in `stories.js` and
// `places.js` so it can be tested without a network.

import { portalPageTitle } from "./calendar.js";
import { TITLES_PER_REQUEST, buildGeoIndex, chunk, collectTitles, locateStories } from "./places.js";
import { parseCurrentEvents } from "./stories.js";

const API = "https://en.wikipedia.org/w/api.php";

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
 * `coprop=type|dim` is the important part: `dim` is the size of the place in
 * metres, and it is what lets `places.js` pin a story on the town it happened in
 * rather than the country around it.
 */
export async function fetchCoordinates(titles, signal) {
  const batches = chunk(titles, TITLES_PER_REQUEST);
  const responses = await Promise.all(
    batches.map((batch) =>
      ask(
        {
          action: "query",
          prop: "coordinates",
          coprop: "type|dim|name|country|region",
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

/**
 * Everything the page needs for one day.
 *
 * @param {Date} date the day, in UTC
 * @param {{signal?: AbortSignal, onProgress?: (stage: string) => void}} options
 * @returns {Promise<{stories: Array<object>, pins: Array<object>, unplaced: Array<object>}>}
 */
export async function loadDay(date, { signal, onProgress } = {}) {
  const key = date.toISOString().slice(0, 10);
  if (dayCache.has(key)) return dayCache.get(key);

  onProgress?.("loading");
  const html = await fetchPortalHtml(date, signal);
  const stories = parseCurrentEvents(html);
  if (!stories.length) throw new NoNewsForDay(key);

  onProgress?.("locating");
  const responses = await fetchCoordinates(collectTitles(stories), signal);
  const located = locateStories(stories, buildGeoIndex(responses));

  const day = { stories, ...located };
  dayCache.set(key, day);
  return day;
}
