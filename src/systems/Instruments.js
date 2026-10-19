import * as THREE from 'three';

/**
 * Instruments
 * -----------
 * A little stage (in the diner): piano, acoustic guitar, drum kit and a
 * karaoke mic. Sit/stand at one and the camera leans in; your keyboard plays it.
 *
 *   PIANO   A S D F G H J K L ; = white keys, W E · T Y U · O P = black keys
 *           Z / X octave down / up · hold SPACE = sustain pedal · TAB gets up
 *   GUITAR  1–8 choose chord (C G Am F Em Dm D E) · SPACE / click strum down ·
 *           B strum up · H…; pick single strings
 *   DRUMS   SPACE kick · F snare · J hi-hat · K open hat · A/S/D toms ·
 *           L crash · ; ride
 *   KARAOKE pick a song (← →), ENTER to start: backing track + lyrics on the
 *           screen. M = sing through the speakers with your real mic (use
 *           headphones!) — the reverb is very flattering.
 *
 * Every note is synthesised (WebAudio: additive piano, Karplus-Strong guitar,
 * analog-style drums) from the instrument's position, and sent to the room
 * so friends hear the jam (net event 'note').
 */
const PIANO_WHITE = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
const PIANO_WHITE_SEMI = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const PIANO_BLACK = { KeyW: 1, KeyE: 3, KeyT: 6, KeyY: 8, KeyU: 10, KeyO: 13, KeyP: 15 };

// guitar: standard tuning E2 A2 D3 G3 B3 E4 (midi), chord shapes as frets (-1 = muted)
const STRINGS = [40, 45, 50, 55, 59, 64];
const CHORDS = {
  C: [-1, 3, 2, 0, 1, 0],
  G: [3, 2, 0, 0, 0, 3],
  Am: [-1, 0, 2, 2, 1, 0],
  F: [1, 3, 3, 2, 1, 1],
  Em: [0, 2, 2, 0, 0, 0],
  Dm: [-1, -1, 0, 2, 3, 1],
  D: [-1, -1, 0, 2, 3, 2],
  E: [0, 2, 2, 1, 0, 0],
};
const CHORD_KEYS = ['C', 'G', 'Am', 'F', 'Em', 'Dm', 'D', 'E'];
const DRUM_KEYS = { Space: 'kick', KeyF: 'snare', KeyJ: 'hat', KeyK: 'openhat', KeyA: 'tom3', KeyS: 'tom2', KeyD: 'tom1', KeyL: 'crash', Semicolon: 'ride' };

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Instruments {
  constructor(game) {
    this.game = game;
    this.ctx = game.audio.ctx;
    this.active = null; // { kind, obj }
    this.octave = 0;
    this.chord = 'C';
    this.sustain = false;
    this.held = new Map(); // piano notes ringing
    this.ksCache = new Map();
    this.outs = new Map(); // instrument object → gain node (positional)
    this.ui = document.createElement('div');
    this.ui.id = 'jam';
    this.ui.className = 'hidden';
    document.getElementById('ui').appendChild(this.ui);
    game.mp?.on('note', (e, id) => this.#remote(e, id));
  }

  // ---------------------------------------------------------------------------
  // Placement (called by the scene)
  // ---------------------------------------------------------------------------

  /** Register an instrument object: E sits you at it. */
  add(scene, obj, kind, view) {
    const g = this.game;
    obj.userData.instrument = kind;
    (this.byKind ??= {})[kind] = obj;
    const label = { piano: 'Play the piano', guitar: 'Pick up the guitar', drums: 'Play the drums', karaoke: 'Karaoke' }[kind];
    scene.addInteractable(obj, {
      prompt: label,
      range: 2.8,
      action: () => this.#start(kind, obj, view),
    });
  }

  /** The karaoke screen (canvas) lives on the stage too. */
  setScreen(canvas, texture, speaker) {
    this.screen = { canvas, texture, ctx: canvas.getContext('2d') };
    this.stageSpeaker = speaker;
    this.#drawScreen();
  }

  #out(obj) {
    if (this.outs.has(obj)) return this.outs.get(obj);
    const g = this.game;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.9;
    const s = new THREE.PositionalAudio(g.audio.listener);
    s.setRefDistance(3);
    s.setRolloffFactor(1.2);
    s.setMaxDistance(60);
    s.setNodeSource(gain);
    s.position.y = 1;
    obj.add(s);
    // a touch of room: short feedback delay as a cheap reverb
    const d = this.ctx.createDelay(0.5);
    d.delayTime.value = 0.09;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.28;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const bus = this.ctx.createGain();
    bus.connect(gain);
    bus.connect(d);
    d.connect(lp).connect(fb).connect(d);
    lp.connect(gain);
    this.outs.set(obj, bus);
    return bus;
  }

  // ---------------------------------------------------------------------------
  // Playing
  // ---------------------------------------------------------------------------

  #start(kind, obj, view) {
    const g = this.game;
    this.active = { kind, obj };
    if (kind === 'karaoke') this.karaoke = { song: this.karaoke?.song ?? 0, playing: false, t: 0 };
    this.ui.classList.remove('hidden');
    this.#ui();
    g.enterFocus({
      position: view.position,
      target: view.target,
      fov: view.fov ?? 55,
      exitKey: kind === 'piano' ? 'Tab' : 'KeyE', // E is a black key on the piano
      hint: kind === 'piano' ? 'TAB get up' : 'E get up',
      onUpdate: (dt, input) => this.#update(dt, input),
      onExit: () => this.#stop(),
    });
  }

  #stop() {
    this.active = null;
    this.ui.classList.add('hidden');
    for (const n of this.held.values()) this.#release(n);
    this.held.clear();
    this.#micOff();
    if (this.karaoke?.playing) this.#stopSong();
  }

  #update(dt, input) {
    const a = this.active;
    if (!a) return;
    if (a.kind === 'piano') this.#pianoInput(input);
    else if (a.kind === 'guitar') this.#guitarInput(input);
    else if (a.kind === 'drums') this.#drumInput(input);
    else this.#karaokeInput(dt, input);
  }

  /** Play locally + tell the room. */
  #note(kind, args) {
    const obj = this.byKind?.[kind];
    if (!obj) return;
    this.#sound(kind, args, obj);
    this.game.net?.online && this.game.net.event('note', { kind, a: args, air: this.game.radio?.onAir ? 1 : 0 });
  }

  #remote(e, id) {
    const g = this.game;
    const r = g.mp?.remotes.get(id);
    const obj = this.byKind?.[e.kind];
    if (!obj || !r) return;
    if (r.inMyScene) this.#sound(e.kind, e.a, obj);
    else if (e.air && g.radio?.tuned) this.#sound(e.kind, e.a, null); // on the radio, wherever you are
  }

  #sound(kind, a, obj) {
    const out = obj ? this.#out(obj) : this.game.radio.bus;
    if (kind === 'piano') this.#pianoNote(out, a.m, a.v ?? 0.8, a.off);
    else if (kind === 'guitar') this.#strum(out, a.c, a.dir ?? 1, a.s);
    else if (kind === 'drums') this.#drum(out, a.d);
  }

  // ---- piano ------------------------------------------------------------------

  #pianoInput(input) {
    if (input.pressed('KeyZ')) this.octave = Math.max(-2, this.octave - 1);
    if (input.pressed('KeyX')) this.octave = Math.min(2, this.octave + 1);
    this.sustain = input.down('Space');
    const base = 60 + this.octave * 12;
    const keys = [...PIANO_WHITE.map((k, i) => [k, PIANO_WHITE_SEMI[i]]), ...Object.entries(PIANO_BLACK)];
    for (const [k, semi] of keys) {
      const m = base + semi;
      if (input.pressed(k)) {
        this.#note('piano', { m, v: 0.85 });
        this.#flash(k);
      }
      if (!input.down(k) && this.held.has(m) && !this.sustain) {
        this.#note('piano', { m, off: true });
      }
    }
    if (!this.sustain) for (const [m, n] of this.held) if (!keys.some(([k, s]) => base + s === m && input.down(k))) this.#note('piano', { m, off: true });
  }

  #pianoNote(out, m, v, off) {
    const ctx = this.ctx;
    if (off) {
      const n = this.held.get(m);
      if (n) {
        this.#release(n);
        this.held.delete(m);
      }
      return;
    }
    const old = this.held.get(m);
    if (old) this.#release(old);
    const t = ctx.currentTime;
    const f = midiHz(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22 * v, t + 0.004);
    g.gain.setTargetAtTime(0.09 * v, t + 0.01, 0.35); // hammer → body
    g.gain.setTargetAtTime(0.0001, t + 0.4, 2.6 - (m - 48) * 0.025); // long natural decay
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), t);
    lp.frequency.setTargetAtTime(f * 3, t + 0.02, 0.6);
    lp.connect(g).connect(out);
    const oscs = [];
    // slightly inharmonic partials, like a real string
    for (const [h, amp] of [[1, 1], [2, 0.45], [3, 0.22], [4, 0.12], [5, 0.06]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * h * (1 + 0.0004 * h * h);
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(lp);
      o.start(t);
      oscs.push(o);
    }
    // hammer thunk
    const n = this.game.audio.noiseSource(false);
    const nb = ctx.createBiquadFilter();
    nb.type = 'bandpass';
    nb.frequency.value = f * 2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05 * v, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(nb).connect(ng).connect(out);
    n.start(t);
    n.stop(t + 0.06);
    const note = { g, oscs };
    this.held.set(m, note);
    // stop oscillators eventually even if held forever
    for (const o of oscs) o.stop(t + 12);
  }

  #release(n) {
    const t = this.ctx.currentTime;
    n.g.gain.cancelScheduledValues(t);
    n.g.gain.setTargetAtTime(0, t, 0.12);
    for (const o of n.oscs) {
      try {
        o.stop(t + 1);
      } catch {}
    }
  }

  // ---- guitar -----------------------------------------------------------------

  #guitarInput(input) {
    CHORD_KEYS.forEach((c, i) => {
      if (input.pressed(`Digit${i + 1}`)) {
        this.chord = c;
        this.#ui();
      }
    });
    if (input.pressed('Space') || input.mousePressed(0)) this.#note('guitar', { c: this.chord, dir: 1 });
    if (input.pressed('KeyB') || input.mousePressed(2)) this.#note('guitar', { c: this.chord, dir: -1 });
    ['KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'].forEach((k, i) => {
      if (input.pressed(k)) this.#note('guitar', { c: this.chord, s: i });
    });
  }

  /** Karplus-Strong plucked string, rendered once per pitch and cached. */
  #pluckBuffer(f) {
    const key = Math.round(f * 10);
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 2.4);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f));
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let p = 0;
    const damp = 0.996 - Math.max(0, (f - 200) / 20000);
    for (let i = 0; i < len; i++) {
      const next = (p + 1) % N;
      const v = damp * 0.5 * (ring[p] + ring[next]);
      d[i] = ring[p];
      ring[p] = v;
      p = next;
    }
    this.ksCache.set(key, buf);
    return buf;
  }

  #strum(out, chord, dir, single) {
    const ctx = this.ctx;
    const frets = CHORDS[chord] ?? CHORDS.C;
    const order = single !== undefined ? [single] : dir > 0 ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 180;
    body.gain.value = 6;
    body.connect(out);
    order.forEach((s, k) => {
      if (frets[s] < 0) return;
      const src = ctx.createBufferSource();
      src.buffer = this.#pluckBuffer(midiHz(STRINGS[s] + frets[s]));
      const g = ctx.createGain();
      g.gain.value = 0.32;
      src.connect(g).connect(body);
      src.start(ctx.currentTime + k * 0.012);
    });
  }

  // ---- drums -------------------------------------------------------------------

  #drumInput(input) {
    for (const [k, d] of Object.entries(DRUM_KEYS)) {
      if (input.pressed(k)) {
        this.#note('drums', { d });
        this.#flash(k);
      }
    }
  }

  #drum(out, d) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const tone = (f0, f1, dur, peak, type = 'sine') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    const noise = (dur, freq, type, peak) => {
      const n = this.game.audio.noiseSource(false);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(f).connect(g).connect(out);
      n.start(t);
      n.stop(t + dur + 0.05);
    };
    switch (d) {
      case 'kick':
        tone(140, 42, 0.45, 0.9);
        noise(0.02, 2000, 'lowpass', 0.3);
        break;
      case 'snare':
        tone(220, 160, 0.12, 0.35, 'triangle');
        noise(0.22, 1800, 'highpass', 0.5);
        break;
      case 'hat':
        noise(0.05, 8000, 'highpass', 0.3);
        break;
      case 'openhat':
        noise(0.35, 7500, 'highpass', 0.25);
        break;
      case 'tom1':
        tone(260, 180, 0.3, 0.6);
        break;
      case 'tom2':
        tone(190, 130, 0.35, 0.6);
        break;
      case 'tom3':
        tone(130, 85, 0.45, 0.7);
        break;
      case 'crash':
        noise(1.6, 5000, 'highpass', 0.35);
        noise(1.2, 9000, 'bandpass', 0.2);
        break;
      case 'ride':
        noise(0.9, 6500, 'bandpass', 0.18);
        tone(3200, 3100, 0.6, 0.04, 'square');
        break;
    }
  }

  // ---- karaoke -------------------------------------------------------------------

  #karaokeInput(dt, input) {
    const k = this.karaoke;
    if (!k.playing) {
      if (input.pressed('ArrowLeft') || input.pressed('KeyA')) k.song = (k.song + KARAOKE.length - 1) % KARAOKE.length;
      if (input.pressed('ArrowRight') || input.pressed('KeyD')) k.song = (k.song + 1) % KARAOKE.length;
      if (input.pressed('Enter') || input.pressed('Space')) this.#startSong();
    } else {
      if (input.pressed('Enter') || input.pressed('Escape')) this.#stopSong();
      k.t += dt;
      const song = KARAOKE[k.song];
      if (k.t > song.lines.at(-1)[0] + 8) this.#stopSong(true);
    }
    if (input.pressed('KeyM')) (this.mic ? this.#micOff() : this.#micOn());
    this.#ui();
    this.#drawScreen();
  }

  #startSong() {
    const g = this.game;
    const k = this.karaoke;
    const song = KARAOKE[k.song];
    const m = g.music;
    const idx = m.tracks.findIndex((t) => t.title === song.track);
    if (this.stageSpeaker) m.useSpeaker(this.stageSpeaker);
    if (idx >= 0) m.play(idx).then(() => m.seek(0));
    k.playing = true;
    k.t = 0;
    g.hud.toast(`♪ ${song.title} — sing along!`, 2500);
  }

  #stopSong(finished = false) {
    const k = this.karaoke;
    k.playing = false;
    this.game.music.pause();
    if (finished) {
      this.game.hud.toast('The diner claps. Dolores whistles.', 3000);
      this.game.audio.oneShot('register', { volume: 0.2 });
    }
    this.#drawScreen();
  }

  async #micOn() {
    const g = this.game;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const src = this.ctx.createMediaStreamSource(stream);
      const out = this.#out(this.byKind.karaoke);
      const gain = this.ctx.createGain();
      gain.gain.value = 1.4;
      src.connect(gain).connect(out);
      this.mic = { stream, src, gain };
      g.hud.toast('Mic live through the speakers. Use headphones or it will howl.', 3500);
    } catch (e) {
      g.hud.toast(`No mic: ${e.message}`, 3000);
    }
  }

  #micOff() {
    if (!this.mic) return;
    this.mic.gain.disconnect();
    this.mic.stream.getTracks().forEach((t) => t.stop());
    this.mic = null;
  }

  #drawScreen() {
    const s = this.screen;
    if (!s) return;
    const c = s.ctx;
    const W = s.canvas.width;
    const H = s.canvas.height;
    c.fillStyle = '#0a0620';
    c.fillRect(0, 0, W, H);
    const k = this.karaoke ?? { song: 0, playing: false, t: 0 };
    const song = KARAOKE[k.song];
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (!k.playing) {
      c.fillStyle = '#ff5ab0';
      c.font = 'bold 22px Georgia, serif';
      c.fillText('KARAOKE NIGHT', W / 2, 30);
      c.fillStyle = '#ffe070';
      c.font = '18px Georgia, serif';
      c.fillText(`◀  ${song.title}  ▶`, W / 2, 72);
      c.fillStyle = '#8a80b8';
      c.font = '13px monospace';
      c.fillText('ENTER to start · M mic through speakers', W / 2, 104);
    } else {
      // current + next line, with a wipe across the current one
      let i = song.lines.findIndex((l, j) => k.t >= l[0] && (j === song.lines.length - 1 || k.t < song.lines[j + 1][0]));
      if (i < 0) i = -1;
      const cur = song.lines[i];
      const nxt = song.lines[i + 1];
      c.font = 'bold 20px Georgia, serif';
      if (cur) {
        const end = nxt ? nxt[0] : cur[0] + 5;
        const prog = Math.min(1, (k.t - cur[0]) / (end - cur[0]));
        const tw = c.measureText(cur[1]).width;
        c.fillStyle = '#f0f0f0';
        c.fillText(cur[1], W / 2, 52);
        c.save();
        c.beginPath();
        c.rect(W / 2 - tw / 2, 30, tw * prog, 44);
        c.clip();
        c.fillStyle = '#ff5ab0';
        c.fillText(cur[1], W / 2, 52);
        c.restore();
      } else {
        c.fillStyle = '#8a80b8';
        c.fillText('♪ ♪ ♪', W / 2, 52);
      }
      if (nxt) {
        c.font = '15px Georgia, serif';
        c.fillStyle = '#8a80b8';
        c.fillText(nxt[1], W / 2, 92);
      }
      c.font = '11px monospace';
      c.fillStyle = '#5a5088';
      c.fillText(song.title, W / 2, 118);
    }
    s.texture.needsUpdate = true;
  }

  // ---- UI -----------------------------------------------------------------------

  #flash(code) {
    const el = this.ui.querySelector(`[data-k="${code}"]`);
    if (!el) return;
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 120);
  }

  #ui() {
    const a = this.active;
    if (!a) return;
    const key = (code, label, sub = '') => `<span data-k="${code}"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>`;
    let html = '';
    if (a.kind === 'piano') {
      html = `<div class="jam-title">PIANO · octave ${this.octave >= 0 ? '+' : ''}${this.octave}</div><div class="jam-row">${Object.entries(PIANO_BLACK)
        .map(([k]) => key(k, k.slice(3)))
        .join('')}</div><div class="jam-row">${PIANO_WHITE.map((k) => key(k, k === 'Semicolon' ? ';' : k.slice(3))).join('')}</div><div class="jam-hint">Z / X octave · hold SPACE sustain · TAB get up</div>`;
    } else if (a.kind === 'guitar') {
      html = `<div class="jam-title">GUITAR · ${this.chord}</div><div class="jam-row">${CHORD_KEYS.map((c, i) => `<span class="${c === this.chord ? 'on' : ''}"><b>${i + 1}</b><small>${c}</small></span>`).join('')}</div><div class="jam-hint">SPACE / click strum down · B / right-click up · H J K L ; ' single strings · E get up</div>`;
    } else if (a.kind === 'drums') {
      html = `<div class="jam-title">DRUMS</div><div class="jam-row">${Object.entries(DRUM_KEYS)
        .map(([k, d]) => key(k, k === 'Space' ? 'SPC' : k === 'Semicolon' ? ';' : k.slice(3), d))
        .join('')}</div><div class="jam-hint">E get up</div>`;
    } else {
      const k = this.karaoke;
      html = `<div class="jam-title">KARAOKE · ${KARAOKE[k.song].title}</div><div class="jam-hint">${k.playing ? 'ENTER stop' : '← → pick · ENTER start'} · M mic ${this.mic ? 'ON' : 'off'} · E get up</div>`;
    }
    if (this._last !== html) {
      this._last = html;
      this.ui.innerHTML = html;
    }
  }
}

/**
 * Karaoke songs: the built-in generative tracks as backing, with original
 * lyrics written for this game. [seconds, line]
 */
const KARAOKE = [
  {
    title: '3AM Laundromat',
    track: '3AM Laundromat',
    lines: [
      [4, 'quarters in my pocket, nowhere else to be'],
      [11, 'the dryer keeps on spinning like it’s talking just to me'],
      [19, 'fluorescent hum, a magazine from 2003'],
      [27, 'and everybody’s sleeping but the night shift and me'],
      [36, 'oh, 3 a.m.'],
      [40, 'the world goes quiet again'],
      [47, 'fold it all up neat'],
      [52, 'and walk home down the empty street'],
      [61, 'oh, 3 a.m.'],
      [66, 'you’re the only one who’s my friend'],
    ],
  },
  {
    title: 'Route 9 Fog',
    track: 'Route 9 Fog',
    lines: [
      [6, 'headlights only reach so far'],
      [14, 'the fog has swallowed every star'],
      [23, 'I don’t know where this road goes'],
      [31, 'but the radio does, I suppose'],
      [42, 'drive slow, drive slow'],
      [50, 'there’s nowhere that we have to go'],
      [60, 'drive slow, drive slow'],
      [68, 'the lighthouse knows the way home'],
    ],
  },
  {
    title: 'Neon Pumps',
    track: 'Neon Pumps',
    lines: [
      [4, 'pump number four is glowing pink'],
      [9, 'the clerk’s asleep, or so I think'],
      [15, 'a slushie and a lottery ticket'],
      [20, 'tonight’s the night, I’m gonna pick it'],
      [26, 'neon, neon on the mountain'],
      [31, 'gas is cheap and time’s not counting'],
      [37, 'neon, neon, light me up'],
      [42, 'one more coffee in a paper cup'],
    ],
  },
  {
    title: 'Lighthouse Keeper',
    track: 'Lighthouse Keeper',
    lines: [
      [5, 'old Ray climbs up the spiral stair'],
      [12, 'and nobody knows he’s even there'],
      [20, 'he lights the lamp for ships that never come'],
      [28, 'and hums along to some forgotten song'],
      [38, 'keep the light on, keep the light on'],
      [46, 'somebody’s out there in the dark'],
      [54, 'keep the light on, keep the light on'],
      [62, 'it’s the only thing you’ve got'],
    ],
  },
];
