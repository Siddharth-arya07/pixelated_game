import * as THREE from 'three';
import { signTexture } from '../core/Procedural.js';

/**
 * Funland — the abandoned amusement park (west of town)
 * -----------------------------------------------------
 * Closed since the summer of '89. A rusted Ferris wheel, a dead carousel,
 * bumper cars nosed together in the dark, a ticket booth, and a generator
 * shed. Get it running again:
 *
 *   1. a fuse for the generator (Quik Mart register sells them)
 *   2. a tin of gear grease for the wheel (outdoor aisle)
 *   3. yank the generator's pull-cord until it catches
 *
 * Then the bulbs come on, the calliope starts wheezing, the wheel turns, and
 * you can ride it (board a gondola when it's at the bottom). The wheel's
 * angle comes from the shared clock and the power state is shared, so in a
 * room everyone sees the same wheel and can ride together.
 */
export function buildFunland(scene) {
  return new Funland(scene);
}

class Funland {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;
    const P = scene.poi.funland;
    this.c = new THREE.Vector3(P.x, P.y, P.z);
    this.on = localStorage.getItem('3am-funland') === '1';
    this.parts = { fuse: false, grease: false };
    this.pulls = 0;
    this.bulbs = [];
    this.#fence();
    this.#wheel();
    this.#rides();
    this.#generator();
    this.#power(this.on, true);
    this.game.mp?.on('funland', () => this.#power(true));
    scene.updaters.push((dt, t) => this.update(dt, t));
  }

  #fence() {
    const s = this.scene;
    const { x, y, z } = this.c;
    const post = s.mat({ color: 0x5a4a3a });
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      if (k === 10 || k === 11) continue; // the gate (east)
      const px = x + Math.cos(a) * 34;
      const pz = z + Math.sin(a) * 34;
      s.box(0.1, 1.6, 5.2, post, px, s.groundHeight(px, pz) + 0.8, pz, { rotY: -a, collide: true });
    }
    // gate arch
    const gx = x + Math.cos(Math.PI / 2 + 0.08) * 34;
    const gz = z + Math.sin(Math.PI / 2 + 0.08) * 34;
    const gy = s.groundHeight(gx, gz);
    for (const d of [-2.4, 2.4]) s.box(0.3, 4.5, 0.3, s.mat({ color: 0xc8a040 }), gx + d, gy + 2.25, gz);
    this.archMat = s.mat({ map: signTexture(['FUNLAND'], { bg: '#3a1020', fg: '#ffd040', w: 128, h: 32 }) });
    const arch = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), this.archMat);
    arch.position.set(gx, gy + 4.6, gz);
    s.root.add(arch);
    const sorry = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.6), s.mat({ map: signTexture(['CLOSED', 'SINCE ’89'], { bg: '#e8e0d0', fg: '#a02020', w: 64, h: 32 }) }));
    sorry.position.set(gx + 2.4, gy + 1.6, gz + 0.2);
    s.root.add(sorry);
    for (let k = 0; k < 12; k++) this.#bulb(gx - 2.4 + k * 0.44, gy + 4.05, gz + 0.05);
  }

  #bulb(x, y, z) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), this.scene.mat({ color: 0x5a4a3a }));
    b.position.set(x, y, z);
    this.scene.root.add(b);
    this.bulbs.push(b);
  }

  #wheel() {
    const s = this.scene;
    const { x, y, z } = this.c;
    const R = 13;
    const hub = new THREE.Vector3(x - 6, y + R + 2.5, z - 6);
    this.hub = hub;
    const steel = s.mat({ color: 0x8a5a3a }); // rust
    // A-frame legs
    for (const dz of [-1.4, 1.4]) {
      for (const dx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, R + 3.5, 0.35), steel);
        leg.position.set(hub.x + dx * 3.6, y + (R + 2.5) / 2, hub.z + dz);
        leg.rotation.z = dx * 0.26;
        s.root.add(leg);
      }
    }
    s.addColliderBox(hub.x, y + 1.5, hub.z, 8, 3, 3.4);
    const wheel = new THREE.Group();
    wheel.position.copy(hub);
    for (const dz of [-1.0, 1.0]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.15, 6, 40), steel);
      rim.position.z = dz;
      wheel.add(rim);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, R, 0.1), steel);
        sp.position.set((Math.cos(a) * R) / 2, (Math.sin(a) * R) / 2, dz);
        sp.rotation.z = a - Math.PI / 2;
        wheel.add(sp);
      }
    }
    s.root.add(wheel);
    this.wheel = wheel;
    // rim bulbs (light up when powered)
    this.rimBulbs = [];
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), s.mat({ color: 0x5a4a3a }));
      b.position.set(Math.cos(a) * R, Math.sin(a) * R, 1.15);
      wheel.add(b);
      this.rimBulbs.push(b);
    }
    // gondolas hang from the rim, always upright
    const cols = [0xc02a2a, 0x2a6ab0, 0xe0b030, 0x3a9a4a];
    this.gondolas = [];
    for (let k = 0; k < 8; k++) {
      const gd = new THREE.Group();
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.9, 10, 1, true), s.mat({ color: cols[k % 4], doubleSide: true }));
      tub.position.y = -1.3;
      const floor = new THREE.Mesh(new THREE.CircleGeometry(0.7, 10), s.mat({ color: 0x3a3a3a }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.75;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), steel);
      bar.position.y = -0.5;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.4, 10), s.mat({ color: cols[k % 4] }));
      roof.position.y = -0.05;
      gd.add(tub, floor, bar, roof);
      s.root.add(gd);
      this.gondolas.push({ gd, a0: (k / 8) * Math.PI * 2 });
      s.addInteractable(tub, {
        prompt: () => (!this.on ? 'A rusty gondola' : this.riding ? '' : 'Climb into the gondola'),
        range: 3.2,
        enabled: () => !this.riding,
        action: () => this.#board(k),
      });
    }
    this.R = R;
  }

  #rides() {
    const s = this.scene;
    const { x, y, z } = this.c;
    // a dead carousel
    const cx = x + 12;
    const cz = z - 8;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.4, 18), s.mat({ color: 0x7a6a5a }));
    base.position.set(cx, y + 0.2, cz);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 1.8, 18), s.mat({ color: 0x8a3a3a }));
    roof.position.set(cx, y + 4.2, cz);
    s.root.add(base, roof);
    s.addColliderBox(cx, y + 1, cz, 8, 2, 8);
    this.carousel = new THREE.Group();
    this.carousel.position.set(cx, y, cz);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const horse = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 1.0), s.mat({ color: [0xe8d8c0, 0x8a5a3a][k % 2] }));
      horse.position.set(Math.cos(a) * 3.1, 1.3, Math.sin(a) * 3.1);
      horse.rotation.y = -a;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 4), s.mat({ color: 0xc8a040 }));
      pole.position.set(Math.cos(a) * 3.1, 2.1, Math.sin(a) * 3.1);
      this.carousel.add(horse, pole);
    }
    s.root.add(this.carousel);
    // bumper cars, nosed together
    const bx = x + 4;
    const bz = z + 14;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), s.mat({ color: 0x3a3a40 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(bx, y + 0.05, bz);
    s.root.add(floor);
    for (let k = 0; k < 6; k++) {
      const car = s.box(1.4, 0.6, 2.0, s.mat({ color: [0xe02a6a, 0x2ab0e0, 0xf0d020][k % 3] }), bx - 5 + k * 2, y + 0.35, bz - 2 + (k % 2) * 3, { rotY: k * 0.7 });
      void car;
    }
    // ticket booth
    const tb = s.box(2, 2.6, 2, s.mat({ color: 0xc84a4a }), x + 20, y + 1.3, z + 20);
    s.addInteractable(tb, {
      prompt: 'Ticket booth',
      action: () => this.game.hud.toast(this.on ? 'A hand-written sign: “RIDES FREE. ENJOY. — THE MGMT (1989)”' : 'A roll of yellowed tickets: ADMIT ONE. Dated August 1989.', 3500),
    });
    this.lights = [
      s.addLight({ position: [this.hub.x, this.hub.y, this.hub.z + 2], color: 0xff60c0, range: 26, intensity: 0, priority: 3 }),
      s.addLight({ position: [cx, y + 3, cz], color: 0xffd060, range: 12, intensity: 0 }),
      s.addLight({ position: [bx, y + 3, bz], color: 0x60d0ff, range: 12, intensity: 0 }),
    ];
  }

  #generator() {
    const s = this.scene;
    const g = this.game;
    const { x, y, z } = this.c;
    const gx = x - 18;
    const gz = z + 16;
    s.box(3, 2.4, 2.4, s.mat({ map: s.tex('siding', 1, 1), color: 0x6a7a6a }), gx, y + 1.2, gz - 1.6);
    const gen = s.box(1.2, 0.9, 0.8, s.mat({ color: 0x8a2a20 }), gx, y + 0.45, gz);
    s.addInteractable(gen, {
      prompt: () => {
        if (this.on) return 'The generator chugs away happily';
        const need = [];
        if (!this.parts.fuse) need.push(g.inventory.has('fuse') ? 'fit the fuse' : 'needs a fuse');
        if (!this.parts.grease) need.push(g.inventory.has('grease') ? 'grease the wheel' : 'the wheel needs grease');
        return need.length ? `Old generator — ${need.join(', ')}` : 'Yank the pull-cord';
      },
      range: 2.6,
      action: () => this.#work(),
    });
  }

  #work() {
    const g = this.game;
    if (this.on) return;
    if (!this.parts.fuse && g.inventory.has('fuse')) {
      g.inventory.remove('fuse');
      this.parts.fuse = true;
      return g.hud.toast('Click. The new fuse seats in the panel.', 2500);
    }
    if (!this.parts.grease && g.inventory.has('grease')) {
      g.inventory.remove('grease');
      this.parts.grease = true;
      return g.hud.toast('You climb up and slather the wheel’s axle in grease. It groans, a little less.', 3500);
    }
    if (!this.parts.fuse || !this.parts.grease) return g.hud.toast(`Needs ${!this.parts.fuse ? 'a fuse (Quik Mart register)' : ''}${!this.parts.fuse && !this.parts.grease ? ' and ' : ''}${!this.parts.grease ? 'gear grease (Quik Mart outdoor aisle)' : ''}.`, 4000);
    this.pulls++;
    g.audio.oneShot('click', { volume: 0.6, rate: 0.5 });
    this.#cough();
    if (this.pulls < 3) return g.hud.toast(['Brrrm… pff.', 'BRRRM-brm-brm… pfff.'][this.pulls - 1], 1500);
    this.#power(true);
    try {
      localStorage.setItem('3am-funland', '1');
    } catch {}
    g.net?.online && g.net.event('funland', {});
    g.hud.toast('BRRRRRRRM. The bulbs flicker… and FUNLAND lights up for the first time since 1989.', 6000);
  }

  #power(on, quiet = false) {
    this.on = on;
    const s = this.scene;
    const cols = [0xffd040, 0xff60c0, 0x60d0ff, 0xff4040, 0x80ff60];
    const lit = cols.map((c) => s.mat({ color: c, unlit: true }));
    const dark = s.mat({ color: 0x5a4a3a });
    [...this.bulbs, ...this.rimBulbs].forEach((b, i) => (b.material = on ? lit[i % lit.length] : dark));
    this.archMat.uniforms.uColor.value.setHex(on ? 0xffffff : 0x8a8a8a);
    for (const l of this.lights) l.intensity = on ? 1.4 : 0;
    if (on && !quiet) this.#calliope(true);
  }

  #board(k) {
    const g = this.game;
    if (!this.on) return g.hud.toast('Rusted solid. The generator shed’s by the west fence.', 2500);
    const gd = this.gondolas[k];
    const ang = gd.a0 + this.angle;
    const low = Math.sin(ang) < -0.8;
    if (!low) return g.hud.toast('Wait for it to come round to the bottom.', 2000);
    this.riding = { k, until: this.angle + Math.PI * 3, start: this.angle };
    g.player.enabled = false;
    g.hud.toast('Up you go. MOUSE to look around.', 3000);
  }

  update(dt, t) {
    const g = this.game;
    // shared clock: everyone sees the wheel at the same angle
    const T = g.dayNight.minutes * 60 + g.dayNight.day * 86400;
    this.angle = this.on ? (T * 0.004) % (Math.PI * 200) : 0.15;
    this.wheel.rotation.z = this.angle;
    for (const gd of this.gondolas) {
      const a = gd.a0 + this.angle;
      gd.gd.position.set(this.hub.x + Math.cos(a) * this.R, this.hub.y + Math.sin(a) * this.R, this.hub.z);
      gd.gd.rotation.z = this.on ? Math.sin(t * 0.8 + gd.a0) * 0.05 : 0.1;
    }
    if (this.on) this.carousel.rotation.y += dt * 0.3;
    if (this.riding) {
      const gd = this.gondolas[this.riding.k];
      g.player.position.copy(gd.gd.position).add(_v.set(0, -1.75, 0));
      if (g.input.locked) g.player.look(g.input.consumeMouseDelta());
      g.farBoost = Math.max(g.farBoost ?? 0, 120);
      if (this.angle > this.riding.until || g.scene !== this.scene) {
        this.riding = null;
        g.player.enabled = true;
        g.farBoost = 0;
        g.player.spawn({ position: gd.gd.position.clone().add(_v.set(2.2, -this.R + 0.1, 3)), yaw: g.player.yaw });
        g.player.spawn({ position: new THREE.Vector3(this.hub.x + 3, this.c.y, this.hub.z + 4), yaw: g.player.yaw });
        g.hud.toast('Back on the ground. Your legs feel funny.', 2500);
      }
    }
    // the calliope keeps playing while you're nearby
    if (this.on) {
      const d = g.scene === this.scene ? g.camera.position.distanceTo(this.c) : 999;
      this.musicGain?.gain.setTargetAtTime(d < 70 ? Math.min(0.08, 4 / (20 + d)) : 0, g.audio.ctx.currentTime, 0.3);
      if (!this.musicGain && d < 70) this.#calliope(true);
    }
  }

  /** A wheezy little calliope waltz (original tune). */
  #calliope(on) {
    if (!on || this.musicGain) return;
    const ctx = this.game.audio.ctx;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.game.audio.master);
    const tune = [0, 4, 7, 4, 12, 7, 4, 7, 2, 5, 9, 5, 14, 9, 5, 9, 0, 4, 7, 12, 11, 7, 4, 0, -1, 2, 7, 5, 4, 2, 0, -5];
    let i = 0;
    setInterval(() => {
      if (!this.musicGain) return;
      const t = ctx.currentTime;
      const n = tune[i++ % tune.length];
      for (const [mul, v, type] of [[1, 0.5, 'square'], [2, 0.2, 'triangle']]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = 392 * Math.pow(2, n / 12) * mul;
        o.detune.value = Math.sin(t * 3) * 12; // the wobble of old pipes
        const e = ctx.createGain();
        e.gain.setValueAtTime(v, t);
        e.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        o.connect(e).connect(this.musicGain);
        o.start(t);
        o.stop(t + 0.35);
      }
      if (i % 3 === 1) {
        const b = ctx.createOscillator();
        b.type = 'triangle';
        b.frequency.value = 98 * Math.pow(2, (tune[(i - 1) % tune.length] % 12) / 12);
        const e = ctx.createGain();
        e.gain.setValueAtTime(0.4, t);
        e.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        b.connect(e).connect(this.musicGain);
        b.start(t);
        b.stop(t + 0.55);
      }
    }, 340);
  }

  #cough() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const n = this.game.audio.noiseSource(false);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    const e = ctx.createGain();
    for (let k = 0; k < 5; k++) {
      e.gain.setValueAtTime(0.5, t + k * 0.12);
      e.gain.exponentialRampToValueAtTime(0.02, t + k * 0.12 + 0.1);
    }
    n.connect(lp).connect(e).connect(this.game.audio.master);
    n.start(t);
    n.stop(t + 0.7);
  }
}

const _v = new THREE.Vector3();
