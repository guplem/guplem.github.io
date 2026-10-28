// The tutorial's extras, for both language versions of the post. None of
// this is content: without it, every app, example and step is already text in
// the page (blog/AGENTS.md, root ADR 0015). With it, the page shows the
// reader's own path: their app and their example, their progress in the
// contents list, a box for each key term, a folder explorer and a folder
// check. The decisions live in agentCore.js, which Bun tests; this file is
// only DOM glue. Every sentence it shows is read from the page, so it holds
// no language of its own.

import { APPS, EXAMPLE_IDS, animationEnd, animationSteps, checkFolder, folderAt, readState, recommendApps, stepAfter, stepBefore, writeQuery } from "./agentCore.js";

const root = document.documentElement;
const body = document.body;
const exampleParam = body.dataset.exampleParam || "ejemplo";
const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Private windows and blocked storage: the page works without memory.
    }
  },
};

body.classList.add("js-ready");

/* ---------- Theme: system, light or dark ---------- */
const themeButtons = [...document.querySelectorAll("[data-theme-choice]")];
function applyTheme(choice) {
  if (choice === "light" || choice === "dark") root.dataset.theme = choice;
  else delete root.dataset.theme;
  for (const button of themeButtons) button.setAttribute("aria-pressed", String(button.dataset.themeChoice === choice));
  try {
    if (choice === "system") localStorage.removeItem("agent-tutorial-theme");
    else localStorage.setItem("agent-tutorial-theme", choice);
  } catch (error) {
    // The choice simply lasts for this visit.
  }
}
applyTheme(root.dataset.theme || "system");
for (const button of themeButtons) button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));

/* ---------- The reader's path: app and example ---------- */
const fromAddress = readState(location.search);
const saved = store.get("agent-tutorial-path", {});
const state = {
  app: fromAddress.app ?? (APPS[saved.app] ? saved.app : null),
  example: fromAddress.example ?? (EXAMPLE_IDS.includes(saved.example) ? saved.example : null),
};

const exampleButtons = [...document.querySelectorAll("button.choice[data-example]")];
const exampleName = (id) => exampleButtons.find((button) => button.dataset.example === id)?.querySelector("b")?.textContent ?? id;
const appName = (id) => document.querySelector(`.app-info[data-app="${id}"] .app-name b`)?.textContent ?? id;
const langLink = document.querySelector(".lang-link");
const langBase = langLink?.getAttribute("href");

function showPath() {
  const example = state.example ?? EXAMPLE_IDS[0];
  // toggleAttribute, not .hidden: the drawings' variants are SVG elements, which have no .hidden property.
  for (const block of document.querySelectorAll(".variant[data-example]")) block.toggleAttribute("hidden", block.dataset.example !== example);
  for (const button of exampleButtons) button.setAttribute("aria-pressed", String(button.dataset.example === state.example));
  const folder = document.querySelector(`.variant[data-example="${example}"] code`)?.textContent;
  for (const slot of document.querySelectorAll("[data-folder-name]")) if (folder) slot.textContent = folder;

  // Until the reader picks an app, every app's variant shows, with its name.
  for (const block of document.querySelectorAll(".variant[data-app]:not(.app-info)")) {
    block.hidden = Boolean(state.app) && block.dataset.app !== state.app;
    block.querySelector(".variant-label")?.classList.toggle("keep", !state.app);
  }
  const skillsDir = state.app ? `${APPS[state.app].skillsDir}/` : null;
  for (const slot of document.querySelectorAll("[data-skills-dir]")) if (skillsDir) slot.textContent = skillsDir;

  const exampleState = document.querySelector('[data-state="example"]');
  if (exampleState) exampleState.textContent = state.example ? exampleName(state.example) : "";
  const appState = document.querySelector('[data-state="app"]');
  if (appState) appState.textContent = state.app ? appName(state.app) : "";

  const query = writeQuery(state, exampleParam);
  history.replaceState(null, "", `${location.pathname}${query}${location.hash}`);
  if (langLink && langBase) langLink.setAttribute("href", `${langBase}${query}`);
  store.set("agent-tutorial-path", state);
}

for (const button of exampleButtons) {
  button.addEventListener("click", () => {
    state.example = button.dataset.example;
    showPath();
  });
}

/* ---------- Help dialogs ----------
   A button with commandfor opens or closes its <dialog> with no script in
   current browsers. This covers the browsers that do not know the attribute yet. */
if (!("command" in HTMLButtonElement.prototype)) {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[commandfor]");
    const dialog = button && document.getElementById(button.getAttribute("commandfor"));
    if (!(dialog instanceof HTMLDialogElement)) return;
    if (button.getAttribute("command") === "show-modal") dialog.showModal();
    else if (button.getAttribute("command") === "close") dialog.close();
  });
}
// A click on the dark area around a dialog closes it, also where closedby="any" is not known.
for (const dialog of document.querySelectorAll("dialog.help-dialog")) {
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    // The dialog's own padding is also the dialog: close only outside its box.
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  });
}

/* ---------- Step 1: the app picker ---------- */
const picker = document.querySelector("[data-picker]");
if (picker) {
  const subs = new Set();
  const result = picker.querySelector(".picker-result");
  const tags = { best: picker.dataset.labelBest, other: picker.dataset.labelOther, use: picker.dataset.labelUse, chosen: picker.dataset.labelChosen, yours: picker.dataset.labelYours };

  // A warning with data-app belongs to that app: it shows inside the app's card.
  const card = (app, kind, warnings = []) => {
    const info = document.querySelector(`.app-info[data-app="${app}"]`);
    const element = document.createElement("div");
    element.className = `app-card${kind === "other" ? "" : " is-best"}${state.app === app ? " is-chosen" : ""}`;
    const tag = { best: tags.best, other: tags.other, yours: tags.yours }[kind];
    element.innerHTML = `<span class="app-tag">${tag}</span>${info.innerHTML}`;
    for (const warning of picker.querySelectorAll(`[data-warning][data-app="${app}"]`)) {
      if (!warnings.includes(warning.dataset.warning)) continue;
      const copy = warning.cloneNode(true);
      copy.hidden = false;
      element.append(copy);
    }
    const use = document.createElement("button");
    use.type = "button";
    use.className = "use-app";
    if (state.app === app) setIconLabel(use, "ico-check", tags.chosen);
    else use.textContent = tags.use;
    use.addEventListener("click", () => {
      state.app = app;
      showPath();
      renderPicker();
    });
    element.append(use);
    return element;
  };

  function renderPicker() {
    const advice = recommendApps([...subs]);
    // The Goose help dialog highlights the rows for what the reader ticked.
    for (const row of document.querySelectorAll(".help-steps [data-sub]")) row.classList.toggle("is-yours", subs.has(row.dataset.sub));
    for (const warning of picker.querySelectorAll("[data-warning]:not([data-app])")) warning.hidden = !advice?.warnings.includes(warning.dataset.warning);
    result.replaceChildren();
    if (advice) {
      result.append(card(advice.best, "best", advice.warnings), ...advice.alternatives.map((app) => card(app, "other", advice.warnings)));
    } else if (state.app) {
      // Nothing ticked: no recommendation, only the app the reader chose before.
      result.append(card(state.app, "yours"));
    }
  }

  for (const chip of picker.querySelectorAll("[data-sub]")) {
    chip.addEventListener("click", () => {
      const id = chip.dataset.sub;
      if (id === "none") {
        const wasOn = subs.has("none");
        subs.clear();
        if (!wasOn) subs.add("none");
      } else {
        subs.delete("none");
        if (subs.has(id)) subs.delete(id);
        else subs.add(id);
      }
      for (const other of picker.querySelectorAll("[data-sub]")) other.setAttribute("aria-pressed", String(subs.has(other.dataset.sub)));
      const advice = recommendApps([...subs]);
      if (advice) {
        state.app = advice.best;
        showPath();
      }
      renderPicker();
    });
  }
  renderPicker();
}

showPath();

/* ---------- Steps done, ticked in the contents list ---------- */
const done = new Set(store.get("agent-tutorial-done", []));
function showDone() {
  for (const box of document.querySelectorAll("input[data-done]")) box.checked = done.has(box.dataset.done);
  for (const link of document.querySelectorAll("[data-step-link]")) link.classList.toggle("is-done", done.has(link.dataset.stepLink));
}
for (const box of document.querySelectorAll("input[data-done]")) {
  box.addEventListener("change", () => {
    if (box.checked) done.add(box.dataset.done);
    else done.delete(box.dataset.done);
    store.set("agent-tutorial-done", [...done]);
    showDone();
  });
}
showDone();

/* ---------- Key terms: the glossary line in a box, and the related terms lit ---------- */
const tip = document.createElement("div");
tip.className = "term-tip";
tip.setAttribute("role", "tooltip");
tip.hidden = true;
body.append(tip);
const relatedLabel = document.querySelector(".glossary")?.dataset.relatedLabel ?? "";
let activeTerm = null;

function showTerm(term) {
  const id = term.getAttribute("href").slice(1);
  const title = document.getElementById(id);
  const line = title?.nextElementSibling;
  if (!line) return;
  hideTerm();
  activeTerm = term;
  const related = (line.dataset.related ?? "").split(/\s+/).filter(Boolean);
  for (const other of document.querySelectorAll("a.term")) {
    const otherId = other.getAttribute("href").slice(1);
    other.classList.toggle("is-on", otherId === id);
    other.classList.toggle("is-related", related.includes(otherId));
  }
  term.closest("p, li")?.classList.add("is-dimmed");
  const names = related.map((one) => document.getElementById(one)?.textContent).filter(Boolean);
  tip.innerHTML = `<b></b><span></span>${names.length ? `<span class="term-tip-related"></span>` : ""}`;
  tip.querySelector("b").textContent = title.textContent;
  tip.querySelector("span").textContent = line.textContent;
  if (names.length) tip.querySelector(".term-tip-related").textContent = `${relatedLabel} ${names.join(", ")}`;
  tip.hidden = false;
  const box = term.getBoundingClientRect();
  const left = Math.min(Math.max(16, box.left + box.width / 2 - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 16);
  const top = box.top - tip.offsetHeight - 10 < 10 ? box.bottom + 10 : box.top - tip.offsetHeight - 10;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function hideTerm() {
  if (!activeTerm) return;
  for (const other of document.querySelectorAll("a.term.is-on, a.term.is-related")) other.classList.remove("is-on", "is-related");
  document.querySelector(".is-dimmed")?.classList.remove("is-dimmed");
  tip.hidden = true;
  activeTerm = null;
}

for (const term of document.querySelectorAll("a.term")) {
  term.addEventListener("mouseenter", () => showTerm(term));
  term.addEventListener("mouseleave", hideTerm);
  term.addEventListener("focus", () => showTerm(term));
  term.addEventListener("blur", hideTerm);
  // On a touch screen the first tap shows the box; a second tap follows the link to the glossary.
  term.addEventListener("click", (event) => {
    if (event.pointerType === "touch" && activeTerm !== term) {
      event.preventDefault();
      showTerm(term);
    }
  });
}
addEventListener("scroll", hideTerm, { passive: true });

/* ---------- Copy buttons ---------- */
// A button shows an icon from the page's hidden SVG symbols, then its label.
function setIconLabel(button, icon, label, after = false) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", after ? "btn-icon is-after" : "btn-icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${icon}`);
  svg.append(use);
  if (after) button.replaceChildren(label, svg);
  else button.replaceChildren(svg, label);
}
const copyLabel = body.dataset.copyLabel ?? "Copy";
const copiedLabel = body.dataset.copiedLabel ?? "Copied";
for (const block of document.querySelectorAll(".codeblock")) {
  const pre = block.querySelector("pre");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-button";
  setIconLabel(button, "ico-copy", copyLabel);
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent);
      setIconLabel(button, "ico-check", copiedLabel);
      setTimeout(() => setIconLabel(button, "ico-copy", copyLabel), 1600);
    } catch (error) {
      const range = document.createRange();
      range.selectNodeContents(pre);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }
  });
  block.append(button);

  // A long message starts folded to its first lines; the button unfolds it.
  if (block.classList.contains("is-collapsible")) {
    block.classList.add("is-folded");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "fold-button";
    const label = () => setIconLabel(toggle, block.classList.contains("is-folded") ? "ico-chevron-down" : "ico-chevron-up", block.classList.contains("is-folded") ? body.dataset.moreLabel : body.dataset.lessLabel);
    label();
    toggle.addEventListener("click", () => {
      block.classList.toggle("is-folded");
      label();
    });
    block.append(toggle);
  }
}

/* ---------- The folder explorer ---------- */
// The folder grows step by step: the explorer in step 2 shows only what the
// reader has made so far, and each later step ends with a copy of it that
// shows the folder at that point, with what the step made or filled marked.
const masterExplorer = document.querySelector("[data-explorer][data-folder-step]");
if (masterExplorer) {
  const pristine = masterExplorer.cloneNode(true);
  const badges = { fresh: body.dataset.badgeNew, changed: body.dataset.badgeChanged };
  const showFolder = (explorer, step) => {
    const at = folderAt(step);
    if (!at) return;
    for (const item of explorer.querySelectorAll(".tree-item")) {
      const part = item.dataset.part;
      item.hidden = !at.parts.includes(part);
      const mark = at.fresh.includes(part) ? "fresh" : at.changed.includes(part) ? "changed" : null;
      if (!mark) continue;
      const badge = document.createElement("span");
      badge.className = `tree-badge is-${mark}`;
      badge.textContent = badges[mark];
      item.append(badge);
      item.dataset.marked = "";
    }
  };
  for (const slot of document.querySelectorAll(".folder-now[data-folder-step]")) {
    const copy = pristine.cloneNode(true);
    slot.append(copy);
    showFolder(copy, slot.dataset.folderStep);
  }
  showFolder(masterExplorer, masterExplorer.dataset.folderStep);

  // Step 5 lists the files the agent makes in datos/ for each example. The
  // list stays in the page as text; the script shows it as an explorer of
  // datos/, each file marked new, with its job in the side pane.
  const fileIcon = pristine.querySelector('[data-part="agents"] svg');
  const folderIcon = pristine.querySelector('[data-part="data"] svg');
  for (const list of document.querySelectorAll("ul.data-files")) {
    const explorer = document.createElement("div");
    explorer.className = "explorer data-explorer";
    explorer.setAttribute("data-explorer", "");
    const head = pristine.querySelector(".explorer-head").cloneNode(true);
    head.querySelector("span").append(` › ${list.querySelector(".part").textContent.trim().split("/")[0]}`);
    const bodyPane = document.createElement("div");
    bodyPane.className = "explorer-body";
    const tree = document.createElement("ul");
    tree.className = "tree";
    for (const entry of list.children) {
      const path = entry.querySelector(".part").textContent.trim();
      const job = entry.cloneNode(true);
      job.querySelector(".part").remove();
      const item = document.createElement("li");
      item.className = "tree-item";
      item.style.setProperty("--c", "var(--f-data)");
      item.dataset.marked = "";
      const name = document.createElement("span");
      name.className = "tree-name";
      name.textContent = path.replace(/^[^/]+\//, "");
      const desc = document.createElement("span");
      desc.className = "tree-desc";
      desc.innerHTML = job.innerHTML.replace(/^\s*:\s*/, "");
      const who = document.createElement("span");
      who.className = "tree-who";
      const badge = document.createElement("span");
      badge.className = "tree-badge is-fresh";
      badge.textContent = badges.fresh;
      item.append((path.endsWith("/") ? folderIcon : fileIcon).cloneNode(true), name, desc, who, badge);
      tree.append(item);
    }
    const detail = document.createElement("div");
    detail.className = "explorer-detail";
    bodyPane.append(tree, detail);
    explorer.append(head, bodyPane);
    list.hidden = true;
    list.after(explorer);
  }
}

for (const explorer of document.querySelectorAll("[data-explorer]")) {
  const items = [...explorer.querySelectorAll(".tree-item")];
  const detail = explorer.querySelector(".explorer-detail");
  explorer.classList.add("is-interactive");
  const select = (item) => {
    for (const other of items) other.setAttribute("aria-selected", String(other === item));
    detail.style.setProperty("--c", item.style.getPropertyValue("--c"));
    // The selected row already names the part, so the pane holds its job and who uses it.
    const desc = document.createElement("p");
    desc.innerHTML = item.querySelector(".tree-desc").innerHTML;
    detail.replaceChildren(desc, item.querySelector(".tree-who").cloneNode(true));
  };
  explorer.querySelector(".tree").setAttribute("role", "listbox");
  for (const item of items) {
    item.setAttribute("role", "option");
    item.tabIndex = 0;
    item.addEventListener("click", () => select(item));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select(item);
      }
    });
  }
  // Open on what this step made, or else on the first part the folder has.
  select(items.find((item) => !item.hidden && "marked" in item.dataset) ?? items.find((item) => !item.hidden));
}

/* ---------- The folder check ---------- */
const checker = document.querySelector("[data-checker]");
if (checker) {
  const results = checker.querySelector(".checker-results");
  const input = checker.querySelector(".checker-input");
  const messages = Object.fromEntries([...checker.querySelectorAll("[data-msg]")].map((one) => [one.dataset.msg, one.innerHTML]));
  const marks = { ok: "✓", warn: "!", missing: "✕", unknown: "?", optional: "–" };
  const wantsText = (path) => path === "AGENTS.md" || path.endsWith("/SKILL.md");
  const skip = new Set([".git", "node_modules", ".venv", "__pycache__"]);

  const escape = (text) => text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);

  function show(files, seesHiddenFolders) {
    const found = checkFolder(files, { app: state.app, dataDir: checker.dataset.dataDir, exportsDir: checker.dataset.exportsDir, seesHiddenFolders });
    results.replaceChildren(
      ...found.map((one) => {
        const key = one.detail && messages[`${one.id}:${one.status}:detail`] ? `${one.id}:${one.status}:detail` : `${one.id}:${one.status}`;
        const item = document.createElement("li");
        item.innerHTML = `<span class="mark ${one.status}" aria-hidden="true">${marks[one.status]}</span><span>${(messages[key] ?? key).replace("{detail}", escape(one.detail ?? ""))}</span>`;
        return item;
      }),
    );
  }

  async function walk(directory, prefix, files) {
    for await (const [name, handle] of directory.entries()) {
      if (files.length > 3000) return;
      if (skip.has(name)) continue;
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") await walk(handle, path, files);
      else files.push({ path, text: wantsText(path) ? await (await handle.getFile()).text() : undefined });
    }
  }

  checker.querySelector(".checker-button").addEventListener("click", async () => {
    if (window.showDirectoryPicker) {
      try {
        const directory = await window.showDirectoryPicker({ mode: "read" });
        const files = [];
        await walk(directory, "", files);
        show(files, true);
      } catch (error) {
        if (error.name !== "AbortError") input.click();
      }
    } else {
      input.click();
    }
  });

  input.addEventListener("change", async () => {
    const files = await Promise.all(
      [...input.files].map(async (file) => {
        const path = file.webkitRelativePath.split("/").slice(1).join("/");
        return { path, text: wantsText(path) ? await file.text() : undefined };
      }),
    );
    // A folder input may leave out folders that start with a dot (Safari does); if none came through, assume it hid them.
    const seesHiddenFolders = files.some((file) => file.path.split("/").some((part) => part.startsWith(".")));
    show(files.filter((file) => !file.path.split("/").some((part) => skip.has(part))), seesHiddenFolders);
    input.value = "";
  });
}

/* ---------- Drawings: start when seen, pause, step ----------
   A drawing waits until the reader can see all of it, then plays. The
   buttons under it pause it and move one step back or forward. It plays
   once and stops on the finished picture, and its play button turns into
   "play again". The steps and the end
   come from the drawing's own CSS (animationSteps, animationEnd), so the CSS stays the one
   place that sets the order. With reduced motion, CSS already shows the
   finished picture, so the drawing gets no buttons. */
const animLabels = { prev: body.dataset.animPrev, pause: body.dataset.animPause, play: body.dataset.animPlay, next: body.dataset.animNext, again: body.dataset.animAgain };
if (animLabels.pause && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  for (const figure of document.querySelectorAll("figure.diagram")) {
    const svg = figure.querySelector("svg");
    const animations = () => svg.getAnimations({ subtree: true });
    if (!svg || animations().length === 0) continue;
    const cycle = animations()[0].effect.getTiming().duration;
    const timings = animations().map((animation) => {
      const { delay, duration } = animation.effect.getTiming();
      const keyframes = animation.effect.getKeyframes().map((frame) => ({ offset: frame.computedOffset, opacity: frame.opacity === undefined ? undefined : Number(frame.opacity) }));
      return { delay, duration, keyframes };
    });
    const steps = animationSteps(timings);
    const end = animationEnd(timings) ?? cycle;
    let playing = false;
    let held = false; // the reader paused it, so scrolling does not restart it
    const now = () => (animations()[0].currentTime ?? 0) % cycle;
    const seek = (time) => {
      for (const animation of animations()) {
        animation.pause();
        animation.currentTime = time;
      }
    };

    const bar = document.createElement("div");
    bar.className = "anim-controls";
    const button = () => {
      const element = document.createElement("button");
      element.type = "button";
      bar.append(element);
      return element;
    };
    const prev = button();
    const toggle = button();
    const next = button();
    setIconLabel(prev, "ico-back", animLabels.prev);
    setIconLabel(next, "ico-forward", animLabels.next, true);
    // The play button shows what a press does: pause, play, or play again.
    const show = (state) => setIconLabel(toggle, { pause: "ico-pause", play: "ico-play", again: "ico-replay" }[state], animLabels[state]);
    svg.after(bar);

    let finished = false;
    const watchEnd = () => {
      if (!playing) return;
      if (now() >= end) {
        seek(end);
        playing = false;
        finished = true;
        held = true;
        show("again");
      } else requestAnimationFrame(watchEnd);
    };
    const play = () => {
      if (finished) seek(0);
      finished = false;
      for (const animation of animations()) animation.play();
      playing = true;
      show("pause");
      requestAnimationFrame(watchEnd);
    };
    const pause = () => {
      seek(now());
      playing = false;
      finished = false;
      show("play");
    };
    toggle.addEventListener("click", () => {
      held = playing;
      if (playing) pause();
      else play();
    });
    prev.addEventListener("click", () => {
      held = true;
      pause();
      seek(stepBefore(steps, now()));
    });
    next.addEventListener("click", () => {
      held = true;
      pause();
      const target = stepAfter(steps, now());
      // Past the last step: show the finished picture, as the end of a play does.
      if (target === 0 && now() > 0) {
        seek(end);
        finished = true;
        show("again");
      } else seek(target);
    });

    seek(0);
    show("play");
    // "Fully seen": the whole drawing, or most of the screen when it is taller.
    new IntersectionObserver(
      ([entry]) => {
        const seen = entry.intersectionRatio > 0.97 || entry.intersectionRect.height > innerHeight * 0.8;
        if (seen && !playing && !held) play();
        else if (!entry.isIntersecting && playing) pause();
      },
      { threshold: [0, 0.25, 0.5, 0.75, 0.98, 1] },
    ).observe(svg);
  }
}

/* ---------- The end of the tutorial: a celebration ----------
   Once every step is ticked and the reader reaches the end of the
   tutorial, the drawing there plays, confetti falls over the page and the
   things an agent can do drift up across it. Above the drawing, the steps
   show as cards that tick, and the drawing stays hidden until all eight
   are ticked. Every word shown is read from the page. */
const finale = document.querySelector("[data-finale]");
if (finale) {
  const stepBoxes = [...document.querySelectorAll('input[data-done^="paso-"]')];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wins = [...document.querySelectorAll("[data-finale] .fx-card-text")].map((item) => item.textContent);
  const colours = ["--teal", "--f-agents", "--f-data", "--f-skills", "--f-scripts", "--f-exports"];

  // The steps, as cards that tick like the example cards. A card toggles
  // its step's own check, so the two always agree.
  const pending = document.createElement("ul");
  pending.className = "choice-grid finale-steps";
  const cards = stepBoxes.map((box) => {
    const link = document.querySelector(`[data-step-link="${box.dataset.done}"]`);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "choice";
    const name = document.createElement("b");
    name.textContent = link?.firstChild?.textContent.trim() ?? box.dataset.done;
    const claim = document.createElement("span");
    claim.textContent = box.closest("label")?.textContent.trim() ?? "";
    card.append(name, claim);
    card.addEventListener("click", () => box.click());
    const item = document.createElement("li");
    item.append(card);
    pending.append(item);
    return card;
  });
  finale.before(pending);
  const replay = document.createElement("button");
  replay.type = "button";
  replay.className = "finale-replay";
  setIconLabel(replay, "ico-replay", finale.dataset.replay);
  finale.append(replay);

  let played = false;
  let seen = false;
  // The confetti is drawn on one canvas, and the chips move with fixed
  // numbers, so the browser can hand them to the graphics card: dozens of
  // separately painted pieces made the page stutter.
  const party = () => {
    const layer = document.createElement("div");
    layer.className = "party";
    layer.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const width = innerWidth;
    const height = innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    layer.append(canvas);
    const style = getComputedStyle(body);
    const paints = colours.map((name) => style.getPropertyValue(name).trim() || "#2a9d8f");
    const pieces = Array.from({ length: 90 }, (_, i) => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 0.4 * width,
      turn: (Math.random() - 0.5) * 8 * Math.PI,
      time: 2600 + Math.random() * 2000,
      delay: Math.random() * 900,
      paint: paints[i % paints.length],
    }));
    const ease = (t) => 1 - (1 - t) ** 2.2;
    const context = canvas.getContext("2d");
    const start = performance.now();
    const frame = (now) => {
      if (!canvas.isConnected) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      let falling = false;
      for (const piece of pieces) {
        const t = (now - start - piece.delay) / piece.time;
        if (t < 0) { falling = true; continue; }
        if (t >= 1) continue;
        falling = true;
        const k = ease(t);
        context.save();
        context.translate(piece.x + piece.drift * k, -16 + k * height * 1.1);
        context.rotate(piece.turn * k);
        context.globalAlpha = 1 - 0.15 * t;
        context.fillStyle = piece.paint;
        context.fillRect(-4.5, -7.5, 9, 15);
        context.restore();
      }
      if (falling) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
    wins.forEach((win, i) => {
      const chip = document.createElement("span");
      chip.className = "win-chip";
      chip.textContent = win;
      chip.style.left = `${4 + Math.random() * 72}vw`;
      chip.style.setProperty("--c", `var(${colours[i % colours.length]})`);
      layer.append(chip);
      const rise = height * 0.85;
      chip.animate(
        [
          { opacity: 0, transform: "translateY(0) scale(0.8)" },
          { opacity: 1, transform: `translateY(${-0.14 * height}px) scale(1)`, offset: 0.12 },
          { opacity: 1, offset: 0.8 },
          { opacity: 0, transform: `translateY(${-rise}px) scale(1)` },
        ],
        { duration: 5500, delay: 800 + i * 450, easing: "ease-out", fill: "both" },
      );
    });
    body.append(layer);
    setTimeout(() => layer.remove(), 9000);
  };
  // Fit each task pill to its text, so a long task never spills out.
  const fitCards = () => {
    finale.querySelectorAll(".fx-card").forEach((card) => {
      const box = card.querySelector(".fx-card-box");
      const text = card.querySelector(".fx-card-text");
      const width = text.getComputedTextLength();
      if (!width) return; // not laid out yet
      const centre = Number(text.getAttribute("x"));
      box.setAttribute("width", Math.ceil(width + 28));
      box.setAttribute("x", Math.floor(centre - width / 2 - 14));
    });
  };
  const celebrate = () => {
    played = true;
    finale.classList.remove("is-playing");
    void finale.offsetWidth; // restart the CSS animations
    finale.classList.add("is-playing");
    if (!reduce) party();
  };
  const render = () => {
    const complete = stepBoxes.every((box) => box.checked);
    finale.classList.toggle("is-complete", complete);
    body.classList.toggle("is-graduated", complete);
    if (complete) fitCards();
    cards.forEach((card, i) => card.setAttribute("aria-pressed", String(stepBoxes[i].checked)));
    if (complete && seen && !played) celebrate();
  };
  for (const box of stepBoxes) box.addEventListener("change", render);
  replay.addEventListener("click", celebrate);
  new IntersectionObserver(
    ([entry]) => {
      seen = entry.isIntersecting;
      if (seen) render();
    },
    { threshold: 0.45 },
  ).observe(finale);
  render();
  document.fonts?.ready.then(() => { if (finale.classList.contains("is-complete")) fitCards(); });
}
