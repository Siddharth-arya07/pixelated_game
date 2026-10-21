import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';

/**
 * SeaScene — under the bay (diving)
 * ---------------------------------
 * No monsters, ever. Just the quiet blue.
 *
 *  shallows   by the pier: seagrass, starfish, crabs, shells to collect, clams
 *  kelp       a swaying kelp forest (west) with seahorses and silver schools
 *  reef       a coral garden (east): clownfish, tangs, butterflyfish, a turtle,
 *             an octopus that hides when you get close
 *  the wreck  the schooner Margaret Rose, on her side in the sand: the ship's
 *             bell, the captain's chest (coins, a brass compass), her log
 *  the cave   a rock dome (north-west) with an air pocket: breathe, rest,
 *             glow-worms on the ceiling, a pearl
 *  the deep   the trench (south): glowing jellyfish, manta rays, and a
 *             humpback that sings as it passes. Bring a light.
 *
 * Swimming: WASD (where you look) · SPACE up · C down · SHIFT kick harder ·
 * hold F on a creature to log it in your Sea Log (phone) · E at the surface
 * to climb out. Oxygen runs down while you're under; surface or find an
 * air pocket. Run out and a lifeguard fishes you out at the pier — no harm done.
 */
const SIZE = 360;
const LOG = '3am-sealog';
export const SEA_LIFE = {
  clownfish: 'Clownfish — lives in the anemones on the reef. Bright, bossy, about the size of your thumb.',
  tang: 'Yellow Tang — a little lemon of a fish. Grazes on algae all day.',
  butterflyfish: 'Butterflyfish — swims in pairs. Mates for life, they say.',
  zebrafish: 'Zebra Clownfish — the stripy cousin. Shy, then suddenly not.',
  mandarin: 'Mandarin Dragonet — looks like someone painted it with a tiny brush.',
  turtle: 'Green Sea Turtle — older than your grandparents, probably. Unbothered.',
  manta: 'Manta Ray — a seven-metre kite. Gentle. Curious about divers.',
  whale: 'Humpback Whale — sings songs that last twenty minutes. This one passes through every night.',
  dolphin: 'Bottlenose Dolphin — they came to see what you are.',
  jelly: 'Moon Jelly — no brain, no heart, glows anyway.',
  octopus: 'Octopus — eight arms, three hearts, zero interest in being looked at.',
  seahorse: 'Seahorse — the dads carry the babies. Holds on to the kelp with its tail.',
  crab: 'Shore Crab — walks sideways, waves claws, means well.',
  starfish: 'Starfish — can grow back an arm. Mostly just sits.',
  sardine: 'Sardines — a thousand fish pretending to be one big fish.',
};

if (typeof window !== 'undefined') window.__seaLife = SEA_LIFE;

export class SeaScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Sea', label: 'under the bay' });
    this.indoor = { fog: 0x0d4a5a, near: 2, far: 34, ambient: 0x4a8a9a, daylight: 0 };
    this.killY = -200;
    this.creatures = []; // { obj, mixer, kind, update(dt,t) }
    this.scanT = 0;
  }

  /** Seabed height. */
  depth(x, z) {
    let d = -9 - Math.max(0, (150 - z) / 300) * 20; // shelves away from the pier
    if (z < -90) d -= Math.min(30, (-90 - z) * 0.5); // the trench
    if (x > 20 && x < 130 && z > -30 && z < 90) d += 6 * Math.sin(((x - 20) / 110) * Math.PI) * Math.sin(((z + 30) / 120) * Math.PI); // reef rise
    const wx = x;
    const wz = z + 40;
    if (Math.hypot(wx, wz) < 26) d = Math.min(d, -30); // wreck basin
    d += noise2(x * 0.05, z * 0.05) * 2.2 + noise2(x * 0.2, z * 0.2) * 0.5;
    // walls at the edge of the bay
    const e = Math.max(Math.abs(x), Math.abs(z)) - (SIZE / 2 - 20);
    if (e > 0) d += e * 1.5;
    return Math.min(d, -1.5);
  }

  groundHeight(x, z) {
    return this.depth(x, z);
  }

  build() {
    const g = this.game;
    this.#seabed();
    this.#surface();
    this.#plants();
    this.#wreck();
    this.#cave();
    this.#life();
    this.#collectibles();
    this.#snow();
    this.addSpawn('pier', [0, -2.2, 150], 0);
    this.addSpawn('default', [0, -2.2, 150], 0);
    this.addSpawn('boat', [0, -2.2, -10], 0);
    // pier pilings overhead at the entry
    const wood = this.mat({ color: 0x4a3a2a });
    for (let k = 0; k < 6; k++) for (const dx of [-1.6, 1.6]) this.box(0.3, 12, 0.3, wood, dx, -5, 156 + k * 5, { collide: true });
    this.#hud();
    this.updaters.push((dt, t) => this.#tick(dt, t));
    void g;
  }

  // ===========================================================================
  // World
  // ===========================================================================

  #seabed() {
    const seg = 110;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.depth(x, z);
      pos.setY(i, y);
      const reef = x > 20 && x < 130 && z > -30 && z < 90;
      const deep = y < -32;
      c.setHex(deep ? 0x3a4a5a : reef ? 0xc8b890 : 0xd8c8a0).multiplyScalar(0.85 + noise2(x * 0.3, z * 0.3) * 0.15);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const bed = new THREE.Mesh(geo, this.mat({ map: this.tex('dirt', 40), vertexColors: true }));
    this.root.add(bed);
    this.addColliderMesh(bed, 'terrain');
  }

  #surface() {
    // the underside of the sea, shimmering
    const s = new THREE.Mesh(new THREE.PlaneGeometry(220, 220, 1, 1), this.mat({ map: this.tex('water', 30), color: 0x9ae0f0, unlit: true, opacity: 0.55, doubleSide: true, scroll: [0.01, 0.006], fogScale: 0.4 }));
    s.rotation.x = Math.PI / 2;
    s.position.y = 0;
    this.root.add(s);
    this.surface = s;
    // god rays
    this.rays = [];
    const rm = this.mat({ color: 0xc8f0ff, unlit: true, opacity: 0.06, additive: true, doubleSide: true, fogScale: 0.5 });
    for (let k = 0; k < 10; k++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 30), rm);
      this.root.add(r);
      this.rays.push({ r, ox: (Math.random() - 0.5) * 40, oz: (Math.random() - 0.5) * 40, ph: Math.random() * 6 });
    }
  }

  #plants() {
    const rand = mulberry(77);
    const kelp = [];
    const coral = [];
    const coral2 = [];
    const reef = [];
    const grass = [];
    const rocks = [];
    for (let i = 0; i < 260; i++) {
      const x = -120 + rand() * 100;
      const z = -20 + rand() * 100;
      kelp.push({ x, y: this.depth(x, z), z, rotY: rand() * 6, scale: 6 + rand() * 9 });
    }
    for (let i = 0; i < 140; i++) {
      const x = 22 + rand() * 105;
      const z = -28 + rand() * 115;
      const y = this.depth(x, z);
      if (rand() < 0.7) coral.push({ x, y, z, rotY: rand() * 6, scale: 0.6 + rand() * 1.3 });
      else coral2.push({ x, y, z, rotY: rand() * 6, scale: 0.5 + rand() * 0.9 });
    }
    for (let i = 0; i < 10; i++) {
      const x = 30 + rand() * 90;
      const z = -20 + rand() * 100;
      reef.push({ x, y: this.depth(x, z), z, rotY: rand() * 6, scale: 0.8 + rand() * 0.6 });
    }
    for (let i = 0; i < 500; i++) {
      const x = -60 + rand() * 120;
      const z = 90 + rand() * 75;
      grass.push({ x, y: this.depth(x, z), z, rotY: rand() * 6, scale: 1 + rand() * 1.5 });
    }
    for (let i = 0; i < 90; i++) {
      const x = (rand() - 0.5) * (SIZE - 40);
      const z = (rand() - 0.5) * (SIZE - 40);
      rocks.push({ x, y: this.depth(x, z) - 0.3, z, rotY: rand() * 6, scale: 0.8 + rand() * 2.5 });
    }
    this.scatter('sea_kelp', kelp, { cell: 40 });
    this.scatter('sea_coral', coral, { cell: 40 });
    this.scatter('sea_coral2', coral2, { cell: 40 });
    this.scatter('sea_reef', reef, { cell: 60 });
    this.scatter('grass', grass, { cell: 40 });
    this.scatter('rock', rocks, { cell: 60 });
    this.kelpAt = kelp;
  }

  #wreck() {
    const g = this.game;
    const wx = 0;
    const wz = -40;
    const wy = this.depth(wx, wz);
    const ship = this.place('sea_wreck', { x: wx, y: wy - 1.2, z: wz, rotY: 0.6 });
    ship.rotation.z = 0.32; // on her side
    // name board
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 48;
    const x = c.getContext('2d');
    x.fillStyle = '#2a1e14';
    x.fillRect(0, 0, 256, 48);
    x.fillStyle = '#d8b878';
    x.font = 'bold 28px Georgia';
    x.textAlign = 'center';
    x.fillText('MARGARET ROSE', 128, 34);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.75), this.mat({ map: new THREE.CanvasTexture(c) }));
    board.position.set(wx + 9, wy + 3, wz + 8);
    board.rotation.y = 0.6;
    this.root.add(board);
    // the bell
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.45, 12, 1, true), this.mat({ color: 0xc8a050, doubleSide: true }));
    bell.position.set(wx - 4, wy + 3.5, wz + 2);
    this.root.add(bell);
    this.addInteractable(bell, { prompt: 'Ring the ship’s bell', range: 3, action: () => this.#bell() });
    // the captain's chest
    const chest = this.place('sea_chest', { x: wx + 3, y: wy + 0.2, z: wz - 3, rotY: 1.1 });
    const KEY = '3am-wreck-chest';
    this.addInteractable(chest, {
      prompt: () => (localStorage.getItem(KEY) ? 'An empty sea chest' : 'Open the captain’s chest'),
      range: 3,
      action: () => {
        if (localStorage.getItem(KEY)) return g.hud.toast('Empty now. Just a few curious fish living in it.', 2500);
        try {
          localStorage.setItem(KEY, '1');
        } catch {}
        g.inventory.add('gold_coin', 6);
        g.inventory.add('brass_compass');
        g.hud.toast('Six gold coins and a brass compass, still pointing north after all these years.', 5000);
        this.#chime();
      },
    });
    // the captain's log, wedged in a crate
    const log = this.box(0.35, 0.08, 0.25, this.mat({ color: 0x6a4a30 }), wx - 2, wy + 0.4, wz - 5, { collide: false });
    this.addInteractable(log, {
      prompt: 'A logbook in an oilskin wrapper',
      action: () =>
        g.openUI(() =>
          g.note.show(
            'LOG OF THE SCHOONER MARGARET ROSE\n\nOct. 9th, 1911. Fog thick as wool. We have lost the light.\n\nOct. 10th. Ran aground on the bar at 3 a.m. All hands safe — the keeper rowed out in the dark and took us off one at a time. Eleven trips. Twelve men. He would not take a coin.\n\nIf anyone finds this: his name was Abernathy, and he kept the light on.',
          ),
        ),
    });
    this.addLight({ position: [wx, wy + 5, wz], color: 0x6ad0ff, range: 18, intensity: 0.6 });
    this.wreckAt = new THREE.Vector3(wx, wy, wz);
  }

  #cave() {
    const g = this.game;
    const cx = -95;
    const cz = -65;
    const floor = this.depth(cx, cz);
    // a lumpy dome of rock with an opening facing east
    const geo = new THREE.SphereGeometry(9, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
    const pos = geo.attributes.position;
    const keep = [];
    for (let i = 0; i < pos.count; i += 3) {
      const ax = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const ay = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      if (ax > 5 && ay < 4.5 && Math.abs((pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3) < 3) continue; // doorway
      for (let k = 0; k < 3; k++) {
        const n = 1 + noise2(pos.getX(i + k) * 0.4, pos.getZ(i + k) * 0.4 + pos.getY(i + k)) * 0.15;
        keep.push(pos.getX(i + k) * n + cx, pos.getY(i + k) * 1.3 * n + floor, pos.getZ(i + k) * n + cz);
      }
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    g2.computeVertexNormals();
    const dome = new THREE.Mesh(g2, this.mat({ color: 0x5a6068, doubleSide: true }));
    this.root.add(dome);
    this.addColliderMesh(dome);
    // the air pocket: a shimmering surface near the top
    const top = floor + 11.7;
    const pocket = new THREE.Mesh(new THREE.CircleGeometry(4.5, 20), this.mat({ color: 0xc8f0ff, unlit: true, opacity: 0.4, doubleSide: true }));
    pocket.rotation.x = Math.PI / 2;
    pocket.position.set(cx, top - 1.2, cz);
    this.root.add(pocket);
    this.pocket = { c: new THREE.Vector3(cx, top - 1.2, cz), r: 4.5 };
    const worm = this.mat({ color: 0x9affe0, unlit: true });
    for (let k = 0; k < 50; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 6;
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), worm);
      d.position.set(cx + Math.cos(a) * r, top - 0.2 - Math.random() * 1.5, cz + Math.sin(a) * r);
      this.root.add(d);
    }
    this.addLight({ position: [cx, top - 2, cz], color: 0x9affe0, range: 10, intensity: 0.9 });
    // a pearl on a ledge
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), this.mat({ color: 0xfff8f0, unlit: true }));
    pearl.position.set(cx - 5, floor + 0.3, cz + 2);
    this.root.add(pearl);
    this.addInteractable(pearl, {
      prompt: 'A pearl!',
      range: 2.5,
      enabled: () => pearl.visible,
      action: () => {
        pearl.visible = false;
        g.inventory.add('pearl');
        g.hud.toast('A perfect pearl, just sitting there.', 3000);
        setTimeout(() => (pearl.visible = true), 600000);
      },
    });
  }

  #life() {
    const g = this.game;
    const add = (key, p, fn, scale = 1) => {
      const obj = g.assets.model(key);
      if (!obj) return null;
      obj.position.copy(p);
      obj.scale.multiplyScalar(scale);
      this.root.add(obj);
      const mixer = obj.userData.animations?.length ? new THREE.AnimationMixer(obj) : null;
      if (mixer) mixer.clipAction(obj.userData.animations[0]).play();
      const c = { obj, mixer, home: p.clone(), ph: Math.random() * 6, kind: key.replace('sea_', ''), fn };
      this.creatures.push(c);
      return c;
    };
    const wander = (r, h, sp) => (c, dt, t) => {
      const a = t * sp + c.ph;
      const p = c.obj.position;
      const nx = c.home.x + Math.cos(a) * r;
      const nz = c.home.z + Math.sin(a * 1.3) * r;
      const ny = c.home.y + Math.sin(a * 0.7) * h;
      c.obj.rotation.y = Math.atan2(nx - p.x, nz - p.z);
      p.set(nx, ny, nz);
    };
    // reef fish around coral heads
    const rand = mulberry(9);
    const reefFish = ['sea_clownfish', 'sea_tang', 'sea_butterflyfish', 'sea_zebrafish', 'sea_mandarin'];
    for (let i = 0; i < 26; i++) {
      const x = 30 + rand() * 90;
      const z = -20 + rand() * 100;
      add(reefFish[i % 5], new THREE.Vector3(x, this.depth(x, z) + 1 + rand() * 2, z), wander(1.5 + rand() * 2, 0.6, 0.4 + rand() * 0.4));
    }
    // turtles
    for (const [x, z] of [[60, 30], [10, 110]]) add('sea_turtle', new THREE.Vector3(x, this.depth(x, z) + 4, z), wander(18, 2, 0.06));
    // octopus that hides
    const oc = add('sea_octopus', new THREE.Vector3(90, this.depth(90, 10) + 0.4, 10), (c) => {
      const near = g.camera.position.distanceTo(c.home) < 5;
      const s = THREE.MathUtils.damp(c.obj.scale.x, near ? 0.15 : 1, 3, g.dtLast);
      c.obj.scale.setScalar(s);
    });
    void oc;
    // seahorses in the kelp
    for (let i = 0; i < 6; i++) {
      const k = this.kelpAt[i * 13];
      add('sea_seahorse', new THREE.Vector3(k.x + 0.3, k.y + 2 + i % 3, k.z), (c, dt, t) => (c.obj.position.y = c.home.y + Math.sin(t + c.ph) * 0.15));
    }
    // crabs + starfish in the shallows
    for (let i = 0; i < 8; i++) {
      const x = -40 + rand() * 80;
      const z = 95 + rand() * 60;
      add('sea_crab', new THREE.Vector3(x, this.depth(x, z), z), (c, dt, t) => {
        const a = Math.sin(t * 0.5 + c.ph) * 2;
        c.obj.position.x = c.home.x + a;
        c.obj.position.y = this.depth(c.obj.position.x, c.home.z);
      });
      const sx = -50 + rand() * 100;
      const sz = 90 + rand() * 70;
      add('sea_starfish', new THREE.Vector3(sx, this.depth(sx, sz) + 0.05, sz), null);
      const ux = 20 + rand() * 100;
      const uz = -20 + rand() * 100;
      add('sea_urchin', new THREE.Vector3(ux, this.depth(ux, uz) + 0.05, uz), null);
    }
    // the deep: jellies, mantas, the whale
    const jMat = this.mat({ color: 0xc8a0ff, unlit: true, opacity: 0.7 });
    for (let i = 0; i < 26; i++) {
      const x = (rand() - 0.5) * 220;
      const z = -100 - rand() * 60;
      const c = add('sea_jelly', new THREE.Vector3(x, -12 - rand() * 25, z), (cc, dt, t) => {
        cc.obj.position.y = cc.home.y + Math.sin(t * 0.6 + cc.ph) * 1.5;
        cc.obj.scale.y = 1 + Math.sin(t * 2.2 + cc.ph) * 0.12;
      });
      c?.obj.traverse((o) => o.isMesh && (o.material = jMat));
    }
    this.addLight({ position: [0, -25, -130], color: 0xb080ff, range: 40, intensity: 0.8 });
    for (const [x, z] of [[-40, -120], [50, -140]]) add('sea_manta', new THREE.Vector3(x, -20, z), wander(30, 4, 0.05));
    this.whale = add('sea_whale', new THREE.Vector3(0, -18, -120), (c, dt, t) => {
      const a = t * 0.012 + c.ph;
      const p = c.obj.position;
      const nx = Math.cos(a) * 90;
      const nz = -120 + Math.sin(a) * 40;
      c.obj.rotation.y = Math.atan2(nx - p.x, nz - p.z);
      p.set(nx, -18 + Math.sin(a * 3) * 4, nz);
    });
    // dolphins near the surface
    for (let i = 0; i < 3; i++) add('sea_dolphin', new THREE.Vector3(i * 4, -2.5, 40), wander(26, 1.2, 0.18 + i * 0.01));
    // sardine schools (instanced, swirling)
    this.schools = [];
    const fishGeo = new THREE.ConeGeometry(0.05, 0.22, 4);
    fishGeo.rotateX(Math.PI / 2);
    const fishMat = this.mat({ color: 0xc8d8e0 });
    for (const [x, z] of [[-70, 30], [-40, 60], [70, 40]]) {
      const inst = new THREE.InstancedMesh(fishGeo, fishMat, 120);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      inst.frustumCulled = false;
      this.root.add(inst);
      this.schools.push({ inst, c: new THREE.Vector3(x, this.depth(x, z) + 6, z), seeds: Array.from({ length: 120 }, () => [Math.random(), Math.random(), Math.random()]) });
    }
  }

  #collectibles() {
    const g = this.game;
    const rand = mulberry(41);
    const shells = ['shell_conch', 'shell_scallop', 'shell_cowrie', 'sea_glass'];
    for (let i = 0; i < 16; i++) {
      const x = -60 + rand() * 120;
      const z = 60 + rand() * 100;
      const kind = shells[i % 4];
      const m = kind === 'sea_glass' ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.05, 0), this.mat({ color: [0x60d090, 0x6090e0, 0xe0e0e0][i % 3], unlit: true, opacity: 0.8 })) : this.place('sea_shell', { x: 0, z: 0 });
      m.position.set(x, this.depth(x, z) + 0.05, z);
      if (!m.parent) this.root.add(m);
      this.addInteractable(m, {
        prompt: `Pick up the ${g.inventory.def(kind).name.toLowerCase()}`,
        range: 2.4,
        enabled: () => m.visible,
        action: () => {
          m.visible = false;
          g.inventory.add(kind);
          setTimeout(() => (m.visible = true), 480000);
        },
      });
    }
    // clams with pearls (once a day each)
    for (let i = 0; i < 6; i++) {
      const x = 25 + rand() * 90;
      const z = -10 + rand() * 90;
      const y = this.depth(x, z);
      const grp = new THREE.Group();
      const mat = this.mat({ color: 0x8a7a8a });
      const lo = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      hi.scale.y = 0.4;
      lo.scale.y = 0.4;
      hi.rotation.x = -0.3;
      grp.add(lo, hi);
      grp.position.set(x, y + 0.1, z);
      this.root.add(grp);
      let day = -1;
      this.addInteractable(grp, {
        prompt: () => (day === g.dayNight.day ? 'A sleepy clam' : 'Gently open the giant clam'),
        range: 2.4,
        action: () => {
          if (day === g.dayNight.day) return;
          day = g.dayNight.day;
          if (Math.random() < 0.4) {
            g.inventory.add('pearl');
            g.hud.toast('A pearl! The clam doesn’t seem to mind.', 3000);
          } else g.hud.toast('Just a very surprised clam.', 2000);
        },
      });
    }
    // Lucy's bottle (from Ray's story)
    const bottle = this.place('beer_bottle', { x: 110, z: -70 });
    bottle.position.y = this.depth(110, -70) + 0.08;
    bottle.rotation.z = Math.PI / 2;
    this.addInteractable(bottle, {
      prompt: () => (g.inventory.has('lucy_bottle') || localStorage.getItem('3am-lucy') ? 'Just sand' : 'A bottle with a rolled-up note'),
      enabled: () => bottle.visible,
      action: () => {
        bottle.visible = false;
        try {
          localStorage.setItem('3am-lucy', '1');
        } catch {}
        g.inventory.add('lucy_bottle');
        g.openUI(() => g.note.show('A child’s handwriting, pencil:\n\n“Hello whoever finds this. My name is Lucy. I am eight. Do fish sleep?”\n\nUnderneath, in different, older handwriting:\n\n“Yes, but with their eyes open, which seems rude to me. — R.”\n\n(Ray would want to see this.)'));
      },
    });
  }

  #snow() {
    const N = 500;
    const geo = new THREE.BufferGeometry();
    this.sp = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) this.sp[i] = Math.random() * 30;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.snowPts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc8e8f0, size: 0.06, transparent: true, opacity: 0.6, depthWrite: false }));
    this.snowPts.frustumCulled = false;
    this.root.add(this.snowPts);
  }

  // ===========================================================================
  // Diving
  // ===========================================================================

  #hud() {
    this.el = document.createElement('div');
    this.el.id = 'dive';
    this.el.className = 'hidden';
    this.el.innerHTML = '<div class="dv-o2"><i></i></div><div class="dv-txt"></div><div class="dv-scan"></div>';
    document.getElementById('ui').appendChild(this.el);
  }

  get maxO2() {
    const inv = this.game.inventory;
    return inv.has('tank_twin') ? 170 : inv.has('tank_big') ? 95 : 50;
  }

  onEnter(spawn) {
    const g = this.game;
    this.diver = { pos: new THREE.Vector3(), vel: new THREE.Vector3() };
    const sp = this.spawns[spawn] ?? this.spawns.pier;
    this.diver.pos.copy(sp.position);
    this.from = spawn === 'boat' ? 'boat' : 'pier';
    this.o2 = this.maxO2;
    g.player.enabled = false;
    g.player.yaw = sp.yaw ?? 0;
    g.player.pitch = -0.2;
    this.el.classList.remove('hidden');
    this.#ambience(true);
    setTimeout(() => g.hud.toast('WASD swim (where you look) · SPACE up · C down · SHIFT kick · hold F to log a creature · E at the surface to climb out', 7000), 600);
  }

  onExit() {
    this.game.player.enabled = true;
    this.el.classList.add('hidden');
    this.#ambience(false);
  }

  async #leave(black = false) {
    const g = this.game;
    if (this.leaving) return;
    this.leaving = true;
    g.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, 900));
    const boat = this.from === 'boat' ? g.vehicles.get('boat') : null;
    await g.changeScene('World', boat && !black ? 'boat_mooring' : 'dive_out');
    if (boat && !black) {
      g.player.spawn({ position: boat.object.position.clone().add(new THREE.Vector3(0, 1.6, 0)), yaw: g.player.yaw });
      g.vehicles.enter(boat);
    }
    g.fade.classList.remove('on');
    this.leaving = false;
    if (black) g.hud.toast('You blacked out… and woke up on the pier with a lifeguard grinning at you. “Watch your air, kid.” No harm done.', 6000);
  }

  #tick(dt, t) {
    const g = this.game;
    if (g.scene !== this || !this.diver) return;
    const d = this.diver;
    const k = g.input;
    const ui = g.uiOpen || g.focus;
    if (!ui && k.locked) g.player.look(k.consumeMouseDelta());
    // swim: where you look
    const fwd = g.camera.getWorldDirection(_f);
    const right = _r.set(-fwd.z, 0, fwd.x).normalize();
    const fins = g.inventory.has('dive_mask') ? 1.25 : 1;
    const sprint = k.down('ShiftLeft') || k.down('ShiftRight');
    const acc = (sprint ? 7 : 4.5) * fins;
    if (!ui) {
      const f = k.axis('KeyS', 'KeyW');
      const s = k.axis('KeyA', 'KeyD');
      d.vel.addScaledVector(fwd, f * acc * dt).addScaledVector(right, s * acc * dt);
      if (k.down('Space')) d.vel.y += acc * dt;
      if (k.down('KeyC')) d.vel.y -= acc * dt;
    }
    d.vel.multiplyScalar(Math.exp(-1.8 * dt));
    d.vel.y += 0.15 * dt; // a little buoyancy
    d.pos.addScaledVector(d.vel, dt);
    d.pos.y = Math.min(d.pos.y, -0.35);
    // bump into the seabed, rocks, the wreck
    _seg.start.copy(d.pos).y -= 0.4;
    _seg.end.copy(d.pos).y += 0.2;
    _b.copy(_seg.start);
    if (this.collideCapsule(_seg, 0.4)) {
      d.pos.add(_seg.start.sub(_b));
      d.vel.multiplyScalar(0.6);
    }
    g.player.position.set(d.pos.x, d.pos.y - 1.6, d.pos.z);
    // air
    const atSurface = d.pos.y > -0.8;
    const inPocket = this.pocket && Math.hypot(d.pos.x - this.pocket.c.x, d.pos.z - this.pocket.c.z) < this.pocket.r && d.pos.y > this.pocket.c.y - 1.5;
    if (atSurface || inPocket) {
      if (this.o2 < this.maxO2 - 1 && inPocket && !this.pocketMsg) {
        this.pocketMsg = true;
        g.hud.toast('An air pocket! You gulp sweet, stale cave air. Glow-worms twinkle on the ceiling.', 4000);
      }
      this.o2 = Math.min(this.maxO2, this.o2 + dt * 25);
    } else {
      this.pocketMsg = false;
      this.o2 -= dt * (sprint ? 1.6 : 1);
    }
    if (this.o2 <= 0) return this.#leave(true);
    if (atSurface && !ui && k.pressed('KeyE')) {
      k.consume('KeyE');
      return this.#leave();
    }
    // HUD
    const frac = this.o2 / this.maxO2;
    const bar = this.el.querySelector('.dv-o2 i');
    bar.style.width = `${frac * 100}%`;
    bar.style.background = frac < 0.25 ? '#ff5a4a' : '#6ae0ff';
    this.el.querySelector('.dv-txt').textContent = `${Math.round(-d.pos.y)} m${atSurface ? ' · E climb out' : ''}${frac < 0.25 ? ' · LOW AIR — go up!' : ''}`;
    if (frac < 0.25 && (this.beepT = (this.beepT ?? 0) - dt) <= 0) {
      this.beepT = 1.2;
      g.audio.oneShot('click', { volume: 0.4, rate: 2.2 });
    }
    // light falls off with depth (and at night)
    const m = g.dayNight.minutes;
    const day = m > 360 && m < 1230 ? 1 : 0.25;
    const deep = THREE.MathUtils.clamp(-d.pos.y / 50, 0, 1);
    this.indoor.fog = _c.setHex(0x1a7a8a).lerp(_c2.setHex(0x020812), deep * 0.85 + (1 - day) * 0.3).getHex();
    this.indoor.ambient = _c.setHex(0x6aa8b8).multiplyScalar((1 - deep * 0.8) * (0.4 + day * 0.6)).getHex();
    this.indoor.far = 30 + (1 - deep) * 10;
    // dive light
    this.lightsOn ??= [];
    if (g.inventory.has('dive_light')) {
      if (!this.torch) this.torch = this.addLight({ position: [0, 0, 0], color: 0xfff4e0, range: 16, intensity: 1.4, priority: 8 });
      this.torch.position.copy(g.camera.position).addScaledVector(fwd, 3);
    }
    // surface + rays follow you
    this.surface.position.set(d.pos.x, 0, d.pos.z);
    for (const r of this.rays) {
      r.r.position.set(d.pos.x + r.ox, -14, d.pos.z + r.oz);
      r.r.rotation.y = Math.atan2(g.camera.position.x - r.r.position.x, g.camera.position.z - r.r.position.z);
      r.r.material.opacity = 0.03 * (1 - deep) * day * (0.6 + Math.sin(t * 0.7 + r.ph) * 0.4);
    }
    // marine snow
    const arr = this.snowPts.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      this.sp[i + 1] -= dt * 0.2;
      if (this.sp[i + 1] < 0) this.sp[i + 1] += 30;
      arr[i] = d.pos.x - 15 + this.sp[i];
      arr[i + 1] = d.pos.y - 15 + this.sp[i + 1];
      arr[i + 2] = d.pos.z - 15 + this.sp[i + 2];
    }
    this.snowPts.geometry.attributes.position.needsUpdate = true;
    // creatures
    for (const c of this.creatures) {
      c.mixer?.update(dt);
      c.fn?.(c, dt, t);
    }
    for (const s of this.schools) this.#school(s, t);
    // whale song
    if (this.whale && (this.songT = (this.songT ?? 8) - dt) <= 0) {
      this.songT = 12 + Math.random() * 14;
      const dist = g.camera.position.distanceTo(this.whale.obj.position);
      if (dist < 120) this.#song(dist);
    }
    // bubbles
    if ((this.bubT = (this.bubT ?? 3) - dt) <= 0 && !atSurface) {
      this.bubT = 3.5;
      this.#bubbles();
    }
    this.#scan(dt);
  }

  #school(s, t) {
    const m = _m;
    s.seeds.forEach(([a, b, c], i) => {
      const ang = t * (0.4 + a * 0.2) + a * 6.28;
      const r = 3 + b * 4 + Math.sin(t * 0.5 + c * 6) * 1.5;
      _p.set(s.c.x + Math.cos(ang) * r, s.c.y + Math.sin(t * 0.7 + b * 6) * 1.5 + (c - 0.5) * 3, s.c.z + Math.sin(ang) * r);
      _q.setFromEuler(_e.set(0, -ang, 0));
      m.compose(_p, _q, _s.setScalar(1));
      s.inst.setMatrixAt(i, m);
    });
    s.inst.instanceMatrix.needsUpdate = true;
  }

  // ---- the Sea Log ----------------------------------------------------------------------

  #scan(dt) {
    const g = this.game;
    const k = g.input;
    const el = this.el.querySelector('.dv-scan');
    if (!k.down('KeyF')) {
      this.scanT = 0;
      el.textContent = '';
      return;
    }
    // what's in the crosshair?
    const dir = g.camera.getWorldDirection(_f);
    let best = null;
    let bd = 14;
    const cands = this.creatures.map((c) => ({ kind: c.kind, p: c.obj.position }));
    for (const s of this.schools) cands.push({ kind: 'sardine', p: s.c });
    for (const c of cands) {
      const to = _p.copy(c.p).sub(g.camera.position);
      const dist = to.length();
      if (dist < bd && to.normalize().dot(dir) > 0.93) {
        best = c;
        bd = dist;
      }
    }
    if (!best) {
      this.scanT = 0;
      el.textContent = 'scanning… (aim at a creature)';
      return;
    }
    const kind = { butterflyfish: 'butterflyfish', jelly: 'jelly' }[best.kind] ?? best.kind;
    const log = loadLog();
    if (log[kind]) {
      el.textContent = `${SEA_LIFE[kind]?.split(' — ')[0] ?? kind} — already in your Sea Log`;
      return;
    }
    this.scanT += dt;
    el.textContent = `logging… ${'▮'.repeat(Math.round(this.scanT * 8))}`;
    if (this.scanT > 1.2) {
      log[kind] = Date.now();
      try {
        localStorage.setItem(LOG, JSON.stringify(log));
      } catch {}
      this.scanT = 0;
      this.#chime();
      const n = Object.keys(log).length;
      g.hud.toast(`SEA LOG ${n}/${Object.keys(SEA_LIFE).length}: ${SEA_LIFE[kind]}`, 6000);
      if (n === Object.keys(SEA_LIFE).length) setTimeout(() => g.hud.toast('Sea Log complete! The dive shop has a little something for you.', 5000), 3000);
    }
  }

  // ---- sound --------------------------------------------------------------------------------

  #ambience(on) {
    const g = this.game;
    const ctx = g.audio.ctx;
    if (on && !this.amb) {
      this.amb = g.audio.noiseSource(true);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      this.ambG = ctx.createGain();
      this.ambG.gain.value = 0.35;
      this.amb.connect(lp).connect(this.ambG).connect(g.audio.master);
      this.amb.start();
      this.musicVol = g.music.volume;
      g.music.volume = this.musicVol * 0.35;
    } else if (!on && this.amb) {
      this.amb.stop();
      this.amb = null;
      if (this.musicVol != null) g.music.volume = this.musicVol;
    }
  }

  #bubbles() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    for (let k = 0; k < 6; k++) {
      const o = ctx.createOscillator();
      const f = 300 + Math.random() * 500;
      o.frequency.setValueAtTime(f, t + k * 0.06);
      o.frequency.exponentialRampToValueAtTime(f * 2.2, t + k * 0.06 + 0.05);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.05, t + k * 0.06);
      e.gain.exponentialRampToValueAtTime(0.001, t + k * 0.06 + 0.06);
      o.connect(e).connect(this.game.audio.master);
      o.start(t + k * 0.06);
      o.stop(t + k * 0.06 + 0.07);
    }
  }

  #song(dist) {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const v = Math.min(0.12, 10 / (20 + dist));
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f0 = 180 + Math.random() * 220;
      const t0 = t + k * 1.6;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.linearRampToValueAtTime(f0 * (Math.random() < 0.5 ? 1.6 : 0.6), t0 + 1.3);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t0);
      e.gain.linearRampToValueAtTime(v, t0 + 0.4);
      e.gain.linearRampToValueAtTime(0, t0 + 1.5);
      const d = ctx.createDelay(1);
      d.delayTime.value = 0.35;
      const fb = ctx.createGain();
      fb.gain.value = 0.45;
      o.connect(e);
      e.connect(this.game.audio.master);
      e.connect(d);
      d.connect(fb).connect(d);
      d.connect(this.game.audio.master);
      o.start(t0);
      o.stop(t0 + 1.6);
      setTimeout(() => d.disconnect(), 6000);
    }
  }

  #bell() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    for (const [f, v] of [[220, 0.2], [440, 0.08], [660, 0.05], [553, 0.04]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const e = ctx.createGain();
      e.gain.setValueAtTime(v, t);
      e.gain.exponentialRampToValueAtTime(0.0005, t + 4);
      o.connect(e).connect(this.game.audio.master);
      o.start(t);
      o.stop(t + 4.1);
    }
    this.game.hud.toast('Dong… dong… The sound goes on for a long time down here.', 3000);
  }

  #chime() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    [880, 1320].forEach((f, k) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.08, t + k * 0.1);
      e.gain.exponentialRampToValueAtTime(0.001, t + k * 0.1 + 0.6);
      o.connect(e).connect(this.game.audio.master);
      o.start(t + k * 0.1);
      o.stop(t + k * 0.1 + 0.7);
    });
  }
}

export function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG) ?? '{}');
  } catch {
    return {};
  }
}

function noise2(x, z) {
  const s = Math.sin(x * 1.7 + Math.sin(z * 1.3)) * Math.cos(z * 1.1 + Math.sin(x * 0.7));
  return s;
}
function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _p = new THREE.Vector3();
const _b = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _seg = new THREE.Line3(new THREE.Vector3(), new THREE.Vector3());
