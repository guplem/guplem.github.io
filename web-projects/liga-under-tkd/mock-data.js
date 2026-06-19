// Bundled SAMPLE data so the app works with no Google Sheet (demo / local development).
// Shapes match the gviz output exactly: arrays of objects keyed by the §5 header strings,
// so they pass through the same normalizers in sheet.js as real sheet data.
//
// This is invented test data built from the §6 categories/weights. It is NOT the real roster.
// Three groups across different classifications, with finished, ongoing and scheduled combats,
// a round decided by the Winner column (including a disqualification that overrides the points),
// and a 3-player pool with repeat combats.

export const MOCK_PLAYERS = [
  // G01 — Cadete · Femenino · -44kg · Level A (4 athletes, full round-robin)
  { "Player ID": "P001", Name: "Aina", Surname: "Roca", Club: "Avellaneda", "Group ID": "G01" },
  { "Player ID": "P002", Name: "Berta", Surname: "Solé", Club: "Hwarang BCN", "Group ID": "G01" },
  { "Player ID": "P003", Name: "Carla", Surname: "Mendoza", Club: "Premià TKD", "Group ID": "G01" },
  { "Player ID": "P004", Name: "Diana", Surname: "Ferrer", Club: "Olympia", "Group ID": "G01" },

  // G02 — Junior · Masculino · -63kg · Level A (4 athletes, full round-robin)
  { "Player ID": "P005", Name: "Marc", Surname: "Vidal", Club: "Avellaneda", "Group ID": "G02" },
  { "Player ID": "P006", Name: "Pol", Surname: "Garrido", Club: "Hwarang BCN", "Group ID": "G02" },
  { "Player ID": "P007", Name: "Hugo", Surname: "Navarro", Club: "Premià TKD", "Group ID": "G02" },
  { "Player ID": "P008", Name: "Iker", Surname: "Domènech", Club: "Mataró Dojang", "Group ID": "G02" },

  // G03 — Cadete · Masculino · -45kg · Level B (3 athletes, round-robin + repeats)
  { "Player ID": "P009", Name: "Eric", Surname: "Pujol", Club: "Avellaneda", "Group ID": "G03" },
  { "Player ID": "P010", Name: "Nil", Surname: "Camps", Club: "Olympia", "Group ID": "G03" },
  { "Player ID": "P011", Name: "Aran", Surname: "Ibáñez", Club: "Premià TKD", "Group ID": "G03" },
];

export const MOCK_GROUPS = [
  { "Group ID": "G01", Age: "Cadete", Sex: "Femenino", Weight: "-44kg", Level: "A", Pool: "1" },
  { "Group ID": "G02", Age: "Junior", Sex: "Masculino", Weight: "-63kg", Level: "A", Pool: "1" },
  { "Group ID": "G03", Age: "Cadete", Sex: "Masculino", Weight: "-45kg", Level: "B", Pool: "1" },
];

// Compact builder for a combat row (header-keyed). w1/w2 are the round Winner cells
// ("Red"/"Blue"/""): when set they decide the round, overriding the points.
function c(red, blue, field, combat, r1r, r1b, r2r, r2b, status, w1 = "", w2 = "") {
  return {
    "Red ID": red,
    "Blue ID": blue,
    Field: String(field),
    Combat: String(combat),
    "R1 Red": r1r === null ? "" : String(r1r),
    "R1 Blue": r1b === null ? "" : String(r1b),
    "R1 Winner": w1,
    "R2 Red": r2r === null ? "" : String(r2r),
    "R2 Blue": r2b === null ? "" : String(r2b),
    "R2 Winner": w2,
    Status: status,
  };
}

export const MOCK_COMBATS = [
  // ---- Field 1: group G01 running order 1..6 ----
  c("P001", "P002", 1, 1, 12, 5, 9, 7, "Finished"), // Aina 2-0 Berta
  // Carla(R) vs Diana(B): R1 6-6 tie -> Blue; R2 Carla leads 8-4 but is disqualified -> Blue.
  // Diana wins 0-2 even though Carla scored more in R2 (demonstrates the Winner override).
  c("P003", "P004", 1, 2, 6, 6, 8, 4, "Finished", "Blue", "Blue"),
  c("P001", "P003", 1, 3, 8, 6, 3, 3, "Ongoing", "", ""), // Aina vs Carla — on now
  c("P002", "P004", 1, 4, null, null, null, null, "Scheduled"),
  c("P001", "P004", 1, 5, null, null, null, null, "Scheduled"),
  c("P002", "P003", 1, 6, null, null, null, null, "Scheduled"),

  // ---- Field 2: group G02 running order 1..6, then group G03 running order 7..11 ----
  c("P005", "P006", 2, 1, 10, 4, 11, 9, "Finished"), // Marc 2-0 Pol
  c("P007", "P008", 2, 2, 7, 9, 5, 12, "Ongoing"), // Hugo vs Iker — on now
  c("P005", "P007", 2, 3, null, null, null, null, "Scheduled"),
  c("P006", "P008", 2, 4, null, null, null, null, "Scheduled"),
  c("P005", "P008", 2, 5, null, null, null, null, "Scheduled"),
  c("P006", "P007", 2, 6, null, null, null, null, "Cancelled"), // withdrawn fixture

  // G03 (3-player pool): base round-robin (7,8,9) + two repeats (10,11) so P009 plays 4, others 3
  c("P009", "P010", 2, 7, 9, 8, 6, 10, "Finished", "", ""), // Eric 1-1 Nil
  c("P010", "P011", 2, 8, 11, 3, 8, 6, "Finished"), // Nil 2-0 Aran
  c("P011", "P009", 2, 9, null, null, null, null, "Scheduled"), // not played yet
  c("P009", "P010", 2, 10, null, null, null, null, "Scheduled"), // repeat
  c("P009", "P011", 2, 11, null, null, null, null, "Scheduled"), // repeat
];
