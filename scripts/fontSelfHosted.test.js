// Guard tests for the self-hosted Inter font (issue #43). They pin the fix
// that removed the Google Fonts CDN load and replaced it with a local woff2 +
// a <link rel="preload">, so the render-blocking cross-origin request does not
// come back and the preload keeps reducing the cold-cache flash of unstyled
// text. See root ADR 0005.

import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import path from "node:path";

// Resolve relative to this test file, not the working directory, so the test
// passes no matter where `bun test` is invoked from.
const repoRoot = join(import.meta.dir, "..");

// Each page uses its own path prefix to reach the font: index.html is relative,
// web-projects/index.html goes one level up, and 404.html uses absolute paths
// because GitHub Pages serves it for any missing URL depth. `dir` is the page's
// own directory as a site-absolute path (index.html and 404.html at the root,
// the web-projects index one level down); it is the base a relative href
// resolves against.
const pages = [
  { file: "index.html", dir: "/", preloadHref: "resources/fonts/InterVariable.woff2", cssHref: "css/global/fonts.css" },
  { file: join("web-projects", "index.html"), dir: "/web-projects", preloadHref: "../resources/fonts/InterVariable.woff2", cssHref: "../css/global/fonts.css" },
  { file: "404.html", dir: "/", preloadHref: "/resources/fonts/InterVariable.woff2", cssHref: "/css/global/fonts.css" },
];

// The @font-face lives here; both the CSS src url and its base directory are
// used across several tests, so extract them once.
const fontsCss = readFileSync(join(repoRoot, "css", "global", "fonts.css"), "utf8");
const cssBaseDir = "/css/global";

/**
 * Pull the woff2 url out of the @font-face `src` declaration.
 * @returns {string} the url exactly as written in the CSS (forward slashes)
 */
function fontSrcUrl() {
  const match = fontsCss.match(/src:\s*url\(\s*["']?([^"')]+)["']?\s*\)/);
  expect(match).not.toBeNull();
  return match[1];
}

/**
 * Resolve a URL reference to a site-absolute path (URLs always use forward
 * slashes, so use path.posix). An absolute ref (leading "/") wins; otherwise it
 * resolves against the given base directory.
 * @param {string} baseDir site-absolute directory the ref is relative to
 * @param {string} ref the href/url as written
 * @returns {string} normalized site-absolute path
 */
function resolveSitePath(baseDir, ref) {
  if (ref.startsWith("/")) return path.posix.normalize(ref);
  return path.posix.normalize(path.posix.join(baseDir, ref));
}

describe("font is self-hosted, not loaded from Google Fonts", () => {
  for (const page of pages) {
    describe(page.file, () => {
      const html = readFileSync(join(repoRoot, page.file), "utf8");

      it("does not reference the Google Fonts hosts", () => {
        expect(html).not.toContain("fonts.googleapis.com");
        expect(html).not.toContain("fonts.gstatic.com");
      });

      it("preloads the local Inter woff2 with crossorigin", () => {
        // Match the preload link regardless of attribute order: find a <link>
        // tag that carries both rel="preload" and the woff2 href.
        const linkTags = html.match(/<link[^>]*>/g) ?? [];
        const preload = linkTags.find(
          (tag) => tag.includes(`rel="preload"`) && tag.includes(`href="${page.preloadHref}"`)
        );
        expect(preload).toBeDefined();
        expect(preload).toContain("crossorigin");
      });

      it("links the self-hosted font stylesheet", () => {
        expect(html).toContain(`href="${page.cssHref}"`);
      });

      it("resolves its preload href and the CSS src url to the same font path", () => {
        // A future edit that moves one but not the other would make the browser
        // download the font twice. Derive both site-absolute paths and compare.
        const preloadPath = resolveSitePath(page.dir, page.preloadHref);
        const cssPath = resolveSitePath(cssBaseDir, fontSrcUrl());
        expect(preloadPath).toBe(cssPath);
      });
    });
  }
});

describe("self-hosted font assets exist", () => {
  it("ships the Inter variable woff2 and its license", () => {
    expect(existsSync(join(repoRoot, "resources", "fonts", "InterVariable.woff2"))).toBe(true);
    expect(existsSync(join(repoRoot, "resources", "fonts", "Inter-LICENSE.txt"))).toBe(true);
  });

  it("defines an @font-face for Inter in css/global/fonts.css", () => {
    expect(fontsCss).toContain("@font-face");
    expect(fontsCss).toContain(`font-family: "Inter"`);
  });

  it("points the @font-face src at a woff2 file that exists", () => {
    // A typo in the url would 404 in the browser and silently fall back to a
    // system font -- the exact regression these tests guard. Resolve the url
    // against the css/global/ directory on disk and confirm the file is there.
    const onDisk = join(repoRoot, "css", "global", fontSrcUrl());
    expect(existsSync(onDisk)).toBe(true);
  });
});
