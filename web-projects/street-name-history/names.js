// Pure logic for turning a bag of OSM tags into structured, display-ready name records.
// No DOM, no network -- safe to import from tests.
//
// OSM stores street names across many keys. We sort them into three buckets:
//   - current:    the name(s) a street goes by now, in every language + every naming role
//   - historical: former names (old_name[:lang][:period])
//   - etymology:  what/who the street is named after (name:etymology + name:etymology:wikidata)
//
// See CLAUDE.md for the full tag-key reference and why classification is table-driven.

// Base key -> naming role. Anything not listed here is ignored as "not a name we surface".
// Order of ROLE_ORDER below also drives display ordering within the "current" bucket.
const ROLE_BY_BASE = {
  name: "primary",
  official_name: "official",
  int_name: "international",
  nat_name: "national",
  reg_name: "regional",
  loc_name: "local",
  short_name: "short",
  alt_name: "alternate",
  nickname: "nickname",
  old_name: "old",
};

const ROLE_ORDER = [
  "primary",
  "official",
  "international",
  "national",
  "regional",
  "local",
  "short",
  "alternate",
  "nickname",
];

export const ROLE_LABELS = {
  primary: "Name",
  official: "Official name",
  international: "International name",
  national: "National name",
  regional: "Regional name",
  local: "Local name",
  short: "Short name",
  alternate: "Alternative name",
  nickname: "Nickname",
  old: "Former name",
};

// A suffix is a language code if it looks like a BCP-47-ish tag: 2-3 letters, optional
// script/region subtag (e.g. "ca", "en", "zh-Hant", "be-tarask"). Digits disqualify it,
// which is how date-namespaced keys like old_name:1930-1945 fall through to the period check.
const LANG_RE = /^[a-z]{2,3}([-_][a-z0-9]{2,8})*$/i;
// A period suffix on old_name is a year or year range: "1930", "1930-1945", "1930-".
const PERIOD_RE = /^\d{3,4}(-\d{0,4})?$/;

// Classify a single OSM tag key. Returns null for keys we do not surface as names.
export function classifyNameTag(key) {
  if (key === "name:etymology") return { role: "etymology", lang: null, period: null, variant: null };
  if (key === "name:etymology:wikidata")
    return { role: "etymology-wikidata", lang: null, period: null, variant: null };

  const colon = key.indexOf(":");
  const base = colon === -1 ? key : key.slice(0, colon);
  const suffix = colon === -1 ? "" : key.slice(colon + 1);

  const role = ROLE_BY_BASE[base];
  if (!role) return null;

  if (suffix === "") return { role, lang: null, period: null, variant: null };
  if (PERIOD_RE.test(suffix)) return { role, lang: null, period: suffix, variant: null };
  if (LANG_RE.test(suffix)) return { role, lang: suffix, period: null, variant: null };
  // Non-language, non-period suffix (e.g. name:left, name:right, name:source).
  return { role, lang: null, period: null, variant: suffix };
}

// Human-readable language name for a code, via Intl (available in browsers and Bun).
// Falls back to the raw code when the code is unknown or Intl is unavailable.
export function languageLabel(code) {
  if (!code) return null;
  const normalized = String(code).replace(/_/g, "-");
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "language" });
    const label = dn.of(normalized);
    if (label && label.toLowerCase() !== normalized.toLowerCase()) return label;
  } catch {
    /* fall through to the raw code */
  }
  return normalized;
}

// Format an old_name period suffix for display: "1930-1945" -> "1930–1945", "1930-" -> "since 1930".
export function formatPeriod(period) {
  if (!period) return null;
  const m = /^(\d{3,4})(?:-(\d{0,4}))?$/.exec(period);
  if (!m) return period;
  const [, from, to] = m;
  if (to === undefined) return from; // single year, no range
  if (to === "") return `since ${from}`;
  return `${from}–${to}`;
}

function sortCurrent(entries) {
  return entries.slice().sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(a.role);
    const rb = ROLE_ORDER.indexOf(b.role);
    if (ra !== rb) return ra - rb;
    // Within a role, the unqualified name (no language) comes first, then alphabetical by label.
    if (!a.lang && b.lang) return -1;
    if (a.lang && !b.lang) return 1;
    return (a.langLabel || "").localeCompare(b.langLabel || "");
  });
}

function sortHistorical(entries) {
  return entries.slice().sort((a, b) => {
    // Entries with a known period sort by starting year; undated ones sink to the bottom.
    const ya = a.period ? parseInt(a.period, 10) : Infinity;
    const yb = b.period ? parseInt(b.period, 10) : Infinity;
    if (ya !== yb) return ya - yb;
    return (a.langLabel || "").localeCompare(b.langLabel || "");
  });
}

// Turn a merged OSM tag object into structured name records.
export function extractNames(tags) {
  const current = [];
  const historical = [];
  let etymologyText = null;
  let etymologyWikidata = null;
  const wikidata = tags && typeof tags.wikidata === "string" ? tags.wikidata.trim() || null : null;

  for (const [key, rawValue] of Object.entries(tags || {})) {
    if (rawValue == null) continue;
    const value = String(rawValue).trim();
    if (value === "") continue;
    if (key === "wikidata") continue; // surfaced separately

    const c = classifyNameTag(key);
    if (!c) continue;

    if (c.role === "etymology") {
      etymologyText = value;
      continue;
    }
    if (c.role === "etymology-wikidata") {
      etymologyWikidata = /^Q\d+$/.test(value) ? value : etymologyWikidata;
      continue;
    }

    const entry = {
      key,
      value,
      role: c.role,
      roleLabel: ROLE_LABELS[c.role] || c.role,
      lang: c.lang,
      langLabel: c.lang ? languageLabel(c.lang) : null,
      variant: c.variant,
      period: c.period,
      periodLabel: c.period ? formatPeriod(c.period) : null,
    };

    if (c.role === "old") historical.push(entry);
    else current.push(entry);
  }

  return {
    current: sortCurrent(current),
    historical: sortHistorical(historical),
    etymology: { text: etymologyText, wikidata: etymologyWikidata },
    wikidata,
    languageCount: new Set(current.filter((e) => e.lang).map((e) => e.lang)).size,
    hasHistory: historical.length > 0 || Boolean(etymologyText) || Boolean(etymologyWikidata),
  };
}

// Collect the unique valid Wikidata QIDs referenced by a tag bag (street entity + etymology).
export function collectWikidataIds(tags) {
  const ids = [];
  const push = (v) => {
    if (typeof v === "string" && /^Q\d+$/.test(v.trim()) && !ids.includes(v.trim())) {
      ids.push(v.trim());
    }
  };
  if (tags) {
    push(tags.wikidata);
    push(tags["name:etymology:wikidata"]);
  }
  return ids;
}
