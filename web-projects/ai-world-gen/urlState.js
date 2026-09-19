// What the address bar carries: the open screen and the setup that generates
// a world. Nothing else (root ADR 0006).
//
// The setup is in the link on purpose: "here is the link that generates my
// dungeon" is the whole point of a shareable generator. Every default is left
// out, so a plain page has a plain link.
//
// The API key is never here. A link is pasted into chat and written to server
// logs, and `invariants.test.js` fails on any module that writes a key into a
// search string. Model choices are private too and live in `settings.js`.
//
// `app.js` writes the result with `history.replaceState`, never `pushState`:
// moving between the screens is not a place the back button should return to.

import { DEFAULT_ORDER_ID, readOrderId } from "./orderStrategies.js";
import { DEFAULT_GRID_SIZE_ID, GRID_LIMITS, cleanSetting } from "./presets.js";

/** The screens this page has. Named in links, so a name is never changed. */
export const VIEWS = ["setup", "ai", "map"];
export const DEFAULT_VIEW = "setup";

export function readView(value) {
  return typeof value === "string" && VIEWS.includes(value) ? value : DEFAULT_VIEW;
}

/** A size id, kept only when it is a readable `WxH` inside the limits. */
function readSizeId(value) {
  const match = typeof value === "string" ? value.trim().match(/^(\d{1,3})x(\d{1,3})$/) : null;
  if (!match) return DEFAULT_GRID_SIZE_ID;
  const inside = (n) => n >= GRID_LIMITS.min && n <= GRID_LIMITS.max;
  return inside(Number(match[1])) && inside(Number(match[2])) ? `${Number(match[1])}x${Number(match[2])}` : DEFAULT_GRID_SIZE_ID;
}

/** The state a search string asks for, with anything unreadable falling back to its default. */
export function readStateFromSearch(search) {
  const params = new URLSearchParams(typeof search === "string" ? search : "");
  return {
    view: readView(params.get("view")),
    setting: cleanSetting({
      location: params.get("location") ?? "",
      era: params.get("era") ?? "",
      notes: params.get("notes") ?? "",
    }),
    size: readSizeId(params.get("size")),
    order: readOrderId(params.get("order")),
  };
}

/** The search string for a state, or an empty string when nothing differs from the defaults. */
export function buildSearch(state = {}) {
  const params = new URLSearchParams();
  const view = readView(state.view);
  const setting = cleanSetting(state.setting);
  const size = readSizeId(state.size);
  const order = readOrderId(state.order);

  if (view !== DEFAULT_VIEW) params.append("view", view);
  if (setting.location) params.append("location", setting.location);
  if (setting.era) params.append("era", setting.era);
  if (setting.notes) params.append("notes", setting.notes);
  if (size !== DEFAULT_GRID_SIZE_ID) params.append("size", size);
  if (order !== DEFAULT_ORDER_ID) params.append("order", order);

  const text = params.toString();
  return text ? `?${text}` : "";
}
