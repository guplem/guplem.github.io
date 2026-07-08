// Pure URL-state codec. No DOM, no network -- safe to import from tests.
//
// State lives in the URL so any search is shareable and reproducible (root ADR 0006):
//   q   -> the free-text street query the user typed
//   sel -> the exact OSM element chosen from the results, as "<type>/<id>" (e.g. "way/12345"),
//          so a shared link reopens the same street even when the query is ambiguous.
// Defaults (empty values) are never serialized, to keep links short.

export function parseUrlState(searchString) {
  const params = new URLSearchParams(
    typeof searchString === "string" ? searchString.replace(/^\?/, "") : ""
  );
  const q = (params.get("q") || "").trim();
  const selRaw = (params.get("sel") || "").trim();
  const sel = /^(node|way|relation)\/\d+$/.test(selRaw) ? selRaw : null;
  return { q, sel };
}

export function serializeUrlState({ q = "", sel = null } = {}) {
  const params = new URLSearchParams();
  const trimmedQ = typeof q === "string" ? q.trim() : "";
  if (trimmedQ) params.set("q", trimmedQ);
  if (sel && /^(node|way|relation)\/\d+$/.test(sel)) params.set("sel", sel);
  return params.toString();
}

// Build the "<type>/<id>" selector used in the sel param from an OSM element.
export function osmRef(osmType, osmId) {
  if (!osmType || osmId == null) return null;
  return `${osmType}/${osmId}`;
}
