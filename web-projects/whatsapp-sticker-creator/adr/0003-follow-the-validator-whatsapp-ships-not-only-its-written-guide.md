# ADR 0003: Follow the validator WhatsApp ships, not only its written guide

## Context

The point of this tool is that a sticker it produces installs in WhatsApp. A
sticker that breaks a rule is refused, and refused with an error the person never
sees: they only see that nothing happened. So the rules have to be checked here,
before export, rather than hoped for.

There are two sources for the rules, and they disagree.

**The written requirements** in `WhatsApp/stickers`, `Android/README.md`. This is
the document a person finds first and the one every article about making stickers
is written from.

**`StickerPackValidator.java`**, in the sample app in the same repository. This is
the code that actually accepts or refuses a pack on a phone.

A tool built from the README alone gets four rules wrong.

## Decision

**Where the two disagree, the validator wins, because it is the code that runs.
`spec.js` holds every number, with its source named.**

The four differences:

1. **A kilobyte is 1024 bytes.** `KB_IN_BYTES = 1024` in the validator, so the
   real ceiling for a still sticker is 102400 bytes and not the 100000 that
   "100KB" suggests. Reading it the other way rejects stickers WhatsApp accepts.
2. **At least one emoji is required.** `EMOJI_MIN_LIMIT = 1`. The README gives
   only the maximum of three. A pack whose stickers carry no emoji is refused
   whole, so this is an error here and not a suggestion.
3. **A tray icon may be 24 to 512 pixels on a side**, not only 96.
   `TRAY_IMAGE_DIMENSION_MIN` and `_MAX`. 96 stays the README's recommendation, so
   the tool writes exactly 96 and warns about anything else rather than refusing
   it.
4. **In an animated pack, every sticker must really animate.** The validator
   refuses a pack marked animated that holds a sticker with a single frame. The
   README never says so. A one frame "animation" is a plausible thing to build by
   accident, so it is checked.

**A broken rule is reported as a name and its numbers, never as a sentence.**
`checkSticker` and `checkPack` return findings like
`{ rule: "sticker.tooBig", severity: "error", params: { byteLength, maxBytes } }`,
and `i18n.js` writes the sentence in either language. Building the sentence where
the rule is checked is what leaves a tool half translated;
sudoku-screenshot-coach ADR 0004 records the same decision.

**Every rule is reported at once, not just the first.** A person fixing one
problem should see the others rather than meeting them one at a time.

**An error blocks an export and a warning only advises.** The two design
recommendations are warnings: a sticker with no transparent background, and a
drawing with no room for the 8 pixel outline WhatsApp suggests. WhatsApp installs
both, so refusing them would be this tool overruling its own source.

**One rule is deliberately stricter than the validator.** The identifier pattern
is `[\w-.,'\s]+` there, and Java's `\s` matches a tab and a newline, so WhatsApp
would accept an identifier with a tab inside it. Nobody means to type that and
the README does not list it, so only a plain space is allowed here. The comma and
the apostrophe go the other way: the README omits them but the validator accepts
them, and refusing them would be a false alarm.

## Consequences

- **The sticker is measured from its encoded bytes, not from the editor's idea of
  it.** The rules are about the file, so the size, the dimensions, the
  transparency and the edge clearance are all read back off the finished sticker.
- **`spec.js` is the one place a number lives**, and the tests assert the numbers
  themselves. A test named "match WhatsApp's own validator, counting a kilobyte
  as 1024 bytes" fails if anyone changes 102400 to 100000.
- **The rules are also shown, not only enforced.** The check panel lists them, so
  a person can see what they are aiming at rather than only hearing when they
  miss.
- **These numbers can go stale.** They were read from `WhatsApp/stickers` at
  `main`. If WhatsApp changes a limit, this file is where the change goes, and
  the tests are what say which behaviour depended on it.
- **The pack rules and the sticker rules are separate checks.** A pack of one is
  a legal sticker and an illegal pack, and the person building it needs to hear
  about the sticker while they build and about the pack when they export.
- **An emoji is counted the way a reader sees it.** A family emoji is several
  people joined together and a flag is two letters, so counting code points would
  call one emoji three and refuse a legal tag. `Intl.Segmenter` groups them.
