import * as THREE from 'three';
import { prop } from '../scenes/Props.js';

/**
 * FishingSystem
 * -------------
 * State machine:
 *
 *   idle ──E at water──▶ ready ──hold LMB──▶ charging ──release──▶ casting
 *   casting ──bobber lands──▶ waiting ──random timer──▶ bite
 *   bite ──click within window──▶ reeling   (miss → waiting again / fish gone)
 *   reeling: hold LMB to reel (tension rises), release to let tension drop.
 *            tension ≥ 1 → SNAP.  distance ≤ 0 → CAUGHT.  too far → ESCAPED.
 *
 * E or right-click cancels at any time. FishingUI shows the meters.
 */

const SPECIES = [
  // id, weight range (lb), strength 0..1, min cast power to be likely
  { id: 'old_boot', lb: [1, 2], strength: 0.05, far: 0, weight: 0.08 },
  { id: 'fish_perch', lb: [0.3, 1.2], strength: 0.25, far: 0, weight: 0.35 },
  { id: 'fish_trout', lb: [1, 4], strength: 0.45, far: 0.3, weight: 0.22 },
  { id: 'fish_bass', lb: [1.5, 6], strength: 0.55, far: 0.4, weight: 0.2 },
  { id: 'fish_catfish', lb: [3, 15], strength: 0.75, far: 0.6, weight: 0.1 },
  { id: 'fish_pike', lb: [4, 18], strength: 0.9, far: 0.8, weight: 0.05 },
];

export class FishingSystem {
  constructor(game) {
    this.game = game;
    this.state = 'idle';
    this.power = 0;
    this.powerDir = 1;
    this.tension = 0;
    this.distance = 0;
    this.timer = 0;
    this.fish = null;
    this.bobber = null;
    this.line = null;
    this.rodView = null;
    this.waterY = 0;
  }

  get active() {
    return this.state !== 'idle';
  }

  /** Build the held-rod viewmodel, bobber and line (once). */
  init() {
    const ctx = { r: this.game.renderer, assets: this.game.assets };
    let rod = prop(ctx, 'fishing_rod');
    if (rod.userData.fromFile) {
      // The GLB stands upright (tip at +Y, 2 m tall). Lay it along +Z with the
      // grip near the hand, like the procedural one, so the code below agrees.
      rod.rotation.x = Math.PI / 2;
      rod.position.z = -0.8;
      const holder = new THREE.Group();
      holder.add(rod);
      holder.userData.tip = new THREE.Vector3(0, 0, 1.2);
      rod = holder;
    }
    this.rodView = rod;
    this.rodView.visible = false;
    // Held in the lower right of the view, pointing forward (camera looks -Z).
    // Grip just in front of the near plane, chunky enough to survive 320x240.
    this.rodView.position.set(0.24, -0.3, -0.95);
    this.rodView.scale.set(2.2, 2.2, 1);
    this.rodView.rotation.set(0.45, Math.PI, 0.1);
    this.game.camera.add(this.rodView);

    this.bobber = new THREE.Group();
    const red = this.game.renderer.material({ color: 0xd02020, unlit: true });
    const white = this.game.renderer.material({ color: 0xf0f0f0, unlit: true });
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), red);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
    this.bobber.add(top, bot);
    this.bobber.visible = false;

    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd8d8d0 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
  }

  /** Lake scene adds bobber + line to its root on enter. */
  attachTo(scene, waterY) {
    scene.root.add(this.bobber, this.line);
    this.waterY = waterY;
  }

  /** Whether a rod is ready to use. Used by the water interactable. */
  canFish() {
    const inv = this.game.inventory;
    if (!inv.has('fishing_rod')) return 'Need a fishing rod';
    if (inv.equipped !== 'fishing_rod') return 'Equip your rod first [I]';
    if (this.game.viewModel.smoking) return 'Finish your cigarette first';
    return true;
  }

  begin() {
    if (this.canFish() !== true || this.active) return;
    this.state = 'ready';
    this.game.player.movementLocked = true;
    this.game.fishingUI.show();
    this.#status('Hold LEFT MOUSE to cast');
  }

  cancel(msg = 'Reeled in.') {
    this.state = 'idle';
    this.bobber.visible = false;
    this.line.visible = false;
    this.game.player.movementLocked = false;
    this.game.fishingUI.hide();
    if (msg) this.game.hud.toast(msg);
  }

  update(dt, time) {
    const g = this.game;
    const equipped = g.inventory.equipped === 'fishing_rod' && g.player.enabled && !g.viewModel.smoking;
    // Sea or lake: the bobber rides whatever surface is under it.
    const wh = this.bobber.visible ? g.scene?.waterHeight?.(this.bobber.position.x, this.bobber.position.z) : null;
    if (wh !== null && wh !== undefined) this.waterY = wh;
    this.rodView.visible = equipped;
    if (!this.active) return;

    const input = g.input;
    if (input.pressed('KeyE') || input.mousePressed(2)) {
      input.consume('KeyE');
      return this.cancel();
    }

    // Rod sway / bend
    const bend = this.state === 'reeling' ? this.tension * 0.4 : 0;
    this.rodView.rotation.x = 0.45 + bend + Math.sin(time * 1.5) * 0.01;

    switch (this.state) {
      case 'ready':
        if (input.mousePressed(0)) {
          this.state = 'charging';
          this.power = 0;
          this.powerDir = 1;
        }
        break;

      case 'charging':
        // Ping-pong power bar — release at the top for a long cast.
        this.power += this.powerDir * dt * 0.9;
        if (this.power >= 1) (this.power = 1), (this.powerDir = -1);
        if (this.power <= 0) (this.power = 0), (this.powerDir = 1);
        g.fishingUI.setPower(this.power);
        this.#status('Release to cast');
        if (!input.mouseDown(0)) this.#cast();
        break;

      case 'casting': {
        this.timer += dt;
        const t = Math.min(this.timer / 0.7, 1);
        this.bobber.position.lerpVectors(this.castFrom, this.castTo, t);
        this.bobber.position.y += Math.sin(t * Math.PI) * (1.5 + this.power * 3);
        if (t >= 1) {
          g.audio.oneShot('splash', { volume: 0.5, object: this.bobber });
          this.state = 'waiting';
          const bait = g.inventory.has('bait');
          this.timer = (bait ? 2 : 4) + Math.random() * (bait ? 4 : 9);
          this.#status('Waiting for a bite...');
        }
        break;
      }

      case 'waiting':
        this.timer -= dt;
        this.#bob(time, 0.015);
        // Little nibbles to keep you on your toes.
        if (Math.random() < dt * 0.4) this.bobber.position.y -= 0.03;
        if (this.timer <= 0) {
          this.state = 'bite';
          this.timer = 1.1;
          this.fish = this.#rollFish();
          g.audio.oneShot('bite', { volume: 0.7 });
          this.#status('!! BITE — CLICK !!', true);
        }
        break;

      case 'bite':
        this.timer -= dt;
        this.bobber.position.y = this.waterY - 0.08 + Math.sin(time * 30) * 0.03;
        if (input.mousePressed(0)) {
          this.state = 'reeling';
          this.tension = 0.3;
          this.distance = this.castDistance;
          g.fishingUI.showTension(true);
          this.#status('Hold to reel — watch the tension!');
        } else if (this.timer <= 0) {
          this.state = 'waiting';
          this.timer = 3 + Math.random() * 6;
          this.#status('It got away... waiting');
        }
        break;

      case 'reeling':
        this.#reel(dt, time);
        break;
    }

    this.#updateLine();
  }

  #cast() {
    const g = this.game;
    const cam = g.camera;
    this.castDistance = 4 + this.power * 14;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    this.castFrom = this.#rodTip();
    this.castTo = cam.position.clone().addScaledVector(dir, this.castDistance);
    this.castTo.y = this.waterY;
    this.castDir = dir;
    this.timer = 0;
    this.state = 'casting';
    this.bobber.visible = true;
    this.line.visible = true;
    g.fishingUI.setPower(0);
    g.audio.oneShot('reel', { volume: 0.5 });
    this.#status('...');
  }

  #reel(dt, time) {
    const g = this.game;
    const f = this.fish;
    const reeling = g.input.mouseDown(0);

    if (reeling) {
      this.tension += (0.28 + f.strength * 0.55) * dt;
      this.distance -= (3.4 - f.strength * 1.4) * dt;
      if (Math.random() < dt * 8) g.audio.oneShot('reel', { volume: 0.25 });
    } else {
      this.tension -= 0.55 * dt;
      this.distance += f.strength * 1.2 * dt;
    }
    // The fish surges: sudden tension spikes, worse while you're reeling.
    if (Math.random() < dt * (0.6 + f.strength)) this.tension += (reeling ? 0.18 : 0.06) * f.strength;
    this.tension = Math.max(0, this.tension);

    // Bobber follows the fish back toward the dock.
    const k = Math.max(0, this.distance) / Math.max(this.castDistance, 0.001);
    const pull = Math.sin(time * 6) * 0.3 * f.strength;
    this.bobber.position.copy(this.castFrom).addScaledVector(this.castDir, 1 + (this.castDistance - 1) * k);
    this.bobber.position.x += pull;
    this.bobber.position.y = this.waterY - 0.05 + Math.sin(time * 18) * 0.02;

    g.fishingUI.setTension(this.tension, this.distance);

    if (this.tension >= 1) {
      g.audio.oneShot('line_snap', { volume: 0.8 });
      if (g.inventory.has('bait')) g.inventory.remove('bait');
      this.cancel('SNAP! The line broke.');
    } else if (this.distance <= 0) {
      this.#landFish();
    } else if (this.distance > this.castDistance + 6) {
      this.cancel('It swam off with your lure...');
    }
  }

  #landFish() {
    const g = this.game;
    const f = this.fish;
    const def = g.inventory.def(f.id);
    g.inventory.add(f.id);
    if (g.inventory.has('bait') && f.id !== 'old_boot') g.inventory.remove('bait');
    g.audio.oneShot('splash', { volume: 0.6 });
    this.cancel(null);
    g.hud.toast(f.id === 'old_boot' ? 'You caught... an old boot.' : `Caught a ${def.name}! ${f.weight.toFixed(1)} lb`);
  }

  #rollFish() {
    // Long casts reach the deep water where the big ones are.
    const pool = SPECIES.map((s) => ({ s, w: s.weight * (this.power >= s.far ? 1 : 0.15) }));
    let r = Math.random() * pool.reduce((a, p) => a + p.w, 0);
    for (const p of pool) {
      if ((r -= p.w) <= 0) {
        const [a, b] = p.s.lb;
        return { ...p.s, weight: a + Math.random() * (b - a) };
      }
    }
    return { ...SPECIES[1], weight: 0.5 };
  }

  #bob(time, amp) {
    this.bobber.position.y = this.waterY + Math.sin(time * 2.2) * amp;
  }

  #rodTip() {
    const tip = this.rodView.userData.tip?.clone() ?? new THREE.Vector3(0, 0, 1.2);
    return this.rodView.localToWorld(tip);
  }

  #updateLine() {
    if (!this.line.visible) return;
    const pos = this.line.geometry.attributes.position;
    const a = this.#rodTip();
    const b = this.bobber.position;
    pos.setXYZ(0, a.x, a.y, a.z);
    pos.setXYZ(1, b.x, b.y + 0.05, b.z);
    pos.needsUpdate = true;
  }

  #status(text, alert = false) {
    this.game.fishingUI.setStatus(text, alert);
  }
}
