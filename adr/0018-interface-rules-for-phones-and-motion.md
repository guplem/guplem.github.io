# ADR 0018: Interface Rules for Phones and Motion, Guarded by a Test

## Context

The site was built and checked on a desktop browser. On a phone it showed the usual signs of a desktop page. A hover look stayed on after a tap. The search box zoomed the page on iPhone. A tap gave no feedback. The hero changed height while the reader scrolled. Its motion also ran where it did not help. The work cards replayed their entrance on every filter click and every pause in typing, and every section faded in on scroll.

The owner asked to apply the parts of Emil Kowalski's interface skills (`github.com/emilkowalski/skills`) that fit this site. Issue #419 holds the audit, file by file. The skills that fit are `mobile-native`, `animation-performance`, `find-animation-opportunities` with `remove-animations`, and `break-ui`. The rest target React, React Native, Swift or one library (root ADR 0002).

A rule written only in prose drifts: the next change adds an ungated hover, and nobody notices on a desktop.

## Decision

**Turn every rule that a machine can check into a test.** `scripts/interfaceRules.test.js` reads the shared CSS of the main site: `css/global/`, `css/sections/`, `blog/blog.css` and `web-projects/style.css`. It also reads the `<style>` blocks of the shared pages and the style that `js/customScroll.js` injects. It fails on:

- a `:hover` rule outside `@media (hover: hover) and (pointer: fine)`;
- `transition: all`;
- a keyframe or a transition that moves a layout property (`top`, `width`, `max-height`, `margin` and the like);
- a keyframe or a transition on `box-shadow`. A shadow change repaints its element on every frame and waits for the main thread. Put the shadow on a pseudo-element and animate its `opacity` (issue #425);
- `100dvh`, or a `100vh` that is not a fallback line before `100svh`.

It also checks these points:

- `css/global/base.css` holds the touch rules: no tap flash, a press state on buttons and links, `touch-action: manipulation`, and 16px form fields on a touch screen.
- Every main-site page and every blog post has a viewport tag that allows zoom.
- Every page that loads `base.css` has `ontouchstart=""` on `<body>`.
- `index.html` has a `theme-color` equal to `--bg-dark`.

**One escape hatch, with a reason.** A comment holding `interface-rule-exception: <reason>` right before a rule or a declaration exempts it. Two exist. The "Show more projects" `max-height` transition must push the sections below it down. The Playground's `100vh` search height needs the largest viewport.

**Motion needs a purpose.** The entrance of the work cards plays on the first render only, and it lasts 300ms. Its stagger stops at 300ms (`js/layoutBuilder/cardEntrance.js`). The Playground repeats the numbers in `web-projects/discovery.js`, and the guard test keeps them equal. The scroll reveal is gone. A hover moves only a link, a button or a project card.

**Scope.** The CSS rules cover the main site and the shared skeleton. A web-project or a blog post's own `style.css` owns its look, so the test does not read it. The head checks also cover the blog posts, and the touch-listener check covers every page that loads `base.css`.

**Rejected alternative:** copy the skills into the repository. They are long, they cover stacks this site does not use, and an agent would read them as instructions to follow everywhere. The test and a few lines in `AGENTS.md` carry what applies.

**Rejected alternative:** a CSS linter (Stylelint) with plugins. It needs a `package.json` and a build-time tool, which root ADR 0002 rules out. The guard test reads plain CSS with a small reader and runs in the existing `bun test .`.

## Consequences

**Positive:**

- A phone no longer shows the desktop tells listed above, and CI keeps them out (root ADR 0009).
- Each exception is visible in the CSS, next to its reason.

**Negative:**

- The CSS reader handles plain CSS only: at-rules may nest, but style rules may not. A shared sheet that starts to use CSS nesting needs a better reader.
- Some rules stay prose, because no test can judge them: whether a new motion has a purpose, and how a page feels on a real phone. `AGENTS.md` holds those.
