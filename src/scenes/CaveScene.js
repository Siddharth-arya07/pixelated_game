import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { ORES } from '../systems/Mining.js';
import { signTexture } from '../core/Procedural.js';

/**
 * CaveScene — the Pine Hollow Silver Mine
 * ---------------------------------------
 * Cut into the foot of the mountain in 1891, worked out (mostly) by 1962.
 *
 *  LEVEL 1 (y = 0)
 *   - entrance adit: timber sets every few metres, rails, hanging lanterns
 *   - the hub cavern: Old Pete's assay office (sells picks + helmet, buys ore
 *     at the best price), a tool rack with an old pickaxe and a helmet, a
 *     notice board, the minecart station and the cage lift down
 *   - east drift → the copper chamber (coal, copper, iron)
 *   - west drift → the coal seam, half caved in (coal, iron, a little silver)
 *   - the minecart line → the deep vein (silver, gold) — ride the cart
 *  LEVEL 2 (y = -30), down the cage
 *   - lower station → the crystal grotto: glowing amethyst and emerald, an
 *     underground lake, glowing mushrooms, bats
 *   - → Walt's gold room: gold, and the odd diamond
 *
 * Walls are noise-displaced tubes and domes (inside-out), and collide.
 * Ore nodes break into items and grow back after a few minutes; breaking is
 * shared in multiplayer. Five pages of Walt's journal are scattered around.
 */
const L2 = -30;
export const FOSSILS = {
  ammonite: { name: 'Ammonite', desc: 'A coiled sea shell, 180 million years old. The whole valley was ocean once.' },
  trilobite: { name: 'Trilobite', desc: 'An ancient sea bug with three lobes. Older than the dinosaurs by a long way.' },
  fern: { name: 'Fern Leaf', desc: 'A perfect fern pressed into slate, every leaflet still there.' },
  fish: { name: 'Fossil Fish', desc: 'A little fish skeleton mid-swim, frozen in stone.' },
  tooth: { name: 'Dinosaur Tooth', desc: 'Serrated, the size of your thumb. Something big lost this.' },
  amber: { name: 'Amber with a Bug', desc: 'Golden tree resin with a tiny mosquito inside. Don’t get any ideas.' },
};

export class CaveScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Cave', label: 'the old mine' });
    this.indoor = { fog: 0x0a0806, near: 3, far: 30, ambient: 0x3a3228, daylight: 0 };
    this.nodes = [];
    this.nodeMeshes = [];
    this.bats = [];
    this.sparkList = [];
    this.killY = -100; // level 3 is 60 m down
  }

  build() {
    const g = this.game;
    this.rock = this.mat({ map: this.tex('rock', 2, 2), color: 0x8a7a68, doubleSide: true });
    this.rockDark = this.mat({ map: this.tex('rock', 2, 2), color: 0x5a4e44, doubleSide: true });
    this.timber = this.mat({ map: this.tex('planks', 1, 1), color: 0x7a5a3a });
    this.railMat = this.mat({ color: 0x5a5a60 });
    this.sleeperMat = this.mat({ color: 0x3a2a1c });

    // ---------------- LEVEL 1 ----------------
    const HUB = new THREE.Vector3(0, 0, -44);
    this.cavern(HUB, 13, 8, [new THREE.Vector3(0, 0, -31), new THREE.Vector3(13, 0, -44), new THREE.Vector3(-13, 0, -44), new THREE.Vector3(-4, 0, -57)]);
    this.tunnel([[0, 0, 2], [0, 0, -8], [0.6, 0, -18], [0, 0, -31]], 2.3, { timbers: true, rails: true, lanterns: 7 });
    // east drift + copper chamber
    const CU = new THREE.Vector3(48, 0, -36);
    this.tunnel([[13, 0, -44], [24, 0, -46], [34, 0, -42], [CU.x - 9, 0, CU.z]], 2.1, { timbers: true, lanterns: 9 });
    this.cavern(CU, 9, 6, [new THREE.Vector3(CU.x - 9, 0, CU.z)]);
    // west drift + coal seam (half collapsed)
    const COAL = new THREE.Vector3(-44, 0, -54);
    this.tunnel([[-13, 0, -44], [-24, 0, -47], [-33, 0, -52], [COAL.x + 8, 0, COAL.z]], 2.0, { timbers: true, lanterns: 10, broken: true });
    this.cavern(COAL, 8, 5, [new THREE.Vector3(COAL.x + 8, 0, COAL.z)]);
    // minecart line → deep vein
    const DEEP = new THREE.Vector3(42, 0, -104);
    const cartPts = [[-4, 0, -57], [-5, 0, -70], [-2, 0, -84], [10, 0, -96], [24, 0, -102], [DEEP.x - 10, 0, DEEP.z]];
    this.cartPath = this.tunnel(cartPts, 2.4, { timbers: true, rails: true, lanterns: 12 });
    this.cavern(DEEP, 10, 7, [new THREE.Vector3(DEEP.x - 10, 0, DEEP.z)]);

    // ---------------- LEVEL 2 ----------------
    const LOW = new THREE.Vector3(10, L2, -48);
    const GROT = new THREE.Vector3(12, L2, -86);
    const GOLD = new THREE.Vector3(-30, L2, -66);
    this.cavern(LOW, 8, 6, [new THREE.Vector3(10, L2, -56), new THREE.Vector3(2, L2, -48)]);
    this.tunnel([[10, L2, -56], [12, L2, -64], [11, L2, -72]], 2.2, { timbers: true, lanterns: 8 });
    this.cavern(GROT, 15, 11, [new THREE.Vector3(11, L2, -72), new THREE.Vector3(-3, L2, -84)]);
    this.tunnel([[2, L2, -48], [-8, L2, -52], [-18, L2, -60], [GOLD.x + 8, L2, GOLD.z]], 2.0, { timbers: true, lanterns: 9 });
    this.tunnel([[-3, L2, -84], [-14, L2, -80], [-24, L2, -73], [GOLD.x + 3, L2, GOLD.z - 6]], 1.9, { lanterns: 0 });
    this.cavern(GOLD, 8, 6, [new THREE.Vector3(GOLD.x + 8, L2, GOLD.z), new THREE.Vector3(GOLD.x + 3, L2, GOLD.z - 6)]);

    // ---------------- LEVEL 3: the old train line to the falls ----------------
    const L3 = -60;
    const DEP = new THREE.Vector3(10, L3, -48);
    const FALLS = new THREE.Vector3(-60, L3, -86);
    this.cavern(DEP, 10, 7, [new THREE.Vector3(10, L3, -58)]);
    this.trainPath = this.tunnel([[10, L3, -58], [13, L3, -72], [8, L3, -90], [-8, L3, -104], [-28, L3, -110], [-47.3, L3, -98.7]], 2.6, { timbers: true, rails: true, lanterns: 15 });
    this.cavern(FALLS, 18, 14, [new THREE.Vector3(-47.3, L3, -98.7)]);
    this.L3 = { DEP, FALLS };

    this.#entrance();
    this.#hub(HUB);
    this.#lift(new THREE.Vector3(8.5, 0, -50), LOW);
    this.#grotto(GROT);
    this.#ores({ CU, COAL, DEEP, GROT, GOLD, HUB });
    this.#cart();
    this.#journal({ COAL, DEEP, GROT, GOLD });
    this.#level3(GOLD);
    this.#batsInit([GROT, DEEP, COAL]);

    this.updaters.push((dt, t) => this.#tick(dt, t));
    if (g.pendingOre) this.netApply(g.pendingOre);
  }

  // ===========================================================================
  // Geometry
  // ===========================================================================

  /**
   * A rough tunnel through floor-level points. Returns the floor curve.
   * opts: timbers (wooden sets), rails, lanterns (spacing m), broken (rubble)
   */
  tunnel(pts, r, opts = {}) {
    const v = pts.map((p) => (Array.isArray(p) ? new THREE.Vector3(...p) : p));
    const floor = new THREE.CatmullRomCurve3(v, false, 'catmullrom', 0.2);
    const lift = r * 0.55;
    const center = new THREE.CatmullRomCurve3(v.map((p) => p.clone().setY(p.y + lift)), false, 'catmullrom', 0.2);
    const len = floor.getLength();
    const segs = Math.max(8, Math.ceil(len * 1.2));
    const geo = new THREE.TubeGeometry(center, segs, r, 10, false);
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const fy = (i) => {
      // floor height under vertex i: nearest point on the floor curve
      const t = Math.floor(i / 11) / segs;
      return floor.getPointAt(Math.min(1, t)).y;
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n = noise3(x * 0.45, y * 0.45, z * 0.45);
      const k = 1 + n * 0.32;
      const cx = x - nrm.getX(i) * r;
      const cy = y - nrm.getY(i) * r;
      const cz = z - nrm.getZ(i) * r;
      let nx = cx + (x - cx) * k;
      let ny = cy + (y - cy) * k;
      const nz = cz + (z - cz) * k;
      const f = fy(i);
      if (ny < f) ny = f - 0.02; // flatten the floor
      nx += 0;
      pos.setXYZ(i, nx, ny, nz);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.rock);
    this.root.add(mesh);
    this.addColliderMesh(mesh);
    // walkable floor slabs
    const N = Math.ceil(len / 1.5);
    for (let i = 0; i < N; i++) {
      const a = floor.getPointAt(i / N);
      const b = floor.getPointAt((i + 1) / N);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const d = b.clone().sub(a);
      const yaw = Math.atan2(d.x, d.z);
      this.addColliderBox(mid.x, mid.y - 0.25, mid.z, r * 1.5, 0.5, d.length() + 0.4, yaw);
    }
    // timbers, rails, lanterns
    const step = 3;
    for (let s = 1.5; s < len - 0.5; s += step) {
      const t = s / len;
      const p = floor.getPointAt(t);
      const tan = floor.getTangentAt(t);
      const yaw = Math.atan2(tan.x, tan.z);
      const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      if (opts.timbers) {
        const broken = opts.broken && s > len * 0.45 && s < len * 0.7;
        for (const k of [-1, 1]) {
          if (broken && k > 0) continue;
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, r * 1.25, 0.22), this.timber);
          post.position.copy(p).addScaledVector(side, k * r * 0.72).setY(p.y + r * 0.62);
          post.rotation.y = yaw;
          if (broken) post.rotation.z = 0.25;
          this.root.add(post);
        }
        const cap = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, 0.22, 0.24), this.timber);
        cap.position.copy(p).setY(p.y + r * 1.27);
        cap.rotation.y = yaw;
        if (broken) cap.rotation.z = -0.35;
        this.root.add(cap);
      }
      if (opts.rails) {
        const sl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.22), this.sleeperMat);
        sl.position.copy(p).setY(p.y + 0.04);
        sl.rotation.y = yaw;
        this.root.add(sl);
        if (s + step < len) {
          const q = floor.getPointAt(Math.min(1, (s + step) / len));
          for (const k of [-0.45, 0.45]) {
            const a = p.clone().addScaledVector(side, k);
            const b = q.clone().addScaledVector(side, k);
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, a.distanceTo(b)), this.railMat);
            rail.position.copy(a).add(b).multiplyScalar(0.5).setY(p.y + 0.12);
            rail.lookAt(b.x, p.y + 0.12, b.z);
            this.root.add(rail);
          }
        }
      }
      if (opts.lanterns && Math.round(s / step) % Math.max(1, Math.round(opts.lanterns / step)) === 0) this.lantern(p.clone().setY(p.y + r * 1.15));
      if (opts.broken && s > len * 0.5 && s < len * 0.62) this.rubble(p, side, r);
    }
    return floor;
  }

  /** A rough dome with a flat floor; `openings` = points on its edge where tunnels come in. */
  cavern(c, r, h, openings = []) {
    let geo = new THREE.SphereGeometry(r, 26, 16);
    geo = geo.toNonIndexed();
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const n = noise3((x + c.x) * 0.25, (y + c.y) * 0.25, (z + c.z) * 0.25);
      const k = 1 + n * 0.16;
      x *= k;
      z *= k;
      y = y * (h / r) * k;
      if (y < 0) y = -0.02;
      pos.setXYZ(i, x + c.x, y + c.y, z + c.z);
    }
    // cut holes where the tunnels meet the wall
    const keep = [];
    const a = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.set(0, 0, 0);
      for (let k = 0; k < 3; k++) a.add(_v.set(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)));
      a.multiplyScalar(1 / 3);
      // a channel from the middle out through the wall toward each opening
      const hole = openings.some((o) => {
        const dx = o.x - c.x;
        const dz = o.z - c.z;
        const L = Math.hypot(dx, dz) || 1;
        const t = THREE.MathUtils.clamp(((a.x - c.x) * dx + (a.z - c.z) * dz) / (L * L), 0, 1.4);
        const px = c.x + dx * t;
        const pz = c.z + dz * t;
        return t > 0.45 && Math.hypot(a.x - px, a.z - pz) < 2.8 && a.y - o.y < 3.7;
      });
      if (!hole) for (let k = 0; k < 3; k++) keep.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    // planar-ish UVs so the rock texture shows
    const uv = [];
    for (let i = 0; i < keep.length; i += 3) uv.push((keep[i] + keep[i + 1] * 0.5) * 0.25, (keep[i + 2] + keep[i + 1] * 0.5) * 0.25);
    g2.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g2.computeVertexNormals();
    const mesh = new THREE.Mesh(g2, this.rock);
    this.root.add(mesh);
    this.addColliderMesh(mesh);
    // floor
    const floor = new THREE.Mesh(new THREE.CircleGeometry(r * 1.25, 24), this.rockDark);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(c.x, c.y + 0.01, c.z);
    this.root.add(floor);
    this.addColliderBox(c.x, c.y - 0.25, c.z, r * 2.4, 0.5, r * 2.4);
    // stalactites
    for (let k = 0; k < Math.round(r * 1.5); k++) {
      const an = Math.random() * Math.PI * 2;
      const rr = Math.random() * r * 0.75;
      const len = 0.5 + Math.random() * 1.6;
      const st = new THREE.Mesh(new THREE.ConeGeometry(0.15 + Math.random() * 0.2, len, 5), this.rockDark);
      st.rotation.x = Math.PI;
      const top = c.y + h * Math.sqrt(Math.max(0.05, 1 - (rr / r) ** 2)) * 0.95;
      st.position.set(c.x + Math.cos(an) * rr, top - len / 2, c.z + Math.sin(an) * rr);
      this.root.add(st);
    }
    return mesh;
  }

  lantern(p) {
    const l = this.game.assets.model('lantern');
    if (l) {
      l.position.copy(p).setY(p.y - 0.25);
      this.root.add(l);
    }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), this.mat({ color: 0xffc070, unlit: true }));
    glow.position.copy(p).setY(p.y - 0.05);
    this.root.add(glow);
    this.addLight({ position: [p.x, p.y - 0.2, p.z], color: 0xffa860, range: 7.5, intensity: 1.1, flicker: 0.12 });
  }

  rubble(p, side, r) {
    for (let k = 0; k < 6; k++) {
      const s = 0.3 + Math.random() * 0.6;
      const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), this.rockDark);
      rk.position.copy(p).addScaledVector(side, r * (0.25 + Math.random() * 0.5)).setY(p.y + s * 0.6);
      rk.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.root.add(rk);
    }
    this.addColliderBox(p.x + side.x * r * 0.5, p.y + 0.5, p.z + side.z * r * 0.5, r * 0.8, 1, 1.2);
  }

  // ===========================================================================
  // Places
  // ===========================================================================

  #entrance() {
    const g = this.game;
    // daylight (or moonlight) at the mouth, a door back out
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.2), this.mat({ color: 0x6a7488, unlit: true }));
    mouth.position.set(0, 1.6, 2.1);
    mouth.rotation.y = Math.PI;
    this.root.add(mouth);
    this.addColliderBox(0, 2, 2.6, 6, 4, 0.6);
    this.addInteractable(mouth, { prompt: 'Go back outside', range: 3, action: () => g.changeScene('World', 'mine_door') });
    this.addSpawn('entrance', [0, 0, -0.5], 0);
    this.addSpawn('default', [0, 0, -0.5], 0);
    // a hook with a helmet, and the tool rack
    const hook = this.box(0.6, 0.06, 0.08, this.timber, -1.5, 1.7, -3, { collide: false });
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.mat({ color: 0xd8b020 }));
    helmet.position.set(-1.45, 1.52, -3);
    const lampM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), this.mat({ color: 0xfff4c0, unlit: true }));
    lampM.rotation.x = Math.PI / 2;
    lampM.position.set(-1.45, 1.6, -2.84);
    this.root.add(helmet, lampM);
    void hook;
    this.addInteractable(helmet, {
      prompt: () => (g.inventory.has('miner_helmet') ? 'An empty hook' : 'Take the miner’s helmet'),
      action: () => {
        if (g.inventory.has('miner_helmet')) return;
        g.inventory.add('miner_helmet');
        helmet.visible = lampM.visible = false;
        g.hud.toast('Miner’s helmet with a carbide-style lamp. Lights the way down here automatically.', 4500);
      },
    });
    const pick = this.place('pickaxe', { x: 1.5, y: 0.0, z: -3.2, rotY: 0.4 });
    pick.rotation.z = 0.25;
    this.addInteractable(pick, {
      prompt: () => (g.inventory.has('pickaxe') ? 'Pickaxe rack (empty)' : 'Take the old pickaxe'),
      action: () => {
        if (g.inventory.has('pickaxe')) return;
        g.inventory.add('pickaxe');
        g.inventory.equip('pickaxe');
        pick.visible = false;
        g.hud.toast('An old pickaxe. LMB to swing at ore veins. Old Pete in the big cavern buys what you dig.', 5000);
      },
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), this.mat({ map: signTexture(['DANGER · MIND YOUR HEAD'], { bg: '#c8a020', fg: '#101010', w: 160, h: 32 }) }));
    sign.position.set(0, 2.6, -4);
    this.root.add(sign);
  }

  #hub(c) {
    const g = this.game;
    // assay office: a plank counter, a scale, Old Pete
    const ox = c.x - 6;
    const oz = c.z - 4;
    this.box(3, 1.0, 0.7, this.timber, ox, 0.5, oz);
    this.box(3.2, 0.06, 0.9, this.mat({ color: 0x4a3424 }), ox, 1.03, oz, { collide: false });
    const pete = this.place('clerk', { x: ox, y: 0, z: oz - 0.9 });
    this.animate(pete, 'idle');
    const scale = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12), this.mat({ color: 0xc8a050 }));
    scale.position.set(ox + 0.9, 1.1, oz);
    this.root.add(scale);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), this.mat({ map: signTexture(['ASSAY OFFICE · OLD PETE'], { bg: '#3a2414', fg: '#f0d890', w: 192, h: 40 }) }));
    sg.position.set(ox, 2.6, oz - 1.6);
    this.root.add(sg);
    this.lantern(new THREE.Vector3(ox, 3.2, oz - 0.2));
    const lines = ['"Fresh out of the ground, eh? Let’s see what you’ve got."', '"Silver’s been good to this town. Mostly."', '"Watch the west drift. Roof’s not what it was."', '"My brother Walt knew every inch of level two. Every inch."'];
    this.addInteractable(pete, {
      prompt: 'Talk to Old Pete (sell ore · buy gear)',
      range: 3,
      action: () => {
        g.hud.toast(lines[Math.floor(Math.random() * lines.length)], 3000);
        g.openUI(() => g.shopping.open('assay'));
      },
    });
    // notice board
    const nb = this.box(1.6, 1.1, 0.06, this.timber, c.x + 7, 1.6, c.z - 9.5);
    nb.rotation.y = -0.5;
    this.addInteractable(nb, {
      prompt: 'Read the notice board',
      action: () =>
        g.openUI(() =>
          g.note.show(
            'PINE HOLLOW SILVER MINE — NOTICES\n\n· Cage lift to LEVEL 2: pull the lever, mind your fingers.\n· Minecart to the DEEP VEIN: hop in at the station.\n· West drift UNSAFE since ’62. Enter at own risk.\n· Coal, copper, iron: any pick. Silver, gold, amethyst: steel or better. Emerald & diamond: Pete has a special pick.\n· Lost: one brother. Answers to Walt. — P.',
          ),
        ),
    });
    // barrels, crates, a lit brazier
    for (const [x, z] of [[c.x + 9, c.z + 3], [c.x + 9.6, c.z + 4], [c.x - 9, c.z + 5]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), this.timber);
      b.position.set(x, 0.45, z);
      this.root.add(b);
      this.addColliderBox(x, 0.45, z, 0.7, 0.9, 0.7);
    }
    const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 0.5, 10), this.mat({ color: 0x2a2a2a }));
    brazier.position.set(c.x + 2, 0.25, c.z + 3);
    this.root.add(brazier);
    this.addColliderBox(c.x + 2, 0.4, c.z + 3, 1, 0.8, 1);
    this.fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 7), this.mat({ color: 0xff8a30, unlit: true, opacity: 0.85, additive: true }));
    this.fire.position.set(c.x + 2, 0.75, c.z + 3);
    this.root.add(this.fire);
    this.addLight({ position: [c.x + 2, 1.2, c.z + 3], color: 0xff8a40, range: 12, intensity: 1.4, flicker: 0.25 });
    this.addSpawn('hub', [c.x, 0, c.z + 6], 0);
  }

  /** The cage lift between the levels. */
  #lift(top, low) {
    const g = this.game;
    const mk = (p, label, to, spawn) => {
      const frame = this.mat({ color: 0x3a3a40 });
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box(0.1, 3, 0.1, frame, p.x + dx, p.y + 1.5, p.z + dz, { collide: false });
      const bar = this.mat({ color: 0x5a5a60 });
      for (let k = -2; k <= 2; k++) {
        this.box(0.04, 2.6, 0.04, bar, p.x + k * 0.45, p.y + 1.3, p.z - 1, { collide: false });
        this.box(0.04, 2.6, 0.04, bar, p.x - 1, p.y + 1.3, p.z + k * 0.45, { collide: false });
        this.box(0.04, 2.6, 0.04, bar, p.x + 1, p.y + 1.3, p.z + k * 0.45, { collide: false });
      }
      this.box(2.1, 0.06, 2.1, bar, p.x, p.y + 2.6, p.z, { collide: false });
      const lever = this.box(0.08, 0.6, 0.08, this.mat({ color: 0xc02020 }), p.x + 1.3, p.y + 1.1, p.z, { collide: false });
      lever.rotation.z = 0.4;
      this.addInteractable(lever, {
        prompt: label,
        range: 2.6,
        action: async () => {
          g.fade.classList.add('on');
          this.#clank(true);
          await new Promise((r) => setTimeout(r, 1500));
          g.player.spawn(this.spawns[spawn]);
          this.#clank(false);
          g.fade.classList.remove('on');
          g.hud.toast(spawn === 'level2' ? 'Level 2. Thirty metres closer to the middle of the earth. It’s colder. And quieter.' : 'Back up on level 1.', 3500);
        },
      });
      this.lantern(new THREE.Vector3(p.x, p.y + 3.2, p.z + 1.6));
    };
    mk(top, 'Pull the lever: cage down to level 2', null, 'level2');
    mk(low, 'Pull the lever: cage up to level 1', null, 'level1');
    this.addSpawn('level2', [low.x, low.y, low.z + 2.5], 0);
    this.addSpawn('level1', [top.x, top.y, top.z + 2.5], 0);
  }

  #grotto(c) {
    // underground lake, glowing mushrooms, crystal clusters on the walls
    const lake = new THREE.Mesh(new THREE.CircleGeometry(6.5, 28), this.mat({ color: 0x1a4a6a, unlit: true, opacity: 0.85 }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(c.x + 4, c.y + 0.06, c.z - 4);
    this.root.add(lake);
    this.lake = lake;
    this.addColliderBox(c.x + 4, c.y + 0.8, c.z - 4, 9, 1.6, 9); // you can't walk into it
    this.addLight({ position: [c.x + 4, c.y + 1, c.z - 4], color: 0x40a0ff, range: 14, intensity: 1.3 });
    const glowMats = [0x60ffd0, 0xb080ff, 0x80d0ff].map((col) => this.mat({ color: col, unlit: true }));
    for (let k = 0; k < 26; k++) {
      const an = Math.random() * Math.PI * 2;
      const rr = 7 + Math.random() * 6;
      const x = c.x + Math.cos(an) * rr;
      const z = c.z + Math.sin(an) * rr;
      if (Math.hypot(x - (c.x + 4), z - (c.z - 4)) < 7.5) continue;
      const h = 0.2 + Math.random() * 0.4;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, h, 5), this.mat({ color: 0xd8e8e0 }));
      stem.position.set(x, c.y + h / 2, z);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.12, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), glowMats[k % 3]);
      cap.position.set(x, c.y + h, z);
      this.root.add(stem, cap);
    }
    this.addLight({ position: [c.x - 6, c.y + 1, c.z + 4], color: 0x80ffd0, range: 10, intensity: 0.8 });
    this.addLight({ position: [c.x + 8, c.y + 4, c.z + 6], color: 0xb080ff, range: 12, intensity: 0.9 });
  }

  // ===========================================================================
  // Ore
  // ===========================================================================

  #ores({ CU, COAL, DEEP, GROT, GOLD, HUB }) {
    const ring = (c, r, list, y = 0) =>
      list.forEach((ore, k) => {
        const an = (k / list.length) * Math.PI * 2 + 0.4;
        this.#node(ore, new THREE.Vector3(c.x + Math.cos(an) * r, c.y + y, c.z + Math.sin(an) * r));
      });
    ring(HUB, 10.5, ['coal', 'copper', 'coal']);
    ring(CU, 7.2, ['copper', 'copper', 'iron', 'coal', 'copper', 'iron', 'copper']);
    ring(COAL, 6.4, ['coal', 'coal', 'iron', 'coal', 'silver', 'coal']);
    ring(DEEP, 8, ['silver', 'iron', 'silver', 'gold', 'silver', 'iron', 'gold', 'silver']);
    ring(GROT, 12.5, ['amethyst', 'amethyst', 'emerald', 'amethyst', 'silver', 'amethyst', 'emerald', 'amethyst', 'gold']);
    ring(GOLD, 6.5, ['gold', 'gold', 'diamond', 'gold', 'emerald', 'gold']);
    // a few along the drifts
    this.#node('iron', new THREE.Vector3(28, 0, -45.5));
    this.#node('coal', new THREE.Vector3(-28, 0, -50));
    this.#node('copper', new THREE.Vector3(-2, 0, -77));
    this.#node('silver', new THREE.Vector3(18, 0, -99));
  }

  #node(ore, p) {
    const def = ORES[ore];
    const grp = new THREE.Group();
    grp.position.copy(p);
    const rockM = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), this.rockDark);
    rockM.scale.set(1.2, 0.8, 1);
    rockM.position.y = 0.45;
    grp.add(rockM);
    const shardMat = this.mat({ color: def.color, unlit: !!def.glow });
    const shards = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const s = new THREE.Mesh(def.glow ? new THREE.OctahedronGeometry(0.18, 0) : new THREE.DodecahedronGeometry(0.16, 0), shardMat);
      const an = Math.random() * Math.PI * 2;
      s.position.set(Math.cos(an) * 0.6, 0.35 + Math.random() * 0.55, Math.sin(an) * 0.45);
      s.scale.set(1, def.glow ? 1.8 : 1, 1);
      s.rotation.set(Math.random(), Math.random() * 3, Math.random() - 0.5);
      shards.add(s);
    }
    grp.add(shards);
    this.root.add(grp);
    this.addColliderBox(p.x, p.y + 0.45, p.z, 1.4, 0.9, 1.2);
    const i = this.nodes.length;
    grp.userData.node = i;
    const node = { i, ore, grp, shards, hp: def.hits, max: def.hits, broken: false, respawn: 0 };
    if (def.glow) {
      node.light = this.addLight({ position: [p.x, p.y + 0.8, p.z], color: def.color, range: 4, intensity: 0.7 });
    }
    this.nodes.push(node);
    this.nodeMeshes.push(grp);
  }

  /** A hit landed: knock a shard off and shake the node. */
  chip(node) {
    const left = node.shards.children.filter((s) => s.visible);
    const frac = Math.max(0, node.hp / node.max);
    const want = Math.ceil(frac * 6);
    for (let k = left.length - 1; k >= want; k--) left[k].visible = false;
    node.shakeT = 0.25;
  }

  breakNode(node, respawnIn = 240 + Math.random() * 180) {
    node.broken = true;
    node.respawn = respawnIn;
    node.shards.visible = false;
    for (const s of node.shards.children) s.visible = true;
    if (node.light) node.light.enabled = false;
  }

  /** Someone else in the room broke a node. */
  netBreak(i, t) {
    const n = this.nodes[i];
    if (n && !n.broken) this.breakNode(n, t);
  }

  netSnapshot() {
    return this.nodes.filter((n) => n.broken).map((n) => [n.i, Math.round(n.respawn)]);
  }

  netApply(list) {
    for (const [i, t] of list ?? []) this.netBreak(i, t);
  }

  sparks(p, color) {
    for (let k = 0; k < 8; k++) {
      const s = new THREE.Mesh(_sparkGeo, this.mat({ color: k % 2 ? 0xffd080 : color, unlit: true }));
      s.position.copy(p);
      this.root.add(s);
      this.sparkList.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), t: 0.5 });
    }
  }

  // ===========================================================================
  // The minecart
  // ===========================================================================

  #cart() {
    const g = this.game;
    const curve = this.cartPath;
    const cart = this.place('minecart', { x: 0, z: 0 });
    this.cartObj = cart;
    this.cartS = 0.02;
    this.cartDir = 1;
    const put = (s) => {
      const p = curve.getPointAt(s);
      const t = curve.getTangentAt(s);
      cart.position.set(p.x, p.y + 0.1, p.z);
      cart.rotation.y = Math.atan2(t.x, t.z) + Math.PI / 2;
    };
    put(this.cartS);
    this.putCart = put;
    this.addInteractable(cart, {
      prompt: () => (this.riding ? '' : this.cartS < 0.5 ? 'Ride the minecart to the deep vein' : 'Ride the minecart back to the hub'),
      range: 3,
      enabled: () => !this.riding,
      action: () => {
        this.riding = true;
        this.cartDir = this.cartS < 0.5 ? 1 : -1;
        this.cartV = 0;
        g.player.enabled = false;
        g.hud.toast('Hold on to your hat.', 2000);
      },
    });
    const len = curve.getLength();
    this.cartLen = len;
    this.addSpawn('cart_end', [curve.getPointAt(0.97).x + 1.5, 0, curve.getPointAt(0.97).z + 1.5], 0);
    this.addSpawn('cart_start', [curve.getPointAt(0.03).x + 1.5, 0, curve.getPointAt(0.03).z], 0);
  }

  #rideCart(dt) {
    const g = this.game;
    const a = this.cartDir > 0 ? 5 : 5;
    this.cartV = Math.min(9, this.cartV + a * dt);
    this.cartS += (this.cartDir * this.cartV * dt) / this.cartLen;
    const end = this.cartDir > 0 ? this.cartS >= 0.97 : this.cartS <= 0.03;
    this.cartS = THREE.MathUtils.clamp(this.cartS, 0.03, 0.97);
    this.putCart(this.cartS);
    // the rider: camera in the cart, facing along the track
    const t = this.cartPath.getTangentAt(this.cartS).multiplyScalar(this.cartDir);
    const yaw = Math.atan2(-t.x, -t.z);
    g.player.position.set(this.cartObj.position.x, this.cartObj.position.y + 0.2, this.cartObj.position.z);
    g.player.yaw = yaw;
    this.#rattle(dt);
    if (end) {
      this.riding = false;
      g.player.enabled = true;
      g.player.spawn(this.spawns[this.cartDir > 0 ? 'cart_end' : 'cart_start']);
      g.hud.toast(this.cartDir > 0 ? 'The deep vein. Silver and gold glint in the walls.' : 'Back at the hub station.', 3000);
    }
  }

  #rattle(dt) {
    this.rattleT = (this.rattleT ?? 0) - dt * this.cartV;
    if (this.rattleT > 0) return;
    this.rattleT = 1.6;
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const n = this.game.audio.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900 + Math.random() * 300;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.25, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(f).connect(e).connect(this.game.audio.master);
    n.start(t);
    n.stop(t + 0.1);
  }

  // ===========================================================================
  // Level 3: the old train, the falls, fossils
  // ===========================================================================

  #level3(GOLD) {
    const g = this.game;
    const { DEP, FALLS } = this.L3;
    // the cage goes one stop further down
    const low = new THREE.Vector3(10, -30, -48);
    this.#lever(low, -1.3, 'Pull the other lever: cage down to level 3', 'level3');
    this.#lever(new THREE.Vector3(DEP.x, DEP.y, DEP.z), 1.3, 'Pull the lever: cage up to level 2', 'level2', true);
    this.addSpawn('level3', [DEP.x, DEP.y, DEP.z + 2.5], 0);

    // the train: a little saddle-tank loco and two ore wagons, rusted on the rails
    const iron = this.mat({ color: 0x3a3330 });
    const rust = this.mat({ color: 0x7a4a2a });
    const brass = this.mat({ color: 0xc8a040 });
    const train = new THREE.Group();
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 10), iron);
    boiler.rotation.x = Math.PI / 2;
    boiler.position.set(0, 1.0, 0.4);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 1.0), rust);
    cab.position.set(0, 1.2, -1.2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.2), iron);
    roof.position.set(0, 1.95, -1.2);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.7, 8), iron);
    stack.position.set(0, 1.8, 1.2);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 8), brass);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 1.25, 1.55);
    train.add(boiler, cab, roof, stack, lamp);
    for (const z of [-1.1, 0, 1.0]) for (const x of [-0.55, 0.55]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 10), iron);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.32, z);
      train.add(w);
    }
    for (const k of [1, 2]) {
      const wag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.6), rust);
      wag.position.set(0, 0.75, -1.2 - k * 2.0);
      train.add(wag);
    }
    this.root.add(train);
    this.train = train;
    this.trainS = 0.02;
    this.putTrain = (s) => {
      const p = this.trainPath.getPointAt(s);
      const t = this.trainPath.getTangentAt(s).multiplyScalar(this.trainDirSign ?? 1);
      train.position.set(p.x, p.y + 0.05, p.z);
      train.rotation.y = Math.atan2(t.x, t.z);
    };
    this.putTrain(this.trainS);
    this.trainLen = this.trainPath.getLength();
    this.repaired = localStorage.getItem('3am-train') === '1';
    const need = () => {
      const inv = g.inventory;
      const miss = [];
      if (!inv.has('part_valve')) miss.push('a brass steam valve (Walt hid one in the gold room on level 2)');
      if (!inv.has('part_chain')) miss.push('a drive chain (Old Pete sells them)');
      if (!inv.has('ore_coal', 5)) miss.push(`coal ×5 (you have ${inv.count('ore_coal')})`);
      return miss;
    };
    this.addInteractable(cab, {
      prompt: () => (this.trainRiding ? '' : !this.repaired ? 'Look over the old mine train' : this.trainS < 0.5 ? 'Ride the train to the underground falls' : 'Ride the train back to the lift'),
      range: 3.4,
      enabled: () => !this.trainRiding,
      action: () => {
        if (!this.repaired) {
          const miss = need();
          if (miss.length) return g.openUI(() => g.note.show(`The old train. Seized up, but whole. Walt’s writing is chalked on the cab:\n\n“She runs. Needs:”\n\n· ${miss.join('\n· ')}`));
          g.inventory.remove('part_valve');
          g.inventory.remove('part_chain');
          g.inventory.remove('ore_coal', 5);
          this.repaired = true;
          try {
            localStorage.setItem('3am-train', '1');
          } catch {}
          this.#whistle();
          return g.hud.toast('Valve on, chain on, coal in the firebox… she wheezes, coughs, and the whistle screams. She RUNS.', 6000);
        }
        this.trainRiding = true;
        this.trainDir = this.trainS < 0.5 ? 1 : -1;
        this.trainV = 0;
        g.player.enabled = false;
        this.#whistle();
      },
    });
    const tLight = this.addLight({ position: [DEP.x, DEP.y + 1.3, DEP.z], color: 0xffd890, range: 10, intensity: 1.2 });
    this.trainLight = tLight;
    // the valve, in a little tin box in Walt's gold room
    const box = this.box(0.4, 0.25, 0.3, this.mat({ color: 0x5a6a5a }), GOLD.x - 4, GOLD.y + 0.125, GOLD.z + 2, { collide: false });
    this.addInteractable(box, {
      prompt: () => (g.inventory.has('part_valve') || this.repaired ? 'An empty tin box' : 'A tin box labelled “FOR THE TRAIN — W.”'),
      action: () => {
        if (g.inventory.has('part_valve') || this.repaired) return;
        g.inventory.add('part_valve');
        g.hud.toast('A brass steam valve, wrapped in an oily rag. For the train on level 3.', 4500);
      },
    });
    this.addSpawn('falls', [FALLS.x + 9, FALLS.y, FALLS.z - 9], Math.PI * 0.25);
    this.addSpawn('depot', [DEP.x - 3, DEP.y, DEP.z - 6], 0);

    // ---- the underground falls ----
    const wf = new THREE.Mesh(new THREE.PlaneGeometry(7, 13), this.mat({ map: this.tex('water', 1, 3), color: 0x9ad8ff, unlit: true, opacity: 0.8, scroll: [0, 0.6], doubleSide: true }));
    wf.position.set(FALLS.x - 13, FALLS.y + 6.5, FALLS.z + 4);
    wf.rotation.y = Math.PI / 2 - 0.3;
    this.root.add(wf);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(6, 24), this.mat({ color: 0x2a7aa8, unlit: true, opacity: 0.85 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(FALLS.x - 9, FALLS.y + 0.05, FALLS.z + 3);
    this.root.add(pool);
    this.addColliderBox(FALLS.x - 9, FALLS.y + 0.8, FALLS.z + 3, 10, 1.6, 10);
    this.addLight({ position: [FALLS.x - 9, FALLS.y + 3, FALLS.z + 3], color: 0x60c0ff, range: 18, intensity: 1.5 });
    // glowing algae on the walls
    const glow = this.mat({ color: 0x60ffe0, unlit: true });
    for (let k = 0; k < 70; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = 14 + Math.random() * 3;
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.06, 4, 3), glow);
      d.position.set(FALLS.x + Math.cos(a) * r, FALLS.y + 1 + Math.random() * 9, FALLS.z + Math.sin(a) * r);
      this.root.add(d);
    }
    this.addLight({ position: [FALLS.x + 6, FALLS.y + 6, FALLS.z - 6], color: 0x60ffd0, range: 16, intensity: 0.8 });
    this.fallsAt = new THREE.Vector3(FALLS.x - 12, FALLS.y + 2, FALLS.z + 4);
    this.fallSound = true;

    // ---- fossil dig sites ----
    const sand = this.mat({ color: 0x9a8a6a });
    const spots = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.6;
      const r = 8 + (k % 3) * 2;
      spots.push(new THREE.Vector3(FALLS.x + Math.cos(a) * r, FALLS.y, FALLS.z + Math.sin(a) * r));
    }
    spots.push(new THREE.Vector3(-20, DEP.y, -108), new THREE.Vector3(12, DEP.y, -80));
    for (const p of spots) {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), sand);
      mound.scale.y = 0.4;
      mound.position.copy(p);
      this.root.add(mound);
      const site = { mound, t: 0 };
      this.addInteractable(mound, {
        prompt: () => (site.t > g.time ? 'Already dug here (come back later)' : 'Dig here for fossils (needs a pickaxe)'),
        range: 2.5,
        action: () => this.#dig(site),
      });
    }
  }

  #lever(p, dx, label, spawn) {
    const g = this.game;
    const lever = this.box(0.08, 0.6, 0.08, this.mat({ color: 0xc02020 }), p.x + dx, p.y + 1.1, p.z, { collide: false });
    lever.rotation.z = dx > 0 ? 0.4 : -0.4;
    this.addInteractable(lever, {
      prompt: label,
      range: 2.6,
      action: async () => {
        g.fade.classList.add('on');
        this.#clank(true);
        await new Promise((r) => setTimeout(r, 1600));
        g.player.spawn(this.spawns[spawn]);
        this.#clank(false);
        g.fade.classList.remove('on');
        g.hud.toast(spawn === 'level3' ? 'Level 3. Sixty metres down. You can hear water somewhere, a lot of it.' : 'Back up on level 2.', 3500);
      },
    });
    if (dx > 0) {
      const bar = this.mat({ color: 0x5a5a60 });
      for (let k = -2; k <= 2; k++) this.box(0.04, 2.6, 0.04, bar, p.x + k * 0.45, p.y + 1.3, p.z - 1, { collide: false });
      this.lantern(new THREE.Vector3(p.x, p.y + 3.2, p.z + 1.6));
    }
  }

  #dig(site) {
    const g = this.game;
    if (site.t > g.time) return;
    if (!['pickaxe', 'pickaxe_steel', 'pickaxe_diamond'].some((k) => g.inventory.has(k))) return g.hud.toast('You’d need a pickaxe to dig.', 2500);
    site.t = g.time + 180;
    site.mound.scale.y = 0.15;
    setTimeout(() => (site.mound.scale.y = 0.4), 180000);
    g.camera.userData.shake = 0.05;
    const all = Object.keys(FOSSILS);
    const shelf = JSON.parse(localStorage.getItem('3am-fossils') ?? '[]');
    const unfound = all.filter((f) => !g.inventory.has(`fossil_${f}`) && !shelf.includes(f));
    if (Math.random() < (unfound.length ? 0.5 : 0.2)) {
      const f = unfound.length ? unfound[Math.floor(Math.random() * unfound.length)] : all[Math.floor(Math.random() * all.length)];
      g.inventory.add(`fossil_${f}`);
      g.hud.toast(`A FOSSIL! ${FOSSILS[f].name}. Put it on the display shelf at home.`, 5000);
    } else {
      const junk = ['Just sand and an old bootlace.', 'Rock. Rock. More rock.', 'A rusty nail from 1891. Fascinating, for a nail.', 'You find a smaller rock inside the rock.'];
      g.hud.toast(junk[Math.floor(Math.random() * junk.length)], 2500);
      if (Math.random() < 0.3) g.inventory.add('ore_coal');
    }
  }

  #rideTrain(dt) {
    const g = this.game;
    this.trainV = Math.min(8, this.trainV + 2.5 * dt);
    this.trainS = THREE.MathUtils.clamp(this.trainS + (this.trainDir * this.trainV * dt) / this.trainLen, 0.02, 0.98);
    this.trainDirSign = this.trainDir;
    this.putTrain(this.trainS);
    const t = this.trainPath.getTangentAt(this.trainS).multiplyScalar(this.trainDir);
    g.player.position.set(this.train.position.x, this.train.position.y + 0.9, this.train.position.z).addScaledVector(t, -1.2);
    g.player.yaw = Math.atan2(-t.x, -t.z);
    this.trainLight.position.copy(this.train.position).addScaledVector(t, 2).setY(this.train.position.y + 1.3);
    this.chuffT = (this.chuffT ?? 0) - dt * this.trainV;
    if (this.chuffT <= 0) {
      this.chuffT = 2.2;
      this.#chuff();
    }
    const end = this.trainDir > 0 ? this.trainS >= 0.98 : this.trainS <= 0.02;
    if (end) {
      this.trainRiding = false;
      g.player.enabled = true;
      g.player.spawn(this.spawns[this.trainDir > 0 ? 'falls' : 'depot']);
      this.#whistle();
      g.hud.toast(this.trainDir > 0 ? 'The underground falls. Walt never wrote about this one. Maybe nobody’s ever seen it.' : 'Back at the depot.', 4500);
    }
  }

  #fallsTick() {
    const g = this.game;
    if (!this.fallNode) {
      const ctx = g.audio.ctx;
      this.fallNode = g.audio.noiseSource(true);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      this.fallGain = ctx.createGain();
      this.fallGain.gain.value = 0;
      this.fallNode.connect(lp).connect(this.fallGain).connect(g.audio.master);
      this.fallNode.start();
    }
    const d = g.scene === this ? g.camera.position.distanceTo(this.fallsAt) : 999;
    this.fallGain.gain.setTargetAtTime(d < 60 ? Math.min(0.5, 9 / (6 + d)) : 0, g.audio.ctx.currentTime, 0.3);
  }

  onExit() {
    this.fallGain?.gain.setTargetAtTime(0, this.game.audio.ctx.currentTime, 0.2);
  }

  #chuff() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const n = this.game.audio.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.35, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    n.connect(f).connect(e).connect(this.game.audio.master);
    n.start(t);
    n.stop(t + 0.35);
  }

  #whistle() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    for (const f of [740, 880, 1110]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.06, t + 0.1);
      e.gain.setValueAtTime(0.06, t + 0.9);
      e.gain.linearRampToValueAtTime(0, t + 1.2);
      o.connect(e).connect(this.game.audio.master);
      o.start(t);
      o.stop(t + 1.3);
    }
  }

  // ===========================================================================
  // Walt's journal (lore) + bats
  // ===========================================================================

  #journal({ COAL, DEEP, GROT, GOLD }) {
    const g = this.game;
    const pages = [
      [COAL.clone().add(new THREE.Vector3(-3, 0, 3)), 'Walt’s journal, p.1\n\nMarch 3rd, 1962. Pete says the west drift is done for. Pete says a lot of things. I heard water behind the coal face today. Water means a cave. A cave means maybe something nobody’s found.'],
      [DEEP.clone().add(new THREE.Vector3(-4, 0, -4)), 'Walt’s journal, p.2\n\nRode the cart out to the deep vein. Silver like frost on a window. Gold in little seams like somebody drew it on with a pen. I sang the whole way back. The echo sings too, down here.'],
      [GROT.clone().add(new THREE.Vector3(-8, 0, 6)), 'Walt’s journal, p.3\n\nFound it. Level two, past the lower station: a lake underground, and the walls are full of purple crystals and green ones that glow on their own. I sat here two hours with my lamp off. It’s the most beautiful room in the world and nobody knows it’s here.'],
      [GOLD.clone().add(new THREE.Vector3(2, 0, 4)), 'Walt’s journal, p.4\n\nThe company’s closing the mine. Pete wants to stay and run the assay office for the tourists that’ll never come. I want to see the ocean. A real one, not this black lake. I don’t know how to tell him.'],
      [new THREE.Vector3(3, 0, -10), 'Walt’s journal, p.5 (tucked behind a timber, newer paper)\n\nPete — I know you still come down here. I’m in Florida. I fish. I have a dog called Silver. I should have said goodbye properly and I didn’t, and I’m sorry, and I think about you every time the sun comes up over the water. Come visit. Bring a pick, the beach is full of shells. — W.'],
    ];
    const found = new Set();
    pages.forEach(([p, text], i) => {
      const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.33), this.mat({ color: 0xe8dcc0 }));
      pg.rotation.x = -Math.PI / 2;
      pg.rotation.z = Math.random();
      pg.position.set(p.x, p.y + 0.02, p.z);
      this.root.add(pg);
      this.addInteractable(pg, {
        prompt: 'A page from a journal',
        range: 2.4,
        action: () => {
          found.add(i);
          g.openUI(() => g.note.show(text));
          if (found.size === pages.length) setTimeout(() => g.hud.toast('All five pages. Old Pete would want to see that last one.', 5000), 400);
        },
      });
    });
  }

  #batsInit(rooms) {
    for (const c of rooms) {
      for (let k = 0; k < 5; k++) {
        const b = this.game.assets.model('bat');
        if (!b) return;
        this.root.add(b);
        const mixer = new THREE.AnimationMixer(b);
        const clip = (b.userData.animations ?? []).find((cl) => /Flying/.test(cl.name));
        if (clip) mixer.clipAction(clip).play();
        this.bats.push({ b, mixer, c: c.clone(), r: 3 + Math.random() * 4, h: 3 + Math.random() * 2.5, ph: Math.random() * 6, s: 0.6 + Math.random() * 0.6, scare: 0 });
      }
    }
  }

  // ===========================================================================

  #tick(dt, t) {
    const g = this.game;
    if (this.riding) this.#rideCart(dt);
    if (this.trainRiding) this.#rideTrain(dt);
    if (this.fallSound) this.#fallsTick();
    if (this.fire) {
      this.fire.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 17) * 0.2, 1);
    }
    for (const n of this.nodes) {
      if (n.shakeT > 0) {
        n.shakeT -= dt;
        n.grp.position.x += (Math.random() - 0.5) * 0.03;
      }
      if (n.broken) {
        n.respawn -= dt;
        if (n.respawn <= 0) {
          n.broken = false;
          n.hp = n.max;
          n.shards.visible = true;
          if (n.light) n.light.enabled = true;
        }
      }
    }
    for (let k = this.sparkList.length - 1; k >= 0; k--) {
      const s = this.sparkList[k];
      s.t -= dt;
      s.v.y -= 9 * dt;
      s.s.position.addScaledVector(s.v, dt);
      if (s.t <= 0) {
        s.s.removeFromParent();
        this.sparkList.splice(k, 1);
      }
    }
    const p = g.player.position;
    for (const b of this.bats) {
      b.mixer.update(dt);
      const near = Math.hypot(p.x - b.c.x, p.z - b.c.z) < 12 && Math.abs(p.y - b.c.y) < 6;
      b.scare = THREE.MathUtils.damp(b.scare, near ? 1 : 0, 2, dt);
      const a = t * b.s * (1 + b.scare * 1.5) + b.ph;
      const r = b.r * (1 + b.scare * 0.4);
      b.b.position.set(b.c.x + Math.cos(a) * r, b.c.y + b.h + Math.sin(a * 2) * 0.6 - b.scare * 1.2, b.c.z + Math.sin(a) * r);
      b.b.rotation.y = -a;
    }
    if (this.lake) this.lake.material.opacity = 0.8 + Math.sin(t * 0.7) * 0.05;
    // drips
    this.dripT = (this.dripT ?? 2) - dt;
    if (this.dripT <= 0) {
      this.dripT = 0.8 + Math.random() * 3;
      this.#drip();
    }
  }

  #drip() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const f = 900 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.06);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.06 * Math.random() + 0.02, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    const d = ctx.createDelay(1);
    d.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.4;
    o.connect(e);
    e.connect(this.game.audio.master);
    e.connect(d);
    d.connect(fb).connect(d);
    d.connect(this.game.audio.master);
    o.start(t);
    o.stop(t + 0.2);
    setTimeout(() => {
      d.disconnect();
      fb.disconnect();
    }, 3000);
  }

  #clank(down) {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    for (let k = 0; k < 6; k++) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 120 + Math.random() * 60;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.12, t + k * 0.22);
      e.gain.exponentialRampToValueAtTime(0.001, t + k * 0.22 + 0.15);
      o.connect(e).connect(this.game.audio.master);
      o.start(t + k * 0.22);
      o.stop(t + k * 0.22 + 0.2);
    }
    const n = this.game.audio.noiseSource(false);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.4, t + 0.2);
    e.gain.linearRampToValueAtTime(0, t + 1.4);
    n.connect(lp).connect(e).connect(this.game.audio.master);
    n.start(t);
    n.stop(t + 1.5);
    void down;
  }
}

/** Cheap smooth 3D value noise in [-1, 1]. */
function noise3(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const h = (a, b, c) => {
    const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const u = s(xf);
  const v = s(yf);
  const w = s(zf);
  return lerp(
    lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

const _v = new THREE.Vector3();
const _sparkGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
