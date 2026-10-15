import * as THREE from 'three';
import { FILMS, INTERMISSION, drawFilm, drawIntermission, filmCues } from '../media/Films.js';
import { signTexture } from '../core/Procedural.js';
import { addSeat } from './Devices.js';

/**
 * DriveIn
 * -------
 * The Starlite Drive-In, off the coast road: abandoned, but the projector
 * still runs. A 20 × 8.5 m screen plays the programme from media/Films.js on
 * a loop (with intermissions), the light off the screen washes over the lot,
 * and the score + sound effects come out of the lot's speakers. Park the
 * truck facing the screen, or take a lawn chair in the front row. The
 * projection booth doubles as a snack bar (popcorn, soda).
 */
const SW = 20;
const SH = 8.5;
const CW = 512;
const CH = 218;

export function buildDriveIn(scene, p) {
  return new DriveIn(scene, p);
}

class DriveIn {
  constructor(scene, p) {
    this.scene = scene;
    this.game = scene.game;
    this.p = p;
    const y = p.y;
    const g = this.game;

    // ---- screen ------------------------------------------------------------
    this.canvas = document.createElement('canvas');
    this.canvas.width = CW;
    this.canvas.height = CH;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.userData.live = true;
    this.tex.minFilter = THREE.LinearFilter;
    const sz = p.z + 30; // screen at the south end, facing north
    const screenY = y + 3 + SH / 2;
    const frame = scene.mat({ color: 0x3a3a40 });
    scene.box(SW + 1.2, SH + 1.2, 0.4, frame, p.x, screenY, sz + 0.25);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), scene.mat({ map: this.tex, unlit: true, fogScale: 0.04, affine: 0 }));
    screen.position.set(p.x, screenY, sz);
    screen.rotation.y = Math.PI;
    scene.root.add(screen);
    for (const dx of [-8, 0, 8]) {
      scene.box(0.5, screenY + SH / 2, 0.5, frame, p.x + dx, (screenY + SH / 2) / 2 + y / 2, sz + 1.2);
      const brace = scene.box(0.25, 9, 0.25, frame, p.x + dx, y + 4, sz + 3.5, { collide: false });
      brace.rotation.x = -0.6;
    }
    this.screenPos = new THREE.Vector3(p.x, screenY, sz);

    // light thrown off the screen onto the lot (colour follows the picture)
    this.glow = scene.addLight({ position: new THREE.Vector3(p.x, y + 5, sz - 10), color: 0x8090a0, range: 48, intensity: 1.2, priority: 2 });
    this.sample = document.createElement('canvas');
    this.sample.width = 4;
    this.sample.height = 2;

    // ---- projection booth / snack bar --------------------------------------------
    const bz = p.z - 4;
    const wall = scene.mat({ map: scene.tex('planks', 3, 1), color: 0x8a7a6a });
    scene.box(7, 3.2, 5, wall, p.x, y + 1.6, bz);
    const roof = scene.box(7.6, 0.3, 5.6, scene.mat({ color: 0x2a2224 }), p.x, y + 3.35, bz);
    void roof;
    const projWin = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), scene.mat({ color: 0xfff2d0, unlit: true }));
    projWin.position.set(p.x, y + 2.4, bz + 2.51);
    scene.root.add(projWin);
    // the beam: a faint additive wedge from the booth to the screen
    const beamGeo = new THREE.BufferGeometry();
    const a = new THREE.Vector3(p.x, y + 2.4, bz + 2.6);
    const corners = [
      [p.x - SW / 2, screenY - SH / 2],
      [p.x + SW / 2, screenY - SH / 2],
      [p.x + SW / 2, screenY + SH / 2],
      [p.x - SW / 2, screenY + SH / 2],
    ];
    const pos = [];
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = corners[i];
      const [x2, y2] = corners[(i + 1) % 4];
      pos.push(a.x, a.y, a.z, x1, y1, sz - 0.05, x2, y2, sz - 0.05);
    }
    beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    beamGeo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0), 3));
    beamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
    this.beamMat = scene.mat({ color: 0xd8e0ff, unlit: true, opacity: 0.05, additive: true, doubleSide: true, fogScale: 0.2 });
    const beam = new THREE.Mesh(beamGeo, this.beamMat);
    beam.frustumCulled = false;
    scene.root.add(beam);
    // snack bar window on the north side
    const counter = scene.box(2.4, 1.1, 0.4, scene.mat({ color: 0xc83a2a }), p.x, y + 0.55, bz - 2.7);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), scene.mat({ map: signTexture(['SNACK BAR', 'POPCORN · SODA'], { bg: '#c83a2a', fg: '#fff2c0' }), unlit: true }));
    sign.position.set(p.x, y + 2.6, bz - 2.52);
    sign.rotation.y = Math.PI;
    scene.root.add(sign);
    scene.addLight({ position: [p.x, y + 2.2, bz - 3.6], color: 0xffc890, range: 7, intensity: 0.9, flicker: 0.2 });
    scene.addInteractable(counter, { prompt: 'Snack bar', range: 2.6, action: () => g.openUI(() => g.shopping.open('snackbar')) });

    // ---- speaker posts, lawn chairs ---------------------------------------------------
    const post = scene.mat({ color: 0x6a6a70 });
    const spk = scene.mat({ color: 0x2a2a2e });
    for (const rz of [p.z + 6, p.z + 13, p.z + 20, p.z - 12, p.z - 19]) {
      for (let x = p.x - 18; x <= p.x + 18; x += 7.2) {
        scene.box(0.12, 1.3, 0.12, post, x, y + 0.65, rz);
        scene.box(0.35, 0.25, 0.18, spk, x, y + 1.25, rz, { collide: false });
      }
    }
    const chairMat = scene.mat({ color: 0x3a7a8a });
    for (const dx of [-3, -1, 1, 3]) {
      const cx = p.x + dx * 1.3;
      const cz = p.z + 24;
      const seat = scene.box(0.6, 0.06, 0.55, chairMat, cx, y + 0.42, cz, { collide: false });
      const back = scene.box(0.6, 0.6, 0.06, chairMat, cx, y + 0.7, cz - 0.3, { collide: false });
      back.rotation.x = 0.3;
      addSeat(scene, seat, { eye: [cx, y + 1.1, cz - 0.1], yaw: Math.PI, pitch: 0.15, yawLimit: 1.6, standAt: [cx, y, cz - 1] }, 'Sit and watch');
    }

    // ---- roadside marquee ---------------------------------------------------------
    this.marqueeCanvas = document.createElement('canvas');
    this.marqueeCanvas.width = 256;
    this.marqueeCanvas.height = 96;
    this.marqueeTex = new THREE.CanvasTexture(this.marqueeCanvas);
    const mx = p.x - 24;
    const mz = p.z - 32;
    scene.box(0.3, 6, 0.3, post, mx - 2, y + 3, mz);
    scene.box(0.3, 6, 0.3, post, mx + 2, y + 3, mz);
    const marquee = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), scene.mat({ map: this.marqueeTex, unlit: true, doubleSide: true, fogScale: 0.4 }));
    marquee.position.set(mx, y + 5.2, mz);
    scene.root.add(marquee);
    scene.addLight({ position: [mx, y + 5, mz - 2], color: 0xffb070, range: 10, intensity: 0.8 });

    // ---- programme --------------------------------------------------------------------
    this.t = 0;
    this.filmIndex = 0;
    this.filmT = 0;
    this.inIntermission = false;
    this.frameT = 0;
    this.audio = null;
    this.#drawMarquee();
    scene.updaters.push((dt) => this.update(dt));
  }

  get film() {
    return FILMS[this.filmIndex];
  }

  #drawMarquee() {
    const c = this.marqueeCanvas.getContext('2d');
    c.fillStyle = '#1a0a14';
    c.fillRect(0, 0, 256, 96);
    c.strokeStyle = '#ffcf5a';
    c.lineWidth = 4;
    c.strokeRect(4, 4, 248, 88);
    c.fillStyle = '#ff5a4a';
    c.font = 'bold 22px Georgia, serif';
    c.textAlign = 'center';
    c.fillText('STARLITE DRIVE-IN', 128, 32);
    c.fillStyle = '#fff2c0';
    c.font = '13px Georgia, serif';
    c.fillText('NOW SHOWING', 128, 54);
    c.font = 'bold 15px Georgia, serif';
    c.fillText(this.film.title.toUpperCase(), 128, 76);
    this.marqueeTex.needsUpdate = true;
  }

  /** Net: the host's programme clock (guests snap to it when they drift). */
  get clock() {
    return { i: this.filmIndex, t: Math.round(this.filmT * 10) / 10, x: this.inIntermission ? 1 : 0 };
  }

  setClock({ i, t, x }) {
    if (i !== this.filmIndex || !!x !== this.inIntermission) {
      this.filmIndex = i;
      this.inIntermission = !!x;
      this.score?.stop();
      this.score = null;
      this.#drawMarquee();
      this.filmT = t;
    } else if (Math.abs(this.filmT - t) > 1.5) {
      this.filmT = t;
      this.score?.stop();
      this.score = null;
    }
  }

  update(dt) {
    const g = this.game;
    if (g.scene !== this.scene) return;
    // programme clock
    const prevT = this.filmT;
    this.filmT += dt;
    if (this.inIntermission) {
      if (this.filmT > INTERMISSION) {
        this.inIntermission = false;
        this.filmT = 0;
        this.#drawMarquee();
      }
    } else if (this.filmT > this.film.duration) {
      this.inIntermission = true;
      this.filmT = 0;
      this.filmIndex = (this.filmIndex + 1) % FILMS.length;
      this.score?.stop();
      this.score = null;
    }

    const dist = g.camera.position.distanceTo(this.screenPos);
    const near = dist < 220;
    // Only draw + play while you're around.
    if (!near) {
      if (this.score) {
        this.score.stop();
        this.score = null;
      }
      return;
    }
    this.frameT -= dt;
    if (this.frameT <= 0) {
      this.frameT = 1 / 12;
      if (this.inIntermission) drawIntermission(this.ctx, this.filmT, CW, CH, this.film);
      else drawFilm(this.ctx, this.film, this.filmT, CW, CH);
      this.tex.needsUpdate = true;
      // screen light colour = the picture's average
      const s = this.sample.getContext('2d');
      s.drawImage(this.canvas, 0, 0, 4, 2);
      const d = s.getImageData(0, 0, 4, 2).data;
      let r = 0;
      let gg = 0;
      let b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        gg += d[i + 1];
        b += d[i + 2];
      }
      const n = (d.length / 4) * 255;
      this.glow.color.setRGB(r / n, gg / n, b / n);
      this.glow.intensity = 0.6 + ((r + gg + b) / (3 * n)) * 1.8;
      this.beamMat.uniforms.uOpacity.value = 0.03 + ((r + gg + b) / (3 * n)) * 0.08;
    }
    // Sound
    if (!this.out) this.#buildAudio();
    if (!this.inIntermission) {
      if (!this.score) this.score = new FilmScore(this, this.film);
      this.score.update(this.filmT);
      for (const key of filmCues(this.film, prevT, this.filmT)) sfx(this, key);
    }
  }

  #buildAudio() {
    const g = this.game;
    const ctx = g.audio.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    const s = new THREE.PositionalAudio(g.audio.listener);
    s.setRefDistance(26);
    s.setRolloffFactor(0.9);
    s.setMaxDistance(260);
    s.setDistanceModel('inverse');
    s.setNodeSource(this.out);
    const holder = new THREE.Object3D();
    holder.position.set(this.p.x, this.p.y + 2, this.p.z + 10);
    this.scene.root.add(holder);
    holder.add(s);
    // old speaker-post tone: band-limited, a bit crunchy
    this.bus = ctx.createBiquadFilter();
    this.bus.type = 'bandpass';
    this.bus.frequency.value = 1100;
    this.bus.Q.value = 0.45;
    this.bus.connect(this.out);
  }
}

// -----------------------------------------------------------------------------
// Score: a small generative accompaniment per film style
// -----------------------------------------------------------------------------
class FilmScore {
  constructor(drivein, film) {
    this.d = drivein;
    this.ctx = drivein.game.audio.ctx;
    this.film = film;
    this.beat = 60 / film.score.bpm;
    this.next = 0; // next beat index to schedule
    this.startAt = this.ctx.currentTime - drivein.filmT;
    this.nodes = new Set();
  }

  stop() {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {}
    }
    this.nodes.clear();
  }

  #note(freq, t, dur, type, peak, attack = 0.02) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.25);
    o.connect(g).connect(this.d.bus);
    o.start(t);
    o.stop(t + dur + 0.5);
    this.nodes.add(o);
    o.onended = () => this.nodes.delete(o);
    return o;
  }

  update(filmT) {
    const ahead = filmT + 0.25;
    const sc = this.film.score;
    const f = (semi) => 220 * Math.pow(2, semi / 12);
    while (this.next * this.beat < ahead) {
      const k = this.next++;
      const t = this.startAt + k * this.beat;
      if (t < this.ctx.currentTime - 0.05) continue;
      const bar = Math.floor(k / 4);
      const chord = sc.chords[bar % sc.chords.length];
      const b = k % 4;
      switch (sc.style) {
        case 'theremin': {
          if (b === 0) chord.forEach((s) => this.#note(f(s - 12), t, this.beat * 4, 'sine', 0.05, 0.4));
          if (b % 2 === 0) {
            const o = this.#note(f(chord[(k / 2) % 3 | 0] + 12), t, this.beat * 2, 'sine', 0.07, 0.25);
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 6;
            const lg = this.ctx.createGain();
            lg.gain.value = 8;
            lfo.connect(lg).connect(o.frequency);
            lfo.start(t);
            lfo.stop(t + this.beat * 2 + 0.5);
            o.frequency.setTargetAtTime(f(chord[(k + 1) % 3] + 12), t + this.beat, 0.3);
          }
          break;
        }
        case 'synth-horror':
          if (b === 0) this.#note(f(chord[0] - 24), t, this.beat * 4, 'sawtooth', 0.05, 0.6);
          this.#note(f(chord[0] - 12), t, this.beat * 0.4, 'square', 0.04, 0.005);
          if (k % 8 === 6) this.#note(f(chord[2] + 24), t, this.beat * 3, 'sine', 0.035, 0.01);
          break;
        case 'strings':
          if (b === 0) chord.forEach((s) => this.#note(f(s), t, this.beat * 4.2, 'triangle', 0.045, 0.8));
          if (b === 0 || b === 2) this.#note(f(chord[(bar + b) % 3] + 12), t, this.beat * 2, 'sine', 0.05, 0.3);
          break;
        case 'ragtime':
          this.#note(f(b % 2 === 0 ? chord[0] - 12 : chord[2] - 12), t, this.beat * 0.4, 'square', 0.04, 0.005);
          if (b % 2 === 1) chord.forEach((s) => this.#note(f(s), t, this.beat * 0.3, 'square', 0.025, 0.005));
          this.#note(f(chord[(k * 2) % 3] + 12 + ((k * 5) % 3 === 0 ? 2 : 0)), t + this.beat * 0.5, this.beat * 0.4, 'triangle', 0.04, 0.005);
          break;
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Sound effects for film cues
// -----------------------------------------------------------------------------
function sfx(d, key) {
  const ctx = d.game.audio.ctx;
  const t = ctx.currentTime;
  const out = d.bus;
  const noise = (dur, freq, type = 'lowpass', peak = 0.5, attack = 0.01) => {
    const n = d.game.audio.noiseSource(false);
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(fl).connect(g).connect(out);
    n.start(t);
    n.stop(t + dur + 0.1);
  };
  const tone = (f0, f1, dur, type = 'sine', peak = 0.3, at = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t + at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + at);
    g.gain.linearRampToValueAtTime(peak, t + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + at + dur);
    o.connect(g).connect(out);
    o.start(t + at);
    o.stop(t + at + dur + 0.05);
  };
  switch (key) {
    case 'theremin':
      tone(500, 900, 1.6, 'sine', 0.2);
      tone(900, 400, 1.6, 'sine', 0.15, 1.6);
      break;
    case 'thump':
      tone(90, 30, 0.6, 'sine', 0.8);
      noise(0.5, 300, 'lowpass', 0.5);
      break;
    case 'crowd':
      for (let i = 0; i < 6; i++) tone(300 + Math.random() * 300, 200 + Math.random() * 200, 0.6, 'sawtooth', 0.04, i * 0.25);
      noise(2.5, 1200, 'bandpass', 0.15, 0.2);
      break;
    case 'hiss':
      noise(1.6, 4000, 'highpass', 0.3, 0.1);
      break;
    case 'drone':
      tone(55, 52, 5, 'sawtooth', 0.12);
      tone(82, 80, 5, 'sawtooth', 0.06);
      break;
    case 'engine':
      tone(70, 75, 4, 'sawtooth', 0.08);
      break;
    case 'static':
      noise(2, 3000, 'bandpass', 0.2);
      break;
    case 'sting':
      for (const f of [1046, 1108, 1174]) tone(f, f * 0.98, 1.4, 'sawtooth', 0.06);
      break;
    case 'heartbeat':
      for (let i = 0; i < 6; i++) {
        tone(60, 40, 0.15, 'sine', 0.6, i * 0.8);
        tone(60, 40, 0.12, 'sine', 0.4, i * 0.8 + 0.22);
      }
      break;
    case 'knock':
      noise(0.12, 500, 'lowpass', 0.8, 0.002);
      break;
    case 'creak':
      tone(300, 520, 0.9, 'sawtooth', 0.06);
      break;
    case 'bark':
      noise(0.15, 900, 'bandpass', 0.6, 0.005);
      tone(400, 250, 0.15, 'square', 0.15);
      break;
    case 'thunder':
      noise(2.5, 150, 'lowpass', 0.9, 0.05);
      break;
    case 'tiptoe':
      for (let i = 0; i < 6; i++) tone(1200 + (i % 2) * 300, 1100, 0.08, 'triangle', 0.1, i * 0.35);
      break;
    case 'boing':
      tone(200, 700, 0.35, 'sine', 0.3);
      break;
    case 'zip':
      tone(1800, 300, 0.3, 'square', 0.08);
      break;
    case 'crash':
      noise(0.9, 2500, 'highpass', 0.6, 0.002);
      for (let i = 0; i < 4; i++) tone(800 + i * 300, 600, 0.3, 'square', 0.05, i * 0.07);
      break;
  }
}
