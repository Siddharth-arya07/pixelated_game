import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { addMusicDevice } from './Devices.js';
import { signTexture } from '../core/Procedural.js';

/**
 * BowlingScene — Stardust Lanes
 * -----------------------------
 * A tired four-lane alley in town, open all night because the owner forgot
 * to close it in 1994. Neon, carpet with planets on it, a jukebox on the
 * shared music player, a shoe counter, and lane 1 actually works.
 *
 * Bowling (5 frames, real strike/spare scoring):
 *   A/D slide along the foul line · Z/C add hook (spin) · hold SPACE for
 *   power, let go to roll. Pins are little rigid circles that knock into each
 *   other; anything knocked hard enough falls over.
 * Your best game goes on the patio Hall of Fame (shared with the room).
 */
const LANE_W = 1.05;
const LANE_L = 18.3;
const FOUL_Z = 0;
const PIN_Z = -LANE_L; // head pin
const PIN_R = 0.06;
const BALL_R = 0.11;
const FRAMES = 5;

export class BowlingScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Bowling', label: 'stardust lanes' });
    this.indoor = { fog: 0x140a1e, near: 8, far: 40, ambient: 0x4a3a5a, daylight: 0 };
  }

  build() {
    const g = this.game;
    const W = 9;
    const D = 26;
    this.room({
      w: W,
      d: D,
      h: 4,
      x: 0,
      z: -D / 2 + 5,
      floorMat: this.mat({ map: this.#carpetTex(), color: 0xffffff }),
      wallMat: this.mat({ map: this.tex('wall', 4, 1), color: 0x3a2a4a }),
      ceilMat: this.mat({ map: this.tex('ceiling', 4, 6), color: 0x2a2030 }),
      doors: [{ wall: 's', at: 2.5, width: 1.3 }],
    });
    const wood = this.mat({ map: this.tex('planks', 1, 12), color: 0xd8b080 });
    const gutter = this.mat({ color: 0x2a2a30 });
    this.lanes = [];
    for (let i = 0; i < 4; i++) {
      const lx = -3 + i * 2;
      const lane = new THREE.Mesh(new THREE.BoxGeometry(LANE_W, 0.04, LANE_L + 1), wood);
      lane.position.set(lx, 0.02, FOUL_Z - LANE_L / 2 - 0.5);
      this.root.add(lane);
      for (const s of [-1, 1]) this.box(0.22, 0.03, LANE_L + 1, gutter, lx + s * (LANE_W / 2 + 0.11), 0.0, FOUL_Z - LANE_L / 2 - 0.5, { collide: false });
      // pin deck backdrop
      this.box(1.6, 1.0, 0.2, this.mat({ color: 0x1a1a22 }), lx, 0.9, PIN_Z - 1.4, { collide: false });
      const pins = this.#pins(lx);
      this.lanes.push({ lx, pins });
      // the other lanes are just for looks: block them off
      if (i > 0) this.addColliderBox(lx, 0.5, FOUL_Z - LANE_L / 2, 1.4, 1, LANE_L);
    }
    this.addColliderBox(-3, 0.5, FOUL_Z - LANE_L / 2 - 0.6, 1.4, 1, LANE_L - 1.2); // you don't walk down lane 1 either
    // foul line, neon, a ball return, chairs
    for (const l of this.lanes) {
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W, 0.03), this.mat({ color: 0xff3040, unlit: true }));
      fl.rotation.x = -Math.PI / 2;
      fl.position.set(l.lx, 0.045, FOUL_Z);
      this.root.add(fl);
    }
    const neonCols = [0xff40c0, 0x40e0ff, 0xffe040, 0x80ff60];
    neonCols.forEach((c, i) => {
      const n = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, LANE_L), this.mat({ color: c, unlit: true }));
      n.position.set(-W / 2 + 0.05, 3.2 - i * 0.08, FOUL_Z - LANE_L / 2);
      this.root.add(n);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.9), this.mat({ map: signTexture(['★ STARDUST LANES ★'], { bg: '#1a0a2a', fg: '#ff60d0', w: 256, h: 48 }), unlit: true }));
    sign.position.set(0, 3.2, PIN_Z - 1.6);
    this.root.add(sign);
    for (const [x, z, c] of [[-3, -9, 0xff60c0], [1, -9, 0x60d0ff], [0, 2.5, 0xffd890], [-2, -17, 0xffffff]]) this.addLight({ position: [x, 3.6, z], color: c, range: 12, intensity: 1.1 });
    const counter = this.box(2.5, 1.05, 0.6, this.mat({ color: 0x5a2a6a }), 2.8, 0.52, 3.2);
    const clerk = this.place('clerk', { x: 2.8, y: 0, z: 3.9, rotY: Math.PI });
    this.animate(clerk, 'idle');
    this.addInteractable(counter, {
      prompt: 'Rent some shoes',
      action: () => g.hud.toast(['“Size? Doesn’t matter. They’re all a nine.”', '“Lane one. The others have been broken since ’94.”', '“No charge. Nobody’s paid here in years.”'][Math.floor(Math.random() * 3)], 3000),
    });
    const juke = this.box(0.9, 1.5, 0.6, this.mat({ color: 0x8a2a5a }), -3.8, 0.75, 3.6);
    addMusicDevice(this, juke, 'the jukebox');
    for (let k = 0; k < 4; k++) this.box(0.5, 0.45, 0.5, this.mat({ color: 0xe04060 }), -3 + k * 2, 0.22, 2.2, { collide: true });
    // door
    const door = this.box(1.3, 2.2, 0.08, this.mat({ color: 0x2a1a2a }), 2.5, 1.1, 5 - 0.04, { collide: false });
    this.addInteractable(door, { prompt: 'Go outside', action: () => g.changeScene('World', 'bowling_door') });
    this.addSpawn('door', [2.5, 0, 3.6], 0);
    this.addSpawn('default', [2.5, 0, 3.6], 0);

    // lane 1 is the playable one
    const L = this.lanes[0];
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 12, 8), this.mat({ color: 0x3060c0 }));
    this.ball.visible = false;
    this.root.add(this.ball);
    const scoreCv = document.createElement('canvas');
    scoreCv.width = 512;
    scoreCv.height = 128;
    this.scoreCv = scoreCv;
    this.scoreTex = new THREE.CanvasTexture(scoreCv);
    this.scoreTex.userData.live = true;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), this.mat({ map: this.scoreTex, unlit: true, affine: 0 }));
    scr.position.set(L.lx + 0.4, 3.0, -2);
    this.root.add(scr);
    const rack = this.box(0.5, 0.8, 0.4, this.mat({ color: 0x2a2a30 }), L.lx - 1.0, 0.4, 1.4);
    this.addInteractable(rack, { prompt: 'Bowl on lane 1 (5 frames)', range: 2.6, action: () => this.#start() });
    this.#drawScore();
    this.updaters.push((dt) => this.#tick(dt));
  }

  #carpetTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#1a1030';
    x.fillRect(0, 0, 64, 64);
    const cols = ['#ff60c0', '#60d0ff', '#ffe060', '#80ff60'];
    for (let k = 0; k < 14; k++) {
      x.fillStyle = cols[k % 4];
      const r = 1 + Math.random() * 3;
      x.beginPath();
      x.arc(Math.random() * 64, Math.random() * 64, r, 0, Math.PI * 2);
      x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 12);
    t.magFilter = THREE.NearestFilter;
    return t;
  }

  #pins(lx) {
    const mat = this.mat({ color: 0xf4f0e8 });
    const band = this.mat({ color: 0xd02020 });
    const pins = [];
    const rows = [[0], [-0.5, 0.5], [-1, 0, 1], [-1.5, -0.5, 0.5, 1.5]];
    rows.forEach((r, ri) =>
      r.forEach((c) => {
        const grp = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, PIN_R, 0.38, 8), mat);
        body.position.y = 0.19;
        const neck = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat);
        neck.position.y = 0.36;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 8), band);
        b.position.y = 0.3;
        grp.add(body, neck, b);
        const home = new THREE.Vector3(lx + c * 0.3 * 0.88, 0.04, PIN_Z - ri * 0.26);
        grp.position.copy(home);
        this.root.add(grp);
        pins.push({ grp, home, v: new THREE.Vector2(), down: false, fall: 0, fallDir: 0 });
      }),
    );
    return pins;
  }

  // ---------------------------------------------------------------------------
  // Game
  // ---------------------------------------------------------------------------

  #start() {
    const g = this.game;
    const L = this.lanes[0];
    this.B = { frame: 0, rolls: [[]], x: 0, spin: 0, power: 0, rolling: false };
    this.#resetPins(true);
    this.ball.visible = true;
    this.#place();
    g.enterFocus({
      position: new THREE.Vector3(L.lx, 1.55, FOUL_Z + 2.6),
      target: new THREE.Vector3(L.lx, 0.2, PIN_Z),
      fov: 46,
      hint: 'A/D move · Z/C hook · hold SPACE, release to roll · E quit',
      onUpdate: (dt, input) => this.#input(dt, input),
      onExit: () => {
        this.B = null;
        this.ball.visible = false;
        this.game.hud.setHint?.(null);
      },
    });
    this.#drawScore();
  }

  #place() {
    const L = this.lanes[0];
    this.ball.position.set(L.lx + this.B.x, BALL_R + 0.04, FOUL_Z + 0.8);
  }

  #resetPins(all) {
    for (const p of this.lanes[0].pins) {
      if (!all && p.down) {
        p.gone = true;
        p.grp.visible = false;
        continue;
      }
      if (all) {
        p.gone = false;
        p.down = false;
        p.grp.visible = true;
      }
      if (!p.gone) {
        p.grp.position.copy(p.home);
        p.grp.rotation.set(0, 0, 0);
        p.v.set(0, 0);
        p.fall = 0;
      }
    }
  }

  #input(dt, input) {
    const B = this.B;
    if (!B || B.rolling || B.done) return;
    B.x = THREE.MathUtils.clamp(B.x + input.axis('KeyA', 'KeyD') * dt * 0.8, -0.4, 0.4);
    if (input.down('KeyZ')) B.spin = Math.max(-1, B.spin - dt * 1.5);
    if (input.down('KeyC')) B.spin = Math.min(1, B.spin + dt * 1.5);
    this.#place();
    if (input.down('Space')) {
      B.power = Math.min(1, B.power + dt * 0.7);
      this.game.hud.toast(`POWER ${'▮'.repeat(Math.round(B.power * 10))}${'▯'.repeat(10 - Math.round(B.power * 10))}  hook ${B.spin > 0.05 ? '→' : B.spin < -0.05 ? '←' : '·'}`, 400);
    } else if (B.power > 0) {
      B.rolling = true;
      B.vel = new THREE.Vector2(0, -(4 + B.power * 7));
      B.power = 0;
      this.#rumble(true);
    }
  }

  #tick(dt) {
    const B = this.B;
    if (!B) return;
    const L = this.lanes[0];
    if (B.rolling) {
      const b = this.ball.position;
      // hook: spin curves the ball, more as it slows on the oil-free back end
      B.vel.x += B.spin * 1.2 * dt * (b.z < PIN_Z + 8 ? 1.6 : 0.5);
      b.x += B.vel.x * dt;
      b.z += B.vel.y * dt;
      this.ball.rotation.x += B.vel.y * dt * 6;
      // gutter
      if (!B.gutter && Math.abs(b.x - L.lx) > LANE_W / 2 + 0.02) {
        B.gutter = true;
        b.x = L.lx + Math.sign(b.x - L.lx) * (LANE_W / 2 + 0.11);
        B.vel.x = 0;
        b.y = 0.08;
      }
      // ball vs pins
      for (const p of L.pins) {
        if (p.gone) continue;
        const dx = p.grp.position.x - b.x;
        const dz = p.grp.position.z - b.z;
        const d = Math.hypot(dx, dz);
        if (!B.gutter && d < BALL_R + PIN_R) {
          const n = new THREE.Vector2(dx / d, dz / d);
          const sp = B.vel.length();
          p.v.copy(n).multiplyScalar(sp * 1.1);
          if (!p.down) this.#knock(p, n);
          B.vel.addScaledVector(n, -sp * 0.12);
          this.#clatter();
        }
      }
      if (b.z < PIN_Z - 1.3) {
        B.rolling = false;
        this.#rumble(false);
        setTimeout(() => this.#score(), 1600);
        B.waiting = true;
      }
    }
    // pins sliding + knocking each other
    for (const p of L.pins) {
      if (p.gone) continue;
      if (p.v.lengthSq() > 1e-4) {
        p.grp.position.x += p.v.x * dt;
        p.grp.position.z += p.v.y * dt;
        p.v.multiplyScalar(Math.exp(-3 * dt));
        for (const q of L.pins) {
          if (q === p || q.gone) continue;
          const dx = q.grp.position.x - p.grp.position.x;
          const dz = q.grp.position.z - p.grp.position.z;
          const d = Math.hypot(dx, dz);
          if (d < PIN_R * 2.2 && d > 0) {
            const n = new THREE.Vector2(dx / d, dz / d);
            const sp = p.v.length();
            if (sp > 0.4) {
              q.v.addScaledVector(n, sp * 0.8);
              if (!q.down) this.#knock(q, n);
            }
          }
        }
      }
      if (p.down && p.fall < 1) {
        p.fall = Math.min(1, p.fall + dt * 5);
        p.grp.rotation.set(Math.cos(p.fallDir) * p.fall * 1.5, 0, -Math.sin(p.fallDir) * p.fall * 1.5);
      }
    }
  }

  #knock(p, n) {
    p.down = true;
    p.fallDir = Math.atan2(n.x, -n.y);
  }

  #score() {
    const B = this.B;
    if (!B) return;
    B.waiting = false;
    const pins = this.lanes[0].pins;
    const standingBefore = pins.filter((p) => !p.gone).length;
    const down = pins.filter((p) => !p.gone && p.down).length;
    const f = B.rolls[B.frame];
    f.push(down);
    const g = this.game;
    const strike = f.length === 1 && down === 10;
    const spare = f.length === 2 && f[0] + down === 10;
    g.hud.toast(strike ? 'STRIKE!' : spare ? 'SPARE!' : B.gutter ? 'Gutter ball.' : `${down} pin${down === 1 ? '' : 's'}`, 2000);
    if (strike || spare) this.#cheer();
    B.gutter = false;
    const last = B.frame === FRAMES - 1;
    const tot = f.reduce((a, c) => a + c, 0);
    let frameOver = strike || f.length === 2;
    if (last) frameOver = f.length === 3 || (f.length === 2 && tot < 10);
    if (frameOver) {
      if (last) return this.#finish();
      B.frame++;
      B.rolls.push([]);
      this.#resetPins(true);
    } else if (last && (strike || spare || (f.length === 2 && f[0] === 10))) this.#resetPins(true);
    else this.#resetPins(false);
    void standingBefore;
    B.x = 0;
    B.spin = 0;
    this.#place();
    this.#drawScore();
  }

  /** Standard bowling scoring over FRAMES frames. */
  #total(rolls) {
    const flat = rolls.flat();
    let i = 0;
    const scores = [];
    let sum = 0;
    for (let f = 0; f < rolls.length; f++) {
      const r = rolls[f];
      if (!r.length) break;
      if (f === FRAMES - 1) {
        sum += r.reduce((a, c) => a + c, 0);
        scores.push(sum);
        break;
      }
      if (r[0] === 10) {
        if (flat[i + 2] === undefined) break;
        sum += 10 + flat[i + 1] + flat[i + 2];
        i += 1;
      } else if (r.length === 2) {
        if (r[0] + r[1] === 10) {
          if (flat[i + 2] === undefined) break;
          sum += 10 + flat[i + 2];
        } else sum += r[0] + r[1];
        i += 2;
      } else break;
      scores.push(sum);
    }
    return { scores, sum };
  }

  #finish() {
    const g = this.game;
    const { sum } = this.#total(this.B.rolls);
    this.B.done = true;
    this.#drawScore();
    g.hud.toast(`Game over: ${sum}. ${sum >= 100 ? 'That’s a serious game.' : sum >= 60 ? 'Not bad at all.' : 'The lane is clearly warped.'}`, 5000);
    g.scenes.World?.backyard?.recordScore?.('bowling', sum);
    setTimeout(() => g.focus && g.exitFocus(), 3500);
  }

  #drawScore() {
    const c = this.scoreCv.getContext('2d');
    c.fillStyle = '#0a0418';
    c.fillRect(0, 0, 512, 128);
    c.strokeStyle = '#ff60d0';
    c.lineWidth = 2;
    const rolls = this.B?.rolls ?? [];
    const { scores } = this.#total(rolls);
    for (let f = 0; f < FRAMES; f++) {
      const x = 16 + f * 96;
      c.strokeRect(x, 20, 90, 90);
      c.fillStyle = '#60d0ff';
      c.font = 'bold 16px monospace';
      c.fillText(`${f + 1}`, x + 4, 16);
      const r = rolls[f] ?? [];
      const marks = r.map((v, k) => (v === 10 && (k === 0 || f === FRAMES - 1) ? 'X' : k > 0 && r[k - 1] + v === 10 && r[k - 1] !== 10 ? '/' : v === 0 ? '-' : String(v)));
      c.fillStyle = '#ffffff';
      c.font = 'bold 20px monospace';
      c.fillText(marks.join(' '), x + 8, 48);
      if (scores[f] !== undefined) {
        c.fillStyle = '#ffe060';
        c.font = 'bold 30px monospace';
        c.fillText(String(scores[f]), x + 14, 96);
      }
    }
    this.scoreTex.needsUpdate = true;
  }

  // ---- sound ------------------------------------------------------------------------

  #rumble(on) {
    const ctx = this.game.audio.ctx;
    if (on) {
      this.rum = this.game.audio.noiseSource(true);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      this.rumG = ctx.createGain();
      this.rumG.gain.value = 0.35;
      this.rum.connect(lp).connect(this.rumG).connect(this.game.audio.master);
      this.rum.start();
    } else if (this.rum) {
      this.rumG.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      const r = this.rum;
      setTimeout(() => r.stop(), 400);
      this.rum = null;
    }
  }

  #clatter() {
    if ((this.clatT ?? 0) > this.game.time) return;
    this.clatT = this.game.time + 0.05;
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 600 + Math.random() * 900;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.2, t + k * 0.02);
      e.gain.exponentialRampToValueAtTime(0.001, t + k * 0.02 + 0.12);
      o.connect(e).connect(this.game.audio.master);
      o.start(t + k * 0.02);
      o.stop(t + k * 0.02 + 0.15);
    }
  }

  #cheer() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, k) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.05, t + k * 0.09);
      e.gain.exponentialRampToValueAtTime(0.001, t + k * 0.09 + 0.25);
      o.connect(e).connect(this.game.audio.master);
      o.start(t + k * 0.09);
      o.stop(t + k * 0.09 + 0.3);
    });
  }
}
