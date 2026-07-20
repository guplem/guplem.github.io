// Guard tests for the self-hosted Inter font (issue #43). They pin the fix
// that removed the Google Fonts CDN load and replaced it with a local woff2 +
// a <link rel="preload">, so the render-blocking cross-origin request and the
// FOUT (flash of unstyled text) do not come back. See root ADR 0005.

import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Resolve relative to this test file, not the working directory, so the test
// passes no matter where `bun test` is invoked from.
const repoRoot = join(import.meta.dir, "..");

// Each page uses its own path prefix to reach the font: index.html is relative,
// web-projects/index.html goes one level up, and 404.html uses absolute paths
// because GitHub Pages serves it for any missing URL depth.
const pages = [
  { file: "index.html", preloadHref: "resources/fonts/InterVariable.woff2", cssHref: "css/global/fonts.css" },
  { file: join("web-projects", "index.html"), preloadHref: "../resources/fonts/InterVariable.woff2", cssHref: "../css/global/fonts.css" },
  { file: "404.html", preloadHref: "/resources/fonts/InterVariable.woff2", cssHref: "/css/global/fonts.css" },
];

describe("font is self-hosted, not loaded from Google Fonts", () => {
  for (const page of pages) {
    describe(page.file, () => {
      const html = readFileSync(join(repoRoot, page.file), "utf8");

      it("does not reference the Google Fonts hosts", () => {
        expect(html).not.toContain("fonts.googleapis.com");
        expect(html).not.toContain("fonts.gstatic.com");
      });

      it("preloads the local Inter woff2 with crossorigin", () => {
        const preload = new RegExp(`<link[^>]*rel="preload"[^>]*href="${page.preloadHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`);
        const match = html.match(preload);
        expect(match).not.toBeNull();
        expect(match[0]).toContain("crossorigin");
      });

      it("links the self-hosted font stylesheet", () => {
        expect(html).toContain(`href="${page.cssHref}"`);
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
    const css = readFileSync(join(repoRoot, "css", "global", "fonts.css"), "utf8");
    expect(css).toContain("@font-face");
    expect(css).toContain(`font-family: "Inter"`);
  });
});
