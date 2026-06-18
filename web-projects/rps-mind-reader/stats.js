// DOM wiring for the statistics page. Reads the saved state, computes metrics via
// the pure analytics module, and renders summary cards, a custom SVG trend chart,
// the outcome split, and move tendencies. No charting dependency -- the line chart
// is drawn by hand so the project stays dependency-free and fully offline.

import { MOVES, percentages, totalsCount } from "./game.js";
import { loadState } from "./storage.js";
import {
  cumulativeSeries,
  moveDistribution,
  streaks,
  rollingWinRate,
  seriesToPoints,
} from "./analytics.js";

const SVGNS = "http://www.w3.org/2000/svg";
const LABEL = { rock: "Rock", paper: "Paper", scissors: "Scissors" };
const EMOJI = { rock: "✊", paper: "✋", scissors: "✌️" };
const ROLLING_WINDOW = 20;

const CHART_W = 640;
const CHART_H = 280;
const PAD = 34;

const state = loadState();

function pct(x) {
  return Math.round(x * 100) + "%";
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// ---- Summary cards -------------------------------------------------------

function renderCards() {
  const rounds = state.rounds;
  const totals = state.totals;
  const p = percentages(totals);
  const sk = streaks(rounds);
  const dist = moveDistribution(rounds);
  const rolling = rollingWinRate(rounds, ROLLING_WINDOW);
  const recent = rolling.length ? rolling[rolling.length - 1] : 0;

  const cards = [
    { label: "Rounds played", value: String(totalsCount(totals)) },
    { label: "Win rate", value: pct(p.win), tone: "win" },
    { label: `Recent form (last ${Math.min(ROLLING_WINDOW, rounds.length)})`, value: pct(recent), tone: "win" },
    { label: "Best win streak", value: String(state.bestStreak), tone: "win" },
    { label: "Worst losing streak", value: String(sk.bestLoss), tone: "loss" },
    {
      label: "Most-played move",
      value: dist.top ? `${EMOJI[dist.top]} ${LABEL[dist.top]}` : "—",
      sub: dist.top ? pct(dist.counts[dist.top] / dist.total) + " of throws" : "",
    },
  ];

  const container = document.getElementById("cards");
  container.textContent = "";
  for (const c of cards) {
    const card = el("div", { class: "card" + (c.tone ? " card--" + c.tone : "") });
    card.append(el("span", { class: "card-value" }, c.value));
    card.append(el("span", { class: "card-label" }, c.label));
    if (c.sub) card.append(el("span", { class: "card-sub" }, c.sub));
    container.append(card);
  }
}

// ---- Trend chart ---------------------------------------------------------

function renderChart() {
  const rounds = state.rounds;
  const series = cumulativeSeries(rounds);
  const maxY = Math.max(
    series.wins[series.wins.length - 1] || 0,
    series.losses[series.losses.length - 1] || 0,
    series.ties[series.ties.length - 1] || 0,
    1
  );

  const chart = svg("svg", {
    viewBox: `0 0 ${CHART_W} ${CHART_H}`,
    class: "chart",
    role: "img",
    "aria-label": `Cumulative wins ${series.wins.at(-1)}, ties ${series.ties.at(-1)}, losses ${series.losses.at(-1)} over ${rounds.length} rounds`,
  });

  // Horizontal gridlines + y labels at 0, mid, max.
  for (const frac of [0, 0.5, 1]) {
    const v = Math.round(maxY * frac);
    const y = PAD + (CHART_H - PAD * 2) * (1 - frac);
    chart.append(svg("line", { x1: PAD, y1: y, x2: CHART_W - PAD, y2: y, class: "chart-grid" }));
    const yLabel = svg("text", { x: PAD - 8, y: y + 4, class: "chart-axis", "text-anchor": "end" });
    yLabel.textContent = String(v);
    chart.append(yLabel);
  }

  // X axis end labels (chronological order of the stored window).
  const xText = (x, anchor, t) => {
    const node = svg("text", { x, y: CHART_H - PAD + 20, class: "chart-axis", "text-anchor": anchor });
    node.textContent = t;
    chart.append(node);
  };
  xText(PAD, "start", "oldest");
  xText(CHART_W - PAD, "end", "latest");

  const opts = { width: CHART_W, height: CHART_H, padding: PAD, maxY };
  chart.append(linePath(seriesToPoints(series.losses, opts), "loss"));
  chart.append(linePath(seriesToPoints(series.ties, opts), "tie"));
  chart.append(linePath(seriesToPoints(series.wins, opts), "win"));

  const wrap = document.getElementById("chart-wrap");
  wrap.textContent = "";
  wrap.append(chart);

  const note = document.getElementById("chart-note");
  const windowed = rounds.length < totalsCount(state.totals);
  note.textContent = windowed
    ? `Showing your most recent ${rounds.length} rounds.`
    : `Across all ${rounds.length} rounds played.`;
}

function linePath(points, kind) {
  const d = points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
  return svg("polyline", { points: d, class: "chart-line chart-line--" + kind });
}

// ---- Outcome split -------------------------------------------------------

function renderSplit() {
  const totals = state.totals;
  const p = percentages(totals);
  document.getElementById("split-win").style.width = p.win * 100 + "%";
  document.getElementById("split-tie").style.width = p.tie * 100 + "%";
  document.getElementById("split-loss").style.width = p.loss * 100 + "%";

  const legend = document.getElementById("split-legend");
  legend.textContent = "";
  const items = [
    { kind: "win", label: "Wins", n: totals.win, pct: p.win },
    { kind: "tie", label: "Ties", n: totals.tie, pct: p.tie },
    { kind: "loss", label: "Losses", n: totals.loss, pct: p.loss },
  ];
  for (const it of items) {
    const span = el("span", { class: "split-item split-item--" + it.kind });
    span.append(el("strong", {}, String(it.n)));
    span.append(document.createTextNode(` ${it.label} · ${pct(it.pct)}`));
    legend.append(span);
  }
}

// ---- Move tendencies -----------------------------------------------------

function renderMoveDistribution() {
  const dist = moveDistribution(state.rounds);
  const container = document.getElementById("move-dist");
  container.textContent = "";
  for (const m of MOVES) {
    const share = dist.total ? dist.counts[m] / dist.total : 0;
    const row = el("div", { class: "dist-row" });
    row.append(el("span", { class: "dist-label" }, `${EMOJI[m]} ${LABEL[m]}`));
    const track = el("div", { class: "dist-track" });
    const fill = el("div", { class: "dist-fill" });
    fill.style.width = share * 100 + "%";
    track.append(fill);
    row.append(track);
    row.append(el("span", { class: "dist-pct" }, pct(share)));
    container.append(row);
  }

  const note = document.getElementById("dist-note");
  if (!dist.total) {
    note.textContent = "";
    return;
  }
  const even = 1 / 3;
  const topShare = dist.counts[dist.top] / dist.total;
  note.textContent =
    topShare > even + 0.12
      ? `You lean on ${LABEL[dist.top]} — predictable leans are exactly what the AI hunts for.`
      : "Nicely balanced across all three — hard to read.";
}

// ---- Init ----------------------------------------------------------------

function init() {
  const hasData = state.rounds.length > 0;
  document.getElementById("empty-state").hidden = hasData;
  document.getElementById("stats-content").hidden = !hasData;
  if (!hasData) return;
  renderCards();
  renderChart();
  renderSplit();
  renderMoveDistribution();
}

init();
