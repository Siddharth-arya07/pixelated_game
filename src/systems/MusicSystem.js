import * as THREE from 'three';

/**
 * MusicSystem
 * -----------
 * One music player shared by the laptop (Winamp-style app), the house stereo
 * and the lighthouse radio. Whatever device you use becomes the "speaker"
 * (a positional sound source) — walk away from the stereo and it gets quieter.
 *
 * Tracks:
 *  - built-in generative songs (synthesised live with WebAudio: drums, bass,
 *    chords, melody — deterministic per track, so they're the same every time)
 *  - any .mp3/.ogg/.wav in src/assets/music (auto-discovered, decoded on play)
 *
 *   music.useSpeaker(object3D)   music.play(i) / pause() / toggle() / next() / prev()
 *   music.seek(seconds)          music.volume = 0..1
 *   music.current / .position / .duration / .playing / .spectrum()
 */
const musicFiles = import.meta.glob('../assets/music/*.{mp3,ogg,wav,m4a}', { eager: true, query: '?url', import: 'default' });

/**
 * The mixtape. These are slots: the audio comes from files you load into
 * the Walkman yourself (they're kept in this browser only, never uploaded or
 * bundled with the game). A loaded file fills the slot whose `match` words
 * all appear in its file name; anything else is added after the mixtape.
 */
export const MIXTAPE = [
  { title: 'Motion Picture Soundtrack', artist: 'Radiohead', match: ['motion', 'picture'] },
  { title: 'Shine On You Crazy Diamond (Pts. 1–5)', artist: 'Pink Floyd', match: ['shine', 'diamond'] },
  { title: 'Need 2', artist: 'Pinegrove', match: ['need', '2'] },
  { title: 'Wading in Waist-High Water', artist: 'Fleet Foxes', match: ['wading'] },
  { title: 'A Quick One Before the Eternal Worm Devours Connecticut', artist: 'Have a Nice Life', match: ['worm'] },
  { title: 'Smokestack Lightning', artist: "Howlin' Wolf", match: ['smokestack'] },
  { title: 'The Chain', artist: 'Fleetwood Mac', match: ['chain'] },
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ');

// Tiny IndexedDB wrapper for the user's own song files.
const DB = 'three-am-music';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('songs', { keyPath: 'name' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbAll() {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const q = db.transaction('songs').objectStore('songs').getAll();
      q.onsuccess = () => res(q.result ?? []);
      q.onerror = () => res([]);
    });
  } catch {
    return [];
  }
}
async function idbPut(rec) {
  const db = await idb();
  return new Promise((res) => {
    const tx = db.transaction('songs', 'readwrite');
    tx.objectStore('songs').put(rec);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}
async function idbDelete(name) {
  const db = await idb();
  return new Promise((res) => {
    const tx = db.transaction('songs', 'readwrite');
    tx.objectStore('songs').delete(name);
    tx.oncomplete = () => res();
  });
}

const NOTE = (semi) => 220 * Math.pow(2, semi / 12); // A3 = 0

/** Generative song definitions: chords are semitone offsets from A3. */
const SONGS = [
  {
    title: '3AM Laundromat',
    artist: 'night shift tapes',
    style: 'lofi',
    bpm: 74,
    bars: 64,
    chords: [
      [0, 3, 7, 10], // Am7
      [-4, 0, 3, 7], // Fmaj7
      [3, 7, 10, 14], // Cmaj7
      [-2, 2, 5, 9], // G6
    ],
    seed: 3,
  },
  {
    title: 'Route 9 Fog',
    artist: 'lowtide',
    style: 'ambient',
    bpm: 56,
    bars: 40,
    chords: [
      [-5, 2, 7, 11],
      [-7, 0, 5, 9],
      [-3, 4, 7, 11],
      [-8, -1, 4, 7],
    ],
    seed: 9,
  },
  {
    title: 'Neon Pumps',
    artist: 'QUIK MART FM',
    style: 'synthwave',
    bpm: 98,
    bars: 72,
    chords: [
      [-3, 0, 4, 7],
      [-7, -3, 0, 5],
      [0, 3, 7, 10],
      [-5, -1, 2, 7],
    ],
    seed: 21,
  },
  {
    title: 'Lighthouse Keeper',
    artist: 'the foghorns',
    style: 'jazz',
    bpm: 82,
    bars: 56,
    chords: [
      [2, 5, 9, 12], // Dm9-ish
      [-5, -1, 2, 5], // G7
      [0, 4, 7, 11], // Cmaj7
      [-3, 0, 4, 7], // Am7
    ],
    seed: 14,
  },
  {
    title: 'Microwave Hum',
    artist: 'night shift tapes',
    style: 'lofi',
    bpm: 86,
    bars: 64,
    chords: [
      [5, 9, 12, 16],
      [3, 7, 10, 14],
      [0, 3, 7, 10],
      [-2, 2, 5, 10],
    ],
    seed: 33,
  },
];

export class MusicSystem {
  constructor(game) {
    this.game = game;
    this.audio = game.audio;
    this.ctx = game.audio.ctx;
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.8;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.out.connect(this.analyser);
    this._spectrum = new Uint8Array(this.analyser.frequencyBinCount);
    // Sources play into `input`; the tape chain sits between it and `out`.
    this.input = this.ctx.createGain();
    this.#buildTape();
    this.tape = true;

    // Bundled recordings first, then the mixtape slots, then the generative songs.
    this.tracks = Object.entries(musicFiles).map(([path, url]) => ({
      kind: 'file',
      title: path.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_]+/g, ' '),
      artist: 'recorded at 3 a.m.',
      url,
      duration: 0,
    }));
    this.tracks.push(...MIXTAPE.map((m) => ({ ...m, kind: 'file', mixtape: true, url: null, blob: null, duration: 0 })));
    this.tracks.push(...SONGS.map((s) => ({ ...s, kind: 'gen', duration: (s.bars * 4 * 60) / s.bpm })));
    this.index = 0;
    this.playing = false;
    this.headphones = false;
    this.#loadLibrary();
    this.position = 0; // seconds into the current track
    this.speaker = null;
    this._gen = null;
    this._src = null;
  }

  get current() {
    return this.tracks[this.index];
  }

  get duration() {
    return this.current.duration || 0;
  }

  get volume() {
    return this.out.gain.value;
  }

  set volume(v) {
    this.out.gain.value = THREE.MathUtils.clamp(v, 0, 1);
  }

  /** Walkman: straight into your ears, wherever you go. */
  useHeadphones() {
    if (this.headphones) return;
    this.#dropSpeaker();
    this.headphones = true;
    this.speakerObject = null;
    this.speakerTap = this.ctx.createGain();
    this.out.connect(this.speakerTap);
    this.speakerTap.connect(this.audio.master);
  }

  #dropSpeaker() {
    if (this.speaker) {
      this.speaker.disconnect();
      this.speaker.parent?.remove(this.speaker);
      this.speaker = null;
    }
    this.speakerTap?.disconnect();
    this.speakerTap = null;
    this.headphones = false;
  }

  /** Move the sound to a device (laptop, stereo, radio…). */
  useSpeaker(object) {
    if (this.speakerObject === object && !this.headphones) return;
    if (this.headphones) this.#dropSpeaker();
    if (this.speaker) {
      this.speaker.disconnect();
      this.speaker.parent?.remove(this.speaker);
    }
    const s = new THREE.PositionalAudio(this.audio.listener);
    s.setRefDistance(2.2);
    s.setRolloffFactor(1.4);
    s.setMaxDistance(40);
    object.add(s);
    // A gain node per speaker so we can re-point without reconnecting the graph.
    const tap = this.ctx.createGain();
    this.out.connect(tap);
    s.setNodeSource(tap);
    this.speaker = s;
    this.speakerTap?.disconnect();
    this.speakerTap = tap;
    this.speakerObject = object;
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  async play(i = this.index) {
    this.audio.resume();
    if (i !== this.index) {
      this.#stopSources();
      this.index = (i + this.tracks.length) % this.tracks.length;
      this.position = 0;
    }
    // Empty mixtape slot (file not loaded yet): skip ahead.
    if (!this.#playable(this.current)) {
      const n = this.tracks.findIndex((t, k) => k > this.index && this.#playable(t));
      const k = n >= 0 ? n : this.tracks.findIndex((t) => this.#playable(t));
      this.index = k;
      this.position = 0;
    }
    this.playing = true;
    const t = this.current;
    if (t.kind === 'gen') this.#startGen(t, this.position);
    else await this.#startFile(t, this.position);
    this.onChange?.();
  }

  #playable(t) {
    return t.kind === 'gen' || !!(t.url || t.blob || t.buffer);
  }

  pause() {
    this.playing = false;
    this.#stopSources();
    this.onChange?.();
  }

  next() {
    let i = this.index + 1;
    for (let n = 0; n < this.tracks.length && !this.#playable(this.tracks[i % this.tracks.length]); n++) i++;
    this.play(i % this.tracks.length);
  }

  prev() {
    if (this.position > 3) this.seek(0);
    else this.play(this.index - 1);
  }

  seek(seconds) {
    this.position = THREE.MathUtils.clamp(seconds, 0, Math.max(0, this.duration - 0.5));
    if (this.playing) {
      this.#stopSources();
      this.play();
    }
  }

  /** 0..1 per band for the visualizer. */
  spectrum() {
    this.analyser.getByteFrequencyData(this._spectrum);
    return this._spectrum;
  }

  update(dt) {
    this.hissGain.gain.setTargetAtTime(this.playing && this.tape ? 0.012 : 0, this.ctx.currentTime, 0.2);
    if (!this.playing) return;
    this.position += dt;
    if (this._gen) this._gen.schedule();
    if (this.duration && this.position >= this.duration) this.next();
  }

  #stopSources() {
    this._gen?.stop();
    this._gen = null;
    try {
      this._src?.stop();
    } catch {}
    this._src = null;
  }

  async #startFile(t, offset) {
    if (!t.buffer) {
      try {
        const data = t.blob ? await t.blob.arrayBuffer() : await (await fetch(t.url)).arrayBuffer();
        t.buffer = await this.ctx.decodeAudioData(data);
        t.duration = t.buffer.duration;
      } catch (e) {
        console.warn('[Music] could not load', t.url, e);
        return this.next();
      }
    }
    if (!this.playing || this.current !== t) return;
    const src = this.ctx.createBufferSource();
    src.buffer = t.buffer;
    src.connect(this.input);
    src.start(0, offset);
    this._src = src;
  }

  // ---- your own files ----------------------------------------------------------

  /** Add files (from a file picker / drop). Saved in IndexedDB. */
  async addFiles(files) {
    let n = 0;
    for (const f of files) {
      if (!f.type.startsWith('audio/') && !/\.(mp3|ogg|wav|m4a|flac|aac)$/i.test(f.name)) continue;
      await idbPut({ name: f.name, blob: f });
      this.#attach(f.name, f);
      n++;
    }
    this.onChange?.();
    return n;
  }

  async removeFile(t) {
    if (!t.fileName) return;
    await idbDelete(t.fileName);
    if (this.current === t && this.playing) this.pause();
    if (t.mixtape) Object.assign(t, { blob: null, buffer: null, fileName: null, duration: 0 });
    else this.tracks.splice(this.tracks.indexOf(t), 1);
    this.onChange?.();
  }

  async #loadLibrary() {
    for (const rec of await idbAll()) this.#attach(rec.name, rec.blob);
    this.onChange?.();
  }

  #attach(name, blob) {
    const base = name.replace(/\.[^.]+$/, '');
    const words = norm(base).split(' ');
    const slot = this.tracks.find((t) => t.mixtape && !t.blob && t.match.every((m) => words.includes(m) || norm(base).includes(m)));
    if (slot) {
      Object.assign(slot, { blob, fileName: name, buffer: null, duration: 0 });
      return;
    }
    if (this.tracks.some((t) => t.fileName === name)) return;
    const extra = { kind: 'file', title: base.replace(/[_-]+/g, ' '), artist: 'your file', blob, fileName: name, duration: 0 };
    const firstGen = this.tracks.findIndex((t) => t.kind === 'gen');
    this.tracks.splice(firstGen < 0 ? this.tracks.length : firstGen, 0, extra);
  }

  // ---- retro tape sound -----------------------------------------------------------

  /**
   * Cassette-deck colouring: band-limited (≈90 Hz – 6 kHz), a little
   * saturation, wow (slow pitch drift) and flutter (fast wobble) from a
   * modulated delay, slightly narrowed, plus tape hiss while playing.
   */
  #buildTape() {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6000;
    lp.Q.value = 0.5;
    const warm = ctx.createBiquadFilter();
    warm.type = 'peaking';
    warm.frequency.value = 900;
    warm.gain.value = 2.5;
    const sat = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
    }
    sat.curve = curve;
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 0.012;
    const wow = ctx.createOscillator();
    wow.frequency.value = 0.55;
    const wowAmt = ctx.createGain();
    wowAmt.gain.value = 0.0011;
    const flutter = ctx.createOscillator();
    flutter.frequency.value = 6.8;
    const flAmt = ctx.createGain();
    flAmt.gain.value = 0.00012;
    wow.connect(wowAmt).connect(delay.delayTime);
    flutter.connect(flAmt).connect(delay.delayTime);
    wow.start();
    flutter.start();
    // Hiss: quiet filtered noise, only audible while something plays.
    const hiss = this.audio.noiseSource();
    const hissF = ctx.createBiquadFilter();
    hissF.type = 'highpass';
    hissF.frequency.value = 3500;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    hiss.connect(hissF).connect(this.hissGain).connect(this.out);
    hiss.start();

    this.tapeIn = ctx.createGain();
    this.tapeIn.connect(hp).connect(lp).connect(warm).connect(sat).connect(delay).connect(this.out);
    this.dry = ctx.createGain();
    this.dry.connect(this.out);
    this.input.connect(this.tapeIn);
  }

  setTape(on) {
    this.tape = on;
    this.input.disconnect();
    this.input.connect(on ? this.tapeIn : this.dry);
    this.onChange?.();
  }

  #startGen(song, offset) {
    this._gen = new Sequencer(this, song, offset);
  }
}

// -----------------------------------------------------------------------------
// Generative sequencer
// -----------------------------------------------------------------------------

class Sequencer {
  constructor(music, song, offset) {
    this.music = music;
    this.ctx = music.ctx;
    this.song = song;
    this.step = 60 / song.bpm / 4; // 16th notes
    this.startTime = this.ctx.currentTime - offset;
    this.nextStep = Math.floor(offset / this.step);
    this.rand = mulberry(song.seed);
    this.nodes = new Set();
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0.9;
    // Lo-fi colour: lowpass the whole mix + a little vinyl hiss.
    this.tone = this.ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = song.style === 'synthwave' ? 5000 : song.style === 'ambient' ? 2200 : 3200;
    this.bus.connect(this.tone).connect(music.input);
    if (song.style === 'lofi' || song.style === 'jazz') {
      this.hiss = music.audio.noiseSource();
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      const g = this.ctx.createGain();
      g.gain.value = 0.012;
      this.hiss.connect(hp).connect(g).connect(this.bus);
      this.hiss.start();
    }
    this.melodyNote = 7;
    this.schedule();
  }

  stop() {
    this.stopped = true;
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {}
    }
    this.hiss?.stop();
    const t = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => this.bus.disconnect(), 400);
  }

  /** Schedule everything that starts within the next 0.25 s. */
  schedule() {
    if (this.stopped) return;
    const ahead = this.ctx.currentTime + 0.25;
    while (this.startTime + this.nextStep * this.step < ahead) {
      this.#playStep(this.nextStep, this.startTime + this.nextStep * this.step);
      this.nextStep++;
    }
  }

  #playStep(n, t) {
    const s = this.song;
    const bar = Math.floor(n / 16);
    const k = n % 16;
    const chord = s.chords[bar % s.chords.length];
    const r = this.rand;
    // Swing the off-16ths a little for lo-fi / jazz.
    if ((s.style === 'lofi' || s.style === 'jazz') && k % 2 === 1) t += this.step * 0.18;
    const intro = bar < 2;

    switch (s.style) {
      case 'lofi':
        if (!intro && (k === 0 || k === 10 || (k === 7 && r() < 0.4))) this.#kick(t, 0.8);
        if (!intro && (k === 4 || k === 12)) this.#snare(t, 0.35);
        if (k % 2 === 0) this.#hat(t, k % 4 === 0 ? 0.12 : 0.06);
        if (k === 0) this.#chord(chord, t, this.step * 15, 0.06, 'triangle');
        if (!intro && (k === 0 || k === 8 || (k === 14 && r() < 0.5))) this.#bass(chord[0] - 12, t, this.step * 3, 0.32);
        if (bar >= 4 && k % 4 === 2 && r() < 0.45) this.#melody(chord, t, this.step * 2, 0.06, 'sine');
        break;
      case 'ambient':
        if (k === 0) this.#chord(chord, t, this.step * 16, 0.07, 'sine', 1.2);
        if (k === 0 && bar % 2 === 0) this.#bass(chord[0] - 24, t, this.step * 30, 0.2);
        if (k % 8 === 4 && r() < 0.5) this.#melody(chord, t, this.step * 6, 0.04, 'triangle');
        break;
      case 'synthwave':
        if (!intro && k % 4 === 0) this.#kick(t, 0.75);
        if (!intro && (k === 4 || k === 12)) this.#snare(t, 0.4);
        if (k % 2 === 1) this.#hat(t, 0.07);
        if (k === 0) this.#chord(chord, t, this.step * 16, 0.04, 'sawtooth', 0.3);
        this.#arp(chord, k, t, this.step * 0.9, 0.035);
        if (k % 2 === 0) this.#bass(chord[0] - 12, t, this.step * 1.6, 0.22, 'sawtooth');
        break;
      case 'jazz':
        if (k % 4 === 0) this.#hat(t, 0.05, true); // brushes
        if (k === 0 || k === 6 || k === 8) this.#chord(chord, t, this.step * 5, 0.05, 'triangle');
        if (k % 4 === 0) this.#bass(chord[(k / 4) % chord.length] - 12, t, this.step * 3.5, 0.3); // walking bass
        if (bar >= 2 && k % 2 === 0 && r() < 0.35) this.#melody(chord, t, this.step * 2, 0.06, 'sine');
        break;
    }
  }

  #voice(type, freq, t, dur, peak, attack = 0.01) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + Math.max(attack, dur * 0.6), dur * 0.3);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.5);
    this.nodes.add(o);
    o.onended = () => this.nodes.delete(o);
    return o;
  }

  #chord(chord, t, dur, peak, type, attack = 0.04) {
    for (const semi of chord) {
      const o = this.#voice(type, NOTE(semi), t, dur, peak, attack);
      o.detune.value = (this.rand() - 0.5) * 18; // tape wobble
    }
  }

  #bass(semi, t, dur, peak, type = 'triangle') {
    this.#voice(type, NOTE(semi), t, dur, peak, 0.005);
  }

  #melody(chord, t, dur, peak, type) {
    // Random walk on a pentatonic-ish set built from the chord.
    const pool = [...chord, chord[0] + 12, chord[1] + 12];
    this.melodyNote = pool[Math.floor(this.rand() * pool.length)];
    this.#voice(type, NOTE(this.melodyNote + 12), t, dur, peak, 0.01);
  }

  #arp(chord, k, t, dur, peak) {
    const pat = [0, 1, 2, 3, 2, 1];
    const semi = chord[pat[k % pat.length]] + (k >= 8 ? 12 : 0);
    this.#voice('square', NOTE(semi + 12), t, dur, peak, 0.002);
  }

  #kick(t, peak) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.35);
    this.nodes.add(o);
    o.onended = () => this.nodes.delete(o);
  }

  #noise(t, dur, peak, freq, type) {
    const ctx = this.ctx;
    const n = this.music.audio.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(this.bus);
    n.start(t, Math.random());
    n.stop(t + dur + 0.05);
    this.nodes.add(n);
    n.onended = () => this.nodes.delete(n);
  }

  #snare(t, peak) {
    this.#noise(t, 0.18, peak, 1800, 'bandpass');
    this.#voice('triangle', 190, t, 0.06, peak * 0.4, 0.002);
  }

  #hat(t, peak, brush = false) {
    this.#noise(t, brush ? 0.18 : 0.04, peak, brush ? 5000 : 8000, 'highpass');
  }
}

function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
