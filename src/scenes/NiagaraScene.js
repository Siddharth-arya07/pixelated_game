import * as THREE from 'three';
import { GeoScene } from './GeoScene.js';
import { signTexture } from '../core/Procedural.js';
import url from '../assets/geo/niagara.json?url';

/**
 * Niagara Falls — the special trip
 * --------------------------------
 * The real gorge and river (OpenStreetMap + elevation): Goat Island
 * between the American and Horseshoe Falls, Luna Island and Bridal Veil,
 * Prospect Point with its observation tower, Rainbow Bridge, the Canadian
 * side across the water.
 *
 *  - The falls: found where the mapped cliff edges meet the upper river with
 *    a big drop below. White water pours over as scrolling curtains; mist
 *    boils up from the bottom; a rainbow hangs in it when the sun's out.
 *  - Maid of the Mist: blue ponchos, the boat from the dock under Prospect
 *    Point, past the American Falls into the Horseshoe basin and back. It
 *    runs on the shared clock, so friends ride the same boat.
 *  - Cave of the Winds: the elevator down from Goat Island and the wooden
 *    walkways right up into the spray of Bridal Veil (the Hurricane Deck).
 */
const CYCLE = 300; // seconds: board, ride, dock
const BOARD = 50;

export class NiagaraScene extends GeoScene {
  constructor(game) {
    super(game, {
      name: 'Niagara',
      label: 'niagara falls',
      url,
      draped: { color: 0x3a9a8c },
      base: '#5a7a3a',
      colors: { scrub: '#4a6a32', wood: '#2e4a26', rock: '#6a6458', paved: '#8a8680', parking: '#5a5a58' },
      fogExtra: 300,
      groundFog: 0.2,
      groundFogY: 85,
      treeColors: [0x3a6a2e, 0x2e5a26, 0x4a7a36],
      treeSpacing: 14,
      minHeight: 60,
    });
    this.noDog = false;
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
    for (const c of this.clusters ?? []) L.push({ name: c.name, x: c.x, z: c.z, color: '#2a8aa8' });
    sp('maid_dock', 'Maid of the Mist', '#1a4a9a');
    sp('cave_top', 'Cave of the Winds', '#c8a020');
    sp('prospect', 'Prospect Point tower');
    poi('Rainbow Bridge');
    return L;
  }

  landmarks() {
    this.farView = 1500; // see the landmarks on the horizon
    this.#findFalls();
    this.#buildFalls();
    this.#mist();
    this.#rainbow();
    this.#boat();
    this.#caveOfTheWinds();
    this.#prospectPoint();
    this.#specialNote();
  }

  // ---------------------------------------------------------------------------
  // The falls
  // ---------------------------------------------------------------------------

  /**
   * The falls as OpenStreetMap draws them: waterfall outlines (Horseshoe,
   * American, Bridal Veil). Their low edge is the base; mist, the boat and
   * the walkways all work from these.
   */
  #findFalls() {
    const m = this.map;
    this.segs = [];
    this.clusters = [];
    const seen = [];
    for (const a of m.areas) {
      if (a.k !== 'waterfall') continue;
      // the same falls are also mapped again inside a "Niagara Falls" group: keep one
      const cx = a.pts.reduce((s, p) => s + p[0], 0) / a.pts.length;
      const cz = a.pts.reduce((s, p) => s + p[1], 0) / a.pts.length;
      if (seen.some(([x, z]) => Math.hypot(x - cx, z - cz) < 25)) {
        a.k = 'waterfall_dup';
        continue;
      }
      seen.push([cx, cz]);
      const hs = a.pts.map(([x, z]) => m.heightAt(x, z));
      const top = Math.max(...hs);
      const bottom = Math.min(...hs);
      if (top - bottom < 6) continue;
      const lowCut = bottom + (top - bottom) * 0.3;
      const hiCut = top - (top - bottom) * 0.3;
      const low = a.pts.filter((_, i) => hs[i] <= lowCut);
      const high = a.pts.filter((_, i) => hs[i] >= hiCut);
      const avg = (P) => P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length], [0, 0]);
      const [lx, lz] = avg(low.length ? low : a.pts);
      const [hx, hz] = avg(high.length ? high : a.pts);
      let nx = lx - hx;
      let nz = lz - hz;
      const l = Math.hypot(nx, nz) || 1;
      nx /= l;
      nz /= l;
      const c = { name: a.n ?? '', x: (lx + hx) / 2, z: (lz + hz) / 2, bottom, top, n: low.length, segs: [], crest: [] };
      // the crest: the high edge, in ring order (for a sheer curtain of water)
      a.pts.forEach((p, i) => hs[i] >= hiCut && c.crest.push([p[0], p[1], hs[i]]));
      for (let i = 0; i + 1 < low.length; i++) {
        const [x0, z0] = low[i];
        const [x1, z1] = low[i + 1];
        if (Math.hypot(x1 - x0, z1 - z0) > 40) continue;
        const sg = { x0, z0, x1, z1, nx, nz, top, bottom };
        c.segs.push(sg);
        this.segs.push(sg);
      }
      if (!c.segs.length) c.segs.push({ x0: lx, z0: lz, x1: lx + 1, z1: lz, nx, nz, top, bottom });
      this.clusters.push(c);
    }
    this.horseshoe = this.clusters.find((c) => /Horseshoe/.test(c.name)) ?? this.clusters[0];
    this.american = this.clusters.find((c) => /American/.test(c.name)) ?? this.clusters[1] ?? this.clusters[0];
    this.bridalVeil = this.clusters.find((c) => /Bridal/.test(c.name)) ?? this.american;
  }

  #buildFalls() {
    const m = this.map;
    // the falling water: the waterfall outlines draped over the real drop
    const mat = this.mat({ map: fallsTex(), color: 0xeefcfc, scroll: [0, -1.6], fogScale: 0.5 });
    m.buildDrapedWater({ mat, cell: 3, lift: 0.8, kinds: ['waterfall'], chunked: false });
    const foam = this.mat({ map: fallsTex(true), color: 0xffffff, opacity: 0.75, scroll: [0.04, -2.3], fogScale: 0.5, depthWrite: false });
    m.buildDrapedWater({ mat: foam, cell: 3, lift: 1.6, kinds: ['waterfall'], chunked: false });
    // sheer curtains over each crest: straight down from the lip to the base
    const curtain = this.mat({ map: fallsTex(), color: 0xf4ffff, scroll: [0, -1.9], doubleSide: true, fogScale: 0.5 });
    for (const c of this.clusters) {
      const P = [];
      const U = [];
      const s0 = c.segs[0];
      for (let i = 0; i + 1 < c.crest.length; i++) {
        const [ax, az, ay] = c.crest[i];
        const [bx, bz, by] = c.crest[i + 1];
        if (Math.hypot(bx - ax, bz - az) > 30) continue;
        const out = 4;
        const A = [ax, ay + 0.8, az];
        const B = [bx, by + 0.8, bz];
        const Cc = [bx + s0.nx * out, c.bottom, bz + s0.nz * out];
        const D = [ax + s0.nx * out, c.bottom, az + s0.nz * out];
        P.push(...A, ...B, ...Cc, ...A, ...Cc, ...D);
        const u0 = (ax + az) / 5;
        const u1 = (bx + bz) / 5;
        const v = (ay - c.bottom) / 8;
        U.push(u0, 0, u1, 0, u1, v, u0, 0, u1, v, u0, v);
      }
      if (!P.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, curtain);
      mesh.frustumCulled = false;
      this.root.add(mesh);
    }
    // the white churn at the bottom of each fall
    const churn = this.mat({ map: fallsTex(true), color: 0xf0ffff, opacity: 0.85, scroll: [0.3, 0.2] });
    for (const c of this.clusters) {
      for (const s of c.segs) {
        const p = new THREE.Mesh(new THREE.CircleGeometry(12, 8), churn);
        p.rotation.x = -Math.PI / 2;
        p.position.set((s.x0 + s.x1) / 2 + s.nx * 10, s.bottom + 1.2, (s.z0 + s.z1) / 2 + s.nz * 10);
        this.root.add(p);
      }
      // the roar
      this.addSound('rain', new THREE.Vector3(c.x, c.bottom + 10, c.z), { volume: 1 });
      this.addSound('train_rumble', new THREE.Vector3(c.x, c.bottom + 5, c.z), { volume: 0.6 });
    }
  }

  /** Mist boiling up from the bottom of the falls. */
  #mist() {
    const mat = this.mat({ map: puffTex(), color: 0xffffff, opacity: 0.13, unlit: true, depthWrite: false, fogScale: 0.4 });
    this.puffs = [];
    for (let i = 0; i < 90; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      this.root.add(p);
      this.puffs.push({ p, life: Math.random() * 6, seg: null });
    }
  }

  #rainbow() {
    const c = this.american;
    if (!c) return;
    const r = new THREE.Group();
    [0xff3030, 0xff9030, 0xffe030, 0x40d040, 0x3080ff, 0x6040d0, 0xa040c0].forEach((c, i) => {
      const band = new THREE.Mesh(new THREE.RingGeometry(82 - i * 1.7, 83.7 - i * 1.7, 48, 1, 0, Math.PI), this.mat({ color: c, opacity: 0.3, unlit: true, doubleSide: true, depthWrite: false, fogScale: 0.2 }));
      r.add(band);
    });
    // standing in the spray, in front of the falls, facing the gorge
    const s = c.segs[Math.floor(c.segs.length / 2)];
    r.position.set((s.x0 + s.x1) / 2 + s.nx * 90, c.bottom, (s.z0 + s.z1) / 2 + s.nz * 90);
    r.rotation.y = Math.atan2(s.nx, s.nz);
    this.root.add(r);
    this.rainbowMesh = r;
  }

  // ---------------------------------------------------------------------------
  // Maid of the Mist
  // ---------------------------------------------------------------------------

  #boat() {
    const m = this.map;
    const am = this.american;
    const hs = this.horseshoe;
    if (!am || !hs) return;
    const level = am.bottom + 0.6;
    this.level = level;
    // the dock: river edge downstream (north) of the American Falls, under Prospect Point
    const pp = m.poi('Prospect Point Observation Tower') ?? m.poi('Prospect Point') ?? { x: am.x, z: am.z - 200 };
    const waterAt = (x, z) => [[0, 0], [5, 11], [-5, -11], [5, -11], [-5, 11]].every(([dx, dz]) => m.heightAt(x + dx, z + dz) < level - 0.4);
    let dock = null;
    for (let d = 20; d < 400 && !dock; d += 10) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = pp.x + Math.cos(a) * d;
        const z = pp.z + Math.sin(a) * d;
        if (waterAt(x, z) && z < am.z) {
          dock = { x, z };
          break;
        }
      }
    }
    dock ??= { x: am.x - 150, z: am.z - 250 };
    this.dock = dock;
    // route: dock → in front of the American Falls → into the Horseshoe basin → turn → back
    const off = (c, d) => {
      const s = c.segs[Math.floor(c.segs.length / 2)];
      return new THREE.Vector3((s.x0 + s.x1) / 2 + s.nx * d, level, (s.z0 + s.z1) / 2 + s.nz * d);
    };
    const A = off(am, 70);
    const H = off(hs, 120);
    const H2 = off(hs, 60);
    const D = new THREE.Vector3(dock.x, level, dock.z);
    this.route = new THREE.CatmullRomCurve3([D, D.clone().lerp(A, 0.5), A, A.clone().lerp(H, 0.5), H, H2, H.clone().add(new THREE.Vector3(40, 0, 20)), A.clone().lerp(H, 0.5).add(new THREE.Vector3(30, 0, 0)), D], false);
    // the boat: two decks, blue and white
    const b = new THREE.Group();
    const white = this.mat({ color: 0xf4f4f0 });
    const blue = this.mat({ color: 0x1a4a9a });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 24), white);
    hull.position.y = 0.4;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.5, 24.1), blue);
    stripe.position.y = 0.2;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(4, 5, 4), white);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1, 1, 0.5);
    bow.position.set(0, 0.4, 14);
    const deck2 = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 16), white);
    deck2.position.set(0, 3.8, -1);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 10), this.mat({ color: 0xe8e8e8 }));
    cabin.position.set(0, 2.5, -2);
    b.add(hull, stripe, bow, deck2, cabin);
    for (const sx of [-1, 1]) {
      for (const [yy, len] of [[2.1, 23], [4.8, 16]]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, len), blue);
        rail.position.set(sx * 3.7, yy, yy > 3 ? -1 : 0);
        b.add(rail);
      }
    }
    const name = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.8), this.mat({ map: signTexture(['MAID OF THE MIST'], { bg: '#1a4a9a', fg: '#ffffff', w: 128, h: 20 }), doubleSide: true }));
    name.position.set(0, 3.0, 3.05);
    b.add(name);
    // passengers in blue ponchos
    this.ponchos = [];
    for (let i = 0; i < 16; i++) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.3, 6), this.mat({ color: 0x3a7ad8, opacity: 0.85 }));
      p.position.set(((i % 4) - 1.5) * 1.6, i < 8 ? 2.1 : 4.6, -8 + Math.floor(i / 4) * 3.6);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 4), this.mat({ color: 0x3a7ad8 }));
      h.position.y = 0.7;
      p.add(h);
      b.add(p);
      this.ponchos.push(p);
    }
    b.traverse((o) => o.isMesh && (o.frustumCulled = false));
    this.root.add(b);
    this.boatObj = b;
    // the dock itself
    const dk = this.box(10, 1, 22, this.mat({ map: this.tex('planks', 2, 4), color: 0x7a6a58 }), dock.x, level + 0.3, dock.z);
    void dk;
    this.addSpawn('maid_dock', [dock.x, level + 1.0, dock.z + 6], 0);
    this.interactVolume(dock.x, level + 1.5, dock.z, 12, 3, 24, {
      prompt: () => (this.riding ? 'Get off the boat' : this.#docked() ? 'Board the Maid of the Mist (blue poncho on!)' : `The Maid of the Mist is out on the river… back in ${Math.ceil(CYCLE - this.#phase())}s`),
      range: 6,
      action: () => (this.riding ? this.game.player.stand() : this.#docked() && this.#board()),
    });
    this.signPost(dock.x + 8, dock.z + 8, ['MAID OF THE MIST', 'boards every 5 minutes'], 0, { bg: '#1a4a9a' });
  }

  #phase() {
    // the shared clock: everyone sees the same boat
    const g = this.game;
    const secs = (g.dayNight.day * 1440 + g.dayNight.minutes) / (g.dayNight.speed || 0.5);
    return ((secs % CYCLE) + CYCLE) % CYCLE;
  }

  #docked() {
    return this.#phase() < BOARD;
  }

  #board() {
    const g = this.game;
    const seat = { eye: new THREE.Vector3(), yaw: 0, pitch: 0, yawLimit: Math.PI, standAt: new THREE.Vector3(this.dock.x + 7, this.level + 1, this.dock.z), onStand: () => (this.riding = false) };
    g.player.sit(seat);
    this.riding = true;
    this.rideSeat = seat;
    document.body.classList.add('poncho');
    g.hud.toast('You pull the blue poncho over your head. It crinkles. Everyone looks ridiculous. Everyone is grinning.', 4500);
  }

  // ---------------------------------------------------------------------------
  // Cave of the Winds, Prospect Point, the note
  // ---------------------------------------------------------------------------

  #caveOfTheWinds() {
    const m = this.map;
    const cw = m.poi('Cave of the Winds');
    const am = this.bridalVeil ?? this.american;
    if (!cw || !am) return;
    // the Bridal Veil end of the American cluster: the segment nearest the Cave of the Winds building
    const s = am.segs.reduce((best, s) => (Math.hypot((s.x0 + s.x1) / 2 - cw.x, (s.z0 + s.z1) / 2 - cw.z) < Math.hypot((best.x0 + best.x1) / 2 - cw.x, (best.z0 + best.z1) / 2 - cw.z) ? s : best), am.segs[0]);
    const bx = (s.x0 + s.x1) / 2 + s.nx * 26;
    const bz = (s.z0 + s.z1) / 2 + s.nz * 26;
    const by = s.bottom;
    const wood = this.mat({ map: this.tex('planks', 1, 1), color: 0x9a6a48 });
    const rail = this.mat({ color: 0xc8a020 });
    // stepped wooden decks climbing toward the falls
    const yaw = Math.atan2(s.nx, s.nz);
    const dir = new THREE.Vector3(-s.nx, 0, -s.nz);
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Vector3(bx, by, bz).addScaledVector(dir, i * 3.4).addScaledVector(side, (i % 2 ? 1 : -1) * 2.5);
      const y = by + 2 + i * 1.4;
      const deck = this.box(5, 0.3, 3.6, wood, p.x, y, p.z, { rotY: yaw });
      void deck;
      this.box(0.1, 1, 3.6, rail, p.x + side.x * 2.5, y + 0.6, p.z + side.z * 2.5, { rotY: yaw, collide: false });
      this.box(0.1, 1, 3.6, rail, p.x - side.x * 2.5, y + 0.6, p.z - side.z * 2.5, { rotY: yaw, collide: false });
      // posts down to the rocks
      this.box(0.3, y - by + 1, 0.3, wood, p.x, (y + by) / 2 - 0.5, p.z, { collide: false });
    }
    const top = new THREE.Vector3(bx, by, bz).addScaledVector(dir, 5 * 3.4);
    this.hurricane = top.clone().setY(by + 2 + 5 * 1.4);
    this.addSpawn('cave_winds', [bx, by + 2.4, bz], yaw + Math.PI);
    // the elevator from Goat Island: a door on the Cave of the Winds building
    const w = this.#outsideDoor(cw.x, cw.z);
    const lift = this.box(1.8, 2.4, 0.2, this.mat({ color: 0x6a6a68 }), w.x + w.nx * 0.12, w.y + 1.2, w.z + w.nz * 0.12, { collide: false, rotY: w.yaw });
    this.addInteractable(lift, { prompt: 'Take the elevator down to the Cave of the Winds (yellow poncho on!)', action: () => this.#teleport('cave_winds', 'Down, down, 175 feet through the rock… the doors open onto roaring white.') });
    this.addSpawn('cave_top', [w.x + w.nx * 3, this.groundHeight(w.x + w.nx * 3, w.z + w.nz * 3), w.z + w.nz * 3], w.yaw + Math.PI);
    const back = this.box(1.6, 2.4, 0.3, this.mat({ color: 0x6a6a68 }), bx - dir.x * 3, by + 3.4, bz - dir.z * 3, { collide: false });
    this.addInteractable(back, { prompt: 'Elevator back up to Goat Island', action: () => this.#teleport('cave_top', 'Back up into the sunshine. Your poncho drips all the way.') });
  }

  #prospectPoint() {
    const m = this.map;
    const pp = m.poi('Prospect Point Observation Tower') ?? m.poi('Prospect Point');
    if (!pp) return;
    const y = this.groundHeight(pp.x, pp.z);
    this.busStop(pp.x + 30, pp.z - 30, 0);
    if (this.dock) {
      const w = this.#outsideDoor(pp.x, pp.z);
      const lift = this.box(1.8, 2.4, 0.2, this.mat({ color: 0x8a8a88 }), w.x + w.nx * 0.12, w.y + 1.2, w.z + w.nz * 0.12, { collide: false, rotY: w.yaw });
      this.addInteractable(lift, { prompt: 'Take the tower elevator down to the Maid of the Mist', action: () => this.#teleport('maid_dock', 'The glass elevator drops down the cliff face. The falls fill the whole window.') });
      this.addSpawn('prospect', [w.x + w.nx * 3, this.groundHeight(w.x + w.nx * 3, w.z + w.nz * 3), w.z + w.nz * 3], w.yaw + Math.PI);
    }
    void y;
  }

  /** A door spot on the outside of the mapped building at (x, z), facing the nearest path. */
  #outsideDoor(x, z) {
    const m = this.map;
    const b = m.buildingAt(x, z, 30);
    if (!b) return { x, z, y: this.groundHeight(x, z), nx: 0, nz: 1, yaw: 0 };
    let t = [x, z + 30];
    let bd = Infinity;
    for (const r of m.roads) {
      if (!['footway', 'path', 'pedestrian', 'service', 'residential'].includes(r.t)) continue;
      for (const [px, pz] of r.pts) {
        const d = Math.hypot(px - b.cx, pz - b.cz);
        if (d < bd && !m.insideBuilding(px, pz)) {
          bd = d;
          t = [px, pz];
        }
      }
    }
    const w = m.wallFacing(b, t[0], t[1]) ?? { x, z, nx: 0, nz: 1, yaw: 0 };
    // the ground right outside the wall (the footprint's lowest corner can be metres below on a slope)
    return { ...w, y: this.groundHeight(w.x + w.nx * 1.5, w.z + w.nz * 1.5) };
  }

  #teleport(spawn, text) {
    const g = this.game;
    const sp = this.spawns[spawn];
    if (!sp) return;
    g.player.spawn(sp);
    g.hud.toast(text, 4000);
    g.audio.oneShot('door', { volume: 0.4, rate: 0.7 });
    document.body.classList.toggle('poncho', spawn === 'cave_winds');
  }

  #specialNote() {
    const pp = this.map.poi('Prospect Point') ?? this.american;
    if (!pp) return;
    const s = this.signPost(pp.x + 8, pp.z + 8, ['THE SPECIAL TRIP'], 0, { bg: '#2a5a6a', fg: '#ffffff', w: 2.6, h: 0.5 });
    this.memoryNote(
      s,
      'Remember',
      'The special trip.\n\nThe roar you feel in your chest more than you hear it. Mist on your face, cold and sweet. A rainbow so close you could almost put your hand through it.\n\nEveryone laughing in those ridiculous blue ponchos.\n\nSome days are so good they stay with you forever. This is one of them, and it\'s still yours.',
    );
  }

  // ---------------------------------------------------------------------------

  update(dt, time) {
    super.update(dt, time);
    const g = this.game;
    const cam = g.camera.position;
    // mist puffs near the camera's closest falls
    if (this.puffs && this.segs.length) {
      for (const p of this.puffs) {
        p.life -= dt;
        if (p.life <= 0 || !p.seg) {
          // respawn at a fall base within reach of the camera
          const s = this.segs[(Math.random() * this.segs.length) | 0];
          if (Math.hypot((s.x0 + s.x1) / 2 - cam.x, (s.z0 + s.z1) / 2 - cam.z) > 420) {
            p.p.visible = false;
            p.life = 0.5;
            continue;
          }
          p.seg = s;
          p.life = 4 + Math.random() * 4;
          p.max = p.life;
          p.p.visible = true;
          p.p.position.set((s.x0 + s.x1) / 2 + s.nx * (6 + Math.random() * 18), s.bottom + 1, (s.z0 + s.z1) / 2 + s.nz * (6 + Math.random() * 18));
          p.v = new THREE.Vector3(s.nx * (2 + Math.random() * 3), 3 + Math.random() * 4, s.nz * (2 + Math.random() * 3));
        }
        p.p.position.addScaledVector(p.v, dt);
        const k = 1 - p.life / p.max;
        p.p.scale.setScalar(4 + k * 16);
        p.p.quaternion.copy(g.camera.quaternion);
      }
    }
    if (this.rainbowMesh) this.rainbowMesh.visible = g.dayNight.isDaylight;
    // the boat
    if (this.route && this.boatObj) {
      const ph = this.#phase();
      let t = 0;
      if (ph >= BOARD) t = Math.min(1, (ph - BOARD) / (CYCLE - BOARD - 10));
      const p = this.route.getPointAt(t);
      const ahead = this.route.getPointAt(Math.min(1, t + 0.01));
      const b = this.boatObj;
      b.position.copy(p);
      b.position.y = this.level + Math.sin(time * 1.4) * 0.15;
      if (ahead.distanceToSquared(p) > 0.01) b.rotation.y = THREE.MathUtils.damp(b.rotation.y, Math.atan2(ahead.x - p.x, ahead.z - p.z), 2, dt);
      b.rotation.z = Math.sin(time * 1.1) * 0.03;
      if (this.riding && this.rideSeat) {
        this.rideSeat.eye.copy(b.localToWorld(new THREE.Vector3(2, 5.9, 2)));
        this.rideSeat.yaw = b.rotation.y + Math.PI;
        // right up in the spray: drops on your poncho (and screen)
        const near = this.segs.some((s) => Math.hypot((s.x0 + s.x1) / 2 - b.position.x, (s.z0 + s.z1) / 2 - b.position.z) < 110);
        document.body.classList.toggle('spray', near);
        if (ph >= CYCLE - 8 && ph < CYCLE - 7) g.hud.toast('Back at the dock. Your poncho is soaked. Nobody wants to get off.', 3500);
      }
    }
    if (this.hurricane) {
      const close = cam.distanceTo(this.hurricane) < 10;
      document.body.classList.toggle('spray', close || document.body.classList.contains('spray'));
      if (close && !this.saidHurricane) {
        this.saidHurricane = true;
        g.hud.toast('The Hurricane Deck. The falls pour down right next to you, and the wind throws the water everywhere. You can\'t stop laughing.', 5000);
      }
    }
  }

  onExit() {
    document.body.classList.remove('poncho', 'spray');
    this.riding = false;
  }
}

function insidePoly(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i];
    const [xj, zj] = p[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function fallsTex(foam = false) {
  return canvasTex(32, 64, (g, w, h) => {
    g.fillStyle = foam ? 'rgba(255,255,255,0)' : '#b8e0e0';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < (foam ? 50 : 140); i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      g.fillStyle = foam ? 'rgba(255,255,255,0.9)' : Math.random() < 0.5 ? '#ffffff' : '#d8f0f0';
      g.fillRect(x, y, 1 + Math.random() * 2, 6 + Math.random() * 14);
    }
  });
}

function puffTex() {
  return canvasTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
  });
}
