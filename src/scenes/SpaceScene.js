import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';

/**
 * SpaceScene — the Moonbeam's grand tour
 * --------------------------------------
 * A fixed route (≈ 4½ minutes) in a little bubble-domed ship. You sit in one
 * of four seats and look around; friends who boarded with you sit beside you.
 *
 *   Earth falling away → the Moon (moon rabbits, Earthrise) → BLOOM (glowing
 *   mushroom forests, puffball critters, drifting sky-jellies) → SATURNINE
 *   (through the rings, past singing space whales) → OPAL (crystal spires,
 *   the lantern-folk who wave back, auroras) → a comet and the nebula →
 *   home, through a soft orange re-entry.
 *
 * Everything is a function of the launch time (shared in a room), so every
 * passenger sees exactly the same trip.
 */
export const TRIP = 270; // seconds

const MOON = { c: new THREE.Vector3(520, 1000, -900), r: 140 };
const BLOOM = { c: new THREE.Vector3(1500, 1300, -2300), r: 320 };
const SAT = { c: new THREE.Vector3(2600, 1700, -4300), r: 520 };
const OPAL = { c: new THREE.Vector3(1400, 1600, -5100), r: 280 };
/** A point `alt` metres above a planet's surface, in direction (x, y, z) from its centre. */
const over = (P, x, y, z, alt) => {
  const p = new THREE.Vector3(x, y, z).normalize().multiplyScalar(P.r + alt).add(P.c);
  return [p.x, p.y, p.z];
};
const ring = (x, y, z) => {
  const p = new THREE.Vector3(x, y, z).normalize().multiplyScalar(SAT.r * 1.94).add(SAT.c);
  return [p.x, p.y, p.z];
};
// route keyframes: [t (s), x, y, z]; the low passes skim ~20–30 m over the ground
const ROUTE = [
  [0, 0, 640, 0],
  [14, 0, 780, -60],
  [34, 300, 980, -480],
  [50, ...over(MOON, -0.2, 0.5, 1, 45)],
  [58, ...over(MOON, 0.3, 0.75, 0.6, 24)],
  [66, ...over(MOON, 0.7, 0.55, -0.2, 45)],
  [90, 1100, 1450, -1750],
  [108, ...over(BLOOM, -0.3, 0.6, 0.8, 70)],
  [118, ...over(BLOOM, 0.2, 0.85, 0.5, 46)],
  [128, ...over(BLOOM, 0.7, 0.6, -0.2, 70)],
  [150, 2050, 1750, -3250],
  [164, ...ring(-0.6, 0.3, 0.76)],
  [172, ...ring(-0.62, 0.0, 0.78)],
  [180, ...ring(-0.62, -0.22, 0.6)],
  [196, 2050, 1500, -4750],
  [206, ...over(OPAL, 0.6, 0.5, 0.6, 70)],
  [214, ...over(OPAL, 0.1, 0.85, 0.5, 26)],
  [222, ...over(OPAL, -0.6, 0.6, 0.5, 70)],
  [238, 700, 1500, -4200],
  [254, 200, 1000, -1200],
  [270, 0, 660, -20],
];
const SEATS = [
  [-0.7, 0, 0.5],
  [0.7, 0, 0.5],
  [-0.7, 0, -0.6],
  [0.7, 0, -0.6],
];

export class SpaceScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Space', label: 'space' });
    this.indoor = { fog: 0x02030a, near: 4000, far: 12000, ambient: 0x9a9ab8, daylight: 0 };
    this.killY = -99999;
    this.anim = [];
  }

  build() {
    this.#stars();
    this.#nebula();
    this.#earth();
    this.#moon(MOON.c, MOON.r);
    this.#bloom(BLOOM.c, BLOOM.r);
    this.#saturnine(SAT.c, SAT.r);
    this.#opal(OPAL.c, OPAL.r);
    this.#comet();
    this.#ship();
    this.addLight({ position: [3000, 4000, 2000], color: 0xfff4e0, range: 99999, intensity: 1.2, priority: 9 });
    const pts = ROUTE.map(([, x, y, z]) => new THREE.Vector3(x, y, z));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.addSpawn('default', [0, 640, 0], 0);
    this.updaters.push((dt, t) => this.#tick(dt, t));
  }

  /** Ship pose at trip time s. */
  pose(s, out, look) {
    s = THREE.MathUtils.clamp(s, 0, TRIP);
    let i = 0;
    while (i < ROUTE.length - 2 && ROUTE[i + 1][0] <= s) i++;
    const [t0] = ROUTE[i];
    const [t1] = ROUTE[i + 1];
    const k = (s - t0) / (t1 - t0);
    const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65; // ease a little at each keyframe
    const u = (i + e) / (ROUTE.length - 1);
    this.curve.getPoint(u, out);
    this.curve.getPoint(Math.min(1, u + 0.004), look);
    return out;
  }

  // ===========================================================================
  // The sky
  // ===========================================================================

  #stars() {
    const N = 7000;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const R = 9000;
      pos.set([Math.cos(a) * r * R + 1500, u * R + 1200, Math.sin(a) * r * R - 2500], i * 3);
      c.setHSL(Math.random() < 0.5 ? 0.6 : 0.08, 0.4, 0.75 + Math.random() * 0.25);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false }));
    pts.frustumCulled = false;
    this.root.add(pts);
  }

  #glowTex(inner, outer) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  #sprite(tex, size, pos, opacity = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.set(size, size, 1);
    s.position.copy(pos);
    this.root.add(s);
    return s;
  }

  #nebula() {
    const cols = [['rgba(255,90,180,0.55)', 'rgba(255,90,180,0)'], ['rgba(90,200,255,0.45)', 'rgba(90,200,255,0)'], ['rgba(170,110,255,0.5)', 'rgba(170,110,255,0)'], ['rgba(255,200,120,0.35)', 'rgba(255,200,120,0)']];
    for (let k = 0; k < 18; k++) {
      const [a, b] = cols[k % 4];
      this.#sprite(this.#glowTex(a, b), 1500 + Math.random() * 2500, new THREE.Vector3(-1500 + Math.random() * 1500, 1000 + Math.random() * 1600, -4200 - Math.random() * 3000), 0.8);
    }
  }

  #planetTex(draw, w = 512, h = 256) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }

  #planet(center, r, tex, atmo) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), this.mat({ map: tex, affine: 0 }));
    m.position.copy(center);
    this.root.add(m);
    if (atmo) {
      const a = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 40, 24), new THREE.MeshBasicMaterial({ color: atmo, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      a.position.copy(center);
      this.root.add(a);
    }
    return m;
  }

  /** Put an object on a planet's surface along a direction (y = up from the ground). */
  #onSurface(obj, center, r, dir, lift = 0) {
    const n = dir.clone().normalize();
    obj.position.copy(center).addScaledVector(n, r + lift);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    this.root.add(obj);
    return obj;
  }

  /** Directions on the side of a planet that the route skims past. */
  #near(center, through, spread, n) {
    const base = through.clone().sub(center).normalize();
    const out = [];
    for (let i = 0; i < n; i++) out.push(base.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize());
    return out;
  }

  // ===========================================================================
  // Worlds
  // ===========================================================================

  #earth() {
    const tex = this.#planetTex((x, w, h) => {
      x.fillStyle = '#1a4a8a';
      x.fillRect(0, 0, w, h);
      for (let k = 0; k < 26; k++) {
        x.fillStyle = k % 3 ? '#3a7a3a' : '#8a7a4a';
        x.beginPath();
        x.ellipse(Math.random() * w, h * 0.2 + Math.random() * h * 0.6, 20 + Math.random() * 60, 12 + Math.random() * 30, Math.random() * 3, 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 60; k++) x.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 3 + Math.random() * 6);
      x.fillStyle = '#f0f4f8';
      x.fillRect(0, 0, w, 14);
      x.fillRect(0, h - 14, w, 14);
    });
    this.earth = this.#planet(new THREE.Vector3(0, 0, 0), 600, tex, 0x6ab0ff);
  }

  #moon(c, r) {
    const tex = this.#planetTex((x, w, h) => {
      x.fillStyle = '#9a9aa0';
      x.fillRect(0, 0, w, h);
      for (let k = 0; k < 140; k++) {
        const cr = 3 + Math.random() * 18;
        const px = Math.random() * w;
        const py = Math.random() * h;
        x.fillStyle = 'rgba(60,60,70,0.35)';
        x.beginPath();
        x.arc(px, py, cr, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = 'rgba(220,220,225,0.25)';
        x.beginPath();
        x.arc(px - cr * 0.2, py - cr * 0.2, cr * 0.7, 0, Math.PI * 2);
        x.fill();
      }
    });
    this.#planet(c, r, tex, null);
    // moon rabbits, hopping
    const white = this.mat({ color: 0xf4f4f8 });
    const pink = this.mat({ color: 0xffb0c8, unlit: true });
    const through = this.#routeAt(58);
    for (const d of this.#near(c, through, 0.35, 14)) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), white);
      body.scale.set(1, 0.8, 1.3);
      body.position.y = 0.8;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), white);
      head.position.set(0, 1.5, 0.9);
      for (const dx of [-0.2, 0.2]) {
        const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.9, 2, 6), white);
        ear.position.set(dx, 2.3, 0.8);
        const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.6, 2, 4), pink);
        inner.position.set(dx, 2.3, 0.88);
        b.add(ear, inner);
      }
      b.add(body, head);
      const holder = new THREE.Group();
      holder.add(b);
      this.#onSurface(holder, c, r, d);
      const ph = Math.random() * 6;
      this.anim.push((t) => {
        b.position.y = Math.max(0, Math.sin(t * 3 + ph)) * 2.2;
        b.rotation.y = Math.sin(t * 0.3 + ph) * 2;
      });
    }
    // a flag
    const pole = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 4), this.mat({ color: 0xdddddd }));
    stick.position.y = 2.5;
    const fc = document.createElement('canvas');
    fc.width = 128;
    fc.height = 64;
    const fx = fc.getContext('2d');
    fx.fillStyle = '#ffffff';
    fx.fillRect(0, 0, 128, 64);
    fx.fillStyle = '#c02020';
    fx.font = 'bold 15px monospace';
    fx.fillText('PINE HOLLOW', 8, 28);
    fx.fillText('WAS HERE', 22, 50);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), this.mat({ map: new THREE.CanvasTexture(fc), doubleSide: true }));
    flag.position.set(1.2, 4.3, 0);
    pole.add(stick, flag);
    this.#onSurface(pole, c, r, through.clone().sub(c).normalize().add(new THREE.Vector3(0.05, 0, 0.05)));
  }

  #routeAt(s) {
    const p = new THREE.Vector3();
    this.curve ??= new THREE.CatmullRomCurve3(ROUTE.map(([, x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    return this.pose(s, p, new THREE.Vector3());
  }

  #bloom(c, r) {
    const tex = this.#planetTex((x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#ff9ad0');
      g.addColorStop(0.5, '#c070e0');
      g.addColorStop(1, '#60d0c8');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      for (let k = 0; k < 200; k++) {
        x.fillStyle = `rgba(${200 + Math.random() * 55},${100 + Math.random() * 120},${200 + Math.random() * 55},0.35)`;
        x.beginPath();
        x.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 14, 0, Math.PI * 2);
        x.fill();
      }
    });
    this.#planet(c, r, tex, 0xff8ad8);
    const through = this.#routeAt(118);
    const glowCols = [0x7affe0, 0xff8ad8, 0xffe07a, 0x9ab0ff];
    // giant glowing mushrooms
    for (const d of this.#near(c, through, 0.5, 60)) {
      const m = new THREE.Group();
      const h = 6 + Math.random() * 18;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, h, 6), this.mat({ color: 0xf0e8f8 }));
      stalk.position.y = h / 2;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(h * 0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.mat({ color: glowCols[Math.floor(Math.random() * 4)], unlit: true }));
      cap.position.y = h;
      m.add(stalk, cap);
      this.#onSurface(m, c, r, d);
    }
    // puffball critters with blinking eyes
    for (const d of this.#near(c, through, 0.3, 24)) {
      const p = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), this.mat({ color: [0xffd0f0, 0xd0f0ff, 0xfff0c0][Math.floor(Math.random() * 3)] }));
      ball.position.y = 1.2;
      const eyes = [];
      for (const dx of [-0.35, 0.35]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), this.mat({ color: 0x1a1a2a }));
        e.position.set(dx, 1.5, 1.05);
        p.add(e);
        eyes.push(e);
      }
      p.add(ball);
      const holder = this.#onSurface(new THREE.Group(), c, r, d);
      holder.add(p);
      const ph = Math.random() * 6;
      this.anim.push((t) => {
        p.position.y = Math.abs(Math.sin(t * 2 + ph)) * 0.8;
        const blink = Math.sin(t * 0.9 + ph * 3) > 0.96 ? 0.1 : 1;
        for (const e of eyes) e.scale.y = blink;
        p.rotation.y = t * 0.4 + ph;
      });
    }
    // drifting sky-jellies
    const jellyMat = new THREE.MeshBasicMaterial({ color: 0xa0f0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (const d of this.#near(c, through, 0.4, 9)) {
      const j = new THREE.Group();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), jellyMat);
      j.add(dome);
      for (let k = 0; k < 8; k++) {
        const ten = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.05, 14, 3), jellyMat);
        const a = (k / 8) * Math.PI * 2;
        ten.position.set(Math.cos(a) * 3.5, -7, Math.sin(a) * 3.5);
        j.add(ten);
      }
      const holder = this.#onSurface(new THREE.Group(), c, r, d, 40 + Math.random() * 30);
      holder.add(j);
      const ph = Math.random() * 6;
      this.anim.push((t) => {
        j.position.y = Math.sin(t * 0.5 + ph) * 4;
        dome.scale.y = 1 + Math.sin(t * 1.6 + ph) * 0.15;
      });
    }
  }

  #saturnine(c, r) {
    const tex = this.#planetTex((x, w, h) => {
      for (let y = 0; y < h; y += 4) {
        const k = Math.sin(y * 0.09) * 0.5 + Math.sin(y * 0.031) * 0.5;
        x.fillStyle = `rgb(${200 + k * 40},${160 + k * 40},${110 + k * 50})`;
        x.fillRect(0, y, w, 4);
      }
    });
    this.#planet(c, r, tex, 0xffd8a0);
    // rings: a flat ring with banded alpha
    const rc = document.createElement('canvas');
    rc.width = 512;
    rc.height = 4;
    const rx = rc.getContext('2d');
    for (let x = 0; x < 512; x++) {
      const a = (Math.sin(x * 0.11) * 0.5 + 0.5) * (Math.sin(x * 0.023) * 0.4 + 0.6) * (x > 230 && x < 260 ? 0.05 : 1);
      rx.fillStyle = `rgba(230,210,180,${a * 0.75})`;
      rx.fillRect(x, 0, 1, 4);
    }
    const rtex = new THREE.CanvasTexture(rc);
    const ringGeo = new THREE.RingGeometry(r * 1.4, r * 2.6, 128, 1);
    // map u across the ring's width
    const pos = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (d - r * 1.4) / (r * 1.2), 0.5);
    }
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: rtex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    ring.position.copy(c);
    ring.rotation.x = -Math.PI / 2 + 0.12;
    this.root.add(ring);
    // icy ring rubble right where we fly through
    const through = this.#routeAt(172);
    const rock = new THREE.IcosahedronGeometry(1, 0);
    const inst = new THREE.InstancedMesh(rock, this.mat({ color: 0xe8e0d0 }), 400);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 400; i++) {
      const p = through.clone().add(new THREE.Vector3((Math.random() - 0.5) * 260, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 260));
      if (p.distanceTo(through) < 14) p.y += 30;
      m.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)), new THREE.Vector3().setScalar(0.5 + Math.random() * 3));
      inst.setMatrixAt(i, m);
    }
    this.root.add(inst);
    // space whales gliding along the rings, singing
    const glow = new THREE.MeshBasicMaterial({ color: 0x9ab0ff, transparent: true, opacity: 0.85, fog: false });
    this.whales = [];
    for (let k = 0; k < 3; k++) {
      const w = this.game.assets.model('sea_whale');
      if (!w) break;
      w.scale.multiplyScalar(2.2);
      w.traverse((o) => o.isMesh && (o.material = glow));
      this.root.add(w);
      const mixer = w.userData.animations?.length ? new THREE.AnimationMixer(w) : null;
      mixer?.clipAction(w.userData.animations[0]).play();
      const ph = k * 0.7;
      this.anim.push((t, dt) => {
        mixer?.update(dt);
        const a = t * 0.05 + ph;
        const rr = r * 2.0 + k * 20;
        const p = new THREE.Vector3(Math.cos(a) * rr, 30 + Math.sin(t * 0.3 + k) * 10, Math.sin(a) * rr).add(c);
        w.lookAt(p.clone().add(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))));
        w.position.copy(p);
      });
      this.whales.push(w);
    }
  }

  #opal(c, r) {
    const tex = this.#planetTex((x, w, h) => {
      x.fillStyle = '#2a2a5a';
      x.fillRect(0, 0, w, h);
      for (let k = 0; k < 300; k++) {
        x.fillStyle = `hsla(${180 + Math.random() * 120},80%,70%,0.3)`;
        x.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 10, 2 + Math.random() * 6);
      }
    });
    this.#planet(c, r, tex, 0x7ae0ff);
    const through = this.#routeAt(214);
    const crystalCols = [0x7affff, 0xff8aff, 0xb08aff, 0x8affb0];
    for (const d of this.#near(c, through, 0.45, 70)) {
      const h = 5 + Math.random() * 22;
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), this.mat({ color: crystalCols[Math.floor(Math.random() * 4)], unlit: true, opacity: 0.85 }));
      cr.scale.set(1 + Math.random() * 2, h, 1 + Math.random() * 2);
      const holder = this.#onSurface(new THREE.Group(), c, r, d);
      cr.position.y = h * 0.5;
      cr.rotation.y = Math.random() * 3;
      holder.add(cr);
    }
    // the lantern-folk: tall, slender, glowing heads — they wave as you pass
    const body = this.mat({ color: 0x3a3a6a });
    for (const d of this.#near(c, through, 0.18, 12)) {
      const f = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 6, 6), body);
      torso.position.y = 3;
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), this.mat({ color: [0xfff0a0, 0xa0fff0, 0xffb0f0][Math.floor(Math.random() * 3)], unlit: true }));
      head.position.y = 7;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 4), body);
      arm.position.set(1.0, 5.2, 0);
      arm.geometry.translate(0, 1.6, 0);
      f.add(torso, head, arm);
      const holder = this.#onSurface(new THREE.Group(), c, r, d);
      holder.add(f);
      const ph = Math.random() * 6;
      this.anim.push((t) => {
        arm.rotation.z = -0.6 + Math.sin(t * 4 + ph) * 0.6; // waving
        head.scale.setScalar(1 + Math.sin(t * 2 + ph) * 0.08);
        f.rotation.y = Math.sin(t * 0.2 + ph);
      });
    }
    // auroras: ribbons above the surface
    const auroraMat = new THREE.MeshBasicMaterial({ color: 0x6affb0, transparent: true, opacity: 0.25, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (let k = 0; k < 4; k++) {
      const geo = new THREE.PlaneGeometry(400, 60, 40, 1);
      const rib = new THREE.Mesh(geo, k % 2 ? auroraMat : auroraMat.clone());
      if (k % 2) rib.material.color.setHex(0xb08aff);
      const holder = this.#onSurface(new THREE.Group(), c, r, through.clone().sub(c).normalize(), 90 + k * 25);
      holder.add(rib);
      rib.rotation.y = k * 0.6;
      const p0 = geo.attributes.position.array.slice();
      this.anim.push((t) => {
        const a = geo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) a[i + 2] = p0[i + 2] + Math.sin(p0[i] * 0.02 + t * 0.6 + k) * 20;
        geo.attributes.position.needsUpdate = true;
      });
    }
  }

  #comet() {
    const p = this.#routeAt(232).add(new THREE.Vector3(-260, 80, 120));
    const head = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 8), new THREE.MeshBasicMaterial({ color: 0xe8f8ff, fog: false }));
    head.position.copy(p);
    this.root.add(head);
    this.#sprite(this.#glowTex('rgba(200,240,255,0.9)', 'rgba(200,240,255,0)'), 160, p);
    for (let k = 1; k <= 14; k++) this.#sprite(this.#glowTex('rgba(150,220,255,0.5)', 'rgba(150,220,255,0)'), 120 - k * 4, p.clone().add(new THREE.Vector3(k * 26, k * 6, -k * 14)), 0.7 - k * 0.04);
  }

  // ===========================================================================
  // The ship + the ride
  // ===========================================================================

  #ship() {
    const ship = new THREE.Group();
    const hull = this.mat({ color: 0xe8e0d0 });
    const red = this.mat({ color: 0xc83a2a });
    const floor = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.2, 24, 1), hull);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    const glassFloor = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ color: 0xc8e8ff, transparent: true, opacity: 0.06, depthWrite: false, fog: false }));
    glassFloor.rotation.x = -Math.PI / 2;
    glassFloor.position.y = -0.05;
    ship.add(glassFloor);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 6, 32), red);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = -0.05;
    ship.add(floor, trim);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 3), this.mat({ color: k % 2 ? 0xffe070 : 0x70e0ff, unlit: true }));
      l.position.set(Math.cos(a) * 2.2, 0.05, Math.sin(a) * 2.2);
      ship.add(l);
    }
    for (const [x, , z] of SEATS) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), red);
      seat.position.set(x, 0.25, z);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.12), red);
      back.position.set(x, 0.75, z - 0.3);
      ship.add(seat, back);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc8e8ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    ship.add(dome);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3, 10), new THREE.MeshBasicMaterial({ color: 0x8ad8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    flame.rotation.x = Math.PI;
    flame.position.y = -2;
    ship.add(flame);
    this.flame = flame;
    this.ship = ship;
    this.root.add(ship);
  }

  /** Called every frame by Rocket while you're aboard. */
  ride(s, seat) {
    const g = this.game;
    const p = this.pose(s, _p, _l);
    this.ship.position.copy(p);
    // nose forward, cabin floor roughly level
    _m.lookAt(p, _l, _up);
    this.ship.quaternion.setFromRotationMatrix(_m).multiply(_flip);
    this.ship.updateMatrixWorld();
    const sp = SEATS[seat % 4];
    _p.set(sp[0], sp[1], sp[2]).applyMatrix4(this.ship.matrixWorld);
    g.player.position.copy(_p);
    this.flame.scale.y = 0.8 + Math.sin(g.time * 30) * 0.15;
  }

  #tick(dt, t) {
    for (const f of this.anim) f(t, dt);
    if (this.earth) this.earth.rotation.y += dt * 0.01;
  }
}

const _p = new THREE.Vector3();
const _l = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
