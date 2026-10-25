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

/* ---------- Step 1: the app picker ---------- */
const picker = document.querySelector("[data-picker]");
if (picker) {
  const subs = new Set();
  const result = picker.querySelector(".picker-result");
  const tags = { best: picker.dataset.labelBest, other: picker.dataset.labelOther, use: picker.dataset.labelUse, chosen: picker.dataset.labelChosen, yours: picker.dataset.labelYours };

  const card = (app, kind) => {
    const info = document.querySelector(`.app-info[data-app="${app}"]`);
    const element = document.createElement("div");
    element.className = `app-card${kind === "other" ? "" : " is-best"}${state.app === app ? " is-chosen" : ""}`;
    const tag = { best: tags.best, other: tags.other, yours: tags.yours }[kind];
    element.innerHTML = `<span class="app-tag">${tag}</span>${info.innerHTML}`;
    const use = document.createElement("button");
    use.type = "button";
    use.className = "use-app";
    use.textContent = state.app === app ? tags.chosen : tags.use;
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
    for (const warning of picker.querySelectorAll("[data-warning]")) warning.hidden = !advice?.warnings.includes(warning.dataset.warning);
    result.replaceChildren();
    if (advice) {
      result.append(card(advice.best, "best"), ...advice.alternatives.map((app) => card(app, "other")));
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
function setIconLabel(button, icon, label) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "btn-icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${icon}`);
  svg.append(use);
  button.replaceChildren(svg, label);
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
    const button = (label) => {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = label;
      bar.append(element);
      return element;
    };
    const prev = button(animLabels.prev);
    const toggle = button(animLabels.pause);
    const next = button(animLabels.next);
    svg.after(bar);

    let finished = false;
    const watchEnd = () => {
      if (!playing) return;
      if (now() >= end) {
        seek(end);
        playing = false;
        finished = true;
        held = true;
        toggle.textContent = animLabels.again;
      } else requestAnimationFrame(watchEnd);
    };
    const play = () => {
      if (finished) seek(0);
      finished = false;
      for (const animation of animations()) animation.play();
      playing = true;
      toggle.textContent = animLabels.pause;
      requestAnimationFrame(watchEnd);
    };
    const pause = () => {
      seek(now());
      playing = false;
      finished = false;
      toggle.textContent = animLabels.play;
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
        toggle.textContent = animLabels.again;
      } else seek(target);
    });

    seek(0);
    toggle.textContent = animLabels.play;
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
