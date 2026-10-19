import * as THREE from 'three';

/**
 * Birds
 * -----
 * Life in the sky over the World map:
 *
 *  - seagulls wheeling over the harbor and around the lighthouse (all night
 *    too — they ride the lamp's beam), with the odd cry
 *  - crows: a loose flock that drifts over the fields and forest, cawing
 *  - swallows darting low over the airfield and drive-in in the daytime
 *  - pigeons (animated models) pecking around the diner lot, the park and
 *    the station crossing; walk up (or run) and they burst into the air,
 *    then drift back down a minute later
 *
 * Flying birds are instanced (body + two flapping wings = 3 draw calls for
 * all of them) and their paths are a function of the shared clock, so
 * everyone in a room sees the same birds in the same places.
 */
const FLOCKS = [
  // kind, count, centre [x, z], radius, height, speed, colour, wing span, day-only
  { kind: 'gull', n: 10, c: [330, 52], r: 34, h: 18, s: 0.16, col: 0xf0f0ea, span: 0.9, day: false },
  { kind: 'gull', n: 8, c: [408, -62], r: 22, h: 34, s: 0.2, col: 0xf0f0ea, span: 0.9, day: false },
  { kind: 'gull', n: 6, c: [300, 160], r: 50, h: 14, s: 0.1, col: 0xe8e8e2, span: 0.85, day: true },
  { kind: 'crow', n: 16, c: [-120, 60], r: 140, h: 26, s: 0.035, col: 0x1a1a20, span: 0.7, day: false, roam: true },
  { kind: 'crow', n: 10, c: [-260, -60], r: 90, h: 40, s: 0.05, col: 0x1a1a20, span: 0.7, day: true, roam: true },
  { kind: 'swallow', n: 12, c: [205, 238], r: 45, h: 5, s: 0.45, col: 0x2a3050, span: 0.45, day: true },
  { kind: 'swallow', n: 8, c: [110, 180], r: 35, h: 6, s: 0.5, col: 0x2a3050, span: 0.45, day: true },
];
const PIGEON_SPOTS = [
  [196, 84, 6],
  [-134, 244, 5],
  [-225, 216, 5],
  [-180, 190, 4],
  [330, 66, 4],
];

export class Birds {
  constructor(game) {
    this.game = game;
    this.birds = [];
    for (const f of FLOCKS) for (let i = 0; i < f.n; i++) this.birds.push({ f, i, ph: hash(i * 13.1 + f.c[0]) * Math.PI * 2, rr: 0.4 + hash(i * 7.7 + f.c[1]) * 0.8, hh: hash(i * 3.3) * 8 - 4, flap: hash(i * 5.1) * 10 });
    this.callT = 4;
  }

  setupWorld(world) {
    this.world = world;
    const mat = (c) => world.mat({ color: c, doubleSide: true });
    const body = new THREE.ConeGeometry(0.09, 0.42, 5);
    body.rotateX(Math.PI / 2);
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0.5, 0, 0.02, 0, 0, -0.12, 0.5, 0, 0.02, 0.9, 0, -0.06, 0, 0, -0.12], 3));
    wing.computeVertexNormals();
    // one instanced set per colour (the PS1 shader has no per-instance colour)
    this.sets = new Map();
    for (const b of this.birds) {
      let set = this.sets.get(b.f.col);
      if (!set) {
        const m = mat(b.f.col);
        set = { n: 0, meshes: [] };
        const count = this.birds.filter((x) => x.f.col === b.f.col).length;
        for (const geo of [body, wing, wing]) {
          const im = new THREE.InstancedMesh(geo, m, count);
          im.frustumCulled = false;
          im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          world.root.add(im);
          set.meshes.push(im);
        }
        this.sets.set(b.f.col, set);
      }
      b.set = set;
      b.k = set.n++;
    }
    // pigeons
    this.pigeons = [];
    for (const [x, z, n] of PIGEON_SPOTS) {
      for (let k = 0; k < n; k++) {
        const o = world.game.assets.model('pigeon');
        if (!o) break;
        const px = x + (Math.random() - 0.5) * 5;
        const pz = z + (Math.random() - 0.5) * 5;
        o.position.set(px, world.groundHeight(px, pz), pz);
        o.rotation.y = Math.random() * 6;
        world.root.add(o);
        const mixer = new THREE.AnimationMixer(o);
        const clips = o.userData.animations ?? [];
        const find = (n2) => clips.find((cl) => cl.name === n2 || cl.name.endsWith('|' + n2));
        const p = { o, mixer, home: o.position.clone(), state: 'ground', t: Math.random() * 3, find, vel: new THREE.Vector3() };
        this.#pAnim(p, 'Idle');
        this.pigeons.push(p);
      }
    }
  }

  #pAnim(p, name) {
    if (p.cur === name) return;
    const c = p.find(name) ?? p.find('Idle');
    if (!c) return;
    p.action?.fadeOut(0.2);
    p.action = p.mixer.clipAction(c).reset().fadeIn(0.2).play();
    p.cur = name;
  }

  update(dt) {
    const g = this.game;
    if (!this.world || g.scene !== this.world) return;
    const T = g.dayNight.minutes * 2.5 + g.dayNight.day * 3600; // shared clock (seconds-ish)
    const day = g.dayNight.isDaylight;
    const m = _m;
    const cam = g.camera.position;
    let nearest = { d: 1e9, b: null };
    this.birds.forEach((b) => {
      const f = b.f;
      const [mb, mwl, mwr] = b.set.meshes;
      const i = b.k;
      const visible = !f.day || day;
      if (!visible) {
        m.makeScale(0, 0, 0);
        mb.setMatrixAt(i, m);
        mwl.setMatrixAt(i, m);
        mwr.setMatrixAt(i, m);
        return;
      }
      // flock centre drifts (roamers), each bird orbits it on its own ring
      let cx = f.c[0];
      let cz = f.c[1];
      if (f.roam) {
        cx += Math.sin(T * 0.004 + f.c[1]) * f.r * 0.8;
        cz += Math.cos(T * 0.003 + f.c[0]) * f.r * 0.8;
      }
      const a = T * f.s * (f.roam ? 6 : 1) + b.ph;
      const r = (f.roam ? 10 : f.r) * b.rr;
      const x = cx + Math.cos(a) * r + (f.roam ? Math.sin(a * 0.7 + b.i) * 4 : 0);
      const z = cz + Math.sin(a) * r;
      const gh = this.world.groundHeight(x, z);
      const y = Math.max(gh + 3, (f.kind === 'gull' && f.c[0] > 400 ? 0 : gh) + f.h + b.hh + Math.sin(a * 2.3 + b.i) * 1.5);
      // heading = tangent of the orbit
      const yaw = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI;
      const bank = (f.kind === 'swallow' ? 0.6 : 0.3) * Math.sign(f.s);
      const sc = f.kind === 'gull' ? 1.3 : f.kind === 'crow' ? 1.1 : 0.7;
      _p.set(x, y, z);
      _q.setFromEuler(_e.set(0, yaw, bank));
      _s.setScalar(sc);
      m.compose(_p, _q, _s);
      mb.setMatrixAt(i, m);
      // flap: gulls glide a lot, swallows flutter
      b.flap += dt * (f.kind === 'swallow' ? 14 : f.kind === 'crow' ? 7 : 5);
      const glide = f.kind === 'gull' ? Math.max(0, Math.sin(b.flap * 0.15)) : 0.2;
      const fl = Math.sin(b.flap) * 0.7 * (1 - glide) + 0.1;
      for (const [mesh, side] of [[mwl, 1], [mwr, -1]]) {
        _q2.setFromEuler(_e.set(0, side < 0 ? Math.PI : 0, side * fl));
        _q3.copy(_q).multiply(_q2);
        _s2.set(sc * f.span * 1.6, sc, sc);
        m.compose(_p, _q3, _s2);
        mesh.setMatrixAt(i, m);
      }
      const d = cam.distanceTo(_p);
      if (d < nearest.d) nearest = { d, b };
    });
    for (const set of this.sets.values()) for (const mm of set.meshes) mm.instanceMatrix.needsUpdate = true;

    // calls
    this.callT -= dt;
    if (this.callT <= 0 && nearest.b && nearest.d < 60) {
      this.callT = 5 + Math.random() * 10;
      this.#call(nearest.b.f.kind, nearest.d);
    }
    this.#pigeons(dt);
  }

  #pigeons(dt) {
    const g = this.game;
    const players = [g.player.feet];
    for (const r of g.mp?.remotes?.values() ?? []) if (r.inMyScene && r.state) players.push(_v2.set(...r.state.p).clone());
    const running = Math.hypot(g.player.velocity.x, g.player.velocity.z) > 4.5 || g.vehicle.active;
    for (const p of this.pigeons) {
      p.mixer.update(dt);
      p.t -= dt;
      if (p.state === 'ground') {
        const close = players.some((f) => Math.hypot(f.x - p.o.position.x, f.z - p.o.position.z) < (running ? 9 : 3.2));
        if (close) {
          p.state = 'fly';
          p.t = 50 + Math.random() * 40;
          const a = Math.random() * Math.PI * 2;
          p.vel.set(Math.cos(a) * 6, 7 + Math.random() * 3, Math.sin(a) * 6);
          p.o.rotation.y = Math.atan2(p.vel.x, p.vel.z);
          this.#pAnim(p, 'Jump');
          if (Math.random() < 0.4) this.#flutter();
          continue;
        }
        if (p.t <= 0) {
          p.t = 2 + Math.random() * 4;
          p.walk = Math.random() < 0.5;
          p.o.rotation.y += (Math.random() - 0.5) * 2;
        }
        if (p.walk) {
          const nx = p.o.position.x + Math.sin(p.o.rotation.y) * dt * 0.35;
          const nz = p.o.position.z + Math.cos(p.o.rotation.y) * dt * 0.35;
          if (Math.hypot(nx - p.home.x, nz - p.home.z) < 4) {
            p.o.position.x = nx;
            p.o.position.z = nz;
            p.o.position.y = this.world.groundHeight(nx, nz);
          }
          this.#pAnim(p, 'Walk');
        } else this.#pAnim(p, Math.sin(p.t * 3) > 0 ? 'Idle' : 'Yes'); // peck peck
      } else if (p.state === 'fly') {
        p.o.position.addScaledVector(p.vel, dt);
        p.o.rotation.z = Math.sin(g.time * 30) * 0.15;
        if (p.o.position.y > p.home.y + 30) p.o.visible = false;
        if (p.t <= 0) {
          p.state = 'land';
          p.o.visible = true;
          p.o.position.set(p.home.x + (Math.random() - 0.5) * 4, p.home.y + 20, p.home.z + (Math.random() - 0.5) * 4);
        }
      } else if (p.state === 'land') {
        p.o.position.y -= dt * 5;
        const gy = this.world.groundHeight(p.o.position.x, p.o.position.z);
        if (p.o.position.y <= gy) {
          p.o.position.y = gy;
          p.o.rotation.z = 0;
          p.state = 'ground';
          p.t = 2;
        }
      }
    }
  }

  // ---- sound ------------------------------------------------------------------------

  #call(kind, dist) {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = Math.min(0.5, 6 / (4 + dist));
    out.connect(this.game.audio.master);
    const n = kind === 'crow' ? 2 + Math.floor(Math.random() * 2) : kind === 'gull' ? 3 : 4;
    for (let k = 0; k < n; k++) {
      const t0 = t + k * (kind === 'crow' ? 0.4 : kind === 'gull' ? 0.25 : 0.09);
      const o = ctx.createOscillator();
      o.type = kind === 'crow' ? 'sawtooth' : 'triangle';
      const f0 = kind === 'crow' ? 520 : kind === 'gull' ? 1400 : 4200;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(kind === 'gull' ? f0 * 1.4 : f0 * 0.7, t0 + (kind === 'gull' ? 0.18 : 0.12));
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = kind === 'crow' ? 900 : f0;
      f.Q.value = kind === 'crow' ? 3 : 1;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t0);
      e.gain.linearRampToValueAtTime(kind === 'swallow' ? 0.15 : 0.5, t0 + 0.02);
      e.gain.exponentialRampToValueAtTime(0.001, t0 + (kind === 'crow' ? 0.3 : 0.2));
      o.connect(f).connect(e).connect(out);
      o.start(t0);
      o.stop(t0 + 0.35);
    }
  }

  #flutter() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const n = this.game.audio.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 600;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    for (let k = 0; k < 10; k++) {
      e.gain.linearRampToValueAtTime(0.25, t + k * 0.05 + 0.01);
      e.gain.linearRampToValueAtTime(0.02, t + k * 0.05 + 0.04);
    }
    e.gain.linearRampToValueAtTime(0, t + 0.6);
    n.connect(f).connect(e).connect(this.game.audio.master);
    n.start(t);
    n.stop(t + 0.65);
  }
}

function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _s2 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
