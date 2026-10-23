import * as THREE from 'three';

/**
 * Animator
 * --------
 * Keyframe-ish motion for the roulette table: move/turn/scale objects in
 * their parent's space, tween hand curls, all awaitable, all sped up together
 * when a client has fallen behind (`speed`).
 *
 *   await anim.to(hand.root, { p: [0, 1, 0.4], r: [0, 0.3, 0] }, 0.4)
 *   anim.curl(hand, 'grip', 0.2)
 *   await anim.wait(0.5)
 *   await anim.reparent(gun, seat, { p, r }, 0.4)   // keeps world pose, then moves
 *
 * r is an Euler [x, y, z] ('YXZ'), q a Quaternion; s a scale (number or array).
 */
const EASE = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  outBack: (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2,
  snap: (t) => 1 - (1 - t) ** 5,
};

export class Animator {
  constructor() {
    this.tracks = [];
    this.speed = 1;
    this.time = 0;
  }

  /** Move an object to a pose (in its parent's space). */
  to(obj, { p, r, q, s }, dur, ease = 'inOut') {
    const tr = { obj, t: 0, dur: Math.max(dur, 1e-4), ease: EASE[ease] ?? EASE.inOut };
    if (p) tr.p = [obj.position.clone(), Array.isArray(p) ? new THREE.Vector3(...p) : p.clone()];
    if (r || q) tr.q = [obj.quaternion.clone(), q ? q.clone() : new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ'))];
    if (s !== undefined) tr.s = [obj.scale.clone(), typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s)];
    this.#cancel(obj, tr);
    return this.#push(tr);
  }

  /** Tween a hand's finger curls to a pose name or object. */
  curl(hand, pose, dur, poses) {
    const target = typeof pose === 'string' ? poses[pose] : pose;
    const tr = { hand, t: 0, dur: Math.max(dur, 1e-4), ease: EASE.inOut, c: [{ ...hand.curl }, { ...hand.curl, ...target }] };
    this.tracks = this.tracks.filter((o) => {
      if (o.hand !== hand) return true;
      o.resolve();
      return false;
    });
    return this.#push(tr);
  }

  /** Any numeric property tween (light intensity, a uniform…). */
  num(target, key, to, dur, ease = 'inOut') {
    const tr = { target, key, t: 0, dur: Math.max(dur, 1e-4), ease: EASE[ease] ?? EASE.inOut, n: [target[key], to] };
    return this.#push(tr);
  }

  /** Call fn(k) every frame for dur seconds (k 0→1). */
  run(dur, fn) {
    return this.#push({ t: 0, dur: Math.max(dur, 1e-4), ease: EASE.linear, fn });
  }

  wait(dur) {
    return this.#push({ t: 0, dur: Math.max(dur, 1e-4), ease: EASE.linear });
  }

  /** Re-parent keeping the world pose, then move to a pose in the new parent. */
  reparent(obj, parent, pose, dur, ease) {
    parent.attach(obj);
    return pose ? this.to(obj, pose, dur, ease) : Promise.resolve();
  }

  #cancel(obj, tr) {
    for (let i = this.tracks.length - 1; i >= 0; i--) {
      const o = this.tracks[i];
      if (o.obj !== obj) continue;
      if (tr.p) delete o.p;
      if (tr.q) delete o.q;
      if (tr.s) delete o.s;
      if (!o.p && !o.q && !o.s) {
        this.tracks.splice(i, 1);
        o.resolve();
      }
    }
  }

  #push(tr) {
    return new Promise((resolve) => {
      tr.resolve = resolve;
      this.tracks.push(tr);
    });
  }

  /** Finish everything instantly (late joiners, leaving the table). */
  flush() {
    for (const tr of this.tracks) {
      tr.t = tr.dur;
      this.#step(tr, 1);
      tr.resolve();
    }
    this.tracks = [];
  }

  update(dt) {
    dt *= this.speed;
    this.time += dt;
    for (let i = this.tracks.length - 1; i >= 0; i--) {
      const tr = this.tracks[i];
      tr.t += dt;
      const k = Math.min(1, tr.t / tr.dur);
      this.#step(tr, tr.ease(k), k);
      if (k >= 1) {
        this.tracks.splice(i, 1);
        tr.resolve();
      }
    }
  }

  #step(tr, e, k = 1) {
    if (tr.p) tr.obj.position.lerpVectors(tr.p[0], tr.p[1], e);
    if (tr.q) tr.obj.quaternion.slerpQuaternions(tr.q[0], tr.q[1], e);
    if (tr.s) tr.obj.scale.lerpVectors(tr.s[0], tr.s[1], e);
    if (tr.c) {
      for (const f of Object.keys(tr.c[1])) tr.hand.curl[f] = tr.c[0][f] + (tr.c[1][f] - tr.c[0][f]) * e;
      tr.hand.apply();
    }
    if (tr.n) tr.target[tr.key] = tr.n[0] + (tr.n[1] - tr.n[0]) * e;
    tr.fn?.(k);
  }
}
