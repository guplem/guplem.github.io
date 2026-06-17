// Data source: the ONLY module that touches the network. It hides whether data comes from a
// live Google Sheet (gviz) or from the bundled mock data, behind one small async API.
//
// Strategy (spec §2):
//   - Players and Groups are static -> read ONCE at page load.
//   - Combats changes live -> re-read on each poll.
//   - On a failed fetch, throw; the caller keeps the last good data and retries next cycle.

import { CONFIG, isLiveMode } from "./config.js";
import {
  buildGvizUrl,
  parseGvizResponse,
  normalizePlayers,
  normalizeGroups,
  normalizeCombats,
} from "./sheet.js";
import { MOCK_PLAYERS, MOCK_GROUPS, MOCK_COMBATS } from "./mock-data.js";

// True when running on bundled sample data (no real Sheet configured).
export function usingMockData() {
  return !isLiveMode();
}

// The exact §5 header strings each tab must contain. If any are missing (a renamed/misspelled
// header, or a tab whose header row did not parse), we throw a clear error instead of silently
// returning empty records.
const REQUIRED_HEADERS = {
  players: ["Player ID", "Name", "Group ID"],
  groups: ["Group ID", "Age", "Sex", "Weight", "Level"],
  combats: ["Red ID", "Blue ID", "Field", "Combat", "R1 Red", "R1 Blue", "R2 Red", "R2 Blue", "Status"],
};

// Fetch one tab's raw header-keyed rows from the gviz endpoint, validating its headers.
async function fetchTabRows(tabName, required) {
  const url = buildGvizUrl(CONFIG.sheetId.trim(), tabName);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed for "${tabName}": HTTP ${res.status}`);
  const text = await res.text();
  const { cols, rows } = parseGvizResponse(text);
  const missing = (required || []).filter((h) => !cols.includes(h));
  if (missing.length) {
    throw new Error(`Sheet tab "${tabName}" is missing required columns: ${missing.join(", ")}`);
  }
  return rows;
}

// Load the static tabs (Players + Groups). Called once at startup.
export async function loadStaticData() {
  if (usingMockData()) {
    return {
      players: normalizePlayers(MOCK_PLAYERS),
      groups: normalizeGroups(MOCK_GROUPS),
    };
  }
  const [playerRows, groupRows] = await Promise.all([
    fetchTabRows(CONFIG.tabs.players, REQUIRED_HEADERS.players),
    fetchTabRows(CONFIG.tabs.groups, REQUIRED_HEADERS.groups),
  ]);
  return {
    players: normalizePlayers(playerRows),
    groups: normalizeGroups(groupRows),
  };
}

// Load the live Combats tab. Called on every poll.
export async function loadCombats() {
  if (usingMockData()) {
    return normalizeCombats(MOCK_COMBATS);
  }
  const rows = await fetchTabRows(CONFIG.tabs.combats, REQUIRED_HEADERS.combats);
  return normalizeCombats(rows);
}
