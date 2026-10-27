import * as THREE from 'three';
import { GeoScene, rnd } from './GeoScene.js';
import { buildGoldenGate } from '../world/Bridge.js';
import { signTexture } from '../core/Procedural.js';
import url from '../assets/geo/pier39.json?url';

/**
 * Pier 39, San Francisco
 * ----------------------
 * The real pier (OpenStreetMap) on its wooden deck over the bay, with the
 * two-storey weathered-wood shops, the double-decker San Francisco Carousel
 * (ride it), the sea lions barking on the K-Dock floats, the Aquarium of
 * the Bay, seagulls, and across the water Alcatraz and the Golden Gate.
 */
export class Pier39Scene extends GeoScene {
  constructor(game) {
    super(game, {
      name: 'Pier39',
      label: 'pier 39',
      url,
      sea: { level: 0, color: 0x3a6a80 },
      decks: { height: 2.9 },
      minHeight: -4,
      base: '#8a8680',
      colors: { residential: '#8a8680', grass: '#5a8a40' },
      fogExtra: 70,
      palette: [0xe8d8c0, 0xd8c8b0, 0xf0e8d8, 0xc8b8a0, 0xe0d0b8],
      treeSpacing: 22,
    });
  }

  /** Labels for the map (M). */
  mapLabels() {
    const L = [];
    const sp = (k, name, color) => this.spawns[k] && L.push({ name, x: this.spawns[k].position.x, z: this.spawns[k].position.z, color });
    const poi = (q, name, color) => {
      const p = this.map.poi(q);
      if (p) L.push({ name: name ?? p.n, x: p.x, z: p.z, color });
    };
    sp('bus_stop', 'Bus stop', '#1a5a2a');
    poi('Pier 39', 'Pier 39');
    poi('San Francisco Carousel', 'Carousel');
    poi('Pier 39 Sea Lions', 'Sea lions');
    sp('aquarium', 'Aquarium of the Bay', '#1a4a7a');
    return L;
  }

  roadMats() {
    // walkways out on the pier are boards, not concrete
    const wood = this.mat({ map: this.tex('planks', 1, 1), color: 0xa88a60 });
    return { concrete: wood, path: wood };
  }

  style(b) {
    if (/carousel/i.test(b.n ?? '') || this.#nearCarousel(b)) return { skip: true }; // the real one is open-air
    // the pier's own buildings: weathered wood, two storeys, shingle roofs
    if (this.map.decks && this.map.surfaceAt(b.cx, b.cz) > 1.5 && b.area < 2500) {
      const r = rnd(b);
      return { mat: 'wood', h: 7, wall: new THREE.Color(r < 0.5 ? 0xb89a78 : 0xa88a68), roofColor: new THREE.Color(0x6a6058), roof: 'hip', pitch: 0.3, bay: 2.4 };
    }
    return super.style(b);
  }

  #nearCarousel(b) {
    const p = this.map.poi('San Francisco Carousel');
    return p && Math.hypot(b.cx - p.x, b.cz - p.z) < 9;
  }

  landmarks() {
    this.farView = 8000; // see the landmarks on the horizon
    const m = this.map;
    const g = this.game;
    // bus stop on the Embarcadero, by the pier entrance
    const aq = m.poi('Aquarium of the Bay');
    const emb = m.roads.filter((r) => r.n === 'The Embarcadero' || r.n === 'Beach Street');
    let best = null;
    for (const r of emb) {
      r.pts.forEach(([x, z], i) => {
        const d = aq ? Math.hypot(x - aq.x, z - aq.z) : 0;
        if (!best || d < best.d) best = { d, x, z, r, i };
      });
    }
    if (best) {
      const a = best.r.pts[Math.max(0, best.i - 1)];
      const b = best.r.pts[Math.min(best.r.pts.length - 1, best.i + 1)];
      const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const nx = Math.cos(yaw);
      const nz = -Math.sin(yaw);
      const side = aq && Math.hypot(best.x + nx * 9 - aq.x, best.z + nz * 9 - aq.z) < Math.hypot(best.x - nx * 9 - aq.x, best.z - nz * 9 - aq.z) ? 1 : -1;
      this.busStop(best.x + nx * side * (best.r.w / 2 + 3), best.z + nz * side * (best.r.w / 2 + 3), yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2));
    }
    this.#entranceSign();
    this.#carousel();
    this.#seaLions();
    this.#aquarium();
    this.#bayViews();
    this.#gulls();
    this.addSound('water_lapping', new THREE.Vector3(0, 1, 0), { volume: 0.3 });
    void g;
  }

  #entranceSign() {
    const p = this.map.poi('Pier 39');
    if (!p) return;
    const y = this.groundHeight(p.x, p.z);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.4), this.mat({ map: signTexture(['PIER 39'], { bg: '#1a3a6a', fg: '#ffd860', w: 128, h: 30 }), doubleSide: true }));
    s.position.set(p.x, y + 5.5, p.z);
    this.root.add(s);
    for (const sx of [-3.2, 3.2]) this.box(0.4, 6, 0.4, this.mat({ map: this.tex('planks', 1, 2), color: 0x8a6a48 }), p.x + sx, y + 3, p.z, { collide: true });
  }

  /** The double-decker San Francisco Carousel. Ride it. */
  #carousel() {
    const p = this.map.poi('San Francisco Carousel') ?? this.map.poi('Carousel');
    if (!p) return;
    const y = this.groundHeight(p.x, p.z);
    const c = new THREE.Group();
    c.position.set(p.x, y, p.z);
    this.root.add(c);
    const R = 6;
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.3, 24), this.mat({ map: this.tex('planks', 4, 1), color: 0xc8a070 }));
    floor.position.y = 0.15;
    const spin = new THREE.Group();
    c.add(spin);
    spin.add(floor);
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 6.4, 12), this.mat({ map: mirrorTex(), unlit: true }));
    mid.position.y = 3.2;
    spin.add(mid);
    const deck2 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.3, 24), this.mat({ color: 0xe8d0a0 }));
    deck2.position.y = 3.2;
    spin.add(deck2);
    // striped canopy
    const can = new THREE.Mesh(new THREE.ConeGeometry(R + 0.6, 2.2, 24, 1, true), this.mat({ map: stripeTex(), doubleSide: true }));
    can.position.y = 7.4;
    spin.add(can);
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 6), this.mat({ color: 0xffd040 }));
    flag.position.y = 8.9;
    spin.add(flag);
    // bulbs around the rims
    const bulb = this.mat({ color: 0xfff0b0, unlit: true });
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      for (const yy of [3.05, 6.3]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 4, 3), bulb);
        b.position.set(Math.cos(a) * (R + 0.05), yy, Math.sin(a) * (R + 0.05));
        spin.add(b);
      }
    }
    // the animals: painted horses (and a sea lion or two), on poles, bobbing
    this.horses = [];
    const cols = [0xf8f4ec, 0xd8a868, 0x8a5a3a, 0xe8c8e0, 0xa8c8e8, 0x3a3a3a];
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + ring * 0.26;
        const r = ring ? 4.6 : 3.1;
        const h = new THREE.Group();
        h.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        h.rotation.y = -a;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), this.mat({ color: 0xe8c040 }));
        pole.position.y = 1.6;
        const body = new THREE.Group();
        const col = this.mat({ color: cols[(i + ring) % cols.length] });
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.95), col);
        const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.25), col);
        neck.position.set(0, 0.32, 0.45);
        neck.rotation.x = -0.4;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.4), col);
        head.position.set(0, 0.6, 0.62);
        const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.35), this.mat({ color: 0xc83a3a }));
        saddle.position.y = 0.22;
        body.add(torso, neck, head, saddle);
        for (const [lx, lz] of [[-0.1, 0.35], [0.1, 0.35], [-0.1, -0.35], [0.1, -0.35]]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.07), col);
          leg.position.set(lx, -0.36, lz);
          leg.rotation.x = lz > 0 ? -0.5 : 0.4;
          body.add(leg);
        }
        body.rotation.y = Math.PI / 2;
        h.add(pole, body);
        spin.add(h);
        this.horses.push({ body, ph: i * 0.7 + ring, h });
      }
    }
    this.carousel = { c, spin, t: 0 };
    this.addLight({ position: [p.x, y + 4, p.z], color: 0xffe0a0, range: 14, intensity: 1.3 });
    this.addColliderBox(p.x, y + 0.15, p.z, R * 1.4, 0.3, R * 1.4);
    // ride: hop on a horse, the seat follows it around
    this.interactVolume(p.x, y + 1.2, p.z, R * 2, 2.4, R * 2, {
      prompt: () => (this.riding ? 'Hop off the carousel' : 'Ride the carousel'),
      range: 4,
      action: () => this.#ride(),
    });
  }

  #ride() {
    const g = this.game;
    if (this.riding) {
      g.player.stand();
      return;
    }
    const horse = this.horses[(Math.random() * this.horses.length) | 0];
    this.riding = horse;
    const eye = new THREE.Vector3();
    const seat = {
      eye,
      yaw: 0,
      pitch: 0,
      yawLimit: Math.PI,
      standAt: this.carousel.c.position.clone().add(new THREE.Vector3(7.5, 0, 0)),
      onStand: () => (this.riding = null),
    };
    g.player.sit(seat);
    this.rideSeat = seat;
    g.hud.toast('Round and round. The music is tinny and perfect.', 3000);
  }

  #seaLions() {
    const p = this.map.poi('Pier 39 Sea Lions') ?? this.map.poi('Sea Lion');
    if (!p) return;
    this.lions = [];
    const wood = this.mat({ map: this.tex('planks', 2, 1), color: 0x7a6a58 });
    let k = 0;
    for (let i = 0; i < 9; i++) {
      const fx = p.x - 30 + (i % 3) * 9 + (i % 2) * 2;
      const fz = p.z - 14 + Math.floor(i / 3) * 6;
      if (this.map.surfaceAt(fx, fz) > 0.5) continue;
      const raft = new THREE.Mesh(new THREE.BoxGeometry(6, 0.35, 3.2), wood);
      raft.position.set(fx, 0.25, fz);
      this.root.add(raft);
      const n = 2 + (i % 3);
      for (let j = 0; j < n; j++) {
        const lion = this.place(j % 3 === 2 ? 'harbor_seal' : 'sea_lion', { x: fx - 2 + j * 1.5, y: 0.45, z: fz + ((j * 7) % 3) * 0.6 - 0.6, rotY: (k * 2.3) % 6.28, scale: 0.85 + (k % 3) * 0.12 });
        this.lions.push({ lion, raft, ph: k * 1.7, base: lion.rotation.y });
        k++;
      }
      this.lions.push({ raft, ph: i, raftOnly: true });
    }
    this.lionAt = new THREE.Vector3(p.x, 0.5, p.z);
    this.barkT = 2;
    const sign = this.signPost(p.x + 6, p.z + 6, ['SEA LIONS', 'they moved in 1990 and never left'], 0, { bg: '#1a4a6a' });
    this.memoryNote(sign, 'Read the sign', 'The sea lions showed up after the 1989 earthquake and just… decided this was home.\n\nSome days there are hundreds. They bark, they flop, they sunbathe on top of each other. Nobody makes them leave.\n\n(Sometimes that\'s what a home is: somewhere you\'re allowed to stay.)');
  }

  #aquarium() {
    const g = this.game;
    const a = this.map.poi('Aquarium of the Bay');
    if (!a) return;
    // the door on the real building's wall that faces the Embarcadero
    const m = this.map;
    const b = m.buildingAt(a.x, a.z, 30);
    const st = this.spawns.bus_stop?.position ?? new THREE.Vector3(a.x, 0, a.z + 40);
    const w = (b && m.wallFacing(b, st.x, st.z)) ?? { x: a.x, z: a.z, nx: 0, nz: 1, yaw: 0 };
    const y = b?.ground ?? this.groundHeight(w.x, w.z);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.3), this.mat({ color: 0x1a4a7a }));
    door.position.set(w.x + w.nx * 0.15, y + 1.3, w.z + w.nz * 0.15);
    door.rotation.y = w.yaw;
    this.root.add(door);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.1), this.mat({ map: signTexture(['AQUARIUM OF THE BAY'], { bg: '#0a3a6a', fg: '#8ae0ff', w: 160, h: 34 }), doubleSide: true }));
    sign.position.set(w.x + w.nx * 0.2, y + 3.6, w.z + w.nz * 0.2);
    sign.rotation.y = w.yaw;
    this.root.add(sign);
    this.addInteractable(door, { prompt: 'Go into the Aquarium of the Bay', action: () => g.changeScene('Aquarium', 'door') });
    this.addSpawn('aquarium', [w.x + w.nx * 3, y, w.z + w.nz * 3], w.yaw + Math.PI);
  }

  /** Across the water: Alcatraz and the Golden Gate (real bearings, in silhouette). */
  #bayViews() {
    const o = this.data.origin;
    const MX = 111320 * Math.cos((o.lat * Math.PI) / 180);
    const at = (lat, lon) => new THREE.Vector3((lon - o.lon) * MX, 0, -(lat - o.lat) * 110540);
    // Alcatraz
    const al = at(37.8267, -122.423);
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(160, 260, 40, 10), this.mat({ color: 0x5a5a4a, fogScale: 0.12 }));
    isle.position.copy(al).setY(10);
    isle.scale.set(1.8, 1, 0.8);
    const block = new THREE.Mesh(new THREE.BoxGeometry(160, 26, 50), this.mat({ color: 0xd8d0c0, fogScale: 0.12 }));
    block.position.copy(al).setY(42);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 50, 6), this.mat({ color: 0xe8e0d0, fogScale: 0.12 }));
    tower.position.copy(al).add(new THREE.Vector3(70, 50, 0));
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(4, 6, 4), this.mat({ color: 0xfff0b0, unlit: true, fogScale: 0 }));
    beacon.position.copy(tower.position).setY(78);
    this.root.add(isle, block, tower, beacon);
    this.beacon = beacon;
    // the Golden Gate, far to the west
    buildGoldenGate(this, at(37.8106, -122.4771), at(37.8270, -122.4797), { far: true });
  }

  #gulls() {
    this.gulls = [];
    const m = this.mat({ color: 0xf0f0f0, doubleSide: true });
    for (let i = 0; i < 14; i++) {
      const gl = new THREE.Group();
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), m);
        w.position.x = sx * 0.25;
        w.name = sx < 0 ? 'l' : 'r';
        gl.add(w);
      }
      this.root.add(gl);
      this.gulls.push({ gl, a: Math.random() * 6, r: 20 + Math.random() * 40, y: 8 + Math.random() * 10, s: 0.2 + Math.random() * 0.2 });
    }
  }

  update(dt, time) {
    super.update(dt, time);
    const g = this.game;
    if (this.carousel) {
      this.carousel.spin.rotation.y += dt * 0.45;
      for (const h of this.horses) h.body.position.y = 1.1 + Math.sin(time * 1.6 + h.ph) * 0.28;
      if (this.riding && this.rideSeat) {
        this.riding.body.updateMatrixWorld(true);
        this.riding.body.getWorldPosition(this.rideSeat.eye);
        this.rideSeat.eye.y += 0.95;
        this.rideSeat.yaw = this.carousel.spin.rotation.y * -1 + 0; // face the way you're going
      }
    }
    for (const l of this.lions ?? []) {
      if (l.raftOnly) {
        l.raft.position.y = 0.25 + Math.sin(time * 0.9 + l.ph) * 0.08;
        continue;
      }
      l.lion.position.y = 0.45 + Math.sin(time * 0.9 + l.ph) * 0.08;
      l.lion.rotation.y = l.base + Math.sin(time * 0.3 + l.ph) * 0.25;
      l.lion.rotation.z = Math.sin(time * 0.5 + l.ph * 2) * 0.12;
    }
    if (this.lionAt && (this.barkT -= dt) <= 0) {
      this.barkT = 0.6 + Math.random() * 2.2;
      if (g.camera.position.distanceTo(this.lionAt) < 70) g.audio.oneShot('sea_lion', { volume: 0.7, object: this.lions[(Math.random() * this.lions.length) | 0]?.lion ?? this.root });
    }
    if (this.beacon) this.beacon.visible = Math.sin(time * 1.5) > 0.4;
    const cam = g.camera.position;
    for (const gl of this.gulls ?? []) {
      gl.a += dt * gl.s;
      gl.gl.position.set(cam.x + Math.cos(gl.a) * gl.r, gl.y + Math.sin(gl.a * 3) * 1.5, cam.z + Math.sin(gl.a) * gl.r);
      gl.gl.rotation.y = -gl.a;
      const f = Math.sin(time * 7 + gl.r) * 0.5;
      gl.gl.children[0].rotation.z = f;
      gl.gl.children[1].rotation.z = -f;
    }
  }
}

function mirrorTex() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#e8d090' : '#b8d8f0';
    g.fillRect((i % 4) * 8, Math.floor(i / 4) * 8, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

function stripeTex() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#f8f0e0' : '#c83a3a';
    g.fillRect(i * 8, 0, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}
