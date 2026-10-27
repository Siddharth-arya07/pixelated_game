import * as THREE from 'three';

/**
 * GeoMap
 * ------
 * Builds a playable place from a real-world map made by tools/geo_build.py
 * (OpenStreetMap + elevation): terrain, a painted ground (lawns, parks, golden
 * hills, marsh, water, parking lots), streets with sidewalks, every building
 * extruded from its true footprint, fences, street trees, collision.
 *
 * Coordinates are metres on a flat local plane: +x east, +z south. Everything
 * is chunked on a grid and chunks far from the camera are hidden each frame,
 * so a few square kilometres of suburb stay cheap.
 *
 *   const map = new GeoMap(scene, json, { style, ground, trees })
 *   map.heightAt(x, z) · map.poi('Ardenwood Elementary School') · map.update(camera)
 */
const CHUNK = 220;

export class GeoMap {
  constructor(scene, data, opts = {}) {
    this.scene = scene;
    this.data = data;
    this.opts = opts;
    this.W = data.size[0];
    this.H = data.size[1];
    this.dem = data.dem;
    this.chunks = new Map(); // key → { cx, cz, group }
    this.drawRange = opts.drawRange ?? 260;
    this.buildings = data.buildings.map((b) => ({ ...b, pts: pairs(b.p) }));
    this.roads = data.roads.map((r) => ({ ...r, pts: pairs(r.p) }));
    this.areas = data.areas.map((a) => ({ ...a, pts: pairs(a.p) }));
    this.#index();
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  heightAt(x, z) {
    const d = this.dem;
    const fx = THREE.MathUtils.clamp((x - d.x0) / d.cell, 0, d.nx - 1.001);
    const fz = THREE.MathUtils.clamp((z - d.z0) / d.cell, 0, d.ny - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const h = (a, b) => d.h[b * d.nx + a] / 10;
    const y = h(i, j) * (1 - u) * (1 - v) + h(i + 1, j) * u * (1 - v) + h(i, j + 1) * (1 - u) * v + h(i + 1, j + 1) * u * v;
    return Math.max(y, this.opts.minHeight ?? -1) + (this.opts.lift ?? 0);
  }

  /** Walkable height: a pier deck if you're over one, else the ground. */
  surfaceAt(x, z) {
    const g = this.heightAt(x, z);
    if (!this.decks) return g;
    const key = `${Math.floor(x / 40)},${Math.floor(z / 40)}`;
    for (const d of this.deckGrid.get(key) ?? []) {
      if (x < d.minX || x > d.maxX || z < d.minZ || z > d.maxZ) continue;
      if (d.line ? segDist(x, z, d.ax, d.az, d.bx, d.bz) <= d.w / 2 : pointInPoly(x, z, d.pts)) return Math.max(g, d.y);
    }
    return g;
  }

  /**
   * Piers and boardwalks: flat wooden decks at `height` above the water,
   * walkable (collision) and holding up whatever's built on them.
   */
  buildDecks({ mat, height = 3, edge }) {
    const s = this.scene;
    this.decks = [];
    this.deckGrid = new Map();
    const add = (d) => {
      this.decks.push(d);
      for (let gx = Math.floor(d.minX / 40); gx <= Math.floor(d.maxX / 40); gx++) {
        for (let gz = Math.floor(d.minZ / 40); gz <= Math.floor(d.maxZ / 40); gz++) {
          const k = `${gx},${gz}`;
          if (!this.deckGrid.has(k)) this.deckGrid.set(k, []);
          this.deckGrid.get(k).push(d);
        }
      }
    };
    const pos = [];
    const uv = [];
    const sides = [];
    for (const a of this.areas) {
      if (a.k !== 'pier' || a.pts.length < 3) continue;
      const y = Math.max(height, Math.min(...a.pts.map(([x, z]) => this.heightAt(x, z))) + 0.2);
      const xs = a.pts.map((p) => p[0]);
      const zs = a.pts.map((p) => p[1]);
      add({ pts: a.pts, y, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) });
      let tris;
      try {
        tris = THREE.ShapeUtils.triangulateShape(a.pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
      } catch {
        continue;
      }
      for (const t of tris) {
        let [p0, p1, p2] = t.map((k) => a.pts[k]);
        if ((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) > 0) [p1, p2] = [p2, p1];
        for (const [x, z] of [p0, p1, p2]) {
          pos.push(x, y, z);
          uv.push(x / 3, z / 3);
        }
      }
      // deck edge, down to the water
      const ring = orient(a.pts);
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i];
        const [bx, bz] = ring[(i + 1) % ring.length];
        sides.push([ax, az, bx, bz, y]);
      }
    }
    for (const r of this.roads) {
      if (r.t !== 'pier') continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i];
        const [bx, bz] = r.pts[i + 1];
        const y = Math.max(height, Math.min(this.heightAt(ax, az), this.heightAt(bx, bz)) + 0.2);
        add({ line: true, ax, az, bx, bz, w: r.w, y, minX: Math.min(ax, bx) - r.w, maxX: Math.max(ax, bx) + r.w, minZ: Math.min(az, bz) - r.w, maxZ: Math.max(az, bz) + r.w });
        const l = Math.hypot(bx - ax, bz - az) || 1;
        const nx = (-(bz - az) / l) * (r.w / 2);
        const nz = ((bx - ax) / l) * (r.w / 2);
        const q = [[ax - nx, az - nz], [ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz]];
        for (const k of [0, 2, 1, 0, 3, 2]) {
          pos.push(q[k][0], y, q[k][1]);
          uv.push(q[k][0] / 3, q[k][1] / 3);
        }
        sides.push([q[0][0], q[0][1], q[3][0], q[3][1], y], [q[2][0], q[2][1], q[1][0], q[1][1], y]);
      }
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const deck = new THREE.Mesh(geo, mat);
    s.root.add(deck);
    s.addColliderMesh(deck, 'terrain');
    // the edges and pilings
    const ep = [];
    const euv = [];
    for (const [ax, az, bx, bz, y] of sides) {
      const lo = Math.min(this.heightAt(ax, az), this.heightAt(bx, bz), -1);
      const l = Math.hypot(bx - ax, bz - az);
      for (const [x, yy, z, u, v] of [[ax, lo, az, 0, 0], [bx, lo, bz, l / 3, 0], [bx, y, bz, l / 3, 1], [ax, lo, az, 0, 0], [bx, y, bz, l / 3, 1], [ax, y, az, 0, 1]]) {
        ep.push(x, yy, z);
        euv.push(u, v);
      }
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
    eg.setAttribute('uv', new THREE.Float32BufferAttribute(euv, 2));
    eg.computeVertexNormals();
    s.root.add(new THREE.Mesh(eg, edge ?? mat));
  }

  /** The bay: one big flat sheet at sea level (land pokes through it). */
  buildSea({ level = 0, color = 0x3a6a8a, size = 6000 } = {}) {
    const m = this.scene.mat({ map: this.scene.tex('water', 40, 40), color, scroll: [0.004, 0.002], fogScale: 0.7 });
    const geo = new THREE.PlaneGeometry(size, size, 40, 40);
    geo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(geo, m);
    sea.position.y = level;
    this.scene.root.add(sea);
    this.sea = sea;
    return sea;
  }

  /**
   * Rivers that run downhill (Niagara): area polygons rasterised onto a grid
   * (scanline fill) and draped over the terrain, so water pours over the
   * real drop. `kinds` picks the areas ('water', 'waterfall').
   */
  buildDrapedWater({ mat, cell = 6, lift = 0.4, kinds = ['water'], chunked = true } = {}) {
    const made = [];
    for (const a of this.areas) {
      if (!kinds.includes(a.k) || a.pts.length < 3) continue;
      const zs = a.pts.map((p) => p[1]);
      const z0 = Math.floor(Math.min(...zs) / cell) * cell;
      const nz = Math.ceil((Math.max(...zs) - z0) / cell);
      const buckets = new Map();
      for (let j = 0; j < nz; j++) {
        const zc = z0 + (j + 0.5) * cell;
        // scanline: where does this row cross the polygon's edges?
        const xs = [];
        for (let i = 0, k = a.pts.length - 1; i < a.pts.length; k = i++) {
          const [xi, zi] = a.pts[i];
          const [xk, zk] = a.pts[k];
          if (zi > zc !== zk > zc) xs.push(xi + ((zc - zi) * (xk - xi)) / (zk - zi));
        }
        xs.sort((p, q) => p - q);
        for (let s = 0; s + 1 < xs.length; s += 2) {
          for (let x = Math.floor(xs[s] / cell) * cell; x < xs[s + 1]; x += cell) {
            const c = [[x, z0 + j * cell], [x + cell, z0 + j * cell], [x + cell, z0 + (j + 1) * cell], [x, z0 + (j + 1) * cell]];
            const key = chunked ? `${Math.floor(x / CHUNK)},${Math.floor(c[0][1] / CHUNK)}` : 'all';
            if (!buckets.has(key)) buckets.set(key, { pos: [], uv: [], x, z: c[0][1] });
            const B = buckets.get(key);
            const y = c.map(([px, pz]) => this.heightAt(px, pz) + lift);
            for (const k of [0, 3, 2, 0, 2, 1]) {
              B.pos.push(c[k][0], y[k], c[k][1]);
              B.uv.push(c[k][0] / 10, c[k][1] / 10 - y[k] / 3);
            }
          }
        }
      }
      for (const B of buckets.values()) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mat);
        if (chunked) this.#chunk(B.x, B.z).group.add(m);
        else {
          m.frustumCulled = false;
          this.scene.root.add(m);
        }
        made.push(m);
      }
    }
    return made;
  }

  /** First POI whose name contains `name` (case-insensitive). */
  poi(name) {
    const n = name.toLowerCase();
    return this.data.pois.find((p) => p.n.toLowerCase() === n) ?? this.data.pois.find((p) => p.n.toLowerCase().includes(n)) ?? null;
  }

  /**
   * The outside of a building's wall that best faces (tx, tz): where a door
   * goes. Returns the wall midpoint, its outward normal and the yaw that
   * faces out of it.
   */
  wallFacing(b, tx, tz, minLen = 2.5) {
    let best = null;
    for (let i = 0; i < b.pts.length; i++) {
      const [ax, az] = b.pts[i];
      const [bx, bz] = b.pts[(i + 1) % b.pts.length];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < minLen) continue;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      let nx = (bz - az) / len;
      let nz = -(bx - ax) / len;
      if (pointInPoly(mx + nx * 0.5, mz + nz * 0.5, b.pts)) {
        nx = -nx;
        nz = -nz;
      }
      const tl = Math.hypot(tx - mx, tz - mz) || 1;
      const facing = (nx * (tx - mx) + nz * (tz - mz)) / tl; // 1 = looking right at it
      const score = facing * 2 - tl / 60 + Math.min(len, 8) / 16;
      if (!best || score > best.score) best = { score, x: mx, z: mz, nx, nz, len };
    }
    if (best) best.yaw = Math.atan2(best.nx, best.nz);
    return best;
  }

  /** The building nearest (x, z) (centroid or containing it). */
  buildingAt(x, z, r = 40) {
    let best = null;
    for (const b of this.buildingsNear(x, z, r + 60)) {
      const d = pointInPoly(x, z, b.pts) ? 0 : Math.hypot(b.cx - x, b.cz - z);
      if (d < r && (!best || d < best.d)) best = { d, b };
    }
    return best?.b ?? null;
  }

  /** Buildings whose centroid is within r of (x, z). */
  buildingsNear(x, z, r) {
    return this.buildings.filter((b) => Math.hypot(b.cx - x, b.cz - z) < r);
  }

  insideBuilding(x, z, pad = 0) {
    const key = `${Math.floor(x / 40)},${Math.floor(z / 40)}`;
    for (const b of this.bgrid.get(key) ?? []) {
      if (x < b.minX - pad || x > b.maxX + pad || z < b.minZ - pad || z > b.maxZ + pad) continue;
      if (pad > 0 || pointInPoly(x, z, b.pts)) return b;
    }
    return null;
  }

  #index() {
    this.bgrid = new Map();
    for (const b of this.buildings) {
      let cx = 0;
      let cz = 0;
      b.minX = b.minZ = Infinity;
      b.maxX = b.maxZ = -Infinity;
      for (const [x, z] of b.pts) {
        cx += x;
        cz += z;
        b.minX = Math.min(b.minX, x);
        b.maxX = Math.max(b.maxX, x);
        b.minZ = Math.min(b.minZ, z);
        b.maxZ = Math.max(b.maxZ, z);
      }
      b.cx = cx / b.pts.length;
      b.cz = cz / b.pts.length;
      b.area = Math.abs(polyArea(b.pts));
      for (let gx = Math.floor(b.minX / 40); gx <= Math.floor(b.maxX / 40); gx++) {
        for (let gz = Math.floor(b.minZ / 40); gz <= Math.floor(b.maxZ / 40); gz++) {
          const k = `${gx},${gz}`;
          if (!this.bgrid.has(k)) this.bgrid.set(k, []);
          this.bgrid.get(k).push(b);
        }
      }
    }
  }

  #chunk(x, z) {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const k = `${cx},${cz}`;
    let c = this.chunks.get(k);
    if (!c) {
      const group = new THREE.Group();
      group.name = `geo_${k}`;
      this.scene.root.add(group);
      c = { cx: (cx + 0.5) * CHUNK, cz: (cz + 0.5) * CHUNK, group, parts: new Map() };
      this.chunks.set(k, c);
    }
    return c;
  }

  /** Per chunk, per material: a geometry builder we append triangles to. */
  #part(x, z, key, material) {
    const c = this.#chunk(x, z);
    let p = c.parts.get(key);
    if (!p) {
      p = { material, pos: [], uv: [], col: [], nor: [] };
      c.parts.set(key, p);
    }
    return p;
  }

  // ---------------------------------------------------------------------------
  // Ground
  // ---------------------------------------------------------------------------

  buildGround({ colors, base = '#8a7a48', res = 2048, cell = null } = {}) {
    const s = this.scene;
    const W = this.W;
    const H = this.H;
    const cw = res;
    const ch = Math.round((res * H) / W);
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const g = c.getContext('2d');
    const px = (x) => ((x + W / 2) / W) * cw;
    const pz = (z) => ((z + H / 2) / H) * ch;
    g.fillStyle = base;
    g.fillRect(0, 0, cw, ch);
    // dry hills get lighter/golden with height
    const d = this.dem;
    for (let j = 0; j < d.ny; j++) {
      for (let i = 0; i < d.nx; i++) {
        const h = d.h[j * d.nx + i] / 10;
        if (h < 6) continue;
        const k = Math.min(1, (h - 6) / 60);
        g.fillStyle = `rgba(${200 + k * 20},${165 + k * 10},${90 - k * 20},${0.25 + k * 0.35})`;
        g.fillRect(px(d.x0 + i * d.cell) - 1, pz(d.z0 + j * d.cell) - 1, (d.cell / W) * cw + 2, (d.cell / H) * ch + 2);
      }
    }
    const order = ['residential', 'reserve', 'meadow', 'farmland', 'orchard', 'farmyard', 'wood', 'scrub', 'grass', 'park', 'school', 'pitch', 'playground', 'paved', 'parking', 'sand', 'wetland', 'water'];
    const sorted = [...this.areas].sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k));
    for (const a of sorted) {
      const col = colors[a.k];
      if (!col) continue;
      g.fillStyle = col;
      g.beginPath();
      a.pts.forEach(([x, z], i) => (i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))));
      g.closePath();
      g.fill();
    }
    // speckle so big fields aren't flat colour
    const img = g.getImageData(0, 0, cw, ch);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 0.88 + rnd() * 0.24;
      img.data[i] *= n;
      img.data[i + 1] *= n;
      img.data[i + 2] *= n;
    }
    g.putImageData(img, 0, 0);
    // under every road: a dark band, so no grass shows through gaps
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const r of this.roads) {
      if (r.t === 'fence' || r.t.startsWith('water')) continue;
      g.strokeStyle = r.w >= 5 ? '#5a5a58' : '#7a7468';
      g.lineWidth = Math.max(1, ((r.w + (r.w >= 5 ? 3 : 0)) / W) * cw);
      g.beginPath();
      r.pts.forEach(([x, z], i) => (i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))));
      g.stroke();
    }
    this.groundCanvas = c;
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const mat = s.mat({ map: tex, affine: 0 });
    mat.uniforms.uMap.value.magFilter = THREE.NearestFilter;
    this.groundMat = mat;

    // terrain mesh, one per chunk, on the DEM grid (or finer)
    const step = cell ?? d.cell;
    const nx = Math.ceil(W / step);
    const nz = Math.ceil(H / step);
    const per = Math.ceil(CHUNK / step);
    for (let cj = 0; cj < nz; cj += per) {
      for (let ci = 0; ci < nx; ci += per) {
        const w = Math.min(per, nx - ci);
        const h = Math.min(per, nz - cj);
        const pos = [];
        const uv = [];
        for (let j = 0; j <= h; j++) {
          for (let i = 0; i <= w; i++) {
            const x = -W / 2 + (ci + i) * step;
            const z = -H / 2 + (cj + j) * step;
            pos.push(x, this.heightAt(x, z), z);
            uv.push((x + W / 2) / W, 1 - (z + H / 2) / H);
          }
        }
        const idx = [];
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            const a = j * (w + 1) + i;
            idx.push(a, a + w + 1, a + 1, a + 1, a + w + 1, a + w + 2);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mat);
        const cx = -W / 2 + (ci + w / 2) * step;
        const cz = -H / 2 + (cj + h / 2) * step;
        this.#chunk(cx, cz).group.add(m);
        s.addColliderMesh(m, 'terrain');
      }
    }
    tex.flipY = true;
  }

  /** Flat water polygons over the ground (bay, ponds, the channel). */
  buildWater(color = 0x3a6a8a) {
    const mat = this.scene.mat({ color, opacity: 0.88, scroll: [0.01, 0.006], map: this.scene.tex('water', 1, 1) });
    for (const a of this.areas) {
      if (a.k !== 'water' || a.pts.length < 3) continue;
      let y = Infinity;
      for (const [x, z] of a.pts) y = Math.min(y, this.heightAt(x, z));
      y = Math.max(y, -0.5) + 0.25;
      const shape = a.pts.map(([x, z]) => new THREE.Vector2(x, z));
      let tris;
      try {
        tris = THREE.ShapeUtils.triangulateShape(shape, []);
      } catch {
        continue;
      }
      const pos = [];
      const uv = [];
      for (const t of tris) {
        const [p0, p1, p2] = t.map((k) => a.pts[k]);
        const up = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) < 0;
        for (const [x, z] of up ? [p0, p1, p2] : [p0, p2, p1]) {
          pos.push(x, y, z);
          uv.push(x / 12, z / 12);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = true;
      this.scene.root.add(m); // big; never chunk-culled
    }
  }

  // ---------------------------------------------------------------------------
  // Roads, sidewalks, paths, streams, fences
  // ---------------------------------------------------------------------------

  buildRoads({ asphalt, concrete, path, water, fence } = {}) {
    const s = this.scene;
    const m = {
      asphalt: asphalt ?? s.mat({ map: s.tex('asphalt', 1, 1), color: 0x8a8a8a, affine: 0 }),
      concrete: concrete ?? s.mat({ color: 0xb8b4aa }),
      path: path ?? s.mat({ map: s.tex('gravel', 1, 1), color: 0xb0a080, affine: 0 }),
      water: water ?? s.mat({ color: 0x3a6a8a, opacity: 0.85 }),
      fence: fence ?? s.mat({ color: 0x1a1a1c, doubleSide: true }),
    };
    for (const k of Object.keys(m)) {
      m[k].polygonOffset = true;
      m[k].polygonOffsetFactor = -1;
      m[k].polygonOffsetUnits = k === 'asphalt' ? -4 : -2;
    }
    this.roadMats = m;
    const BIG = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
    for (const r of this.roads) {
      if (this.opts.skipRoad?.(r)) continue;
      const pts = densify(r.pts, 8);
      // bridges span straight between their ends instead of following the ground
      this.bridgeLine = r.b ? [this.surfaceAt(...r.pts[0]), this.surfaceAt(...r.pts[r.pts.length - 1]), pts.length] : null;
      if (r.t === 'fence') {
        this.#fence(pts, m.fence, 1.7);
        continue;
      }
      if (r.t === 'pier' || r.t === 'coastline' || r.t === 'cliff') continue;
      if (r.t.startsWith('water')) {
        this.#ribbon(pts, r.w, 0.05, m.water, 'water');
        continue;
      }
      if (['footway', 'path', 'cycleway', 'track', 'steps', 'bridleway', 'pedestrian'].includes(r.t)) {
        this.#ribbon(pts, r.w, 0.06, r.t === 'path' || r.t === 'track' || r.t === 'bridleway' ? m.path : m.concrete, r.t === 'path' || r.t === 'track' ? 'path' : 'concrete');
        continue;
      }
      // sidewalks on town streets (not service alleys or freeways)
      if (r.t === 'residential' || (BIG.has(r.t) && !r.t.startsWith('motorway') && r.t !== 'trunk')) this.#ribbon(pts, r.w + 4.2, 0.07, m.concrete, 'concrete');
      this.#ribbon(pts, r.w, 0.1, m.asphalt, 'asphalt');
    }
    this.#flush();
  }

  #ribbon(pts, w, lift, material, key) {
    if (pts.length < 2) return;
    const half = w / 2;
    let u = 0;
    const bl = this.bridgeLine;
    const hAt = (i, x, z) => (bl ? Math.max(bl[0] + ((bl[1] - bl[0]) * i) / (bl[2] - 1), this.surfaceAt(x, z)) : this.surfaceAt(x, z));
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz) || 1e-4;
      // mitre-ish: use the average of neighbouring directions at each end
      const na = edgeNormal(pts, i);
      const nb = edgeNormal(pts, i + 1);
      const ya = hAt(i, ax, az) + lift;
      const yb = hAt(i + 1, bx, bz) + lift;
      const P = this.#part((ax + bx) / 2, (az + bz) / 2, key, material);
      const a0 = [ax - na[0] * half, ya, az - na[1] * half];
      const a1 = [ax + na[0] * half, ya, az + na[1] * half];
      const b0 = [bx - nb[0] * half, yb, bz - nb[1] * half];
      const b1 = [bx + nb[0] * half, yb, bz + nb[1] * half];
      const u2 = u + len / Math.max(w, 2);
      pushQuad(P, a0, a1, b1, b0, [u, 0], [u, 1], [u2, 1], [u2, 0]);
      u = u2;
    }
  }

  #fence(pts, material, h) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const ya = this.heightAt(ax, az);
      const yb = this.heightAt(bx, bz);
      const P = this.#part((ax + bx) / 2, (az + bz) / 2, 'fence', material);
      const len = Math.hypot(bx - ax, bz - az);
      pushQuad(P, [ax, ya, az], [bx, yb, bz], [bx, yb + h, bz], [ax, ya + h, az], [0, 0], [len / 2, 0], [len / 2, 1], [0, 1]);
    }
  }

  // ---------------------------------------------------------------------------
  // Buildings
  // ---------------------------------------------------------------------------

  /**
   * style(b) → { wall: THREE.Color, roof: THREE.Color, h, roof: 'hip'|'flat'|'gable', mat: 'house'|'shop'|... , skip? }
   * mats: { house: {wall, roof}, ... } materials (vertex-coloured)
   */
  buildBuildings(style, mats) {
    const s = this.scene;
    const col = new THREE.Color();
    for (const b of this.buildings) {
      if (b.pts.length < 3) continue;
      const st = style(b);
      if (!st || st.skip) continue;
      b.style = st;
      const pts = orient(b.pts);
      let ground = Infinity;
      for (const [x, z] of pts) ground = Math.min(ground, this.surfaceAt(x, z));
      b.ground = ground;
      const h = st.h;
      const top = ground + h;
      const M = mats[st.mat] ?? mats.house;
      const W = this.#part(b.cx, b.cz, `${st.mat}_wall`, M.wall);
      // walls: one quad per footprint edge, UVs in floors/bays
      let u = 0;
      for (let i = 0; i < pts.length; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[(i + 1) % pts.length];
        const len = Math.hypot(bx - ax, bz - az);
        const u2 = u + len / (st.bay ?? 3.2);
        const v = h / (st.floor ?? 2.9);
        const start = W.pos.length;
        pushQuad(W, [ax, ground - 1, az], [bx, ground - 1, bz], [bx, top, bz], [ax, top, az], [u, -1 / (st.floor ?? 2.9)], [u2, -1 / (st.floor ?? 2.9)], [u2, v], [u, v]);
        col.copy(st.wall);
        for (let k = start; k < W.pos.length; k += 3) W.col.push(col.r, col.g, col.b);
        u = Math.round(u2);
      }
      // roof
      const R = this.#part(b.cx, b.cz, `${st.mat}_roof`, M.roof);
      const start = R.pos.length;
      if (st.roof === 'flat' || b.area > 2600) this.#flatRoof(R, pts, top);
      else this.#hipRoof(R, pts, top, st.pitch ?? 0.42, st.eave ?? 0.45);
      col.copy(st.roofColor);
      for (let k = start; k < R.pos.length; k += 3) R.col.push(col.r, col.g, col.b);
    }
    // collision: the wall meshes themselves
    for (const m of this.#flush()) if (m.name.endsWith('_wall')) s.addColliderMesh(m);
  }

  #flatRoof(P, pts, y) {
    let tris;
    try {
      tris = THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
    } catch {
      return;
    }
    for (const t of tris) {
      const a = pts[t[0]];
      let b = pts[t[1]];
      let c = pts[t[2]];
      // face up: (b-a)×(c-a) must have +y, i.e. a negative 2D cross in (x, z)
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0) [b, c] = [c, b];
      P.pos.push(a[0], y, a[1], b[0], y, b[1], c[0], y, c[1]);
      P.uv.push(a[0] / 4, a[1] / 4, b[0] / 4, b[1] / 4, c[0] / 4, c[1] / 4);
      for (let k = 0; k < 3; k++) P.nor.push(0, 1, 0);
    }
  }

  /** Hip roof over the footprint's best-fit rectangle. */
  #hipRoof(P, pts, y, pitch, eave) {
    const r = minRect(pts);
    const { cx, cz, ux, uz, hw, hd } = r; // u = long axis
    const L = hw + eave;
    const S = hd + eave;
    const vx = -uz;
    const vz = ux;
    const rise = S * pitch * 2;
    const ridge = Math.max(0, L - S);
    const corner = (a, b) => [cx + ux * a + vx * b, cz + uz * a + vz * b];
    const c0 = corner(-L, -S);
    const c1 = corner(L, -S);
    const c2 = corner(L, S);
    const c3 = corner(-L, S);
    const r0 = corner(-ridge, 0);
    const r1 = corner(ridge, 0);
    const Y = y + rise;
    const tri = (a, ay, b, by, c, cy) => {
      const n = new THREE.Vector3(b[0] - a[0], by - ay, b[1] - a[1]).cross(new THREE.Vector3(c[0] - a[0], cy - ay, c[1] - a[1])).normalize();
      if (n.y < 0) {
        // wind it so the face points up/out
        [b, c] = [c, b];
        [by, cy] = [cy, by];
        n.negate();
      }
      P.pos.push(a[0], ay, a[1], b[0], by, b[1], c[0], cy, c[1]);
      P.uv.push(a[0] / 2, a[1] / 2 + ay, b[0] / 2, b[1] / 2 + by, c[0] / 2, c[1] / 2 + cy);
      for (let k = 0; k < 3; k++) P.nor.push(n.x, n.y, n.z);
    };
    // winding chosen so faces point up/out; PSX materials are front-side only
    const quad = (a, b, c, d) => {
      tri(a, y, c, Y, b, y);
      tri(a, y, d, Y, c, Y);
    };
    quad(c0, c1, r1, r0); // long side
    quad(c2, c3, r0, r1); // other long side
    tri(c1, y, r1, Y, c2, y); // hip ends
    tri(c3, y, r0, Y, c0, y);
    // eave underside (faces down) so you never see into the roof
    const under = (a, b, c) => {
      const n = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      // n > 0 here means the triangle faces up: swap to face down
      const [q, r] = n > 0 ? [c, b] : [b, c];
      P.pos.push(a[0], y, a[1], q[0], y, q[1], r[0], y, r[1]);
      P.uv.push(0, 0, 0, 0, 0, 0);
      for (let k = 0; k < 3; k++) P.nor.push(0, -1, 0);
    };
    under(c0, c1, c2);
    under(c0, c2, c3);
  }

  // ---------------------------------------------------------------------------
  // Trees (instanced, chunked)
  // ---------------------------------------------------------------------------

  /**
   * kinds: [{ geo, mat, weight }] — picked by hash. place: array of [x, z, scale, rot]
   */
  plantTrees(spots, kinds) {
    const per = new Map();
    let i = 0;
    for (const [x, z, sc, rot] of spots) {
      const k = kinds[hash(i++) % kinds.length];
      const c = this.#chunk(x, z);
      const key = `${c.cx},${c.cz},${kinds.indexOf(k)}`;
      if (!per.has(key)) per.set(key, { c, k, list: [] });
      per.get(key).list.push([x, this.surfaceAt(x, z), z, sc, rot]);
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const { c, k, list } of per.values()) {
      for (const part of k.parts) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        list.forEach(([x, y, z, sc, rot], j) => {
          q.setFromAxisAngle(_up, rot);
          m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sc, sc, sc));
          im.setMatrixAt(j, m4);
        });
        im.computeBoundingSphere();
        c.group.add(im);
      }
    }
  }

  /** Street-tree spots along roads of the given kinds, clear of buildings. */
  streetTreeSpots(kinds, { spacing = 13, offset = 2.6, jitter = 2 } = {}) {
    const out = [];
    let n = 0;
    for (const r of this.roads) {
      if (!kinds.includes(r.t)) continue;
      const pts = densify(r.pts, spacing);
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, z] = pts[i];
        const nrm = edgeNormal(pts, i);
        for (const side of [-1, 1]) {
          if (hash(n++) % 5 === 0) continue;
          const d = r.w / 2 + offset + (hash(n) % 100) / 100;
          const tx = x + nrm[0] * d * side + ((hash(n * 7) % 100) / 100 - 0.5) * jitter;
          const tz = z + nrm[1] * d * side + ((hash(n * 13) % 100) / 100 - 0.5) * jitter;
          if (this.insideBuilding(tx, tz, 1.5)) continue;
          if (this.nearRoad(tx, tz, 0.6)) continue;
          out.push([tx, tz, 0.8 + (hash(n * 3) % 50) / 100, (hash(n * 5) % 628) / 100]);
        }
      }
    }
    return out;
  }

  nearRoad(x, z, pad) {
    if (!this.rgrid) {
      this.rgrid = new Map();
      for (const r of this.roads) {
        if (r.t === 'fence' || r.t.startsWith('water')) continue;
        for (let i = 0; i < r.pts.length - 1; i++) {
          const [ax, az] = r.pts[i];
          const [bx, bz] = r.pts[i + 1];
          const seg = { ax, az, bx, bz, w: r.w };
          for (let gx = Math.floor(Math.min(ax, bx) / 30); gx <= Math.floor(Math.max(ax, bx) / 30); gx++) {
            for (let gz = Math.floor(Math.min(az, bz) / 30); gz <= Math.floor(Math.max(az, bz) / 30); gz++) {
              const k = `${gx},${gz}`;
              if (!this.rgrid.has(k)) this.rgrid.set(k, []);
              this.rgrid.get(k).push(seg);
            }
          }
        }
      }
    }
    for (let gx = Math.floor(x / 30) - 1; gx <= Math.floor(x / 30) + 1; gx++) {
      for (let gz = Math.floor(z / 30) - 1; gz <= Math.floor(z / 30) + 1; gz++) {
        for (const s of this.rgrid.get(`${gx},${gz}`) ?? []) {
          if (segDist(x, z, s.ax, s.az, s.bx, s.bz) < s.w / 2 + pad) return s;
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------

  #flush() {
    const made = [];
    for (const c of this.chunks.values()) {
      for (const [key, p] of c.parts) {
        if (!p.pos.length) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
        if (p.col.length === p.pos.length) geo.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
        if (p.nor.length === p.pos.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3));
        else geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, p.material);
        m.name = key;
        c.group.add(m);
        made.push(m);
        p.pos = [];
        p.uv = [];
        p.col = [];
        p.nor = [];
      }
      c.parts = new Map();
    }
    return made;
  }

  /** Hide chunks out of sight range (fog hides them anyway). */
  update(camera) {
    const x = camera.position.x;
    const z = camera.position.z;
    const R = this.drawRange + CHUNK * 0.71;
    for (const c of this.chunks.values()) c.group.visible = Math.hypot(c.cx - x, c.cz - z) < R;
  }
}

// -----------------------------------------------------------------------------
// geometry helpers
// -----------------------------------------------------------------------------

const _up = new THREE.Vector3(0, 1, 0);

function pairs(a) {
  const o = [];
  for (let i = 0; i < a.length; i += 2) o.push([a[i] / 10, a[i + 1] / 10]);
  return o;
}

function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i];
    const [x2, z2] = p[(i + 1) % p.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

/**
 * Wind the ring counter-clockwise as seen from above (north up). With +z
 * pointing south that's a NEGATIVE shoelace area, and it makes every wall
 * quad (edge × up) face outward.
 */
function orient(p) {
  return polyArea(p) < 0 ? p : [...p].reverse();
}

export function pointInPoly(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i];
    const [xj, zj] = p[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

function edgeNormal(pts, i) {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  return [-dz / l, dx / l];
}

function pushQuad(P, a, b, c, d, ua, ub, uc, ud) {
  P.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  P.uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

/** Minimum-area bounding rectangle (rotating calipers over the hull edges). */
function minRect(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 0.5) continue;
    const ux = (bx - ax) / l;
    const uz = (bz - az) / l;
    let mnu = Infinity;
    let mxu = -Infinity;
    let mnv = Infinity;
    let mxv = -Infinity;
    for (const [x, z] of pts) {
      const u = x * ux + z * uz;
      const v = -x * uz + z * ux;
      mnu = Math.min(mnu, u);
      mxu = Math.max(mxu, u);
      mnv = Math.min(mnv, v);
      mxv = Math.max(mxv, v);
    }
    const area = (mxu - mnu) * (mxv - mnv);
    if (!best || area < best.area) best = { area, ux, uz, mnu, mxu, mnv, mxv };
  }
  if (!best) return { cx: pts[0][0], cz: pts[0][1], ux: 1, uz: 0, hw: 1, hd: 1 };
  let { ux, uz, mnu, mxu, mnv, mxv } = best;
  let hw = (mxu - mnu) / 2;
  let hd = (mxv - mnv) / 2;
  const cu = (mxu + mnu) / 2;
  const cv = (mxv + mnv) / 2;
  const cx = cu * ux - cv * uz;
  const cz = cu * uz + cv * ux;
  if (hd > hw) {
    // make u the long axis
    [hw, hd] = [hd, hw];
    [ux, uz] = [-uz, ux];
  }
  return { cx, cz, ux, uz, hw, hd };
}

function hash(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  n ^= n >>> 15;
  return n >>> 0;
}
