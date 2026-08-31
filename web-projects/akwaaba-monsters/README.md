# Akwaaba Monsters

A handheld-style creature-collecting role playing game set in tropical Ghana.
Walk from Aduma village to the Bosua gym: choose a starter from Professor
Abenaa, cross the Pra river, stop an illegal gold mine that is poisoning it, and
beat Nana Kofi for the River Stone Badge.

**Play it:** <https://triunitystudios.com/web-projects/akwaaba-monsters/>

It is built to grow. This is area 1. Later areas are meant to be added one file
at a time, and `ROADMAP.md` is the handover note that says how.

## Features

- **Twenty one creatures**, seven of which stand for the friends on the trip
  this game is about: Hinoko with its living dreadlocks, Polete the small fast
  one, Nacho who sleeps eighteen hours a day, Seryi the dancing mask with the
  long pipe, Carsla who has never once had to raise its voice, Gis who will not
  put a foot on ground it considers dirty, and Poya, all shoulder and no
  patience.
- **A full battle system**: ten types with a chart that has no unbeatable and no
  worthless type, four moves with power points, physical and special damage,
  critical hits, lasting conditions, stat changes, levels, experience,
  evolution, and catching with a calabash instead of a ball.
- **Ten maps and fourteen trainers**, from your bedroom to the gym floor.
- **A team of six, and a box for the rest.** Catch a seventh creature and it
  waits in the box. Walk up to a storage computer and press A to bring it back
  out.
- **Machines you walk up to.** A healing machine puts your whole team back on
  its feet for free, and a storage computer beside it holds the creatures your
  team has no room for. Both stand in Professor Abenaa's hut, where you choose
  your first creature, and both stand in the Akwaaba Centre in Bosua.
- **A rival who is a cook.** Mama Sopa meets you three times, and each time she
  offers a bowl of banku and soup. You can refuse. If you do not, your whole
  team really is poisoned, once the fight is over. The first time, she hands you
  the bitter leaf that cures it.
- **An antagonist with a real grievance.** Equip Galamsey dredge the Pra for
  gold, and the mercury goes into the water. Nana Sika is not sorry.

## How to play

| | Keyboard | Touch or mouse |
|---|---|---|
| Walk | Arrow keys or WASD | Drag anywhere on the map |
| Talk, confirm | Z, Enter or Space | Tap what is in front of you |
| Menu, cancel | X or Escape | Tap the button in the top right corner |
| Mute | M | Options, in the menu |

Every menu entry can also be tapped or clicked directly, and the pad under the
screen works for anything else.

**The pad follows your thumb.** Press an arrow and slide to the next one without
lifting your finger. The corners of the cross count as the arrow nearest to
them, so a turn never drops the press.

**Your phone buzzes for 12 milliseconds on every press.** A glass screen gives a
thumb nothing to feel, and the buzz puts that back. Open the menu, choose
**Options**, and switch **Vibration** off if you would rather it did not. The
row appears only on a device that can vibrate, so an iPhone never shows it.

**On a phone the page rearranges itself.** Held upright, the game takes the full
width and the pad sits on the bottom edge, in reach of a thumb. Press Fullscreen
and the game fills the window with the pad floating faintly on top; held
sideways it does that on its own, because a sideways phone has no room under the
screen for a pad.

## Your save

The game saves itself to your browser as you play. Nothing is sent anywhere.

To carry a game to another device, open the menu, choose **Save**, then
**Download a copy**. That gives you a `.json` file. On the other device, choose
**Load a file** from the title screen or the save menu and pick it.

The file is plain readable JSON, and a save keeps working when new areas are
added later.

## How to run it locally

There is no build step. Serve the repository with any HTTP server and open the
folder:

```bash
python -m http.server 8000
# then visit http://localhost:8000/web-projects/akwaaba-monsters/
```

## Tests

```bash
bun test
```

Everything that can be tested without a browser is: the battle engine, the type
chart, the creature tables, the save document, the world rules, the script
engine, the pixel rasteriser, the note parser, the font metrics and the menu
arithmetic. The tests also check the *content*: that every map joins up, that
every trainer can be reached and can see you coming, and that no line of
dialogue uses a letter the font does not have.

## Everything here is made in code

There are no image files, no font files and no audio files anywhere in this
folder. Every creature, tile, person and letter is drawn from a list of shapes
when the page loads, and every note is played by the browser. The reasons are in
`adr/0001-draw-and-play-everything-from-code.md` and
`adr/0004-generated-audio-not-audio-files.md`.

No part of this game uses Nintendo's art, music, sound or code. It is an
original game in a familiar shape.
