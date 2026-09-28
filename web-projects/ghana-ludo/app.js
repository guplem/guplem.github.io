// Page glue: screens, clicks, and the two roles a page can play.
//
//   host    opened the table: runs the session (online-sync), the bots and
//           the rules; saves the table so a reload can resume it
//   guest   joined from an invite link: sends intents, draws what comes back
//
// Nothing worth testing lives here. The rules are rules.js, the table and
// its reducer are table.js, the words are captions.js, the drawing is
// render.js, and the networking is the shared ../online-sync/ module.

import { createGuest, createHost } from "../online-sync/session.js";
import { answerInvite, createInvite, randomToken } from "../online-sync/peer.js";
import { linkFor, readLink, unpackSignal } from "../online-sync/signal.js";
import { listenForAnswers, relayAnswer } from "../online-sync/relay.js";
import { renderAnswerCard, renderInviteCard } from "../online-sync/pairingPanel.js";
import {
  MAX_SEATS,
  addBot,
  addLocal,
  admit,
  backToLobby,
  botStep,
  fairDie,
  forcedStep,
  makeReducer,
  newTable,
  removeSeat,
  seatsControlledBy,
  setOption,
  startRound,
  takeOut,
} from "./table.js";
import { chooseAction } from "./bot.js";
import { demoTable } from "./demo.js";
import { SEAT_COLOURS, describeEntry, turnLine } from "./captions.js";
import { createBoard, drawDie } from "./render.js";
import { HOUSES, START_FIELD, STAR, TRACK } from "./rules.js";
import * as store from "./store.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { escapeHtml, say } from "./deployText.js";

const APP = "ghana-ludo";
const $ = (id) => document.getElementById(id);
const safely = (get) => {
  try {
    return get();
  } catch {
    return null;
  }
};
const storage = safely(() => localStorage);
const tabStorage = safely(() => sessionStorage);
const TAB_ID_KEY = "ghana-ludo.tabPlayerId";

// A second tab of the same browser gets its own id (see createGuest's freshId).
const deviceId = tabStorage?.getItem(TAB_ID_KEY) || store.loadPlayerId(storage, () => randomToken(6));

const OPTION_LABELS = {
  back: "Back kick",
  side: "Side kick",
  home: "Home kick",
  three: "Three rolls while nothing of yours is out",
  stack: "Up to four of your own on your start field",
  safe: "Nobody can be knocked off their own start field",
};

const REFUSALS = {
  running: "That round has already started. Ask the host to invite you when it ends.",
  full: "That table is full.",
  app: "That invite is for a different game.",
  protocol: "Your page and the host's page are different versions. Both of you, reload the page.",
};

const CLOSINGS = {
  removed: "The host took you out of the round.",
  "host-left": "The host closed the table.",
  lost: "The connection to the host was lost. Your seat is kept: ask the host for a new invite.",
  left: "You left the table.",
};

let role = null; // "host" | "guest"
let host = null;
let guest = null;
let selfId = deviceId;
let table = null;
let peers = [];
let connection = "live";
let selected = null;
let stopRelay = null;
let tickTimer = null;
let lastRolls = -1;
let lastRound = -1;
const invites = new Map(); // ticket -> { invite, card, slot }
const reducer = makeReducer({ rollDie: fairDie });

const board = createBoard($("board"), { onPiece: pickPiece, onTarget: pickTarget });

// ---------- Screens ----------

function show(name) {
  ["setup", "join", "relay", "notice", "lobby", "table"].forEach((s) => {
    $(`screen-${s}`).hidden = s !== name;
  });
  $("bar").hidden = !(name === "lobby" || name === "table");
  document.body.dataset.screen = name;
}

function notice(text) {
  $("notice-text").textContent = text;
  show("notice");
}

function clearHash() {
  history.replaceState(null, "", location.pathname + location.search);
}

// ---------- Hosting ----------

function openTable(saved, { persist = true } = {}) {
  const name = $("name").value.trim() || "Host";
  store.saveName(storage, name);
  const state = saved ? saved.state : newTable({ id: deviceId, name });
  selfId = state.seats[0].id;
  const room = saved ? saved.room : randomToken(3);

  host = createHost({
    app: APP,
    room,
    self: { id: selfId, name: state.seats[0].name },
    state,
    version: saved ? saved.version : 0,
    apply: reducer,
    admit,
    onChange: ({ state: next, version, peers: list }) => {
      table = next;
      peers = list;
      if (persist) store.saveTable(storage, { room, state: next, version });
      render();
      hostTick();
    },
  });
  role = "host";
  table = host.state;
  peers = host.peers;
  stopRelay = listenForAnswers({ app: APP, onAnswer: (code) => readAnswer(code) });
  if (persist) store.saveTable(storage, { room, state: table, version: host.version });
  render();
  hostTick();
}

/** Bots and forced moves: the host plays them, a moment apart, so people can follow. */
function hostTick() {
  clearTimeout(tickTimer);
  if (role !== "host" || !table?.game || table.game.phase !== "play") return;
  const game = table.game;
  const seat = table.seats.find((s) => s.id === game.players[game.turn].id);
  let step = null;
  let delay = 900;
  if (seat?.kind === "bot") {
    step = (t) => botStep(t, { rollDie: fairDie, choose: (g) => chooseAction(g) });
    delay = game.awaiting === "roll" ? 750 : 950;
  } else if (game.awaiting === "move" && game.moves.length === 1) {
    step = forcedStep;
  }
  if (!step) return;
  const at = host.version;
  tickTimer = setTimeout(() => {
    if (!host || host.version !== at) return;
    if (board.busy) {
      hostTick();
      return;
    }
    host.update(step);
  }, delay);
}

async function openInvite(slot) {
  if (role !== "host") return;
  // One open invite per slot: a new one replaces the old and closes its connection.
  invites.forEach((entry, ticket) => {
    if (entry.slot === slot) {
      entry.invite.cancel();
      invites.delete(ticket);
    }
  });
  slot.replaceChildren(Object.assign(document.createElement("p"), { className: "hint", textContent: "Preparing an invite..." }));
  let invite;
  try {
    invite = await createInvite({ app: APP, room: host.room });
  } catch (error) {
    slot.replaceChildren(Object.assign(document.createElement("p"), { className: "notice", textContent: error.message }));
    return;
  }
  const link = linkFor(location.href, "offer", invite.code);
  const card = renderInviteCard(slot, {
    link,
    onAnswer: (text) => readAnswer(text),
    onCancel: () => {
      invite.cancel();
      invites.delete(invite.ticket);
      slot.replaceChildren();
    },
  });
  invites.set(invite.ticket, { invite, card, slot });
}

/** An answer arrived: pasted into a card, or relayed from the tab the camera opened. */
async function readAnswer(text) {
  const latest = [...invites.values()].at(-1);
  const found = readLink(text);
  if (!found) {
    latest?.card.setStatus("That does not look like an answer.", "error");
    return;
  }
  let signal;
  try {
    signal = unpackSignal(found.code);
  } catch (error) {
    latest?.card.setStatus(error.message, "error");
    return;
  }
  if (signal.kind !== "answer") {
    latest?.card.setStatus("That is an invite. Send it to a friend; paste their answer here.", "error");
    return;
  }
  const entry = invites.get(signal.ticket);
  if (!entry) {
    latest?.card.setStatus("That answer belongs to an invite that is no longer open.", "error");
    return;
  }
  entry.card.setStatus("Connecting...");
  try {
    const link = await entry.invite.accept(found.code);
    invites.delete(signal.ticket);
    host.connect(link);
    entry.card.setStatus("Connected!", "ok");
    setTimeout(() => entry.slot.replaceChildren(), 1200);
  } catch (error) {
    entry.card.setStatus(error.message, "error");
  }
}

function hostUpdate(fn) {
  if (role === "host") host.update(fn);
}

// ---------- Joining ----------

async function joinWith(code) {
  const name = $("join-name").value.trim() || "Guest";
  store.saveName(storage, name);
  $("join-go").disabled = true;
  $("join-status").textContent = "Preparing your answer...";
  let answer;
  try {
    answer = await answerInvite(code, { app: APP });
  } catch (error) {
    $("join-status").textContent = error.message;
    $("join-go").disabled = false;
    return;
  }
  $("join-status").textContent = "";
  $("join-go").hidden = true;
  const card = renderAnswerCard($("answer-slot"), { link: linkFor(location.href, "answer", answer.code) });
  card.setStatus("Waiting for the host to open your answer...");

  const link = await answer.connected;
  card.destroy();
  guest = createGuest({
    app: APP,
    self: { id: deviceId, name },
    link,
    freshId: () => randomToken(6),
    onIdChange: (id) => {
      selfId = id;
      tabStorage?.setItem(TAB_ID_KEY, id);
    },
    onChange: ({ state, peers: list, status }) => {
      if (state) table = state;
      peers = list;
      connection = status;
      if (status !== "closed") render();
    },
    onRefuse: (reason) => notice(REFUSALS[reason] ?? `The host said no (${reason}).`),
    onClose: (reason) => notice(CLOSINGS[reason] ?? "The table closed."),
  });
  selfId = guest.self.id;
  role = "guest";
}

// ---------- Playing ----------

function act(intent) {
  const game = table?.game;
  if (!game) return;
  const onTurn = game.players[game.turn].id;
  const payload = onTurn === selfId ? intent : { ...intent, as: onTurn };
  if (role === "host") host.dispatch(payload);
  else guest?.dispatch(payload);
}

function myTurn() {
  const game = table?.game;
  return Boolean(game && game.phase === "play" && seatsControlledBy(table, selfId).includes(game.players[game.turn].id));
}

function cellOf(seat, to) {
  if (to.at === "star") return STAR;
  if (to.at === "house") return HOUSES[to.house][to.step];
  return TRACK[(START_FIELD[seat] + to.step) % 40];
}

const SHORT = { backkick: "B", backstep: "B", homekick: "H", sidekick: "S", goal: "★" };

function pickPiece(pieceId) {
  const game = table?.game;
  if (!myTurn() || game.awaiting !== "move" || board.busy) return;
  const options = game.moves.filter((m) => m.piece === pieceId);
  if (options.length === 1) {
    selected = null;
    act({ t: "move", id: options[0].id });
  } else if (options.length > 1) {
    selected = selected === pieceId ? null : pieceId;
    render();
  }
}

function pickTarget(targetId) {
  const game = table?.game;
  if (!myTurn()) return;
  if (game.awaiting === "move") {
    selected = null;
    act({ t: "move", id: targetId });
  } else if (game.awaiting === "side") {
    act({ t: "side", id: targetId });
  }
}

// ---------- Drawing ----------

function colourIndex(position, count) {
  return count === 2 ? [0, 2][position] : position;
}

function presenceOf(seat) {
  if (seat.kind === "bot" || seat.kind === "local" || seat.kind === "host") return "live";
  return peers.find((p) => p.id === seat.id)?.status ?? "closed";
}

function kindLabel(seat) {
  const parts = [];
  if (seat.id === selfId) parts.push("you");
  if (seat.kind === "host") parts.push("host");
  if (seat.kind === "bot") parts.push("bot");
  if (seat.kind === "local") parts.push("on the host's phone");
  return parts.join(", ");
}

function render() {
  if (!table) return;
  $("room-code").textContent = role === "host" ? host.room : (guest?.room ?? "");
  const guestsOnline = peers.filter((p) => !p.host && p.status === "live").length;
  $("conn-badge").textContent =
    role === "host"
      ? guestsOnline
        ? `${guestsOnline} connected`
        : "No one connected"
      : connection === "quiet"
        ? "Connection quiet..."
        : "Connected directly";
  $("conn-badge").dataset.state = role === "guest" ? connection : "live";

  if (!table.game) renderLobby();
  else renderTable();
}

function renderLobby() {
  show("lobby");
  board.reset();
  const isHost = role === "host";
  const count = table.seats.length;

  const list = $("seats");
  list.replaceChildren();
  for (let i = 0; i < MAX_SEATS; i++) {
    const seat = table.seats[i];
    const li = document.createElement("li");
    li.className = "seat";
    if (!seat) {
      li.classList.add("seat--free");
      li.textContent = "Free seat";
      list.append(li);
      continue;
    }
    const dot = document.createElement("span");
    dot.className = `dot seat-${colourIndex(i, count)}`;
    const name = document.createElement("span");
    name.className = "seat__name";
    name.textContent = seat.name;
    const kind = document.createElement("span");
    kind.className = "seat__kind";
    kind.textContent = kindLabel(seat);
    const presence = document.createElement("span");
    presence.className = `presence presence--${presenceOf(seat)}`;
    presence.title = presenceOf(seat) === "live" ? "Connected" : "Not connected";
    li.append(dot, name, kind, presence);
    if (isHost && seat.kind !== "host") {
      const remove = document.createElement("button");
      remove.className = "btn btn--small btn--quiet";
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        hostUpdate((t) => removeSeat(t, seat.id));
        if (seat.kind === "guest") host.drop(seat.id, "removed");
      });
      li.append(remove);
    }
    list.append(li);
  }

  $("host-tools").hidden = !isHost;
  const full = count >= MAX_SEATS;
  $("invite").disabled = full;
  $("add-bot").disabled = full;
  $("add-local").querySelector("button").disabled = full;
  if (!isHost) $("invite-slot").replaceChildren();

  const options = $("options");
  options.replaceChildren();
  Object.entries(OPTION_LABELS).forEach(([key, label]) => {
    const row = document.createElement("label");
    row.className = "option";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = table.options[key];
    box.disabled = !isHost;
    box.addEventListener("change", () => hostUpdate((t) => setOption(t, key, box.checked)));
    row.append(box, document.createTextNode(` ${label}`));
    options.append(row);
  });

  $("start").hidden = !isHost;
  $("start").disabled = count < 2;
  $("lobby-hint").textContent = isHost
    ? count < 2
      ? "Add at least one more player: a bot, somebody on this phone, or a friend."
      : ""
    : "The host starts the round.";
}

function renderTable() {
  show("table");
  const game = table.game;
  if (table.round !== lastRound) {
    board.reset();
    lastRound = table.round;
    lastRolls = -1;
  }
  const mine = seatsControlledBy(table, selfId);
  const mineOnTurn = myTurn();
  const seat = game.players[game.turn]?.seat;

  const marks = { movable: new Set(), targets: [], selected };
  if (mineOnTurn && game.awaiting === "move") {
    game.moves.forEach((m) => marks.movable.add(m.piece));
    if (selected != null) {
      marks.targets = game.moves
        .filter((m) => m.piece === selected)
        .map((m) => ({ id: m.id, cell: cellOf(seat, m.to), label: m.kind, short: SHORT[m.kind] ?? "" }));
    }
  } else {
    selected = null;
  }
  if (mineOnTurn && game.awaiting === "side") {
    marks.targets = game.sides.map((s) => ({ id: s.id, cell: cellOf(seat, s.to), label: "side kick", short: "S" }));
  }
  board.update(game, marks);

  $("turn-line").textContent = turnLine(game, mine);
  $("roll").disabled = !(mineOnTurn && game.awaiting === "roll");
  $("roll").hidden = mineOnTurn && game.awaiting === "side";
  $("side-choice").hidden = !(mineOnTurn && game.awaiting === "side");
  $("side-take").hidden = game.sides.length !== 1;
  $("side-leave").disabled = game.last?.kind === "backstep";

  renderDie(game);
  renderPlayers(game);
  renderLog(game);
  renderOver(game);
}

function renderDie(game) {
  const lastRoll = [...game.log].reverse().find((e) => e.kind === "roll");
  const value = game.die ?? lastRoll?.value ?? null;
  if (game.rolls !== lastRolls && lastRolls !== -1 && value) {
    // Tumble, then land: every page animates the same roll.
    const die = $("die");
    die.classList.add("is-rolling");
    let n = 0;
    const tumble = setInterval(() => {
      drawDie(die, 1 + Math.floor(Math.random() * 6));
      if (++n >= 6) {
        clearInterval(tumble);
        drawDie(die, value);
        die.classList.remove("is-rolling");
      }
    }, 70);
  } else if (!$("die").classList.contains("is-rolling")) {
    drawDie($("die"), value);
  }
  lastRolls = game.rolls;
}

function renderPlayers(game) {
  const list = $("players");
  list.replaceChildren();
  game.players.forEach((player, n) => {
    const seatInfo = table.seats.find((s) => s.id === player.id) ?? { kind: "guest" };
    const li = document.createElement("li");
    li.className = "player";
    li.classList.toggle("is-turn", game.phase === "play" && n === game.turn);
    const dot = document.createElement("span");
    dot.className = `dot seat-${player.seat}`;
    const name = document.createElement("span");
    name.className = "player__name";
    name.textContent = player.name + (player.id === selfId ? " (you)" : "");
    const status = document.createElement("span");
    status.className = "player__status";
    const presence = presenceOf(seatInfo);
    status.textContent = player.place
      ? `Home, place ${player.place}`
      : player.gone
        ? "Left"
        : presence !== "live"
          ? "Not connected"
          : seatInfo.kind === "bot"
            ? "Bot"
            : "";
    li.append(dot, name, status);

    if (role === "host" && seatInfo.kind === "guest" && presence !== "live" && !player.gone && game.phase === "play") {
      const reinvite = document.createElement("button");
      reinvite.className = "btn btn--small";
      reinvite.type = "button";
      reinvite.textContent = "New invite";
      reinvite.addEventListener("click", () => openInvite($("reinvite-slot")));
      const out = document.createElement("button");
      out.className = "btn btn--small btn--quiet";
      out.type = "button";
      out.textContent = "Take out";
      out.addEventListener("click", () => {
        if (confirm(`Take ${player.name} out of the round? The others play on.`)) {
          host.update((t) => takeOut(t, player.id));
          host.drop(player.id, "removed");
        }
      });
      li.append(reinvite, out);
    }
    list.append(li);
  });
}

function renderLog(game) {
  const list = $("log");
  list.replaceChildren();
  game.log
    .map((entry) => describeEntry(entry, game))
    .filter(Boolean)
    .slice(-12)
    .reverse()
    .forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      list.append(li);
    });
}

function renderOver(game) {
  const over = game.phase === "over";
  $("over").hidden = !over;
  if (!over) return;
  const places = $("over-places");
  places.replaceChildren();
  [...game.players]
    .filter((p) => p.place != null)
    .sort((a, b) => a.place - b.place)
    .forEach((p) => {
      const li = document.createElement("li");
      li.textContent = `${p.name}${p.id === selfId ? " (you)" : ""}`;
      places.append(li);
    });
  const loser = game.loser != null ? game.players[game.loser] : null;
  $("over-loser").textContent = loser
    ? loser.id === selfId
      ? "You are the last one home."
      : `${loser.name} is the last one home.`
    : "Not enough players left to finish the round.";
  $("over-host").hidden = role !== "host";
  $("over-guest").hidden = role === "host";
}

// ---------- Wiring ----------

$("open-table").addEventListener("click", () => {
  store.clearTable(storage);
  openTable(null);
});
$("resume-go").addEventListener("click", () => openTable(store.loadTable(storage)));
$("resume-drop").addEventListener("click", () => {
  store.clearTable(storage);
  $("resume").hidden = true;
});
$("paste-invite-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const found = readLink($("paste-invite").value);
  let kind = found?.kind;
  if (found && !kind) kind = safely(() => unpackSignal(found.code).kind);
  if (!found || kind !== "offer") {
    $("paste-invite-error").textContent = "That is not an invite code.";
    return;
  }
  startJoin(found.code);
});

$("invite").addEventListener("click", () => openInvite($("invite-slot")));
$("add-bot").addEventListener("click", () => hostUpdate((t) => addBot(t)));
$("add-local").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("local-name").value.trim() || `Player ${table.seats.length + 1}`;
  hostUpdate((t) => addLocal(t, name));
  $("local-name").value = "";
});
$("start").addEventListener("click", () => hostUpdate((t) => startRound(t)));
$("again").addEventListener("click", () => hostUpdate((t) => startRound(backToLobby(t))));
$("to-lobby").addEventListener("click", () => hostUpdate((t) => backToLobby(t)));

$("roll").addEventListener("click", () => {
  if (!board.busy) act({ t: "roll" });
});
$("side-take").addEventListener("click", () => act({ t: "side", id: table.game.sides[0]?.id }));
$("side-leave").addEventListener("click", () => act({ t: "side", id: null }));

$("leave").addEventListener("click", () => {
  if (role === "host") {
    if (!confirm("Close the table for everybody?")) return;
    host.close();
    stopRelay?.();
    store.clearTable(storage);
    invites.forEach(({ invite }) => invite.cancel());
    invites.clear();
  } else {
    guest?.leave();
  }
  location.replace(location.pathname);
});
$("notice-back").addEventListener("click", () => location.replace(location.pathname));

window.addEventListener("beforeunload", (event) => {
  // A reload drops every connection, and each friend then needs a new invite.
  if (role === "host" && peers.some((p) => !p.host && p.status === "live")) {
    event.preventDefault();
    event.returnValue = "";
  }
});

function startJoin(code) {
  $("join-name").value = store.loadName(storage);
  show("join");
  $("join-go").onclick = () => joinWith(code);
}

// ---------- Start ----------

(function start() {
  renderDeployLine($("deploy-line"), readStamp(document), "en", say, escapeHtml, "web-projects/ghana-ludo");
  $("name").value = store.loadName(storage);

  const hash = location.hash;
  const found = readLink(hash);
  if (hash.startsWith("#answer=") && found) {
    clearHash();
    const sent = relayAnswer({ app: APP, code: found.code });
    $("relay-text").textContent = sent
      ? "It went to your table in this browser. Switch back to that tab: your friend is joining."
      : "This browser could not pass it to your table.";
    $("relay-code").value = found.code;
    show("relay");
    return;
  }
  if (hash === "#demo") {
    // A round in progress, the same every time (demo.js); never saved over a real table.
    const name = store.loadName(storage) || "Ama";
    $("name").value = name;
    openTable({ room: randomToken(3), state: demoTable({ id: deviceId, name }), version: 0 }, { persist: false });
    return;
  }
  if (hash.startsWith("#join=") && found) {
    clearHash();
    startJoin(found.code);
    return;
  }

  const saved = store.loadTable(storage);
  if (saved) {
    const players = saved.state.seats.length;
    const running = saved.state.game?.phase === "play";
    $("resume-text").textContent = `You have a table from earlier: ${players} player${players === 1 ? "" : "s"}${
      running ? ", round in progress" : ""
    }.`;
    $("resume").hidden = false;
  }
  show("setup");
})();

// Keep a stable reference for debugging in the console.
window.ghanaLudo = {
  get table() {
    return table;
  },
  get role() {
    return role;
  },
  SEAT_COLOURS,
};
