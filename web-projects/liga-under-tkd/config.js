// Central configuration for the Liga UNDER app.
//
// This is the ONLY file the organizer needs to edit to connect the live data.
// See SETUP.md for the step-by-step guide to create the Google Sheet and get its ID.

export const CONFIG = Object.freeze({
  // The Google Sheet ID. Leave empty ("") to run on bundled MOCK data (offline demo).
  // When you paste a real ID here, the app automatically switches to live mode.
  // The ID is the long string in the sheet URL:
  //   https://docs.google.com/spreadsheets/d/<THIS_PART_IS_THE_ID>/edit
  sheetId: "1Q3JurzMzUSqoPFbk14cf1Mrrf3RXMlLupLtD4xralac",

  // Exact tab (sheet) names inside the Google Sheet document. Must match §5 of the spec.
  tabs: Object.freeze({
    players: "Players",
    groups: "Groups",
    combats: "Combats",
  }),

  // How often to re-read the Combats tab while the tab is visible (milliseconds).
  // Players and Groups are static and read only once at load.
  pollIntervalMs: 25000,

  // Languages. Default is used when the browser language is none of the supported ones.
  supportedLanguages: Object.freeze(["ca", "es", "en"]),
  defaultLanguage: "es",

  // Event date used by the Home countdown (ISO 8601, with timezone offset).
  // 27 June 2026, Premià de Mar (Central European Summer Time, +02:00).
  eventDateIso: "2026-06-27T09:00:00+02:00",

  // Public links shown on the Home page.
  instagramUrl: "https://www.instagram.com/ligaunder_tkd/",
  instagramHandle: "@ligaunder_tkd",
});

// Returns true when a real Sheet ID is configured (live mode), false for mock mode.
export function isLiveMode() {
  return typeof CONFIG.sheetId === "string" && CONFIG.sheetId.trim().length > 0;
}
