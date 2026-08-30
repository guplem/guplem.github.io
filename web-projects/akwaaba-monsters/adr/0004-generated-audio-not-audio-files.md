# ADR 0004: Generate the music, do not ship it

## Context

ADR 0001 decided the pictures are generated. The music is a separate question
with a separate answer, because a song is not a sprite: nobody hand-writes a
waveform, and a two minute track as a file is small and sounds better than
anything a browser can synthesise.

## Decision

**No audio files. Songs are note strings, played by the Web Audio API.**

`music.js` holds eight songs written in a small notation: a channel is a string
of `note:length` tokens, and a song is a few channels. It is pure, so the parser
and the note frequencies are tested. `audio.js` schedules them ahead of time on
two square voices, a triangle bass and a noise channel for the drums.

The music leans on highlife and Afrobeat rather than on a march: a pentatonic
melody over an off-beat bass and a busy hat.

Creature cries are not written at all. `cryFor` derives a pitch, a shape and a
roughness from the species name and its weight, so a heavy creature growls, a
light one chirps, every creature has its own voice that never changes, and a
creature added in area 5 gets one for free.

## Consequences

**Good.**

- A song is a diff. Changing a bar is a line change.
- No download, no decoding, no format worries.
- Twenty one cries cost nothing to write and nothing to keep in step with the
  species table.

**Bad.**

- Four channels of square and triangle is the ceiling. This will never sound
  like a recording, and it should not try.
- Scheduling runs on a timer. A tab left in the background can drift, and the
  loop restarts cleanly rather than trying to catch up.
- Writing a song in text is slow, and there are only eight.

**Note.** Browsers refuse to make a sound until the visitor has touched the
page, so `unlock()` runs on the first key or tap. Everything before that is
silent by design, not by accident.
