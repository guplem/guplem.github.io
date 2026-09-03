# ADR 0001: Pack still frames into an animated WebP, rather than encode one

## Context

Every WhatsApp sticker is a WebP file, and an animated sticker is a single WebP
file holding all of its frames. That is not optional: WhatsApp reads no other
format.

A browser can encode one still picture. `canvas.toBlob("image/webp", quality)`
hands back a finished WebP file, and every current browser can do it. No browser
can encode an animation. There is no API for it, and there is no plan for one.

So a page that wants to make an animated sticker has to close that gap itself.
Three ways were open.

**A library.** Several JavaScript WebP encoders exist, mostly libwebp compiled to
WebAssembly. Root ADR 0002 rules out a build step and a package manager, so one
would arrive from a content delivery network at page load. That is a megabyte or
more before the page can do anything, a second network dependency for a tool
whose whole promise is that it needs none, and code nobody in this repository can
read handling the reader's photographs. No standalone web-project here has a
third-party runtime dependency, and the closest one to this project refused an
OCR library for the same reasons (sudoku-screenshot-coach ADR 0002).

**Write an encoder.** A VP8L lossless encoder is reachable: it is LZ77 and Huffman
coding over pixels, which is a few hundred lines. But lossless is the wrong tool
here. A photograph encoded losslessly is far larger than 500KB at 512 by 512, so
the sticker would be refused for size. A lossy VP8 encoder is a different order of
work: block prediction, a discrete cosine transform, quantisation and an
arithmetic coder, all of it needing to be right for the file to decode at all.

**Pack, rather than encode.** An animated WebP is not a different kind of
compression from a still one. It is the same compressed picture data, several
times over, inside a container that says where each piece goes and how long it
stays. The browser can make the pieces. Only the container is missing, and a
container is bookkeeping.

## Decision

**Each frame is drawn and encoded on its own as a still WebP by the browser, and
then the finished frames are repacked into one animated WebP file. The pixels are
never touched.**

The file `webp/` builds is:

```
RIFF/WEBP
  VP8X      the canvas: its size, and flags for "animated" and "has alpha"
  ANIM      background colour and loop count
  ANMF      frame 1: where, how long, then frame 1's own chunks
  ANMF      frame 2: ...
```

Each frame's own image chunks are copied over byte for byte out of the still
WebP the browser produced. A frame in an animation is therefore bit-identical to
the still it came from, and nothing is compressed twice.

The work splits into three files, each with its own tests:

- `webp/riff.js` counts bytes. It reads a WebP file into chunks and writes chunks
  back into a file, and knows nothing about what a chunk means.
- `webp/container.js` reads a still: whether it is lossy or lossless, how big it
  is, whether it keeps transparency, and which chunks carry its pixels.
- `webp/animate.js` writes the animation.

**The tests read real WebP files, not hand-written bytes.** `webp/fixtures.js`
carries four files libwebp actually produced, one per container shape a browser
can hand back. A test built from hand-written bytes would only prove that the
reader in this folder agrees with the writer in this folder.

**A quality is chosen by encoding and looking, not by guessing.** Nothing predicts
the size of a WebP file from its contents. `encode.js` binary-searches a quality
ladder for the best rung that fits the budget, which costs four encodes at most
rather than one per rung. For an animation it first probes a single frame against
its share of the total, then checks the whole animation from that rung down.

## Consequences

- **The page needs no library, no build step and makes no network request.** The
  privacy line in the footer can be absolute rather than hedged.
- **Three details decide whether the result is a sticker or a broken square, so
  each has its own test.** The alpha flag in VP8X: without it decoders throw the
  transparency away and every sticker becomes a rectangle. The blend flag on each
  frame: frames here are full-canvas cut-outs and must replace the canvas, or the
  frame before shows through the holes of the frame after. And a frame must not
  carry its own VP8X chunk, which the browser writes for any still with
  transparency and which has to be dropped on the way in.
- **The output was checked against libwebp, the decoder WhatsApp itself uses.**
  A muxed file reads back with every frame, every duration and its transparency
  intact. That check is not in the test suite, because libwebp is not available
  to it; the fixtures are what carry the format knowledge into the tests.
- **Frames can mix lossy and lossless.** The muxer copies whatever chunks it is
  given, so a flat drawing encoded losslessly and a photograph encoded lossily
  can sit in one animation. Nothing in the editor uses that yet.
- **A frame costs 24 bytes of header on top of its pixels.** `estimateFrameBudget`
  subtracts that before dividing the total, because handing every frame the plain
  share overshoots by exactly the overhead, which is enough to fail a sticker
  that looked fine.
- **An animation costs one encode per frame per search step.** A twenty frame
  animation is therefore a few seconds of work. The status line says so while it
  happens, and the two stage search is what keeps it from being four times worse.
- **This code can read an animated WebP's structure but cannot decode one.** So a
  finished animated sticker reopened from the pack comes back as its first frame
  only. Decoding VP8 is the work this decision avoided.
