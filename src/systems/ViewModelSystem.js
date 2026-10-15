import * as THREE from 'three';
import { prop } from '../scenes/Props.js';

/**
 * ViewModelSystem
 * ---------------
 * First-person hands.
 *
 * DRINK / EAT are short scripted animations (`play('drink' | 'eat', item)`).
 *
 * SMOKING is a state you're in until you toss the butt (`startSmoking()`):
 *   - light up: left hand brings a Zippo up, flicks the lid, cups the flame
 *   - hold LMB  → cigarette to your lips, drag (ember flares, lights your face)
 *     release   → lower it, exhale (bigger drag = bigger cloud)
 *   - R         → flick the ash (it also drops by itself when it gets long)
 *   - G         → toss it (also happens when it burns down to the filter)
 *   Works walking, sitting, or driving. Smoke curls off the tip while lit.
 *
 * Everything hangs off the camera, so it renders in any scene.
 */

// Poses in camera space (camera looks down -Z). r = right hand, l = left hand.
const R_POSE = {
  hidden: { x: 0.22, y: -0.6, z: -0.35, rx: 0.4, ry: 0, rz: 0 },
  hold: { x: 0.17, y: -0.21, z: -0.4, rx: 0.1, ry: -0.25, rz: 0.08 },
  mouth: { x: 0.04, y: -0.13, z: -0.26, rx: 0.15, ry: -0.1, rz: 0.05 },
  tilt: { x: 0.03, y: -0.1, z: -0.24, rx: 0.3, ry: -0.05, rz: 0.05 },
  cigHold: { x: 0.19, y: -0.24, z: -0.42, rx: 0.15, ry: -0.35, rz: 0.25 },
  cigMouth: { x: 0.035, y: -0.105, z: -0.2, rx: 0.05, ry: -0.55, rz: 0.15 },
  cigFlick: { x: 0.22, y: -0.2, z: -0.42, rx: 0.15, ry: -0.35, rz: 0.55 },
};
const L_POSE = {
  hidden: { x: -0.24, y: -0.6, z: -0.35, rx: 0.4, ry: 0, rz: 0 },
  lighter: { x: -0.035, y: -0.15, z: -0.24, rx: 0.1, ry: 0.5, rz: -0.1 },
};

const EMBER_COLD = new THREE.Color(0x5a1c0e);
const EMBER_HOT = new THREE.Color(0xffb050);

const DRINK_PROPS = { beer: 'beer_can', soda: 'soda_can', energy_drink: 'energy_drink' };
const FOOD_PROPS = { pizza: 'pizza', hot_pizza: 'pizza', chips: 'chips_bag', candy: 'candy_bar', cooked_venison: 'pizza_whole' };

export class ViewModelSystem {
  constructor(game) {
    this.game = game;
    this.busy = false; // a scripted animation is running
    this.smoking = false;
    this.lights = []; // merged into the frame's point lights by Game
    this.puffs = [];
  }

  init() {
    const r = this.game.renderer;
    const skin = r.material({ color: 0xc89878 });
    const skinDark = r.material({ color: 0xa87858 });
    const sleeve = r.material({ color: 0x2a2a3a });
    this.right = makeHand(skin, skinDark, sleeve, 1);
    this.left = makeHand(skin, skinDark, sleeve, -1);
    // Both hands live under one root so narrow windows can squeeze them in.
    this.root = new THREE.Group();
    this.game.camera.add(this.root);
    for (const h of [this.right, this.left]) {
      h.pivot.visible = false;
      this.root.add(h.pivot);
    }
    setPose(this.right.pivot, R_POSE.hidden);
    setPose(this.left.pivot, L_POSE.hidden);

    // ---- cigarette: filter + paper (shrinks) + ash (grows) + ember -----------
    this.cig = new THREE.Group();
    const paperGeo = new THREE.CylinderGeometry(0.005, 0.005, 1, 6);
    paperGeo.translate(0, -0.5, 0); // grows from the filter end along -Y
    paperGeo.rotateX(-Math.PI / 2); // …now along -Z (away from the hand)
    this.paper = new THREE.Mesh(paperGeo, r.material({ color: 0xf2eee6 }));
    this.paper.scale.set(1, 1, 0.07);
    const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.024, 6), r.material({ color: 0xd8a050 }));
    filter.rotation.x = Math.PI / 2;
    filter.position.z = 0.012;
    const ashGeo = new THREE.CylinderGeometry(0.0048, 0.0052, 1, 6);
    ashGeo.translate(0, -0.5, 0);
    ashGeo.rotateX(-Math.PI / 2);
    this.ash = new THREE.Mesh(ashGeo, r.material({ color: 0x8a8884 }));
    this.emberMat = r.material({ color: 0x5a1c0e, unlit: true });
    this.ember = new THREE.Mesh(new THREE.CylinderGeometry(0.0054, 0.0054, 0.005, 6), this.emberMat);
    this.ember.rotation.x = Math.PI / 2;
    this.cig.add(filter, this.paper, this.ash, this.ember);
    this.cig.scale.setScalar(1.7); // real size is sub-pixel at 240 lines
    this.cig.visible = false;
    // Held between index and middle finger.
    this.cig.position.set(0.012, 0.035, -0.035);
    this.cig.rotation.set(0.1, 0.35, 0);
    this.right.hand.add(this.cig);

    // ---- Zippo: body, hinged lid, wheel, flame ---------------------------------
    this.lighter = new THREE.Group();
    const chrome = r.material({ color: 0xb8b8c0 });
    this.lighter.add(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.04, 0.014), chrome));
    this.lid = new THREE.Group();
    this.lid.position.set(-0.018, 0.02, 0);
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.018, 0.014), chrome);
    lidMesh.position.set(0.018, 0.009, 0);
    this.lid.add(lidMesh);
    this.lighter.add(this.lid);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 6), r.material({ color: 0x505058 }));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0.008, 0.026, 0);
    this.lighter.add(wheel);
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.032, 5), r.material({ color: 0xffc050, unlit: true }));
    this.flame.position.set(0.004, 0.042, 0);
    this.flame.visible = false;
    this.lighter.add(this.flame);
    this.lighter.position.set(0, 0.05, -0.02);
    this.lighter.scale.setScalar(1.5);
    this.left.hand.add(this.lighter);

    this.emberLight = { position: new THREE.Vector3(), color: new THREE.Color(0xff6020), range: 1.6, intensity: 0, enabled: true, priority: 6 };
    this.flameLight = { position: new THREE.Vector3(), color: new THREE.Color(0xffa040), range: 2.2, intensity: 0, enabled: true, priority: 6 };

    // ---- smoke puff pool (world space, lives in the active scene) ---------------
    this.fxRoot = new THREE.Group();
    const puffGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const puffTex = smokeTexture();
    for (let i = 0; i < 70; i++) {
      const m = r.material({ map: puffTex, color: 0xb0b0bc, unlit: true, opacity: 0.3, doubleSide: true, affine: 0, depthWrite: false });
      const p = new THREE.Mesh(puffGeo, m);
      p.visible = false;
      p.frustumCulled = false;
      p.userData = { life: 0, max: 1, vel: new THREE.Vector3(), grow: 1, base: 0.3, seed: Math.random() * 10 };
      this.fxRoot.add(p);
      this.puffs.push(p);
    }
    this.smoke = null;
  }

  get tweens() {
    return this.game.tweens;
  }

  /** Can the hands do something else right now? */
  get handsFree() {
    return !this.busy && !this.smoking;
  }

  #go(hand, p, dur, ease = 'inOut') {
    const t = this.tweens;
    return Promise.all([
      t.to(hand.pivot.position, { x: p.x, y: p.y, z: p.z }, dur, { ease }),
      t.to(hand.pivot.rotation, { x: p.rx, y: p.ry, z: p.rz }, dur, { ease }),
    ]);
  }

  #wait(s) {
    return this.tweens.to({ v: 0 }, { v: 1 }, s);
  }

  #propFor(key) {
    const obj = prop({ r: this.game.renderer, assets: this.game.assets }, key);
    const box = new THREE.Box3().setFromObject(obj);
    obj.position.sub(box.getCenter(new THREE.Vector3()));
    const g = new THREE.Group();
    g.add(obj);
    return g;
  }

  // ===========================================================================
  // Drink / eat (scripted)
  // ===========================================================================

  async play(kind, itemId) {
    if (!this.handsFree) return false;
    this.busy = true;
    const R = this.right;
    R.pivot.visible = true;
    setPose(R.pivot, R_POSE.hidden);
    setGrip(R, 'wrap');
    try {
      if (kind === 'drink') await this.#drink(itemId);
      else if (kind === 'eat') await this.#eat(itemId);
    } finally {
      R.socket.clear();
      R.socket.rotation.set(0, 0, 0);
      R.pivot.visible = false;
      this.busy = false;
    }
    return true;
  }

  async #drink(itemId) {
    const g = this.game;
    const R = this.right;
    R.socket.add(this.#propFor(DRINK_PROPS[itemId] ?? 'beer_can'));
    await this.#go(R, R_POSE.hold, 0.35, 'out');
    g.audio.oneShot('can_open', { volume: 0.8 });
    await this.#wait(0.35);
    await this.#go(R, R_POSE.mouth, 0.35);
    this.tweens.to(g.player, { pitchOffset: 0.2 }, 0.5);
    this.tweens.to(R.socket.rotation, { x: 1.25 }, 0.5);
    await this.#go(R, R_POSE.tilt, 0.5);
    g.audio.oneShot('gulp', { volume: 0.7 });
    await this.#wait(1.3);
    this.tweens.to(g.player, { pitchOffset: 0 }, 0.5);
    this.tweens.to(R.socket.rotation, { x: 0 }, 0.45);
    await this.#go(R, R_POSE.hold, 0.45);
    await this.#wait(0.15);
    await this.#go(R, R_POSE.hidden, 0.35, 'in');
  }

  async #eat(itemId) {
    const g = this.game;
    const R = this.right;
    const food = this.#propFor(FOOD_PROPS[itemId] ?? 'pizza');
    if (itemId === 'pizza' || itemId === 'hot_pizza') food.rotation.set(-1.2, 0, 0.4);
    R.socket.add(food);
    await this.#go(R, R_POSE.hold, 0.35, 'out');
    for (let i = 0; i < 3; i++) {
      await this.#go(R, R_POSE.mouth, 0.25);
      g.audio.oneShot('footstep_1', { volume: 0.5, rate: 2.2 }); // crunchy bite
      food.scale.multiplyScalar(0.8);
      await this.#go(R, R_POSE.hold, 0.3);
      await this.#wait(0.35);
    }
    await this.#go(R, R_POSE.hidden, 0.35, 'in');
  }

  // ===========================================================================
  // Bong (scripted): lean in, light the bowl, long bubbling pull, big cloud
  // ===========================================================================

  async bongHit() {
    if (!this.handsFree) return false;
    const g = this.game;
    const L = this.left;
    this.busy = true;
    try {
      setGrip(L, 'fist');
      L.pivot.visible = true;
      setPose(L.pivot, L_POSE.hidden);
      this.tweens.to(g.player, { pitchOffset: -0.32 }, 0.6);
      await this.#go(L, L_POSE.lighter, 0.5, 'out');
      await this.tweens.to(this.lid.rotation, { z: 2.2 }, 0.12, { ease: 'out' });
      g.audio.oneShot('lighter', { volume: 0.8 });
      this.flame.visible = true;
      this.flameLight.intensity = 1.2;
      g.audio.oneShot('bubble', { volume: 0.7 });
      g.audio.oneShot('inhale', { volume: 0.8, rate: 0.8 });
      await this.#wait(2.3);
      this.flame.visible = false;
      this.flameLight.intensity = 0;
      await this.tweens.to(this.lid.rotation, { z: 0 }, 0.1);
      this.tweens.to(g.player, { pitchOffset: 0.05 }, 0.6);
      await this.#go(L, L_POSE.hidden, 0.4, 'in');
      L.pivot.visible = false;
      await this.#wait(0.6); // hold it…
      this.#exhale(3.4);
      setTimeout(() => this.#exhale(2.2), 350);
      g.audio.oneShot('exhale', { volume: 0.7, rate: 0.85 });
      if (Math.random() < 0.45) setTimeout(() => g.audio.oneShot('cough', { volume: 0.8 }), 900);
      await this.#wait(0.8);
      this.tweens.to(g.player, { pitchOffset: 0 }, 0.8);
    } finally {
      L.pivot.visible = false;
      this.busy = false;
    }
    return true;
  }

  // ===========================================================================
  // Smoking (interactive)
  // ===========================================================================

  async startSmoking() {
    if (!this.handsFree) return false;
    const g = this.game;
    const R = this.right;
    const L = this.left;
    this.smoking = true;
    this.smoke = { state: 'lighting', length: 1, ash: 0, dragT: 0, wispT: 0, ashSince: 0 };
    this.#updateCigGeometry();
    this.cig.visible = true;
    this.emberLight.intensity = 0;
    setGrip(R, 'cig');
    setGrip(L, 'fist');
    R.pivot.visible = true;
    L.pivot.visible = true;
    setPose(R.pivot, R_POSE.hidden);
    setPose(L.pivot, L_POSE.hidden);

    // Cig to the lips, lighter up, flick the lid, strike, cup, first drag.
    await Promise.all([this.#go(R, R_POSE.cigMouth, 0.5, 'out'), this.#go(L, L_POSE.lighter, 0.55, 'out')]);
    await this.tweens.to(this.lid.rotation, { z: 2.2 }, 0.12, { ease: 'out' });
    g.audio.oneShot('lighter', { volume: 0.8 });
    this.flame.visible = true;
    this.flameLight.intensity = 1.1;
    await this.#wait(0.25);
    g.audio.oneShot('inhale', { volume: 0.6 });
    await this.tweens.to(this.emberLight, { intensity: 1.2 }, 0.9);
    this.flame.visible = false;
    this.flameLight.intensity = 0;
    await this.tweens.to(this.lid.rotation, { z: 0 }, 0.1);
    g.audio.oneShot('click', { volume: 0.4 });
    await Promise.all([this.#go(L, L_POSE.hidden, 0.4, 'in'), this.#go(R, R_POSE.cigHold, 0.5), this.tweens.to(this.emberLight, { intensity: 0.35 }, 0.5)]);
    L.pivot.visible = false;
    this.#exhale(1.2);
    g.audio.oneShot('exhale', { volume: 0.5 });
    if (this.smoke) this.smoke.state = 'hold';
    return true;
  }

  /** Called every frame while smoking (from update). */
  #smokeInput(dt) {
    const s = this.smoke;
    const g = this.game;
    const input = g.input;
    const R = this.right;
    // The laptop/menus own the mouse; a drag needs the pointer locked.
    const canDrag = input.locked && !g.focus && !g.uiOpen && !g.fishing.active;

    // Burning: slowly by itself, much faster while dragging.
    const burn = (s.state === 'drag' ? 0.03 : 0.0065) * dt;
    if (s.state !== 'lighting' && s.state !== 'toss') {
      s.length = Math.max(0, s.length - burn);
      s.ash = Math.min(0.35, s.ash + burn);
      s.ashSince += dt;
    }
    if (s.ash > 0.22 && s.state === 'hold') this.#dropAsh(); // falls by itself
    this.#updateCigGeometry();

    switch (s.state) {
      case 'hold':
        if (canDrag && input.mouseDown(0)) {
          s.state = 'toMouth';
          this.#go(R, R_POSE.cigMouth, 0.35).then(() => {
            if (this.smoke?.state !== 'toMouth') return;
            s.state = 'drag';
            s.dragT = 0;
            g.audio.oneShot('inhale', { volume: 0.6 });
          });
        } else if (input.pressed('KeyR')) this.#flickAsh();
        else if (input.pressed('KeyG') || s.length < 0.12) this.#toss(s.length < 0.12);
        break;
      case 'drag':
        s.dragT += dt;
        this.emberLight.intensity = Math.min(1.4, 0.5 + s.dragT * 0.5);
        g.player.pitchOffset = Math.min(0.06, s.dragT * 0.03);
        if (!input.mouseDown(0) || s.dragT > 3.5) {
          s.state = 'fromMouth';
          const amount = s.dragT;
          this.tweens.to(g.player, { pitchOffset: 0 }, 0.4);
          this.tweens.to(this.emberLight, { intensity: 0.35 }, 0.7);
          this.#go(R, R_POSE.cigHold, 0.45).then(() => {
            if (!this.smoke) return;
            this.#exhale(amount);
            g.audio.oneShot('exhale', { volume: 0.35 + Math.min(0.4, amount * 0.15) });
            s.state = 'hold';
          });
        }
        break;
    }
  }

  async #flickAsh() {
    const s = this.smoke;
    s.state = 'flick';
    await this.#go(this.right, R_POSE.cigFlick, 0.08, 'out');
    this.#dropAsh();
    await this.#go(this.right, R_POSE.cigHold, 0.2);
    if (this.smoke) s.state = 'hold';
  }

  #dropAsh() {
    const s = this.smoke;
    if (!s || s.ash < 0.01) return;
    // A few grey flecks fall from the tip.
    for (let i = 0; i < 3; i++) {
      const p = this.puffs.find((q) => !q.visible);
      if (!p) break;
      this.ember.getWorldPosition(p.position);
      Object.assign(p.userData, { life: 0, max: 0.8, grow: 0, base: 0.9, fall: true });
      p.userData.vel.set((Math.random() - 0.5) * 0.2, -0.3, (Math.random() - 0.5) * 0.2);
      p.scale.setScalar(0.12);
      p.material.uniforms.uColor.value.set(0x6a6864);
      p.visible = true;
    }
    s.ash = 0;
    s.ashSince = 0;
  }

  async #toss(burntOut) {
    const s = this.smoke;
    s.state = 'toss';
    const g = this.game;
    if (burntOut) g.hud.toast('Burnt down to the filter.');
    await this.#go(this.right, { ...R_POSE.cigHold, x: 0.3, y: -0.12, rz: -0.7 }, 0.18, 'in');
    // The butt arcs away with its ember.
    const butt = this.puffs.find((q) => !q.visible);
    if (butt) {
      this.ember.getWorldPosition(butt.position);
      const fwd = new THREE.Vector3();
      g.camera.getWorldDirection(fwd);
      Object.assign(butt.userData, { life: 0, max: 1.2, grow: 0, base: 1, fall: true, gravity: 6 });
      butt.userData.vel.copy(fwd).multiplyScalar(3).add(new THREE.Vector3(0.8, 1.5, 0));
      butt.scale.setScalar(0.08);
      butt.material.uniforms.uColor.value.set(0xff8030);
      butt.visible = true;
    }
    this.cig.visible = false;
    this.emberLight.intensity = 0;
    await this.#go(this.right, R_POSE.hidden, 0.3, 'in');
    this.#endSmoking();
  }

  #endSmoking() {
    this.smoking = false;
    this.smoke = null;
    this.right.pivot.visible = false;
    this.left.pivot.visible = false;
    this.cig.visible = false;
    this.emberLight.intensity = 0;
    this.flameLight.intensity = 0;
    this.game.player.pitchOffset = 0;
  }

  /** Put it out immediately (e.g. getting into a vehicle in a hurry). */
  cancel() {
    if (this.smoking) this.#endSmoking();
  }

  #updateCigGeometry() {
    const s = this.smoke;
    if (!s) return;
    const L = 0.075 * s.length; // paper length in metres (before the 1.7 scale)
    this.paper.scale.z = Math.max(0.001, L);
    this.ash.scale.z = Math.max(0.0005, 0.03 * s.ash);
    this.ash.position.z = -L;
    this.ember.position.z = -L - 0.03 * s.ash - 0.002;
  }

  /** Burst of smoke from the mouth. `amount` ≈ seconds of drag. */
  #exhale(amount) {
    const cam = this.game.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const count = Math.min(14, Math.round(4 + amount * 4));
    for (let i = 0; i < count; i++) {
      const p = this.puffs.find((q) => !q.visible);
      if (!p) return;
      const ud = p.userData;
      p.position.copy(cam.position).addScaledVector(fwd, 0.45 + i * 0.025).y -= 0.08;
      ud.vel.copy(fwd).multiplyScalar(0.35 + Math.random() * 0.3 + amount * 0.05);
      ud.vel.x += (Math.random() - 0.5) * 0.18;
      ud.vel.y += 0.08 + Math.random() * 0.1;
      ud.vel.z += (Math.random() - 0.5) * 0.18;
      Object.assign(ud, { life: -i * 0.06, max: 2.4 + Math.random() * 1.2, grow: 2.5 + Math.random() * 2, base: 0.3, fall: false, gravity: 0 });
      p.material.uniforms.uColor.value.set(0xb0b0bc);
      p.visible = true;
      p.scale.setScalar(0.4);
    }
  }

  /** One puff of smoke rising from a world position (burning pan, etc.). */
  puffAt(pos) {
    const p = this.puffs.find((q) => !q.visible);
    if (!p) return;
    const ud = p.userData;
    p.position.copy(pos);
    ud.vel.set((Math.random() - 0.5) * 0.1, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.1);
    Object.assign(ud, { life: 0, max: 3, grow: 3, base: 0.3, fall: false, gravity: 0 });
    p.material.uniforms.uColor.value.set(0x6a6a70);
    p.visible = true;
    p.scale.setScalar(0.4);
  }

  /** Thin curl of smoke off the lit tip. */
  #wisp() {
    const p = this.puffs.find((q) => !q.visible);
    if (!p) return;
    this.ember.getWorldPosition(p.position);
    p.userData.vel.set((Math.random() - 0.5) * 0.03, 0.16, (Math.random() - 0.5) * 0.03);
    Object.assign(p.userData, { life: 0, max: 1.8, grow: 1.4, base: 0.22, fall: false, gravity: 0, curl: true });
    p.material.uniforms.uColor.value.set(0xa8a8b8);
    p.scale.setScalar(0.12);
    p.visible = true;
  }

  // ===========================================================================
  // Per frame
  // ===========================================================================

  update(dt) {
    // Keep the hands on screen in tall/narrow windows (designed for ~16:9).
    this.root.scale.x = THREE.MathUtils.clamp(this.game.camera.aspect / 1.6, 0.45, 1);
    const root = this.game.scene?.root;
    if (root && this.fxRoot.parent !== root) root.add(this.fxRoot);

    if (this.smoking && this.smoke) {
      this.#smokeInput(dt);
      // Ember colour tracks how hard you drag; idle sway of the hand.
      const k = Math.min(this.emberLight.intensity / 1.3, 1);
      this.emberMat.uniforms.uColor.value.copy(EMBER_COLD).lerp(EMBER_HOT, k);
      this.ember.getWorldPosition(this.emberLight.position);
      const s = this.smoke;
      s.wispT -= dt;
      if (s.state === 'hold' && s.wispT <= 0) {
        s.wispT = 0.14;
        this.#wisp();
      }
      if (s.state === 'hold') {
        const t = this.game.time;
        this.right.pivot.position.y = R_POSE.cigHold.y + Math.sin(t * 1.3) * 0.004;
      }
    }
    if (this.flame.visible) {
      this.flame.scale.set(1, 0.85 + Math.random() * 0.35, 1);
      this.flame.getWorldPosition(this.flameLight.position);
    }
    this.lights.length = 0;
    if (this.emberLight.intensity > 0.01) this.lights.push(this.emberLight);
    if (this.flameLight.intensity > 0.01) this.lights.push(this.flameLight);

    const cam = this.game.camera;
    const t = this.game.time;
    for (const p of this.puffs) {
      if (!p.visible) continue;
      const ud = p.userData;
      ud.life += dt;
      if (ud.life < 0) {
        p.scale.setScalar(0.001);
        continue;
      }
      const k = ud.life / ud.max;
      if (k >= 1) {
        p.visible = false;
        continue;
      }
      if (ud.fall) ud.vel.y -= (ud.gravity || 2) * dt;
      else {
        ud.vel.multiplyScalar(1 - dt * 0.8); // air drag
        ud.vel.y += dt * 0.05; // warm smoke rises
        if (ud.curl) {
          ud.vel.x += Math.sin(t * 2.3 + ud.seed) * 0.05 * dt;
          ud.vel.z += Math.cos(t * 1.7 + ud.seed) * 0.05 * dt;
        }
      }
      p.position.addScaledVector(ud.vel, dt);
      if (ud.grow) p.scale.setScalar(0.4 * (0.4 + k * ud.grow));
      p.quaternion.copy(cam.quaternion);
      p.material.uniforms.uOpacity.value = ud.base * (1 - k) * Math.min(1, ud.life * 6);
    }
  }
}

// =============================================================================
// Hand rig: palm, 4 fingers (2 segments), thumb, sleeve. side = 1 right, -1 left.
// =============================================================================

function makeHand(skin, skinDark, sleeve, side) {
  const pivot = new THREE.Group();
  const hand = new THREE.Group();
  pivot.add(hand);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.08, 0.03), skin);
  hand.add(palm);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const base = new THREE.Group();
    base.position.set((-0.027 + i * 0.018) * side, 0.04, 0);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.034, 0.016), skin);
    a.position.y = 0.017;
    base.add(a);
    const tip = new THREE.Group();
    tip.position.y = 0.034;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.026, 0.015), skinDark);
    b.position.y = 0.013;
    tip.add(b);
    base.add(tip);
    hand.add(base);
    fingers.push({ base, tip });
  }
  const thumb = new THREE.Group();
  thumb.position.set(-0.04 * side, -0.005, 0.005);
  const th = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.04, 0.018), skin);
  th.position.y = 0.02;
  thumb.add(th);
  thumb.rotation.z = 0.7 * side;
  hand.add(thumb);
  const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.035), skin);
  wrist.position.set(0, -0.055, 0);
  hand.add(wrist);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.075), sleeve);
  arm.position.set(0.01 * side, -0.22, 0.03);
  hand.add(arm);
  // Hand faces the camera a bit, fingers up/forward.
  hand.rotation.set(-0.9, 0, 0);
  const socket = new THREE.Group();
  socket.position.set(0, 0.03, -0.04);
  hand.add(socket);
  return { pivot, hand, fingers, thumb, socket, side };
}

/** Finger poses: 'wrap' (can/food), 'cig' (index+middle out), 'fist' (lighter). */
function setGrip(h, mode) {
  const curl = mode === 'cig' ? [0.25, 0.25, 1.4, 1.5] : mode === 'fist' ? [1.4, 1.5, 1.5, 1.5] : [1.0, 1.05, 1.1, 1.15];
  h.fingers.forEach((f, i) => {
    f.base.rotation.x = -curl[i];
    f.tip.rotation.x = -curl[i] * 0.9;
    f.base.rotation.z = mode === 'cig' && i < 2 ? (i === 0 ? 0.08 : -0.08) * h.side : 0;
  });
  h.thumb.rotation.x = mode === 'fist' ? -0.8 : -0.3;
}

function setPose(o, p) {
  o.position.set(p.x, p.y, p.z);
  o.rotation.set(p.rx, p.ry, p.rz);
}

/** Lumpy round puff with a hard (PS1 cutout) edge, painted once. */
function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  for (const [x, y, r] of [
    [16, 17, 9],
    [11, 13, 6],
    [21, 12, 6],
    [12, 21, 5],
    [21, 21, 6],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const img = ctx.getImageData(0, 0, 32, 32);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] > 0) {
      const v = 200 + Math.random() * 55;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
