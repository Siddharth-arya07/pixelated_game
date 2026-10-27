import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { GeoMap } from '../world/GeoMap.js';
import { houseWall, shopWall, townhouseWall, barnWall, tileRoof, shingleRoof } from '../world/GeoTextures.js';
import { signTexture } from '../core/Procedural.js';

/**
 * GeoScene — a real place from tools/geo_build.py, as a memory you walk
 * around as a kid (Pier 39, the Golden Gate, Griffith, Niagara). Subclasses
 * give the map URL and the look, and add their landmarks in `landmarks()`.
 */
export class GeoScene extends BaseScene {
  constructor(game, { name, label, url, ...cfg }) {
    super(game, { name, label, outdoor: true });
    this.url = url;
    this.cfg = cfg;
    this.eyeHeight = 1.12;
    this.memory = true;
    this.fogExtra = cfg.fogExtra ?? 45;
    this.groundFog = cfg.groundFog ?? 0.2;
    this.groundFogY = cfg.groundFogY ?? 1;
  }

  async preload() {
    if (this.data) return;
    this.game.hud.toast(`Remembering ${this.label}…`, 2500);
    this.data = await (await fetch(this.url)).json();
  }

  groundHeight(x, z) {
    return this.map ? this.map.surfaceAt(x, z) : 0;
  }

  build() {
    const c = this.cfg;
    const map = (this.map = new GeoMap(this, this.data, { drawRange: c.drawRange ?? 200, minHeight: c.minHeight ?? -1, skipRoad: c.skipRoad }));
    map.buildGround({ base: c.base ?? '#7a8a50', colors: { ...GROUND, ...(c.colors ?? {}) } });
    if (c.sea) map.buildSea(c.sea);
    if (c.decks) map.buildDecks({ mat: this.mat({ map: this.tex('planks', 1, 1), color: 0xb0905a }), edge: this.mat({ map: this.tex('planks', 1, 1), color: 0x5a4a38 }), height: c.decks.height });
    if (c.draped) map.buildDrapedWater({ mat: this.mat({ map: this.tex('water', 1, 1), color: c.draped.color ?? 0x4a8a8a, scroll: [0, -0.35] }) });
    else if (!c.sea) map.buildWater();
    map.buildRoads(this.roadMats?.() ?? {});
    this.#buildings();
    if (c.trees !== false) this.#trees();
    this.landmarks();
    this.updaters.push(() => map.update(this.game.camera));
  }

  /** Override per place. */
  landmarks() {}

  /** City buildings: painted stucco/clapboard, flat or hip roofs. */
  style(b) {
    const r = rnd(b);
    const C = (h) => new THREE.Color(h);
    const P = this.cfg.palette ?? PASTEL;
    if (b.k === 'house') return { mat: 'house', h: b.h ?? (r > 0.5 ? 6 : 3.4), wall: C(P[Math.floor(r * P.length)]), roofColor: C(this.cfg.roof ?? 0x8a4a34), roof: 'hip', pitch: 0.32 };
    if (b.k === 'shed' || b.area < 30) return { mat: 'house', h: 2.6, wall: C(0xd8d0c0), roofColor: C(0x6a6460), roof: 'hip', pitch: 0.2 };
    const h = b.h ?? (b.area > 2000 ? 12 : b.area > 600 ? 9 : 6.5);
    return { mat: r < 0.5 ? 'shop' : 'stucco', h, wall: C(P[Math.floor(r * P.length)]), roofColor: C(0x8a8680), roof: 'flat' };
  }

  #buildings() {
    const s = this;
    const mats = {
      house: { wall: s.mat({ map: houseWall(), vertexColors: true, affine: 0 }), roof: s.mat({ map: tileRoof(), vertexColors: true, affine: 0 }) },
      stucco: { wall: s.mat({ map: townhouseWall(), vertexColors: true, affine: 0 }), roof: s.mat({ color: 0xffffff, vertexColors: true, affine: 0 }) },
      shop: { wall: s.mat({ map: shopWall(), vertexColors: true, affine: 0 }), roof: s.mat({ color: 0xffffff, vertexColors: true, affine: 0 }) },
      wood: { wall: s.mat({ map: barnWall(), vertexColors: true, affine: 0 }), roof: s.mat({ map: shingleRoof(), vertexColors: true, affine: 0 }) },
      brick: { wall: s.mat({ map: s.tex('brick', 1, 1), vertexColors: true, affine: 0 }), roof: s.mat({ color: 0xffffff, vertexColors: true, affine: 0 }) },
    };
    this.map.buildBuildings((b) => this.style(b), mats);
  }

  #trees() {
    const s = this;
    const trunk = s.mat({ color: 0x5a4a3c });
    const kinds = (this.cfg.treeColors ?? [0x4a7a3a, 0x3e6a32, 0x5a8a40]).map((c) => {
      const tg = new THREE.CylinderGeometry(0.12, 0.18, 3, 5);
      tg.translate(0, 1.5, 0);
      const cg = new THREE.IcosahedronGeometry(1.8, 0);
      cg.scale(1, 1.2, 1);
      cg.translate(0, 3.9, 0);
      return { parts: [{ geo: tg, mat: trunk }, { geo: cg, mat: s.mat({ color: c }) }] };
    });
    const spots = this.map.streetTreeSpots(['residential', 'tertiary', 'secondary', 'pedestrian', 'footway'], { spacing: this.cfg.treeSpacing ?? 18, offset: 2.4 });
    for (let i = 0; i < this.data.trees.length; i += 2) spots.push([this.data.trees[i] / 10, this.data.trees[i + 1] / 10, 1, i]);
    this.map.plantTrees(spots, kinds);
  }

  /** A bus stop (shelter, sign, the bus menu) and the arrival spawn. */
  busStop(x, z, yaw) {
    const y = this.groundHeight(x, z);
    this.place('bus_stop_shelter', { x, y, z, rotY: yaw });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), this.mat({ map: signTexture(['BUS', 'STOP'], { bg: '#1a5a2a', fg: '#ffffff', w: 48, h: 48 }), doubleSide: true }));
    const sx = x + Math.cos(yaw) * 2.3;
    const sz = z - Math.sin(yaw) * 2.3;
    this.box(0.08, 2.8, 0.08, this.mat({ color: 0x6a6a6a }), sx, y + 1.4, sz, { collide: false });
    sign.position.set(sx, y + 2.6, sz);
    sign.rotation.y = yaw;
    this.root.add(sign);
    this.interactVolume(x, y + 1, z, 3.6, 2, 2, { prompt: 'Wait for the bus (other memories, or home)', range: 3, action: () => this.game.memories?.openBus(this) });
    const fx = x + Math.sin(yaw) * 2.2;
    const fz = z + Math.cos(yaw) * 2.2;
    this.addSpawn('bus_stop', [fx, this.groundHeight(fx, fz), fz], yaw + Math.PI);
    this.addSpawn('default', [fx, this.groundHeight(fx, fz), fz], yaw + Math.PI);
  }

  /** Text sign on a post. */
  signPost(x, z, lines, yaw = 0, { bg = '#2a4a6a', fg = '#ffffff', w = 2.4, h = 0.7, y0 = 1.6 } = {}) {
    const y = this.groundHeight(x, z);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat({ map: signTexture(lines, { bg, fg, w: 128, h: Math.round((128 * h) / w) }), doubleSide: true }));
    m.position.set(x, y + y0, z);
    m.rotation.y = yaw;
    this.root.add(m);
    this.box(0.08, y0, 0.08, this.mat({ color: 0x5a5a5a }), x, y + y0 / 2, z, { collide: false });
    return m;
  }

  /** Read-on-E memory text attached to an object. */
  memoryNote(obj, prompt, text) {
    this.addInteractable(obj, { prompt, range: 3, action: () => this.game.openUI(() => this.game.note.show(text)) });
  }
}

export const GROUND = {
  residential: '#6a7a4a',
  park: '#4e8a3a',
  grass: '#5a8a40',
  pitch: '#4c9646',
  playground: '#b0946a',
  school: '#6a8a48',
  parking: '#5a5a58',
  paved: '#8a8680',
  water: '#2a4e66',
  wetland: '#556a48',
  meadow: '#a89250',
  reserve: '#a08c4c',
  farmland: '#8a7444',
  orchard: '#5e7038',
  wood: '#3e5a32',
  scrub: '#6a7040',
  sand: '#d0c090',
  rock: '#7a7268',
  pier: '#8a7050',
  attraction: '#8a8680',
};

const PASTEL = [0xf0e0c8, 0xe8d0d0, 0xd8e0e8, 0xf0ecd8, 0xe0d8c0, 0xd0d8c8, 0xf4e8e0, 0xc8d0d8, 0xe8e0f0, 0xf0d8b8];

export function rnd(b) {
  let h = Math.floor(b.cx * 73 + b.cz * 131) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h >>> 0) % 1000) / 1000;
}
