import * as THREE from 'three';
import { texture } from '../core/Procedural.js';

/**
 * Props
 * -----
 * `prop(scene, key)` returns a GLB from /src/assets/models when one was
 * provided (see manifest.js), otherwise a hand-built low-poly stand-in made of
 * a few boxes/cylinders. Every builder:
 *  - sits on y = 0, centred on X/Z, faces +Z
 *  - uses PSX materials (vertex snapping, affine textures, gouraud lighting)
 *  - may expose handles on `group.userData` (e.g. a screen material to toggle)
 */
export function prop(scene, key, opts = {}) {
  const fromFile = scene.assets.model(key);
  if (fromFile) return fromFile;
  const builder = BUILDERS[key] ?? BUILDERS[ALIASES[key]];
  // Pure decoration with no stand-in (rug, plant...) just doesn't appear.
  const g = builder ? builder(new Kit(scene), opts) : new THREE.Group();
  g.name = key;
  return g;
}

/** Newer model ids that can fall back to an older procedural builder. */
const ALIASES = {
  shelf_boxes: 'shelf',
  shelf_bags: 'shelf',
  freezers_standing: 'fridge_case',
  clerk: 'person',
  kitchen_cabinet: 'kitchen_counter',
  kitchen_sink: 'kitchen_counter',
  tree_pine2: 'tree_pine',
  rock2: 'rock',
  chips_bag: 'candy_bar',
};

/** Tiny helper bundle so builders stay short. */
class Kit {
  constructor(scene) {
    this.scene = scene;
    this.r = scene.r;
    this.assets = scene.assets;
  }
  mat(opts) {
    return this.r.material(opts);
  }
  tex(key, rx = 1, ry = rx) {
    return texture(this.assets, key, rx, ry);
  }
  /** Box mesh positioned by its centre. */
  box(w, h, d, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    return m;
  }
  cyl(rTop, rBot, h, seg, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), material);
    m.position.set(x, y, z);
    return m;
  }
  group(...children) {
    const g = new THREE.Group();
    children.forEach((c) => g.add(c));
    return g;
  }
}

const BUILDERS = {
  // ---------------------------------------------------------------- house ---
  microwave(k) {
    const body = k.mat({ color: 0x2a2a2e });
    const g = k.group(k.box(0.5, 0.3, 0.36, body, 0, 0.15, 0));
    // Door window — swapped between dark and glowing when running.
    const windowOff = k.mat({ color: 0x15130f });
    const windowOn = k.mat({ color: 0xffd890, unlit: true });
    const win = k.box(0.3, 0.2, 0.01, windowOff, -0.06, 0.15, 0.181);
    g.add(win);
    g.add(k.box(0.1, 0.24, 0.01, k.mat({ color: 0x4a4a52 }), 0.18, 0.15, 0.181));
    const display = k.box(0.07, 0.025, 0.012, k.mat({ color: 0x40e0ff, unlit: true }), 0.18, 0.24, 0.182);
    g.add(display);
    // Turntable with a plate inside (visible through the lit window).
    g.userData = { window: win, windowOn, windowOff };
    return g;
  },

  laptop(k) {
    const shell = k.mat({ color: 0x8a8a92 });
    const base = k.box(0.36, 0.02, 0.25, shell, 0, 0.01, 0);
    const keys = k.box(0.3, 0.004, 0.12, k.mat({ color: 0x2a2a30 }), 0, 0.022, -0.03);
    const pad = k.box(0.08, 0.003, 0.05, k.mat({ color: 0x3a3a40 }), 0, 0.022, 0.08);
    const lid = new THREE.Group();
    lid.position.set(0, 0.02, -0.125);
    lid.rotation.x = -0.25;
    lid.add(k.box(0.36, 0.24, 0.012, shell, 0, 0.12, 0));
    const screenMat = k.mat({ map: k.tex('screen_desktop'), unlit: true });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2, 4, 3), screenMat);
    screen.position.set(0, 0.125, 0.007);
    lid.add(screen);
    const g = k.group(base, keys, pad, lid);
    g.userData = { screen };
    return g;
  },

  crt_tv(k) {
    const body = k.mat({ color: 0x2c2a28 });
    const g = k.group(k.box(0.55, 0.45, 0.45, body, 0, 0.225, 0));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), k.mat({ map: k.tex('tv_static'), unlit: true }));
    screen.position.set(-0.03, 0.235, 0.226);
    g.add(screen);
    g.userData = { screen };
    return g;
  },

  bed(k) {
    const wood = k.mat({ map: k.tex('wood_floor', 0.5) });
    const sheet = k.mat({ color: 0xb8b0a0 });
    const blanket = k.mat({ map: k.tex('fabric', 2) });
    return k.group(
      k.box(1.5, 0.3, 2.0, wood, 0, 0.15, 0),
      k.box(1.4, 0.18, 1.9, sheet, 0, 0.39, 0),
      k.box(1.45, 0.06, 1.25, blanket, 0, 0.5, 0.3),
      k.box(0.6, 0.1, 0.35, sheet, -0.35, 0.53, -0.7),
      k.box(0.6, 0.1, 0.35, sheet, 0.35, 0.53, -0.7),
      k.box(1.5, 0.8, 0.08, wood, 0, 0.4, -1.0),
    );
  },

  lamp_floor(k) {
    const metal = k.mat({ color: 0x2a2a2a });
    const shade = k.mat({ color: 0xe8d0a0, unlit: true, doubleSide: true });
    const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.26, 8, 1, true), shade);
    shadeMesh.position.y = 1.42;
    const g = k.group(
      k.cyl(0.16, 0.18, 0.03, 8, metal, 0, 0.015, 0),
      k.cyl(0.015, 0.015, 1.3, 5, metal, 0, 0.67, 0),
      shadeMesh,
    );
    g.userData = { shade: shadeMesh, shadeOn: shade, shadeOff: k.mat({ color: 0x6a5a40, doubleSide: true }) };
    return g;
  },

  desk(k) {
    const top = k.mat({ map: k.tex('wood_floor', 0.6) });
    const leg = k.mat({ color: 0x1e1a16 });
    return k.group(
      k.box(1.4, 0.04, 0.7, top, 0, 0.74, 0),
      k.box(0.04, 0.72, 0.65, leg, -0.66, 0.36, 0),
      k.box(0.04, 0.72, 0.65, leg, 0.66, 0.36, 0),
      k.box(1.3, 0.3, 0.02, leg, 0, 0.55, -0.32),
    );
  },

  fridge(k) {
    const white = k.mat({ color: 0xc8c4b8 });
    const handle = k.mat({ color: 0x777777 });
    return k.group(
      k.box(0.75, 1.8, 0.7, white, 0, 0.9, 0),
      k.box(0.74, 0.01, 0.02, k.mat({ color: 0x55524a }), 0, 1.22, 0.351),
      k.box(0.03, 0.35, 0.04, handle, 0.3, 1.45, 0.37),
      k.box(0.03, 0.5, 0.04, handle, 0.3, 0.85, 0.37),
    );
  },

  kitchen_counter(k, { length = 2.4 } = {}) {
    const cab = k.mat({ map: k.tex('wood_floor', length / 2, 0.5), color: 0xb09080 });
    const top = k.mat({ map: k.tex('counter_tile', length * 2, 1.2) });
    const g = k.group(k.box(length, 0.86, 0.6, cab, 0, 0.43, 0), k.box(length + 0.04, 0.05, 0.64, top, 0, 0.885, 0.01));
    const doorMat = k.mat({ color: 0x3a2a1e });
    for (let x = -length / 2 + 0.3; x < length / 2; x += 0.6) g.add(k.box(0.5, 0.6, 0.01, doorMat, x, 0.42, 0.305));
    return g;
  },

  couch(k) {
    const f = k.mat({ map: k.tex('fabric', 2) });
    return k.group(
      k.box(2.0, 0.42, 0.85, f, 0, 0.21, 0),
      k.box(2.0, 0.5, 0.2, f, 0, 0.62, -0.33),
      k.box(0.2, 0.3, 0.85, f, -0.9, 0.55, 0),
      k.box(0.2, 0.3, 0.85, f, 0.9, 0.55, 0),
    );
  },

  /** The tall hi-fi rack from reference #1. */
  stereo(k) {
    const g = k.group(k.box(0.5, 1.1, 0.4, k.mat({ color: 0x18181c }), 0, 0.55, 0));
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 1.04), k.mat({ map: k.tex('stereo_front'), unlit: true, color: 0xa0a0a0 }));
    front.position.set(0, 0.55, 0.201);
    g.add(front);
    return g;
  },

  chair(k) {
    const m = k.mat({ color: 0x2a2630 });
    return k.group(
      k.box(0.45, 0.06, 0.45, m, 0, 0.46, 0),
      k.box(0.45, 0.5, 0.05, m, 0, 0.74, -0.2),
      k.cyl(0.03, 0.03, 0.42, 5, m, 0, 0.22, 0),
      k.cyl(0.22, 0.22, 0.03, 5, m, 0, 0.02, 0),
    );
  },

  // -------------------------------------------------------------- grocery ---
  /** Double-sided gondola shelf, 4 m long, products on both faces. */
  shelf(k) {
    const frame = k.mat({ color: 0x8a8c90 });
    const goods = k.mat({ map: k.tex('products', 4, 2) });
    const g = k.group(k.box(4, 1.7, 0.1, frame, 0, 0.85, 0), k.box(4.04, 0.08, 0.04, frame, 0, 1.72, 0));
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) g.add(k.box(4, 0.03, 0.42, frame, 0, 0.15 + i * 0.42, side * 0.26));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3.96, 1.6, 4, 2), goods);
      face.position.set(0, 0.92, side * 0.4);
      if (side < 0) face.rotation.y = Math.PI;
      g.add(face);
    }
    g.add(k.box(4, 0.12, 0.9, frame, 0, 0.06, 0));
    return g;
  },

  checkout_counter(k) {
    const body = k.mat({ color: 0x5a3028 });
    const top = k.mat({ color: 0x9a9890 });
    const g = k.group(k.box(2.4, 0.95, 0.8, body, 0, 0.475, 0), k.box(2.44, 0.04, 0.84, top, 0, 0.97, 0));
    // cash register
    g.add(k.box(0.4, 0.2, 0.35, k.mat({ color: 0x2e2e32 }), 0.7, 1.09, -0.1));
    g.add(k.box(0.3, 0.12, 0.04, k.mat({ color: 0x50ff70, unlit: true }), 0.7, 1.25, -0.2));
    // impulse-buy rack of smokes behind
    g.add(k.box(1.2, 0.7, 0.25, k.mat({ map: k.tex('products', 2, 1) }), -0.4, 1.8, -0.7));
    return g;
  },

  fridge_case(k) {
    const frame = k.mat({ color: 0xb8bcc0 });
    const glow = k.mat({ map: k.tex('fridge_drinks', 2, 2), unlit: true });
    const g = k.group(k.box(2.4, 2.1, 0.8, frame, 0, 1.05, 0));
    const front = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8, 2, 2), glow);
    front.position.set(0, 1.05, 0.401);
    g.add(front);
    for (const x of [-0.37, 0.37]) g.add(k.box(0.04, 1.8, 0.02, frame, x, 1.05, 0.41));
    return g;
  },

  basket(k) {
    const red = k.mat({ color: 0xb02020 });
    return k.group(k.box(0.5, 0.22, 0.32, red, 0, 0.11, 0), k.box(0.02, 0.15, 0.3, red, 0, 0.3, 0));
  },

  shopping_cart(k) {
    const m = k.mat({ color: 0x9a9aa0 });
    return k.group(k.box(0.9, 0.45, 0.55, m, 0, 0.75, 0), k.box(0.9, 0.03, 0.5, m, 0, 0.15, 0), k.box(0.03, 0.9, 0.03, m, 0.45, 0.5, 0));
  },

  person(k, { shirt = 0x8a2a24 } = {}) {
    const skin = k.mat({ color: 0xc09070 });
    const cloth = k.mat({ color: shirt });
    const pants = k.mat({ color: 0x22222a });
    return k.group(
      k.box(0.2, 0.8, 0.22, pants, -0.12, 0.4, 0),
      k.box(0.2, 0.8, 0.22, pants, 0.12, 0.4, 0),
      k.box(0.5, 0.62, 0.28, cloth, 0, 1.12, 0),
      k.box(0.13, 0.6, 0.16, cloth, -0.32, 1.12, 0),
      k.box(0.13, 0.6, 0.16, cloth, 0.32, 1.12, 0),
      k.box(0.26, 0.28, 0.26, skin, 0, 1.6, 0),
      k.box(0.28, 0.08, 0.28, k.mat({ color: 0x2a1a10 }), 0, 1.76, 0),
    );
  },

  // -------------------------------------------------------------- vehicle ---
  /** Old blue pickup, ~5.2 m long, facing +Z. ~250 triangles. */
  pickup_truck(k) {
    const paint = k.mat({ map: k.tex('truck_paint', 2) });
    const dark = k.mat({ color: 0x141416 });
    const chrome = k.mat({ color: 0x9a9a9a });
    const glass = k.mat({ color: 0x1a2430 });
    const g = new THREE.Group();
    // chassis + body
    g.add(k.box(1.9, 0.5, 5.0, paint, 0, 0.75, 0)); // lower body
    g.add(k.box(1.88, 0.35, 1.7, paint, 0, 1.15, 1.55)); // hood
    g.add(k.box(1.86, 0.85, 1.4, paint, 0, 1.42, 0.1)); // cab
    g.add(k.box(1.7, 0.5, 0.02, glass, 0, 1.55, 0.81)); // windshield
    g.add(k.box(1.7, 0.4, 0.02, glass, 0, 1.55, -0.61)); // rear window
    g.add(k.box(0.02, 0.45, 1.1, glass, 0.94, 1.55, 0.1));
    g.add(k.box(0.02, 0.45, 1.1, glass, -0.94, 1.55, 0.1));
    // bed walls
    g.add(k.box(0.1, 0.45, 2.1, paint, 0.9, 1.2, -1.45));
    g.add(k.box(0.1, 0.45, 2.1, paint, -0.9, 1.2, -1.45));
    g.add(k.box(1.9, 0.45, 0.1, paint, 0, 1.2, -2.45));
    g.add(k.box(1.7, 0.05, 2.0, dark, 0, 1.0, -1.45));
    // bumpers + grille
    g.add(k.box(2.0, 0.18, 0.15, chrome, 0, 0.62, 2.55));
    g.add(k.box(2.0, 0.18, 0.15, chrome, 0, 0.62, -2.55));
    g.add(k.box(1.2, 0.3, 0.03, dark, 0, 1.0, 2.505));
    // lights
    const headOn = k.mat({ color: 0xfff4c8, unlit: true });
    const headOff = k.mat({ color: 0x8a8670 });
    const hl = [k.box(0.3, 0.2, 0.04, headOn, 0.72, 1.0, 2.51), k.box(0.3, 0.2, 0.04, headOn, -0.72, 1.0, 2.51)];
    hl.forEach((m) => g.add(m));
    const tail = k.mat({ color: 0xc01818, unlit: true });
    g.add(k.box(0.15, 0.25, 0.04, tail, 0.85, 1.1, -2.51));
    g.add(k.box(0.15, 0.25, 0.04, tail, -0.85, 1.1, -2.51));
    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 8);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheels = [];
    for (const [x, z] of [[0.92, 1.6], [-0.92, 1.6], [0.92, -1.6], [-0.92, -1.6]]) {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.position.set(x, 0.42, z);
      g.add(w);
      wheels.push(w);
    }
    g.userData = { headlights: hl, headOn, headOff, wheels, procedural: true };
    return g;
  },

  // ---------------------------------------------------------------- nature ---
  tree_pine(k, { height = 7 } = {}) {
    const bark = k.mat({ map: k.tex('bark') });
    const needles = k.mat({ map: k.tex('pine', 2) });
    const g = k.group(k.cyl(0.15, 0.22, height * 0.35, 5, bark, 0, height * 0.175, 0));
    for (let i = 0; i < 3; i++) {
      const r = (1.6 - i * 0.4) * (height / 7);
      const h = height * 0.36;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), needles);
      cone.position.y = height * (0.38 + i * 0.2);
      g.add(cone);
    }
    return g;
  },

  tree_oak(k) {
    const bark = k.mat({ map: k.tex('bark') });
    const leaves = k.mat({ map: k.tex('pine', 2), color: 0xa0b080 });
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 0), leaves);
    crown.position.y = 4;
    crown.scale.y = 0.8;
    return k.group(k.cyl(0.2, 0.3, 3.4, 5, bark, 0, 1.7, 0), crown);
  },

  rock(k) {
    const geo = new THREE.DodecahedronGeometry(0.8, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, pos.getX(i) * (0.85 + Math.sin(i * 12.9) * 0.15), pos.getY(i) * 0.6, pos.getZ(i));
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, k.mat({ map: k.tex('rock') }));
    m.position.y = 0.3;
    return k.group(m);
  },

  fish(k, { color = 0x7a8a60 } = {}) {
    const m = k.mat({ color });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), m);
    body.scale.set(0.6, 0.9, 2.2);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 4), m);
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -0.26;
    const g = k.group(body, tail);
    g.children.forEach((c) => (c.position.y += 0.1));
    return g;
  },

  streetlight(k) {
    const metal = k.mat({ color: 0x3a3a40 });
    const bulb = k.mat({ color: 0xffd8a0, unlit: true });
    const g = k.group(
      k.cyl(0.08, 0.12, 6, 5, metal, 0, 3, 0),
      k.box(0.1, 0.1, 1.6, metal, 0, 5.95, 0.75),
      k.box(0.4, 0.15, 0.6, metal, 0, 5.9, 1.5),
      k.box(0.3, 0.04, 0.45, bulb, 0, 5.81, 1.5),
    );
    g.userData = { bulb: g.children[3], bulbOn: bulb, bulbOff: k.mat({ color: 0x404040 }) };
    return g;
  },

  // ----------------------------------------------------------------- props ---
  beer_can(k) {
    const label = k.mat({ map: k.tex('label_beer') });
    const metal = k.mat({ color: 0xb0b0b4 });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8), [label, metal, metal]);
    can.position.y = 0.06;
    return k.group(can);
  },

  beer_bottle(k) {
    const glass = k.mat({ color: 0x5a2e10 });
    const label = k.mat({ map: k.tex('label_beer') });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.15, 8), [label, glass, glass]);
    body.position.y = 0.075;
    return k.group(body, k.cyl(0.012, 0.03, 0.06, 6, glass, 0, 0.18, 0), k.cyl(0.013, 0.013, 0.03, 6, glass, 0, 0.225, 0));
  },

  energy_drink(k) {
    const label = k.mat({ map: k.tex('label_energy') });
    const metal = k.mat({ color: 0xb8b8c0 });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.14, 8), [label, metal, metal]);
    can.position.y = 0.07;
    return k.group(can);
  },

  soda_can(k) {
    const label = k.mat({ map: k.tex('label_soda') });
    const metal = k.mat({ color: 0xb0b0b4 });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8), [label, metal, metal]);
    can.position.y = 0.06;
    return k.group(can);
  },

  cigarette_pack(k) {
    const m = k.mat({ map: k.tex('label_cigs') });
    return k.group(k.box(0.055, 0.085, 0.022, m, 0, 0.0425, 0));
  },

  ashtray(k) {
    const glass = k.mat({ color: 0x9a9aa8 });
    const ash = k.mat({ color: 0x3a3a3a });
    const butt = k.mat({ color: 0xd8a050 });
    const g = k.group(k.cyl(0.08, 0.07, 0.03, 8, glass, 0, 0.015, 0), k.cyl(0.06, 0.06, 0.005, 8, ash, 0, 0.031, 0));
    for (let i = 0; i < 3; i++) {
      const c = k.box(0.05, 0.01, 0.01, butt, Math.cos(i * 2.1) * 0.03, 0.04, Math.sin(i * 2.1) * 0.03);
      c.rotation.y = i * 1.3;
      g.add(c);
    }
    return g;
  },

  fishing_rod(k) {
    const rod = k.mat({ color: 0x8a7a5a });
    const cork = k.mat({ color: 0xa08050 });
    const reel = k.mat({ color: 0x8a8a90 });
    // Lies along +Z (tip at +Z) so it works as a held viewmodel too.
    const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.014, 2.0, 4), rod);
    blank.rotation.x = Math.PI / 2;
    blank.position.set(0, 0.03, 0.2);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.35, 5), cork);
    grip.rotation.x = Math.PI / 2;
    grip.position.set(0, 0.03, -0.75);
    const r = k.box(0.05, 0.05, 0.06, reel, 0, -0.01, -0.6);
    const g = k.group(blank, grip, r);
    g.userData.tip = new THREE.Vector3(0, 0.03, 1.2);
    return g;
  },

  candy_bar(k) {
    const wrap = k.mat({ color: 0x7a2a1a });
    return k.group(k.box(0.12, 0.018, 0.04, wrap, 0, 0.009, 0), k.box(0.03, 0.019, 0.041, k.mat({ color: 0xe8d070 }), -0.03, 0.009, 0));
  },

  pizza(k) {
    const slice = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.015, 3, 1, false, 0, Math.PI / 4),
      k.mat({ map: k.tex('pizza') }),
    );
    slice.position.y = 0.025;
    const plate = k.cyl(0.13, 0.11, 0.015, 8, k.mat({ color: 0xd8d4c8 }), 0.05, 0.008, 0.04);
    return k.group(plate, slice);
  },
};
