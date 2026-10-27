import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { GeoMap } from '../world/GeoMap.js';
import { townhouseWall, houseWall, schoolWall, shopWall, barnWall, tileRoof, shingleRoof, leafLitter } from '../world/GeoTextures.js';
import { signTexture } from '../core/Procedural.js';
import fremontUrl from '../assets/geo/fremont.json?url';

/**
 * FremontScene — Ardenwood, Fremont, California, about ten years ago
 * -----------------------------------------------------------------
 * A true-scale piece of north Fremont built from OpenStreetMap: her
 * townhouse complex off Paseo Padre (the Irish-named terraces: Duffy, Hogan,
 * Kaspar…), Ardenwood Elementary up the road, the parks and playgrounds,
 * Ardenwood Historic Farm, and west across the fields to Coyote Hills.
 * Late autumn after the rain: sweetgum leaves everywhere.
 *
 * You're a kid here (lower eyes). You arrive on the bus from Pine Hollow.
 */
const COMPLEX = ['Duffy Terrace', 'Hogan Terrace', 'Kaspar Terrace', 'Horat Terrace', 'Cronin Terrace', 'Oneil Terrace', 'Gove Terrace', 'Justin Terrace', 'Wellman Terrace', 'Cappy Terrace'];
const HOUSE_COLORS = [0xf0e8d8, 0xe8dcc0, 0xd8d0c0, 0xe0d8c8, 0xc8d0c8, 0xe8e0c0, 0xd0c8b8, 0xf0e0c8, 0xc0c8d0, 0xe0d0b8];
const ROOF_COLORS = [0x6a625c, 0x5a5048, 0x7a6a5a, 0x4a4a4c, 0x6a5a4a];

export class FremontScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Fremont', label: 'ardenwood, fremont', outdoor: true });
    this.groundFog = 0.15;
    this.groundFogY = 1;
    this.fogExtra = 45; // you can see down the street
    this.eyeHeight = 1.12; // you're a kid here
    this.memory = true;
  }

  async preload() {
    if (this.data) return;
    this.game.hud.toast('Remembering Fremont…', 2500);
    this.data = await (await fetch(fremontUrl)).json();
  }

  groundHeight(x, z) {
    return this.map ? this.map.heightAt(x, z) : 0;
  }

  build() {
    const map = (this.map = new GeoMap(this, this.data, { drawRange: 170, minHeight: -0.4 }));
    this.#where();
    map.buildGround({
      base: '#a08c52',
      colors: {
        residential: '#5f7c3c',
        park: '#4e8a3a',
        grass: '#5a8a40',
        pitch: '#4c9646',
        playground: '#b0946a',
        school: '#6a8a48',
        parking: '#5a5a58',
        paved: '#7a7874',
        water: '#2a4e66',
        wetland: '#556a48',
        meadow: '#a89250',
        reserve: '#a08c4c',
        farmland: '#8a7444',
        orchard: '#5e7038',
        farmyard: '#8a7c5c',
        wood: '#3e5a32',
        scrub: '#7a7844',
        sand: '#c8b88a',
      },
    });
    map.buildWater(0x3a5e78);
    map.buildRoads({});
    this.#buildings();
    this.#trees();
    this.#complex();
    this.#landmarks();
    this.updaters.push(() => map.update(this.game.camera));
  }

  /** Find the real places we hang things on. */
  #where() {
    const m = this.map;
    const road = (n) => m.roads.find((r) => r.n === n);
    const duffy = road('Duffy Terrace');
    const mid = (r) => r.pts[Math.floor(r.pts.length / 2)];
    this.duffy = duffy ? { x: duffy.pts[0][0], z: duffy.pts[0][1], mid: mid(duffy) } : { x: 0, z: 0, mid: [0, 0] };
    // complex buildings: near the Irish-named terraces
    const lanes = m.roads.filter((r) => COMPLEX.includes(r.n));
    this.complexLanes = lanes;
    for (const b of m.buildings) {
      for (const r of lanes) {
        if (r.pts.some(([x, z]) => Math.hypot(x - b.cx, z - b.cz) < 30)) {
          b.complex = true;
          break;
        }
      }
    }
    // the bus stop: on Paseo Padre Parkway, nearest the complex
    const pp = m.roads.filter((r) => r.n === 'Paseo Padre Parkway');
    let best = null;
    for (const r of pp) {
      r.pts.forEach(([x, z], i) => {
        const d = Math.hypot(x - this.duffy.x, z - this.duffy.z);
        if (!best || d < best.d) best = { d, x, z, r, i };
      });
    }
    this.busStop = best;
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
    if (this.homeDoorAt) L.push({ name: 'Home ♥', x: this.homeDoorAt.x, z: this.homeDoorAt.z, color: '#e0306a' });
    poi('Ardenwood Elementary School', 'Ardenwood Elementary', '#2a5a8a');
    poi('The Patterson House', 'Ardenwood Historic Farm');
    poi('Coyote Hills Visitor Center', 'Coyote Hills (snakes!)');
    poi('Deep Creek Park');
    poi('Ardenwood Plaza');
    poi('Coyote Hills Regional Park', 'Coyote Hills');
    return L;
  }

  #buildings() {
    const s = this;
    const rnd = (b, n) => {
      let h = Math.floor(b.cx * 73 + b.cz * 131) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h >>> 0) % 1000) / 1000 + n * 0;
    };
    const C = (hex) => new THREE.Color(hex);
    const mats = {
      townhouse: { wall: s.mat({ map: townhouseWall(), vertexColors: true, affine: 0 }), roof: s.mat({ map: tileRoof(), vertexColors: true, affine: 0 }) },
      house: { wall: s.mat({ map: houseWall(), vertexColors: true, affine: 0 }), roof: s.mat({ map: shingleRoof(), vertexColors: true, affine: 0 }) },
      school: { wall: s.mat({ map: schoolWall(), vertexColors: true, affine: 0 }), roof: s.mat({ map: shingleRoof(), vertexColors: true, affine: 0 }) },
      shop: { wall: s.mat({ map: shopWall(), vertexColors: true, affine: 0 }), roof: s.mat({ color: 0xffffff, vertexColors: true, affine: 0 }) },
      barn: { wall: s.mat({ map: barnWall(), vertexColors: true, affine: 0 }), roof: s.mat({ map: shingleRoof(), vertexColors: true, affine: 0 }) },
    };
    this.map.buildBuildings((b) => {
      const r = rnd(b, 0);
      if (b.complex) return { mat: 'townhouse', h: 6.0, wall: C(0xffffff), roofColor: C(0xa8503a), roof: 'hip', pitch: 0.36, eave: 0.55, bay: 3.4, floor: 3.0 };
      if (b.k === 'school') return { mat: 'school', h: 4.2, wall: C(0xf0e4cc), roofColor: C(0x5a6a7a), roof: b.area > 900 ? 'flat' : 'hip', pitch: 0.18 };
      if (b.k === 'farm') return { mat: 'barn', h: 6.5, wall: C(0xb03a2a), roofColor: C(0x5a4a40), roof: 'hip', pitch: 0.5 };
      if (b.k === 'church') return { mat: 'house', h: 7, wall: C(0xf4f0e8), roofColor: C(0x4a4a4c), roof: 'hip', pitch: 0.6 };
      if (b.k === 'shop' || b.area > 700) return { mat: 'shop', h: b.h ?? 6.5, wall: C(r < 0.5 ? 0xe8dcc8 : 0xd8d4cc), roofColor: C(0x8a8680), roof: 'flat' };
      if (b.area < 45) return { mat: 'house', h: 2.6, wall: C(HOUSE_COLORS[Math.floor(r * 10)]), roofColor: C(ROOF_COLORS[Math.floor(r * 5)]), roof: 'hip', pitch: 0.25, eave: 0.2 };
      const two = b.area > 170 || r > 0.7;
      return { mat: 'house', h: b.h ?? (two ? 5.8 : 3.2), wall: C(HOUSE_COLORS[Math.floor(r * 10)]), roofColor: C(ROOF_COLORS[Math.floor(r * 5)]), roof: 'hip', pitch: 0.4 };
    }, mats);
  }

  #trees() {
    const s = this;
    const trunk = s.mat({ color: 0x5a4a3c });
    const kinds = [];
    // sweetgum and maple in their autumn colours, a few still green, a few bare-ish
    const crowns = [0xc0381e, 0xd8642a, 0xe0a030, 0xa82a1c, 0xd88a2a, 0x7a8a3a];
    for (const c of crowns) {
      const tg = new THREE.CylinderGeometry(0.12, 0.18, 3.2, 5);
      tg.translate(0, 1.6, 0);
      const cg = new THREE.IcosahedronGeometry(1.7, 0);
      cg.scale(1, 1.25, 1);
      cg.translate(0, 4.1, 0);
      const cg2 = new THREE.IcosahedronGeometry(1.2, 0);
      cg2.translate(0.9, 3.5, 0.4);
      kinds.push({ parts: [{ geo: tg, mat: trunk }, { geo: mergeTwo(cg, cg2), mat: s.mat({ color: c }) }] });
    }
    // tall dark pines/redwoods (the evergreens in her photos)
    const pg = new THREE.ConeGeometry(2.0, 9, 6);
    pg.translate(0, 6, 0);
    const pt = new THREE.CylinderGeometry(0.2, 0.3, 2, 5);
    pt.translate(0, 1, 0);
    const pine = { parts: [{ geo: pt, mat: trunk }, { geo: pg, mat: s.mat({ color: 0x2e4a2c }) }] };
    const m = this.map;
    const spots = m.streetTreeSpots(['residential', 'tertiary', 'secondary', 'unclassified', 'service', 'living_street'], { spacing: 12, offset: 2.4 });
    const autumn = spots.filter((_, i) => i % 9 !== 0);
    const pines = spots.filter((_, i) => i % 9 === 0);
    // parks get clumps of trees too
    for (const a of m.areas) {
      if (!['park', 'school', 'grass', 'wood', 'orchard'].includes(a.k)) continue;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const [x, z] of a.pts) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
      const n = Math.min(60, Math.floor(((maxX - minX) * (maxZ - minZ)) / (a.k === 'wood' || a.k === 'orchard' ? 70 : 400)));
      for (let i = 0; i < n; i++) {
        const x = minX + hashF(i * 3 + a.pts.length) * (maxX - minX);
        const z = minZ + hashF(i * 7 + a.pts.length * 5) * (maxZ - minZ);
        if (!insidePoly(x, z, a.pts) || m.insideBuilding(x, z, 2) || m.nearRoad(x, z, 2)) continue;
        (i % 4 === 0 ? pines : autumn).push([x, z, 0.9 + hashF(i) * 0.5, hashF(i * 11) * 6]);
      }
    }
    m.plantTrees(autumn, kinds);
    m.plantTrees(pines, [pine]);
    this.treeSpots = autumn;
    // fallen leaves under the street trees
    const leafGeo = new THREE.PlaneGeometry(4.2, 4.2);
    leafGeo.rotateX(-Math.PI / 2);
    leafGeo.translate(0, 0.12, 0);
    const leafMat = s.mat({ map: leafLitter(), alphaTest: 0.5 });
    leafMat.polygonOffset = true;
    leafMat.polygonOffsetFactor = -2;
    leafMat.polygonOffsetUnits = -6;
    m.plantTrees(
      autumn.map(([x, z], i) => [x + (hashF(i * 17) - 0.5) * 2, z + (hashF(i * 19) - 0.5) * 2, 0.8 + hashF(i) * 0.6, hashF(i * 23) * 6]),
      [{ parts: [{ geo: leafGeo, mat: leafMat }] }],
    );
  }

  /** Her complex: globe street lamps, red-brick crosswalks, the DUFFY sign, home. */
  #complex() {
    const m = this.map;
    const glow = this.mat({ color: 0xfff4dc, unlit: true });
    const pole = this.mat({ color: 0x1a1a1a });
    let n = 0;
    for (const r of this.complexLanes) {
      for (let i = 0; i < r.pts.length; i += 3) {
        const [x, z] = r.pts[i];
        const nx = r.pts[Math.min(i + 1, r.pts.length - 1)][0] - r.pts[Math.max(0, i - 1)][0];
        const nz = r.pts[Math.min(i + 1, r.pts.length - 1)][1] - r.pts[Math.max(0, i - 1)][1];
        const l = Math.hypot(nx, nz) || 1;
        const lx = x + (-nz / l) * (r.w / 2 + 1.2);
        const lz = z + (nx / l) * (r.w / 2 + 1.2);
        if (m.insideBuilding(lx, lz, 0.5)) continue;
        const y = m.heightAt(lx, lz);
        this.box(0.09, 3.2, 0.09, pole, lx, y + 1.6, lz, { collide: false });
        const g = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), glow);
        g.position.set(lx, y + 3.35, lz);
        this.root.add(g);
        if (n++ % 3 === 0) this.addLight({ position: [lx, y + 3.2, lz], color: 0xffe8c0, range: 9, intensity: 0.8 });
      }
    }
    // the street sign she photographed
    const d = this.duffy;
    const y = m.heightAt(d.x + 3, d.z + 3);
    this.box(0.07, 2.6, 0.07, this.mat({ color: 0x8a8a8a }), d.x + 3, y + 1.3, d.z + 3, { collide: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.24), this.mat({ map: signTexture(['DUFFY TER'], { bg: '#1a6a3a', fg: '#ffffff', w: 80, h: 20 }), doubleSide: true }));
    sign.position.set(d.x + 3, y + 2.6, d.z + 3);
    this.root.add(sign);
    // home: the complex building closest to the sign
    const home = m.buildings.filter((b) => b.complex).sort((a, b) => Math.hypot(a.cx - d.x, a.cz - d.z) - Math.hypot(b.cx - d.x, b.cz - d.z))[0];
    this.home = home;
    if (home) this.#homeDoor(home);
  }

  /** Put a door on the home's wall that faces the nearest lane. */
  #homeDoor(b) {
    const m = this.map;
    let tx = this.duffy.x;
    let tz = this.duffy.z;
    let bd = Infinity;
    for (const r of this.complexLanes) {
      for (const [x, z] of r.pts) {
        const d = Math.hypot(x - b.cx, z - b.cz);
        if (d < bd) {
          bd = d;
          tx = x;
          tz = z;
        }
      }
    }
    const w = m.wallFacing(b, tx, tz);
    const best = w && { mx: w.x, mz: w.z, nx: w.nx, nz: w.nz };
    if (!best) return;
    const y = b.ground ?? m.heightAt(best.mx, best.mz);
    const yaw = Math.atan2(best.nx, best.nz);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.08), this.mat({ color: 0x5a3a24 }));
    door.position.set(best.mx + best.nx * 0.05, y + 1.05, best.mz + best.nz * 0.05);
    door.rotation.y = yaw;
    this.root.add(door);
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 5, 10), this.mat({ color: 0x3a6a2a }));
    wreath.position.set(best.mx + best.nx * 0.1, y + 1.55, best.mz + best.nz * 0.1);
    wreath.rotation.y = yaw;
    this.root.add(wreath);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.12), this.mat({ color: 0xffe0a0, unlit: true }));
    lamp.position.set(best.mx + best.nx * 0.1 + Math.cos(yaw) * 0.8, y + 2.0, best.mz + best.nz * 0.1 - Math.sin(yaw) * 0.8);
    this.root.add(lamp);
    this.addLight({ position: [best.mx + best.nx * 1.2, y + 2.1, best.mz + best.nz * 1.2], color: 0xffd8a0, range: 6, intensity: 1 });
    this.addInteractable(door, { prompt: 'Go home', action: () => this.game.changeScene('Home', 'door') });
    this.addSpawn('home_door', [best.mx + best.nx * 1.6, y, best.mz + best.nz * 1.6], Math.atan2(-best.nx, -best.nz) + Math.PI);
    this.homeDoorAt = { x: best.mx, z: best.mz, nx: best.nx, nz: best.nz, y };
  }

  #landmarks() {
    const m = this.map;
    const g = this.game;
    // the bus stop on Paseo Padre
    const bs = this.busStop;
    if (bs) {
      const r = bs.r;
      const a = r.pts[Math.max(0, bs.i - 1)];
      const b = r.pts[Math.min(r.pts.length - 1, bs.i + 1)];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1;
      // the side of the road toward the complex
      let nx = -dz / l;
      let nz = dx / l;
      if (Math.hypot(bs.x + nx * 5 - this.duffy.x, bs.z + nz * 5 - this.duffy.z) > Math.hypot(bs.x - nx * 5 - this.duffy.x, bs.z - nz * 5 - this.duffy.z)) {
        nx = -nx;
        nz = -nz;
      }
      const sx = bs.x + nx * (r.w / 2 + 2.6);
      const sz = bs.z + nz * (r.w / 2 + 2.6);
      const y = m.heightAt(sx, sz);
      const yaw = Math.atan2(dx, dz);
      const stop = this.place('bus_stop_shelter', { x: sx, y, z: sz, rotY: yaw });
      void stop;
      this.box(0.08, 2.8, 0.08, this.mat({ color: 0x6a6a6a }), sx + (dx / l) * 2.2, y + 1.4, sz + (dz / l) * 2.2, { collide: false });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), this.mat({ map: signTexture(['BUS', 'STOP'], { bg: '#1a5a2a', fg: '#ffffff', w: 48, h: 48 }), doubleSide: true }));
      sign.position.set(sx + (dx / l) * 2.2, y + 2.6, sz + (dz / l) * 2.2);
      sign.rotation.y = yaw;
      this.root.add(sign);
      // arrive on the sidewalk, looking toward home
      const ax = sx + nx * 1.2;
      const az = sz + nz * 1.2;
      const look = Math.atan2(-(this.duffy.x - ax), -(this.duffy.z - az));
      this.addSpawn('bus_stop', [ax, y, az], look);
      this.addSpawn('default', [ax, y, az], look);
      this.busStopAt = { x: sx, z: sz, y, yaw, nx, nz, roadX: bs.x, roadZ: bs.z, dx: dx / l, dz: dz / l };
      const post = this.box(0.6, 1.8, 0.6, this.mat({ color: 0x1a5a2a }), sx, y + 0.9, sz, { collide: false });
      post.visible = false;
      this.addInteractable(post, { prompt: 'Wait for the bus (to Pine Hollow and other memories)', range: 3, action: () => g.memories?.openBus(this) });
    }
    // school sign at Ardenwood Elementary
    const school = m.poi('Ardenwood Elementary School');
    if (school) {
      const y = m.heightAt(school.x, school.z);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), this.mat({ map: signTexture(['ARDENWOOD', 'ELEMENTARY SCHOOL'], { bg: '#2a5a8a', fg: '#ffffff', w: 128, h: 36 }), doubleSide: true }));
      // stand it on the school grounds' street side: nearest road
      const rd = m.nearRoad(school.x, school.z, 120);
      let px = school.x;
      let pz = school.z;
      if (rd) {
        const t = Math.max(0, Math.min(1, ((school.x - rd.ax) * (rd.bx - rd.ax) + (school.z - rd.az) * (rd.bz - rd.az)) / ((rd.bx - rd.ax) ** 2 + (rd.bz - rd.az) ** 2 || 1)));
        const qx = rd.ax + (rd.bx - rd.ax) * t;
        const qz = rd.az + (rd.bz - rd.az) * t;
        const l = Math.hypot(school.x - qx, school.z - qz) || 1;
        px = qx + ((school.x - qx) / l) * (rd.w / 2 + 6);
        pz = qz + ((school.z - qz) / l) * (rd.w / 2 + 6);
        sign.rotation.y = Math.atan2(qx - px, qz - pz);
      }
      sign.position.set(px, m.heightAt(px, pz) + 1.2, pz);
      this.root.add(sign);
      this.box(3.4, 0.4, 0.3, this.mat({ color: 0x8a8070 }), px, m.heightAt(px, pz) + 0.2, pz, { collide: false, rotY: sign.rotation.y });
      this.addSpawn('school', [px, y, pz], sign.rotation.y);
    }
    // playground equipment on every mapped playground
    for (const a of m.areas) {
      if (a.k !== 'playground') continue;
      const cx = a.pts.reduce((s, p) => s + p[0], 0) / a.pts.length;
      const cz = a.pts.reduce((s, p) => s + p[1], 0) / a.pts.length;
      const y = m.heightAt(cx, cz);
      this.place('play_structure', { x: cx, y, z: cz, rotY: cx % 3 });
      this.place('swing_set', { x: cx + 6, y, z: cz + 2, rotY: 0.3 });
      this.place('slide', { x: cx - 5, y, z: cz - 3, rotY: 1.2 });
    }
    // Ardenwood Historic Farm animals
    const farm = m.poi('Chicken coop');
    if (farm) {
      for (let i = 0; i < 6; i++) this.place('chicken', { x: farm.x + 4 + (i % 3) * 1.4, y: m.heightAt(farm.x, farm.z), z: farm.z + 3 + Math.floor(i / 3) * 1.2, rotY: i });
    }
    const pigs = m.poi('Pigs');
    if (pigs) for (let i = 0; i < 3; i++) this.place('pig', { x: pigs.x + i * 1.6, y: m.heightAt(pigs.x, pigs.z), z: pigs.z + (i % 2), rotY: i * 2 });
    // Coyote Hills visitor center door → the nature center (snakes!)
    const vc = m.poi('Coyote Hills Visitor Center');
    if (vc) {
      this.visitorCenter = vc;
      // the real building (or a stand-in if it isn't mapped), door on the wall facing the parking lot
      const b = m.buildingAt(vc.x, vc.z, 35);
      const lot = m.areas.filter((a) => a.k === 'parking').map((a) => [a.pts.reduce((s, p) => s + p[0], 0) / a.pts.length, a.pts.reduce((s, p) => s + p[1], 0) / a.pts.length]).sort((p, q) => Math.hypot(p[0] - vc.x, p[1] - vc.z) - Math.hypot(q[0] - vc.x, q[1] - vc.z))[0] ?? [vc.x, vc.z + 30];
      let w = b && m.wallFacing(b, lot[0], lot[1]);
      if (!w) {
        const y0 = m.heightAt(vc.x, vc.z);
        this.box(14, 4.2, 9, this.mat({ map: this.tex('planks', 4, 1), color: 0x8a6a4a }), vc.x, y0 + 2.1, vc.z);
        w = { x: vc.x, z: vc.z + 4.5, nx: 0, nz: 1, yaw: 0 };
      }
      const y = b?.ground ?? m.heightAt(w.x, w.z);
      const door = this.box(1.6, 2.3, 0.1, this.mat({ color: 0x3a2a1c }), w.x + w.nx * 0.08, y + 1.15, w.z + w.nz * 0.08, { collide: false, rotY: w.yaw });
      this.addInteractable(door, { prompt: 'Go into the visitor center (there are snakes!)', action: () => g.changeScene('NatureCenter', 'door') });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.7), this.mat({ map: signTexture(['COYOTE HILLS VISITOR CENTER'], { bg: '#4a3a24', fg: '#f0e0b0', w: 160, h: 28 }), doubleSide: true }));
      sign.position.set(w.x + w.nx * 0.1, y + 3.0, w.z + w.nz * 0.1);
      sign.rotation.y = w.yaw;
      this.root.add(sign);
      this.addSpawn('visitor_center', [w.x + w.nx * 3, y, w.z + w.nz * 3], w.yaw + Math.PI);
    }
  }
}

function mergeTwo(a, b) {
  const pa = a.toNonIndexed();
  const pb = b.toNonIndexed();
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(pa.attributes.position.count * 3 + pb.attributes.position.count * 3);
  pos.set(pa.attributes.position.array, 0);
  pos.set(pb.attributes.position.array, pa.attributes.position.count * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function hashF(n) {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  n = Math.imul(n, 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
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
