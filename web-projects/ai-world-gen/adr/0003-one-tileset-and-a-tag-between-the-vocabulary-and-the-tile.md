# ADR 0003: One tileset for every setting, and a tag between the vocabulary and the tile

## Context

The vocabulary is different for every world. A "cryo pod", a "sarcophagus"
and a "cot" are three types in three settings, and none of them exists until a
model writes it. Something has to turn a type nobody has seen before into a
picture.

The obvious answer, a lookup from generated type id to sprite, cannot work: the
id is new every session. The next answer, a pack per genre (a fantasy pack for
villages, a sci-fi pack for stations), needs code that decides the genre and
switches assets, and a "haunted space station" or a "cyberpunk temple" ends up
with tiles from two packs that were never drawn to sit together.

## Decision

**One tileset, in one style, for every setting: the Urizen 1-bit tileset by
vurmux.** It is CC0, holds more than 5,500 tiles at 12 by 12 pixels, and spans
fantasy, modern, sci-fi and horror in one drawing style. One pack, no
per-genre switch, and no way for two tiles on the same map to clash.

**A visual tag sits between the vocabulary and the tile.** `tileset.js` holds
a fixed list of about 140 tags (`grass`, `metal-floor`, `wood-door`, `chest`,
`crew`, `monster`, ...) and maps each to one or more sheet positions. The
vocabulary prompt lists those tags; each element type must name exactly one;
a tag outside the list is a validation error the model is asked to fix. The
drawing code reads the type's tag and nothing else. A cell's coordinate hash
picks the variant, so a field of grass does not repeat one drawing.

**The tag `unknown` is the fallback.** A type whose tag the manifest does not
know draws a visible question mark, never nothing.

**The sheet geometry is data.** 12 pixel tiles, a 1 pixel margin, 1 pixel
between tiles, 206 columns by 50 rows. `tileset.test.js` reads the PNG header
and fails if the file and the numbers disagree, and fails on any tag whose
position falls on one of the sheet's four separator columns.

## Consequences

**Every map looks like one map.** That is the whole point, and it holds for
settings nobody thought of when the tags were written.

**The tags are a vocabulary of their own, and they limit the model.** A type
with no fitting tag gets the closest one or the fallback. The list was read off
the sheet by eye and some entries are approximations (`bridge` is a plank).
Adding a tag is one line in `tileset.js`; the prompt and the validator pick it
up with no other change.

**One-bit art is a look, not everyone's.** Kenney's CC0 packs are richer and
more colourful, and the same artist drew them, so they mix. They are the swap
if that ever matters more than one style for all settings. The tag indirection
means the swap touches `tileset.js` and the PNG, and nothing else.

**Rejected: hardcode a sprite per generated type id.** The id does not exist
until the model writes it. **Rejected: a pack per genre.** A genre detector, a
switch, and mismatched maps for every setting that straddles two genres.
**Rejected: draw tiles from code** (as `akwaaba-monsters` does, its ADR 0001).
Right for a game with a fixed cast; wrong for a vocabulary that is new every
session and needs hundreds of distinct pictures.
