import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';

/**
 * LakeScene
 * ---------
 * Mirror Lake: a round lake ringed by pines, a wooden dock with one warm lamp,
 * moon in the fog. Look at the water with the rod equipped and press E to fish.
 * The dirt trail south (+Z) leads back to the overworld.
 *
 * Lake centre (0, 0, -25), radius 16. Dock runs from the shore (z = -9) out to z = -21.
 */
const LAKE_C = new THREE.Vector3(0, 0, -25);
const LAKE_R = 16;
const WATER_Y = -0.12;

export class LakeScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Lake', label: 'mirror lake', outdoor: true });
  }

  build() {
    const g = this.game;
    const rand = mulberry(7);

    // ---- ground (ring around the lake) -------------------------------------
    const ringGeo = new THREE.RingGeometry(LAKE_R, 70, 40, 8);
    ringGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(ringGeo, this.mat({ map: this.tex('grass', 40) }));
    ground.position.copy(LAKE_C);
    this.root.add(ground);
    this.addColliderMesh(ground);

    // muddy shore band
    const shoreGeo = new THREE.RingGeometry(LAKE_R - 0.3, LAKE_R + 1.6, 40, 1);
    shoreGeo.rotateX(-Math.PI / 2);
    const shore = new THREE.Mesh(shoreGeo, this.mat({ map: this.tex('dirt', 30) }));
    shore.position.copy(LAKE_C).setY(0.01);
    this.root.add(shore);

    // ---- water ----------------------------------------------------------------
    // Extra rings of vertices so affine warping + vertex snapping look right.
    const water = new THREE.Mesh(subdivideCircle(LAKE_R + 0.5, 32, 6), this.mat({ map: this.tex('water', 10), scroll: [0.015, 0.008] }));
    water.position.copy(LAKE_C).setY(WATER_Y);
    this.root.add(water);
    this.water = water;
    this.addInteractable(water, {
      prompt: 'Cast line',
      range: 18,
      enabled: () => !g.fishing.active,
      available: () => g.fishing.canFish(),
      action: () => g.fishing.begin(),
    });
    // moonlight streak on the water
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 18), this.mat({ color: 0x8a96b0, unlit: true, opacity: 0.25 }));
    streak.rotation.x = -Math.PI / 2;
    streak.position.set(-3, WATER_Y + 0.02, -30);
    this.root.add(streak);

    // Keep the player out of the water (ring of invisible walls, gap at the dock).
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const x = LAKE_C.x + Math.sin(a) * (LAKE_R + 0.3);
      const z = LAKE_C.z + Math.cos(a) * (LAKE_R + 0.3);
      if (Math.abs(x) < 1.4 && z > LAKE_C.z) continue; // dock opening
      this.addColliderBox(x, 0.8, z, 2.3, 1.6, 0.3, a);
    }

    // ---- dock -----------------------------------------------------------------
    const planks = this.mat({ map: this.tex('planks', 1, 6) });
    this.box(2, 0.1, 12, planks, 0, 0.1, -15, { segments: [2, 1, 12] });
    const postMat = this.mat({ map: this.tex('bark') });
    for (let z = -9.2; z >= -21; z -= 2.9) {
      for (const x of [-0.95, 0.95]) this.box(0.15, 1.2, 0.15, postMat, x, -0.3, z, { collide: false });
    }
    // invisible rails so you don't walk off the dock
    this.addColliderBox(-1.1, 0.7, -15.3, 0.2, 1.4, 12.4);
    this.addColliderBox(1.1, 0.7, -15.3, 0.2, 1.4, 12.4);
    this.addColliderBox(0, 0.7, -21.1, 2.4, 1.4, 0.2);
    // a cooler + empties at the end of the dock (refs #2/#3 energy)
    this.place('beer_can', { x: 0.6, y: 0.15, z: -20.3 });
    this.place('beer_bottle', { x: 0.72, y: 0.15, z: -20.1, rotY: 1 });
    this.place('cigarette_pack', { x: 0.4, y: 0.15, z: -20.6, rotY: 0.3 });

    // dock lamp
    const lamp = this.place('streetlight', { x: 1.3, z: -8.6, rotY: -Math.PI / 2, scale: 0.6 });
    lamp.userData.bulb && (lamp.userData.bulb.material = lamp.userData.bulbOn);
    this.addLight({ position: [0.4, 3.2, -8.6], color: 0xffc078, range: 9, intensity: 1.2, priority: 2 });
    this.addColliderBox(1.3, 2, -8.6, 0.25, 4, 0.25);

    this.addSound('water_lapping', new THREE.Vector3(0, 0, -15), { volume: 0.6, refDistance: 3 });
    this.addSound('water_lapping', new THREE.Vector3(-12, 0, -14), { volume: 0.4, refDistance: 3 });

    // ---- trail back to town ---------------------------------------------------
    this.plane(5, 34, this.mat({ map: this.tex('dirt', 2, 14) }), 0, 0.015, 23, { segs: 10, collide: false });
    this.addTrigger([-6, -1, 30], [6, 4, 38], (game) => game.changeScene('World', 'lake_road', { truckSpawn: 'truck_lake_road' }));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), this.mat({ map: this.tex('sign_lake') }));
    sign.position.set(3.2, 1.6, 26);
    sign.rotation.y = Math.PI;
    this.root.add(sign);
    this.box(0.1, 1.6, 0.1, postMat, 3.2, 0.8, 26.05);

    // ---- trees + rocks ----------------------------------------------------------
    for (let i = 0; i < 70; i++) {
      const a = rand() * Math.PI * 2;
      const r = LAKE_R + 4 + rand() * 30;
      const x = LAKE_C.x + Math.sin(a) * r;
      const z = LAKE_C.z + Math.cos(a) * r;
      if (Math.abs(x) < 6 && z > -4) continue; // keep trail + parking clear
      const kind = rand();
      const tree = this.place(kind < 0.45 ? 'tree_pine' : kind < 0.8 ? 'tree_pine2' : 'tree_oak', { x, z, rotY: rand() * 6, scale: 0.8 + rand() * 0.6 });
      this.addColliderBox(tree.position.x, 1.5, tree.position.z, 0.5, 3, 0.5);
    }
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2;
      if (Math.abs(Math.sin(a)) < 0.15 && Math.cos(a) > 0) continue;
      const r = LAKE_R + 0.8 + rand() * 2.5;
      this.place(rand() > 0.5 ? 'rock' : 'rock2', { x: LAKE_C.x + Math.sin(a) * r, z: LAKE_C.z + Math.cos(a) * r, rotY: rand() * 6, scale: 0.5 + rand(), collide: 0.3 });
    }

    // Outer boundary (invisible) so you can't wander into the void.
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      this.addColliderBox(Math.sin(a) * 50, 2, -10 + Math.cos(a) * 50, 8.2, 4, 0.5, a);
    }

    // ---- sky: moon (no fog so it punches through) -----------------------------
    const moon = new THREE.Mesh(new THREE.CircleGeometry(4, 10), this.mat({ color: 0xe8e4d0, unlit: true, noFog: true }));
    moon.position.set(-20, 38, -95);
    moon.lookAt(0, 0, 0);
    this.root.add(moon);
    this.moon = moon;

    // ---- spawns -------------------------------------------------------------------
    this.addSpawn('trail', [0, 0, 26], 0); // facing the lake (-Z)
    this.addSpawn('default', [0, 0, 26], 0);
    this.addSpawn('truck_parking', [4.5, 0, 22], Math.PI); // heading -Z

    // ---- the occasional jumping fish -----------------------------------------------
    this.jumper = this.place('fish', { opts: { color: 0x8a9a70 } });
    this.jumper.visible = false;
    this.animate(this.jumper, 'Armature|Swim', { timeScale: 2 });

    this.#camp(rand);
    this.#undergrowth(rand);
    this.jumpT = 4;
    this.updaters.push((dt) => this.#updateJumper(dt));
  }

  #updateJumper(dt) {
    const j = this.jumper;
    this.jumpT -= dt;
    if (!j.visible && this.jumpT <= 0) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 10;
      j.position.set(LAKE_C.x + Math.sin(a) * r, WATER_Y, LAKE_C.z + Math.cos(a) * r);
      j.rotation.y = Math.random() * 6;
      j.visible = true;
      this.jumpT = 0;
      this.game.audio.oneShot('splash', { volume: 0.3, object: j });
    }
    if (j.visible) {
      this.jumpT += dt;
      const t = this.jumpT / 0.8;
      j.position.y = WATER_Y + Math.sin(Math.min(t, 1) * Math.PI) * 0.8 - 0.1;
      j.rotation.x = (t - 0.5) * 2;
      if (t >= 1) {
        j.visible = false;
        this.jumpT = 6 + Math.random() * 14;
      }
    }
  }

  /** A dead campfire someone left smouldering, a tent, logs to sit on. */
  #camp() {
    const cx = -8;
    const cz = 12;
    this.place('campfire', { x: cx, z: cz, collide: 0.2 });
    // Embers: a little unlit glow + a flickering warm light.
    const ember = new THREE.Mesh(new THREE.CircleGeometry(0.28, 6), this.mat({ color: 0xff6a20, unlit: true }));
    ember.rotation.x = -Math.PI / 2;
    ember.position.set(cx, 0.05, cz);
    this.root.add(ember);
    const fire = this.addLight({ position: [cx, 0.6, cz], color: 0xff8030, range: 7, intensity: 1.3, priority: 2 });
    this.updaters.push((_dt, t) => {
      fire.intensity = 1.1 + Math.sin(t * 7.3) * 0.12 + Math.sin(t * 17.1) * 0.08;
    });
    this.addSound('campfire', new THREE.Vector3(cx, 0.3, cz), { volume: 0.5, refDistance: 2 });
    const tent = this.place('tent', { x: cx - 3.2, z: cz + 2.2, rotY: 0.6 });
    this.addColliderFromObject(tent, 0.3);
    for (const [dx, dz, r] of [[1.6, 0.2, 1.5], [-0.3, -1.6, 0.1], [-1.5, 0.6, -1.3]]) {
      const log = this.place('log', { x: cx + dx, z: cz + dz, rotY: r, scale: 0.6 });
      this.addColliderFromObject(log, 0.2);
    }
    this.place('beer_can', { x: cx + 1.3, z: cz - 0.6, rotY: 1 });
  }

  /** Bushes, stumps and grass tufts so the ground isn't a flat sheet. */
  #undergrowth(rand) {
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2;
      const r = LAKE_R + 2 + rand() * 30;
      const x = LAKE_C.x + Math.sin(a) * r;
      const z = LAKE_C.z + Math.cos(a) * r;
      if (Math.abs(x) < 3 && z > -4) continue; // keep the trail clear
      const pick = rand();
      if (pick < 0.65) this.place('grass', { x, z, rotY: rand() * 6, scale: 0.7 + rand() * 0.8 });
      else if (pick < 0.9) this.place('bush', { x, z, rotY: rand() * 6, scale: 0.6 + rand() * 0.8 });
      else this.place('stump', { x, z, rotY: rand() * 6, collide: 0.2 });
    }
  }

  waterHeight(x, z) {
    return Math.hypot(x - LAKE_C.x, z - LAKE_C.z) < LAKE_R + 0.5 ? WATER_Y : null;
  }

  onEnter() {
    this.game.fishing.attachTo(this, WATER_Y);
    if (this.game.inventory.has('fishing_rod') && !this.game.vehicle.driving) {
      this.game.hud.toast('Look at the water and press E to fish.');
    }
  }

  onExit() {
    if (this.game.fishing.active) this.game.fishing.cancel(null);
  }
}

/** Circle with concentric rings (CircleGeometry only has one ring). */
function subdivideCircle(radius, segments, rings) {
  const geo = new THREE.RingGeometry(0.001, radius, segments, rings);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
