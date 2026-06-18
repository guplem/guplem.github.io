// Standings / result engine: pure functions, no DOM, no network. Safe to import from tests.
//
// Tournament rules (spec §4):
//   - A combat = 2 rounds. Each round is won by higher points; a tied round is decided by
//     the referee's tie-break ("Red"/"Blue").
//   - League points per combat: win both rounds = 3, split 1-1 = 1 each, lose both = 0.
//   - Points for / against = sum of round points scored / conceded across all combats.
//   - Standings count ONLY Finished combats. Cancelled is ignored. Ongoing/Scheduled do not count.
//   - Ranking: league points, then points difference, then points-for, then head-to-head
//     (configurable via the tiebreaker chain).

export const STATUS = Object.freeze({
  SCHEDULED: "Scheduled",
  ONGOING: "Ongoing",
  FINISHED: "Finished",
  CANCELLED: "Cancelled",
});

// Winner of a single round -> "Red" | "Blue" | null (null = not decided / not played).
export function roundWinner(round) {
  if (!round) return null;
  const { red, blue, tiebreak } = round;
  if (red === null || red === undefined || blue === null || blue === undefined) return null;
  if (red > blue) return "Red";
  if (blue > red) return "Blue";
  return tiebreak === "Red" || tiebreak === "Blue" ? tiebreak : null;
}

// Aggregate one combat from each fighter's point of view.
// Returns rounds won, league points, and points for/against for Red and Blue.
// `decided` is true when both rounds have a winner (a normal Finished combat).
export function combatScore(combat) {
  const rounds = (combat && combat.rounds) || [];
  let redRoundsWon = 0;
  let blueRoundsWon = 0;
  let redPointsFor = 0;
  let bluePointsFor = 0;
  let playedRounds = 0;

  for (const round of rounds) {
    const winner = roundWinner(round);
    if (round && round.red !== null && round.red !== undefined) redPointsFor += round.red;
    if (round && round.blue !== null && round.blue !== undefined) bluePointsFor += round.blue;
    if (winner === "Red") redRoundsWon++;
    else if (winner === "Blue") blueRoundsWon++;
    if (winner !== null) playedRounds++;
  }

  const decided = rounds.length > 0 && playedRounds === rounds.length;

  let redLeaguePoints = 0;
  let blueLeaguePoints = 0;
  if (redRoundsWon > blueRoundsWon) {
    redLeaguePoints = 3;
    blueLeaguePoints = 0;
  } else if (blueRoundsWon > redRoundsWon) {
    blueLeaguePoints = 3;
    redLeaguePoints = 0;
  } else {
    // Equal rounds won = a 1-1 split (a draw): 1 league point each.
    redLeaguePoints = 1;
    blueLeaguePoints = 1;
  }

  return {
    redRoundsWon,
    blueRoundsWon,
    redLeaguePoints,
    blueLeaguePoints,
    redPointsFor,
    redPointsAgainst: bluePointsFor,
    bluePointsFor,
    bluePointsAgainst: redPointsFor,
    decided,
  };
}

// "2-0" / "1-1" / "0-2" from Red's perspective (rounds won). "" if no rounds decided yet.
export function combatResultString(combat) {
  const s = combatScore(combat);
  if (s.redRoundsWon === 0 && s.blueRoundsWon === 0) return "";
  return `${s.redRoundsWon}-${s.blueRoundsWon}`;
}

// Which side a given player is on in a combat: "Red" | "Blue" | null.
export function sideOf(combat, playerId) {
  if (combat.redId === playerId) return "Red";
  if (combat.blueId === playerId) return "Blue";
  return null;
}

// The opponent's player id for a given player in a combat, or null.
export function opponentId(combat, playerId) {
  if (combat.redId === playerId) return combat.blueId;
  if (combat.blueId === playerId) return combat.redId;
  return null;
}

// Build a quick playerId -> groupId lookup.
function groupIndex(players) {
  const map = new Map();
  for (const p of players) map.set(p.playerId, p.groupId);
  return map;
}

// The group a combat belongs to (both fighters share a group). Uses the Red fighter.
export function combatGroupId(combat, players) {
  const idx = players instanceof Map ? players : groupIndex(players);
  // null (not "") when neither fighter resolves a group, so ungrouped combats are never
  // bucketed into a phantom group keyed by the empty string.
  return idx.get(combat.redId) || idx.get(combat.blueId) || null;
}

// All combats that belong to a group (by either fighter's group membership).
export function combatsInGroup(combats, players, groupId) {
  const idx = groupIndex(players);
  return combats.filter((c) => combatGroupId(c, idx) === groupId);
}

// ---------- standings ----------

function emptyRow(playerId) {
  return {
    playerId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    diff: 0,
    leaguePoints: 0,
  };
}

function applyCombatToRow(row, leaguePoints, pointsFor, pointsAgainst) {
  row.played += 1;
  row.pointsFor += pointsFor;
  row.pointsAgainst += pointsAgainst;
  row.leaguePoints += leaguePoints;
  if (leaguePoints === 3) row.won += 1;
  else if (leaguePoints === 1) row.drawn += 1;
  else row.lost += 1;
}

// Default tiebreaker chain (spec §4). Each comparator returns <0 if `a` ranks above `b`.
// `ctx.finishedCombats` are the group's Finished combats, used by head-to-head.
export const DEFAULT_TIEBREAKERS = Object.freeze([
  function byLeaguePoints(a, b) {
    return b.leaguePoints - a.leaguePoints;
  },
  function byDifference(a, b) {
    return b.diff - a.diff;
  },
  function byPointsFor(a, b) {
    return b.pointsFor - a.pointsFor;
  },
  function byHeadToHead(a, b, ctx) {
    let aPts = 0;
    let bPts = 0;
    for (const c of ctx.finishedCombats) {
      const involvesA = c.redId === a.playerId || c.blueId === a.playerId;
      const involvesB = c.redId === b.playerId || c.blueId === b.playerId;
      if (!involvesA || !involvesB) continue;
      const s = combatScore(c);
      if (!s.decided) continue; // ignore Finished combats whose rounds are not fully entered
      aPts += c.redId === a.playerId ? s.redLeaguePoints : s.blueLeaguePoints;
      bPts += c.redId === b.playerId ? s.redLeaguePoints : s.blueLeaguePoints;
    }
    return bPts - aPts;
  },
]);

// Standings for one group: ordered rows with played/won/drawn/lost/PF/PA/diff/points + rank.
// Counts only Finished combats. `tiebreakers` lets the organizer plug in a different chain.
export function standingsForGroup(players, combats, groupId, tiebreakers = DEFAULT_TIEBREAKERS) {
  if (!groupId) return []; // no phantom group for ungrouped players (blank Group ID)
  const groupPlayers = players.filter((p) => p.groupId === groupId);
  const rows = new Map();
  for (const p of groupPlayers) rows.set(p.playerId, emptyRow(p.playerId));

  const idx = groupIndex(players);
  const finishedCombats = combats.filter(
    (c) => c.status === STATUS.FINISHED && combatGroupId(c, idx) === groupId
  );

  for (const c of finishedCombats) {
    const s = combatScore(c);
    // A combat marked Finished before both rounds are entered is not yet decided; counting it
    // would create phantom draws/wins. Skip until both rounds have a winner.
    if (!s.decided) continue;
    const redRow = rows.get(c.redId);
    const blueRow = rows.get(c.blueId);
    if (redRow) applyCombatToRow(redRow, s.redLeaguePoints, s.redPointsFor, s.redPointsAgainst);
    if (blueRow) applyCombatToRow(blueRow, s.blueLeaguePoints, s.bluePointsFor, s.bluePointsAgainst);
  }

  const list = [...rows.values()];
  for (const row of list) row.diff = row.pointsFor - row.pointsAgainst;

  const ctx = { finishedCombats, players };
  list.sort((a, b) => {
    for (const cmp of tiebreakers) {
      const result = cmp(a, b, ctx);
      if (result !== 0) return result;
    }
    // Final stable fallback: by player id, so the order is deterministic.
    return a.playerId.localeCompare(b.playerId);
  });

  list.forEach((row, i) => {
    row.rank = i + 1;
  });
  return list;
}

// ---------- cross-table matrix ----------

// Cross-table per group. Rows = Blue fighter, columns = Red fighter (matches the organizers'
// grid). The diagonal is null (nobody fights themselves). A cell holds the list of combats for
// that exact (Red, Blue) pairing — usually 0 or 1, but more when a pair repeats in a 3-player pool.
export function crossTable(players, combats, groupId) {
  if (!groupId) return { players: [], rows: [] };
  const axis = players
    .filter((p) => p.groupId === groupId)
    .slice()
    .sort((a, b) => a.playerId.localeCompare(b.playerId));

  const idx = groupIndex(players);
  const groupCombats = combats.filter((c) => combatGroupId(c, idx) === groupId);

  const rows = axis.map((blue) => ({
    blue,
    cells: axis.map((red) => {
      if (red.playerId === blue.playerId) return { red, blue, diagonal: true, combats: [] };
      const matching = groupCombats
        .filter((c) => c.redId === red.playerId && c.blueId === blue.playerId)
        .map((c) => ({
          status: c.status,
          result: combatResultString(c),
          combat: c.combat,
          field: c.field,
        }));
      return { red, blue, diagonal: false, combats: matching };
    }),
  }));

  return { players: axis, rows };
}

// Short display label per player for the cross-table: the first name, plus the surname initial
// when two athletes in the group share a first name ("Aina R."), or the full surname if even the
// initial collides. Returns a Map(playerId -> label). Keeps the matrix compact but unambiguous.
export function matrixLabels(players) {
  const labels = new Map();
  const firstOf = (p) => (p.name || p.fullName || p.playerId).trim();

  const firstNameCount = new Map();
  for (const p of players) firstNameCount.set(firstOf(p), (firstNameCount.get(firstOf(p)) || 0) + 1);

  for (const p of players) {
    const first = firstOf(p);
    if (firstNameCount.get(first) === 1) {
      labels.set(p.playerId, first || p.playerId);
    } else {
      const initial = (p.surname || "").trim().charAt(0).toUpperCase();
      labels.set(p.playerId, initial ? `${first} ${initial}.` : p.fullName || p.playerId);
    }
  }

  // If a "Name I." label still collides (same first name AND same initial), use the full surname.
  const labelCount = new Map();
  for (const label of labels.values()) labelCount.set(label, (labelCount.get(label) || 0) + 1);
  for (const p of players) {
    if (labelCount.get(labels.get(p.playerId)) > 1) {
      const surname = (p.surname || "").trim();
      labels.set(p.playerId, surname ? `${(p.name || "").trim()} ${surname}`.trim() : p.fullName || p.playerId);
    }
  }
  return labels;
}

// ---------- per-field running order ----------

// Group combats by field and order them by the `Combat` running number.
// Marks the current combat (the Ongoing one, lowest number if several) and the next one
// (the first not-yet-finished combat after the current, or the first upcoming if none ongoing).
export function fieldRunningOrder(combats) {
  const byField = new Map();
  for (const c of combats) {
    const key = c.field === null ? "?" : c.field;
    if (!byField.has(key)) byField.set(key, []);
    byField.get(key).push(c);
  }

  const fields = [...byField.keys()].sort((a, b) => {
    if (a === "?") return 1;
    if (b === "?") return -1;
    return a - b;
  });

  return fields.map((field) => {
    const list = byField.get(field).slice().sort(byCombatOrder);
    const annotated = list.map((c) => ({ ...c, isCurrent: false, isNext: false }));

    const currentIndex = annotated.findIndex((c) => c.status === STATUS.ONGOING);
    if (currentIndex !== -1) annotated[currentIndex].isCurrent = true;

    const isUpcoming = (c) => c.status === STATUS.SCHEDULED || c.status === STATUS.ONGOING;
    let nextIndex = -1;
    if (currentIndex !== -1) {
      // The next combat after the current one: the following not-yet-finished combat
      // (Scheduled, or another Ongoing during a fast double-update).
      nextIndex = annotated.findIndex((c, i) => i > currentIndex && isUpcoming(c));
    } else {
      nextIndex = annotated.findIndex(isUpcoming);
    }
    if (nextIndex !== -1) annotated[nextIndex].isNext = true;

    return { field, combats: annotated };
  });
}

// Sort comparator: by Combat number ascending (nulls last).
export function byCombatOrder(a, b) {
  const an = a.combat === null ? Infinity : a.combat;
  const bn = b.combat === null ? Infinity : b.combat;
  return an - bn;
}

// ---------- per-athlete views ----------

// All combats for a player, split into past (Finished) and upcoming (Ongoing/Scheduled),
// plus the single "next" combat (Ongoing if any, else earliest upcoming by field+combat).
// Cancelled combats are returned separately and excluded from past/upcoming.
export function athleteFixtures(playerId, combats) {
  const mine = combats.filter((c) => c.redId === playerId || c.blueId === playerId);
  const order = (a, b) => {
    const af = a.field === null ? Infinity : a.field;
    const bf = b.field === null ? Infinity : b.field;
    if (af !== bf) return af - bf;
    return byCombatOrder(a, b);
  };

  const past = mine.filter((c) => c.status === STATUS.FINISHED).sort(order);
  const upcoming = mine
    .filter((c) => c.status === STATUS.SCHEDULED || c.status === STATUS.ONGOING)
    .sort(order);
  const cancelled = mine.filter((c) => c.status === STATUS.CANCELLED).sort(order);

  const ongoing = upcoming.find((c) => c.status === STATUS.ONGOING);
  const nextCombat = ongoing || upcoming[0] || null;

  return { past, upcoming, cancelled, nextCombat, all: mine.slice().sort(order) };
}

// A compact summary card for an athlete: their group + their standings row (record + rank).
export function athleteSummary(playerId, players, combats, tiebreakers = DEFAULT_TIEBREAKERS) {
  const player = players.find((p) => p.playerId === playerId) || null;
  if (!player) return null;
  const standings = standingsForGroup(players, combats, player.groupId, tiebreakers);
  const row = standings.find((r) => r.playerId === playerId) || { ...emptyRow(playerId), rank: null };
  // hasGroup is false when the athlete has no Group ID yet (group not drawn).
  return { player, groupId: player.groupId, standing: row, groupSize: standings.length, hasGroup: standings.length > 0 };
}

// Case-insensitive search by full name or Player ID. Returns matching players.
export function searchPlayers(players, query) {
  const q = String(query || "").trim().toLowerCase();
  if (q === "") return [];
  return players.filter((p) => {
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.playerId.toLowerCase().includes(q) ||
      p.club.toLowerCase().includes(q)
    );
  });
}
