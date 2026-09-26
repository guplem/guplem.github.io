import { FEED_URL } from "./feed.js";

// Which data the page shows: live sources ("real") or the invented demo set.
// The mode lives in the link (root ADR 0006), so a shared link opens the same
// mode. The plain link is real data.

export const MODES = ["real", "demo"];
export const DEFAULT_MODE = "real";

export function readMode(search) {
  const mode = new URLSearchParams(search).get("mode");
  return MODES.includes(mode) ? mode : DEFAULT_MODE;
}

/** The query string for `mode`, keeping any other parameters. */
export function modeSearch(search, mode) {
  const params = new URLSearchParams(search);
  if (mode === DEFAULT_MODE) params.delete("mode");
  else params.set("mode", mode);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * The fire feed to read. Only a page served from this machine may swap it
 * (`?feed=` for testing): on the live site a link must never be able to put
 * invented fires on a real-data map.
 */
export function feedUrl(search, hostname) {
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  const override = new URLSearchParams(search).get("feed");
  return local && override ? override : FEED_URL;
}
