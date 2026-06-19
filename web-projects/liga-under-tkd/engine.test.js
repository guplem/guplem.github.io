import { describe, test, expect } from "bun:test";
import {
  STATUS,
  roundWinner,
  combatScore,
  combatResultString,
  sideOf,
  opponentId,
  combatGroupId,
  standingsForGroup,
  crossTable,
  matrixLabels,
  fieldRunningOrder,
  byCombatOrder,
  athleteFixtures,
  athleteSummary,
  searchPlayers,
  DEFAULT_TIEBREAKERS,
} from "./engine.js";

// ---- small builders so tests read clearly ----
function combat(over) {
  return {
    redId: "P1",
    blueId: "P2",
    field: 1,
    combat: 1,
    rounds: [
      { red: null, blue: null, winner: null },
      { red: null, blue: null, winner: null },
    ],
    status: STATUS.FINISHED,
    ...over,
  };
}
function rounds(r1r, r1b, r2r, r2b, w1 = null, w2 = null) {
  return [
    { red: r1r, blue: r1b, winner: w1 },
    { red: r2r, blue: r2b, winner: w2 },
  ];
}

describe("roundWinner", () => {
  test("higher points wins when no Winner is set", () => {
    expect(roundWinner({ red: 10, blue: 4, winner: null })).toBe("Red");
    expect(roundWinner({ red: 2, blue: 9, winner: null })).toBe("Blue");
  });
  test("an explicit Winner decides a tie", () => {
    expect(roundWinner({ red: 5, blue: 5, winner: "Blue" })).toBe("Blue");
    expect(roundWinner({ red: 5, blue: 5, winner: "Red" })).toBe("Red");
  });
  test("an explicit Winner OVERRIDES the points (disqualification / withdrawal)", () => {
    // Red scored far more, but Blue is set as the round Winner (e.g. Red disqualified).
    expect(roundWinner({ red: 10, blue: 2, winner: "Blue" })).toBe("Blue");
    // Blue scored more, but Red is the set Winner.
    expect(roundWinner({ red: 3, blue: 9, winner: "Red" })).toBe("Red");
  });
  test("an explicit Winner stands even with no scores entered (walkover)", () => {
    expect(roundWinner({ red: null, blue: null, winner: "Red" })).toBe("Red");
  });
  test("tied points with no Winner set is undecided", () => {
    expect(roundWinner({ red: 5, blue: 5, winner: null })).toBe(null);
  });
  test("missing scores with no Winner are undecided", () => {
    expect(roundWinner({ red: null, blue: 3, winner: null })).toBe(null);
  });
});

describe("combatScore — league points 3 / 1 / 0", () => {
  test("win both rounds (2-0) = 3 league points to the winner, 0 to the loser", () => {
    const s = combatScore(combat({ rounds: rounds(10, 5, 8, 6) }));
    expect(s.redRoundsWon).toBe(2);
    expect(s.blueRoundsWon).toBe(0);
    expect(s.redLeaguePoints).toBe(3);
    expect(s.blueLeaguePoints).toBe(0);
    expect(s.decided).toBe(true);
  });
  test("split 1-1 = 1 league point each", () => {
    const s = combatScore(combat({ rounds: rounds(10, 5, 4, 9) }));
    expect(s.redRoundsWon).toBe(1);
    expect(s.blueRoundsWon).toBe(1);
    expect(s.redLeaguePoints).toBe(1);
    expect(s.blueLeaguePoints).toBe(1);
  });
  test("lose both rounds (0-2) = 0 league points", () => {
    const s = combatScore(combat({ rounds: rounds(2, 7, 1, 5) }));
    expect(s.redLeaguePoints).toBe(0);
    expect(s.blueLeaguePoints).toBe(3);
  });
  test("a tied round resolved by the Winner column counts as a round win", () => {
    const s = combatScore(combat({ rounds: rounds(5, 5, 3, 8, "Red") }));
    // R1 tie -> Red by Winner; R2 -> Blue. That is 1-1.
    expect(s.redRoundsWon).toBe(1);
    expect(s.blueRoundsWon).toBe(1);
    expect(s.redLeaguePoints).toBe(1);
  });
  test("a disqualification (Winner overrides points) flips the league points", () => {
    // Red leads on points both rounds (10-2, 8-4) but Blue is the set Winner both rounds.
    const s = combatScore(combat({ rounds: rounds(10, 2, 8, 4, "Blue", "Blue") }));
    expect(s.redRoundsWon).toBe(0);
    expect(s.blueRoundsWon).toBe(2);
    expect(s.redLeaguePoints).toBe(0);
    expect(s.blueLeaguePoints).toBe(3);
    expect(s.decided).toBe(true);
    // Points for/against keep the real mat scores even though Blue won by override.
    expect(s.redPointsFor).toBe(18); // 10 + 8
    expect(s.bluePointsFor).toBe(6); // 2 + 4
  });
  test("points for/against = sum of round points, independent of the Winner column", () => {
    const s = combatScore(combat({ rounds: rounds(10, 5, 4, 9) }));
    expect(s.redPointsFor).toBe(14); // 10 + 4
    expect(s.redPointsAgainst).toBe(14); // 5 + 9
    expect(s.bluePointsFor).toBe(14);
    expect(s.bluePointsAgainst).toBe(14);
  });
  test("an unplayed combat is not decided", () => {
    const s = combatScore(combat({ rounds: rounds(null, null, null, null) }));
    expect(s.decided).toBe(false);
  });
});

describe("combatResultString", () => {
  test("reads from Red's perspective", () => {
    expect(combatResultString(combat({ rounds: rounds(10, 5, 8, 6) }))).toBe("2-0");
    expect(combatResultString(combat({ rounds: rounds(10, 5, 4, 9) }))).toBe("1-1");
    expect(combatResultString(combat({ rounds: rounds(1, 9, 2, 8) }))).toBe("0-2");
  });
  test("empty when no round decided", () => {
    expect(combatResultString(combat({ rounds: rounds(null, null, null, null) }))).toBe("");
  });
});

describe("sideOf / opponentId", () => {
  const c = combat({ redId: "PA", blueId: "PB" });
  test("identifies side", () => {
    expect(sideOf(c, "PA")).toBe("Red");
    expect(sideOf(c, "PB")).toBe("Blue");
    expect(sideOf(c, "PX")).toBe(null);
  });
  test("finds opponent", () => {
    expect(opponentId(c, "PA")).toBe("PB");
    expect(opponentId(c, "PB")).toBe("PA");
    expect(opponentId(c, "PX")).toBe(null);
  });
});

describe("standingsForGroup", () => {
  // A 3-player group: P1, P2, P3 all in G01.
  const players = [
    { playerId: "P1", fullName: "One", club: "C", groupId: "G01" },
    { playerId: "P2", fullName: "Two", club: "C", groupId: "G01" },
    { playerId: "P3", fullName: "Three", club: "C", groupId: "G01" },
    { playerId: "PX", fullName: "Other", club: "C", groupId: "G02" },
  ];

  test("only Finished combats count; Cancelled/Ongoing/Scheduled are ignored", () => {
    const combats = [
      // P1 beats P2 2-0 (Finished)
      combat({ redId: "P1", blueId: "P2", rounds: rounds(10, 4, 9, 3), status: STATUS.FINISHED }),
      // P2 vs P3 ongoing -> ignored
      combat({ redId: "P2", blueId: "P3", rounds: rounds(5, 5, 0, 0), status: STATUS.ONGOING }),
      // P1 vs P3 cancelled -> ignored
      combat({ redId: "P1", blueId: "P3", rounds: rounds(9, 9, 9, 9), status: STATUS.CANCELLED }),
    ];
    const table = standingsForGroup(players, combats, "G01");
    const p1 = table.find((r) => r.playerId === "P1");
    const p2 = table.find((r) => r.playerId === "P2");
    const p3 = table.find((r) => r.playerId === "P3");
    expect(p1.played).toBe(1);
    expect(p1.won).toBe(1);
    expect(p1.leaguePoints).toBe(3);
    expect(p2.played).toBe(1);
    expect(p2.lost).toBe(1);
    expect(p3.played).toBe(0); // only ongoing/cancelled
  });

  test("computes points for / against / difference", () => {
    const combats = [
      combat({ redId: "P1", blueId: "P2", rounds: rounds(10, 5, 4, 9), status: STATUS.FINISHED }),
    ];
    const table = standingsForGroup(players, combats, "G01");
    const p1 = table.find((r) => r.playerId === "P1");
    expect(p1.pointsFor).toBe(14);
    expect(p1.pointsAgainst).toBe(14);
    expect(p1.diff).toBe(0);
    expect(p1.drawn).toBe(1);
    expect(p1.leaguePoints).toBe(1);
  });

  test("ranks by league points, then difference", () => {
    const combats = [
      // P1 beats P2 2-0
      combat({ redId: "P1", blueId: "P2", rounds: rounds(10, 0, 10, 0), status: STATUS.FINISHED }),
      // P3 beats P2 2-0 but by a smaller margin
      combat({ redId: "P3", blueId: "P2", rounds: rounds(6, 5, 6, 5), status: STATUS.FINISHED }),
    ];
    const table = standingsForGroup(players, combats, "G01");
    // P1 and P3 both have 3 points; P1 has a bigger difference -> ranks first.
    expect(table[0].playerId).toBe("P1");
    expect(table[1].playerId).toBe("P3");
    expect(table[0].rank).toBe(1);
    expect(table[2].playerId).toBe("P2");
  });

  test("head-to-head breaks a tie when points and difference are equal", () => {
    // Construct P1 and P2 level on points + difference + points-for, but P1 beat P2 head to head.
    const combats = [
      // P1 beats P2 in a 1-1 draw is no good; make a clean head-to-head: P1 beats P2 2-0 10-0,10-0
      combat({ redId: "P1", blueId: "P2", rounds: rounds(10, 0, 10, 0), status: STATUS.FINISHED }),
      // P2 beats P3 2-0 10-0,10-0 ; P1 loses to P3 0-2 0-10,0-10 -> all three have symmetric totals
      combat({ redId: "P2", blueId: "P3", rounds: rounds(10, 0, 10, 0), status: STATUS.FINISHED }),
      combat({ redId: "P3", blueId: "P1", rounds: rounds(10, 0, 10, 0), status: STATUS.FINISHED }),
    ];
    // Each of P1,P2,P3 has exactly one win and one loss: 3 league points, diff 0, PF 20, PA 20.
    const table = standingsForGroup(players, combats, "G01");
    expect(table.map((r) => r.leaguePoints)).toEqual([3, 3, 3]);
    // A perfect 3-cycle: head-to-head cannot separate them, so it falls back to playerId order.
    expect(table.map((r) => r.playerId)).toEqual(["P1", "P2", "P3"]);
  });

  test("tiebreaker chain is configurable (one-line swap)", () => {
    const combats = [
      combat({ redId: "P1", blueId: "P2", rounds: rounds(10, 0, 10, 0), status: STATUS.FINISHED }),
      combat({ redId: "P3", blueId: "P2", rounds: rounds(6, 5, 6, 5), status: STATUS.FINISHED }),
    ];
    // A silly chain that ranks by points-for only, ascending — proves the chain is honored.
    const reverseByPointsFor = [(a, b) => a.pointsFor - b.pointsFor];
    const table = standingsForGroup(players, combats, "G01", reverseByPointsFor);
    // P2 has the fewest points-for here, so it comes first under this chain.
    expect(table[0].playerId).toBe("P2");
    expect(DEFAULT_TIEBREAKERS.length).toBe(4);
  });
});

describe("crossTable", () => {
  const players = [
    { playerId: "P1", fullName: "One", groupId: "G01" },
    { playerId: "P2", fullName: "Two", groupId: "G01" },
    { playerId: "P3", fullName: "Three", groupId: "G01" },
  ];
  const combats = [
    combat({ redId: "P1", blueId: "P2", rounds: rounds(10, 5, 9, 3), status: STATUS.FINISHED }),
    combat({ redId: "P2", blueId: "P1", rounds: rounds(2, 8, 1, 7), status: STATUS.FINISHED }), // repeat pair, reversed
  ];

  test("axis lists the group players", () => {
    const ct = crossTable(players, combats, "G01");
    expect(ct.players.map((p) => p.playerId)).toEqual(["P1", "P2", "P3"]);
  });

  test("diagonal is blank (nobody fights themselves)", () => {
    const ct = crossTable(players, combats, "G01");
    for (let i = 0; i < ct.players.length; i++) {
      expect(ct.rows[i].cells[i].diagonal).toBe(true);
      expect(ct.rows[i].cells[i].combats.length).toBe(0);
    }
  });

  test("cell holds combats for that exact (Red col, Blue row) pair", () => {
    const ct = crossTable(players, combats, "G01");
    // Blue row P2, Red column P1 -> the first combat (red P1, blue P2)
    const blueP2 = ct.rows.find((r) => r.blue.playerId === "P2");
    const redP1Cell = blueP2.cells.find((c) => c.red.playerId === "P1");
    expect(redP1Cell.combats.length).toBe(1);
    expect(redP1Cell.combats[0].result).toBe("2-0");
  });
});

describe("matrixLabels", () => {
  test("uses just the first name when first names are unique", () => {
    const players = [
      { playerId: "P1", name: "Aina", surname: "Roca", fullName: "Aina Roca" },
      { playerId: "P2", name: "Berta", surname: "Solé", fullName: "Berta Solé" },
    ];
    const labels = matrixLabels(players);
    expect(labels.get("P1")).toBe("Aina");
    expect(labels.get("P2")).toBe("Berta");
  });

  test("adds the surname initial when two share a first name", () => {
    const players = [
      { playerId: "P1", name: "Aina", surname: "Roca", fullName: "Aina Roca" },
      { playerId: "P2", name: "Aina", surname: "Solé", fullName: "Aina Solé" },
      { playerId: "P3", name: "Berta", surname: "Vila", fullName: "Berta Vila" },
    ];
    const labels = matrixLabels(players);
    expect(labels.get("P1")).toBe("Aina R.");
    expect(labels.get("P2")).toBe("Aina S.");
    expect(labels.get("P3")).toBe("Berta"); // unaffected
  });

  test("falls back to the full surname when first name AND initial collide", () => {
    const players = [
      { playerId: "P1", name: "Aina", surname: "Roca", fullName: "Aina Roca" },
      { playerId: "P2", name: "Aina", surname: "Ramos", fullName: "Aina Ramos" },
    ];
    const labels = matrixLabels(players);
    expect(labels.get("P1")).toBe("Aina Roca");
    expect(labels.get("P2")).toBe("Aina Ramos");
  });

  test("falls back to the player id when there is no name at all", () => {
    const players = [{ playerId: "P9", name: "", surname: "", fullName: "" }];
    expect(matrixLabels(players).get("P9")).toBe("P9");
  });
});

describe("fieldRunningOrder", () => {
  const combats = [
    combat({ field: 1, combat: 3, status: STATUS.SCHEDULED }),
    combat({ field: 1, combat: 1, status: STATUS.FINISHED }),
    combat({ field: 1, combat: 2, status: STATUS.ONGOING }),
    combat({ field: 2, combat: 1, status: STATUS.SCHEDULED }),
  ];

  test("groups by field and sorts by combat number", () => {
    const fields = fieldRunningOrder(combats);
    expect(fields.map((f) => f.field)).toEqual([1, 2]);
    expect(fields[0].combats.map((c) => c.combat)).toEqual([1, 2, 3]);
  });

  test("marks the ongoing combat as current and the following scheduled as next", () => {
    const fields = fieldRunningOrder(combats);
    const f1 = fields[0].combats;
    expect(f1[1].isCurrent).toBe(true); // combat 2 ongoing
    expect(f1[2].isNext).toBe(true); // combat 3 scheduled, after current
    expect(f1[0].isCurrent).toBe(false);
  });

  test("when nothing is ongoing, the first scheduled is next", () => {
    const f2 = fieldRunningOrder(combats)[1].combats;
    expect(f2[0].isNext).toBe(true);
    expect(f2[0].isCurrent).toBe(false);
  });
});

describe("byCombatOrder", () => {
  test("orders ascending, nulls last", () => {
    const arr = [{ combat: 3 }, { combat: null }, { combat: 1 }].sort(byCombatOrder);
    expect(arr.map((x) => x.combat)).toEqual([1, 3, null]);
  });
});

describe("athleteFixtures", () => {
  const combats = [
    combat({ redId: "P1", blueId: "P2", field: 1, combat: 1, status: STATUS.FINISHED }),
    combat({ redId: "P3", blueId: "P1", field: 1, combat: 2, status: STATUS.ONGOING }),
    combat({ redId: "P1", blueId: "P4", field: 2, combat: 5, status: STATUS.SCHEDULED }),
    combat({ redId: "P1", blueId: "P5", field: 1, combat: 9, status: STATUS.CANCELLED }),
  ];

  test("splits past / upcoming / cancelled", () => {
    const f = athleteFixtures("P1", combats);
    expect(f.past.length).toBe(1);
    expect(f.upcoming.length).toBe(2);
    expect(f.cancelled.length).toBe(1);
  });
  test("next combat is the ongoing one when present", () => {
    const f = athleteFixtures("P1", combats);
    expect(f.nextCombat.status).toBe(STATUS.ONGOING);
  });
  test("next combat is the earliest upcoming when none ongoing", () => {
    const onlyScheduled = combats.filter((c) => c.status !== STATUS.ONGOING);
    const f = athleteFixtures("P1", onlyScheduled);
    expect(f.nextCombat.status).toBe(STATUS.SCHEDULED);
    expect(f.nextCombat.combat).toBe(5);
  });
});

describe("athleteSummary", () => {
  const players = [
    { playerId: "P1", fullName: "One", club: "C", groupId: "G01" },
    { playerId: "P2", fullName: "Two", club: "C", groupId: "G01" },
  ];
  const combats = [
    combat({ redId: "P1", blueId: "P2", rounds: rounds(10, 0, 10, 0), status: STATUS.FINISHED }),
  ];
  test("returns group + standing row + group size", () => {
    const s = athleteSummary("P1", players, combats);
    expect(s.groupId).toBe("G01");
    expect(s.standing.leaguePoints).toBe(3);
    expect(s.standing.rank).toBe(1);
    expect(s.groupSize).toBe(2);
  });
  test("returns null for an unknown player", () => {
    expect(athleteSummary("NOPE", players, combats)).toBe(null);
  });
});

describe("searchPlayers", () => {
  const players = [
    { playerId: "P001", fullName: "Teyxion Jace Suarez", club: "Avellaneda", groupId: "G01" },
    { playerId: "P002", fullName: "Maria Lopez", club: "Premià", groupId: "G02" },
  ];
  test("matches by name (case-insensitive, partial)", () => {
    expect(searchPlayers(players, "jace").map((p) => p.playerId)).toEqual(["P001"]);
  });
  test("matches by player id", () => {
    expect(searchPlayers(players, "p002").map((p) => p.playerId)).toEqual(["P002"]);
  });
  test("matches by club", () => {
    expect(searchPlayers(players, "premià").map((p) => p.playerId)).toEqual(["P002"]);
  });
  test("empty query returns nothing", () => {
    expect(searchPlayers(players, "")).toEqual([]);
    expect(searchPlayers(players, "   ")).toEqual([]);
  });
});

describe("review fixes — undecided Finished combats and ungrouped players", () => {
  const players = [
    { playerId: "P1", fullName: "One", club: "C", groupId: "G01" },
    { playerId: "P2", fullName: "Two", club: "C", groupId: "G01" },
  ];

  test("a Finished combat with no scores does not create phantom league points", () => {
    const combats = [
      combat({ redId: "P1", blueId: "P2", rounds: rounds(null, null, null, null), status: STATUS.FINISHED }),
    ];
    const table = standingsForGroup(players, combats, "G01");
    for (const row of table) {
      expect(row.played).toBe(0);
      expect(row.leaguePoints).toBe(0);
    }
  });

  test("a half-entered Finished combat (only round 1) does not count", () => {
    const combats = [
      combat({ redId: "P1", blueId: "P2", rounds: rounds(10, 4, null, null), status: STATUS.FINISHED }),
    ];
    const table = standingsForGroup(players, combats, "G01");
    expect(table.find((r) => r.playerId === "P1").played).toBe(0);
  });

  test("standingsForGroup returns [] for a falsy group id", () => {
    expect(standingsForGroup(players, [], "")).toEqual([]);
  });

  test("crossTable returns empty for a falsy group id", () => {
    expect(crossTable(players, [], "")).toEqual({ players: [], rows: [] });
  });

  test("combatGroupId is null when neither fighter has a group", () => {
    const ungrouped = [
      { playerId: "U1", fullName: "U one", club: "", groupId: "" },
      { playerId: "U2", fullName: "U two", club: "", groupId: "" },
    ];
    expect(combatGroupId(combat({ redId: "U1", blueId: "U2" }), ungrouped)).toBe(null);
  });

  test("a second simultaneous Ongoing on a field is marked as next", () => {
    const combats = [
      combat({ field: 1, combat: 1, status: STATUS.ONGOING }),
      combat({ field: 1, combat: 2, status: STATUS.ONGOING }),
    ];
    const f1 = fieldRunningOrder(combats)[0].combats;
    expect(f1[0].isCurrent).toBe(true);
    expect(f1[1].isNext).toBe(true);
  });
});
