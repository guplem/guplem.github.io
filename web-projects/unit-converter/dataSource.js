// The only file in this project that touches the network.
//
// It is deliberately thin. Everything that can be got wrong about a rate table
// lives in `rates.js`, which is pure and tested; this file only asks and hands
// the answer over. That split is the same one `street-name-history` uses, and
// the reason is the same: a parser you can test beats a parser you can only
// watch fail in a browser.
//
// Two services are tried in turn. The first carries far more currencies, the
// second is the European Central Bank's daily table and covers the major ones.
// If both fail the caller keeps the snapshot bundled into `units.js`, and the
// page says so. Nothing here ever throws at the page: `fetchRates` answers with
// a table or with null.

import { normalizeRates } from "./rates.js";

/** Where today's rates come from, in the order they are tried. */
export const RATE_SOURCES = [
  // Free, no key, about 160 currencies, so almost every currency on the page
  // gets a live rate rather than the snapshot.
  { name: "ExchangeRate-API", url: "https://open.er-api.com/v6/latest/EUR", home: "https://www.exchangerate-api.com" },
  // The European Central Bank's daily reference rates. Fewer currencies, but a
  // different operator, so one service being down does not take the page with it.
  { name: "Frankfurter (ECB)", url: "https://api.frankfurter.dev/v1/latest?base=EUR", home: "https://frankfurter.dev" },
];

/** How long to wait before giving up on a service and trying the next. */
const TIMEOUT_MS = 6000;

async function getJson(url) {
  const stop = AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
  const response = await fetch(url, { signal: stop, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
  return response.json();
}

/**
 * Today's exchange rates, from whichever service answers first.
 *
 * @returns {Promise<{date: string, rates: Record<string, number>, source: string, home: string}|null>}
 *   null when no service answers with a table that can be read
 */
export async function fetchRates() {
  for (const source of RATE_SOURCES) {
    try {
      const table = normalizeRates(await getJson(source.url));
      if (table) return { ...table, source: source.name, home: source.home };
    } catch {
      // Try the next one. A page that cannot reach the network still converts
      // every unit that is not a currency, and converts currencies from the
      // bundled snapshot.
    }
  }
  return null;
}
