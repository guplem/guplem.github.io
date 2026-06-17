// Pure analytics over a list of played rounds. No DOM access -- safe to import
// from tests. Feeds the statistics page (stats.js). A "round" is the stored shape
// { p: playerMove, a: aiMove, o: "win"|"loss"|"tie", g: predicted|null }.

import { MOVES } from "./game.js";

// Cumulative win / loss / tie counts after each round (parallel arrays, each of
// length rounds.length). The natural input for a "trend over time" line chart.
export function cumulativeSeries(rounds) {
  const wins = [];
  const losses = [];
  const ties = [];
  let w = 0;
  let l = 0;
  let t = 0;
  for (const r of rounds) {
    if (r.o === "win") w++;
    else if (r.o === "loss") l++;
    else t++;
    wins.push(w);
    losses.push(l);
    ties.push(t);
  }
  return { wins, losses, ties, length: rounds.length };
}

// How often the player throws each move, with the most frequent one. Reveals how
// predictable the player is.
export function moveDistribution(rounds) {
  const counts = { rock: 0, paper: 0, scissors: 0 };
  for (const r of rounds) {
    if (counts[r.p] != null) counts[r.p]++;
  }
  const total = counts.rock + counts.paper + counts.scissors;
  let top = null;
  let topN = 0;
  for (const m of MOVES) {
    if (counts[m] > topN) {
      topN = counts[m];
      top = m;
    }
  }
  return { counts, total, top };
}

// Best win streak, worst losing streak, and the current run. Any non-matching
// outcome (including a tie) breaks a streak, matching game.js currentStreak().
export function streaks(rounds) {
  let bestWin = 0;
  let bestLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const r of rounds) {
    if (r.o === "win") {
      curWin++;
      curLoss = 0;
    } else if (r.o === "loss") {
      curLoss++;
      curWin = 0;
    } else {
      curWin = 0;
      curLoss = 0;
    }
    if (curWin > bestWin) bestWin = curWin;
    if (curLoss > bestLoss) bestLoss = curLoss;
  }
  return { bestWin, bestLoss, currentWin: curWin, currentLoss: curLoss };
}

// Player win rate over a trailing window, computed at each round. Shows whether
// the player is pulling ahead or the AI is catching up. Values in [0, 1].
export function rollingWinRate(rounds, window = 20) {
  const out = [];
  let winsInWindow = 0;
  for (let i = 0; i < rounds.length; i++) {
    if (rounds[i].o === "win") winsInWindow++;
    if (i >= window && rounds[i - window].o === "win") winsInWindow--;
    const denom = Math.min(i + 1, window);
    out.push(winsInWindow / denom);
  }
  return out;
}

// Map a numeric series to {x, y} points inside a width x height box (with optional
// padding), y inverted so larger values sit higher. Pure geometry for the SVG
// chart; keeps the pixel math testable. A single point yields a flat line.
export function seriesToPoints(values, { width, height, padding = 0, maxY = null, minY = 0 } = {}) {
  const n = values.length;
  if (n === 0) return [];
  const max = maxY != null ? maxY : Math.max(...values, minY + 1);
  const span = max - minY || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const yFor = (v) => padding + innerH - ((v - minY) / span) * innerH;
  if (n === 1) {
    const y = yFor(values[0]);
    return [
      { x: padding, y },
      { x: padding + innerW, y },
    ];
  }
  return values.map((v, i) => ({
    x: padding + (i / (n - 1)) * innerW,
    y: yFor(v),
  }));
}
