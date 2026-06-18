// DOM wiring for the RPS Mind Reader game page. All game/AI logic lives in
// game.js and predictor.js (pure + tested); persistence lives in storage.js.
// This file only handles I/O, rendering, and the round flow.

import {
  MOVES,
  judge,
  applyRound,
  percentages,
  currentStreak,
  emptyState,
} from "./game.js";
import { createModel, decide, learn, rebuildModel } from "./predictor.js";
import { loadState, saveState, clearState } from "./storage.js";

const REVEAL_MS = 450;
const HISTORY_SHOWN = 24;

const EMOJI = { rock: "✊", paper: "✋", scissors: "✌️" };
const LABEL = { rock: "Rock", paper: "Paper", scissors: "Scissors" };
const RESULT_TEXT = { win: "You win! 🎉", loss: "You lose 🤖", tie: "Tie 🤝" };
const OUTCOME_LABEL = { win: "Win", loss: "Loss", tie: "Tie" };

const prefersReduced =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const dom = {
  youEmoji: document.getElementById("you-emoji"),
  aiEmoji: document.getElementById("ai-emoji"),
  result: document.getElementById("result"),
  prediction: document.getElementById("prediction"),
  moves: document.querySelector(".moves"),
  moveBtns: Array.from(document.querySelectorAll(".move-btn")),
  winCount: document.getElementById("win-count"),
  tieCount: document.getElementById("tie-count"),
  lossCount: document.getElementById("loss-count"),
  winPct: document.getElementById("win-pct"),
  tiePct: document.getElementById("tie-pct"),
  lossPct: document.getElementById("loss-pct"),
  barWin: document.getElementById("bar-win"),
  barTie: document.getElementById("bar-tie"),
  barLoss: document.getElementById("bar-loss"),
  winrate: document.getElementById("winrate"),
  streak: document.getElementById("streak"),
  total: document.getElementById("total"),
  history: document.getElementById("history"),
  emptyHint: document.getElementById("empty-hint"),
  reset: document.getElementById("reset"),
};

let state = loadState();
let model = rebuildModel(state.rounds);
let busy = false;

// ---- Round flow ----------------------------------------------------------

function playerPicks(move) {
  if (busy || !MOVES.includes(move)) return;
  busy = true;

  // The AI commits using history ONLY -- decide() never sees `move`.
  const decision = decide(model);
  const outcome = judge(move, decision.aiMove);

  state = applyRound(state, move, decision.aiMove, decision.predictedPlayerMove);
  learn(model, move, decision.aiMove);
  saveState(state);

  reveal(move, decision, outcome).then(() => {
    busy = false;
  });
}

function reveal(playerMove, decision, outcome) {
  return new Promise((resolve) => {
    setMovesLocked(true);
    dom.youEmoji.textContent = EMOJI[playerMove];
    dom.result.className = "result";
    dom.result.textContent = "";
    dom.prediction.textContent = "";

    const finish = () => {
      dom.aiEmoji.textContent = EMOJI[decision.aiMove];
      dom.aiEmoji.classList.remove("thinking");
      showOutcome(decision, outcome);
      renderStats();
      renderHistory();
      setMovesLocked(false);
      resolve();
    };

    if (prefersReduced) {
      finish();
      return;
    }

    dom.aiEmoji.classList.add("thinking");
    let tick = 0;
    const shuffle = setInterval(() => {
      dom.aiEmoji.textContent = EMOJI[MOVES[tick % MOVES.length]];
      tick++;
    }, 90);
    setTimeout(() => {
      clearInterval(shuffle);
      finish();
    }, REVEAL_MS);
  });
}

function showOutcome(decision, outcome) {
  dom.result.textContent = RESULT_TEXT[outcome];
  dom.result.className = "result result--" + outcome;
  if (decision.confident && decision.predictedPlayerMove) {
    dom.prediction.textContent = `🧠 I predicted you'd throw ${LABEL[decision.predictedPlayerMove]}.`;
  } else {
    dom.prediction.textContent = "🎲 Still reading you — I played at random.";
  }
}

// ---- Rendering -----------------------------------------------------------

function pct(x) {
  return Math.round(x * 100) + "%";
}

function renderStats() {
  const t = state.totals;
  const p = percentages(t);
  dom.winCount.textContent = t.win;
  dom.tieCount.textContent = t.tie;
  dom.lossCount.textContent = t.loss;
  dom.winPct.textContent = pct(p.win);
  dom.tiePct.textContent = pct(p.tie);
  dom.lossPct.textContent = pct(p.loss);
  dom.barWin.style.width = p.win * 100 + "%";
  dom.barTie.style.width = p.tie * 100 + "%";
  dom.barLoss.style.width = p.loss * 100 + "%";
  dom.winrate.textContent = p.total ? `Win rate ${pct(p.win)}` : "Win rate —";
  dom.streak.textContent = `Streak ${currentStreak(state)} · Best ${state.bestStreak}`;
  dom.total.textContent = `${p.total} ${p.total === 1 ? "round" : "rounds"}`;
}

function renderHistory() {
  const rounds = state.rounds.slice(-HISTORY_SHOWN).reverse();
  dom.emptyHint.hidden = rounds.length > 0;
  dom.history.textContent = "";
  for (const r of rounds) {
    dom.history.appendChild(historyRow(r));
  }
}

function historyRow(r) {
  const li = document.createElement("li");
  li.className = "round round--" + r.o;

  const pair = document.createElement("span");
  pair.className = "round-pair";
  pair.append(emojiSpan(r.p), vsSpan(), emojiSpan(r.a));

  const out = document.createElement("span");
  out.className = "round-outcome";
  out.textContent = OUTCOME_LABEL[r.o];

  li.append(pair, out);
  return li;
}

function emojiSpan(move) {
  const s = document.createElement("span");
  s.className = "round-emoji";
  s.textContent = EMOJI[move];
  return s;
}

function vsSpan() {
  const s = document.createElement("span");
  s.className = "round-vs";
  s.textContent = "vs";
  return s;
}

function setMovesLocked(locked) {
  dom.moves.classList.toggle("locked", locked);
  for (const btn of dom.moveBtns) btn.disabled = locked;
}

function resetAll() {
  if (!window.confirm("Reset all stats and wipe the AI's memory on this device?")) return;
  clearState();
  state = emptyState();
  model = createModel();
  dom.youEmoji.textContent = "🙂";
  dom.aiEmoji.textContent = "🤖";
  dom.result.className = "result";
  dom.result.textContent = "Make your move.";
  dom.prediction.textContent = "";
  renderStats();
  renderHistory();
}

// ---- Init ----------------------------------------------------------------

function init() {
  renderStats();
  renderHistory();

  for (const btn of dom.moveBtns) {
    btn.addEventListener("click", () => {
      playerPicks(btn.dataset.move);
      btn.blur(); // drop focus so no ring lingers after the round (esp. on touch)
    });
  }
  dom.reset.addEventListener("click", resetAll);

  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const shortcuts = { r: "rock", p: "paper", s: "scissors", 1: "rock", 2: "paper", 3: "scissors" };
    const move = shortcuts[e.key.toLowerCase()];
    if (move) playerPicks(move);
  });
}

init();
