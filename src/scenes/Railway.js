import * as THREE from 'three';

/**
 * Railway
 * -------
 * Track + level crossing + the train, on the World map.
 *
 *  - the line is a road def flagged `rail` in MapLayout (so the terrain gets
 *    graded and the gravel ballast comes for free); here we lay sleepers and
 *    two steel rails along it
 *  - one level crossing where it meets the town road: crossbucks, flashing
 *    red lamps, a bell and barrier arms that drop when a train is coming
 *  - the train (your Tangara set) runs every ~2–3 minutes, alternating
 *    direction, ~85 km/h: headlight, rumble + wheel clatter, and it sounds
 *    its horn approaching the crossing
 *  - it doesn't stop. Standing on the track when it comes is fatal.
 */
const GAUGE = 1.435;
const RAIL_TOP = 0.3; // above the ballast surface
const SPEED = 24; // m/s
const TRAIN_LEN = 54;

export class Railway {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;
    const T = scene.terrain;
    this.road = T.roads.find((r) => r.rail);
    this.#path();
    this.#track();
    this.#crossing();
    this.#train();
    this.timer = 35; // first train shortly after you get here
    this.run = null;
    this.bellT = 0;
    scene.updaters.push((dt) => this.update(dt));
  }

  // ---- geometry along the line ------------------------------------------------

  #path() {
    const S = this.road.samples;
    this.pts = S.map((s) => new THREE.Vector3(s.x, s.y, s.z));
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.length = this.cum.at(-1);
  }

  /** Point + tangent at distance s along the line (clamped/extrapolated). */
  at(s, out = new THREE.Vector3(), tan = null) {
    const c = this.cum;
    if (s <= 0 || s >= this.length) {
      const i0 = s <= 0 ? 0 : this.pts.length - 2;
      const a = this.pts[i0];
      const b = this.pts[i0 + 1];
      const d = _t.subVectors(b, a).normalize();
      out.copy(s <= 0 ? a : b).addScaledVector(d, s <= 0 ? s : s - this.length);
      if (tan) tan.copy(d);
      return out;
    }
    let lo = 0;
    let hi = c.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (c[m] <= s) lo = m;
      else hi = m;
    }
    const k = (s - c[lo]) / (c[hi] - c[lo] || 1);
    out.lerpVectors(this.pts[lo], this.pts[hi], k);
    if (tan) tan.subVectors(this.pts[hi], this.pts[lo]).normalize();
    return out;
  }

  #track() {
    const sc = this.scene;
    // Sleepers: one instanced mesh, every 0.7 m.
    const n = Math.floor(this.length / 0.7);
    const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.14, 0.24), sc.mat({ color: 0x3a2e24 }), n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      this.at(i * 0.7, p, tan);
      q.setFromAxisAngle(_up, Math.atan2(tan.x, tan.z));
      m.compose(p.setY(p.y + 0.09), q, _one);
      sleepers.setMatrixAt(i, m);
    }
    sleepers.frustumCulled = false;
    sc.root.add(sleepers);

    // Rails: a box-section ribbon per side, resampled every 2 m.
    const steel = sc.mat({ color: 0x8a8a92 });
    for (const side of [-1, 1]) {
      const pos = [];
      const idx = [];
      const steps = Math.ceil(this.length / 2);
      for (let i = 0; i <= steps; i++) {
        this.at(Math.min(this.length, i * 2), p, tan);
        const nx = tan.z;
        const nz = -tan.x;
        const cx = p.x + nx * side * (GAUGE / 2);
        const cz = p.z + nz * side * (GAUGE / 2);
        const yTop = p.y + RAIL_TOP;
        const w = 0.07;
        // 4 verts per ring: outer-bottom, outer-top, inner-top, inner-bottom
        pos.push(cx + nx * w, p.y + 0.16, cz + nz * w, cx + nx * w, yTop, cz + nz * w, cx - nx * w, yTop, cz - nz * w, cx - nx * w, p.y + 0.16, cz - nz * w);
        if (i) {
          const a = (i - 1) * 4;
          const b = i * 4;
          for (const [u, v] of [[0, 1], [1, 2], [2, 3]]) idx.push(a + u, b + u, b + v, a + u, b + v, a + v);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const rail = new THREE.Mesh(geo, steel);
      rail.frustumCulled = false;
      sc.root.add(rail);
    }
  }

  // ---- level crossing -------------------------------------------------------------

  #crossing() {
    const sc = this.scene;
    const town = sc.terrain.roads.find((r) => r.name === 'town');
    let best = { d: Infinity };
    this.pts.forEach((rp, i) => {
      for (const t of town.samples) {
        const d = Math.hypot(rp.x - t.x, rp.z - t.z);
        if (d < best.d) best = { d, i, t };
      }
    });
    const c = this.pts[best.i];
    this.crossS = this.cum[best.i];
    // road direction at the crossing
    const ti = town.samples.indexOf(best.t);
    const ta = town.samples[Math.max(0, ti - 2)];
    const tb = town.samples[Math.min(town.samples.length - 1, ti + 2)];
    const roadDir = new THREE.Vector3(tb.x - ta.x, 0, tb.z - ta.z).normalize();
    const roadSide = new THREE.Vector3(roadDir.z, 0, -roadDir.x);
    this.cross = c.clone();
    this.lamps = [];
    this.arms = [];
    const white = sc.mat({ color: 0xe8e4d8 });
    const red = sc.mat({ color: 0xb02020 });
    const post = sc.mat({ color: 0x9a9aa0 });
    const off = sc.mat({ color: 0x2a0808 });
    this.lampOn = sc.mat({ color: 0xff3018, unlit: true });
    this.lampOff = off;
    // One signal on each approach (before the tracks, on the right-hand side).
    for (const dirSign of [-1, 1]) {
      const base = c.clone().addScaledVector(roadDir, dirSign * 6).addScaledVector(roadSide, dirSign * 4.6);
      const y = sc.groundHeight(base.x, base.z);
      const g = new THREE.Group();
      g.position.set(base.x, y, base.z);
      g.rotation.y = Math.atan2(roadDir.x, roadDir.z) + (dirSign > 0 ? Math.PI : 0);
      sc.root.add(g);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.6, 0.14), post);
      pole.position.y = 1.8;
      g.add(pole);
      for (const r of [0.6, -0.6]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.04), white);
        bar.position.set(0, 3.2, 0.1);
        bar.rotation.z = r;
        g.add(bar);
      }
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.08), post);
      head.position.set(0, 2.45, 0.1);
      g.add(head);
      for (const lx of [-0.42, 0.42]) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.1), off);
        lamp.position.set(lx, 2.45, 0.16);
        g.add(lamp);
        this.lamps.push(lamp);
      }
      // barrier arm: pivots at the post, swings down across the lane
      const arm = new THREE.Group();
      arm.position.set(-0.2, 1.1, 0.12);
      const boom = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.08), white);
      boom.position.x = -2.1;
      arm.add(boom);
      for (let k = 0; k < 4; k++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.125, 0.085), red);
        stripe.position.x = -0.6 - k * 1.0;
        arm.add(stripe);
      }
      arm.rotation.z = -Math.PI / 2 + 0.05; // up
      g.add(arm);
      this.arms.push(arm);
      sc.addColliderBox(base.x, y + 1.8, base.z, 0.3, 3.6, 0.3);
    }
    this.flashLight = sc.addLight({ position: c.clone().setY(c.y + 3), color: 0xff2010, range: 14, intensity: 1.4, enabled: false, priority: 2 });
    this.armDown = 0;
  }

  // ---- the train -------------------------------------------------------------------------

  #train() {
    const sc = this.scene;
    this.trainObj = new THREE.Group();
    const model = sc.place('train', { x: 0, y: 0, z: 0, parent: this.trainObj });
    void model;
    this.trainObj.visible = false;
    sc.root.add(this.trainObj);
    this.headLight = sc.addLight({ position: new THREE.Vector3(), color: 0xfff0c8, range: 34, intensity: 1.6, enabled: false, priority: 3 });
    // a bright headlamp blob
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), sc.mat({ color: 0xfff8e0, unlit: true, fogScale: 0.3 }));
    sc.root.add(this.lamp);
    this.lamp.visible = false;
  }

  /** Train extent along the line for the current run: [rear s, front s]. */
  #span() {
    const r = this.run;
    return r.dir > 0 ? [r.s - TRAIN_LEN, r.s] : [r.s, r.s + TRAIN_LEN];
  }

  update(dt) {
    const g = this.game;
    if (g.scene !== this.scene) return;

    const guest = g.net?.online && !g.net.isHost;
    if (!this.run && !guest) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const dir = (this._lastDir ?? -1) * -1;
        this._lastDir = dir;
        g.net?.event('train', { dir });
        this.startRun(dir);
      }
    }
    this.#move(dt);
  }

  /** A train sets off (locally, or because the host said so). */
  startRun(dir, s = null) {
    const g = this.game;
    if (this.run) return;
    {
      {
        this.run = { dir, s: s ?? (dir > 0 ? -80 : this.length + 80), horned: false };
        this.trainObj.visible = true;
        this.lamp.visible = true;
        this.headLight.enabled = true;
        this.rumble = g.audio.positional('train_rumble', this.trainObj, { volume: 1.2, refDistance: 12, rolloff: 1.2, maxDistance: 400 });
      }
    }
  }

  #move(dt) {
    const g = this.game;

    // Crossing state: active while the train is within ~280 m or still on it.
    let active = false;
    if (this.run) {
      const r = this.run;
      r.s += r.dir * SPEED * dt;
      const [rear, front] = this.#span();
      const lead = r.dir > 0 ? front : rear; // the end facing the way we go
      const toCross = (this.crossS - lead) * r.dir;
      active = toCross < 280 && (r.dir > 0 ? rear : front) * r.dir < this.crossS * r.dir + 8;
      if (!r.horned && toCross < 330) {
        r.horned = true;
        g.audio.oneShot('horn', { volume: 1, object: this.trainObj });
        setTimeout(() => this.run && g.audio.oneShot('horn', { volume: 0.9, object: this.trainObj }), 1600);
      }
      // Place the cars on the chord between both ends.
      const a = this.at(rear, _a);
      const b = this.at(front, _b);
      this.trainObj.position.lerpVectors(a, b, 0.5).setY((a.y + b.y) / 2 + RAIL_TOP - 0.02);
      this.trainObj.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      this.trainObj.rotation.x = -Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
      const head = r.dir > 0 ? b : a;
      const fwd = _c.subVectors(b, a).normalize().multiplyScalar(r.dir);
      this.lamp.position.copy(head).addScaledVector(fwd, 0.4).setY(head.y + 2.2);
      this.headLight.position.copy(head).addScaledVector(fwd, 10).setY(head.y + 2);
      this.#hitCheck(a, b);
      // done?
      if ((r.dir > 0 && rear > this.length + 60) || (r.dir < 0 && front < -60)) {
        this.run = null;
        this.trainObj.visible = false;
        this.lamp.visible = false;
        this.headLight.enabled = false;
        this.rumble?.stop();
        this.rumble = null;
        this.timer = 120 + Math.random() * 70;
      }
    }

    // Lamps alternate, bell rings, arms come down.
    const blink = Math.floor(g.time * 1.6) % 2;
    this.lamps.forEach((l, i) => (l.material = active && i % 2 === blink ? this.lampOn : this.lampOff));
    this.flashLight.enabled = active;
    if (active) this.flashLight.position.copy(this.cross).setY(this.cross.y + 3).addScalar(blink ? 0.6 : -0.6);
    if (active) {
      this.bellT -= dt;
      if (this.bellT <= 0) {
        this.bellT = 0.55;
        const d = g.camera.position.distanceTo(this.cross);
        if (d < 160) g.audio.oneShot('bell', { volume: Math.max(0.1, 1 - d / 160) });
      }
    }
    this.armDown = THREE.MathUtils.damp(this.armDown, active ? 1 : 0, 1.6, dt);
    for (const arm of this.arms) arm.rotation.z = (-Math.PI / 2 + 0.05) * (1 - this.armDown);
  }

  /** Anyone on the track where the train is? */
  #hitCheck(a, b) {
    const g = this.game;
    if (g.hunger.dead) return;
    const v = g.vehicle.active;
    const p = v ? v.object.position : g.player.feet;
    if (Math.abs(p.y - (a.y + b.y) / 2) > 4) return;
    // distance in XZ to the train's chord
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const t = THREE.MathUtils.clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
    const d = Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
    if (d < (v ? 2.6 : 1.9)) {
      g.camera.userData.shake = 0.5;
      g.hunger.knockOut('You were hit by the train.', "You wake up at home. You don't remember getting here.", 'horn');
    }
  }
}

const _up = new THREE.Vector3(0, 1, 0);
const _one = new THREE.Vector3(1, 1, 1);
const _t = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
