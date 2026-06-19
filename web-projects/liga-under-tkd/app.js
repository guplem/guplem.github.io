// Liga UNDER — app controller. This is the only file that touches the DOM.
// It wires the shell (nav, language switcher, status), runs the polling loop, and renders
// the four views (Home, By tatami, By group, Athletes) using the pure engine + i18n modules.

import { CONFIG } from "./config.js";
import { detectLanguage, t, translateToken } from "./i18n.js";
import { loadStaticData, loadCombats, usingMockData } from "./data-source.js";
import {
  STATUS,
  combatScore,
  combatResultString,
  sideOf,
  opponentId,
  standingsForGroup,
  crossTable,
  matrixLabels,
  fieldRunningOrder,
  athleteFixtures,
  athleteSummary,
  searchPlayers,
} from "./engine.js";

const LANG_STORAGE_KEY = "ligaunder.lang";

const state = {
  lang: CONFIG.defaultLanguage,
  players: [],
  groups: [],
  combats: [],
  refreshing: false,
  playersById: new Map(),
  groupsById: new Map(),
  combatsSignature: "",
  lastUpdated: null,
  loadError: false,
  searchQuery: "",
};

let currentRoute = { name: "home", param: null };
let lastRouteKey = null;
let pollTimer = null;
let tickTimer = null;
let statusDetailTimer = null;
let statusDetailInterval = null;

// ---------------- small helpers ----------------

// Escape any text that comes from the sheet before putting it into innerHTML.
// textContent escapes & < >, but NOT quotes; we also escape " and ' so the result is safe inside
// double- or single-quoted attributes (e.g. href="#/athletes/${esc(id)}"), preventing attribute
// breakout / event-handler injection from a malicious or mistyped sheet value.
function esc(value) {
  const div = document.createElement("div");
  div.textContent = value === null || value === undefined ? "" : String(value);
  return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function tr(key, params) {
  return esc(t(state.lang, key, params));
}

function playerName(playerId) {
  const p = state.playersById.get(playerId);
  return p ? p.fullName || p.playerId : playerId;
}

function playerClub(playerId) {
  const p = state.playersById.get(playerId);
  return p ? p.club : "";
}

// Human classification label for a group, e.g. "Cadet · Femení · -44kg · A".
function groupLabel(group) {
  if (!group) return "";
  const parts = [
    translateToken(state.lang, "age", group.age),
    translateToken(state.lang, "sex", group.sex),
    group.weight,
    group.level,
  ].filter(Boolean);
  let label = parts.join(" · ");
  if (group.pool && group.pool > 1) label += " · " + t(state.lang, "groups.pool", { n: group.pool });
  return label;
}

// ---------------- shell: i18n, nav, language, status ----------------

function applyStaticI18n() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(state.lang, node.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(state.lang, node.getAttribute("data-i18n-aria")));
  });
}

function updateNavActive() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const active = link.getAttribute("data-route") === currentRoute.name;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function updateLangButtons() {
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    const active = btn.getAttribute("data-lang") === state.lang;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

// Build the pill's inner structure once: a coloured state dot + a label span.
function ensureStatusStructure(pill) {
  if (!pill.querySelector(".status-dot")) {
    pill.innerHTML = `<span class="status-dot" aria-hidden="true"></span><span class="status-pill__label"></span>`;
  }
}

function updateStatus() {
  const pill = document.getElementById("status-pill");
  if (!pill) return;
  ensureStatusStructure(pill);
  const dot = pill.querySelector(".status-dot");
  const label = pill.querySelector(".status-pill__label");

  // demo = no sheet; refresh = a fetch is in flight; error = last fetch failed; live = last ok.
  const mode = state.usingMock
    ? "demo"
    : state.refreshing
    ? "refresh"
    : state.loadError
    ? "error"
    : "live";

  dot.className = "status-dot status-dot--" + mode;
  pill.classList.toggle("status-pill--error", mode === "error");

  // Leave the label alone while the tapped "Updated Xs" detail is showing.
  if (pill.dataset.detail !== "1") {
    label.textContent = mode === "demo" ? "Demo" : t(state.lang, "status.live");
  }
  pill.setAttribute(
    "aria-label",
    mode === "demo"
      ? t(state.lang, "status.demo")
      : mode === "error"
      ? t(state.lang, "status.error")
      : t(state.lang, "status.live")
  );
}

// "Updated 12s ago" from the last successful refresh (used by the tap-to-reveal detail).
function formatUpdatedAgo() {
  if (!state.lastUpdated) return t(state.lang, "status.justNow");
  const secs = Math.floor((Date.now() - state.lastUpdated) / 1000);
  if (secs < 5) return t(state.lang, "status.justNow");
  const ago = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)} min`;
  return `${t(state.lang, "status.updated")} ${ago}`;
}

// Tapping the indicator reveals how long since the last successful refresh, with the counter
// ticking live. Tapping again closes it; it also auto-closes after a few seconds. The expand /
// collapse is animated in CSS.
function showStatusDetail() {
  const pill = document.getElementById("status-pill");
  if (!pill || state.usingMock) return;
  const label = pill.querySelector(".status-pill__label");
  if (!label) return;
  if (pill.dataset.detail === "1") {
    hideStatusDetail();
    return;
  }
  pill.dataset.detail = "1";
  pill.classList.add("status-pill--detail");
  const tick = () => {
    label.textContent = formatUpdatedAgo();
  };
  tick();
  clearInterval(statusDetailInterval);
  statusDetailInterval = setInterval(tick, 1000); // keep the counter live while it is shown
  clearTimeout(statusDetailTimer);
  statusDetailTimer = setTimeout(hideStatusDetail, 6000);
}

function hideStatusDetail() {
  const pill = document.getElementById("status-pill");
  if (!pill) return;
  clearInterval(statusDetailInterval);
  statusDetailInterval = null;
  clearTimeout(statusDetailTimer);
  statusDetailTimer = null;
  delete pill.dataset.detail;
  pill.classList.remove("status-pill--detail");
  updateStatus(); // restore the normal label, which then animates closed
}

function setLanguage(lang) {
  if (!CONFIG.supportedLanguages.includes(lang)) return;
  state.lang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (_) {
    /* private mode: ignore */
  }
  applyStaticI18n();
  updateLangButtons();
  updateStatus();
  renderRoute();
}

// ---------------- combat card (shared by Fields + Athlete views) ----------------

function statusBadge(status) {
  const cls = "badge badge--" + status.toLowerCase();
  return `<span class="${cls}">${esc(translateToken(state.lang, "status", status))}</span>`;
}

function fighterBlock(side, playerId, isWinner) {
  const sideClass = side === "Red" ? "fighter--red" : "fighter--blue";
  const winnerClass = isWinner ? " is-winner" : "";
  const club = playerClub(playerId);
  return `
    <div class="fighter ${sideClass}${winnerClass}">
      <a class="fighter__name" href="#/athletes/${esc(playerId)}">${esc(playerName(playerId))}</a>
      ${club ? `<span class="fighter__club">${esc(club)}</span>` : ""}
      ${isWinner ? `<span class="fighter__tag">${tr("combat.winner")}</span>` : ""}
    </div>`;
}

function scoreColumn(combat) {
  const s = combatScore(combat);
  const showScores = combat.status === STATUS.FINISHED || combat.status === STATUS.ONGOING;
  if (!showScores) {
    return `<div class="combat-card__score"><span class="vs">${tr("combat.vs")}</span></div>`;
  }
  const rows = combat.rounds
    .map((r, i) => {
      const red = r.red === null ? "·" : r.red;
      const blue = r.blue === null ? "·" : r.blue;
      // When the round Winner is set, show who took the round. It may disagree with the points
      // (a disqualification or withdrawal), so the colored side name is the source of truth.
      const win = r.winner ? ` <span class="round__win round__win--${r.winner.toLowerCase()}">(${esc(translateToken(state.lang, "side", r.winner))})</span>` : "";
      return `<div class="round"><span class="round__label">${tr("combat.round", { n: i + 1 })}</span><span class="round__pts">${esc(red)} - ${esc(blue)}</span>${win}</div>`;
    })
    .join("");
  const result = combatResultString(combat);
  const resultHtml = result ? `<div class="result">${esc(result)}</div>` : "";
  return `<div class="combat-card__score">${rows}${resultHtml}</div>`;
}

function combatCard(combat, { showField = true, ribbon = null } = {}) {
  const s = combatScore(combat);
  // Only show a winner when the combat is Finished AND both rounds are actually decided, so an
  // incompletely-entered Finished row does not paint a phantom winner.
  const decided = combat.status === STATUS.FINISHED && s.decided;
  const redWinner = decided && s.redLeaguePoints === 3;
  const blueWinner = decided && s.blueLeaguePoints === 3;

  const metaBits = [];
  if (showField && combat.field !== null) metaBits.push(t(state.lang, "fields.tatami", { n: combat.field }));
  if (combat.combat !== null) metaBits.push(t(state.lang, "combat.label", { n: combat.combat }));

  const ribbonHtml = ribbon
    ? `<span class="combat-card__ribbon combat-card__ribbon--${ribbon}">${tr(ribbon === "current" ? "fields.current" : "fields.next")}</span>`
    : "";

  const classes = ["combat-card"];
  if (ribbon === "current") classes.push("is-current");
  if (ribbon === "next") classes.push("is-next");

  return `
    <article class="${classes.join(" ")}">
      ${ribbonHtml}
      <header class="combat-card__head">
        <span class="combat-card__meta">${esc(metaBits.join(" · "))}</span>
        ${combat.status === STATUS.SCHEDULED || ribbon === "current" ? "" : statusBadge(combat.status)}
      </header>
      <div class="combat-card__body">
        ${fighterBlock("Red", combat.redId, redWinner)}
        ${scoreColumn(combat)}
        ${fighterBlock("Blue", combat.blueId, blueWinner)}
      </div>
    </article>`;
}

// ---------------- view: Home ----------------

function renderHome(view) {
  // Stack the wordmark like the poster ("LIGA" over a big "UNDER"). Falls back to one line.
  const titleParts = t(state.lang, "brand.title").split(" ");
  const titleHtml =
    titleParts.length >= 2
      ? `<span class="home__title-top">${esc(titleParts[0])}</span><span class="home__title-main">${esc(titleParts.slice(1).join(" "))}</span>`
      : `<span class="home__title-main">${esc(titleParts[0])}</span>`;

  view.innerHTML = `
    <section class="home">
      <div class="home__hero">
        <div class="home__hero-inner">
          <p class="home__kicker">${tr("home.eventTitle")}</p>
          <img class="home__logo" src="logo.png" alt="Liga UNDER" width="150" height="150" />
          <h1 class="home__title">${titleHtml}</h1>
          <p class="home__tagline">${tr("brand.tagline")}</p>
          <div class="home__meta">
            <span class="home__date">${tr("home.date")}</span>
            <span class="home__place">📍 ${tr("home.place")}</span>
          </div>
          <a class="btn btn--hero" href="#/fields">${tr("home.cta")}</a>
        </div>
        <button type="button" class="home__scroll" aria-label="${esc(t(state.lang, "home.cta"))}">
          <span class="home__scroll-chevron" aria-hidden="true"></span>
        </button>
      </div>

      <div class="home__sections">
        <div class="home__strip">
          <span class="home__point"><span class="home__point-icon" aria-hidden="true">🥋</span>${tr("home.guaranteed")}</span>
          <span class="home__point"><span class="home__point-icon" aria-hidden="true">🎟️</span>${tr("home.freeEntry")}</span>
          <span class="home__point"><span class="home__point-icon" aria-hidden="true">⚡</span>${tr("home.limited")}</span>
        </div>

        <section class="home__block">
          <h2 class="home__block-title">${tr("home.countdownTitle")}</h2>
          <div class="countdown" id="countdown"></div>
        </section>

        <section class="home__block">
          <h2 class="home__block-title">${tr("home.followUs")}</h2>
          <a class="home__ig" href="${esc(CONFIG.instagramUrl)}" target="_blank" rel="noopener"><span class="home__ig-icon" aria-hidden="true">📷</span>${esc(CONFIG.instagramHandle)}</a>
        </section>

        <section class="home__block">
          <h2 class="home__block-title">${tr("home.sponsorsTitle")}</h2>
          <ul class="home__sponsors">
            <li>Tae Kwon Do Avellaneda</li>
            <li>Daedo</li>
            <li>Ajuntament de Premià de Mar</li>
          </ul>
        </section>
      </div>
    </section>`;

  const scrollBtn = view.querySelector(".home__scroll");
  if (scrollBtn) {
    scrollBtn.addEventListener("click", () => {
      const target = view.querySelector(".home__sections");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  fillCountdown();
}

function fillCountdown() {
  const node = document.getElementById("countdown");
  if (!node) return;
  const target = new Date(CONFIG.eventDateIso).getTime();
  const diff = target - Date.now();
  if (diff <= 0) {
    node.innerHTML = `<p class="countdown__started">${tr("home.started")}</p>`;
    return;
  }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const unit = (value, key) =>
    `<div class="countdown__unit"><span class="countdown__value">${value}</span><span class="countdown__label">${tr("countdown." + key)}</span></div>`;
  node.innerHTML = unit(days, "days") + unit(hours, "hours") + unit(mins, "minutes") + unit(secs, "seconds");
}

// ---------------- view: Combats by tatami ----------------

function renderFields(view) {
  view.innerHTML = `
    <section class="page">
      <h1 class="page__title">${tr("fields.title")}</h1>
      <div id="tatami-bar" class="tatami-bar"></div>
      <div id="fields-content"></div>
    </section>`;
  // One delegated listener on the bar; it survives the innerHTML updates fillFields does on poll.
  const bar = document.getElementById("tatami-bar");
  bar.addEventListener("click", (e) => {
    const pill = e.target.closest(".tatami-pill");
    if (!pill) return;
    const field = pill.getAttribute("data-field");
    // Empty data-field = the "All" filter (clears the param); otherwise filter to one tatami.
    if (field) {
      history.replaceState(null, "", "#/fields/" + encodeURIComponent(field));
      currentRoute.param = field;
    } else {
      history.replaceState(null, "", "#/fields");
      currentRoute.param = null;
    }
    fillFields();
  });
  bar.addEventListener("scroll", updateTatamiFade);
  fillFields();
}

// Fade only the edge(s) of the tatami bar that still have hidden, scrollable pills.
function updateTatamiFade() {
  const bar = document.getElementById("tatami-bar");
  if (!bar) return;
  const max = bar.scrollWidth - bar.clientWidth;
  bar.classList.toggle("is-fade-left", bar.scrollLeft > 1);
  bar.classList.toggle("is-fade-right", bar.scrollLeft < max - 1);
}

function fillFields() {
  const bar = document.getElementById("tatami-bar");
  const content = document.getElementById("fields-content");
  if (!content) return;

  if (state.combats.length === 0) {
    if (bar) bar.innerHTML = "";
    content.innerHTML = emptyState(tr("fields.emptyAll"));
    return;
  }

  const fields = fieldRunningOrder(state.combats);
  const fieldName = (f) => (f.field === "?" ? "—" : t(state.lang, "fields.tatami", { n: f.field }));
  // Optional single-select filter: a matching URL param shows one tatami; otherwise show all.
  const selected = fields.find((f) => String(f.field) === String(currentRoute.param)) || null;

  // Pills: an "All" filter plus one per tatami (only shown when there is more than one tatami).
  if (bar) {
    // Preserve the horizontal scroll position so a live refresh does not jump the bar back.
    const prevScroll = bar.scrollLeft;
    if (fields.length <= 1) {
      bar.innerHTML = "";
    } else {
      const allPill = `<button type="button" class="tatami-pill${selected ? "" : " is-active"}" data-field="" aria-pressed="${!selected}">${esc(t(state.lang, "fields.all"))}</button>`;
      const fieldPills = fields
        .map((f) => {
          const live = f.combats.some((c) => c.status === STATUS.ONGOING);
          const active = selected === f;
          return `<button type="button" class="tatami-pill${active ? " is-active" : ""}" data-field="${esc(f.field)}" aria-pressed="${active}">${live ? '<span class="tatami-pill__live" aria-hidden="true"></span>' : ""}${esc(fieldName(f))}</button>`;
        })
        .join("");
      bar.innerHTML = allPill + fieldPills;
    }
    bar.scrollLeft = prevScroll;
  }

  // Content: the selected tatami only, or every tatami stacked when no filter is active.
  const toShow = selected ? [selected] : fields;
  content.innerHTML = toShow
    .map((f) => {
      const cards = f.combats
        .map((c) => {
          const ribbon = c.isCurrent ? "current" : c.isNext ? "next" : null;
          return combatCard(c, { showField: false, ribbon });
        })
        .join("");
      return `
        <div class="field-block">
          <h2 class="field-block__title">${esc(fieldName(f))}</h2>
          <div class="combat-list">${cards || emptyState(tr("fields.empty"))}</div>
        </div>`;
    })
    .join("");

  updateTatamiFade();
}

// ---------------- view: Combats by group ----------------

function renderGroups(view, param) {
  if (state.groups.length === 0) {
    view.innerHTML = `<section class="page"><h1 class="page__title">${tr("groups.title")}</h1>${emptyState(tr("groups.empty"))}</section>`;
    return;
  }

  const selected = state.groupsById.has(param) ? param : state.groups[0].groupId;
  const options = state.groups
    .map(
      (g) =>
        `<option value="${esc(g.groupId)}" ${g.groupId === selected ? "selected" : ""}>${esc(g.groupId)} · ${esc(groupLabel(g))}</option>`
    )
    .join("");

  view.innerHTML = `
    <section class="page">
      <h1 class="page__title">${tr("groups.title")}</h1>
      <div class="group-picker">
        <label for="group-select">${tr("groups.select")}</label>
        <select id="group-select" class="select">${options}</select>
      </div>
      <div id="group-content"></div>
    </section>`;

  const select = document.getElementById("group-select");
  select.addEventListener("change", () => {
    // Swap only the group content in place: keep the URL in sync without firing a full
    // re-render (which would rebuild the <select> and jump the scroll to the top).
    const id = select.value;
    history.replaceState(null, "", "#/groups/" + id);
    currentRoute.param = id;
    fillGroup(id);
  });

  fillGroup(selected);
}

function fillGroup(groupId) {
  const container = document.getElementById("group-content");
  if (!container) return;
  const group = state.groupsById.get(groupId);
  const groupPlayers = state.players.filter((p) => p.groupId === groupId);

  if (groupPlayers.length === 0) {
    container.innerHTML = emptyState(tr("groups.empty"));
    return;
  }

  const standings = standingsForGroup(state.players, state.combats, groupId);
  const anyFinished = standings.some((r) => r.played > 0);

  container.innerHTML = `
    <p class="group-classification">${esc(groupLabel(group))}</p>
    <div class="card">
      <h2 class="card__title">${tr("groups.standings")}</h2>
      ${anyFinished ? "" : `<p class="note">${tr("groups.noFinished")}</p>`}
      ${standingsTable(standings)}
    </div>
    <div class="card">
      <h2 class="card__title">${tr("groups.matrix")}</h2>
      ${crossTableHtml(groupId)}
    </div>`;
}

function standingsTable(rows) {
  // Abbreviated columns wrap the short label in <abbr> carrying the full term, so screen readers
  // and touch users (no hover for title) still get the expansion.
  const abbr = (shortKey, fullKey) =>
    `<abbr title="${tr(fullKey)}">${tr(shortKey)}</abbr>`;
  const head = `
    <tr>
      <th class="num" scope="col">${tr("standings.pos")}</th>
      <th class="left" scope="col">${tr("standings.athlete")}</th>
      <th class="num" scope="col">${abbr("standings.played", "standings.playedFull")}</th>
      <th class="num" scope="col">${abbr("standings.won", "standings.wonFull")}</th>
      <th class="num" scope="col">${abbr("standings.drawn", "standings.drawnFull")}</th>
      <th class="num" scope="col">${abbr("standings.lost", "standings.lostFull")}</th>
      <th class="num" scope="col">${abbr("standings.pointsFor", "standings.pointsForFull")}</th>
      <th class="num" scope="col">${abbr("standings.pointsAgainst", "standings.pointsAgainstFull")}</th>
      <th class="num" scope="col">${tr("standings.diff")}</th>
      <th class="num strong" scope="col">${tr("standings.points")}</th>
    </tr>`;
  const body = rows
    .map((r) => {
      const diff = r.diff > 0 ? "+" + r.diff : r.diff;
      return `
      <tr>
        <td class="num">${r.rank}</td>
        <td class="left"><a href="#/athletes/${esc(r.playerId)}">${esc(playerName(r.playerId))}</a></td>
        <td class="num">${r.played}</td>
        <td class="num">${r.won}</td>
        <td class="num">${r.drawn}</td>
        <td class="num">${r.lost}</td>
        <td class="num">${r.pointsFor}</td>
        <td class="num">${r.pointsAgainst}</td>
        <td class="num">${diff}</td>
        <td class="num strong">${r.leaguePoints}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-scroll"><table class="standings"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

function crossTableHtml(groupId) {
  const ct = crossTable(state.players, state.combats, groupId);
  const labels = matrixLabels(ct.players);
  // Corner doubles as a colour-blind key: the score reads "column-fighter – row-fighter",
  // so "Col" (red) and "Row" (blue) mirror the two numbers and their colours in each cell.
  const cornerKey = `<span class="matrix__axis--red">${tr("groups.matrixCol")}</span> - <span class="matrix__axis--blue">${tr("groups.matrixRow")}</span>`;
  const corner = `<th class="matrix__corner" scope="col" title="${esc(t(state.lang, "groups.matrixKeyHint"))}">${cornerKey}</th>`;
  const headCols = ct.players
    .map((p) => `<th class="matrix__col" scope="col"><a href="#/athletes/${esc(p.playerId)}">${esc(labels.get(p.playerId))}</a></th>`)
    .join("");
  const head = `<tr>${corner}${headCols}</tr>`;

  const body = ct.rows
    .map((row) => {
      const rowHeader = `<th class="matrix__row" scope="row"><a href="#/athletes/${esc(row.blue.playerId)}">${esc(labels.get(row.blue.playerId))}</a></th>`;
      const cells = row.cells
        .map((cell) => {
          if (cell.diagonal) return `<td class="matrix__cell matrix__cell--diag"></td>`;
          if (cell.combats.length === 0) return `<td class="matrix__cell"></td>`;
          const inner = cell.combats
            .map((c) => {
              const cls = `matrix__result status-${c.status.toLowerCase()}`;
              if (c.result) {
                const [r, b] = c.result.split("-");
                return `<span class="${cls}"><span class="matrix__rn--red">${esc(r)}</span>-<span class="matrix__rn--blue">${esc(b)}</span></span>`;
              }
              return `<span class="${cls}">${esc(translateToken(state.lang, "status", c.status))}</span>`;
            })
            .join("");
          return `<td class="matrix__cell">${inner}</td>`;
        })
        .join("");
      return `<tr>${rowHeader}${cells}</tr>`;
    })
    .join("");

  return `<div class="table-scroll"><table class="matrix"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

// ---------------- view: Athletes (search + profile) ----------------

function renderAthletes(view, param) {
  if (param) {
    renderAthleteProfile(view, param);
    return;
  }
  view.innerHTML = `
    <section class="page">
      <h1 class="page__title">${tr("athlete.title")}</h1>
      <input type="search" id="athlete-search" class="search-input" placeholder="${esc(t(state.lang, "athlete.search"))}" value="${esc(state.searchQuery)}" autocomplete="off" />
      <div id="athlete-results"></div>
    </section>`;

  const input = document.getElementById("athlete-search");
  input.addEventListener("input", () => {
    state.searchQuery = input.value;
    fillAthleteResults();
  });
  fillAthleteResults();
}

function fillAthleteResults() {
  const container = document.getElementById("athlete-results");
  if (!container) return;
  const query = state.searchQuery.trim();
  if (query === "") {
    container.innerHTML = emptyState(tr("athlete.searchHint"));
    return;
  }
  const results = searchPlayers(state.players, query);
  if (results.length === 0) {
    container.innerHTML = emptyState(tr("athlete.noResults"));
    return;
  }
  container.innerHTML = `<ul class="result-list">${results
    .map((p) => {
      const group = state.groupsById.get(p.groupId);
      return `<li>
        <a class="result-item" href="#/athletes/${esc(p.playerId)}">
          <span class="result-item__name">${esc(p.fullName)}</span>
          <span class="result-item__meta">${esc(p.playerId)}${p.club ? " · " + esc(p.club) : ""}${group ? " · " + esc(groupLabel(group)) : ""}</span>
        </a>
      </li>`;
    })
    .join("")}</ul>`;
}

function renderAthleteProfile(view, playerId) {
  view.innerHTML = `
    <section class="page">
      <a class="back-link" href="#/athletes">${tr("athlete.title")}</a>
      <div id="athlete-profile"></div>
    </section>`;
  fillAthleteProfile(playerId);
}

function fillAthleteProfile(playerId) {
  const container = document.getElementById("athlete-profile");
  if (!container) return;
  const info = athleteSummary(playerId, state.players, state.combats);
  if (!info) {
    container.innerHTML = emptyState(tr("athlete.noResults"));
    return;
  }
  const { player, standing, groupSize } = info;
  const group = state.groupsById.get(player.groupId);
  const fixtures = athleteFixtures(playerId, state.combats);
  const diff = standing.diff > 0 ? "+" + standing.diff : standing.diff;

  // Group card: full stats when the athlete is in a drawn group; a "not drawn yet" note otherwise
  // (avoids a misleading rank and a dead link to a non-existent group).
  const groupCard =
    info.hasGroup && group
      ? `
    <div class="card profile__group">
      <div class="profile__group-info">
        <span class="profile__group-label">${tr("athlete.group")}</span>
        <a class="profile__group-link" href="#/groups/${esc(player.groupId)}" aria-label="${esc(t(state.lang, "athlete.viewGroup"))}">${esc(player.groupId)} · ${esc(groupLabel(group))}</a>
      </div>
      <div class="profile__stats">
        <div class="pstat"><span class="pstat__value">${standing.rank}/${groupSize}</span><span class="pstat__label">${tr("athlete.rank")}</span></div>
        <div class="pstat"><span class="pstat__value">${standing.won}-${standing.drawn}-${standing.lost}</span><span class="pstat__label">${tr("athlete.record")}</span></div>
        <div class="pstat"><span class="pstat__value">${standing.pointsFor}/${standing.pointsAgainst}</span><span class="pstat__label">${tr("standings.pointsFor")}/${tr("standings.pointsAgainst")}</span></div>
        <div class="pstat"><span class="pstat__value">${esc(diff)}</span><span class="pstat__label">${tr("standings.diff")}</span></div>
        <div class="pstat pstat--strong"><span class="pstat__value">${standing.leaguePoints}</span><span class="pstat__label">${tr("standings.points")}</span></div>
      </div>
    </div>`
      : `
    <div class="card profile__group">
      <span class="profile__group-label">${tr("athlete.group")}</span>
      <p class="note">${tr("athlete.noGroup")}</p>
    </div>`;

  const nextHtml = fixtures.nextCombat
    ? combatCard(fixtures.nextCombat, { showField: true })
    : `<p class="note">${tr("athlete.noNext")}</p>`;

  // The remaining upcoming combats, after the one already shown as "Next combat".
  const upcomingExtra = fixtures.upcoming.filter((c) => c !== fixtures.nextCombat);
  const upcomingHtml = upcomingExtra.length
    ? `<div class="card">
      <h2 class="card__title">${tr("athlete.upcomingCombats")}</h2>
      <div class="combat-list">${upcomingExtra.map((c) => combatCard(c, { showField: true })).join("")}</div>
    </div>`
    : "";

  const pastHtml = fixtures.past.length
    ? fixtures.past.map((c) => athletePastRow(c, playerId)).join("")
    : `<p class="note">${tr("athlete.noPast")}</p>`;

  // Cancelled combats: only shown when this athlete actually has any.
  const cancelledHtml = fixtures.cancelled.length
    ? `<div class="card">
      <h2 class="card__title">${tr("athlete.cancelledCombats")}</h2>
      <div class="combat-list">${fixtures.cancelled.map((c) => combatCard(c, { showField: true })).join("")}</div>
    </div>`
    : "";

  container.innerHTML = `
    <header class="profile__head">
      <h1 class="profile__name">${esc(player.fullName)}</h1>
      <p class="profile__meta">${esc(player.playerId)}${player.club ? " · " + esc(player.club) : ""}</p>
    </header>
    ${groupCard}

    <div class="card">
      <h2 class="card__title">${tr("athlete.nextCombat")}</h2>
      ${nextHtml}
    </div>

    ${upcomingHtml}

    <div class="card">
      <h2 class="card__title">${tr("athlete.pastCombats")}</h2>
      <div class="combat-list">${pastHtml}</div>
    </div>

    ${cancelledHtml}`;
}

// A compact past-combat row from this athlete's perspective (won/lost/drawn + opponent link).
function athletePastRow(combat, playerId) {
  const mySide = sideOf(combat, playerId);
  const s = combatScore(combat);
  const myLp = mySide === "Red" ? s.redLeaguePoints : s.blueLeaguePoints;
  const outcomeKey = myLp === 3 ? "won" : myLp === 1 ? "drawn" : "lost";
  const oppId = opponentId(combat, playerId);
  const myRounds = mySide === "Red" ? s.redRoundsWon : s.blueRoundsWon;
  const oppRounds = mySide === "Red" ? s.blueRoundsWon : s.redRoundsWon;
  return `
    <div class="past-row outcome-${outcomeKey}">
      <span class="past-row__outcome">${tr("athlete.result." + outcomeKey)}</span>
      <span class="past-row__score">${myRounds}-${oppRounds}</span>
      <span class="past-row__vs">${tr("combat.vs")}</span>
      <a class="past-row__opp" href="#/athletes/${esc(oppId)}">${esc(playerName(oppId))}</a>
    </div>`;
}

// ---------------- shared empty state ----------------

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

// ---------------- router ----------------

function parseHash() {
  const raw = (location.hash || "").replace(/^#\/?/, "");
  const segments = raw.split("/").filter(Boolean).map(decodeURIComponent);
  const name = segments[0] || "home";
  const known = ["home", "fields", "groups", "athletes"];
  return {
    name: known.includes(name) ? name : "home",
    param: segments[1] || null,
  };
}

function renderRoute() {
  currentRoute = parseHash();
  const view = document.getElementById("view");
  if (currentRoute.name === "fields") renderFields(view);
  else if (currentRoute.name === "groups") renderGroups(view, currentRoute.param);
  else if (currentRoute.name === "athletes") renderAthletes(view, currentRoute.param);
  else renderHome(view);
  updateNavActive();
  document.body.classList.toggle("is-home", currentRoute.name === "home");
  // Scroll to top only when the route actually changes (new view or opened profile), not on an
  // in-place update like switching the group dropdown.
  const key = currentRoute.name + "/" + (currentRoute.param || "");
  if (key !== lastRouteKey) window.scrollTo({ top: 0, behavior: "auto" });
  lastRouteKey = key;
}

// Re-render only the live (combats-driven) region of the current view, without rebuilding
// inputs or moving the scroll position. Called after a poll detects changed data.
function refreshLiveRegions() {
  if (currentRoute.name === "fields") fillFields();
  else if (currentRoute.name === "groups") {
    const groupId = state.groupsById.has(currentRoute.param) ? currentRoute.param : (state.groups[0] && state.groups[0].groupId);
    if (groupId) fillGroup(groupId);
  } else if (currentRoute.name === "athletes" && currentRoute.param) fillAthleteProfile(currentRoute.param);
  else if (currentRoute.name === "athletes") fillAthleteResults();
}

// ---------------- polling ----------------

function combatsSignature(combats) {
  // Cheap change-detection key: only re-render when combat data actually changes.
  return combats
    .map((c) => `${c.redId}|${c.blueId}|${c.field}|${c.combat}|${c.status}|${c.rounds.map((r) => `${r.red},${r.blue},${r.winner}`).join(";")}`)
    .join("||");
}

async function refreshCombats() {
  state.refreshing = true;
  updateStatus(); // dot turns white while the fetch is in flight
  try {
    const combats = await loadCombats();
    state.loadError = false;
    state.lastUpdated = Date.now();
    const signature = combatsSignature(combats);
    if (signature !== state.combatsSignature) {
      state.combats = combats;
      state.combatsSignature = signature;
      refreshLiveRegions();
    }
  } catch (err) {
    // Keep the last good data; just flag the error and retry on the next cycle.
    console.warn("Liga UNDER: combats refresh failed, keeping last data.", err);
    state.loadError = true;
  }
  state.refreshing = false;
  updateStatus();
}

function startPolling() {
  stopPolling();
  if (usingMockData()) return; // mock data never changes; no need to poll
  pollTimer = setInterval(() => {
    if (!document.hidden) refreshCombats();
  }, CONFIG.pollIntervalMs);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopPolling();
  } else {
    if (!usingMockData()) refreshCombats(); // catch up immediately on return (live mode only)
    startPolling();
  }
}

// ---------------- boot ----------------

function rebuildIndexes() {
  state.playersById = new Map(state.players.map((p) => [p.playerId, p]));
  state.groupsById = new Map(state.groups.map((g) => [g.groupId, g]));
}

function initialLanguage() {
  let stored = null;
  try {
    stored = localStorage.getItem(LANG_STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
  if (stored && CONFIG.supportedLanguages.includes(stored)) return stored;
  return detectLanguage(navigator.languages || [navigator.language], CONFIG.supportedLanguages, CONFIG.defaultLanguage);
}

// Measure the sticky header and expose its height so the Home hero can fill the screen below it.
function setHeaderHeight() {
  const header = document.querySelector(".app-header");
  if (header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
}

function wireShell() {
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.getAttribute("data-lang")));
  });
  window.addEventListener("hashchange", renderRoute);
  window.addEventListener("resize", updateTatamiFade);
  window.addEventListener("resize", setHeaderHeight);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  setHeaderHeight();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setHeaderHeight);

  const statusPill = document.getElementById("status-pill");
  if (statusPill) statusPill.addEventListener("click", showStatusDetail);

  // 1-second tick: keeps the Home countdown fresh.
  tickTimer = setInterval(() => {
    if (currentRoute.name === "home") fillCountdown();
  }, 1000);
}

async function boot() {
  state.lang = initialLanguage();
  state.usingMock = usingMockData();
  applyStaticI18n();
  updateLangButtons();
  updateStatus();
  wireShell();

  // replaceState (not assigning location.hash) so no early hashchange fires a render against
  // empty data; the explicit renderRoute() below is the single first paint.
  if (!location.hash) history.replaceState(null, "", "#/home");

  try {
    const { players, groups } = await loadStaticData();
    state.players = players;
    state.groups = groups;
    rebuildIndexes();
  } catch (err) {
    console.error("Liga UNDER: failed to load static data.", err);
    state.loadError = true;
    updateStatus();
  }

  await refreshCombats();
  renderRoute();
  startPolling();
}

boot();
