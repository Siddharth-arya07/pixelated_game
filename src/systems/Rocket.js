import * as THREE from 'three';
import { TRIP } from '../scenes/SpaceScene.js';

/**
 * Rocket — the Moonbeam (Nova's grandad's rocket, on the summit)
 * --------------------------------------------------------------
 * A cream-and-red retro rocket on a pad by Nova's telescope. Board it any
 * time: a 15-second countdown starts (friends can climb in too), it lifts
 * off in a roar — anyone watching from the ground sees it go — and the
 * passengers ride the grand tour (scenes/SpaceScene.js). ~4½ minutes later
 * it settles back on the pad.
 *
 * Shared in a room: the launch time is broadcast (event 'rocket') and sent
 * to people who join late, every passenger gets a seat, and the whole trip
 * is a function of that time.
 */
const COUNT = 15;
const ASCENT = 7; // seconds of lift-off seen from the ground before space

export class Rocket {
  constructor(game) {
    this.game = game;
    this.t0 = null;
    this.riding = false;
    game.mp?.on('rocket', (e) => {
      if (!this.t0 || Math.abs(this.t0 - e.t0) > 2000) this.t0 = e.t0;
    });
  }

  setupWorld(W) {
    this.W = W;
    const P = W.poi.gasStation;
    const x = P.x - 30;
    const z = P.z + 20;
    const y = W.groundHeight(x, z);
    this.pad = new THREE.Vector3(x, y, z);
    // launch pad
    W.box(8, 0.4, 8, W.mat({ color: 0x5a5a60 }), x, y + 0.2, z);
    const tower = W.mat({ color: 0xc83a2a });
    for (const [dx, dz] of [[-3.2, -3.2], [-3.2, -1.8]]) W.box(0.25, 14, 0.25, tower, x + dx, y + 7, z + dz, { collide: false });
    for (let k = 0; k < 7; k++) W.box(0.1, 0.1, 1.6, tower, x - 3.2, y + 1 + k * 2, z - 2.5, { collide: false });
    // the rocket
    const r = new THREE.Group();
    const cream = W.mat({ color: 0xf0e8d0 });
    const red = W.mat({ color: 0xc83a2a });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 9, 16), cream);
    body.position.y = 5.5;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.5, 16), red);
    nose.position.y = 11.75;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.5, 16), red);
    band.position.y = 8;
    r.add(body, nose, band);
    for (let k = 0; k < 4; k++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3, 2), red);
      const a = (k / 4) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 1.8, 2, Math.sin(a) * 1.8);
      fin.rotation.y = -a;
      r.add(fin);
    }
    for (const yy of [6.5, 9]) {
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.45, 14), W.mat({ color: 0xffe0a0, unlit: true }));
      win.position.set(0, yy, 1.52);
      r.add(win);
    }
    const nameC = document.createElement('canvas');
    nameC.width = 128;
    nameC.height = 24;
    const nx = nameC.getContext('2d');
    nx.fillStyle = '#c83a2a';
    nx.font = 'bold 18px Georgia';
    nx.textAlign = 'center';
    nx.fillText('MOONBEAM', 64, 18);
    const name = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.4), W.mat({ map: new THREE.CanvasTexture(nameC) }));
    name.position.set(0, 4, 1.62);
    r.add(name);
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 12), W.mat({ color: 0xffa040, unlit: true, opacity: 0.85, additive: true }));
    this.flame.rotation.x = Math.PI;
    this.flame.position.y = -2.5;
    this.flame.visible = false;
    r.add(this.flame);
    r.position.set(x, y + 0.4, z);
    W.root.add(r);
    this.rocket = r;
    this.light = W.addLight({ position: [x, y + 1, z], color: 0xffa040, range: 40, intensity: 0, priority: 6 });
    W.addColliderBox(x, y + 5, z, 3.4, 10, 3.4);
    W.interactVolume(x, y + 1.8, z + 1.9, 2.2, 3.4, 1, {
      prompt: () => (this.riding ? '' : this.#canBoard() ? 'Board the Moonbeam — a trip to the planets' : this.t0 ? 'The Moonbeam is away. It’ll be back in a few minutes.' : ''),
      enabled: () => !this.riding,
      action: () => this.#board(),
    });
    W.addSpawn('rocket_pad', [x + 4, y + 0.4, z + 5], Math.PI * 0.75);
  }

  #canBoard() {
    return !this.t0 || Date.now() < this.t0;
  }

  #board() {
    const g = this.game;
    if (!this.#canBoard()) return;
    if (!this.t0) {
      this.t0 = Date.now() + COUNT * 1000;
      g.net?.online && g.net.event('rocket', { t0: this.t0 });
      g.hud.toast(`Strapped in. Lift-off in ${COUNT} seconds. (Friends can still climb aboard.)`, 5000);
    } else g.hud.toast('You squeeze into a seat. Lift-off any moment.', 2500);
    this.riding = true;
    this.seat = this.#mySeat();
    g.player.enabled = false;
    this.counted = -1;
  }

  /** Seats by id order, so friends don't sit on each other. */
  #mySeat() {
    const g = this.game;
    if (!g.net?.online) return 0;
    const ids = [g.net.id, ...g.mp.remotes.keys()].sort();
    return Math.max(0, ids.indexOf(g.net.id)) % 4;
  }

  update(dt) {
    const g = this.game;
    if (!this.W) return;
    const now = Date.now();
    const s = this.t0 ? (now - this.t0) / 1000 : -1; // seconds since lift-off
    // the rocket seen from the ground
    if (this.t0 && s >= 0 && s < TRIP + ASCENT) {
      const up = s < ASCENT ? 0.5 * 9 * s * s : 99999;
      const down = s > TRIP ? Math.max(0, (TRIP + ASCENT - s) / ASCENT) ** 2 * 300 : null;
      this.rocket.position.y = this.pad.y + 0.4 + (down != null ? down : up);
      this.rocket.visible = s < ASCENT || down != null;
      this.flame.visible = s < ASCENT || down != null;
      this.flame.scale.y = 1 + Math.sin(g.time * 40) * 0.2;
      this.light.intensity = this.flame.visible ? 2.5 : 0;
      this.light.position.copy(this.rocket.position);
      if (g.scene === this.W && s < ASCENT) {
        const d = g.camera.position.distanceTo(this.pad);
        if (d < 300) g.camera.userData.shake = Math.max(g.camera.userData.shake ?? 0, (1 - d / 300) * 0.12);
        this.#roar(true, d);
      } else this.#roar(false);
    } else {
      this.rocket.position.y = this.pad.y + 0.4;
      this.rocket.visible = true;
      this.flame.visible = false;
      this.light.intensity = 0;
      this.#roar(false);
      if (this.t0 && s >= TRIP + ASCENT) this.t0 = null;
    }
    if (!this.riding) return;
    // aboard
    if (s < 0) {
      // countdown: you're in the capsule on the pad
      g.player.position.set(this.pad.x, this.pad.y + 7, this.pad.z + 0.8);
      const left = Math.ceil(-s);
      if (left !== this.counted && left <= 10) {
        this.counted = left;
        g.hud.toast(`T-minus ${left}…`, 900);
        g.audio.oneShot('click', { volume: 0.4, rate: 0.8 });
      }
      if (g.input.locked) g.player.look(g.input.consumeMouseDelta());
      return;
    }
    if (s < ASCENT) {
      g.player.position.set(this.pad.x, this.rocket.position.y + 7, this.pad.z + 0.8);
      g.camera.userData.shake = 0.08;
      if (this.counted !== 0) {
        this.counted = 0;
        g.hud.toast('LIFT-OFF! 🚀', 2500);
      }
      if (g.input.locked) g.player.look(g.input.consumeMouseDelta());
      return;
    }
    if (g.scene !== g.scenes.Space && !this.going) {
      this.going = true;
      g.fade.classList.add('on');
      g.changeScene('Space', 'default').then(() => {
        g.fade.classList.remove('on');
        g.player.yaw = 0;
        g.player.pitch = -0.1;
        this.going = false;
      });
      return;
    }
    const S = g.scenes.Space;
    const ts = s - ASCENT;
    if (g.scene === S) {
      if (g.input.locked) g.player.look(g.input.consumeMouseDelta());
      S.ride(ts, this.seat);
      g.cameraHook = (cam) => {
        // look around from your seat, relative to the ship
        _q.setFromEuler(_e.set(g.player.pitch, Math.PI + g.player.yaw, 0, 'YXZ'));
        cam.quaternion.copy(S.ship.quaternion).multiply(_q);
        cam.position.copy(g.player.position).add(_off.set(0, 1.0, 0).applyQuaternion(S.ship.quaternion));
      };
      this.#narrate(ts);
      this.#music(true);
    }
    if (ts >= TRIP - 2 && !this.landing) {
      this.landing = true;
      g.fade.classList.add('on');
      setTimeout(async () => {
        g.cameraHook = null;
        this.#music(false);
        await g.changeScene('World', 'rocket_pad');
        g.fade.style.background = '';
        g.fade.classList.remove('on');
        this.riding = false;
        this.landing = false;
        g.player.enabled = true;
        g.hud.toast('A soft bump, the hiss of the hatch, and the smell of the summit pines. Home. Nova is jumping up and down.', 7000);
      }, 1500);
    }
  }

  #narrate(ts) {
    const lines = [
      [2, '📻 Nova: “Can you see Pine Hollow? That little glow is the lighthouse!”'],
      [36, '📻 Nova: “The Moon’s coming up on your left. Are those… rabbits?”'],
      [60, '📻 Nova: “Earthrise. Everybody you know is on that blue marble.”'],
      [96, '📻 Nova: “That pink world is Bloom. Look down — the mushrooms glow.”'],
      [116, '📻 Nova: “The fuzzy ones are waving. I think they’re waving.”'],
      [150, '📻 Nova: “Saturnine. We’re going through the rings. Hold on to something.”'],
      [174, '📻 Nova: “Whales. Space whales. Listen — they’re singing.”'],
      [196, '📻 Nova: “Opal, the crystal world. The tall ones with the lantern heads are called the lantern-folk. Wave back!”'],
      [226, '📻 Nova: “A comet, and behind it the nebula. Grandad dreamed of this view his whole life.”'],
      [252, '📻 Nova: “Heading home. Re-entry might feel warm. Thank you for coming with me.”'],
    ];
    for (const [t, text] of lines) {
      if (ts >= t && (this.said ?? -1) < t) {
        this.said = t;
        this.game.hud.toast(text, 6500);
      }
    }
    if (ts < 1) this.said = -1;
    if (ts > 254) this.game.fade.style.background = 'rgba(255,140,60,0.5)';
    else this.game.fade.style.background = '';
  }

  #roar(on, d = 0) {
    const ctx = this.game.audio.ctx;
    if (!this.noise) {
      this.noise = this.game.audio.noiseSource(true);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      this.roarG = ctx.createGain();
      this.roarG.gain.value = 0;
      this.noise.connect(lp).connect(this.roarG).connect(this.game.audio.master);
      this.noise.start();
    }
    const v = on ? Math.min(0.9, 60 / (30 + d)) : this.riding && this.t0 && (Date.now() - this.t0) / 1000 < ASCENT ? 0.9 : 0;
    this.roarG.gain.setTargetAtTime(v, ctx.currentTime, 0.2);
  }

  /** Soft space-synth pad while you travel (original). */
  #music(on) {
    if (!on) {
      clearInterval(this.musT);
      this.musT = null;
      return;
    }
    if (this.musT) return;
    const ctx = this.game.audio.ctx;
    const chords = [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]];
    let i = 0;
    const play = () => {
      const t = ctx.currentTime;
      for (const n of chords[i++ % 4]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = 220 * Math.pow(2, n / 12);
        const e = ctx.createGain();
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(0.02, t + 1.5);
        e.gain.linearRampToValueAtTime(0, t + 6);
        o.connect(e).connect(this.game.audio.master);
        o.start(t);
        o.stop(t + 6.1);
      }
    };
    play();
    this.musT = setInterval(play, 5000);
  }
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _off = new THREE.Vector3();
