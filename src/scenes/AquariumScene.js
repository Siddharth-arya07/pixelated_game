import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { signTexture } from '../core/Procedural.js';

/**
 * AquariumScene — the Aquarium of the Bay, Pier 39
 * ------------------------------------------------
 * The walk-through tunnel: a glass tube on the bay floor, blue light,
 * fish and rays and a turtle drifting over your head. Then the jellyfish
 * room (glowing tanks in the dark), and the touch pool with the bat rays.
 */
export class AquariumScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Aquarium', label: 'aquarium of the bay' });
    this.indoor = { fog: 0x0a2a48, near: 4, far: 30, ambient: 0x2a5a8a, daylight: 0 };
    this.eyeHeight = 1.12;
    this.memory = true;
  }

  build() {
    const g = this.game;
    // lobby (z 0..8), tunnel (z -2..-42), jelly room (beyond)
    this.room({
      w: 10,
      d: 8,
      h: 3.2,
      x: 0,
      z: 4,
      floorMat: this.mat({ map: this.tex('checker_tiles', 6, 5), color: 0x8aa0b8 }),
      wallMat: this.mat({ color: 0x1a3a5a }),
      ceilMat: this.mat({ color: 0x0a1a2a }),
      doors: [{ wall: 's', at: 0, width: 2 }, { wall: 'n', at: 0, width: 2.6, height: 2.6 }],
    });
    const out = this.box(2, 2.4, 0.1, this.mat({ color: 0x0a2a4a }), 0, 1.2, 8.04, { collide: false });
    this.addInteractable(out, { prompt: 'Back out to the pier', action: () => g.changeScene('Pier39', 'aquarium') });
    this.addSpawn('door', [0, 0, 6.8], 0);
    this.addSpawn('default', [0, 0, 6.8], 0);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), this.mat({ map: signTexture(['UNDER THE BAY →'], { bg: '#0a2a4a', fg: '#8ae0ff', w: 128, h: 20 }), unlit: true }));
    sign.position.set(0, 2.85, 0.05);
    this.root.add(sign);
    this.#tunnel();
    this.#jellies();
    this.#touchPool();
    this.addSound('water_lapping', new THREE.Vector3(0, 1, -20), { volume: 0.15 });
  }

  #tunnel() {
    const L = 42;
    const R = 2.4;
    const z0 = 0;
    // walkway
    this.plane(3.2, L, this.mat({ map: this.tex('checker_tiles', 2, 20), color: 0x6a8aa8 }), 0, 0, z0 - L / 2);
    // glass tube (inside faces), the water and sand outside it
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 20, 1, true, -Math.PI / 2, Math.PI), this.mat({ color: 0x8ad0ff, opacity: 0.12, doubleSide: true, unlit: true }));
    tube.rotation.x = Math.PI / 2;
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0, 0, z0 - L / 2);
    this.root.add(tube);
    const water = new THREE.Mesh(new THREE.BoxGeometry(30, 14, L + 10), this.mat({ color: 0x1a5a8a, opacity: 0.0 }));
    void water;
    const sand = this.plane(30, L + 10, this.mat({ map: this.tex('dirt', 6, 10), color: 0xc8b890 }), 0, -0.6, z0 - L / 2, { collide: false });
    void sand;
    // the "water": a big blue dome you see through the glass, rippling light
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, L + 10, 24, 1, true, -Math.PI / 2, Math.PI), this.mat({ map: causticTex(), color: 0x2a7ab8, unlit: true, doubleSide: true, scroll: [0.02, 0.01] }));
    dome.rotation.x = Math.PI / 2;
    dome.rotation.z = Math.PI / 2;
    dome.position.set(0, -0.6, z0 - L / 2);
    this.root.add(dome);
    // walls of the tunnel (invisible, keep you on the walkway)
    for (const sx of [-1, 1]) this.addColliderBox(sx * 1.8, 1.5, z0 - L / 2, 0.2, 3, L);
    // rocks, kelp, coral on the floor outside
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (3 + ((i * 37) % 70) / 10);
      const z = z0 - 2 - ((i * 53) % (L - 4));
      const k = ['sea_kelp', 'sea_coral', 'sea_kelp', 'sea_coral2', 'sea_starfish'][i % 5];
      this.place(k, { x, y: -0.6, z, rotY: i, scale: 0.8 + (i % 3) * 0.3 });
    }
    // the swimmers: they circle the tunnel, some right over your head
    this.swimmers = [];
    const kinds = ['sea_tang', 'sea_butterflyfish', 'sea_zebrafish', 'sea_clownfish', 'sea_manta', 'sea_turtle', 'sea_mandarin', 'sea_octopus'];
    for (let i = 0; i < 46; i++) {
      const k = kinds[i % kinds.length];
      const big = k === 'sea_manta' || k === 'sea_turtle';
      const f = this.place(k, { x: 0, y: 2, z: -10, scale: k === 'sea_manta' ? 0.45 : big ? 1 : 1.6 });
      this.swimmers.push({ f, a: (i / 46) * Math.PI * 2 + i, r: 3.2 + (i % 5) * 1.6, z: z0 - 4 - ((i * 7) % (L - 8)), s: (0.12 + (i % 4) * 0.05) * (i % 2 ? 1 : -1), y: big ? 4.2 : 0.4 + (i % 6) * 0.7 });
    }
    // blue light along the tunnel
    for (let z = -4; z > -L; z -= 9) this.addLight({ position: [0, 2.4, z], color: 0x5ab8ff, range: 10, intensity: 1.1 });
    const sign = this.box(0.05, 0.6, 1.4, this.mat({ map: signTexture(['LOOK UP!'], { bg: '#0a2a4a', fg: '#ffe070', w: 64, h: 24 }), unlit: true }), -1.6, 1.4, -6, { collide: false });
    void sign;
  }

  #jellies() {
    const g = this.game;
    const z = -44;
    this.room({ w: 10, d: 8, h: 3.2, x: 0, z: z - 2, floorMat: this.mat({ color: 0x0a1018 }), wallMat: this.mat({ color: 0x05080e }), ceilMat: this.mat({ color: 0x05080e }), doors: [{ wall: 's', at: 0, width: 3.2 }] });
    this.jellies = [];
    const tankMat = this.mat({ color: 0x3a8ad8, opacity: 0.35, unlit: true });
    for (const [x, zz, c] of [[-3.8, z - 1, 0xff8ad8], [3.8, z - 1, 0x8ad8ff], [-3.8, z - 4, 0xffd88a], [3.8, z - 4, 0xb88aff], [0, z - 5.6, 0x8affc8]]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 16), tankMat);
      tank.position.set(x, 1.5, zz);
      this.root.add(tank);
      this.addColliderBox(x, 1.5, zz, 1.8, 3, 1.8);
      this.addLight({ position: [x, 1.6, zz], color: c, range: 3.4, intensity: 1.2 });
      for (let i = 0; i < 4; i++) {
        const j = this.place('sea_jelly', { x, y: 1, z: zz, scale: 0.45 });
        j.traverse((o) => o.isMesh && ((o.material = this.r.cloneMaterial(o.material)), (o.material.uniforms.uColor.value = new THREE.Color(c)), (o.material.uniforms.uUnlit.value = true)));
        this.jellies.push({ j, x, z: zz, ph: i * 1.6 + x, r: 0.4 });
      }
    }
    const note = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), this.mat({ map: signTexture(['MOON JELLIES'], { bg: '#05080e', fg: '#c8e8ff', w: 96, h: 20 }), unlit: true }));
    note.position.set(0, 2.6, z - 5.9);
    this.root.add(note);
    this.addInteractable(note, {
      prompt: 'Read the sign',
      action: () => g.openUI(() => g.note.show("Moon jellies don't have brains, or hearts, or bones.\n\nThey just drift, and glow, and keep going.\n\nTurns out that's enough.")),
    });
  }

  #touchPool() {
    const g = this.game;
    // in the lobby: a low round pool with bat rays circling
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.75, 20), this.mat({ color: 0x3a4a5a }));
    pool.position.set(-3.2, 0.37, 4.6);
    this.root.add(pool);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.0, 20), this.mat({ map: this.tex('water', 2, 2), color: 0x4aa8d8, scroll: [0.02, 0.01], opacity: 0.8 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(-3.2, 0.7, 4.6);
    this.root.add(water);
    this.addColliderBox(-3.2, 0.4, 4.6, 4.4, 0.8, 4.4);
    this.rays = [];
    for (let i = 0; i < 4; i++) {
      const r = this.place('sea_manta', { x: -3.2, y: 0.55, z: 4.6, scale: 0.13 });
      this.rays.push({ r, a: (i / 4) * Math.PI * 2, rad: 1.1 + (i % 2) * 0.4 });
    }
    this.addInteractable(water, {
      prompt: 'Touch a bat ray (two fingers, gently)',
      range: 2.4,
      action: () => {
        g.audio.oneShot('splash', { volume: 0.2 });
        const lines = ['It feels like a wet mushroom. A happy wet mushroom.', 'The ray glides right under your fingers, like it wanted that.', 'Soft and smooth. It comes back around for another pass.'];
        g.hud.toast(lines[(Math.random() * lines.length) | 0], 3000);
      },
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), this.mat({ map: signTexture(['TOUCH POOL'], { bg: '#0a3a5a', fg: '#ffffff', w: 80, h: 20 }), doubleSide: true }));
    sign.position.set(-3.2, 1.6, 2.2);
    this.root.add(sign);
    this.addLight({ position: [-3.2, 2.5, 4.6], color: 0xa8e0ff, range: 5, intensity: 1 });
  }

  update(dt, time) {
    super.update(dt, time);
    for (const s of this.swimmers ?? []) {
      s.a += dt * s.s;
      const x = Math.cos(s.a) * s.r;
      const y = s.y + Math.sin(s.a) * Math.min(1.6, s.r * 0.3) + 0.5;
      s.f.position.set(x, Math.max(-0.2, y), s.z + Math.sin(s.a * 0.5) * 1.5);
      s.f.rotation.y = Math.atan2(-Math.sin(s.a) * Math.sign(s.s), 0) + (s.s > 0 ? Math.PI : 0);
      s.f.rotation.z = Math.sin(time * 2 + s.r) * 0.1;
    }
    for (const j of this.jellies ?? []) {
      j.j.position.set(j.x + Math.cos(time * 0.3 + j.ph) * j.r, 0.9 + ((time * 0.12 + j.ph) % 1.6), j.z + Math.sin(time * 0.3 + j.ph) * j.r);
      const pulse = 1 + Math.sin(time * 2.4 + j.ph) * 0.12;
      j.j.scale.set(0.45 * pulse, 0.45 / pulse, 0.45 * pulse);
    }
    for (const r of this.rays ?? []) {
      r.a += dt * 0.5;
      r.r.position.set(-3.2 + Math.cos(r.a) * r.rad, 0.55 + Math.sin(time * 2 + r.a) * 0.03, 4.6 + Math.sin(r.a) * r.rad);
      r.r.rotation.y = -r.a;
    }
  }
}

function causticTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1a5a8a';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(160,220,255,0.35)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    const x = Math.random() * 64;
    const y = Math.random() * 64;
    g.moveTo(x, y);
    g.bezierCurveTo(x + 10, y - 8, x + 14, y + 10, x + 24, y + 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}
