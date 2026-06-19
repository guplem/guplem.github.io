// Google Sheet reading: pure helpers only. No fetch, no DOM here (that lives in data-source.js).
//
// We read the sheet through Google's "gviz" endpoint, which reflects edits within seconds
// (unlike "Publish to web" CSV, which Google caches for minutes). See ADR and §2 of the spec.
//
// The gviz response is NOT plain JSON. It is a JavaScript call wrapped around JSON, like:
//   /*O_o*/
//   google.visualization.Query.setResponse({ ... real JSON ... });
// So we slice out the JSON between the first "{" and the last "}", then JSON.parse it.

const GVIZ_BASE = "https://docs.google.com/spreadsheets/d";

// Build the gviz URL for one tab. `headers=1` tells gviz the first sheet row is the header,
// so column labels come back as the exact header strings ("Player ID", "Red ID", …).
export function buildGvizUrl(sheetId, tabName) {
  const params = new URLSearchParams({
    tqx: "out:json",
    sheet: tabName,
    headers: "1",
  });
  return `${GVIZ_BASE}/${encodeURIComponent(sheetId)}/gviz/tq?${params.toString()}`;
}

// Parse a raw gviz response string into { cols: string[], rows: Array<object> }.
// Each row is an object keyed by the column header label. Empty cells become "".
// Throws if the wrapper/JSON cannot be parsed.
export function parseGvizResponse(text) {
  if (typeof text !== "string") throw new Error("gviz response must be a string");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("gviz response: could not locate JSON payload");
  }
  let payload;
  try {
    payload = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    throw new Error("gviz response: JSON parse failed (" + err.message + ")");
  }

  // gviz signals failures (sheet not shared, wrong/renamed tab, bad query) with HTTP 200 and a
  // body whose status is "error". Without this check that would parse to zero rows silently.
  if (payload.status === "error") {
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    const message = errors.map((e) => e.detailed_message || e.message || e.reason).filter(Boolean).join("; ");
    throw new Error("gviz error: " + (message || "unknown (is the sheet shared and the tab name correct?)"));
  }

  const table = payload.table || {};
  const cols = (table.cols || []).map((c, i) => {
    const label = (c && typeof c.label === "string" && c.label.trim()) || "";
    return label || (c && c.id) || "col" + i;
  });

  const rawRows = Array.isArray(table.rows) ? table.rows : [];
  const rows = [];
  for (const row of rawRows) {
    const cells = (row && Array.isArray(row.c)) ? row.c : [];
    const obj = {};
    let hasValue = false;
    cols.forEach((label, i) => {
      const value = cellValue(cells[i]);
      obj[label] = value;
      if (value !== "" && value !== null) hasValue = true;
    });
    if (hasValue) rows.push(obj); // skip fully-empty rows Sheets sometimes returns
  }
  return { cols, rows };
}

// Read one gviz cell -> raw value, or "" for an empty cell.
// Prefers the typed value `v`; falls back to the formatted string `f`.
function cellValue(cell) {
  if (!cell) return "";
  if (cell.v !== null && cell.v !== undefined) return cell.v;
  if (cell.f !== null && cell.f !== undefined) return cell.f;
  return "";
}

// ---------- value coercers ----------

// Parse a score cell -> integer points, or null when the cell is empty (round not played).
export function parseScore(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Parse a "Field"/"Combat"/"Pool" number cell -> number, or null when empty.
export function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Normalize a side cell (the round Winner column) -> "Red" | "Blue" | null.
export function parseSide(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  if (s === "red") return "Red";
  if (s === "blue") return "Blue";
  return null;
}

const VALID_STATUSES = ["Scheduled", "Ongoing", "Finished", "Cancelled"];

// Normalize a status cell -> one of the four statuses. Empty/unknown defaults to "Scheduled".
export function parseStatus(value) {
  if (value === null || value === undefined) return "Scheduled";
  const raw = String(value).trim();
  if (raw === "") return "Scheduled";
  const match = VALID_STATUSES.find((s) => s.toLowerCase() === raw.toLowerCase());
  // A non-empty value that matches none of the four is a data-entry error: warn (so it is
  // visible during the live event) but keep rendering as Scheduled rather than dropping the row.
  if (!match && typeof console !== "undefined") {
    console.warn('Liga UNDER: unknown combat Status "' + raw + '" treated as Scheduled.');
  }
  return match || "Scheduled";
}

function str(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

// ---------- record normalizers ----------
// Turn header-keyed raw rows (from gviz OR from mock data) into typed app records.

// Players: { playerId, name, surname, fullName, club, groupId }
export function normalizePlayers(rows) {
  return rows
    .map((r) => {
      const name = str(r["Name"]);
      const surname = str(r["Surname"]);
      const fullName = [name, surname].filter(Boolean).join(" ").trim();
      return {
        playerId: str(r["Player ID"]),
        name,
        surname,
        fullName,
        club: str(r["Club"]),
        groupId: str(r["Group ID"]),
      };
    })
    .filter((p) => p.playerId !== "");
}

// Groups: { groupId, age, sex, weight, level, pool }
export function normalizeGroups(rows) {
  return rows
    .map((r) => ({
      groupId: str(r["Group ID"]),
      age: str(r["Age"]),
      sex: str(r["Sex"]),
      weight: str(r["Weight"]),
      level: str(r["Level"]),
      pool: parseNumber(r["Pool"]) ?? 1,
    }))
    .filter((g) => g.groupId !== "");
}

// Combats: { redId, blueId, field, combat, rounds: [{red,blue,winner} x2], status }
export function normalizeCombats(rows) {
  return rows
    .map((r) => ({
      redId: str(r["Red ID"]),
      blueId: str(r["Blue ID"]),
      field: parseNumber(r["Field"]),
      combat: parseNumber(r["Combat"]),
      rounds: [
        { red: parseScore(r["R1 Red"]), blue: parseScore(r["R1 Blue"]), winner: parseSide(r["R1 Winner"]) },
        { red: parseScore(r["R2 Red"]), blue: parseScore(r["R2 Blue"]), winner: parseSide(r["R2 Winner"]) },
      ],
      status: parseStatus(r["Status"]),
    }))
    .filter((c) => c.redId !== "" && c.blueId !== "");
}
