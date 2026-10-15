import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { flicker } from '../core/Renderer.js';

/**
 * GroceryStoreScene
 * -----------------
 * The Quik Mart at 3 a.m. (Kenney Mini Market models): three aisles of
 * stocked shelving with end caps, a wall of humming drink coolers, a chest
 * freezer, produce + bread displays, carts by the door, buzzing tubes (one
 * dying), and a clerk who idles, nods and rings you up.
 *
 * Room spans x -8..8, z -6..6; entrance on the south wall at x = -5.
 */
const W = 16;
const D = 12;
const H = 3.2;

export class GroceryStoreScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'GroceryStore', label: 'quik mart' });
    this.indoor = { fog: 0x14141a, near: 6, far: 26, ambient: 0x2c2c36, daylight: 0.2 };
  }

  build() {
    const g = this.game;
    this.room({
      w: W,
      d: D,
      h: H,
      floorMat: this.mat({ map: this.tex('store_floor', W / 2, D / 2) }),
      wallMat: this.mat({ map: this.tex('store_wall', 8, 1.6) }),
      ceilMat: this.mat({ map: this.tex('ceiling', 8, 6) }),
      doors: [{ wall: 's', at: 5, width: 1.6, height: 2.3 }],
    });

    this.#entrance();
    this.#checkout();
    this.#aisles();
    this.#coolers();
    this.#lights();
  }

  #entrance() {
    const g = this.game;
    // Front windows looking out at the dark lot.
    const glass = this.mat({ color: 0x0a0e1c, unlit: true });
    for (const [x, w] of [[-7.2, 1.2], [-2.8, 1.2], [0.6, 4.2], [5.4, 3.6]]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.6), glass);
      pane.position.set(x, 1.45, D / 2 - 0.02);
      pane.rotation.y = Math.PI;
      this.root.add(pane);
    }
    const open = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), this.mat({ map: this.tex('sign_open'), unlit: true }));
    open.position.set(0.6, 1.95, D / 2 - 0.05);
    open.rotation.y = Math.PI;
    this.root.add(open);
    this.addLight({ position: [0.6, 1.9, 5.4], color: 0xff4060, range: 2.8, intensity: 0.8 });

    const door = this.box(1.6, 2.3, 0.06, this.mat({ color: 0x2a3038 }), -5, 1.15, D / 2 + 0.02);
    this.addInteractable(door, { prompt: 'Leave store', action: () => g.changeScene('World', 'store_door') });
    this.addSpawn('door', [-5, 0, 4.9], 0);
    this.addSpawn('default', [-5, 0, 4.9], 0);

    // Carts + baskets by the door.
    for (let i = 0; i < 3; i++) this.place('shopping_cart', { x: -7.3, z: 3.0 + i * 0.35, rotY: Math.PI / 2 });
    this.addColliderBox(-7.3, 0.5, 3.35, 1.2, 1, 1.4);
    for (let i = 0; i < 3; i++) this.place('basket', { x: -6.6, y: i * 0.12, z: 5.3, rotY: i * 0.15 });

    // Produce + bread near the front.
    const fruit = this.place('display_fruit', { x: 2.2, z: 3.9, rotY: Math.PI, collide: true });
    const bread = this.place('display_bread', { x: 5.2, z: 3.9, rotY: Math.PI, collide: true });
    for (const d of [fruit, bread]) {
      this.addInteractable(d, { prompt: 'Browse fresh stuff', action: () => g.openUI(() => g.shopping.open('snacks')) });
    }
  }

  #checkout() {
    const g = this.game;
    // Counter: built here (the kit has a register but no counter).
    const body = this.mat({ color: 0x6a2a24 });
    const topMat = this.mat({ map: this.tex('counter_tile', 3, 1) });
    const counter = this.box(2.6, 0.95, 0.8, body, -4.6, 0.475, 2.9);
    this.box(2.66, 0.05, 0.86, topMat, -4.6, 0.975, 2.9, { collide: false });
    const reg = this.place('cash_register', { x: -4.0, y: 1.0, z: 2.8, rotY: Math.PI });
    // Smokes rack on the wall behind the clerk.
    this.box(1.6, 0.8, 0.25, this.mat({ map: this.tex('smokes_rack', 2, 1) }), -4.6, 1.9, 1.35, { collide: false });
    for (const o of [counter, reg]) {
      this.addInteractable(o, {
        prompt: 'Register',
        action: () => {
          this.#clerkDo('interact-right', 1.0);
          g.openUI(() => g.shopping.open('counter'));
        },
      });
    }
    // Clerk behind the counter, facing the door side (+Z).
    this.clerk = this.place('clerk', { x: -4.6, z: 2.05 });
    this.#clerkIdle();
    this.addColliderBox(-4.6, 1, 2.0, 2.8, 2, 0.7);
    const lines = [
      '"..."',
      '"We close never."',
      '"Bathroom\'s out of order. Has been since 1997."',
      '"You fish? Lake\'s good after midnight. Bring bait."',
      '"I\'ll buy fish. Don\'t ask why."',
      '"Pump 3 is haunted. Use pump 2."',
    ];
    let li = 0;
    this.addInteractable(this.clerk, {
      prompt: 'Talk to clerk',
      range: 3,
      action: () => {
        this.#clerkDo(li % 2 ? 'emote-no' : 'emote-yes', 1.3);
        g.hud.toast(`Clerk: ${lines[li++ % lines.length]}`, 3500);
      },
    });
  }

  #clerkIdle() {
    this.clerk.userData.mixer?.stopAllAction();
    this.animate(this.clerk, 'idle');
  }

  /** Play a one-shot clerk animation, then settle back into idle. */
  #clerkDo(clip, seconds) {
    if (!this.clerk.userData.animations?.length) return;
    this.clerk.userData.mixer?.stopAllAction();
    this.animate(this.clerk, clip, { loop: false });
    clearTimeout(this._clerkT);
    this._clerkT = setTimeout(() => this.#clerkIdle(), seconds * 1000);
  }

  #aisles() {
    const g = this.game;
    const aisles = [
      { x: -1.5, catalog: 'snacks', label: 'Browse snacks', units: ['shelf_bags', 'shelf_boxes', 'shelf_bags'] },
      { x: 1.6, catalog: 'snacks', label: 'Browse food', units: ['shelf_boxes', 'shelf_bags', 'shelf_boxes'] },
      { x: 4.7, catalog: 'outdoor', label: 'Browse outdoor & auto', units: ['shelf_boxes', 'shelf_boxes', 'shelf_bags'] },
    ];
    for (const a of aisles) {
      let z = -3.65;
      for (const key of a.units) {
        const unit = this.place(key, { x: a.x, z: 0, rotY: Math.PI / 2 });
        unit.scale.z = 0.62; // the Mini kit's gondolas are very deep
        const b = this.bounds(unit);
        unit.position.z += z - b.min.z;
        z += b.max.z - b.min.z;
        this.addColliderFromObject(unit);
        this.addInteractable(unit, { prompt: a.label, action: () => g.openUI(() => g.shopping.open(a.catalog)) });
      }
      // End cap facing the entrance.
      const cap = this.place('shelf_end', { x: a.x, z: 0 });
      cap.scale.x = 0.72;
      const cb = this.bounds(cap);
      cap.position.z += z - cb.min.z;
      this.addColliderFromObject(cap);
      this.addInteractable(cap, { prompt: a.label, action: () => g.openUI(() => g.shopping.open(a.catalog)) });
    }
  }

  #coolers() {
    const g = this.game;
    // Wall of standing coolers on the back wall.
    let x = -W / 2 + 0.1;
    for (let i = 0; i < 3; i++) {
      const c = this.place('freezers_standing', { x, z: 0 });
      this.snapToWall(c, ['n', -D / 2]);
      const b = this.bounds(c);
      c.position.x += x - b.min.x;
      x += b.max.x - b.min.x;
      this.addColliderFromObject(c);
      this.addInteractable(c, { prompt: 'Open cooler', action: () => g.openUI(() => g.shopping.open('drinks')) });
    }
    this.addLight({ position: [-4.2, 1.6, -4.4], color: 0xb8e0ff, range: 6, intensity: 0.9 });
    this.addSound('fluorescent_hum', new THREE.Vector3(-4.2, 1.2, -5.2), { volume: 0.3, refDistance: 1.5 });

    const ret = this.place('bottle_return', { x: x + 0.9, z: 0 });
    this.snapToWall(ret, ['n', -D / 2]);
    this.addColliderFromObject(ret);

    // Chest freezer on the east wall: ice cream + frozen pizza.
    const chest = this.place('freezer_chest', { x: 7, z: -2.2, rotY: -Math.PI / 2 });
    this.snapToWall(chest, ['e', W / 2]);
    this.addColliderFromObject(chest);
    this.addInteractable(chest, { prompt: 'Open freezer', action: () => g.openUI(() => g.shopping.open('frozen')) });
    this.addSound('fluorescent_hum', new THREE.Vector3(7, 0.8, -2.2), { volume: 0.15, refDistance: 1 });
  }

  #lights() {
    const tubeOn = this.mat({ color: 0xf0f8ff, unlit: true });
    const tubeDim = this.mat({ color: 0x505860, unlit: true });
    const spots = [
      [-4.8, -3.2],
      [0, -1.2],
      [3.2, -1.2],
      [-4.8, 3.2],
      [1.6, 3.4],
    ];
    spots.forEach(([x, z], i) => {
      const tube = this.box(0.3, 0.05, 2.4, tubeOn, x, H - 0.03, z, { collide: false });
      const dying = i === 2; // the one over aisle 3
      const light = this.addLight({ position: [x, H - 0.4, z], color: 0xe0f0ff, range: 8, intensity: 0.9, flicker: dying });
      if (dying) this.updaters.push((_dt, t) => (tube.material = flicker(t, light.flickerSeed) < 0.5 ? tubeDim : tubeOn));
      if (i % 2 === 0) this.addSound('fluorescent_hum', new THREE.Vector3(x, H - 0.2, z), { volume: 0.35, refDistance: 1.5 });
    });
  }
}
