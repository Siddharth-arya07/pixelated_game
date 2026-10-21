import * as THREE from 'three';

/**
 * Keeper — take Ray's shift at the lighthouse
 * -------------------------------------------
 * Open the keeper's logbook on Ray's desk (night only) and the light is
 * yours until dawn:
 *
 *  · WIND the clockwork (gallery, by the lantern room) — hold E. As it runs
 *    down the lamp slows; let it stop and the ships complain.
 *  · POLISH the lens (gallery) — hold E. Soot builds up and dims the beam.
 *  · LOG passing ships — look through the gallery telescope and press R when
 *    one's in the crosshair.
 *  · FOG CALLS — some nights a fishing boat gets lost in the fog. Sound the
 *    foghorn on the gallery (E) every so often and it steers toward the sound
 *    until it's safe in the harbor.
 *
 * At dawn Ray settles up: pay + friendship. In a room the shift is shared:
 * anyone can wind, polish, log or sound the horn, and everyone sees the
 * same lamp and the same lost boat (events 'keeper').
 */
export class Keeper {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.spring = 1; // clockwork wound (0..1)
    this.soot = 0; // 0 clean .. 1 filthy
    this.logged = new Set();
    this.boat = null;
    this.horns = 0;
    this.#ui();
    game.mp?.on('keeper', (e) => this.#apply(e, true));
  }

  get speed() {
    return this.on ? THREE.MathUtils.clamp(this.spring * 1.4, 0, 1) : 1;
  }

  get bright() {
    return this.on ? 1 - this.soot * 0.8 : 1;
  }

  // ---------------------------------------------------------------------------

  setupWorld(W) {
    this.W = W;
    const { ax, az, y } = W.gallery;
    const g = this.game;
    const near = (dx, dz) => [ax + dx, y + 1, az + dz];
    const vol = (dx, dz, def) => {
      const [x, yy, z] = near(dx, dz);
      W.interactVolume(x, yy, z, 1.2, 2, 1.2, def);
    };
    vol(-1.6, -1.6, {
      prompt: () => (this.on ? `Wind the clockwork (hold E) · ${Math.round(this.spring * 100)}%` : 'The lamp’s clockwork'),
      action: () => this.#hold('wind'),
    });
    vol(1.6, -1.6, {
      prompt: () => (this.on ? `Polish the lens (hold E) · ${Math.round((1 - this.soot) * 100)}% clean` : 'The great lens'),
      action: () => this.#hold('clean'),
    });
    // the foghorn: a brass trumpet on the rail
    const [hx, hy, hz] = near(2.2, 1.6);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.0, 10, 1, true), W.mat({ color: 0xc8a050, doubleSide: true }));
    horn.rotation.z = -Math.PI / 2;
    horn.position.set(hx, hy, hz);
    W.root.add(horn);
    W.addInteractable(horn, { prompt: 'Sound the foghorn', range: 2.5, action: () => this.horn() });
  }

  /** Open the keeper's logbook (in Ray's room). */
  start() {
    const g = this.game;
    if (this.on) return this.#status();
    const m = g.dayNight.minutes;
    if (m > 360 && m < 1200) return g.hud.toast('The light’s off in the daytime. Come back after dark.', 3000);
    this.#apply({ op: 'start' });
    g.hud.toast('Ray hands you the keys. “Wind it, keep the glass clean, log the ships. And if you hear a boat in the fog — talk to it with the horn.”', 7000);
  }

  horn() {
    const g = this.game;
    g.audio.oneShot('foghorn', { volume: 1 });
    g.camera.userData.shake = 0.04;
    if (this.on) this.#apply({ op: 'horn' });
  }

  /** Telescope: R while a ship's in the crosshair. */
  logShip(name) {
    if (!this.on || this.logged.has(name)) return false;
    this.#apply({ op: 'log', name });
    return true;
  }

  #hold(kind) {
    if (!this.on) return this.game.hud.toast('Open the keeper’s logbook in Ray’s room to take the shift.', 3000);
    this.holding = kind;
  }

  // ---- shared state ------------------------------------------------------------------------

  #apply(e, fromNet = false) {
    const g = this.game;
    if (!fromNet) g.net?.online && g.net.event('keeper', e);
    if (e.op === 'start' && !this.on) {
      this.on = true;
      this.spring = 0.7;
      this.soot = 0.35;
      this.logged.clear();
      this.horns = 0;
      this.fogT = 60 + Math.random() * 90;
      this.boat = null;
      this.el.classList.remove('hidden');
      if (fromNet) g.hud.toast('Someone in the room has taken the lighthouse shift. Lend a hand?', 4000);
    }
    if (!this.on) return;
    if (e.op === 'wind') this.spring = Math.min(1, this.spring + e.v);
    if (e.op === 'clean') this.soot = Math.max(0, this.soot - e.v);
    if (e.op === 'log') {
      this.logged.add(e.name);
      g.hud.toast(`Logged: ${e.name}. (${this.logged.size} ship${this.logged.size === 1 ? '' : 's'} tonight)`, 2500);
    }
    if (e.op === 'fog' && !this.boat) this.#spawnBoat(e.x, e.z);
    if (e.op === 'horn') this.#boatHears();
    if (e.op === 'end') this.#end(fromNet);
  }

  #spawnBoat(x, z) {
    const W = this.W;
    const obj = this.game.assets.model('fishing_boat') ?? new THREE.Group();
    obj.scale.multiplyScalar(0.7);
    obj.position.set(x, 0, z);
    W.root.add(obj);
    const light = W.addLight({ position: [x, 3, z], color: 0xffd890, range: 10, intensity: 1.2, flicker: 0.2 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), W.mat({ color: 0xffd890, unlit: true, fogScale: 0.1 }));
    W.root.add(glow);
    this.boat = { obj, light, glow, heading: Math.random() * 6, target: null, heard: 0, t: 0 };
    this.game.hud.toast('📻 Crackle… “—anyone? This is the Dorothy May, we’re turned round in this fog—” A lost boat! Sound the foghorn on the gallery.', 7000);
    this.game.radio && this.#crackle();
  }

  #boatHears() {
    const b = this.boat;
    if (!b) return;
    b.heard++;
    const H = this.W.poi.harbor;
    b.target = new THREE.Vector3(H.x + 40, 0, H.z); // steer for the pier
    b.steerT = 18;
    this.game.hud.toast(b.heard === 1 ? '📻 “We hear you! Which way— again, give us another!”' : b.heard < 4 ? '📻 “Getting closer, keep it coming!”' : '📻 “We can see the pier lights! Bless you, lighthouse!”', 3500);
  }

  #end(fromNet) {
    const g = this.game;
    this.on = false;
    this.el.classList.add('hidden');
    const saved = this.saved;
    if (this.boat) {
      this.boat.obj.removeFromParent();
      this.boat.glow.removeFromParent();
      this.W.lights = this.W.lights.filter((l) => l !== this.boat.light);
      this.boat = null;
    }
    if (fromNet) return;
    const pay = 15 + this.logged.size * 4 + (saved ? 25 : 0) + Math.round((1 - this.soot) * 10);
    g.inventory.earn(pay);
    g.hud.toast(`Dawn. Ray’s waiting at the bottom of the stairs with two cups of tea. “${saved ? 'You brought the Dorothy May home. ' : ''}${this.logged.size} ships logged. Good shift, keeper.” (+$${pay})`, 8000);
    this.saved = false;
  }

  // ---------------------------------------------------------------------------

  update(dt) {
    const g = this.game;
    if (!this.on) return;
    // the clockwork runs down, the lens sooting up
    this.spring = Math.max(0, this.spring - dt / 200);
    this.soot = Math.min(1, this.soot + dt / 320);
    if (this.spring <= 0 && !this.stopMsg) {
      this.stopMsg = true;
      g.hud.toast('The lamp has stopped turning! Out at sea, a ship sounds its horn, annoyed. Wind the clockwork!', 5000);
    }
    if (this.spring > 0.1) this.stopMsg = false;
    // holding E on the clockwork / lens
    if (this.holding) {
      if (!g.input.down('KeyE') || g.scene !== this.W) this.holding = null;
      else {
        this.acc = (this.acc ?? 0) + dt;
        if (this.acc > 0.25) {
          this.#apply({ op: this.holding, v: this.acc * (this.holding === 'wind' ? 0.25 : 0.2) });
          this.acc = 0;
          g.audio.oneShot('click', { volume: 0.25, rate: this.holding === 'wind' ? 0.6 : 1.8 });
        }
      }
    }
    // a lost boat in the fog, now and then (only one client decides: the host)
    if (!this.boat && (this.fogT -= dt) <= 0 && (g.net?.isHost ?? true)) {
      this.fogT = 999999;
      const a = -0.6 + Math.random() * 1.2;
      this.#apply({ op: 'fog', x: 470 + Math.cos(a) * 60, z: -40 + Math.sin(a) * 120 });
    }
    if (this.boat) this.#boatTick(dt);
    // dawn ends the shift
    const m = g.dayNight.minutes;
    if (m >= 380 && m < 400 && (g.net?.isHost ?? true)) this.#apply({ op: 'end' });
    this.#status();
  }

  #boatTick(dt) {
    const b = this.boat;
    const o = b.obj;
    b.t += dt;
    if (b.target && (b.steerT -= dt) > 0) {
      const want = Math.atan2(b.target.x - o.position.x, b.target.z - o.position.z);
      const d = THREE.MathUtils.euclideanModulo(want - b.heading + Math.PI, Math.PI * 2) - Math.PI;
      b.heading += Math.sign(d) * Math.min(Math.abs(d), dt * 0.4);
    } else b.heading += Math.sin(b.t * 0.3) * dt * 0.3; // wandering, lost
    const sp = b.target && b.steerT > 0 ? 4 : 1.2;
    o.position.x += Math.sin(b.heading) * sp * dt;
    o.position.z += Math.cos(b.heading) * sp * dt;
    o.position.x = THREE.MathUtils.clamp(o.position.x, 345, 490);
    o.position.y = Math.sin(b.t * 0.8) * 0.2;
    o.rotation.y = b.heading;
    b.light.position.set(o.position.x, 3, o.position.z);
    b.glow.position.set(o.position.x, 3.5, o.position.z);
    const H = this.W.poi.harbor;
    if (Math.hypot(o.position.x - (H.x + 40), o.position.z - H.z) < 12) {
      this.saved = true;
      this.game.hud.toast('📻 “We’re in! We’re tied up at the pier! Thank you, lighthouse!” The Dorothy May is safe.', 6000);
      b.obj.removeFromParent();
      b.glow.removeFromParent();
      this.W.lights = this.W.lights.filter((l) => l !== b.light);
      this.boat = null;
    }
  }

  #crackle() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const n = this.game.audio.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.15, t);
    e.gain.linearRampToValueAtTime(0, t + 1.5);
    n.connect(f).connect(e).connect(this.game.audio.master);
    n.start(t);
    n.stop(t + 1.6);
  }

  #ui() {
    this.el = document.createElement('div');
    this.el.id = 'keeper';
    this.el.className = 'hidden';
    document.getElementById('ui').appendChild(this.el);
  }

  #status() {
    if (!this.on) return;
    const bar = (v, good = true) => `<i style="width:${Math.round(v * 100)}%;background:${(good ? v : 1 - v) < 0.3 ? '#ff6a4a' : '#ffd890'}"></i>`;
    this.el.innerHTML = `<div class="jb-head">KEEPER’S SHIFT · until dawn</div>
      <div class="jb-row"><b>Clockwork</b><em>${bar(this.spring)}</em></div>
      <div class="jb-row"><b>Lens</b><em>${bar(1 - this.soot)}</em></div>
      <div class="jb-row"><b>Ships logged</b> ${this.logged.size} <span>gallery telescope, R on a ship</span></div>
      ${this.boat ? '<div class="jb-row ready"><b>Lost boat in the fog!</b><span>sound the foghorn on the gallery</span></div>' : ''}`;
  }
}
