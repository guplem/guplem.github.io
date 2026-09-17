# ADR 0004: One set of parts, in the shape shadcn/ui uses

## Context

The first version of this page had a stylesheet, not a design. Colours were
picked one at a time, sizes were whatever looked acceptable, and **no button had
a hover state**. A control that does not change under the pointer reads as dead,
and the reader has to click it to find out whether it is a button at all. Nothing
caught it, because visual work is exempt from the testing rule (root ADR 0012)
and "it renders" was the only bar it had to clear.

The owner of this site names shadcn/ui as the look they want. That library is
built for React and Tailwind, and this site has no build step (root ADR 0002) and
imports nothing from a CDN on a page holding a credential (ADR 0001). So the
library itself is not available here. Its **design language** is, and that is the
part that matters: it is a small, well-argued system rather than a set of
components.

## Decision

**Copy the system, not the code.** Three parts:

1. **Colour roles, held as bare HSL channels.** `--background`, `--foreground`,
   `--card`, `--muted`, `--accent`, `--primary`, `--secondary`, `--destructive`,
   `--border`, `--input`, `--ring`, each stored as `240 10% 3.9%` and always used
   as `hsl(var(--token))`. Nothing in the page names a colour directly. Dark mode
   redefines the same roles under `prefers-color-scheme` and changes no rule.
2. **One radius token and one shadow scale**, so every corner and every lift on
   the page came from the same decision.
3. **Four parts, and every screen is built from them**: `.button` with variants
   (`primary`, `outline`, `secondary`, `ghost`, `danger`), `.input`, `.card` with
   a header and a content area, and `.badge` with variants. A new screen composes
   these. It does not invent a fifth part without a reason.

**Every part answers the pointer and the keyboard.** A hover state on every
button variant, a press state, a focus ring that stays readable on any surface,
a hover and a focus state on every text box, and a lift on an issue card. This is
the rule the first version broke, so `invariants.test.js` now guards it: it reads
`style.css`, finds every `.button-*` variant, and fails when one has no `:hover`.

## Consequences

**The bare-channel colour format is load-bearing and looks like a mistake.** A
token written as a finished colour (`#18181b`, or `hsl(240 6% 10%)`) breaks every
hover state on the page at once, because those states are built by taking an
alpha at the point of use: `hsl(var(--primary) / 0.88)`. There is no way to do
that with a finished colour. Anyone tidying the tokens into normal hex values
will break the design and the page will still load.

**The look is recognisably shadcn and is not shadcn.** No Tailwind, no React, no
Radix, so no dialogs, no popovers, and no component API. What this project gets
is the palette, the spacing, the radius, the focus ring and the button variants.
A feature that truly needs a dialog gets a hand-built one held to the same
system, or it gets designed differently.

**A test now touches the stylesheet.** It is a text search, so it is fragile in
the usual way: renaming a variant class silently stops that variant from being
checked. The trade is accepted. The alternative is the state this page shipped
in, where nothing noticed that no button reacted to anything.

**Rejected: copying shadcn's components by hand, one at a time.** It is a large
amount of markup for parts this page does not use yet. **Rejected: a CSS
framework from a CDN.** ADR 0001 rules out third-party script on this page, and
root ADR 0002 rules out a build step, which is how a CSS framework is normally
trimmed down. **Rejected: keeping the ad-hoc styles and only adding hover
states.** That fixes the symptom the owner saw and leaves the cause, which is
that there was no system to be consistent with.
