import { describe, test, expect } from "bun:test";
import {
  buildGvizUrl,
  parseGvizResponse,
  parseScore,
  parseNumber,
  parseSide,
  parseStatus,
  normalizePlayers,
  normalizeGroups,
  normalizeCombats,
} from "./sheet.js";

// A realistic gviz response: JSON wrapped in a JS function call, with the /*O_o*/ prefix.
function gviz(cols, rows) {
  const table = {
    cols: cols.map((label, i) => ({ id: "C" + i, label, type: "string" })),
    rows: rows.map((cells) => ({
      c: cells.map((v) => (v === null ? null : { v })),
    })),
  };
  return `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({
    version: "0.6",
    status: "ok",
    table,
  })});`;
}

describe("buildGvizUrl", () => {
  test("uses the gviz endpoint with headers=1 and the tab name", () => {
    const url = buildGvizUrl("SHEET123", "Combats");
    expect(url).toContain("/spreadsheets/d/SHEET123/gviz/tq");
    expect(url).toContain("tqx=out%3Ajson");
    expect(url).toContain("sheet=Combats");
    expect(url).toContain("headers=1");
  });
});

describe("parseGvizResponse", () => {
  test("strips the JS wrapper and returns header-keyed rows", () => {
    const text = gviz(
      ["Player ID", "Name"],
      [
        ["P001", "Maria"],
        ["P002", "Joan"],
      ]
    );
    const { cols, rows } = parseGvizResponse(text);
    expect(cols).toEqual(["Player ID", "Name"]);
    expect(rows).toEqual([
      { "Player ID": "P001", Name: "Maria" },
      { "Player ID": "P002", Name: "Joan" },
    ]);
  });

  test("empty cells become empty strings", () => {
    const text = gviz(["A", "B"], [["x", null]]);
    const { rows } = parseGvizResponse(text);
    expect(rows[0].A).toBe("x");
    expect(rows[0].B).toBe("");
  });

  test("fully empty rows are skipped", () => {
    const text = gviz(["A", "B"], [["x", "y"], [null, null]]);
    const { rows } = parseGvizResponse(text);
    expect(rows.length).toBe(1);
  });

  test("keeps numeric values as numbers", () => {
    const table = {
      cols: [{ id: "C0", label: "Field", type: "number" }],
      rows: [{ c: [{ v: 2 }] }],
    };
    const text = `google.visualization.Query.setResponse(${JSON.stringify({ table })});`;
    const { rows } = parseGvizResponse(text);
    expect(rows[0].Field).toBe(2);
  });

  test("throws on a response with no JSON payload", () => {
    expect(() => parseGvizResponse("not json at all")).toThrow();
    expect(() => parseGvizResponse(12345)).toThrow();
  });

  test("throws on a gviz error payload (sheet not shared / wrong tab)", () => {
    const text = `google.visualization.Query.setResponse(${JSON.stringify({
      version: "0.6",
      status: "error",
      errors: [{ reason: "access_denied", message: "Access denied", detailed_message: "Sheet not shared" }],
    })});`;
    expect(() => parseGvizResponse(text)).toThrow();
  });
});

describe("value coercers", () => {
  test("parseScore: numbers through, empty -> null", () => {
    expect(parseScore(5)).toBe(5);
    expect(parseScore("7")).toBe(7);
    expect(parseScore("")).toBe(null);
    expect(parseScore(null)).toBe(null);
    expect(parseScore("abc")).toBe(null);
  });
  test("parseNumber: like parseScore for field/combat/pool", () => {
    expect(parseNumber("12")).toBe(12);
    expect(parseNumber("")).toBe(null);
  });
  test("parseSide: only Red/Blue, case-insensitive", () => {
    expect(parseSide("Red")).toBe("Red");
    expect(parseSide("blue")).toBe("Blue");
    expect(parseSide("")).toBe(null);
    expect(parseSide("x")).toBe(null);
  });
  test("parseStatus: maps to the four statuses, defaults to Scheduled", () => {
    expect(parseStatus("Finished")).toBe("Finished");
    expect(parseStatus("ongoing")).toBe("Ongoing");
    expect(parseStatus("")).toBe("Scheduled");
    expect(parseStatus("garbage")).toBe("Scheduled");
  });
});

describe("normalizePlayers", () => {
  test("builds fullName and keeps fields; drops rows without a Player ID", () => {
    const rows = [
      { "Player ID": "P001", Name: "Teyxion Jace", Surname: "Suarez", Club: "Avellaneda", "Group ID": "G01" },
      { "Player ID": "", Name: "Ghost", Surname: "", Club: "", "Group ID": "" },
    ];
    const players = normalizePlayers(rows);
    expect(players.length).toBe(1);
    expect(players[0].fullName).toBe("Teyxion Jace Suarez");
    expect(players[0].groupId).toBe("G01");
  });
});

describe("normalizeGroups", () => {
  test("defaults Pool to 1 and keeps tokens as stored", () => {
    const rows = [
      { "Group ID": "G01", Age: "Cadete", Sex: "Femenino", Weight: "-44kg", Level: "A", Pool: "" },
    ];
    const groups = normalizeGroups(rows);
    expect(groups[0].pool).toBe(1);
    expect(groups[0].sex).toBe("Femenino");
    expect(groups[0].weight).toBe("-44kg");
  });
});

describe("normalizeCombats", () => {
  test("packs the two rounds and parses scores/winners/status", () => {
    const rows = [
      {
        "Red ID": "P001",
        "Blue ID": "P002",
        Field: "1",
        Combat: "3",
        "R1 Red": "10",
        "R1 Blue": "5",
        "R1 Winner": "",
        "R2 Red": "5",
        "R2 Blue": "5",
        "R2 Winner": "Red",
        Status: "Finished",
      },
    ];
    const [c] = normalizeCombats(rows);
    expect(c.redId).toBe("P001");
    expect(c.field).toBe(1);
    expect(c.combat).toBe(3);
    expect(c.rounds[0]).toEqual({ red: 10, blue: 5, winner: null });
    expect(c.rounds[1]).toEqual({ red: 5, blue: 5, winner: "Red" });
    expect(c.status).toBe("Finished");
  });

  test("drops rows missing a fighter", () => {
    const rows = [{ "Red ID": "", "Blue ID": "P002", Field: "1", Combat: "1", Status: "Scheduled" }];
    expect(normalizeCombats(rows).length).toBe(0);
  });
});
