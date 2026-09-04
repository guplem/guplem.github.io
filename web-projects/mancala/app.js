// The screen: it listens to clicks, calls the modules and builds elements.
// It holds no rules of its own. Every decision about the game comes from
// kalah.js, baawa.js or match.js, every opponent from agents.js, and every
// number on the board from playback.js.
//
// It decides the pace of an animation and hands it to render.js, which does the
// waiting. The engines and the playback are pure and have no idea that an
// animation exists at all.

import { SOUTH, NORTH, other } from "./board.js";
import { MODES, MODE_IDS, modeById, rulesFor, newGame } from "./modes.js";
import { AGENTS, HUMAN, DEFAULT_AGENT, agentById, chooseMove, isAgent } from "./agents.js";
import { createMatch, recordRound } from "./match.js";
import { snapshot, paceFor } from "./playback.js";
import { captionFor, summarise, previewText } from "./captions.js";
import { buildBoard, paintBoard, animateMove, flashBadge, pulse } from "./render.js";
import { parseSetup, serializeSetup, DEFAULT_SETUP, isSeat } from "./urlState.js";
import {
  loadSetup,
  saveSetup,
  loadRecord,
  saveRecord,
  addResult,
  recordFor,
  loadSpeed,
  saveSpeed,
  nextSpeed,
} from "./store.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { say, escapeHtml } from "./deployText.js";

/** The colour each seat is called. Seat 0 is the row along the bottom. */
const SEAT_NAMES = ["Blue", "Red"];

/** Somewhere to keep localStorage, or nothing when the browser refuses it. */
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

/** Does this visitor want as little movement as possible? */
const reducedMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

const el = (id) => document.getElementById(id);

const dom = {
  screens: { setup: el("setup"), game: el("game") },
  modeGrid: el("mode-grid"),
  roundsRow: el("rounds-row"),
  roundsToggle: el("rounds-toggle"),
  seats: { 0: el("seat-blue"), 1: el("seat-red") },
  start: el("start"),
  record: el("record"),
  share: el("share"),
  board: el("board"),
  flyLayer: el("fly-layer"),
  chips: { 0: el("chip-blue"), 1: el("chip-red") },
  chipScores: { 0: el("chip-blue-score"), 1: el("chip-red-score") },
  chipWho: { 0: el("chip-blue-who"), 1: el("chip-red-who") },
  status: el("status"),
  roundStrip: el("round-strip"),
  speed: el("speed"),
  rules: el("rules"),
  rulesTitle: el("rules-title"),
  rulesBoard: el("rules-board"),
  rulesText: el("rules-text"),
  rulesStep: el("rules-step"),
  rulesDots: el("rules-dots"),
  rulesTabs: el("rules-tabs"),
  result: el("result"),
  resultTitle: el("result-title"),
  resultLine: el("result-line"),
  resultDetail: el("result-detail"),
  resultMain: el("result-main"),
  resultSecond: el("result-second"),
};

/** How long a press must last before it counts as a look, not a move. */
const HOLD_MS = 240;

/** How long a mouse must rest on a pit before it shows the same look. */
const DWELL_MS = 380;

const ui = {
  setup: { ...DEFAULT_SETUP },
  match: null,
  game: null,
  shown: null,
  board: null,
  busy: false,
  cancelled: false,
  speed: 1,
  // The pit a player is looking at, and where its last seed would land:
  // `{from, to, store}`, or null when nobody is looking.
  peek: null,
  // Did a press open the look? If it did, the release must not play the move.
  peekHeld: false,
  record: {},
  rulesMode: DEFAULT_SETUP.mode,
  rulesCard: 0,
  runId: 0,
  // The opponent each seat goes back to when it switches from a person to a
  // program, so the choice is not lost by tapping "A person" and back.
  lastAgent: { 0: DEFAULT_AGENT, 1: DEFAULT_AGENT },
};

// --- setup screen ------------------------------------------------------------

/**
 * Read the setup out of the address bar, or out of what the player used last
 * time when the address bar says nothing.
 * @returns {Object} a setup
 */
function initialSetup() {
  const fromUrl = parseSetup(window.location.search);
  const untouched = window.location.search.length <= 1;
  if (!untouched) return fromUrl;
  const remembered = loadSetup(
    storage,
    (setup) => MODE_IDS.includes(setup.mode) && isSeat(setup.blue) && isSeat(setup.red)
  );
  return remembered ? { ...DEFAULT_SETUP, ...remembered } : fromUrl;
}

/** Build the two rule-set cards. */
function buildModeChoices() {
  dom.modeGrid.textContent = "";
  for (const id of MODE_IDS) {
    const mode = MODES[id];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "mode-card";
    card.dataset.mode = id;
    card.innerHTML = `
      <span class="mode-card__name"></span>
      <span class="mode-card__tag"></span>
      <span class="mode-card__origin"></span>`;
    card.querySelector(".mode-card__name").textContent = mode.name;
    card.querySelector(".mode-card__tag").textContent = mode.tagline;
    card.querySelector(".mode-card__origin").textContent = mode.origin;
    card.addEventListener("click", () => {
      ui.setup.mode = id;
      ui.rulesMode = id;
      paintSetup();
    });
    dom.modeGrid.append(card);
  }
}

/**
 * Build the controls for one seat: a person or a program, and if a program,
 * which of the six. They are laid out as two rows rather than one long list,
 * because a list of seven options twice over fills a phone screen on its own.
 * @param {number} seat SOUTH or NORTH
 */
function buildSeat(seat) {
  const holder = dom.seats[seat];
  const kinds = holder.querySelector(".seat__kind");
  const levels = holder.querySelector(".seat__levels");
  kinds.textContent = "";
  levels.textContent = "";

  for (const [kind, label] of [
    [HUMAN, "A person"],
    ["computer", "A program"],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "seg";
    button.dataset.kind = kind;
    button.textContent = label;
    button.addEventListener("click", () => {
      setSeat(seat, kind === HUMAN ? HUMAN : ui.lastAgent[seat]);
    });
    kinds.append(button);
  }

  // The tier number is on the chip, so the order of difficulty is visible
  // without reading six descriptions.
  for (const agent of AGENTS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level";
    button.dataset.value = agent.id;
    button.innerHTML = `<span class="level__tier"></span><span class="level__name"></span>`;
    button.querySelector(".level__tier").textContent = String(agent.tier);
    button.querySelector(".level__name").textContent = agent.name;
    button.title = `${agent.level}: ${agent.blurb}`;
    button.addEventListener("click", () => {
      ui.lastAgent[seat] = agent.id;
      setSeat(seat, agent.id);
    });
    levels.append(button);
  }
}

/**
 * Put a person or a program in a seat.
 * @param {number} seat SOUTH or NORTH
 * @param {string} value HUMAN or an opponent id
 */
function setSeat(seat, value) {
  ui.setup[seat === SOUTH ? "blue" : "red"] = value;
  paintSetup();
}

/** Draw the setup screen from `ui.setup`. */
function paintSetup() {
  for (const card of dom.modeGrid.children) {
    card.classList.toggle("mode-card--on", card.dataset.mode === ui.setup.mode);
    card.setAttribute("aria-pressed", String(card.dataset.mode === ui.setup.mode));
  }

  for (const seat of [SOUTH, NORTH]) {
    const chosen = seatValue(seat);
    const holder = dom.seats[seat];
    const human = chosen === HUMAN;

    for (const button of holder.querySelector(".seat__kind").children) {
      const on = (button.dataset.kind === HUMAN) === human;
      button.classList.toggle("seg--on", on);
      button.setAttribute("aria-pressed", String(on));
    }

    const levels = holder.querySelector(".seat__levels");
    levels.hidden = human;
    for (const button of levels.children) {
      const on = button.dataset.value === chosen;
      button.classList.toggle("level--on", on);
      button.setAttribute("aria-pressed", String(on));
    }

    holder.querySelector(".seat__blurb").textContent = human
      ? "A person playing on this device."
      : `${agentById(chosen).level}. ${agentById(chosen).blurb}`;
  }

  const mode = modeById(ui.setup.mode);
  dom.roundsRow.hidden = !mode.conquest;
  dom.roundsToggle.setAttribute("aria-pressed", String(ui.setup.conquest));
  dom.roundsToggle.textContent = ui.setup.conquest ? "Match: play rounds until one player holds 10 pits" : "Match: one round only";

  paintRecord();
  writeUrl();
  saveSetup(storage, ui.setup);
}

/** Say how the player has done against the opponent they have chosen. */
function paintRecord() {
  const human = humanSeats();
  if (human.length !== 1) {
    dom.record.textContent =
      human.length === 2 ? "Two people, one device: take turns." : "Watch two opponents play each other.";
    return;
  }
  const foe = human[0] === SOUTH ? ui.setup.red : ui.setup.blue;
  const tally = recordFor(ui.record, ui.setup.mode, foe);
  const played = tally.win + tally.draw + tally.loss;
  const name = agentById(foe).name;
  dom.record.textContent = played
    ? `Against ${name} at ${modeById(ui.setup.mode).name}: ${tally.win} won, ${tally.draw} drawn, ${tally.loss} lost.`
    : `You have not played ${name} at ${modeById(ui.setup.mode).name} yet.`;
}

/** Which seats a person is playing. */
function humanSeats() {
  const seats = [];
  if (ui.setup.blue === HUMAN) seats.push(SOUTH);
  if (ui.setup.red === HUMAN) seats.push(NORTH);
  return seats;
}

/** Who is in a seat: the value stored in the setup. */
const seatValue = (seat) => (seat === SOUTH ? ui.setup.blue : ui.setup.red);

/** Is a seat played by a program? */
const seatIsAgent = (seat) => isAgent(seatValue(seat));

/** What to call whoever is in a seat. */
function seatLabel(seat) {
  const value = seatValue(seat);
  return value === HUMAN ? SEAT_NAMES[seat] : agentById(value).name;
}

/** What to call both players, the way captions.js wants them. */
const seatNames = () => [seatLabel(SOUTH), seatLabel(NORTH)];

/** Keep the address bar in step with the setup, without adding history steps. */
function writeUrl() {
  const query = serializeSetup(ui.setup);
  window.history.replaceState(null, "", `${window.location.pathname}${query}`);
}

// --- the game ----------------------------------------------------------------

/** Start a match with the setup as it stands. */
function startMatch() {
  ui.match = createMatch({ mode: ui.setup.mode, conquest: ui.setup.conquest });
  ui.board = buildBoard(dom.board, { stores: modeById(ui.setup.mode).hasStores });
  showScreen("game");
  startRound();
}

/** Start the round the match is waiting on. */
function startRound() {
  const mode = ui.setup.mode;
  ui.game = newGame(mode, { owner: ui.match.owner, firstPlayer: ui.match.firstPlayer });
  ui.shown = snapshot(ui.game);
  ui.cancelled = false;
  ui.peek = null;
  ui.peekHeld = false;
  ui.runId += 1;
  paintGame();
  announceTurn();
  queueAgent();
}

/** Draw everything the game screen shows. */
function paintGame() {
  const mode = modeById(ui.setup.mode);
  for (const seat of [SOUTH, NORTH]) {
    const value = seatValue(seat);
    dom.chipScores[seat].textContent = String(ui.shown.scores[seat]);
    dom.chipWho[seat].textContent =
      value === HUMAN ? "Human" : `${agentById(value).name} · ${agentById(value).level}`;
    dom.chips[seat].classList.toggle("chip--turn", !ui.shown.over && ui.shown.turn === seat);
  }

  paintBoard(ui.board, ui.shown, {
    playable: canClick() ? rulesFor(ui.setup.mode).legalMoves(ui.game) : [],
    names: SEAT_NAMES,
    peek: ui.peek,
  });

  const strip = dom.roundStrip;
  if (mode.conquest && ui.match.conquest) {
    strip.hidden = false;
    strip.textContent = `Round ${ui.match.round} · Blue holds ${ui.match.pitCounts[SOUTH]} pits, Red holds ${ui.match.pitCounts[NORTH]} · first to ${ui.match.pitsToWin} wins`;
  } else {
    strip.hidden = true;
  }
}

/** May the person sitting here click a pit right now? */
function canClick() {
  return Boolean(ui.game) && !ui.game.over && !ui.busy && !seatIsAgent(ui.game.turn);
}

/** Say whose turn it is, in the status line. */
function announceTurn() {
  if (!ui.game || ui.game.over) return;
  const seat = ui.game.turn;
  if (seatIsAgent(seat)) {
    setStatus(`${seatLabel(seat)} is thinking…`, "think");
  } else if (humanSeats().length === 2) {
    setStatus(`${SEAT_NAMES[seat]}: tap a pit, or hold one to look ahead.`);
  } else {
    setStatus("Your move: tap a pit, or hold one to look ahead.");
  }
}

/**
 * Put a sentence in the status line.
 * @param {string} text what to say
 * @param {string} [tone] a class for the line
 */
function setStatus(text, tone = "") {
  dom.status.textContent = text;
  dom.status.className = `status ${tone ? `status--${tone}` : ""}`.trim();
}

// --- looking before you leap -------------------------------------------------

/** The timer that turns a press or a hover into a look. */
let peekTimer = null;

/**
 * Until when a click has to be swallowed, because the press it ends was a
 * look. It is a moment and not a flag: a press that ends off the board sends
 * no click at all, and a flag left standing would eat the next real one,
 * including a move played with the keyboard.
 */
let eatClickUntil = 0;

/** How long after a look the click that ended it may still arrive. */
const EAT_CLICK_MS = 300;

/**
 * Mark where a pit's last seed would land, and say what the move would do.
 * The engine answers this, so the marks can never disagree with the move.
 * @param {number} pit the pit being looked at
 * @param {boolean} held did a press open this look?
 */
function openPeek(pit, held) {
  if (!canClick()) return;
  const rules = rulesFor(ui.setup.mode);
  const moves = rules.legalMoves(ui.game);
  if (!moves.includes(pit)) return;
  const look = rules.describeMove(ui.game, pit);
  ui.peek = { from: pit, to: look.lands, store: look.landsInStore };
  ui.peekHeld = held;
  paintBoard(ui.board, ui.shown, { playable: moves, names: SEAT_NAMES, peek: ui.peek });
  setStatus(previewText(look, ui.game.turn, seatNames()), "peek");
}

/**
 * Take the marks off again.
 * @param {boolean} [sayTurn] put the prompt back in the status line
 */
function closePeek(sayTurn = true) {
  stopPeekTimer();
  if (!ui.peek) return;
  ui.peek = null;
  ui.peekHeld = false;
  if (ui.game && ui.match && ui.shown) paintGame();
  if (sayTurn) announceTurn();
}

/**
 * Open a look after a wait, so a tap stays a tap and a mouse crossing the
 * board does not flash a look at every pit it passes.
 * @param {number} pit the pit being looked at
 * @param {number} delay milliseconds to wait
 * @param {boolean} held did a press start this?
 */
function startPeekTimer(pit, delay, held) {
  stopPeekTimer();
  peekTimer = setTimeout(() => {
    peekTimer = null;
    openPeek(pit, held);
  }, delay);
}

/** Forget a look that has not opened yet. */
function stopPeekTimer() {
  if (peekTimer === null) return;
  clearTimeout(peekTimer);
  peekTimer = null;
}

/** A press has ended: a look closes, and the click it ends with plays nothing. */
function endPress() {
  stopPeekTimer();
  if (ui.peekHeld) eatClickUntil = Date.now() + EAT_CLICK_MS;
  closePeek();
}

/** Play a move, animate it and then work out what happens next. */
async function playMove(pit) {
  const rules = rulesFor(ui.setup.mode);
  const mover = ui.game.turn;
  const { state: after, events } = rules.applyMove(ui.game, pit);
  const run = ui.runId;

  ui.busy = true;
  ui.cancelled = false;
  ui.game = after;
  closePeek(false);
  paintBoard(ui.board, ui.shown, { playable: [], names: SEAT_NAMES });

  const pace = paceFor(events, reducedMotion() ? 0 : ui.speed);
  const names = seatNames();
  ui.shown = await animateMove(ui.board, ui.shown, events, {
    pace,
    flyLayer: dom.flyLayer,
    names: SEAT_NAMES,
    chip: (player) => dom.chips[player],
    cancelled: () => ui.cancelled || run !== ui.runId,
    onShown: (shown) => {
      ui.shown = shown;
      for (const seat of [SOUTH, NORTH]) dom.chipScores[seat].textContent = String(shown.scores[seat]);
    },
    // The words for one event: render.js pops the short ones over the board,
    // and the sentence goes in the status line as it happens.
    caption: (event) => {
      const said = captionFor(event, mover, names);
      if (said?.status) setStatus(said.status, said.mood);
      return said;
    },
  });

  if (run !== ui.runId) return;

  ui.busy = false;
  // Whatever the animation managed to show, the board now comes from the
  // engine's own position. A cut-short move can never leave it wrong.
  ui.shown = snapshot(ui.game);
  paintGame();
  const spoke = reportMove(events, mover);

  if (ui.game.over) {
    finishRound();
    return;
  }
  // A move that did something leaves its line up. Saying whose turn it is
  // straight afterwards would wipe the only report the player gets.
  if (!spoke) announceTurn();
  queueAgent(spoke);
}

/**
 * Say in one line what the move that just happened did.
 * @param {Object[]} events the events of the move
 * @param {number} mover the player who moved
 * @returns {boolean} did it have anything to say?
 */
function reportMove(events, mover) {
  const said = summarise(events, mover, seatNames());
  if (said.badge) flashBadge(dom.chips[mover], said.badge);
  if (said.text === null) return false;
  setStatus(said.text, said.tone);
  return true;
}

/**
 * Let a program take its turn, after a pause so its move can be seen.
 * @param {boolean} [quiet] leave the status line alone, because it is still
 *   showing what the move before did
 */
function queueAgent(quiet = false) {
  if (!ui.game || ui.game.over || !seatIsAgent(ui.game.turn)) return;
  const run = ui.runId;
  const id = seatValue(ui.game.turn);
  if (!quiet) announceTurn();
  setTimeout(async () => {
    if (run !== ui.runId || ui.busy || !ui.game || ui.game.over) return;
    // Give the browser a frame to paint "thinking" before the search blocks it.
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    if (run !== ui.runId) return;
    const rules = rulesFor(ui.setup.mode);
    const move = chooseMove(id, ui.game, rules);
    if (run !== ui.runId) return;
    playMove(move);
  }, agentById(id).pauseMs);
}

// --- ends of things ----------------------------------------------------------

/** A round has finished: file it with the match and show what it means. */
function finishRound() {
  const round = { scores: ui.game.scores.slice(), winner: ui.game.winner, endReason: ui.game.endReason };
  const before = ui.match;
  ui.match = recordRound(before, round);
  rememberResult();

  const winner = round.winner;
  const line = `${SEAT_NAMES[SOUTH]} ${round.scores[SOUTH]} · ${SEAT_NAMES[NORTH]} ${round.scores[NORTH]}`;

  if (ui.match.over) {
    const champion = ui.match.winner;
    showResult({
      title: champion === null ? "A draw" : `${seatLabel(champion)} wins`,
      tone: champion === null ? "draw" : champion === SOUTH ? "blue" : "red",
      line,
      detail: matchDetail(round),
      main: { text: "Play again", action: startMatch },
      second: { text: "Change game", action: () => showScreen("setup") },
    });
    setStatus(champion === null ? "A draw." : `${seatLabel(champion)} wins.`, "good");
    return;
  }

  // Only a Ba-awa match reaches here: another round is coming.
  const pits = ui.match.pitCounts;
  setStatus(
    winner === null
      ? `Round ${before.round} is drawn.`
      : `${seatLabel(winner)} takes round ${before.round}.`,
    "good"
  );
  showResult({
    title: winner === null ? `Round ${before.round} drawn` : `Round ${before.round} to ${seatLabel(winner)}`,
    tone: winner === null ? "draw" : winner === SOUTH ? "blue" : "red",
    line,
    detail:
      `Four seeds buy one pit, so Blue starts round ${ui.match.round} with ${pits[SOUTH]} pits and ` +
      `Red with ${pits[NORTH]}. ${seatLabel(ui.match.firstPlayer)} moves first. ` +
      `${endReasonText(round.endReason)}`,
    main: { text: `Play round ${ui.match.round}`, action: startRound },
    second: { text: "Leave the match", action: () => showScreen("setup") },
  });
}

/** The closing sentence of a finished match. */
function matchDetail(round) {
  if (ui.match.endReason === "conquest") {
    const pits = ui.match.pitCounts;
    return `Blue ends with ${pits[SOUTH]} pits and Red with ${pits[NORTH]}, so the match is over. ${endReasonText(round.endReason)}`;
  }
  if (ui.match.endReason === "wipeout") {
    return `One player has no pits left, so there is no round to play. ${endReasonText(round.endReason)}`;
  }
  return endReasonText(round.endReason);
}

/** Why a round ended, in words a first-time player can use. */
function endReasonText(reason) {
  if (reason === "side-empty") return "One row ran out, so the seeds left went to the player who owned them.";
  if (reason === "starved") return "The player to move had no seed left, so the other player took what was on the board.";
  if (reason === "eight-left")
    return "The last few seeds were going round with nobody taking any, so the player who started the round took them.";
  if (reason === "stalled") return "Nobody captured for a long time, so each player kept the seeds in their own pits.";
  return "";
}

/** Add a finished match to the record, when exactly one seat was a person. */
function rememberResult() {
  if (!ui.match.over) return;
  const human = humanSeats();
  if (human.length !== 1) return;
  const seat = human[0];
  const foe = seatValue(other(seat));
  const outcome = ui.match.winner === null ? "draw" : ui.match.winner === seat ? "win" : "loss";
  ui.record = addResult(ui.record, ui.setup.mode, foe, outcome);
  saveRecord(storage, ui.record);
}

/**
 * Show the overlay that ends a round or a match.
 * @param {Object} plan title, tone, the two lines and the two buttons
 */
function showResult(plan) {
  dom.resultTitle.textContent = plan.title;
  dom.resultLine.textContent = plan.line;
  dom.resultDetail.textContent = plan.detail;
  dom.result.dataset.tone = plan.tone;
  dom.resultMain.textContent = plan.main.text;
  dom.resultMain.onclick = () => {
    hide(dom.result);
    plan.main.action();
  };
  dom.resultSecond.textContent = plan.second.text;
  dom.resultSecond.onclick = () => {
    hide(dom.result);
    plan.second.action();
  };
  show(dom.result);
  dom.resultMain.focus();
}

// --- the rules carousel ------------------------------------------------------

/** Open the how-to-play cards on a rule set. */
function openRules(mode = ui.setup.mode) {
  ui.rulesMode = mode;
  ui.rulesCard = 0;
  buildRulesTabs();
  paintRulesCard();
  show(dom.rules);
  el("rules-ok").focus();
}

/** Build the two tabs that switch which rule set the cards explain. */
function buildRulesTabs() {
  dom.rulesTabs.textContent = "";
  for (const id of MODE_IDS) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab";
    tab.textContent = MODES[id].name;
    tab.setAttribute("aria-pressed", String(id === ui.rulesMode));
    tab.classList.toggle("tab--on", id === ui.rulesMode);
    tab.addEventListener("click", () => {
      ui.rulesMode = id;
      ui.rulesCard = 0;
      buildRulesTabs();
      paintRulesCard();
    });
    dom.rulesTabs.append(tab);
  }
}

/** Draw the card the carousel is on. */
function paintRulesCard() {
  const mode = MODES[ui.rulesMode];
  const card = mode.howToPlay[ui.rulesCard];
  dom.rulesTitle.textContent = card.title;
  dom.rulesText.textContent = card.text;
  dom.rulesStep.textContent = `${ui.rulesCard + 1} of ${mode.howToPlay.length}`;

  const mini = buildBoard(dom.rulesBoard, { stores: mode.hasStores, mini: true });
  paintBoard(
    mini,
    {
      pits: card.figure.pits,
      scores: card.figure.scores,
      owner: card.figure.owner,
      turn: SOUTH,
      over: true,
      mode: mode.id,
    },
    { highlight: card.figure.highlight, names: SEAT_NAMES }
  );
  if (card.figure.badge) {
    // A rule set with no stores hides them, and a badge inside a hidden
    // element never shows, so fall back to the board itself.
    const host = mode.hasStores ? mini.stores[SOUTH] : dom.rulesBoard;
    flashBadge(host ?? dom.rulesBoard, card.figure.badge, 4000);
  }

  dom.rulesDots.textContent = "";
  mode.howToPlay.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `dot ${index === ui.rulesCard ? "dot--on" : ""}`.trim();
    dot.setAttribute("aria-label", `Card ${index + 1}`);
    dot.addEventListener("click", () => {
      ui.rulesCard = index;
      paintRulesCard();
    });
    dom.rulesDots.append(dot);
  });

  el("rules-prev").disabled = ui.rulesCard === 0;
  el("rules-next").disabled = ui.rulesCard === mode.howToPlay.length - 1;
}

/** Move the carousel by one card. */
function stepRules(by) {
  const cards = MODES[ui.rulesMode].howToPlay.length;
  const next = ui.rulesCard + by;
  if (next < 0 || next >= cards) return;
  ui.rulesCard = next;
  paintRulesCard();
}

// --- odds and ends -----------------------------------------------------------

const show = (element) => {
  element.hidden = false;
};
const hide = (element) => {
  element.hidden = true;
};

/** Show one screen and hide the other. */
function showScreen(name) {
  ui.runId += 1;
  ui.busy = false;
  stopPeekTimer();
  ui.peek = null;
  ui.peekHeld = false;
  for (const [key, element] of Object.entries(dom.screens)) element.hidden = key !== name;
  if (name === "setup") {
    paintSetup();
    dom.start.focus();
  }
}

/** Put the animation speed on its button. */
function paintSpeed() {
  dom.speed.textContent = `Speed \u00d7${ui.speed}`;
  dom.speed.setAttribute("aria-pressed", String(ui.speed !== 1));
  dom.speed.title =
    ui.speed === 1 ? "The normal pace. Tap for a faster one." : "Tap to change the pace.";
}

/** Copy a link that opens this exact setup. */
async function shareSetup() {
  const link = `${window.location.origin}${window.location.pathname}${serializeSetup(ui.setup)}`;
  try {
    await navigator.clipboard.writeText(link);
    dom.share.textContent = "Link copied";
  } catch {
    dom.share.textContent = link;
  }
  setTimeout(() => {
    dom.share.textContent = "Copy a link to this setup";
  }, 2400);
}

/** Wire every button once. */
function wire() {
  dom.start.addEventListener("click", startMatch);
  dom.share.addEventListener("click", shareSetup);
  dom.roundsToggle.addEventListener("click", () => {
    ui.setup.conquest = !ui.setup.conquest;
    paintSetup();
  });

  dom.board.addEventListener("click", (event) => {
    // An impatient player taps the board, not necessarily a pit, so the skip
    // is checked before the pit is looked up.
    if (ui.busy) {
      ui.cancelled = true;
      return;
    }
    // The press that ended here was a look at the pit, not a move on it.
    if (Date.now() < eatClickUntil) {
      eatClickUntil = 0;
      return;
    }
    const button = event.target.closest(".pit");
    if (!button) return;
    if (!canClick()) return;
    const pit = Number(button.dataset.pit);
    if (!rulesFor(ui.setup.mode).legalMoves(ui.game).includes(pit)) {
      pulse(button, "pit--refused", 320);
      return;
    }
    playMove(pit);
  });

  // A player can look before they leap: hold a pit down, or rest a mouse on
  // it, and the board marks the pit its last seed would land in. A hold is a
  // look and nothing else, so letting go plays no move.
  dom.board.addEventListener("pointerdown", (event) => {
    eatClickUntil = 0;
    if (ui.busy) return;
    const button = event.target.closest(".pit");
    if (!button || !canClick()) return;
    startPeekTimer(Number(button.dataset.pit), HOLD_MS, true);
  });

  dom.board.addEventListener("pointerover", (event) => {
    // Only a mouse hovers. A finger sliding over a pit is not looking at it,
    // and a finger holding one is already covered above.
    if (event.pointerType && event.pointerType !== "mouse") return;
    if (ui.busy || !canClick()) return;
    const button = event.target.closest(".pit");
    const pit = button ? Number(button.dataset.pit) : null;
    if (ui.peek && ui.peek.from === pit) return;
    closePeek();
    if (pit === null) return;
    startPeekTimer(pit, DWELL_MS, false);
  });

  dom.board.addEventListener("pointerleave", endPress);
  window.addEventListener("pointerup", endPress);
  window.addEventListener("pointercancel", endPress);

  // A keyboard cannot hold a pit down, so a pit reached with the keyboard
  // shows its look at once. `:focus-visible` is the browser's own answer to
  // "did this focus come from the keyboard?", so a mouse press does not.
  dom.board.addEventListener("focusin", (event) => {
    const button = event.target.closest(".pit");
    if (!button || !canClick() || !button.matches(":focus-visible")) return;
    openPeek(Number(button.dataset.pit), false);
  });
  dom.board.addEventListener("focusout", () => closePeek());

  el("game-menu").addEventListener("click", () => showScreen("setup"));
  el("game-again").addEventListener("click", startMatch);
  dom.speed.addEventListener("click", () => {
    ui.speed = nextSpeed(ui.speed);
    saveSpeed(storage, ui.speed);
    paintSpeed();
  });

  for (const id of ["rules-open", "rules-open-game"]) {
    el(id).addEventListener("click", () => openRules());
  }
  el("rules-ok").addEventListener("click", () => hide(dom.rules));
  el("rules-close").addEventListener("click", () => hide(dom.rules));
  el("rules-prev").addEventListener("click", () => stepRules(-1));
  el("rules-next").addEventListener("click", () => stepRules(1));

  document.addEventListener("keydown", (event) => {
    if (dom.rules.hidden) return;
    if (event.key === "Escape") hide(dom.rules);
    if (event.key === "ArrowLeft") stepRules(-1);
    if (event.key === "ArrowRight") stepRules(1);
  });

  // A swipe moves the carousel on a phone, where the arrows are small.
  let touchStart = null;
  dom.rules.addEventListener(
    "touchstart",
    (event) => {
      touchStart = event.changedTouches[0].clientX;
    },
    { passive: true }
  );
  dom.rules.addEventListener(
    "touchend",
    (event) => {
      if (touchStart === null) return;
      const moved = event.changedTouches[0].clientX - touchStart;
      if (Math.abs(moved) > 45) stepRules(moved < 0 ? 1 : -1);
      touchStart = null;
    },
    { passive: true }
  );

  // A seed's flight is measured in pixels when it launches, so a resize in the
  // middle of a move would carry it to where a pit used to be. Landing the
  // seeds at once is the honest answer, and redrawing from the snapshot is
  // always safe.
  window.addEventListener("resize", () => {
    if (ui.busy) ui.cancelled = true;
    stopPeekTimer();
    if (ui.game && ui.match && ui.shown) paintGame();
  });
}

/** Start everything. */
function begin() {
  ui.record = loadRecord(storage);
  ui.speed = loadSpeed(storage);
  ui.setup = initialSetup();
  ui.rulesMode = ui.setup.mode;
  for (const seat of [SOUTH, NORTH]) {
    const value = seatValue(seat);
    if (isAgent(value)) ui.lastAgent[seat] = value;
  }

  buildModeChoices();
  buildSeat(SOUTH);
  buildSeat(NORTH);
  wire();
  paintSpeed();
  paintSetup();
  showScreen("setup");

  renderDeployLine(el("deploy-line"), readStamp(document), "en", say, escapeHtml, "web-projects/mancala");
}

begin();
