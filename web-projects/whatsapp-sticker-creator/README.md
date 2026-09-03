# Sticker Studio for WhatsApp

Turn a photo into a WhatsApp sticker, in the browser. It removes the background,
frames the picture, adjusts colour, adds captions, merges pictures into an
animation, and holds everything to WhatsApp's own sticker rules.

Your pictures never leave your device. The page makes no network requests at all.

## Features

- **Background removal you can correct.** It finds the background automatically,
  then hands you the controls: two tolerance sliders, an erase and bring-back
  brush with adjustable softness, a magic wand, a soft-edge setting, an edge
  tidy-up that removes the ring of wall colour a cut leaves behind, and twelve
  steps of undo.
- **Framing for a square sticker.** Fit the sticker to what is left of the
  drawing, fit the whole picture, or fill the square. Then set the margin, zoom,
  pan, flip and turn.
- **Colour.** Nine presets plus brightness, contrast, colour strength and warmth.
  Transparency is never touched, so a cut-out stays a cut-out.
- **Captions, in seven styles.** Plain, outlined, shadowed, highlighted, marker,
  card and night. Drag them on the sticker, and set size, tilt, alignment and
  colours. Several captions at once.
- **Animation.** Add up to 60 frames, each edited on its own, with its own time
  on screen. Set one speed for all of them, play it back and forth, and preview
  it. The result is a single animated WebP file.
- **The white outline WhatsApp recommends**, at any width and colour.
- **Sticker packs.** Up to 30 stickers, reorderable, with emoji tags and a
  screen-reader description each, a generated pack icon, and a pack that is saved
  on your device so it survives a reload.
- **Every WhatsApp rule checked before you export**, with the exact numbers: the
  512 by 512 size, the 100KB and 500KB ceilings, the 8 ms and 10 s animation
  limits, one to three emoji, the pack size, and the pack icon.
- **English and Spanish**, including every rule message.

## How to get a pack into WhatsApp

WhatsApp only reads sticker packs from an installed app, so no web page can add
one directly. This tool gives you the files:

- **`.wastickers`** — save it on your phone and open it with a sticker app to add
  the pack to WhatsApp. This is the route to use on a phone.
- **`.zip` with `contents.json`** — the folder layout for WhatsApp's own sample
  app, if you are building a sticker app yourself.
- **A single `.webp`** — one 512 by 512 sticker, which you can also send into a
  chat as an image.

## Browser support

The browser must be able to save WebP pictures, which every WhatsApp sticker has
to be. Chrome, Edge, Firefox and Safari 16 or newer can. The page checks on
start-up and says so if it cannot.

## How to Run

Open `index.html` in a browser, or serve the folder with any HTTP server:

```bash
python -m http.server 8000
```

## Tests

```bash
bun test
```

## Why it works the way it does

The decisions with trade-offs are written down in [`adr/`](adr/):

| ADR | Topic |
|---|---|
| [0001](adr/0001-pack-frames-into-an-animated-webp-rather-than-encode-one.md) | Pack still frames into an animated WebP, rather than encode one |
| [0002](adr/0002-find-the-background-by-colour-from-the-frame-edges.md) | Find the background by colour from the frame edges |
| [0003](adr/0003-follow-the-validator-whatsapp-ships-not-only-its-written-guide.md) | Follow the validator WhatsApp ships, not only its written guide |
| [0004](adr/0004-keep-the-pack-in-indexeddb-not-localstorage.md) | Keep the pack in IndexedDB, not localStorage |
| [0005](adr/0005-hand-over-the-files-because-a-web-page-cannot-install-a-pack.md) | Hand over the files, because a web page cannot install a pack |
