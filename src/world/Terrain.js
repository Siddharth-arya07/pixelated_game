import * as THREE from 'three';
import { MAP } from './MapLayout.js';

/**
 * Terrain
 * -------
 * Builds the overworld heightfield from MapLayout:
 *   hills (fbm noise) + a mountain ridge to the north + the sea to the east +
 *   flattened plateaus (house, harbor, summit gas station, lighthouse cliff),
 * then carves the roads in (cut and fill) and records a surface map
 * (grass / asphalt / gravel / sand / rock) used for vehicle traction.
 *
 *   terrain.heightAt(x, z)     ground height (bilinear, matches the mesh)
 *   terrain.surfaceAt(x, z)    'grass' | 'asphalt' | 'gravel' | 'sand' | 'rock'
 *   terrain.slopeAt(x, z)      steepness 0 (flat) .. 1 (vertical)
 *   terrain.roadDistance(x, z) metres to the nearest road centreline
 *   terrain.chunks             meshes (100 m squares) for frustum/fog culling
 *   terrain.roads              [{ name, surface, width, samples: [{x,y,z,t}] }]
 */
const SURF = ['grass', 'asphalt', 'gravel', 'sand', 'rock'];
const SURF_ID = Object.fromEntries(SURF.map((s, i) => [s, i]));

export class Terrain {
  constructor() {
    this.size = MAP.size;
    this.spacing = MAP.spacing;
    this.n = Math.round(this.size / this.spacing) + 1; // vertices per side
    this.half = this.size / 2;
    this.heights = new Float32Array(this.n * this.n);
    this.surface = new Uint8Array(this.n * this.n);
    this.noise = makeNoise(1337);
    this.roads = [];
    this.poi = {};
    this.chunks = [];
    this._buckets = new Map();
  }

  // ---------------------------------------------------------------------------
  // Height model
  // ---------------------------------------------------------------------------

  /** Natural ground height before plateaus and roads. */
  baseHeight(x, z) {
    const nz = this.noise;
    let h = 11 + fbm(nz, x / 260, z / 260, 4) * 8 + fbm(nz, x / 55 + 40, z / 55, 2) * 1.6;

    // Mountain ridge to the north (contours run roughly east–west, so the
    // switchbacks cross them diagonally).
    const sz = smooth(-28, -245, z);
    const ridgeX = Math.exp(-(((x + 15) / 260) ** 2));
    h += 100 * sz * (0.55 + 0.45 * ridgeX);
    h += ridged(nz, x / 90, z / 90) * 16 * sz;
    h += 45 * smooth(-270, -440, z); // peaks behind the summit

    // Hills closing off the west/south edges.
    // (gap in the west wall where the lake road leaves the map)
    const lakeGap = smooth(20, 60, Math.abs(z - MAP.poi.lakeExit.z));
    const edge = Math.max(smooth(380, 495, -x) * lakeGap, smooth(380, 495, z));
    h += edge * 45 * (0.7 + 0.3 * fbm(nz, x / 40, z / 40, 2));

    // Sea to the east, with a shelving beach.
    const c = MAP.coastX(z);
    const s = smooth(c - 30, c + 50, x);
    h = h * (1 - s) + -13 * s;
    return h;
  }

  /** Plateau target heights are fixed once from the base terrain. */
  #heightWithPlateaus(x, z) {
    let h = this.baseHeight(x, z);
    for (const p of this.#plateaus) {
      const d = Math.hypot(x - p.x, z - p.z);
      const w = smooth(p.radius + p.falloff, p.radius, d);
      if (w > 0) h = h * (1 - w) + p.y * w;
    }
    return h;
  }

  #plateaus = [];

  build() {
    const { poi } = MAP;
    // Plateaus: house lot, summit gas station, harbor (just above the sea),
    // and the lighthouse cliff standing out of the water.
    const P = (name, y, radius, falloff) => {
      const p = { name, x: poi[name].x, z: poi[name].z, y, radius, falloff };
      this.#plateaus.push(p);
      this.poi[name] = p;
    };
    P('house', this.baseHeight(poi.house.x, poi.house.z), 32, 25);
    P('gasStation', this.baseHeight(poi.gasStation.x, poi.gasStation.z) + 2, poi.gasStation.radius, 14);
    P('harbor', 1.6, poi.harbor.radius, 22);
    P('diner', this.baseHeight(poi.diner.x, poi.diner.z), poi.diner.radius, 12);
    P('drivein', this.baseHeight(poi.drivein.x, poi.drivein.z), poi.drivein.radius, 14);
    P('playground', this.baseHeight(poi.playground.x, poi.playground.z), poi.playground.radius, 12);
    P('lighthouse', 16, poi.lighthouse.radius, 9); // short falloff = cliffs
    P('airfield', this.baseHeight(poi.airfield.x, poi.airfield.z), poi.airfield.radius, 30);
    P('mine', this.baseHeight(poi.mine.x, poi.mine.z + 10), poi.mine.radius, 10);
    this.poi.junction = { ...poi.junction, y: 0 };
    this.poi.lakeExit = { ...poi.lakeExit, y: 0 };

    // 1. raw heights
    const { n, spacing, half } = this;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -half + i * spacing;
        const z = -half + j * spacing;
        this.heights[j * n + i] = this.#heightWithPlateaus(x, z);
        this.surface[j * n + i] = SURF_ID.grass;
      }
    }

    // 2. roads: sample splines, smooth their heights, carve cut-and-fill
    for (const def of MAP.roads) this.roads.push(this.#buildRoad(def));
    for (const road of this.roads) this.#carve(road);
    for (const k of ['junction', 'lakeExit']) this.poi[k].y = this.heightAt(this.poi[k].x, this.poi[k].z);

    // 3. sand + rock surfaces from height and slope
    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const idx = j * n + i;
        if (this.surface[idx] !== SURF_ID.grass) continue;
        const h = this.heights[idx];
        if (h < 2.2) this.surface[idx] = SURF_ID.sand;
        else if (this.#slopeIdx(i, j) > 0.62) this.surface[idx] = SURF_ID.rock;
      }
    }
    return this;
  }

  #buildRoad(def) {
    const pts = def.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const len = curve.getLength();
    const count = Math.max(2, Math.round(len / 2));
    const raw = curve.getSpacedPoints(count);
    // Height follows the ground, smoothed over ±24 m so it doesn't bump.
    const hs = raw.map((p) => this.#heightWithPlateaus(p.x, p.z));
    const win = 12;
    const samples = raw.map((p, k) => {
      let s = 0;
      let c = 0;
      for (let m = Math.max(0, k - win); m <= Math.min(raw.length - 1, k + win); m++) {
        s += hs[m];
        c++;
      }
      return { x: p.x, z: p.z, y: Math.max(1.4, s / c), t: k / (raw.length - 1) };
    });
    // Endpoints take the unsmoothed ground height so roads that meet at a
    // junction (or a plateau) agree exactly.
    for (const s of [samples[0], samples.at(-1)]) s.y = Math.max(1.4, this.#heightWithPlateaus(s.x, s.z));
    limitGrade(samples, def.maxGrade ?? 0.1);
    const road = { ...def, samples, length: len };
    for (const s of samples) {
      const key = this.#bucketKey(s.x, s.z);
      if (!this._buckets.has(key)) this._buckets.set(key, []);
      this._buckets.get(key).push({ s, road });
    }
    return road;
  }

  #carve(road) {
    const { n, spacing, half } = this;
    const hw = road.width / 2;
    const reach = hw + 7;
    const best = new Map(); // vertex index -> { d, y, s }
    for (const s of road.samples) {
      const i0 = Math.floor((s.x - reach + half) / spacing);
      const i1 = Math.ceil((s.x + reach + half) / spacing);
      const j0 = Math.floor((s.z - reach + half) / spacing);
      const j1 = Math.ceil((s.z + reach + half) / spacing);
      for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) {
        for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) {
          const x = -half + i * spacing;
          const z = -half + j * spacing;
          const d = Math.hypot(x - s.x, z - s.z);
          if (d > reach) continue;
          const idx = j * n + i;
          const b = best.get(idx);
          if (!b || d < b.d) best.set(idx, { d, y: s.y, s });
        }
      }
    }
    for (const [idx, { d, y, s }] of best) {
      const w = 1 - smooth(hw + 0.8, reach, d);
      this.heights[idx] = this.heights[idx] * (1 - w) + (y - 0.12) * w;
      if (d < hw + 0.5) {
        const gravel = road.surface === 'gravel' || (road.gravelAfter !== undefined && s.t > road.gravelAfter);
        this.surface[idx] = gravel ? SURF_ID.gravel : SURF_ID.asphalt;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  #bucketKey(x, z) {
    return `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
  }

  #slopeIdx(i, j) {
    const { n, spacing } = this;
    const dx = (this.heights[j * n + Math.min(n - 1, i + 1)] - this.heights[j * n + Math.max(0, i - 1)]) / (2 * spacing);
    const dz = (this.heights[Math.min(n - 1, j + 1) * n + i] - this.heights[Math.max(0, j - 1) * n + i]) / (2 * spacing);
    return 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz); // 0 flat … →1 vertical
  }

  /** Bilinear ground height. Outside the map: clamps to the edge. */
  heightAt(x, z) {
    const { n, spacing, half } = this;
    const fx = THREE.MathUtils.clamp((x + half) / spacing, 0, n - 1.001);
    const fz = THREE.MathUtils.clamp((z + half) / spacing, 0, n - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const h = this.heights;
    const a = h[j * n + i];
    const b = h[j * n + i + 1];
    const c = h[(j + 1) * n + i];
    const d = h[(j + 1) * n + i + 1];
    // Match the mesh's triangle split (see #chunkMesh) for exact contact.
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  surfaceAt(x, z) {
    const { n, spacing, half } = this;
    const i = Math.round(THREE.MathUtils.clamp((x + half) / spacing, 0, n - 1));
    const j = Math.round(THREE.MathUtils.clamp((z + half) / spacing, 0, n - 1));
    return SURF[this.surface[j * n + i]];
  }

  slopeAt(x, z) {
    const e = 1.5;
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz);
  }

  /** Downhill gradient (dh/dx, dh/dz). */
  gradientAt(x, z, out = new THREE.Vector2()) {
    const e = 1.5;
    out.set((this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e), (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e));
    return out;
  }

  /** Distance to the nearest road centreline (∞ if none within ~32 m). */
  roadDistance(x, z) {
    let best = Infinity;
    const bx = Math.floor(x / 16);
    const bz = Math.floor(z / 16);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const list = this._buckets.get(`${bx + dx},${bz + dz}`);
        if (!list) continue;
        for (const { s } of list) best = Math.min(best, Math.hypot(x - s.x, z - s.z));
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Meshes
  // ---------------------------------------------------------------------------

  /** Terrain chunks (100 m) with vertex colours by surface/slope/height. */
  buildMeshes(material, cellsPerChunk = 25) {
    const { n } = this;
    const cells = n - 1;
    for (let cj = 0; cj < cells; cj += cellsPerChunk) {
      for (let ci = 0; ci < cells; ci += cellsPerChunk) {
        const mesh = new THREE.Mesh(this.#chunkGeometry(ci, cj, Math.min(cellsPerChunk, cells - ci), Math.min(cellsPerChunk, cells - cj)), material);
        mesh.name = `terrain_${ci}_${cj}`;
        this.chunks.push(mesh);
      }
    }
    return this.chunks;
  }

  #chunkGeometry(ci, cj, w, h) {
    const { n, spacing, half } = this;
    const verts = (w + 1) * (h + 1);
    const pos = new Float32Array(verts * 3);
    const nor = new Float32Array(verts * 3);
    const col = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const colour = new THREE.Color();
    let v = 0;
    for (let j = 0; j <= h; j++) {
      for (let i = 0; i <= w; i++) {
        const gi = ci + i;
        const gj = cj + j;
        const idx = gj * n + gi;
        const x = -half + gi * spacing;
        const z = -half + gj * spacing;
        const y = this.heights[idx];
        pos.set([x, y, z], v * 3);
        const hx = (this.heights[gj * n + Math.min(n - 1, gi + 1)] - this.heights[gj * n + Math.max(0, gi - 1)]) / (2 * spacing);
        const hz = (this.heights[Math.min(n - 1, gj + 1) * n + gi] - this.heights[Math.max(0, gj - 1) * n + gi]) / (2 * spacing);
        const len = Math.hypot(hx, 1, hz);
        nor.set([-hx / len, 1 / len, -hz / len], v * 3);
        uv.set([x / 6, z / 6], v * 2);
        this.#vertexColour(colour, this.surface[idx], y, this.#slopeIdx(gi, gj), x, z);
        col.set([colour.r, colour.g, colour.b], v * 3);
        v++;
      }
    }
    const index = [];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const a = j * (w + 1) + i;
        const b = a + 1;
        const c = a + (w + 1);
        const d = c + 1;
        // Split a-b-c / b-d-c (matches heightAt's triangle test).
        index.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  #vertexColour(c, surf, y, slope, x, z) {
    const n = 0.9 + 0.2 * fbm(this.noise, x / 18, z / 18, 2);
    switch (SURF[surf]) {
      case 'sand':
        c.setRGB(0.62, 0.56, 0.42);
        break;
      case 'rock':
        c.setRGB(0.42, 0.4, 0.38);
        break;
      case 'asphalt':
      case 'gravel':
        c.setRGB(0.4, 0.35, 0.3); // shoulder dirt under the road strip
        break;
      default: {
        // grass, drier and greyer up the mountain
        const alt = THREE.MathUtils.clamp((y - 20) / 90, 0, 1);
        c.setRGB(0.55 + alt * 0.1, 0.66 - alt * 0.12, 0.42 - alt * 0.04);
      }
    }
    c.multiplyScalar(n);
  }

  /** Road strips (chunked every ~100 m), slightly above the carved ground. */
  buildRoadMeshes(materials) {
    const meshes = [];
    for (const road of this.roads) {
      const S = road.samples;
      const hw = road.width / 2;
      const per = 50; // samples per mesh (~100 m)
      for (let start = 0; start < S.length - 1; start += per) {
        const end = Math.min(S.length - 1, start + per);
        const groups = { asphalt: [], gravel: [] };
        for (let k = start; k < end; k++) {
          const gravel = road.surface === 'gravel' || (road.gravelAfter !== undefined && S[k].t > road.gravelAfter);
          groups[gravel ? 'gravel' : 'asphalt'].push(k);
        }
        for (const [kind, ks] of Object.entries(groups)) {
          if (!ks.length) continue;
          const geo = stripGeometry(S, ks, hw, (sx, sz) => this.heightAt(sx, sz));
          const m = new THREE.Mesh(geo, materials[kind]);
          m.name = `road_${road.name}_${start}_${kind}`;
          meshes.push(m);
        }
      }
    }
    return meshes;
  }
}

/** Road ribbon for sample indices ks (each k joins sample k to k+1). */
function stripGeometry(S, ks, hw, groundAt) {
  const pos = [];
  const uv = [];
  const nor = [];
  const index = [];
  let along = 0;
  const side = (k) => {
    const a = S[Math.max(0, k - 1)];
    const b = S[Math.min(S.length - 1, k + 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  };
  let v = 0;
  for (const k of ks) {
    for (const kk of [k, k + 1]) {
      const s = S[kk];
      const [px, pz] = side(kk);
      // 3 verts across (centre helps the per-vertex lighting + affine)
      for (const off of [-1, 0, 1]) {
        const x = s.x + px * hw * off;
        const z = s.z + pz * hw * off;
        const y = Math.max(s.y, groundAt(x, z) + 0.02) + 0.06;
        pos.push(x, y, z);
        nor.push(0, 1, 0);
        uv.push((off + 1) / 2, (along + (kk - k) * 2) / 8);
      }
    }
    along += 2;
    const a = v;
    // two rows of 3 verts: a..a+2 (start), a+3..a+5 (end)
    for (let c = 0; c < 2; c++) index.push(a + c, a + c + 1, a + c + 3, a + c + 1, a + c + 4, a + c + 3); // CCW from above
    v += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

// -----------------------------------------------------------------------------
// Noise
// -----------------------------------------------------------------------------

/**
 * Relax a road height profile until no segment is steeper than `g`
 * (rise/run). Endpoints stay put so roads still meet plateaus/junctions.
 */
function limitGrade(S, g) {
  for (let iter = 0; iter < 4000; iter++) {
    let worst = 0;
    for (let k = 1; k < S.length; k++) {
      const a = S[k - 1];
      const b = S[k];
      const run = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const excess = Math.abs(b.y - a.y) - g * run;
      if (excess <= 0) continue;
      worst = Math.max(worst, excess);
      const sgn = Math.sign(b.y - a.y);
      const first = k - 1 === 0;
      const last = k === S.length - 1;
      if (first && last) continue;
      if (first) b.y -= sgn * excess;
      else if (last) a.y += sgn * excess;
      else {
        a.y += (sgn * excess) / 2;
        b.y -= (sgn * excess) / 2;
      }
    }
    if (worst < 0.01) break;
  }
}

function smooth(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Seeded 2D value noise with smooth interpolation. */
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const r = s % (i + 1);
    [p[i], p[r]] = [p[r], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = (i, j) => perm[(perm[i & 255] + j) & 511] / 255;
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = val(xi, yi);
    const b = val(xi + 1, yi);
    const c = val(xi, yi + 1);
    const d = val(xi + 1, yi + 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  };
}

function fbm(noise, x, y, oct) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < oct; o++) {
    sum += noise(x * f, y * f) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

function ridged(noise, x, y) {
  return 1 - Math.abs(noise(x, y)) - 0.5;
}

export { smooth };
