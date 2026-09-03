# web-projects/whatsapp-sticker-creator/AGENTS.md

> **SCOPE:** These rules apply when working on files in this folder.

## What this project is

A browser tool that turns a photograph into a WhatsApp sticker: it removes the
background, frames the picture, adjusts colour, adds captions, merges pictures
into an animation, and exports a sticker pack. It fetches nothing and stores
nothing off the device.

The whole project answers to one file. `spec.js` holds WhatsApp's rules, and a
sticker that leaves here clean installs in WhatsApp. Read ADR 0003 before you
change a number in it.

## Module map

Pure modules are Bun-tested. `app.js`, `render.js` and `store.js` touch the
browser and have no tests, by the rule in `web-projects/AGENTS.md`: anything
worth testing belongs in a pure module.

| File | Pure? | Role |
|---|---|---|
| `spec.js` | yes | Every WhatsApp rule and limit, and the checks against them. The authority. |
| `colour.js` | yes | sRGB to CIELAB, and how far apart two colours look |
| `mask.js` | yes | The cut-out mask: brush, combine, morphology, islands, holes, feather, bounds |
| `segment.js` | yes | Finding the background: border sampling, the two-test fill, the magic wand, edge alpha |
| `compose.js` | yes | Mask into picture, defringe, the white outline, transparency questions |
| `filters.js` | yes | Colour matrices, the nine presets, and composing a stack into one matrix |
| `geometry.js` | yes | Where a picture sits on the 512 canvas: crops, fits, margins, and undoing a placement |
| `textLayout.js` | yes | Caption layout: wrapping, line boxes, background boxes, the seven styles |
| `orient.js` | yes | Flip and quarter-turn, for a picture and its mask together |
| `frames.js` | yes | The animation's frame list and its timing |
| `pack.js` | yes | The pack model, and the two export layouts |
| `zip.js` | yes | A store-only ZIP writer, and CRC-32 |
| `encode.js` | yes | The quality search that hits WhatsApp's size ceiling |
| `save.js` | yes | The shape a pack is stored in, and migration |
| `i18n.js` | yes | Every word on the page, English and Spanish, including the rule messages |
| `deployStamp.js` | yes | The "deployed at" footer line. Copied, do not edit |
| `webp/riff.js` | yes | RIFF chunks: reading a WebP into them, writing them back |
| `webp/container.js` | yes | Reading a still WebP: format, size, alpha, and which chunks hold its pixels |
| `webp/animate.js` | yes | Writing an animated WebP from still frames |
| `webp/fixtures.js` | — | Four real WebP files, as test fixtures |
| `render.js` | **no** | The canvas calls: draw, measure text, encode, download. Makes no decisions |
| `store.js` | **no** | IndexedDB and localStorage |
| `app.js` | **no** | The editor: state, events, and the panels |

## Rules that are not obvious

**`spec.js` is the only place a limit lives, and the validator wins over the
README.** Four rules differ between WhatsApp's written guide and the validator it
ships, and a tool built from the guide alone gets all four wrong. ADR 0003 lists
them. The tests assert the numbers themselves, so a test fails if anyone
"rounds" 102400 to 100000.

**A filter must never touch alpha.** A sticker is a cut-out, and a colour
adjustment that wrote to the alpha channel would fill the transparent background
back in and turn the sticker into a square. Every matrix in `filters.js` leaves
the alpha row as the identity, and `applyMatrix` copies alpha across rather than
computing it, so the rule holds even if a future matrix gets it wrong. A test
checks it under every preset.

**Three details in the animated WebP container decide whether the result is a
sticker or a broken square.** Each has its own test, and each is a silent
failure if you get it wrong:

1. The alpha flag in `VP8X`. Without it, decoders throw the transparency away.
2. The blend flag on each `ANMF`. Frames here are full-canvas cut-outs and must
   replace the canvas; alpha blending leaves the frame before showing through
   the holes of the frame after.
3. A frame must not carry its own `VP8X` chunk. The browser writes one for any
   still with transparency, and it has to be dropped on the way in.

**The WebP tests read real files, not hand-written bytes.** `webp/fixtures.js`
carries four files libwebp produced, one per container shape a browser can hand
back: extended lossy with a separate alpha chunk, simple lossless,
simple lossy, and an animation. Bytes written by hand would only prove the
reader agrees with the writer in the same folder.

**The pipeline order is load-bearing.** Colour, cut-out and edge tidy-up run at
the picture's own size, so the cut-out survives a change of framing. The picture
is then scaled to 512, and only then is the outline drawn, because "8 pixels" has
to mean 8 pixels of the finished sticker. Captions go last, on top of the
outline.

**The mask lives in source pixels, not canvas pixels.** That is what lets a
person cut out a subject and then re-frame it without losing the cut. Every
brush coordinate therefore goes through `toSourcePoint`, and the brush radius is
divided by the placement scale or a zoomed-in brush paints a giant patch.

**A frame carries its own picture, cut-out, colour and framing. Captions belong
to the sticker.** So one frame of an animation can be fixed without touching the
others, and a caption shows on every frame, which is what a caption on an
animation almost always wants.

**Flip and turn must move the picture and its mask together**, or the cut-out
slides off the subject. `orient.js` takes the bytes per pixel for exactly that
reason: four for a picture, one for a mask, one function for both.

**A pack's `image_data_version` must move on every edit.** WhatsApp caches a pack
it has already added and re-reads it only when that string changes, so an edit
that left it alone would never reach the phone. `pack.js` moves it on every
change, and a test checks each one.

**The two picture inputs mean different things.** "Choose a picture" starts a new
sticker and replaces what is open; "Add a frame" appends. A single input that
always appended would quietly turn a second sticker into a two frame animation
of the first. That bug shipped once and a browser test caught it.

**`[hidden] { display: none !important }` in `style.css` is load-bearing.** The
`hidden` attribute is `display: none` in the browser's own stylesheet, and any
author `display` rule beats it. `.tool` and `.stage` both set `display: flex`, so
without that rule every tool panel shows at once and the tabs do nothing.

**Only the finished pack is saved, never the work in progress.** The source
photograph, its mask and the undo history are tens of megabytes and belong to a
session. Blob URLs are rebuilt on load and never stored: a stored one points at
nothing on the next visit.

## Test the pixel work with pictures built in the test

No canvas, no binary fixtures for the pixel modules. Build a synthetic picture
from a function, the way `segment.test.js` and `sudoku-screenshot-coach`'s
`vision/testFixtures.js` do:

```js
function image(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  // ...paint(x, y) returns [r, g, b, a]
  return data;
}
```

For a mask, rows of characters read as a picture and make a failure obvious:

```js
maskFromRows(["#####", "#...#", "#####"]);
```

## Verify in a browser before you ship

The tests cover the arithmetic. They cannot cover the wiring, and two real bugs
in this project were only ever visible in a browser: a missing element id that
made start-up throw before any event was wired, and the `[hidden]` rule above.

Drive it with the pre-installed Chromium: pick a picture, check the preview's
pixels for a transparent corner and an opaque middle, tag an emoji, export, and
open the archive. A sticker that decodes as a 512 by 512 WebP with a transparent
corner, inside the size limit, is the thing this project promises.

## Architecture Decision Records

| ADR | Topic |
|---|---|
| [0001](adr/0001-pack-frames-into-an-animated-webp-rather-than-encode-one.md) | Pack still frames into an animated WebP, rather than encode one |
| [0002](adr/0002-find-the-background-by-colour-from-the-frame-edges.md) | Find the background by colour from the frame edges |
| [0003](adr/0003-follow-the-validator-whatsapp-ships-not-only-its-written-guide.md) | Follow the validator WhatsApp ships, not only its written guide |
| [0004](adr/0004-keep-the-pack-in-indexeddb-not-localstorage.md) | Keep the pack in IndexedDB, not localStorage |
| [0005](adr/0005-hand-over-the-files-because-a-web-page-cannot-install-a-pack.md) | Hand over the files, because a web page cannot install a pack |

Root ADRs that apply: 0002 (no build system), 0007 (the reasoning behind
device-only persistence), 0012 (red-green TDD), 0013 (the deploy stamp).
