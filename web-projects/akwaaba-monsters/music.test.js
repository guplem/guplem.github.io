import { describe, test, expect } from "bun:test";
import {
  DRUMS,
  cryFor,
  SONGS,
  SONG_IDS,
  channelLength,
  getSong,
  noteFrequency,
  parseChannel,
  parseToken,
  sixteenthSeconds,
  songLength,
  songSeconds,
} from "./music.js";

describe("noteFrequency", () => {
  test("puts A4 at 440 hertz, which is the reference every other note hangs off", () => {
    expect(noteFrequency("a4")).toBeCloseTo(440, 6);
  });

  test("doubles the frequency for every octave up", () => {
    expect(noteFrequency("a5")).toBeCloseTo(880, 6);
    expect(noteFrequency("a3")).toBeCloseTo(220, 6);
  });

  test("puts middle C where a piano puts it", () => {
    expect(noteFrequency("c4")).toBeCloseTo(261.626, 2);
  });

  test("reads sharps and flats, and agrees they are the same note", () => {
    expect(noteFrequency("f#4")).toBeCloseTo(369.994, 2);
    expect(noteFrequency("gb4")).toBeCloseTo(noteFrequency("f#4"), 6);
  });

  test("does not care about capitals or stray spaces", () => {
    expect(noteFrequency(" A4 ")).toBeCloseTo(440, 6);
    expect(noteFrequency("C5")).toBeCloseTo(noteFrequency("c5"), 6);
  });

  test("gives null for anything that is not a note", () => {
    expect(noteFrequency("h4")).toBeNull();
    expect(noteFrequency("c")).toBeNull();
    expect(noteFrequency("")).toBeNull();
    expect(noteFrequency(null)).toBeNull();
  });

  test("rises with every semitone, all the way up the keyboard", () => {
    const scale = ["c4", "c#4", "d4", "d#4", "e4", "f4", "f#4", "g4", "g#4", "a4", "a#4", "b4", "c5"];
    for (let i = 1; i < scale.length; i++) {
      expect(noteFrequency(scale[i])).toBeGreaterThan(noteFrequency(scale[i - 1]));
    }
  });
});

describe("parseToken", () => {
  test("reads a note and its length", () => {
    const note = parseToken("c4:8");
    expect(note.freq).toBeCloseTo(261.626, 2);
    expect(note.sixteenths).toBe(8);
    expect(note.drum).toBeNull();
  });

  test("reads a rest", () => {
    expect(parseToken("r:4")).toEqual({ freq: null, drum: null, sixteenths: 4 });
  });

  test("reads each drum", () => {
    for (const drum of DRUMS) expect(parseToken(`${drum}:2`).drum).toBe(drum);
  });

  test("defaults to a quarter note when no length is given", () => {
    expect(parseToken("c4").sixteenths).toBe(4);
  });

  test("refuses a length of zero or less, which would stall the song", () => {
    expect(parseToken("c4:0")).toBeNull();
    expect(parseToken("c4:-2")).toBeNull();
  });

  test("refuses nonsense instead of playing it", () => {
    expect(parseToken("banana:4")).toBeNull();
    expect(parseToken("")).toBeNull();
    expect(parseToken(null)).toBeNull();
  });
});

describe("parseChannel", () => {
  test("lays notes out one after another", () => {
    const notes = parseChannel("c4:4 e4:2 g4:8");
    expect(notes.map((note) => note.at)).toEqual([0, 4, 6]);
    expect(notes.length).toBe(3);
  });

  test("counts a rest as time passing, not as a note", () => {
    const notes = parseChannel("c4:4 r:4 e4:4");
    expect(notes[2].at).toBe(8);
    expect(notes[1].freq).toBeNull();
  });

  test("skips one bad token and keeps the rest of the song", () => {
    const notes = parseChannel("c4:4 wrong:4 e4:4");
    expect(notes.length).toBe(2);
    // The bad token takes no time, so the next note follows straight on.
    expect(notes[1].at).toBe(4);
  });

  test("copes with extra spaces and newlines", () => {
    expect(parseChannel("  c4:4\n  e4:4  ").length).toBe(2);
  });

  test("gives nothing for an empty channel", () => {
    expect(parseChannel("")).toEqual([]);
    expect(parseChannel(null)).toEqual([]);
  });
});

describe("lengths and timing", () => {
  test("a channel lasts as long as its notes add up to", () => {
    expect(channelLength("c4:4 e4:4 g4:8")).toBe(16);
    expect(channelLength("")).toBe(0);
  });

  test("a sixteenth gets shorter as the tempo rises", () => {
    expect(sixteenthSeconds(120)).toBeCloseTo(0.125, 5);
    expect(sixteenthSeconds(240)).toBeLessThan(sixteenthSeconds(120));
  });

  test("a silly tempo does not divide by zero", () => {
    expect(Number.isFinite(sixteenthSeconds(0))).toBe(true);
    expect(Number.isFinite(sixteenthSeconds(-40))).toBe(true);
  });

  test("a song is as long as its longest channel", () => {
    const song = {
      bpm: 120,
      channels: [{ notes: "c4:8" }, { notes: "c4:4 e4:4 g4:8" }],
    };
    expect(songLength(song)).toBe(16);
    expect(songSeconds(song)).toBeCloseTo(2, 5);
  });

  test("a song with no channels has no length", () => {
    expect(songLength({ bpm: 120, channels: [] })).toBe(0);
  });
});

describe("the songs themselves", () => {
  const allSongs = SONG_IDS.map((id) => SONGS[id]);

  test("cover every moment the game needs music for", () => {
    for (const id of ["title", "town", "route", "cave", "battle", "boss", "victory", "heal"]) {
      expect(SONG_IDS).toContain(id);
    }
  });

  test("all have a sensible tempo and at least one channel", () => {
    for (const song of allSongs) {
      expect(song.bpm).toBeGreaterThan(40);
      expect(song.bpm).toBeLessThan(260);
      expect(song.channels.length).toBeGreaterThan(0);
    }
  });

  test("only use voices the player can make a sound with", () => {
    for (const song of allSongs) {
      for (const channel of song.channels) {
        expect(["pulse", "tri", "noise"]).toContain(channel.voice);
      }
    }
  });

  test("keep every channel quiet enough that four together do not clip", () => {
    for (const song of allSongs) {
      const total = song.channels.reduce((sum, channel) => sum + channel.gain, 0);
      expect(total).toBeLessThanOrEqual(0.8);
    }
  });

  test("contain no token the parser has to throw away", () => {
    for (const [id, song] of Object.entries(SONGS)) {
      for (const channel of song.channels) {
        const written = channel.notes.trim().split(/\s+/).length;
        const read = parseChannel(channel.notes).length;
        expect(`${id}: ${read} of ${written}`).toBe(`${id}: ${written} of ${written}`);
      }
    }
  });

  test("only put drum names on the drum channel, and notes everywhere else", () => {
    for (const song of allSongs) {
      for (const channel of song.channels) {
        for (const note of parseChannel(channel.notes)) {
          if (channel.voice === "noise") expect(note.freq).toBeNull();
          else expect(note.drum).toBeNull();
        }
      }
    }
  });

  test("loop for long enough not to grate, and short enough to stay in memory", () => {
    for (const [id, song] of Object.entries(SONGS)) {
      const seconds = songSeconds(song);
      if (id === "heal") continue; // a short jingle, not a loop
      expect(seconds).toBeGreaterThan(2);
      expect(seconds).toBeLessThan(40);
    }
  });

  test("the boss theme is faster than the ordinary battle theme", () => {
    expect(SONGS.boss.bpm).toBeGreaterThan(SONGS.battle.bpm);
  });

  test("the cave theme is the slowest thing in the game", () => {
    const others = SONG_IDS.filter((id) => id !== "cave" && id !== "heal");
    for (const id of others) expect(SONGS.cave.bpm).toBeLessThan(SONGS[id].bpm);
  });
});

describe("getSong", () => {
  test("finds a song and returns null for one that is not there", () => {
    expect(getSong("town").bpm).toBe(132);
    expect(getSong("elevator")).toBeNull();
  });
});

describe("cryFor", () => {
  test("gives the same creature the same voice every time", () => {
    expect(cryFor("polete", 3.4)).toEqual(cryFor("polete", 3.4));
  });

  test("gives different creatures different voices", () => {
    expect(cryFor("polete", 3.4)).not.toEqual(cryFor("nacho", 402));
  });

  test("makes a heavy creature sound lower than a light one", () => {
    expect(cryFor("same", 400).start).toBeLessThan(cryFor("same", 0.5).start);
  });

  test("never drops below what a speaker can play, whatever the weight", () => {
    for (const weight of [0.01, 0.4, 20, 400, 100000]) {
      const cry = cryFor("test", weight);
      expect(cry.start).toBeGreaterThanOrEqual(70);
      expect(cry.end).toBeGreaterThanOrEqual(70);
      expect(Number.isFinite(cry.start)).toBe(true);
    }
  });

  test("keeps every cry short enough to sit inside a battle turn", () => {
    for (const id of ["baobo", "nacho", "gis", "sasabon", "tsetse", "carsla"]) {
      const cry = cryFor(id, 20);
      expect(cry.seconds).toBeGreaterThan(0.2);
      expect(cry.seconds).toBeLessThan(0.7);
    }
  });

  test("survives being asked about nothing", () => {
    expect(Number.isFinite(cryFor(null).start)).toBe(true);
  });
});
