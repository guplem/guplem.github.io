// Guard tests for the interface rules of the main site (the shared skeleton
// pages, not each web-project or blog post). They turn into tests the parts of
// Emil Kowalski's interface skills that a machine can check: a phone never
// keeps a hover look after a tap, no transition animates "all", no keyframe
// or transition moves a layout property, a first screen never changes height while the
// reader scrolls, a form field never makes iOS zoom, and no page blocks zoom.
//
// One escape hatch: a comment holding `interface-rule-exception: <reason>`
// right before a rule or a declaration exempts it. Write the reason.

import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadPosts } from "./blogPosts.js";
import { cardEntranceDelayMs } from "../js/layoutBuilder/cardEntrance.js";
import { entranceDelayMs as playgroundEntranceDelayMs } from "../web-projects/discovery.js";

const repoRoot = join(import.meta.dir, "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const EXCEPTION_MARK = "interface-rule-exception:";

// === A small CSS reader ===

/**
 * Split text on a separator that sits outside parentheses, quotes and comments.
 * @param {string} text
 * @param {string} separator
 * @returns {string[]}
 */
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!quote && text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/**
 * @typedef {{ property: string, value: string, exempt: boolean }} Declaration
 * @typedef {{ selector: string, parents: string[], exempt: boolean, declarations: Declaration[] }} CssRule
 */

/**
 * Read the declarations of one rule body. A comment right before a declaration
 * that holds the exception mark exempts that declaration.
 * @param {string} body
 * @returns {Declaration[]}
 */
function readDeclarations(body) {
  return splitTopLevel(body, ";")
    .map((chunk) => {
      const exempt = chunk.includes(EXCEPTION_MARK);
      const text = chunk.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      const colon = text.indexOf(":");
      if (colon < 0) return null;
      return { property: text.slice(0, colon).trim().toLowerCase(), value: text.slice(colon + 1).trim(), exempt };
    })
    .filter((declaration) => declaration !== null);
}

/**
 * Read a style sheet into flat rules. Each rule keeps the at-rule preludes
 * around it (`@media (hover: hover)`, `@keyframes name`), so a check can ask
 * where a rule lives. Plain CSS only: no nesting outside at-rules.
 * @param {string} css
 * @returns {CssRule[]}
 */
export function readCssRules(css) {
  /** @type {CssRule[]} */
  const rules = [];
  /** @type {string[]} */
  const parents = [];
  let i = 0;
  let pending = "";
  while (i < css.length) {
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      const stop = end < 0 ? css.length : end + 2;
      pending += css.slice(i, stop);
      i = stop;
      continue;
    }
    const char = css[i];
    if (char === "{") {
      const prelude = pending.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      const exempt = pending.includes(EXCEPTION_MARK);
      pending = "";
      if (prelude.startsWith("@")) {
        parents.push(prelude);
        i++;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") depth--;
        j++;
      }
      rules.push({ selector: prelude, parents: [...parents], exempt, declarations: readDeclarations(css.slice(i + 1, j - 1)) });
      i = j;
      continue;
    }
    if (char === "}") {
      parents.pop();
      pending = "";
      i++;
      continue;
    }
    if (char === ";") {
      pending = "";
      i++;
      continue;
    }
    pending += char;
    i++;
  }
  return rules;
}

// === The style sheets the rules cover ===

/**
 * Pull the CSS out of every <style> block of an HTML page.
 * @param {string} html
 * @returns {string}
 */
function inlineStyles(html) {
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");
}

/** @returns {{ name: string, css: string }[]} */
function inScopeStyleSheets() {
  const cssFolder = (folder) =>
    readdirSync(join(repoRoot, folder))
      .filter((file) => file.endsWith(".css"))
      .map((file) => ({ name: `${folder}/${file}`, css: read(`${folder}/${file}`) }));
  const customScroll = read("js/customScroll.js");
  const injected = customScroll.match(/style\.textContent = `([\s\S]*?)`;/);
  return [
    ...cssFolder("css/global"),
    ...cssFolder("css/sections"),
    { name: "blog/blog.css", css: read("blog/blog.css") },
    { name: "web-projects/style.css", css: read("web-projects/style.css") },
    { name: "js/customScroll.js (injected style)", css: injected ? injected[1] : "" },
    // Only 404.html has a <style> block today; a page that adds one is read
    // without a change here.
    ...["index.html", "404.html", "blog/index.html", "web-projects/index.html"]
      .map((page) => ({ name: `${page} (<style>)`, css: inlineStyles(read(page)) }))
      .filter(({ css }) => css.trim() !== ""),
  ];
}

const styleSheets = inScopeStyleSheets();

/**
 * Run a check over every rule of every in-scope sheet and collect the places
 * that break it.
 * @param {(rule: CssRule) => string[]} findProblems
 * @returns {string[]}
 */
function problemsAcrossSheets(findProblems) {
  return styleSheets.flatMap(({ name, css }) => readCssRules(css).flatMap((rule) => findProblems(rule).map((problem) => `${name}: ${problem}`)));
}

// === The rules ===

/** @param {CssRule} rule */
export function ungatedHover(rule) {
  if (rule.exempt || !rule.selector.includes(":hover")) return [];
  const gated = rule.parents.some((parent) => /\(hover:\s*hover\)/.test(parent) && /\(pointer:\s*fine\)/.test(parent));
  return gated ? [] : [`"${rule.selector}" needs @media (hover: hover) and (pointer: fine)`];
}

/** @param {CssRule} rule */
export function transitionAll(rule) {
  return rule.declarations
    .filter((declaration) => !declaration.exempt)
    .filter(
      (declaration) =>
        (declaration.property === "transition" && splitTopLevel(declaration.value, ",").some((part) => /^\s*all\b/.test(part))) ||
        (declaration.property === "transition-property" && /\ball\b/.test(declaration.value))
    )
    .map(() => `"${rule.selector}" transitions "all"; list the properties`);
}

const LAYOUT_PROPERTY = /^(top|right|bottom|left|inset.*|width|height|min-width|min-height|max-width|max-height|margin.*|padding.*|border-width)$/;

/** @param {CssRule} rule */
export function keyframeOnLayoutProperty(rule) {
  if (!rule.parents.some((parent) => parent.startsWith("@keyframes"))) return [];
  return rule.declarations
    .filter((declaration) => !declaration.exempt && LAYOUT_PROPERTY.test(declaration.property))
    .map((declaration) => `keyframe "${rule.selector}" animates ${declaration.property}; use transform`);
}

/**
 * Read the property names a `transition` or `transition-property` animates.
 * @param {Declaration} declaration
 * @returns {string[]}
 */
function transitionedProperties(declaration) {
  if (declaration.property === "transition-property") return declaration.value.split(",").map((part) => part.trim());
  if (declaration.property !== "transition") return [];
  return splitTopLevel(declaration.value, ",").map((part) => part.trim().split(/\s+/)[0]);
}

/** @param {CssRule} rule */
export function transitionOnLayoutProperty(rule) {
  if (rule.exempt) return [];
  return rule.declarations
    .filter((declaration) => !declaration.exempt)
    .flatMap((declaration) => transitionedProperties(declaration).filter((property) => LAYOUT_PROPERTY.test(property)))
    .map((property) => `"${rule.selector}" transitions ${property}; use transform, translate or scale`);
}

/** @param {CssRule} rule */
export function unstableViewportHeight(rule) {
  if (rule.exempt) return [];
  const problems = [];
  rule.declarations.forEach((declaration, index) => {
    if (declaration.exempt) return;
    if (/\b100dvh\b/.test(declaration.value)) {
      problems.push(`"${rule.selector}" uses 100dvh, which changes while the address bar moves; use 100svh`);
    } else if (/\b100vh\b/.test(declaration.value)) {
      const next = rule.declarations[index + 1];
      const isFallback = next && next.property === declaration.property && /\b100svh\b/.test(next.value);
      if (!isFallback) problems.push(`"${rule.selector}" uses 100vh, which is taller than the screen while the address bar shows; use 100svh`);
    }
  });
  return problems;
}

describe("the CSS reader", () => {
  it("keeps the at-rules around a rule", () => {
    const [rule] = readCssRules("@media (hover: hover) and (pointer: fine) { a:hover { color: red; } }");
    expect(rule.selector).toBe("a:hover");
    expect(rule.parents).toEqual(["@media (hover: hover) and (pointer: fine)"]);
    expect(rule.declarations).toEqual([{ property: "color", value: "red", exempt: false }]);
  });

  it("reads a rule after a closed at-rule as top level", () => {
    const rules = readCssRules("@media print { b { color: red; } } a:hover { color: blue; }");
    expect(rules[1].parents).toEqual([]);
  });

  it("keeps a semicolon inside a url in one declaration", () => {
    const [rule] = readCssRules('a { background: url("data:image/png;base64,AAAA"); color: red; }');
    expect(rule.declarations.map((declaration) => declaration.property)).toEqual(["background", "color"]);
  });

  it("keeps a semicolon inside a comment out of the split", () => {
    const [rule] = readCssRules("a { /* one; two */ height: 100vh; height: 100svh; }");
    expect(rule.declarations.map((declaration) => declaration.value)).toEqual(["100vh", "100svh"]);
  });

  it("marks a rule or a declaration that carries the exception comment", () => {
    const [rule] = readCssRules(`/* ${EXCEPTION_MARK} test */ a:hover { /* ${EXCEPTION_MARK} test */ height: 100vh; color: red; }`);
    expect(rule.exempt).toBe(true);
    expect(rule.declarations[0].exempt).toBe(true);
    expect(rule.declarations[1].exempt).toBe(false);
  });
});

describe("each rule catches what it guards", () => {
  const firstRule = (css) => readCssRules(css)[0];

  it("flags an ungated hover and passes a gated one", () => {
    expect(ungatedHover(firstRule("a:hover { color: red; }"))).toHaveLength(1);
    expect(ungatedHover(firstRule("@media (hover: hover) { a:hover { color: red; } }"))).toHaveLength(1);
    expect(ungatedHover(firstRule("@media (hover: hover) and (pointer: fine) { a:hover { color: red; } }"))).toHaveLength(0);
  });

  it("flags transition: all, alone or in a list", () => {
    expect(transitionAll(firstRule("a { transition: all 1s; }"))).toHaveLength(1);
    expect(transitionAll(firstRule("a { transition: color 1s, all 2s; }"))).toHaveLength(1);
    expect(transitionAll(firstRule("a { transition-property: all; }"))).toHaveLength(1);
    expect(transitionAll(firstRule("a { transition: color 1s ease-out; }"))).toHaveLength(0);
  });

  it("flags a keyframe on a layout property and passes transform", () => {
    expect(keyframeOnLayoutProperty(firstRule("@keyframes x { 0% { top: 0; } }"))).toHaveLength(1);
    expect(keyframeOnLayoutProperty(firstRule("@keyframes x { 0% { transform: none; } }"))).toHaveLength(0);
    expect(keyframeOnLayoutProperty(firstRule("@keyframes x { 0% { --fade: 0px; } }"))).toHaveLength(0);
  });

  it("flags a transition on a layout property and passes transform", () => {
    expect(transitionOnLayoutProperty(firstRule("a { transition: top 80ms ease-out, color 1s; }"))).toHaveLength(1);
    expect(transitionOnLayoutProperty(firstRule("a { transition-property: max-height; }"))).toHaveLength(1);
    expect(transitionOnLayoutProperty(firstRule("a { transition: transform 80ms, scale 1s; }"))).toHaveLength(0);
  });

  it("flags 100dvh and a bare 100vh, and passes a 100vh fallback before 100svh", () => {
    expect(unstableViewportHeight(firstRule("a { height: 100dvh; }"))).toHaveLength(1);
    expect(unstableViewportHeight(firstRule("a { min-height: 100vh; }"))).toHaveLength(1);
    expect(unstableViewportHeight(firstRule("a { height: 100vh; height: 100svh; }"))).toHaveLength(0);
  });
});

describe("the main site follows the rules", () => {
  it("reads every in-scope style sheet", () => {
    for (const { name, css } of styleSheets) expect({ name, empty: css.trim() === "" }).toEqual({ name, empty: false });
  });

  it("gates every hover behind a mouse, so a tap does not leave it stuck", () => {
    expect(problemsAcrossSheets(ungatedHover)).toEqual([]);
  });

  it("never transitions all", () => {
    expect(problemsAcrossSheets(transitionAll)).toEqual([]);
  });

  it("animates no layout property in a keyframe", () => {
    expect(problemsAcrossSheets(keyframeOnLayoutProperty)).toEqual([]);
  });

  it("moves no layout property with a transition", () => {
    expect(problemsAcrossSheets(transitionOnLayoutProperty)).toEqual([]);
  });

  it("gives no first screen a height that changes while the reader scrolls", () => {
    expect(problemsAcrossSheets(unstableViewportHeight)).toEqual([]);
  });
});

describe("touch behaviour in css/global/base.css", () => {
  const baseRules = readCssRules(read("css/global/base.css"));
  const declared = (rule, property) => rule.declarations.find((declaration) => declaration.property === property)?.value;

  it("gives every form field 16px text on a touch screen, so iOS does not zoom in", () => {
    const rule = baseRules.find(
      (candidate) => candidate.parents.some((parent) => /\(pointer:\s*coarse\)/.test(parent)) && ["input", "textarea", "select"].every((tag) => candidate.selector.includes(tag))
    );
    expect(rule).toBeDefined();
    expect(declared(rule, "font-size")).toMatch(/^(16px|1rem) !important$/);
  });

  it("removes the browser's tap flash", () => {
    const html = baseRules.find((rule) => rule.selector === "html" && declared(rule, "-webkit-tap-highlight-color"));
    expect(declared(html, "-webkit-tap-highlight-color")).toBe("transparent");
  });

  it("answers a press on a button and on a link, now that the tap flash is gone", () => {
    const pressed = (tag) => baseRules.find((rule) => splitTopLevel(rule.selector, ",").some((part) => part.trim().startsWith(tag) && part.includes(":active")));
    expect(declared(pressed("button"), "scale")).toBeDefined();
    expect(declared(pressed("a"), "opacity")).toBeDefined();
  });

  it("lets a button take quick taps without a zoom or a text selection", () => {
    const button = baseRules.find((rule) => rule.selector === "button");
    expect(declared(button, "touch-action")).toBe("manipulation");
    expect(declared(button, "user-select")).toBe("none");
    expect(declared(button, "-webkit-user-select")).toBe("none");
  });
});

describe("page heads", () => {
  const pages = ["index.html", "404.html", "PdP.html", "WhatIsNextTerms.html", "blog/index.html", "web-projects/index.html", ...loadPosts(repoRoot).map((post) => `blog/${post.slug}/index.html`)];

  it.each(pages.filter((page) => /css\/global\/base\.css/.test(read(page))))("%s listens for touches, so iOS applies :active", (page) => {
    // base.css removes the tap flash and answers a press with :active, but iOS
    // Safari applies :active only when a touchstart listener exists.
    expect(read(page).match(/<body[^>]*>/)?.[0]).toContain(' ontouchstart=""');
  });

});

describe("card entrances", () => {
  it("stay inside the 300ms stagger budget, on the main page and in the Playground", () => {
    for (let index = 0; index < 200; index++) {
      expect(cardEntranceDelayMs(index)).toBeLessThanOrEqual(300);
      expect(playgroundEntranceDelayMs(index)).toBe(cardEntranceDelayMs(index));
    }
  });
});
