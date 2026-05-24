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

const dom = {
  setupScreen: document.getElementById("setup-screen"),
  gameScreen: document.getElementById("game-screen"),
  errorScreen: document.getElementById("error-screen"),
  errorDetail: document.getElementById("error-detail"),

  seedInput: document.getElementById("seed-input"),
  seedRandom: document.getElementById("seed-random"),
  teamASize: document.getElementById("team-a-size"),
  teamBSize: document.getElementById("team-b-size"),
  myTeamRadios: document.querySelectorAll("input[name='my-team']"),
  myPlayerIndex: document.getElementById("my-player-index"),
  initialTurn: document.getElementById("initial-turn"),
  setupError: document.getElementById("setup-error"),
  startBtn: document.getElementById("start-btn"),
  copySetupLink: document.getElementById("copy-setup-link"),
  copyStatus: document.getElementById("copy-status"),

  turnNumber: document.getElementById("turn-number"),
  prevTurnBtn: document.getElementById("prev-turn-btn"),
  nextTurnBtn: document.getElementById("next-turn-btn"),
  jumpTurn: document.getElementById("jump-turn"),
  jumpBtn: document.getElementById("jump-btn"),
  editSetupBtn: document.getElementById("edit-setup-btn"),

  meTag: document.getElementById("me-tag"),
  guessingTeamPill: document.getElementById("guessing-team-pill"),
  judgeTeamPill: document.getElementById("judge-team-pill"),
  activePlayerPill: document.getElementById("active-player-pill"),
  roleBanner: document.getElementById("role-banner"),
  card: document.getElementById("card"),
  datasetInfo: document.getElementById("dataset-info"),
};

let dataset = null;
let session = null;

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
  return { seed, teamA, teamB, myTeam, myPlayerIndex, turn };
}

function setSetupForm({ seed, teamA, teamB, myTeam, myPlayerIndex, turn }) {
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

  setSetupForm({ seed, teamA, teamB, myTeam, myPlayerIndex, turn });

  // Warn if dataset version embedded in URL doesn't match
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

// ---- Game rendering ----

function renderTurn() {
  if (!session || !dataset) return;

  const state = deriveTurnState({
    seed: session.seed,
    turn: session.turn,
    teamSizes: session.teamSizes,
    myTeam: session.myTeam,
    myPlayerIndex: session.myPlayerIndex,
    deck: dataset.cards,
  });

  dom.turnNumber.textContent = String(session.turn);
  dom.jumpTurn.value = String(session.turn);

  dom.meTag.textContent = `${session.myTeam}-${session.myPlayerIndex}`;
  dom.meTag.className = `me-tag team-${session.myTeam}`;
  dom.guessingTeamPill.textContent = `Equipo ${state.guessingTeam} adivina`;
  dom.judgeTeamPill.textContent = `Equipo ${state.judgeTeam} juzga`;
  dom.activePlayerPill.textContent = `Jugador activo: ${state.guessingTeam} · #${state.activePlayerIndex}`;

  // Role banner
  dom.roleBanner.className = "role-banner";
  if (state.role === ROLES.ACTIVE_PLAYER) {
    dom.roleBanner.classList.add("role-active");
    dom.roleBanner.textContent = "TU TURNO · Describe la palabra sin usar las prohibidas";
  } else if (state.role === ROLES.JUDGE) {
    dom.roleBanner.classList.add("role-judge");
    dom.roleBanner.textContent = "ERES JUEZ · Vigila las palabras prohibidas y valida el acierto";
  } else {
    dom.roleBanner.classList.add("role-teammate");
    dom.roleBanner.textContent = "Tu equipo adivina · NO MIRES la pantalla, escucha y di la palabra en voz alta";
  }

  // Card
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
      <p class="blind-sub">Escucha a tu compañero y grita la palabra que crees que es.</p>
    `;
  }

  dom.datasetInfo.textContent = `Carta ${state.cardIndex + 1} de ${dataset.cards.length} · dataset v${dataset.version}`;
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

// ---- Turn navigation ----

function changeTurn(delta) {
  if (!session) return;
  const next = session.turn + delta;
  if (next < 1) return;
  session.turn = next;
  syncUrl();
  renderTurn();
}

function jumpToTurn(value) {
  if (!session) return;
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return;
  session.turn = parsed;
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
    };

    savePersonal({
      seed: form.seed,
      teamA: form.teamA,
      teamB: form.teamB,
      myTeam: form.myTeam,
      myPlayerIndex: form.myPlayerIndex,
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

  // Re-validate player index range when team or sizes change
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
  dom.nextTurnBtn.addEventListener("click", () => changeTurn(1));
  dom.prevTurnBtn.addEventListener("click", () => changeTurn(-1));
  dom.jumpBtn.addEventListener("click", () => jumpToTurn(dom.jumpTurn.value));
  dom.jumpTurn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") jumpToTurn(dom.jumpTurn.value);
  });
  dom.editSetupBtn.addEventListener("click", () => {
    // Preserve current session values back into the form
    if (session) {
      setSetupForm({
        seed: session.seed,
        teamA: session.teamSizes.A,
        teamB: session.teamSizes.B,
        myTeam: session.myTeam,
        myPlayerIndex: session.myPlayerIndex,
        turn: session.turn,
      });
    }
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

  // Auto-start game if URL has all the shared fields and personal info is set.
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
    };
    showGame();
    renderTurn();
  } else {
    showSetup();
  }
}

init();
