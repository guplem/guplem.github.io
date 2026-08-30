// The sound engine.
//
// Everything you hear is made in the browser: three square-wave voices, a
// triangle bass and a noise channel for the drums, plus short procedural
// effects. There are no audio files to download, which is the whole reason a
// game this size is a folder of text (ADR 0004).
//
// The notes live in `music.js` and are pure. This file is the part that touches
// the browser, so it holds no melody of its own and has no tests: everything
// worth testing was pushed next door.
//
// Browsers refuse to make a sound until the player has touched the page, so
// `unlock()` must be called from a real key press or tap. Calling it again is
// harmless.

import {
  getSong,
  cryFor,
  parseChannel,
  sixteenthSeconds,
  songLength,
} from "./music.js";

/** How often the scheduler wakes up, in milliseconds. */
const TICK_MS = 40;

/** How far ahead the scheduler queues notes, in seconds. */
const LOOKAHEAD = 0.3;

/** Where the muted setting is remembered between visits. */
export const MUTE_KEY = "akwaaba-monsters:muted";

export class AudioEngine {
  /**
   * @param {object} [options]
   * @param {Storage} [options.storage] where to remember the muted setting
   */
  constructor({ storage = globalThis.localStorage } = {}) {
    this.storage = storage;
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.noiseBuffer = null;
    this.waves = new Map();
    this.currentSong = null;
    this.timer = null;
    this.nextNoteTime = 0;
    this.position = 0;
    this.muted = this.#readMuted();
  }

  #readMuted() {
    try {
      return this.storage?.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  }

  #writeMuted() {
    try {
      this.storage?.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      // A browser that refuses to store the setting still plays sound.
    }
  }

  /**
   * Start the sound system. Must run inside a real key press or tap.
   * @returns {boolean} true once sound is available
   */
  unlock() {
    if (this.context) {
      if (this.context.state === "suspended") this.context.resume();
      return true;
    }
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return false;
    try {
      this.context = new Ctor();
    } catch {
      return false;
    }
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.context.destination);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 1;
    this.musicGain.connect(this.master);
    this.#buildNoise();
    return true;
  }

  /** True when sound is running. */
  get ready() {
    return Boolean(this.context);
  }

  /** Turn the sound on or off, and remember the choice. */
  setMuted(muted) {
    this.muted = Boolean(muted);
    this.#writeMuted();
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.context.currentTime, 0.02);
    }
  }

  /** Flip between on and off. Returns the new setting. */
  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Two seconds of white noise, reused by every drum and every hiss. */
  #buildNoise() {
    const length = Math.floor(this.context.sampleRate * 2);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
  }

  /**
   * A square wave with the given duty cycle.
   *
   * A plain "square" oscillator is always half on and half off. Real chip music
   * leans on narrower pulses for its thin, reedy voices, so the wave is built
   * from its harmonics: for a pulse that is on for a fraction d of each cycle,
   * harmonic n has amplitude sin(n * pi * d) * 2 / (n * pi).
   */
  #pulseWave(duty) {
    const key = String(duty);
    if (this.waves.has(key)) return this.waves.get(key);
    const harmonics = 24;
    const real = new Float32Array(harmonics);
    const imag = new Float32Array(harmonics);
    for (let n = 1; n < harmonics; n++) {
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    }
    const wave = this.context.createPeriodicWave(real, imag, { disableNormalization: false });
    this.waves.set(key, wave);
    return wave;
  }

  /** One tone with an attack and a release, so nothing clicks. */
  #tone({ freq, start, seconds, gain, voice = "pulse", duty = 0.5, destination, slideTo = null }) {
    const target = destination ?? this.master;
    const oscillator = this.context.createOscillator();
    if (voice === "tri") oscillator.type = "triangle";
    else oscillator.setPeriodicWave(this.#pulseWave(duty));
    oscillator.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + seconds);
    }
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.008);
    envelope.gain.setValueAtTime(gain, start + Math.max(0.01, seconds - 0.04));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(envelope);
    envelope.connect(target);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  /** One drum hit, cut out of the noise buffer with a filter. */
  #drum({ drum, start, gain, destination }) {
    const target = destination ?? this.master;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();

    if (drum === "k") {
      // A kick is mostly a falling tone, not noise at all.
      this.#tone({
        freq: 150,
        slideTo: 45,
        start,
        seconds: 0.16,
        gain: gain * 2.2,
        voice: "tri",
        destination: target,
      });
      return;
    }
    if (drum === "s") {
      filter.type = "bandpass";
      filter.frequency.value = 1900;
      filter.Q.value = 0.8;
      envelope.gain.setValueAtTime(gain * 1.6, start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      source.start(start);
      source.stop(start + 0.15);
    } else {
      filter.type = "highpass";
      filter.frequency.value = 7000;
      envelope.gain.setValueAtTime(gain * 0.9, start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);
      source.start(start);
      source.stop(start + 0.06);
    }
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(target);
  }

  /**
   * Start a song, looping.
   * Asking for the song already playing does nothing, so walking between two
   * maps with the same theme never restarts it.
   */
  playMusic(id) {
    if (!this.context) return;
    if (this.currentSong?.id === id) return;
    const song = getSong(id);
    this.stopMusic();
    if (!song) return;

    const channels = song.channels.map((channel) => ({
      ...channel,
      parsed: parseChannel(channel.notes),
    }));
    this.currentSong = { id, song, channels, length: songLength(song) };
    this.position = 0;
    this.nextNoteTime = this.context.currentTime + 0.06;
    this.#schedule();
    this.timer = setInterval(() => this.#schedule(), TICK_MS);
  }

  /** Stop whatever is playing. */
  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.currentSong = null;
  }

  /** What is playing now, or null. */
  get playing() {
    return this.currentSong?.id ?? null;
  }

  /** Queue up whatever falls inside the look-ahead window. */
  #schedule() {
    const current = this.currentSong;
    if (!current || !this.context) return;
    const step = sixteenthSeconds(current.song.bpm);
    const until = this.context.currentTime + LOOKAHEAD;

    while (this.nextNoteTime < until) {
      const beat = this.position % current.length;
      for (const channel of current.channels) {
        for (const note of channel.parsed) {
          if (note.at !== beat) continue;
          const seconds = note.sixteenths * step * 0.92;
          if (note.drum) {
            this.#drum({
              drum: note.drum,
              start: this.nextNoteTime,
              gain: channel.gain,
              destination: this.musicGain,
            });
          } else if (note.freq) {
            this.#tone({
              freq: note.freq,
              start: this.nextNoteTime,
              seconds,
              gain: channel.gain,
              voice: channel.voice,
              duty: channel.duty ?? 0.5,
              destination: this.musicGain,
            });
          }
        }
      }
      this.nextNoteTime += step;
      this.position += 1;
    }
  }

  /** Duck the music while something louder happens, then bring it back. */
  duck(seconds = 0.5) {
    if (!this.musicGain) return;
    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(0.25, now, 0.02);
    this.musicGain.gain.setTargetAtTime(1, now + seconds, 0.15);
  }

  /**
   * A short effect.
   *
   * @param {string} name one of the names below
   */
  playSound(name) {
    if (!this.context) return;
    const now = this.context.currentTime + 0.005;
    const tone = (options) => this.#tone({ start: now, gain: 0.16, ...options });

    switch (name) {
      case "blip":
        tone({ freq: 900, seconds: 0.05, duty: 0.25, gain: 0.1 });
        break;
      case "select":
        tone({ freq: 660, seconds: 0.06, duty: 0.5 });
        this.#tone({ freq: 990, start: now + 0.06, seconds: 0.09, gain: 0.14, duty: 0.5 });
        break;
      case "back":
        tone({ freq: 500, seconds: 0.06, duty: 0.25 });
        this.#tone({ freq: 320, start: now + 0.05, seconds: 0.08, gain: 0.12, duty: 0.25 });
        break;
      case "bump":
        tone({ freq: 150, seconds: 0.08, voice: "tri", gain: 0.2 });
        break;
      case "step":
        this.#drum({ drum: "h", start: now, gain: 0.05 });
        break;
      case "hit":
        this.#drum({ drum: "s", start: now, gain: 0.18 });
        tone({ freq: 260, slideTo: 90, seconds: 0.16, voice: "tri", gain: 0.22 });
        break;
      case "hitStrong":
        this.#drum({ drum: "s", start: now, gain: 0.26 });
        tone({ freq: 340, slideTo: 70, seconds: 0.26, voice: "tri", gain: 0.3 });
        this.#tone({ freq: 180, start: now + 0.05, seconds: 0.24, gain: 0.2, duty: 0.125 });
        break;
      case "hitWeak":
        tone({ freq: 200, slideTo: 130, seconds: 0.1, voice: "tri", gain: 0.12 });
        break;
      case "miss":
        tone({ freq: 700, slideTo: 260, seconds: 0.14, duty: 0.125, gain: 0.11 });
        break;
      case "faint":
        tone({ freq: 420, slideTo: 60, seconds: 0.55, duty: 0.25, gain: 0.2 });
        break;
      case "heal":
        [523, 659, 784, 1046].forEach((freq, index) => {
          this.#tone({ freq, start: now + index * 0.08, seconds: 0.14, gain: 0.14, duty: 0.5 });
        });
        break;
      case "levelUp":
        [523, 659, 784, 1046, 1318].forEach((freq, index) => {
          this.#tone({ freq, start: now + index * 0.07, seconds: 0.18, gain: 0.15, duty: 0.5 });
        });
        break;
      case "throw":
        tone({ freq: 300, slideTo: 900, seconds: 0.22, duty: 0.25, gain: 0.13 });
        break;
      case "shake":
        tone({ freq: 480, seconds: 0.07, duty: 0.125, gain: 0.13 });
        break;
      case "caught":
        [784, 988, 1318].forEach((freq, index) => {
          this.#tone({ freq, start: now + index * 0.1, seconds: 0.22, gain: 0.16, duty: 0.5 });
        });
        break;
      case "escape":
        tone({ freq: 620, slideTo: 200, seconds: 0.2, duty: 0.25, gain: 0.13 });
        break;
      case "save":
        tone({ freq: 700, seconds: 0.08, duty: 0.5, gain: 0.13 });
        this.#tone({ freq: 1050, start: now + 0.09, seconds: 0.16, gain: 0.13, duty: 0.5 });
        break;
      case "money":
        [880, 1320].forEach((freq, index) => {
          this.#tone({ freq, start: now + index * 0.05, seconds: 0.09, gain: 0.12, duty: 0.125 });
        });
        break;
      case "door":
        this.#drum({ drum: "s", start: now, gain: 0.1 });
        tone({ freq: 220, slideTo: 160, seconds: 0.12, voice: "tri", gain: 0.14 });
        break;
      default:
        break;
    }
  }

  /**
   * A creature's cry, worked out from its name and its weight.
   * Two voices slightly apart give it the grain a single tone lacks.
   */
  playCry(speciesId, weight) {
    if (!this.context) return;
    const cry = cryFor(speciesId, weight);
    const now = this.context.currentTime + 0.01;
    this.duck(cry.seconds + 0.2);
    this.#tone({
      freq: cry.start,
      slideTo: cry.end,
      start: now,
      seconds: cry.seconds,
      gain: 0.2,
      duty: cry.rough > 0.4 ? 0.125 : 0.25,
    });
    this.#tone({
      freq: cry.start * 1.5,
      slideTo: cry.end * 1.5,
      start: now + 0.01,
      seconds: cry.seconds * 0.8,
      gain: 0.07,
      duty: 0.5,
    });
    if (cry.rough > 0.45) {
      this.#drum({ drum: "h", start: now, gain: 0.06 });
    }
  }
}
