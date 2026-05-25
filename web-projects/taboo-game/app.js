// DOM glue. Imports the pure logic from game.js.

import {
  deriveTurnState,
  parseUrlState,
  serializeUrlState,
  generateRandomSeed,
  ROLES,
} from "./game.js";

const STORAGE_KEY = "taboo-game:personal:v1";
const DATASET_URL = "./cards.json";
const DEFAULT_TIMER_DURATION = 30;

const dom = {
  setupScreen: document.getElementById("setup-screen"),
  gameScreen: document.getElementById("game-screen"),
  errorScreen: document.getElementById("error-screen"),
  errorDetail: document.getElementById("error-detail"),

  // Setup form
  seedInput: document.getElementById("seed-input"),
  seedRandom: document.getElementById("seed-random"),
  teamASize: document.getElementById("team-a-size"),
  teamBSize: document.getElementById("team-b-size"),
  myTeamRadios: document.querySelectorAll("input[name='my-team']"),
  myPlayerIndex: document.getElementById("my-player-index"),
  initialTurn: document.getElementById("initial-turn"),
  timerDurationInput: document.getElementById("timer-duration"),
  setupError: document.getElementById("setup-error"),
  startBtn: document.getElementById("start-btn"),
  copySetupLink: document.getElementById("copy-setup-link"),
  copyStatus: document.getElementById("copy-status"),

  // Game screen
  meTag: document.getElementById("me-tag"),
  guessingTeamPill: document.getElementById("guessing-team-pill"),
  judgeTeamPill: document.getElementById("judge-team-pill"),
  activePlayerPill: document.getElementById("active-player-pill"),
  roleBanner: document.getElementById("role-banner"),

  turnNumber: document.getElementById("turn-number"),
  prevTurnBtn: document.getElementById("prev-turn-btn"),
  nextTurnBtn: document.getElementById("next-turn-btn"),
  jumpTurn: document.getElementById("jump-turn"),
  jumpTurnBtn: document.getElementById("jump-turn-btn"),

  startPanel: document.getElementById("start-panel"),
  timerStartBtn: document.getElementById("timer-start-btn"),
  timerDurationDisplay: document.getElementById("timer-duration-display"),

  cardArea: document.getElementById("card-area"),
  wordNumber: document.getElementById("word-number"),
  prevWordBtn: document.getElementById("prev-word-btn"),
  nextWordBtn: document.getElementById("next-word-btn"),
  jumpWord: document.getElementById("jump-word"),
  jumpWordBtn: document.getElementById("jump-word-btn"),

  timerBar: document.getElementById("timer-bar"),
  timerFill: document.getElementById("timer-fill"),
  timerText: document.getElementById("timer-text"),

  hitCounter: document.getElementById("hit-counter"),
  hitPlusBtn: document.getElementById("hit-plus-btn"),
  hitMinusBtn: document.getElementById("hit-minus-btn"),
  hitCount: document.getElementById("hit-count"),

  card: document.getElementById("card"),
  editSetupBtn: document.getElementById("edit-setup-btn"),
  datasetInfo: document.getElementById("dataset-info"),
};

let dataset = null;
let session = null;

// Timer state lives only in memory. It is NOT deterministic and not shared --
// it just tracks when the local active player pressed Start for the current turn.
const timer = {
  startedAt: null, // ms timestamp, or null
  forTurn: null,   // the turn number this timer was started for
};
let tickInterval = null;
let audioContext = null;

// Local hit-tally for the judge / guessing teammate. Helps them count correct
// guesses without mental arithmetic. Resets on turn change. Never synced.
let hitCount = 0;

// ---- Personal state persistence ----

function loadPersonal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function savePersonal(partial) {
  const existing = loadPersonal();
  const next = { ...existing, ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

// ---- Setup form ----

function readSetupForm() {
  const seed = dom.seedInput.value.trim();
  const teamA = parseInt(dom.teamASize.value, 10);
  const teamB = parseInt(dom.teamBSize.value, 10);
  const myTeam = [...dom.myTeamRadios].find((r) => r.checked)?.value || null;
  const myPlayerIndex = parseInt(dom.myPlayerIndex.value, 10);
  const turn = parseInt(dom.initialTurn.value, 10);
  const timerDuration = parseInt(dom.timerDurationInput.value, 10);
  return { seed, teamA, teamB, myTeam, myPlayerIndex, turn, timerDuration };
}

function setSetupForm({ seed, teamA, teamB, myTeam, myPlayerIndex, turn, timerDuration }) {
  if (seed != null) dom.seedInput.value = seed;
  if (teamA != null) dom.teamASize.value = String(teamA);
  if (teamB != null) dom.teamBSize.value = String(teamB);
  if (myTeam) {
    for (const radio of dom.myTeamRadios) {
      radio.checked = radio.value === myTeam;
    }
  }
  if (myPlayerIndex != null) dom.myPlayerIndex.value = String(myPlayerIndex);
  if (turn != null) dom.initialTurn.value = String(turn);
  if (timerDuration != null) dom.timerDurationInput.value = String(timerDuration);
}

function validateSetup(form) {
  if (!form.seed) return "Introduce un seed (cualquier texto sirve).";
  if (!Number.isInteger(form.teamA) || form.teamA < 1) return "El equipo A debe tener al menos 1 jugador.";
  if (!Number.isInteger(form.teamB) || form.teamB < 1) return "El equipo B debe tener al menos 1 jugador.";
  if (form.myTeam !== "A" && form.myTeam !== "B") return "Selecciona a qué equipo perteneces.";
  const maxIdx = form.myTeam === "A" ? form.teamA : form.teamB;
  if (!Number.isInteger(form.myPlayerIndex) || form.myPlayerIndex < 1 || form.myPlayerIndex > maxIdx) {
    return `Tu número de jugador debe estar entre 1 y ${maxIdx} (tamaño del equipo ${form.myTeam}).`;
  }
  if (!Number.isInteger(form.turn) || form.turn < 1) return "El turno inicial debe ser un entero positivo.";
  if (!Number.isInteger(form.timerDuration) || form.timerDuration < 5 || form.timerDuration > 600) {
    return "La duración del timer debe estar entre 5 y 600 segundos.";
  }
  return null;
}

// ---- URL state ----

function syncUrl() {
  if (!session) return;
  const qs = serializeUrlState({
    seed: session.seed,
    teamA: session.teamSizes.A,
    teamB: session.teamSizes.B,
    turn: session.turn,
    wordIndex: session.wordIndex,
    timerDuration: session.timerDuration,
    version: dataset?.version,
  });
  const newUrl = qs ? `${location.pathname}?${qs}` : location.pathname;
  history.replaceState(null, "", newUrl);
}

function setupFromUrlAndStorage() {
  const url = parseUrlState(location.search);
  const personal = loadPersonal();

  const seed = url.seed || personal.seed || "";
  const teamA = url.teamA || personal.teamA || 3;
  const teamB = url.teamB || personal.teamB || 3;
  const myTeam = personal.myTeam || "";
  const myPlayerIndex = personal.myPlayerIndex || 1;
  const turn = url.turn || 1;
  const timerDuration = url.timerDuration || personal.timerDuration || DEFAULT_TIMER_DURATION;

  setSetupForm({ seed, teamA, teamB, myTeam, myPlayerIndex, turn, timerDuration });

  if (url.version && dataset && url.version !== dataset.version) {
    dom.setupError.textContent = `Atención: el enlace usa la versión de cartas ${url.version} pero tienes la ${dataset.version}. Los resultados pueden diferir.`;
  }
}

// ---- Dataset loading ----

async function loadDataset() {
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`No se pudo cargar ${DATASET_URL} (HTTP ${res.status})`);
  const json = await res.json();
  if (!json || !Array.isArray(json.cards) || json.cards.length === 0) {
    throw new Error("El dataset de cartas está vacío o malformado.");
  }
  return json;
}

// ---- Timer helpers ----

function timerStartedForCurrentTurn() {
  return session != null && timer.startedAt != null && timer.forTurn === session.turn;
}

function timerRemainingMs() {
  if (!timerStartedForCurrentTurn()) return null;
  const elapsed = Date.now() - timer.startedAt;
  return Math.max(0, session.timerDuration * 1000 - elapsed);
}

function timerExpired() {
  return timerStartedForCurrentTurn() && timerRemainingMs() === 0;
}

function resetTimer() {
  timer.startedAt = null;
  timer.forTurn = null;
  stopTicker();
}

function startTimer() {
  ensureAudio(); // unlock the audio context while we're still in a user gesture
  timer.startedAt = Date.now();
  timer.forTurn = session.turn;
  startTicker();
}

function startTicker() {
  stopTicker();
  tickInterval = setInterval(() => {
    renderTurn();
    if (timerExpired()) {
      stopTicker();
      playTimerEndSound();
    }
  }, 200);
}

function stopTicker() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

// ---- Audio ----

function ensureAudio() {
  if (!audioContext) {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function playTimerEndSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  // Descending three-tone beep: bright enough to be heard on a phone speaker.
  const notes = [880, 660, 440];
  const now = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    osc.connect(gain).connect(ctx.destination);
    const start = now + i * 0.18;
    const stop = start + 0.16;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
    gain.gain.setValueAtTime(0.15, stop - 0.04);
    gain.gain.linearRampToValueAtTime(0, stop);
    osc.start(start);
    osc.stop(stop);
  });
}

// ---- Game rendering ----

function renderTurn() {
  if (!session || !dataset) return;

  const state = deriveTurnState({
    seed: session.seed,
    turn: session.turn,
    wordIndex: session.wordIndex,
    teamSizes: session.teamSizes,
    myTeam: session.myTeam,
    myPlayerIndex: session.myPlayerIndex,
    deck: dataset.cards,
  });

  dom.turnNumber.textContent = String(session.turn);
  dom.jumpTurn.value = String(session.turn);
  dom.wordNumber.textContent = String(session.wordIndex);
  dom.jumpWord.value = String(session.wordIndex);

  dom.meTag.textContent = `${session.myTeam}-${session.myPlayerIndex}`;
  dom.meTag.className = `me-tag team-${session.myTeam}`;
  dom.guessingTeamPill.textContent = `Equipo ${state.guessingTeam} adivina`;
  dom.judgeTeamPill.textContent = `Equipo ${state.judgeTeam} juzga`;
  dom.activePlayerPill.textContent = `Jugador activo: ${state.guessingTeam} · #${state.activePlayerIndex}`;

  // Role banner
  dom.roleBanner.className = "role-banner";
  if (state.role === ROLES.ACTIVE_PLAYER) {
    dom.roleBanner.classList.add("role-active");
    dom.roleBanner.textContent = "TU TURNO · Describe sin usar las prohibidas";
  } else if (state.role === ROLES.JUDGE) {
    dom.roleBanner.classList.add("role-judge");
    dom.roleBanner.textContent = "ERES JUEZ · Vigila las prohibidas y los aciertos";
  } else {
    dom.roleBanner.classList.add("role-teammate");
    dom.roleBanner.textContent = "Tu equipo adivina · NO MIRES la pantalla";
  }

  const isActive = state.role === ROLES.ACTIVE_PLAYER;
  const showStartPanel = isActive && !timerStartedForCurrentTurn();

  if (showStartPanel) {
    dom.startPanel.hidden = false;
    dom.cardArea.hidden = true;
    dom.timerDurationDisplay.textContent = String(session.timerDuration);
    return;
  }

  dom.startPanel.hidden = true;
  dom.cardArea.hidden = false;

  // Card content depends on role + visibility
  dom.card.className = "card";
  if (state.visibility.word || state.visibility.forbidden) {
    const wordHtml = state.visibility.word
      ? `<div class="target-label">Palabra a adivinar</div>
         <div class="target-word">${escapeHtml(state.card.word)}</div>`
      : "";
    const dividerHtml = state.visibility.word && state.visibility.forbidden ? "<hr>" : "";
    const forbiddenHtml = state.visibility.forbidden
      ? `<div class="forbidden-label">Prohibidas</div>
         <ul class="forbidden-list">${state.card.forbidden
           .map((w) => `<li>${escapeHtml(w)}</li>`)
           .join("")}</ul>`
      : "";
    dom.card.innerHTML = wordHtml + dividerHtml + forbiddenHtml;
  } else {
    dom.card.classList.add("hidden-card");
    dom.card.innerHTML = `
      <div class="blind-icon" aria-hidden="true">🙈</div>
      <p class="blind-msg">No mires</p>
      <p class="blind-sub">Escucha a tu compañero y di la palabra en voz alta.</p>
    `;
  }

  // Local hit counter: visible to judge and guessing teammate only.
  const showHitCounter = state.role === ROLES.JUDGE || state.role === ROLES.GUESSING_TEAMMATE;
  dom.hitCounter.hidden = !showHitCounter;
  dom.hitCount.textContent = String(hitCount);

  // Timer + freeze behaviour: only for active player after Start
  if (isActive) {
    dom.timerBar.hidden = false;
    const remaining = timerRemainingMs() ?? 0;
    const totalMs = session.timerDuration * 1000;
    const pct = Math.max(0, Math.min(100, (remaining / totalMs) * 100));
    dom.timerFill.style.width = `${pct}%`;
    const expired = timerExpired();
    if (expired) {
      dom.timerBar.classList.add("expired");
      dom.timerText.textContent = "¡TIEMPO!";
      dom.card.classList.add("expired");
      setWordNavDisabled(true);
    } else {
      dom.timerBar.classList.remove("expired");
      const secs = Math.ceil(remaining / 1000);
      dom.timerText.textContent = `${secs}s`;
      setWordNavDisabled(false);
    }
  } else {
    dom.timerBar.hidden = true;
    setWordNavDisabled(false);
  }

  dom.datasetInfo.textContent = `Carta ${state.cardIndex + 1} de ${dataset.cards.length} · dataset v${dataset.version}`;
}

function setWordNavDisabled(disabled) {
  dom.nextWordBtn.disabled = disabled;
  dom.prevWordBtn.disabled = disabled;
  dom.jumpWordBtn.disabled = disabled;
  dom.jumpWord.disabled = disabled;
  dom.nextWordBtn.classList.toggle("disabled-frozen", disabled);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Navigation between screens ----

function showSetup() {
  dom.setupScreen.hidden = false;
  dom.gameScreen.hidden = true;
  dom.errorScreen.hidden = true;
  stopTicker();
}

function showGame() {
  dom.setupScreen.hidden = true;
  dom.gameScreen.hidden = false;
  dom.errorScreen.hidden = true;
}

function showError(msg) {
  dom.setupScreen.hidden = true;
  dom.gameScreen.hidden = true;
  dom.errorScreen.hidden = false;
  dom.errorDetail.textContent = msg;
}

// ---- Turn / word navigation ----

function changeTurn(delta) {
  if (!session) return;
  const next = session.turn + delta;
  if (next < 1) return;
  session.turn = next;
  session.wordIndex = 1;
  hitCount = 0;
  resetTimer();
  syncUrl();
  renderTurn();
}

function jumpToTurn(value) {
  if (!session) return;
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return;
  session.turn = parsed;
  session.wordIndex = 1;
  hitCount = 0;
  resetTimer();
  syncUrl();
  renderTurn();
}

function isWordNavLocked() {
  // Only the active player gets locked, and only after their timer expired.
  return timerExpired();
}

function changeWord(delta) {
  if (!session) return;
  if (isWordNavLocked()) return;
  const next = session.wordIndex + delta;
  if (next < 1) return;
  session.wordIndex = next;
  syncUrl();
  renderTurn();
}

function jumpToWord(value) {
  if (!session) return;
  if (isWordNavLocked()) return;
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return;
  session.wordIndex = parsed;
  syncUrl();
  renderTurn();
}

// ---- Event wiring ----

function wireSetup() {
  dom.seedRandom.addEventListener("click", () => {
    dom.seedInput.value = generateRandomSeed();
  });

  dom.startBtn.addEventListener("click", () => {
    const form = readSetupForm();
    const error = validateSetup(form);
    if (error) {
      dom.setupError.textContent = error;
      return;
    }
    dom.setupError.textContent = "";

    session = {
      seed: form.seed,
      teamSizes: { A: form.teamA, B: form.teamB },
      myTeam: form.myTeam,
      myPlayerIndex: form.myPlayerIndex,
      turn: form.turn,
      wordIndex: 1,
      timerDuration: form.timerDuration,
    };
    resetTimer();

    savePersonal({
      seed: form.seed,
      teamA: form.teamA,
      teamB: form.teamB,
      myTeam: form.myTeam,
      myPlayerIndex: form.myPlayerIndex,
      timerDuration: form.timerDuration,
    });

    syncUrl();
    showGame();
    renderTurn();
  });

  dom.copySetupLink.addEventListener("click", async () => {
    const form = readSetupForm();
    const qs = serializeUrlState({
      seed: form.seed,
      teamA: form.teamA,
      teamB: form.teamB,
      turn: form.turn,
      timerDuration: form.timerDuration,
      version: dataset?.version,
    });
    const url = `${location.origin}${location.pathname}${qs ? "?" + qs : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      flash(dom.copyStatus, "Enlace copiado");
    } catch {
      flash(dom.copyStatus, "No se pudo copiar; cópialo de la barra de direcciones.");
    }
  });

  const reValidate = () => {
    const form = readSetupForm();
    const maxIdx = form.myTeam === "A" ? form.teamA : form.myTeam === "B" ? form.teamB : null;
    if (maxIdx && form.myPlayerIndex > maxIdx) {
      dom.myPlayerIndex.value = String(maxIdx);
    }
    if (maxIdx) dom.myPlayerIndex.max = String(maxIdx);
  };
  dom.teamASize.addEventListener("input", reValidate);
  dom.teamBSize.addEventListener("input", reValidate);
  for (const r of dom.myTeamRadios) r.addEventListener("change", reValidate);
}

function wireGame() {
  dom.timerStartBtn.addEventListener("click", () => {
    startTimer();
    renderTurn();
  });

  dom.nextTurnBtn.addEventListener("click", () => changeTurn(1));
  dom.prevTurnBtn.addEventListener("click", () => changeTurn(-1));
  dom.jumpTurnBtn.addEventListener("click", () => jumpToTurn(dom.jumpTurn.value));
  dom.jumpTurn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") jumpToTurn(dom.jumpTurn.value);
  });

  dom.nextWordBtn.addEventListener("click", () => changeWord(1));
  dom.prevWordBtn.addEventListener("click", () => changeWord(-1));

  dom.hitPlusBtn.addEventListener("click", () => {
    hitCount += 1;
    renderTurn();
  });
  dom.hitMinusBtn.addEventListener("click", () => {
    if (hitCount > 0) hitCount -= 1;
    renderTurn();
  });
  dom.jumpWordBtn.addEventListener("click", () => jumpToWord(dom.jumpWord.value));
  dom.jumpWord.addEventListener("keydown", (e) => {
    if (e.key === "Enter") jumpToWord(dom.jumpWord.value);
  });

  dom.editSetupBtn.addEventListener("click", () => {
    if (session) {
      setSetupForm({
        seed: session.seed,
        teamA: session.teamSizes.A,
        teamB: session.teamSizes.B,
        myTeam: session.myTeam,
        myPlayerIndex: session.myPlayerIndex,
        turn: session.turn,
        timerDuration: session.timerDuration,
      });
    }
    resetTimer();
    showSetup();
  });
}

function flash(el, msg) {
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => {
    if (el.textContent === msg) el.textContent = "";
  }, 2000);
}

// ---- Boot ----

async function init() {
  wireSetup();
  wireGame();

  try {
    dataset = await loadDataset();
  } catch (e) {
    showError(e.message || String(e));
    return;
  }

  setupFromUrlAndStorage();

  const url = parseUrlState(location.search);
  const personal = loadPersonal();
  if (
    url.seed &&
    url.teamA &&
    url.teamB &&
    url.turn &&
    personal.myTeam &&
    Number.isInteger(personal.myPlayerIndex) &&
    personal.myPlayerIndex >= 1 &&
    personal.myPlayerIndex <= (personal.myTeam === "A" ? url.teamA : url.teamB)
  ) {
    session = {
      seed: url.seed,
      teamSizes: { A: url.teamA, B: url.teamB },
      myTeam: personal.myTeam,
      myPlayerIndex: personal.myPlayerIndex,
      turn: url.turn,
      wordIndex: url.wordIndex || 1,
      timerDuration: url.timerDuration || personal.timerDuration || DEFAULT_TIMER_DURATION,
    };
    resetTimer();
    showGame();
    renderTurn();
  } else {
    showSetup();
  }
}

init();
