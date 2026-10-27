import * as THREE from 'three';
import { GeoScene, rnd } from './GeoScene.js';
import { buildGoldenGate } from '../world/Bridge.js';
import url from '../assets/geo/goldengate.json?url';

/**
 * The Golden Gate
 * ---------------
 * The real strait (OpenStreetMap + elevation): the Presidio bluffs, Fort
 * Point under the south anchorage, the Marin Headlands across the water,
 * and the bridge itself — full size, walkable, built along its real line.
 * The overlook from her photo: fog over the water, the bridge going off into
 * it, and a slope of wildflowers in front (yellow mustard, white Queen
 * Anne's lace, purple). Fog banks drift through; the foghorn calls.
 */
export class GoldenGateScene extends GeoScene {
  constructor(game) {
    super(game, {
      name: 'GoldenGate',
      label: 'the golden gate',
      url,
      sea: { level: 0, color: 0x4a6a78 },
      minHeight: -8,
      base: '#6a7448',
      colors: { scrub: '#5a6a3a', grass: '#6a8040', parking: '#6a6a66', rock: '#7a7468', sand: '#c8b890', wood: '#3a5030' },
      fogExtra: 200,
      groundFog: 0.6,
      groundFogY: 6,
      treeColors: [0x2e4a2c, 0x3a5a32, 0x4a6a3a],
      skipRoad: (r) => /Golden Gate Bridge/.test(r.n ?? '') && r.b,
    });
  }

  style(b) {
    if (/Fort Point/i.test(b.n ?? '')) return { mat: 'brick', h: 14, wall: new THREE.Color(0xc87a5a), roofColor: new THREE.Color(0x6a6a66), roof: 'flat' };
    const r = rnd(b);
    return { mat: 'house', h: b.area > 400 ? 7 : 4.5, wall: new THREE.Color(r < 0.5 ? 0xf0ece0 : 0xe8dcc8), roofColor: new THREE.Color(0xa84a34), roof: 'hip', pitch: 0.35 };
  }

  landmarks() {
    this.farView = 4000; // see the landmarks on the horizon
    const m = this.map;
    const g = this.game;
    // the bridge, along the real road line
    const line = m.roads.filter((r) => /Golden Gate Bridge/.test(r.n ?? '') && r.b).sort((a, b) => b.pts.length - a.pts.length)[0];
    let S;
    let N;
    if (line) {
      const pts = line.pts;
      const a = new THREE.Vector3(pts[0][0], 0, pts[0][1]);
      const b = new THREE.Vector3(pts[pts.length - 1][0], 0, pts[pts.length - 1][1]);
      const [south, north] = a.z > b.z ? [a, b] : [b, a];
      const L = south.distanceTo(north);
      const dir = north.clone().sub(south).normalize();
      const side = Math.max(0, (L - 1280) / 2);
      S = south.clone().addScaledVector(dir, side);
      N = S.clone().addScaledVector(dir, Math.min(1280, L));
    } else {
      const o = this.data.origin;
      const MX = 111320 * Math.cos((o.lat * Math.PI) / 180);
      S = new THREE.Vector3((-122.4771 - o.lon) * MX, 0, -(37.8106 - o.lat) * 110540);
      N = new THREE.Vector3((-122.4797 - o.lon) * MX, 0, -(37.827 - o.lat) * 110540);
    }
    const br = buildGoldenGate(this, S, N, { deckY: 67, fog: 0.18 });
    this.bridge = br;
    // a spawn on the bridge's east sidewalk, just off the south tower
    const along = br.dir.clone();
    const right = new THREE.Vector3(along.z, 0, -along.x);
    const onDeck = S.clone().addScaledVector(along, 120).addScaledVector(right, -11.5);
    this.addSpawn('bridge', [onDeck.x, br.deckY + 0.5, onDeck.z], Math.atan2(-along.x, -along.z) + Math.PI);
    // the overlook from the photo: on the bluff southeast of the south tower
    let best = null;
    for (let a = 0; a < 24; a++) {
      for (const d of [260, 330, 400, 480]) {
        const ang = (a / 24) * Math.PI * 2;
        const x = S.x + Math.cos(ang) * d;
        const z = S.z + Math.sin(ang) * d;
        const h = m.heightAt(x, z);
        if (h < 25 || h > 90 || m.insideBuilding(x, z, 3) || z < S.z) continue;
        // facing the bridge, looking over the water: prefer views with water between
        const mid = m.heightAt((x + N.x) / 2, (z + N.z) / 2);
        const score = (mid < 1 ? 0 : 100) + Math.abs(d - 330) * 0.1 + Math.abs(h - 45) * 0.2;
        if (!best || score < best.score) best = { score, x, z, h };
      }
    }
    if (best) {
      const look = Math.atan2(-(N.x * 0.5 + S.x * 0.5 - best.x), -(N.z * 0.5 + S.z * 0.5 - best.z));
      this.addSpawn('overlook', [best.x, best.h, best.z], look);
      this.busStop(best.x + 9, best.z + 6, look);
      this.#wildflowers(best.x, best.z, look);
      const bench = this.place('picnic_table', { x: best.x - 3, y: best.h, z: best.z + 2, rotY: look });
      this.memoryNote(bench, 'Sit a minute', "The fog rolls in under the bridge like it's breathing.\n\nYou can only see half of it, and somehow that makes it more beautiful.\n\nNot everything has to be fully visible to be real.");
    } else this.busStop(S.x + 200, S.z + 150, 0);
    this.#fogBanks();
    this.hornT = 4;
    void g;
  }

  /** Yellow mustard, white Queen Anne's lace, purple — the slope in the photo. */
  #wildflowers(cx, cz, look) {
    const m = this.map;
    const spots = { y: [], w: [], p: [], g: [] };
    let n = 0;
    const fx = -Math.sin(look);
    const fz = -Math.cos(look);
    for (let i = 0; i < 2600; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const r = Math.sqrt(i / 2600) * 26;
      let x = cx + Math.cos(a) * r;
      let z = cz + Math.sin(a) * r;
      // mostly in front of the overlook (downhill, toward the bridge)
      if ((x - cx) * fx + (z - cz) * fz < -3) {
        x = cx + (x - cx) * -0.6;
        z = cz + (z - cz) * -0.6;
      }
      if (m.nearRoad(x, z, 0.5)) continue;
      const k = n++ % 9;
      (k < 4 ? spots.y : k < 6 ? spots.w : k < 7 ? spots.p : spots.g).push([x, z, 0.7 + (i % 7) / 10, i]);
    }
    const stem = this.mat({ color: 0x3a6a2a });
    const flower = (color, h, r) => {
      const st = new THREE.CylinderGeometry(0.01, 0.015, h, 3);
      st.translate(0, h / 2, 0);
      const fl = new THREE.IcosahedronGeometry(r, 0);
      fl.scale(1, 0.5, 1);
      fl.translate(0, h, 0);
      return { parts: [{ geo: st, mat: stem }, { geo: fl, mat: this.mat({ color }) }] };
    };
    m.plantTrees(spots.y, [flower(0xf0d020, 0.7, 0.07)]);
    m.plantTrees(spots.w, [flower(0xf8f8f0, 0.6, 0.11)]);
    m.plantTrees(spots.p, [flower(0x8a5ac8, 0.5, 0.06)]);
    const bush = new THREE.IcosahedronGeometry(0.5, 0);
    bush.scale(1, 0.6, 1);
    bush.translate(0, 0.25, 0);
    m.plantTrees(spots.g, [{ parts: [{ geo: bush, mat: this.mat({ color: 0x2e5a26 }) }] }]);
  }

  #fogBanks() {
    this.fogs = [];
    const mat = this.mat({ color: 0xe8ecf0, opacity: 0.38, unlit: true, doubleSide: true, depthWrite: false });
    for (let i = 0; i < 14; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(420, 60), mat);
      f.rotation.x = -Math.PI / 2 + 0.05;
      this.root.add(f);
      this.fogs.push({ f, ph: i * 37, y: 8 + (i % 4) * 9 });
    }
  }

  update(dt, time) {
    super.update(dt, time);
    const g = this.game;
    const B = this.bridge;
    if (this.fogs && B) {
      const mid = B.group.position.clone().addScaledVector(B.dir, B.span / 2);
      for (const f of this.fogs) {
        const t = ((time * 6 + f.ph * 20) % 1600) - 800;
        f.f.position.set(mid.x - t, f.y, mid.z + Math.sin(f.ph) * 600);
      }
    }
    if ((this.hornT -= dt) <= 0) {
      this.hornT = 22 + Math.random() * 14;
      g.audio.oneShot('foghorn', { volume: 0.45 });
    }
  }
}
