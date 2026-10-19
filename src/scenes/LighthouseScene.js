import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { addTV, addMusicDevice, addSeat } from './Devices.js';

/**
 * LighthouseScene
 * ---------------
 * Ray's room at the bottom of the lighthouse: round stone walls, a spiral
 * stair up to the gallery hatch, the good chair facing an old CRT, a radio on
 * the bookcase (plays the shared music player), a stove with a kettle, and
 * an ashtray that's seen things. The windows light up every time the beam
 * sweeps past overhead, and the foghorn rattles the place.
 *
 * Room: circle radius 5.5 around the origin; door on the west wall (-X).
 */
const R = 5.5;
const H = 3.4;

export class LighthouseScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Lighthouse', label: 'lighthouse' });
    this.indoor = { fog: 0x100e12, near: 5, far: 22, ambient: 0x3a3236, daylight: 0.25 };
  }

  build() {
    const g = this.game;
    this.#shell();

    // ---- door (west) -----------------------------------------------------------
    const door = this.box(0.12, 2.2, 1.2, this.mat({ color: 0x3a2c22 }), -R + 0.1, 1.1, 0);
    this.addInteractable(door, { prompt: 'Go outside', action: () => g.changeScene('World', 'lighthouse_door') });
    this.addSpawn('door', [-R + 1.2, 0, 0], -Math.PI / 2);
    this.addSpawn('default', [-R + 1.2, 0, 0], -Math.PI / 2);
    this.place('coat_rack', { x: -R + 0.8, z: 1.4, collide: 0.2 });

    // ---- spiral stair up to the hatch (decor, blocked at the top) ---------------
    const stone = this.mat({ map: this.tex('rock', 1, 4), color: 0xb8b0a8 });
    this.box(0.35, H, 0.35, stone, 2.6, H / 2, 2.6);
    const wood = this.mat({ map: this.tex('planks', 1, 1) });
    for (let i = 0; i < 14; i++) {
      const a = i * 0.45;
      const step = this.box(1.1, 0.06, 0.32, wood, 2.6 + Math.cos(a) * 0.65, 0.22 + i * 0.22, 2.6 + Math.sin(a) * 0.65, { collide: false, rotY: -a });
      void step;
    }
    this.addColliderBox(2.6, 1.5, 2.6, 1.6, 3, 1.6); // the stair itself is decor; the hatch takes you up
    this.box(1.2, 0.05, 1.2, this.mat({ color: 0x1a1612 }), 2.6, H - 0.03, 2.6, { collide: false }); // hatch
    this.interactVolume(2.6, 1.4, 2.6, 1.8, 2.8, 1.8, {
      prompt: 'Climb to the gallery',
      action: () => {
        g.audio.oneShot('door', { volume: 0.5, rate: 0.8 });
        g.changeScene('World', 'lighthouse_gallery');
      },
    });
    this.addSpawn('hatch', [1.4, 0, 1.4], Math.PI * 1.25);

    // ---- the good chair + TV ------------------------------------------------------
    this.tint(this.place('rug_round', { x: 0.4, y: 0.005, z: -0.4 }), { carpet: 0x5a2a24, carpetWhite: 0x8a7a60 });
    const chair = this.place('lounge_chair', { x: -0.9, z: 0.9, rotY: Math.PI * 0.82, collide: 0.15 });
    this.tint(chair, { carpet: 0x5a3a34 });
    const table = this.place('side_table', { x: 1.6, z: -2.4, rotY: -0.5, collide: true });
    const tv = this.place('crt_tv', { x: 1.6, y: this.bounds(table).max.y, z: -2.4, rotY: -0.5 + Math.PI * 0.0 });
    tv.rotation.y = Math.atan2(-0.9 - 1.6, 0.9 + 2.4); // face the chair
    this.tvScreen = addTV(this, tv, { channels: ['news', 'aquarium', 'vacation', 'static', 'lost', 'infomercial'] });
    const tvAt = new THREE.Vector3(1.6, 0.8, -2.4);
    const eye = new THREE.Vector3(-0.85, 1.05, 0.85);
    const look = tvAt.clone().sub(eye);
    addSeat(this, chair, {
      eye: eye.toArray(),
      yaw: Math.atan2(-look.x, -look.z),
      pitch: -0.12,
      yawLimit: 1.5,
      standAt: [-1.6, 0, 1.6],
    });

    // ---- coffee table: ashtray, beers, a pack, Ray's note -------------------------
    const ct = this.place('coffee_table', { x: 0.4, z: -0.3, rotY: 0.6, collide: true });
    const top = this.bounds(ct).max.y;
    this.place('ashtray', { x: 0.25, y: top, z: -0.4 });
    this.place('beer_can', { x: 0.65, y: top, z: -0.15, rotY: 1 });
    this.place('beer_can', { x: 0.5, y: top, z: 0.05, rotY: 2 });
    const pack = this.place('cigarette_pack', { x: 0.75, y: top, z: -0.45, rotY: 0.4 });
    this.addInteractable(pack, {
      prompt: 'Take the pack (Ray won\'t mind)',
      enabled: () => pack.visible,
      action: () => {
        pack.visible = false;
        g.inventory.add('cigarettes');
        if (!g.inventory.has('lighter')) g.inventory.add('lighter');
        g.hud.toast('A pack and Ray\'s Zippo.');
      },
    });
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.26), this.mat({ color: 0xe8e0c8 }));
    note.rotation.x = -Math.PI / 2;
    note.rotation.z = 0.3;
    note.position.set(0.15, top + 0.005, -0.05);
    this.root.add(note);
    const lines = [
      '"Went up to check the lens. Kettle\'s on. Sit, watch the tube, play the radio."',
      '"If the beam stops turning, don\'t come up. Just wait. — R"',
    ];
    let li = 0;
    this.addInteractable(note, { prompt: 'Read note', range: 2.2, action: () => g.hud.toast(lines[li++ % lines.length], 5000) });

    // ---- radio on the bookcase -------------------------------------------------------
    const shelf = this.place('bookcase_closed', { x: -2.6, z: -3.9, rotY: 0.6 });
    this.addColliderFromObject(shelf, 0.2);
    const radio = this.place('radio', { x: -2.6, y: this.bounds(shelf).max.y, z: -3.9, rotY: 0.6 });
    addMusicDevice(this, radio, 'radio');
    this.addLight({ position: [-2.2, 1.9, -3.3], color: 0xffa040, range: 2, intensity: 0.6 });

    // ---- stove + kettle, lamp ----------------------------------------------------------
    const stove = this.place('stove', { x: 3.4, z: -2.6, rotY: -2.2 });
    this.addColliderFromObject(stove, 0.15);
    this.addLight({ position: [3.0, 1.1, -2.2], color: 0xff7030, range: 3, intensity: 0.7, flicker: true });
    const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.18, 8), this.mat({ color: 0x8a8a90 }));
    kettle.position.set(3.4, this.bounds(stove).max.y + 0.09, -2.6);
    this.root.add(kettle);
    this.addInteractable(kettle, { prompt: 'Kettle', action: () => g.hud.toast('Still warm. Smells like instant coffee and diesel.') });

    const lamp = this.place('lamp_table', { x: -2.1, y: 0, z: 2.4 });
    this.addLight({ position: [-2.1, 1.0, 2.4], color: 0xffb070, range: 7.5, intensity: 1.4 });
    this.addLight({ position: [0, H - 0.4, -0.5], color: 0xffc890, range: 7, intensity: 0.7 }); // bare bulb
    void lamp;

    // ---- Ray himself: in his armchair by the stove, waiting to tell you something ----------
    const rx = 2.1;
    const rz = -0.4;
    const rayChair = this.place('chair', { x: rx, z: rz, rotY: -Math.PI / 2 - 0.25, collide: 0.1 });
    void rayChair;
    const ray = this.place('ray', { x: rx, y: 0, z: rz });
    ray.rotation.y = Math.atan2(-0.9 - rx, 0.9 - rz); // toward the good chair
    const clips = (ray.userData.animations ?? []).map((c) => c.name);
    const sit = clips.find((n) => /sit/i.test(n));
    if (sit) {
      this.animate(ray, sit);
    } else {
      this.animate(ray, clips.find((n) => /idle/i.test(n)) ?? clips[0]);
      ray.position.x += 0.35; // standing by the chair instead
    }
    this.addInteractable(ray, {
      prompt: 'Sit with Ray (he has a story)',
      range: 3,
      action: () => g.rayUI.open(),
    });
    this.addLight({ position: [rx, 1.6, rz], color: 0xffb070, range: 4, intensity: 0.6 });

    // ---- sound -----------------------------------------------------------------------------
    this.addSound('fluorescent_hum', new THREE.Vector3(2.6, H - 0.2, 2.6), { volume: 0.12, refDistance: 1.5 }); // lens motor
    let horn = 3;
    this.updaters.push((dt) => {
      horn -= dt;
      if (horn > 0) return;
      horn = 28 + Math.random() * 20;
      g.audio.oneShot('foghorn', { volume: 0.9 });
      g.camera.userData.shake = 0.03;
    });
  }

  #shell() {
    // Floor + ceiling discs, a cylinder wall facing inward.
    const floorGeo = new THREE.RingGeometry(0.001, R, 16, 4);
    floorGeo.rotateX(-Math.PI / 2);
    this.root.add(new THREE.Mesh(floorGeo, this.mat({ map: this.tex('planks', 6, 6) })));
    this.addColliderBox(0, -0.25, 0, R * 2, 0.5, R * 2);
    const ceilGeo = new THREE.RingGeometry(0.001, R, 16, 3);
    ceilGeo.rotateX(Math.PI / 2);
    const ceil = new THREE.Mesh(ceilGeo, this.mat({ map: this.tex('ceiling', 4, 4) }));
    ceil.position.y = H;
    this.root.add(ceil);
    const wallGeo = new THREE.CylinderGeometry(R, R, H, 24, 3, true);
    const wall = new THREE.Mesh(wallGeo, this.mat({ map: this.tex('wall', 8, 1.5), color: 0xd8d0c4, doubleSide: true }));
    wall.position.y = H / 2;
    this.root.add(wall);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.addColliderBox(Math.cos(a) * (R + 0.1), H / 2, Math.sin(a) * (R + 0.1), 0.3, H, 1.6, -a + Math.PI / 2);
    }

    // Deep-set windows; they flash when the beam passes overhead.
    this.windows = [];
    for (const a of [0.6, 1.9, 3.9, 5.1]) {
      const m = this.mat({ color: 0x141c2c, unlit: true });
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), m);
      win.position.set(Math.cos(a) * (R - 0.02), 1.8, Math.sin(a) * (R - 0.02));
      win.lookAt(0, 1.8, 0);
      this.root.add(win);
      const light = this.addLight({ position: [Math.cos(a) * (R - 0.6), 1.8, Math.sin(a) * (R - 0.6)], color: 0xfff0c8, range: 4, intensity: 0, priority: 2 });
      this.windows.push({ a, m, light });
    }
    const dark = new THREE.Color(0x141c2c);
    const lit = new THREE.Color(0xf0e8c8);
    this.updaters.push((_dt, t) => {
      // Same rotation as the beam outside (World: rotation.y = t * 0.6).
      const beam = t * 0.6;
      for (const w of this.windows) {
        // The beam points along -X rotated by `beam`; compare with the window's direction.
        const dir = Math.atan2(-Math.sin(beam) * -1, -Math.cos(beam));
        const d = Math.abs(THREE.MathUtils.euclideanModulo(w.a - dir + Math.PI, Math.PI * 2) - Math.PI);
        const d2 = Math.abs(THREE.MathUtils.euclideanModulo(w.a - dir, Math.PI * 2) - Math.PI);
        const k = Math.max(0, 1 - Math.min(d, d2) / 0.35);
        w.m.uniforms.uColor.value.copy(dark).lerp(lit, k);
        w.light.intensity = k * 1.2;
      }
    });
  }
}
