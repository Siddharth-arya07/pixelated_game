import * as THREE from 'three';
import { signTexture } from '../core/Procedural.js';
import { addSeat } from './Devices.js';

/**
 * MainStreet — the rest of Pine Hollow
 * ------------------------------------
 * Shops and civic buildings line the town road between your house and the
 * junction; a plaza with a gazebo and a fountain sits in the middle; houses
 * line the road west of yours. Everything is placed along the actual road,
 * facing it, and skips any lot that would overlap something already built
 * (and registers its footprint so the forest doesn't grow through it).
 *
 * At 3 a.m. most of it is shut — dark windows, CLOSED signs — except the
 * 24-hour laundromat (sit and watch the dryers), the library's night book
 * drop, the post box, and the town hall clock, which keeps the game's time.
 */
const SHOPS = [
  { name: 'HOLLOW HARDWARE', col: 0x8a3a2a, w: 11, d: 9, h: 5, signBg: '#1a1a1a', signFg: '#f0c040' },
  { name: 'POST OFFICE', col: 0xe8e4d8, w: 10, d: 8, h: 5, signBg: '#1a2a5a', signFg: '#ffffff', kind: 'post' },
  { name: 'ROSA’S BAKERY', col: 0xf0b8c8, w: 9, d: 8, h: 4.5, signBg: '#ffffff', signFg: '#c0406a', awning: 0xffffff },
  { name: 'LAUNDROMAT · 24 HRS', col: 0x6a9ac8, w: 10, d: 9, h: 4.5, signBg: '#0a2a4a', signFg: '#8af0ff', open: true, kind: 'laundry' },
  { name: 'PUBLIC LIBRARY', col: 0xa8a8a0, w: 13, d: 10, h: 6, signBg: '#2a2a2a', signFg: '#e8e0c8', kind: 'library', columns: true },
  { name: 'BARBER', col: 0xf0ece0, w: 7, d: 7, h: 4, signBg: '#ffffff', signFg: '#2a2a8a', kind: 'barber' },
  { name: 'PINE HOLLOW GAZETTE', col: 0x5a6a5a, w: 10, d: 9, h: 5.5, signBg: '#f0e8d0', signFg: '#1a1a1a' },
  { name: 'TOWN HALL', col: 0xd8c8a8, w: 15, d: 11, h: 7, signBg: '#3a2a1a', signFg: '#f0d890', kind: 'hall', columns: true },
  { name: 'FIRE STATION No. 1', col: 0xb02a20, w: 13, d: 11, h: 6, signBg: '#ffffff', signFg: '#b02a20', kind: 'fire' },
  { name: 'RECORDS & TAPES', col: 0x4a3a6a, w: 8, d: 8, h: 4.5, signBg: '#1a1020', signFg: '#ff80d0', awning: 0xff80d0 },
  { name: 'CAFÉ MOONLIGHT', col: 0x3a5a6a, w: 9, d: 8, h: 4.5, signBg: '#1a2030', signFg: '#ffe8a0', awning: 0x2a3a4a },
  { name: 'ST. BRIGID’S', col: 0xf0f0e8, w: 10, d: 14, h: 6, signBg: '#ffffff', signFg: '#3a3a3a', kind: 'church' },
];
const HOUSE_COLS = [0xb8c8d8, 0xe0d0a0, 0xc8a8a0, 0xa8c0a0, 0xd8c0d0, 0xe8e0d0, 0x9aa8b8, 0xc0b090];

export function buildMainStreet(scene) {
  return new MainStreet(scene);
}

class MainStreet {
  constructor(scene) {
    this.s = scene;
    this.g = scene.game;
    this.roads = Object.fromEntries(scene.terrain.roads.map((r) => [r.name, r.samples]));
    this.footprints = scene.footprints();
    this.clocks = [];
    this.poles = [];
    // main street: shops from the bend to the junction, then on along the coast road
    this.samples = this.roads.town;
    let left = this.lots(-152, -44, SHOPS, true);
    this.samples = this.roads.coast;
    left = this.lots(-36, 70, left, true);
    this.#plaza();
    // houses: west of yours on the town road, out along the coast road, and up the valley road
    this.samples = this.roads.town;
    this.#houses(-330, -215);
    this.samples = this.roads.coast;
    this.#houses(70, 150);
    this.samples = this.roads.valley;
    this.#houses(-45, -15, 'z', 30, 120);
    scene.updaters.push((dt, t) => this.#tick(dt, t));
  }

  /** Point on the road nearest to x (or to z, for north–south roads), plus its tangent. */
  #roadAt(x, axis = 'x') {
    const S = this.samples;
    let best = 0;
    for (let i = 0; i < S.length; i++) if (Math.abs(S[i][axis] - x) < Math.abs(S[best][axis] - x)) best = i;
    const a = S[Math.max(0, best - 1)];
    const b = S[Math.min(S.length - 1, best + 1)];
    const t = new THREE.Vector2(b.x - a.x, b.z - a.z).normalize();
    return { p: S[best], t };
  }

  /** Does a rotated w×d footprint at (x,z) clear everything already built? */
  #free(x, z, w, d, yaw) {
    const r = Math.hypot(w, d) / 2 + 1;
    for (const f of this.footprints) {
      if (x + r < f.minX || x - r > f.maxX || z + r < f.minZ || z - r > f.maxZ) continue;
      return false;
    }
    const T = this.s.terrain;
    // stay off the roads and the rail line
    for (const [dx, dz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0]]) {
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      if (T.roadDistance(x + dx * c + dz * sn, z - dx * sn + dz * c) < 6) return false;
    }
    for (const p of Object.values(this.s.poi)) {
      if (!p.radius || p.name === 'house') continue;
      if (Math.hypot(x - p.x, z - p.z) < p.radius + r) return false;
    }
    if (Math.hypot(x - this.s.poi.house.x, z - this.s.poi.house.z) < 30) return false;
    return true;
  }

  #claim(x, z, w, d) {
    const r = Math.hypot(w, d) / 2 + 1.5;
    const f = { minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r };
    this.footprints.push(f);
    this.s.claimFootprint(f);
  }

  /** Walk along the road placing buildings on both sides. */
  lots(x0, x1, list, shops) {
    let i = 0;
    const placed = new Set();
    for (const side of [1, -1]) {
      for (let x = x0; x <= x1 && i < list.length; x += 4) {
        const b = list[i];
        const { p, t } = this.#roadAt(x);
        const nx = -t.y * side;
        const nz = t.x * side;
        const off = 4 + b.d / 2 + 3.5;
        const cx = p.x + nx * off;
        const cz = p.z + nz * off;
        const yaw = Math.atan2(-nx, -nz); // front (+Z local) faces the road
        if (!this.#free(cx, cz, b.w, b.d, yaw)) continue;
        if (shops) this.#shop(b, cx, cz, yaw);
        this.#claim(cx, cz, b.w, b.d);
        placed.add(b);
        if (b.kind === 'hall') this.plazaAt = new THREE.Vector3(p.x - nx * 14, 0, p.z - nz * 14);
        i++;
        x += b.w; // the next lot starts after this one
      }
    }
    return list.filter((b) => !placed.has(b));
  }

  // ---------------------------------------------------------------------------
  // Buildings
  // ---------------------------------------------------------------------------

  #base(cx, cz, w, d, yaw) {
    const s = this.s;
    let y = Infinity;
    for (const [dx, dz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      y = Math.min(y, s.groundHeight(cx + dx * c + dz * sn, cz - dx * sn + dz * c));
    }
    return y;
  }

  #shop(b, cx, cz, yaw) {
    const s = this.s;
    const g = this.g;
    const y = this.#base(cx, cz, b.w, b.d, yaw);
    const grp = new THREE.Group();
    grp.position.set(cx, y, cz);
    grp.rotation.y = yaw;
    s.root.add(grp);
    const wall = s.mat({ map: s.tex(b.kind === 'library' || b.kind === 'hall' ? 'brick' : 'siding', b.w / 3, b.h / 2), color: b.col });
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h + 3, b.d), wall);
    body.position.y = (b.h + 3) / 2 - 3; // a foundation that reaches into the slope
    grp.add(body);
    // roof
    if (b.kind === 'church') {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(b.w * 0.75, 3.5, 4), s.mat({ color: 0x5a5a62 }));
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = b.d / b.w;
      roof.position.y = b.h + 1.75;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5, 2.4), wall);
      tower.position.set(0, b.h + 2.5, b.d / 2 - 1.2);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(1.8, 5, 4), s.mat({ color: 0x5a5a62 }));
      spire.rotation.y = Math.PI / 4;
      spire.position.set(0, b.h + 7.5, b.d / 2 - 1.2);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), s.mat({ color: 0xd8c070 }));
      cross.position.set(0, b.h + 10.6, b.d / 2 - 1.2);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.15), cross.material);
      arm.position.set(0, b.h + 10.8, b.d / 2 - 1.2);
      grp.add(roof, tower, spire, cross, arm);
      const glass = s.mat({ color: 0xc8a0ff, unlit: true, opacity: 0.85 });
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), glass);
        w.position.set(sx * (b.w / 2 + 0.02), b.h * 0.5, -b.d / 2 + 3 + k * 4);
        w.rotation.y = sx * Math.PI / 2;
        grp.add(w);
      }
    } else {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.6, b.d + 0.3), s.mat({ color: 0x3a3a3e }));
      parapet.position.y = b.h + 0.3;
      grp.add(parapet);
    }
    // door + windows on the front
    const dark = s.mat({ color: 0x1a2028, unlit: true });
    const lit = s.mat({ color: 0xffd890, unlit: true });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.3), s.mat({ color: b.kind === 'fire' ? 0x8a1a10 : 0x3a2a20 }));
    door.position.set(0, 1.15, b.d / 2 + 0.02);
    grp.add(door);
    if (b.kind === 'fire') {
      for (const dx of [-3.2, 3.2]) {
        const bay = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), s.mat({ color: 0xd8d8d8 }));
        bay.position.set(dx, 1.8, b.d / 2 + 0.03);
        grp.add(bay);
      }
    } else {
      const winMat = b.open ? lit : dark;
      for (const dx of [-b.w / 2 + 1.8, b.w / 2 - 1.8]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), winMat);
        w.position.set(dx, 1.5, b.d / 2 + 0.02);
        grp.add(w);
      }
      if (b.h > 5) for (let k = 0; k < 3; k++) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), Math.random() < 0.15 ? lit : dark);
        w.position.set(-b.w / 3 + k * (b.w / 3), b.h - 1.6, b.d / 2 + 0.02);
        grp.add(w);
      }
    }
    // sign + awning
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(b.w - 1, 7), 0.9), s.mat({ map: signTexture([b.name], { bg: b.signBg, fg: b.signFg, w: 192, h: 28 }), unlit: !!b.open }));
    sign.position.set(0, Math.min(b.h - 0.8, 3.4), b.d / 2 + 0.05);
    grp.add(sign);
    if (b.awning) {
      const aw = new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.6, 0.08, 1.4), s.mat({ color: b.awning }));
      aw.position.set(0, 2.7, b.d / 2 + 0.7);
      aw.rotation.x = 0.25;
      grp.add(aw);
    }
    if (!b.open) {
      const closed = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.25), s.mat({ map: signTexture(['CLOSED'], { bg: '#f0e8d8', fg: '#a02020', w: 48, h: 16 }) }));
      closed.position.set(0.2, 1.6, b.d / 2 + 0.04);
      grp.add(closed);
    }
    if (b.columns) for (const dx of [-b.w / 2 + 1, -1.5, 1.5, b.w / 2 - 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, b.h, 8), s.mat({ color: 0xf0ece0 }));
      col.position.set(dx, b.h / 2, b.d / 2 + 0.8);
      grp.add(col);
    }
    // collision for the whole block
    grp.updateMatrixWorld(true);
    s.addColliderBox(cx, y + b.h / 2, cz, b.w, b.h + 6, b.d, yaw);
    const front = (dx, dy, dz) => new THREE.Vector3(dx, dy, dz).applyMatrix4(grp.matrixWorld);
    // a porch light by the door
    const lp = front(1.2, 2.6, b.d / 2 + 0.4);
    s.addLight({ position: [lp.x, lp.y, lp.z], color: b.open ? 0xbfe8ff : 0xffc880, range: b.open ? 9 : 5, intensity: b.open ? 1.2 : 0.6 });

    // ---- little interactions ----
    if (b.kind === 'laundry') {
      // the dryers, through the window, turning
      for (let k = 0; k < 3; k++) {
        const dr = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), s.mat({ color: [0xff8ac0, 0x8ad0ff, 0xfff08a][k], unlit: true }));
        dr.position.set(-b.w / 2 + 1.0 + k * 0.6, 1.2, b.d / 2 + 0.03);
        grp.add(dr);
        this.poles.push({ m: dr, spin: 6 });
      }
      const bench = front(-1.5, 0, b.d / 2 + 1.4);
      const bm = s.box(1.6, 0.45, 0.5, s.mat({ color: 0x8a6a4a }), bench.x, bench.y + 0.22, bench.z, { rotY: yaw });
      addSeat(s, bm, { eye: [bench.x, bench.y + 1.1, bench.z], yaw: yaw + Math.PI, pitch: -0.05, yawLimit: 1.6, standAt: front(-1.5, 0, b.d / 2 + 2.6).toArray() }, 'Sit and watch the dryers spin');
    }
    if (b.kind === 'post') {
      const mb = front(-b.w / 2 - 0.8, 0, b.d / 2 + 0.8);
      const box = s.box(0.6, 1.1, 0.5, s.mat({ color: 0x2a4aa0 }), mb.x, mb.y + 0.55, mb.z, { rotY: yaw });
      s.addInteractable(box, {
        prompt: 'The post box',
        action: () => g.hud.toast(['Last collection: 5:30 p.m. You’re a little late.', 'Somebody left a stamp on top. You put it in your pocket for luck.', 'You whisper a letter into the slot to someone far away. It counts.'][Math.floor(Math.random() * 3)], 4000),
      });
    }
    if (b.kind === 'library') {
      const dp = front(b.w / 2 - 1.4, 0, b.d / 2 + 0.5);
      const drop = s.box(0.8, 1.1, 0.6, s.mat({ color: 0x4a4a52 }), dp.x, dp.y + 0.55, dp.z, { rotY: yaw });
      s.addInteractable(drop, {
        prompt: 'Night book drop',
        action: () => g.hud.toast(g.inventory.has('quantum_book') ? 'You consider returning “Small Things”. You decide to finish it first.' : 'A slot in the wall that says RETURNS. Somebody returned a book here at 3 a.m. too, once.', 4000),
      });
    }
    if (b.kind === 'barber') {
      const bp = front(b.w / 2 + 0.3, 1.6, b.d / 2);
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 64;
      const x = c.getContext('2d');
      for (let k = 0; k < 8; k++) {
        x.fillStyle = ['#ffffff', '#d02020', '#ffffff', '#2040c0'][k % 4];
        x.fillRect(0, k * 8, 16, 8);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapT = THREE.RepeatWrapping;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 10), s.mat({ map: tex, unlit: true }));
      pole.position.copy(bp);
      s.root.add(pole);
      this.poles.push({ m: pole, tex });
    }
    if (b.kind === 'hall') {
      // clock tower with a clock that keeps the game's time
      const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 3), wall);
      tower.position.set(0, b.h + 3, 0);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.5, 4), s.mat({ color: 0x3a5a4a }));
      cap.rotation.y = Math.PI / 4;
      cap.position.set(0, b.h + 7.2, 0);
      grp.add(tower, cap);
      const cc = document.createElement('canvas');
      cc.width = cc.height = 128;
      const tex = new THREE.CanvasTexture(cc);
      tex.userData.live = true;
      const face = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), s.mat({ map: tex, unlit: true, affine: 0 }));
      face.position.set(0, b.h + 4, 1.52);
      grp.add(face);
      this.clocks.push({ cc, tex });
      s.addLight({ position: front(0, b.h + 4, 3).toArray(), color: 0xfff0c8, range: 7, intensity: 0.7 });
      const plq = front(2.5, 1.5, b.d / 2 + 0.05);
      const plaque = s.box(0.6, 0.4, 0.05, s.mat({ color: 0xc8a050 }), plq.x, plq.y, plq.z, { collide: false, rotY: yaw });
      s.addInteractable(plaque, {
        prompt: 'Read the brass plaque',
        action: () => g.openUI(() => g.note.show('PINE HOLLOW\nFounded 1887 · Population 312\n\nA silver town, a fishing town, a lighthouse town.\n“Somebody always has a light on.”')),
      });
    }
  }

  /** Small houses with porches, fences and mailboxes, both sides of the road. */
  #houses(x0, x1, axis = 'x', z0, z1) {
    const s = this.s;
    let k = this.houseN ?? 0;
    const from = axis === 'x' ? x0 : z0;
    const to = axis === 'x' ? x1 : z1;
    for (const side of [1, -1]) {
      for (let x = from; x <= to; x += 4) {
        const { p, t } = this.#roadAt(x, axis);
        const nx = -t.y * side;
        const nz = t.x * side;
        const w = 7 + (k % 3);
        const d = 7;
        const off = 4 + d / 2 + 6;
        const cx = p.x + nx * off;
        const cz = p.z + nz * off;
        const yaw = Math.atan2(-nx, -nz);
        if (!this.#free(cx, cz, w + 2, d + 2, yaw)) continue;
        this.#house(cx, cz, yaw, w, d, HOUSE_COLS[k % HOUSE_COLS.length], k);
        this.#claim(cx, cz, w + 2, d + 2);
        k++;
        x += w + 4;
      }
    }
    this.houseN = k;
  }

  #house(cx, cz, yaw, w, d, col, k) {
    const s = this.s;
    const y = this.#base(cx, cz, w, d, yaw);
    const grp = new THREE.Group();
    grp.position.set(cx, y, cz);
    grp.rotation.y = yaw;
    s.root.add(grp);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), s.mat({ map: s.tex('siding', w / 3, 1.5), color: col }));
    body.position.y = 0;
    grp.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.6, 2.2, 4), s.mat({ color: [0x3a2a24, 0x2a3a4a, 0x4a3a2a][k % 3] }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = d / w;
    roof.position.y = 4.1;
    grp.add(roof);
    const lit = Math.random() < 0.3;
    const win = s.mat({ color: lit ? 0xffd890 : 0x1a2028, unlit: true });
    for (const dx of [-w / 2 + 1.4, w / 2 - 1.4]) {
      const wm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), win);
      wm.position.set(dx, 1.7, d / 2 + 0.02);
      grp.add(wm);
    }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), s.mat({ color: [0x5a2a2a, 0x2a4a3a, 0x3a3a5a][k % 3] }));
    door.position.set(0, 1.05 - 0, d / 2 + 0.02);
    door.position.y = 1.05;
    grp.add(door);
    // porch + mailbox + a little fence
    const porch = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1.6), s.mat({ map: s.tex('planks', 1, 1) }));
    porch.position.set(0, 0.1, d / 2 + 0.8);
    grp.add(porch);
    const mb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.45), s.mat({ color: [0x2a4aa0, 0x2a2a2a, 0xa02a2a][k % 3] }));
    mb.position.set(w / 2 + 1, 1.1, d / 2 + 4);
    const mpost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1, 0.08), s.mat({ color: 0x5a4a3a }));
    mpost.position.set(w / 2 + 1, 0.5, d / 2 + 4);
    grp.add(mb, mpost);
    const fence = s.mat({ color: 0xf0ece0 });
    for (let f = -w / 2 - 1; f <= w / 2 + 1; f += 0.5) {
      if (Math.abs(f) < 1) continue;
      const pk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.05), fence);
      pk.position.set(f, 0.4, d / 2 + 4.6);
      grp.add(pk);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.06, 0.05), fence);
    rail.position.set(0, 0.6, d / 2 + 4.6);
    grp.add(rail);
    grp.updateMatrixWorld(true);
    s.addColliderBox(cx, y + 1.5, cz, w, 6, d, yaw);
    if (lit || k % 2 === 0) {
      const lp = new THREE.Vector3(0.8, 2.3, d / 2 + 0.5).applyMatrix4(grp.matrixWorld);
      s.addLight({ position: [lp.x, lp.y, lp.z], color: 0xffc070, range: 5, intensity: 0.6 });
    }
  }

  /** The town square: gazebo, fountain, benches, the welcome sign. */
  #plaza() {
    const s = this.s;
    const g = this.g;
    // the nearest open patch to the middle of main street
    let c = null;
    let bd = Infinity;
    const mid = this.plazaAt ?? new THREE.Vector3(-110, 0, 185);
    for (let x = -170; x <= -40; x += 6) {
      for (let z = 120; z <= 250; z += 6) {
        const d = Math.hypot(x - mid.x, z - mid.z);
        if (d < bd && this.#free(x, z, 17, 17, 0)) {
          bd = d;
          c = new THREE.Vector3(x, 0, z);
        }
      }
    }
    if (!c) return;
    const y = s.groundHeight(c.x, c.z);
    const stone = s.mat({ map: s.tex('checker_tiles', 4, 4), color: 0xb8b0a0 });
    const pave = new THREE.Mesh(new THREE.CircleGeometry(9, 24), stone);
    pave.rotation.x = -Math.PI / 2;
    pave.position.set(c.x, y + 0.06, c.z);
    s.root.add(pave);
    // fountain
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.7, 20, 1, true), s.mat({ color: 0xc8c0b0, doubleSide: true }));
    basin.position.set(c.x, y + 0.35, c.z);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.15, 20), s.mat({ map: s.tex('water', 2), color: 0x8ac8e0, scroll: [0.02, 0.01] }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(c.x, y + 0.6, c.z);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 1.6, 8), s.mat({ color: 0xc8c0b0 }));
    spout.position.set(c.x, y + 1.1, c.z);
    s.root.add(basin, water, spout);
    s.addColliderBox(c.x, y + 0.5, c.z, 4.6, 1, 4.6);
    s.addLight({ position: [c.x, y + 1.5, c.z], color: 0x9ad8ff, range: 6, intensity: 0.8 });
    this.spray = [];
    for (let k = 0; k < 24; k++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 3), s.mat({ color: 0xc8f0ff, unlit: true }));
      s.root.add(d);
      this.spray.push({ d, ph: k / 24, a: (k / 24) * Math.PI * 2, c: new THREE.Vector3(c.x, y + 1.9, c.z) });
    }
    s.addInteractable(water, {
      prompt: 'Toss a penny in the fountain',
      action: () => {
        if (!g.inventory.spend(0.01)) return;
        g.audio.oneShot('click', { volume: 0.3, rate: 2.4 });
        g.hud.toast('Plink. (The wishing well in the park is the serious one, but this counts too.)', 3000);
      },
    });
    // gazebo
    const gx = c.x + 6.5;
    const gz = c.z - 5;
    const white = s.mat({ color: 0xf4f0e8 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.4, 8), white);
    floor.position.set(gx, y + 0.2, gz);
    s.root.add(floor);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), white);
      post.position.set(gx + Math.cos(a) * 2.4, y + 1.7, gz + Math.sin(a) * 2.4);
      s.root.add(post);
    }
    const groof = new THREE.Mesh(new THREE.ConeGeometry(3.1, 1.6, 8), s.mat({ color: 0x3a5a4a }));
    groof.position.set(gx, y + 3.8, gz);
    s.root.add(groof);
    s.addColliderBox(gx, y + 0.2, gz, 5, 0.4, 5);
    s.addLight({ position: [gx, y + 2.8, gz], color: 0xffe0a0, range: 7, intensity: 0.8 });
    const gb = s.box(1.6, 0.45, 0.5, s.mat({ color: 0x8a6a4a }), gx, y + 0.62, gz - 1.6, { collide: false });
    addSeat(s, gb, { eye: [gx, y + 1.5, gz - 1.6], yaw: Math.PI, pitch: -0.05, yawLimit: 1.8, standAt: [gx, y + 0.4, gz] }, 'Sit in the gazebo');
    // benches round the fountain
    for (const a of [0.5, 2.6, 4.7]) {
      const bx = c.x + Math.cos(a) * 5;
      const bz = c.z + Math.sin(a) * 5;
      const by = s.groundHeight(bx, bz);
      const bench = s.box(1.6, 0.45, 0.5, s.mat({ color: 0x6a4a3a }), bx, by + 0.22, bz, { rotY: -a + Math.PI / 2 });
      const yaw = Math.atan2(bx - c.x, bz - c.z);
      addSeat(s, bench, { eye: [bx, by + 1.1, bz], yaw, pitch: -0.05, yawLimit: 1.6, standAt: [bx + Math.cos(a) * 1.2, by, bz + Math.sin(a) * 1.2] }, 'Sit on the bench');
    }
    // welcome sign
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6), s.mat({ map: signTexture(['WELCOME TO', 'PINE HOLLOW', 'POP. 312'], { bg: '#2a4a2a', fg: '#f0e8c8', w: 128, h: 64 }), doubleSide: true }));
    ws.position.set(c.x - 7, y + 2, c.z + 4);
    ws.rotation.y = 0.6;
    s.root.add(ws);
    this.#claim(c.x, c.z, 18, 18);
  }

  #tick(dt) {
    for (const p of this.poles) {
      if (p.tex) p.tex.offset.y -= dt * 0.6;
      else p.m.rotation.z += dt * p.spin;
    }
    // clock faces: keep the game time (refresh once a game minute)
    const m = Math.floor(this.g.dayNight.minutes);
    if (m !== this.lastM) {
      this.lastM = m;
      for (const c of this.clocks) drawClock(c.cc, m), (c.tex.needsUpdate = true);
    }
    for (const s of this.spray ?? []) {
      s.ph = (s.ph + dt * 0.8) % 1;
      const r = s.ph * 1.6;
      s.d.position.set(s.c.x + Math.cos(s.a) * r, s.c.y + Math.sin(s.ph * Math.PI) * 0.9 - s.ph * 1.2, s.c.z + Math.sin(s.a) * r);
    }
  }
}

function drawClock(c, minutes) {
  const x = c.getContext('2d');
  x.fillStyle = '#f4f0e0';
  x.beginPath();
  x.arc(64, 64, 62, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#2a2a2a';
  x.lineWidth = 4;
  x.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    x.fillStyle = '#2a2a2a';
    x.fillRect(64 + Math.sin(a) * 52 - 2, 64 - Math.cos(a) * 52 - 2, 4, 4);
  }
  const h = ((minutes / 60) % 12) / 12;
  const mm = (minutes % 60) / 60;
  const hand = (frac, len, w) => {
    const a = frac * Math.PI * 2;
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(64, 64);
    x.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len);
    x.stroke();
  };
  hand(h, 30, 6);
  hand(mm, 46, 3);
}
