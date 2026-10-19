import * as THREE from 'three';

/**
 * Balloon — dawn rides from the airfield
 * --------------------------------------
 * A striped hot-air balloon is tethered at the east end of the airfield.
 * Between 5 and 8 a.m. (game time) you can climb into the basket; it lifts
 * off ~10 s after the first person boards (friends can pile in too), drifts
 * up over the forest, the town and the lake while the sun comes up, and
 * settles back down on the airfield about three minutes later.
 *
 * The flight is a fixed path driven by its start time, which is broadcast
 * (event 'balloon'), so everyone in the room sees the same balloon in the
 * same place — and everyone in the basket rides together.
 *
 * In the basket: look around with the mouse. Q fires the burner (whoosh).
 */
const FLIGHT = 190; // seconds
const WAIT = 10;

export class Balloon {
  constructor(game) {
    this.game = game;
    this.t0 = null; // ms timestamp of lift-off
    this.riding = false;
    game.mp?.on('balloon', (e) => {
      if (!this.t0 || Math.abs(this.t0 - e.t0) > 2000) this.t0 = e.t0;
    });
  }

  setupWorld(world) {
    this.world = world;
    const A = world.poi.airfield;
    this.home = new THREE.Vector3(A.x + 70, world.groundHeight(A.x + 70, A.z + 20), A.z + 20);
    const grp = new THREE.Group();
    // envelope: stripes of colour
    const cols = [0xd8302a, 0xf0c030, 0x2a6ab0, 0xf0f0e8];
    for (let k = 0; k < 8; k++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(6, 6, 12, (k / 8) * Math.PI * 2, Math.PI / 4, 0, Math.PI * 0.78), world.mat({ color: cols[k % 4], doubleSide: true }));
      seg.scale.y = 1.25;
      seg.position.y = 12;
      grp.add(seg);
    }
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 1.2, 2.4, 12, 1, true), world.mat({ color: 0xd8302a, doubleSide: true }));
    skirt.position.y = 4.8;
    grp.add(skirt);
    // basket + ropes + burner
    const wick = world.mat({ map: world.tex('planks', 1, 1), color: 0x9a7040 });
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 1.8), wick);
    basket.position.y = 0.52;
    grp.add(basket);
    for (const [dx, dz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, 3.4, 0.03), world.mat({ color: 0x3a3a3a }));
      r.position.set(dx * 1.05, 2.7, dz * 1.05);
      r.rotation.set(dz * 0.18, 0, -dx * 0.18);
      grp.add(r);
    }
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 8), world.mat({ color: 0xffa040, unlit: true, opacity: 0.85, additive: true }));
    this.flame.position.y = 3.6;
    this.flame.visible = false;
    grp.add(this.flame);
    this.lamp = world.addLight({ position: [0, 0, 0], color: 0xffa050, range: 14, intensity: 0, priority: 4 });
    grp.position.copy(this.home);
    world.root.add(grp);
    this.grp = grp;
    world.addColliderBox(this.home.x, this.home.y + 0.5, this.home.z, 0.3, 1, 0.3); // tether post
    world.addInteractable(basket, {
      prompt: () => (this.riding ? '' : this.#canBoard() ? 'Climb into the balloon basket' : this.t0 ? 'The balloon is up — wait for it to come down' : 'Balloon rides at dawn only (5–8 a.m.)'),
      range: 3.5,
      enabled: () => !this.riding,
      action: () => this.#board(),
    });
  }

  #dawn() {
    const m = this.game.dayNight.minutes;
    return m >= 300 && m <= 480;
  }

  #canBoard() {
    if (!this.#dawn()) return false;
    if (!this.t0) return true;
    return Date.now() < this.t0; // still waiting to lift off
  }

  #board() {
    const g = this.game;
    if (!this.#canBoard()) {
      g.hud.toast(this.#dawn() ? 'Already in the air. Next one when it lands.' : 'The pilot only flies at dawn, when the air is still. Come back between 5 and 8 a.m.', 3500);
      return;
    }
    if (!this.t0) {
      this.t0 = Date.now() + WAIT * 1000;
      g.net?.online && g.net.event('balloon', { t0: this.t0 });
      g.hud.toast(`Lifting off in ${WAIT} seconds. Friends can still hop in.`, 4000);
    } else g.hud.toast('You climb in. Lift-off any second.', 2500);
    this.riding = true;
    this.slot = Math.floor(Math.random() * 4);
    g.player.enabled = false;
  }

  /** Position along the flight at t seconds since lift-off. */
  #path(t, out) {
    const h = this.home;
    const k = THREE.MathUtils.clamp(t / FLIGHT, 0, 1);
    // up, a big lazy loop west over the town and the lake road, and back
    const alt = Math.sin(Math.PI * k) ** 0.6 * 130;
    const a = k * Math.PI * 2;
    out.set(h.x - Math.sin(a) * 160 - (1 - Math.cos(a)) * 90, h.y + alt, h.z + Math.sin(a * 0.5) * -60 + Math.sin(a) * 40);
    return out;
  }

  update(dt) {
    const g = this.game;
    if (!this.world) return;
    const now = Date.now();
    const t = this.t0 ? (now - this.t0) / 1000 : -1;
    if (this.t0 && t > FLIGHT) {
      this.t0 = null;
      if (this.riding) this.#land();
    }
    const p = this.#path(Math.max(0, t), _p);
    if (t < 0) p.copy(this.home);
    this.grp.position.copy(p);
    this.grp.rotation.z = Math.sin(g.time * 0.4) * 0.02;
    // burner: on the climb, and whenever a rider presses Q
    const burnAuto = t > 0 && t < FLIGHT * 0.45 && Math.sin(t * 0.9) > 0.55;
    const burn = burnAuto || (this.riding && g.input.down('KeyQ'));
    this.flame.visible = burn;
    this.lamp.intensity = burn ? 1.6 : 0;
    this.lamp.position.copy(p).setY(p.y + 4);
    this.#roar(burn && g.scene === this.world, g.camera.position.distanceTo(p));
    if (this.riding) {
      // stand in the basket; look around freely
      const off = [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]][this.slot];
      g.player.position.set(p.x + off[0], p.y + 0.35, p.z + off[1]);
      if (g.input.locked) g.player.look(g.input.consumeMouseDelta());
      g.farBoost = THREE.MathUtils.damp(g.farBoost ?? 0, Math.min(260, (p.y - this.home.y) * 2), 1, dt);
      if (g.scene !== this.world) {
        this.riding = false;
        g.player.enabled = true;
      }
    }
  }

  #land() {
    const g = this.game;
    this.riding = false;
    g.farBoost = 0;
    g.player.enabled = true;
    g.player.spawn({ position: this.home.clone().add(new THREE.Vector3(2.5, 0, 0)), yaw: g.player.yaw });
    g.hud.toast('A soft bump, and you’re down. The pilot pours you a paper cup of terrible champagne. Tradition.', 5000);
  }

  #roar(on, d) {
    const ctx = this.game.audio.ctx;
    if (!this.noise) {
      this.noise = this.game.audio.noiseSource(true);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      this.noise.connect(f).connect(this.gain).connect(this.game.audio.master);
      this.noise.start();
    }
    this.gain.gain.setTargetAtTime(on ? Math.min(0.45, 20 / (10 + d)) : 0, ctx.currentTime, 0.08);
  }
}

const _p = new THREE.Vector3();
