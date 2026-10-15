import * as THREE from 'three';
import { signTexture } from '../core/Procedural.js';
import { addSeat } from './Devices.js';

/**
 * Playground
 * ----------
 * Pine Hollow Park, south of the town road: an empty playground at 3 a.m.
 *
 *  - Sandbox: a deformable heightfield. You leave footprints walking through
 *    it, E digs a hole (the sand lands in a pile beside it), Q pats down a
 *    sandcastle tower (again on the same spot = taller). Rain slowly melts
 *    everything back flat and darkens the sand.
 *  - Swing set: sit on a swing, W pumps (in time with the swing) to go higher.
 *  - Slide: climb up and you go down it.
 *  - Seesaw, bench, a flickering lamp post, a sign.
 *
 * Built in code (no models), registered on the World scene.
 */
export function buildPlayground(scene, p) {
  const g = scene.game;
  const y0 = p.y;
  const wood = scene.mat({ map: scene.tex('planks', 1, 1), color: 0xa08a68 });
  const red = scene.mat({ color: 0xa83228 });
  const blue = scene.mat({ color: 0x2c5a8a });
  const yellow = scene.mat({ color: 0xc8a030 });
  const iron = scene.mat({ color: 0x5a5a60 });

  const sandbox = new Sandbox(scene, p.x - 3, y0, p.z + 2);

  // ---- swing set (bar runs along X; swings move along Z) ---------------------
  const sx = p.x + 6;
  const sz = p.z - 3;
  const barY = y0 + 2.5;
  for (const dx of [-2.2, 2.2]) {
    for (const dz of [-0.9, 0.9]) {
      const leg = scene.box(0.1, 2.7, 0.1, blue, sx + dx, y0 + 1.25, sz + dz * 0.5, { collide: false });
      leg.rotation.x = dz > 0 ? -0.36 : 0.36;
    }
    scene.addColliderBox(sx + dx, y0 + 1.2, sz, 0.3, 2.4, 1.6);
  }
  scene.box(4.6, 0.12, 0.12, blue, sx, barY, sz, { collide: false });
  for (const dx of [-1, 1]) new Swing(scene, sx + dx, barY, sz, { iron, seatMat: red });

  // ---- slide -------------------------------------------------------------------
  const lx = p.x - 9;
  const lz = p.z - 5;
  const top = y0 + 1.7;
  scene.box(1.0, 0.08, 1.0, wood, lx, top, lz, { collide: false }); // platform
  for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    scene.box(0.08, 2.6, 0.08, yellow, lx + dx, y0 + 1.3, lz + dz, { collide: false });
  }
  for (let i = 0; i < 6; i++) scene.box(0.9, 0.05, 0.05, iron, lx, y0 + 0.28 * (i + 1), lz - 0.5, { collide: false }); // ladder rungs
  const slideLen = 3.4;
  const slope = Math.atan2(top - y0 - 0.25, slideLen);
  const chute = scene.box(0.8, 0.05, Math.hypot(slideLen, top - y0), yellow, lx, (top + y0 + 0.25) / 2, lz + 0.5 + slideLen / 2, { collide: false });
  chute.rotation.x = slope;
  for (const s of [-0.42, 0.42]) {
    const side = scene.box(0.05, 0.2, Math.hypot(slideLen, top - y0), red, lx + s, (top + y0 + 0.25) / 2 + 0.1, lz + 0.5 + slideLen / 2, { collide: false });
    side.rotation.x = slope;
  }
  scene.addColliderBox(lx, y0 + 1, lz, 1.0, 2, 1.0);
  const slideSeat = {
    eye: new THREE.Vector3(),
    yaw: Math.PI, // facing down the chute (+Z)
    pitch: -0.25,
    yawLimit: 0.6,
    standAt: new THREE.Vector3(lx, y0, lz + 0.5 + slideLen + 0.9),
  };
  let slideT = -1;
  const ladder = scene.box(0.9, 1.8, 0.2, scene.mat({ color: 0, opacity: 0 }), lx, y0 + 0.9, lz - 0.6, { collide: false });
  ladder.visible = false;
  scene.addInteractable(ladder, {
    prompt: 'Go down the slide',
    range: 2.6,
    enabled: () => !g.player.seated,
    action: () => {
      slideT = 0;
      g.player.sit(slideSeat);
    },
  });
  scene.updaters.push((dt) => {
    if (slideT < 0) return;
    if (g.player.seat !== slideSeat) {
      slideT = -1;
      return;
    }
    slideT += dt;
    const e = slideSeat.eye;
    if (slideT < 0.9) {
      // climb the ladder
      const k = slideT / 0.9;
      e.set(lx, y0 + 1.5 + k * (top - y0 - 0.1), lz - 0.7 + k * 0.6);
    } else {
      // whee: accelerate down the chute
      const s = Math.min(1, ((slideT - 0.9) / 1.3) ** 1.6);
      e.set(lx, top + 0.95 - s * (top - y0 - 0.2), lz + 0.4 + s * slideLen);
      if (s >= 1) {
        slideT = -1;
        g.audio.oneShot('door', { volume: 0.3, rate: 1.4 });
        g.player.stand();
      }
    }
  });

  // ---- seesaw, bench, lamp, sign, fence ------------------------------------------
  const ssx = p.x + 4;
  const ssz = p.z + 6;
  scene.box(0.3, 0.45, 0.3, iron, ssx, y0 + 0.22, ssz, { collide: true });
  const plank = scene.box(0.32, 0.06, 3.6, red, ssx, y0 + 0.5, ssz, { collide: false });
  plank.rotation.x = 0.22; // one end down, nobody on the other
  for (const dz of [-1.6, 1.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.04), iron);
    h.position.set(0, 0.12, dz + (dz > 0 ? -0.15 : 0.15));
    plank.add(h);
  }

  // Bench facing the sandbox (south), sit-and-smoke spot.
  const bx = p.x - 3;
  const bz = p.z - 6.5;
  const benchSeat = scene.box(1.8, 0.06, 0.45, wood, bx, y0 + 0.45, bz, { collide: false });
  scene.box(1.8, 0.4, 0.05, wood, bx, y0 + 0.75, bz - 0.24, { collide: false });
  for (const dx of [-0.8, 0.8]) scene.box(0.06, 0.45, 0.4, iron, bx + dx, y0 + 0.22, bz, { collide: false });
  scene.addColliderBox(bx, y0 + 0.4, bz, 1.8, 0.8, 0.5);
  addSeat(scene, benchSeat, {
    eye: [bx, y0 + 1.15, bz],
    yaw: Math.PI, // facing +Z, over the sandbox
    standAt: [bx, y0, bz + 0.8],
  });

  const lampX = p.x + 1;
  const lampZ = p.z - 7;
  scene.box(0.12, 4, 0.12, iron, lampX, y0 + 2, lampZ);
  const bulb = scene.box(0.4, 0.15, 0.4, scene.mat({ color: 0xffe8b0, unlit: true }), lampX, y0 + 4, lampZ, { collide: false });
  void bulb;
  scene.addLight({ position: new THREE.Vector3(lampX, y0 + 3.7, lampZ), color: 0xffd8a0, range: 14, intensity: 1.0, flicker: 0.35 });

  const signTex = signTexture(['PINE HOLLOW PARK', 'CLOSES AT DUSK'], { bg: '#2e4a2a' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), scene.mat({ map: signTex, doubleSide: true }));
  sign.position.set(p.x + 2, y0 + 1.6, p.z - 12.5);
  sign.rotation.y = Math.PI;
  scene.root.add(sign);
  scene.box(0.08, 1.4, 0.08, iron, p.x + 1.3, y0 + 0.7, p.z - 12.5, { collide: false });
  scene.box(0.08, 1.4, 0.08, iron, p.x + 2.7, y0 + 0.7, p.z - 12.5, { collide: false });

  // Low fence around the park, gap on the road side (north).
  const fence = scene.mat({ color: 0x6a6258 });
  const R = 13;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    if (Math.abs(Math.sin(a) + 1) < 0.25) continue; // gap facing -Z
    const fx = p.x + Math.cos(a) * R;
    const fz = p.z + Math.sin(a) * R;
    const len = 2 * R * Math.sin(Math.PI / 28);
    const rail = scene.box(len, 0.06, 0.06, fence, fx, y0 + 0.7, fz, { collide: false, rotY: -a + Math.PI / 2 });
    void rail;
    scene.box(0.07, 0.8, 0.07, fence, fx, y0 + 0.4, fz, { collide: false });
  }

  scene.updaters.push((dt, t) => sandbox.update(dt, t));
  return { sandbox };
}

// -----------------------------------------------------------------------------
// Swing
// -----------------------------------------------------------------------------

class Swing {
  constructor(scene, x, barY, z, { iron, seatMat }) {
    const g = scene.game;
    this.len = 1.95;
    this.angle = 0;
    this.vel = 0;
    this.pivot = new THREE.Vector3(x, barY, z);
    this.group = new THREE.Group();
    this.group.position.copy(this.pivot);
    scene.root.add(this.group);
    for (const dx of [-0.22, 0.22]) {
      const chain = new THREE.Mesh(new THREE.BoxGeometry(0.025, this.len, 0.025), iron);
      chain.position.set(dx, -this.len / 2, 0);
      this.group.add(chain);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), seatMat);
    seat.position.y = -this.len;
    this.group.add(seat);

    this.seat = {
      eye: new THREE.Vector3(),
      yaw: 0, // facing north (-Z), swinging along Z
      pitch: -0.05,
      yawLimit: 1.4,
      standAt: new THREE.Vector3(x, barY - 2.5, z + 0.9),
    };
    scene.addInteractable(seat, {
      prompt: 'Sit on the swing',
      range: 2.4,
      enabled: () => !g.player.seated,
      action: () => {
        g.player.sit(this.seat);
        g.hud.toast('W in time with the swing to go higher. E to get off.', 3500);
      },
    });

    let creak = 0;
    scene.updaters.push((dt, t) => {
      const riding = g.player.seat === this.seat;
      // Pendulum. Pump: W while swinging forward (toward -Z = negative angle).
      const grav = -(9.8 / this.len) * Math.sin(this.angle);
      let pump = 0;
      if (riding && g.input.down('KeyW')) pump = (Math.abs(this.vel) < 0.05 ? -1 : Math.sign(this.vel)) * 0.8;
      const wind = (g.weather?.wind ?? 0) * Math.sin(t * 1.3 + x) * 0.6;
      this.vel += (grav + pump + wind) * dt;
      this.vel *= 1 - (riding ? 0.12 : 0.35) * dt;
      this.angle += this.vel * dt;
      if (Math.abs(this.angle) > 1.15) {
        this.angle = Math.sign(this.angle) * 1.15; // chains go slack: hard stop
        this.vel *= -0.3;
      }
      this.group.rotation.x = -this.angle;
      if (riding) {
        const r = this.len - 0.95; // eye ~0.95 m above the seat
        this.seat.eye.set(this.pivot.x, this.pivot.y - r * Math.cos(this.angle), this.pivot.z + r * Math.sin(this.angle)); // same rotation as the chains (rotation.x = -angle)
        g.player.pitchOffset = this.angle * 0.25;
        this.wasRiding = true;
      } else if (this.wasRiding) {
        this.wasRiding = false;
        g.player.pitchOffset = 0;
      }
      // Chain creak at the ends of each swing.
      creak -= dt;
      if (Math.abs(this.angle) > 0.35 && Math.abs(this.vel) < 0.4 && creak <= 0) {
        creak = 0.8;
        g.audio.oneShot('creak', { volume: Math.min(0.5, Math.abs(this.angle) * 0.5), object: this.group });
      }
    });
  }
}

// -----------------------------------------------------------------------------
// Sandbox: deformable heightfield
// -----------------------------------------------------------------------------

const SIZE = 6; // metres
const N = 60; // cells per side
const CELL = SIZE / N;
const MIN_H = -0.42;
const MAX_H = 0.9;

class Sandbox {
  constructor(scene, cx, groundY, cz) {
    this.scene = scene;
    this.game = scene.game;
    this.cx = cx;
    this.cz = cz;
    this.baseY = groundY + 0.45; // raised box, so the deepest hole stays above the grass
    this.h = new Float32Array((N + 1) * (N + 1));
    this.packed = new Float32Array((N + 1) * (N + 1)); // 0 loose … 1 patted down
    this.drawn = new Uint8Array((N + 1) * (N + 1)); // cells carved by the current finger stroke
    this.settle = 0; // seconds of slumping left after an edit
    this.digT = 0;
    this.lastDraw = null;
    this.dirty = true;
    this.wet = 0;
    this.lastStep = null;
    this.foot = 1;
    this.relaxTimer = 0;

    // Mesh
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
    geo.rotateX(-Math.PI / 2);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((N + 1) * (N + 1) * 3), 3));
    this.geo = geo;
    const mat = scene.mat({ map: scene.tex('dirt', 6, 6), color: 0xf0d8a8, vertexColors: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(cx, this.baseY, cz);
    scene.root.add(this.mesh);

    // Raised wooden frame, a floor to stand on at sand level, and a two-step
    // invisible ramp all the way round so you can walk straight in.
    const wood = scene.mat({ map: scene.tex('planks', 1, 1), color: 0x8a7050 });
    for (const [dx, dz, w, d] of [
      [0, -SIZE / 2 - 0.1, SIZE + 0.4, 0.2],
      [0, SIZE / 2 + 0.1, SIZE + 0.4, 0.2],
      [-SIZE / 2 - 0.1, 0, 0.2, SIZE],
      [SIZE / 2 + 0.1, 0, 0.2, SIZE],
    ]) {
      scene.box(w, 0.55, d, wood, cx + dx, groundY + 0.27, cz + dz, { collide: false });
    }
    scene.addColliderBox(cx, groundY + 0.225, cz, SIZE + 0.4, 0.45, SIZE + 0.4);
    for (const [k, top] of [[0, 0.3], [1, 0.15]]) {
      const off = SIZE / 2 + 0.2 + 0.15 + k * 0.3;
      const len = SIZE + 0.4 + 2 * (0.3 + k * 0.3);
      scene.addColliderBox(cx, groundY + top / 2, cz - off, len, top, 0.3);
      scene.addColliderBox(cx, groundY + top / 2, cz + off, len, top, 0.3);
      scene.addColliderBox(cx - off, groundY + top / 2, cz, 0.3, top, len);
      scene.addColliderBox(cx + off, groundY + top / 2, cz, 0.3, top, len);
    }

    // Left behind: a bucket and a spade, a half-melted castle, small footprints.
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.2, 8), scene.mat({ color: 0xd04030 }));
    bucket.position.set(cx + 1.6, this.baseY + 0.1, cz - 1.2);
    bucket.rotation.z = 1.3;
    scene.root.add(bucket);
    const spade = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.18), scene.mat({ color: 0x3060c0 }));
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.4), scene.mat({ color: 0x3060c0 }));
    handle.position.z = 0.28;
    spade.add(blade, handle);
    spade.position.set(cx + 1.2, this.baseY + 0.03, cz - 0.6);
    spade.rotation.y = 0.7;
    scene.root.add(spade);
    this.#castle(cx - 1, cz - 1, 1);
    this.#castle(cx - 1.4, cz - 0.7, 0.7);
    for (let i = 0; i < 9; i++) this.#footprint(cx + 2.2 - i * 0.35, cz + 1.5 + Math.sin(i) * 0.3, i % 2 ? 1 : -1, -Math.PI / 2, 0.55);
    this.#relax(0.5);

    this.mesh.userData.sandbox = this;
    scene.addInteractable(this.mesh, {
      prompt: 'Dig (hold)',
      range: 3,
      noClick: true, // LMB draws in the sand instead
      hint: 'HOLD E dig · Q bucket castle · HOLD LMB draw with your finger · R rake smooth',
      action: (point) => this.#dig(point),
      secondary: { label: 'Bucket castle', action: (point) => point && this.#castle(point.x, point.z, 1) },
    });
    this.#buildSpray(scene);
  }

  /** Net: replay another player's edit (no sound, no re-broadcast). */
  applyOp(op) {
    this._remote = true;
    try {
      if (op.o === 'dig') this.#dig({ x: op.x, z: op.z }, op.yaw);
      else if (op.o === 'castle') this.#castle(op.x, op.z, op.s);
      else if (op.o === 'rake') this.#rake({ x: op.x, z: op.z });
      else if (op.o === 'foot') this.#footprint(op.x, op.z, op.side, op.h, op.d);
      else if (op.o === 'line') this.#segment(op.a, op.b);
    } finally {
      this._remote = false;
    }
  }

  #share(op) {
    if (!this._remote) this.game.net?.online && this.game.net.event('sand', { op });
  }

  #sound(key, opts) {
    if (!this._remote) this.game.audio.oneShot(key, opts);
  }

  /** Index of the grid vertex nearest world (x, z), or -1 outside. */
  #cellRange(x, z, r) {
    const fx = (x - this.cx + SIZE / 2) / CELL;
    const fz = (z - this.cz + SIZE / 2) / CELL;
    const rr = Math.ceil(r / CELL) + 1;
    return [Math.max(0, Math.floor(fx) - rr), Math.min(N, Math.ceil(fx) + rr), Math.max(0, Math.floor(fz) - rr), Math.min(N, Math.ceil(fz) + rr)];
  }

  #each(x, z, r, fn) {
    const [i0, i1, j0, j1] = this.#cellRange(x, z, r);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const wx = this.cx - SIZE / 2 + i * CELL;
        const wz = this.cz - SIZE / 2 + j * CELL;
        const dx = wx - x;
        const dz = wz - z;
        const d = Math.hypot(dx, dz);
        if (d <= r) fn(j * (N + 1) + i, d, dx, dz);
      }
    }
    this.dirty = true;
    this.settle = 2;
  }

  #clamp(k) {
    this.h[k] = THREE.MathUtils.clamp(this.h[k], MIN_H, MAX_H);
  }

  #dig(point, yawIn) {
    if (!point) return;
    const g = this.game;
    const yawUse = yawIn ?? g.player.yaw;
    this.#share({ o: 'dig', x: r2(point.x), z: r2(point.z), yaw: r2(yawUse) });
    let removed = 0;
    this.#each(point.x, point.z, 0.4, (k, d) => {
      const before = this.h[k];
      this.h[k] -= 0.08 * (1 - (d / 0.4) ** 2);
      this.#clamp(k);
      this.packed[k] = 0;
      removed += before - this.h[k];
    });
    // Toss it to the side (to the right of where you're looking).
    const yaw = yawUse;
    const px = point.x + Math.cos(yaw) * 0.75;
    const pz = point.z - Math.sin(yaw) * 0.75;
    let w = 0;
    this.#each(px, pz, 0.45, (_k, d) => (w += 1 - d / 0.45));
    if (w > 0) {
      this.#each(px, pz, 0.45, (k, d) => {
        this.h[k] += (removed * (1 - d / 0.45)) / w;
        this.#clamp(k);
      });
    }
    this.#sound('sand', { volume: 0.5, rate: 0.9 + Math.random() * 0.2 });
    if (!this._remote || this.game.scene === this.scene) this.#spray(point, px, pz);
  }

  /** Pat down a round tower with crenellations; stacks on whatever is there. */
  #castle(x, z, scale = 1) {
    this.#share({ o: 'castle', x: r2(x), z: r2(z), s: scale });
    const r = 0.3 * scale;
    let peak = -Infinity;
    this.#each(x, z, r, (k) => (peak = Math.max(peak, this.h[k])));
    if (peak === -Infinity) return;
    const top = Math.min(MAX_H, Math.max(peak, 0) + 0.3 * scale);
    this.#each(x, z, r + 0.12, (k, d, dx, dz) => {
      let target;
      if (d <= r) {
        target = top - Math.pow(d / r, 6) * 0.06; // bucket taper
        this.packed[k] = 1;
        if (d > r * 0.6) {
          const sector = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2)) * 8);
          if (sector % 2 === 0) target += 0.07 * scale; // crenellations
        } else target -= 0.03; // dished top
      } else {
        target = this.h[k] + (top - this.h[k]) * 0.25 * (1 - (d - r) / 0.12); // little skirt
        this.packed[k] = Math.max(this.packed[k], 0.5);
      }
      this.h[k] = Math.max(this.h[k], target);
      this.#clamp(k);
    });
    this.#sound('sand', { volume: 0.4, rate: 0.7 });
  }

  /** Oval dent with a pushed-up rim. */
  #footprint(x, z, side, heading, depth = 1) {
    if (this.game.state === 'playing') this.#share({ o: 'foot', x: r2(x), z: r2(z), side, h: r2(heading), d: depth });
    const fx = x + Math.cos(heading) * 0.11 * side;
    const fz = z - Math.sin(heading) * 0.11 * side;
    const ax = -Math.sin(heading);
    const az = -Math.cos(heading); // along the step
    this.#each(fx, fz, 0.22, (k, _d, dx, dz) => {
      const along = dx * ax + dz * az;
      const across = dx * az - dz * ax;
      const e = (along / 0.15) ** 2 + (across / 0.07) ** 2;
      if (e < 1) this.h[k] -= 0.04 * depth * (1 - e);
      else if (e < 2) this.h[k] += 0.012 * depth * (2 - e);
      // Walking over a castle knocks it flat-ish.
      if (e < 2.2 && this.h[k] > 0.12) this.h[k] = THREE.MathUtils.lerp(this.h[k], 0.05, 0.6);
      if (e < 2) this.packed[k] *= 0.3;
      this.#clamp(k);
    });
  }

  /** Diffuse the field a bit (rain melts castles, fills holes). */
  #relax(amount) {
    const h = this.h;
    const n = N + 1;
    const out = new Float32Array(h.length);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const l = h[i > 0 ? k - 1 : k];
        const r = h[i < N ? k + 1 : k];
        const u = h[j > 0 ? k - n : k];
        const d = h[j < N ? k + n : k];
        out[k] = h[k] + amount * ((l + r + u + d) / 4 - h[k]);
      }
    }
    this.h = out;
    this.dirty = true;
  }

  /**
   * Angle of repose: wherever two neighbours differ by more than the sand
   * can hold, the excess slides downhill. Dry loose sand is weakest, wet sand
   * holds a steeper face, patted-down (castle) sand stands up on its own.
   */
  #slump() {
    const h = this.h;
    const pk = this.packed;
    const n = N + 1;
    const base = 0.05 + this.wet * 0.06;
    let moved = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * n + i;
        for (const b of [i < N ? a + 1 : -1, j < N ? a + n : -1]) {
          if (b < 0) continue;
          const diff = h[a] - h[b];
          const limit = base + Math.max(pk[a], pk[b]) * 0.4;
          const ex = Math.abs(diff) - limit;
          if (ex <= 0) continue;
          const m = ex * 0.25 * Math.sign(diff);
          h[a] -= m;
          h[b] += m;
          moved += Math.abs(m);
        }
      }
    }
    this.dirty = true;
    return moved;
  }

  /** Finger in the sand: a shallow groove along the stroke. */
  #draw(point) {
    const from = this.lastDraw ?? point;
    this.#segment([from.x, from.z], [point.x, point.z], this.drawn);
    this.settle = 0; // grooves are crisp; don't let them slump away instantly
    this.lastDraw = point.clone();
    // share the stroke in short pieces
    const sent = this.lastSent ?? from;
    if (Math.hypot(point.x - sent.x, point.z - sent.z) > 0.12 || !this.lastSent) {
      this.#share({ o: 'line', a: [r2(sent.x), r2(sent.z)], b: [r2(point.x), r2(point.z)] });
      this.lastSent = point.clone();
    }
  }

  /** A groove from a to b ([x, z]); `drawn` stops one stroke digging the same cell twice. */
  #segment(a, b, drawn = new Uint8Array(this.h.length)) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(len / 0.03));
    for (let s = 0; s <= steps; s++) {
      const x = a[0] + ((b[0] - a[0]) * s) / steps;
      const z = a[1] + ((b[1] - a[1]) * s) / steps;
      this.#each(x, z, 0.05, (k, d) => {
        if (drawn[k]) return;
        drawn[k] = 1;
        this.h[k] -= 0.03 * (1 - (d / 0.05) * 0.5);
        this.#clamp(k);
      });
    }
    this.settle = 0;
  }

  /** Rake: smooth an area back to a flat-ish patch. */
  #rake(point) {
    this.#share({ o: 'rake', x: r2(point.x), z: r2(point.z) });
    let sum = 0;
    let c = 0;
    this.#each(point.x, point.z, 0.6, (k) => {
      sum += this.h[k];
      c++;
    });
    const avg = c ? sum / c : 0;
    this.#each(point.x, point.z, 0.6, (k, d) => {
      this.h[k] = THREE.MathUtils.lerp(this.h[k], avg, 0.75 * (1 - d / 0.6) + 0.2);
      this.packed[k] = 0;
    });
    this.#sound('sand', { volume: 0.4, rate: 0.6 });
  }

  #buildSpray(scene) {
    const COUNT = 60;
    this.spray = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.025, 0.025), scene.mat({ color: 0xd8c090 }), COUNT);
    this.spray.frustumCulled = false;
    this.grains = Array.from({ length: COUNT }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 }));
    this.spray.count = COUNT;
    scene.root.add(this.spray);
    this._m = new THREE.Matrix4();
  }

  #spray(from, tx, tz) {
    let n = 14;
    for (const gr of this.grains) {
      if (gr.life > 0 || n <= 0) continue;
      n--;
      gr.life = 0.6 + Math.random() * 0.3;
      gr.p.set(from.x, this.baseY + 0.02, from.z);
      const dx = tx - from.x;
      const dz = tz - from.z;
      gr.v.set(dx * 1.6 + (Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 1.2, dz * 1.6 + (Math.random() - 0.5) * 0.8);
    }
  }

  #updateSpray(dt) {
    for (let i = 0; i < this.grains.length; i++) {
      const gr = this.grains[i];
      if (gr.life > 0) {
        gr.life -= dt;
        gr.v.y -= 9.8 * dt;
        gr.p.addScaledVector(gr.v, dt);
        this._m.makeTranslation(gr.p.x, gr.p.y, gr.p.z);
      } else this._m.makeTranslation(0, -999, 0);
      this.spray.setMatrixAt(i, this._m);
    }
    this.spray.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    const g = this.game;
    if (g.scene !== this.scene) return;

    // Hands in the sand: hold E to keep digging, hold LMB to draw, R to rake.
    const f = g.interaction.focus;
    const aiming = f?.target === this.mesh && f.point;
    const handsFree = !g.hunting.equipped && !g.viewModel.smoking && !g.uiOpen;
    if (aiming && handsFree && g.input.down('KeyE')) {
      this.digT -= dt;
      if (this.digT <= 0) {
        this.digT = 0.2;
        this.#dig(f.point);
      }
    } else this.digT = 0.2;
    if (aiming && handsFree && g.input.locked && g.input.mouseDown(0)) {
      if (!this.lastDraw) this.drawn.fill(0);
      this.#draw(f.point);
    } else {
      this.lastDraw = null;
      this.lastSent = null;
    }
    if (aiming && handsFree && g.input.pressed('KeyR')) {
      g.input.consume('KeyR');
      this.#rake(f.point);
    }
    this.#updateSpray(dt);
    if (this.settle > 0) {
      this.settle -= dt;
      if (this.#slump() < 1e-4) this.settle = Math.min(this.settle, 0.3);
    }

    // Footprints while walking through.
    const pl = g.player;
    if (pl.enabled && !pl.seated && !g.vehicle.active) {
      const f = pl.feet;
      const inside = Math.abs(f.x - this.cx) < SIZE / 2 - 0.05 && Math.abs(f.z - this.cz) < SIZE / 2 - 0.05 && f.y < this.baseY + 0.5;
      if (inside && pl.onGround) {
        if (!this.lastStep) this.lastStep = f.clone();
        if (this.lastStep.distanceTo(f) > 0.5) {
          const run = Math.hypot(pl.velocity.x, pl.velocity.z) > 4;
          const heading = Math.atan2(-(f.x - this.lastStep.x), -(f.z - this.lastStep.z));
          this.foot = -this.foot;
          this.#footprint(f.x, f.z, this.foot, heading, run ? 1.4 : 1);
          this.lastStep.copy(f);
          g.audio.oneShot('sand', { volume: 0.18, rate: 1.3 + Math.random() * 0.3 });
        }
      } else this.lastStep = null;
    }

    // Rain: wet sand + slow melting.
    const rain = g.weather?.rain ?? 0;
    this.wet = THREE.MathUtils.clamp(this.wet + (rain > 0.2 ? dt * 0.02 * rain : -dt * 0.004), 0, 1);
    this.relaxTimer -= dt;
    if (rain > 0.3 && this.relaxTimer <= 0) {
      this.relaxTimer = 0.4;
      this.#relax(0.04 * rain);
      // Rain softens patted sand too, so castles slowly give way.
      for (let k = 0; k < this.packed.length; k++) this.packed[k] *= 1 - 0.03 * rain;
      this.settle = 1;
    }
    this.#rebuild();
  }

  #rebuild() {
    if (!this.dirty && Math.abs(this.wet - (this._shownWet ?? -1)) < 0.02) return;
    this.dirty = false;
    this._shownWet = this.wet;
    const pos = this.geo.attributes.position;
    const col = this.geo.attributes.color;
    const dry = 1 - this.wet * 0.4;
    for (let k = 0; k < pos.count; k++) {
      const h = this.h[k];
      pos.setY(k, h);
      // Deeper = damper = darker; edges of the box a touch darker too.
      const c = dry * (h < 0 ? 1 + h * 1.1 : 1 + Math.min(h, 0.4) * 0.15);
      col.setXYZ(k, c, c * 0.98, c * 0.94);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.geo.computeBoundingBox();
  }
}

function r2(v) {
  return Math.round(v * 100) / 100;
}
