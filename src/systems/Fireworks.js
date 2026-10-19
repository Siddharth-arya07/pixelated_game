import * as THREE from 'three';

/**
 * Fireworks
 * ---------
 * Consumer fireworks you buy at the Quik Mart (or find in the box in your
 * living room). Use one outside: it's set down a couple of metres ahead,
 * the fuse sputters, step back, and up it goes.
 *
 * One additive THREE.Points pool (no fog, so bursts read from far away) runs
 * every star, trail spark and fountain sparkle. Shell types differ in how
 * stars are laid out (sphere, ring, heart, palm fronds), how they behave
 * (willow drag, crossette splits, strobe blink, crackle, colour change) and
 * how they're delivered (single shell, roman candle, cake, fountain).
 * Every burst also briefly lights the world, and is heard late by distance.
 * Friends in the room see (and hear) your shows: net event 'fw'.
 */
const MAX = 14000;
const G = 9.8;

const PAL = {
  red: [1, 0.18, 0.12],
  green: [0.25, 1, 0.35],
  blue: [0.3, 0.45, 1],
  purple: [0.75, 0.3, 1],
  gold: [1, 0.72, 0.28],
  silver: [0.95, 0.95, 1],
  pink: [1, 0.4, 0.75],
  cyan: [0.3, 0.95, 1],
  orange: [1, 0.5, 0.1],
  white: [1, 1, 0.95],
};
const PAL_KEYS = Object.keys(PAL);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** What each item does. kind: shell | roman | cake | fountain | sparkler */
export const FIREWORKS = {
  fw_rocket: { kind: 'shell', shells: ['peony'], label: 'Sky Rocket' },
  fw_chrys: { kind: 'shell', shells: ['chrys'], label: 'Chrysanthemum' },
  fw_willow: { kind: 'shell', shells: ['willow'], label: 'Crackling Willow' },
  fw_palm: { kind: 'shell', shells: ['palm'], label: 'Golden Palm' },
  fw_ring: { kind: 'shell', shells: ['ring'], label: 'Saturn Ring' },
  fw_heart: { kind: 'shell', shells: ['heart'], label: 'Heart' },
  fw_crossette: { kind: 'shell', shells: ['crossette'], label: 'Crossette' },
  fw_strobe: { kind: 'shell', shells: ['strobe'], label: 'Glitter Strobe' },
  fw_roman: { kind: 'roman', label: 'Roman Candle' },
  fw_fountain: { kind: 'fountain', label: 'Fountain' },
  fw_cake: { kind: 'cake', label: '25-Shot Cake' },
  fw_sparkler: { kind: 'sparkler', label: 'Sparkler' },
};

export class Fireworks {
  constructor(game) {
    this.game = game;
    this.ctx = game.audio.ctx;
    this.lights = []; // burst flashes, picked up by the renderer
    this.jobs = []; // timed actions: { t, fn }
    this.emitters = []; // fountains, sparklers, rising shells
    this.n = 0;
    this.#pool();
    game.mp?.on('fw', (e) => this.#remote(e));
  }

  // ---------------------------------------------------------------------------
  // Particle pool
  // ---------------------------------------------------------------------------

  #pool() {
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.col2 = new Float32Array(MAX * 3); // colour it fades toward
    this.alpha = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.max = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.flags = new Uint8Array(MAX); // 1 trail · 2 strobe · 4 crackle · 8 split · 16 flicker
    this.trailT = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aAttr = new THREE.BufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage);
    this.sAttr = new THREE.BufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    geo.setAttribute('alpha', this.aAttr);
    geo.setAttribute('size', this.sAttr);
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { uScale: { value: 300 } },
      vertexShader: `
        attribute float alpha; attribute float size;
        varying vec3 vC; varying float vA;
        uniform float uScale;
        void main() {
          vC = color; vA = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 48.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vA;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float core = smoothstep(0.5, 0.0, r);
          float hot = smoothstep(0.18, 0.0, r);
          gl_FragColor = vec4(vC * core + hot * 0.6, (core * 0.9) * vA);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  /** Spawn one particle. Returns its index (or -1 when the pool is full). */
  spawn(p, v, c, { life = 2, size = 0.5, drag = 1.2, grav = 1, flags = 0, c2 = null } = {}) {
    if (this.n >= MAX) return -1;
    const i = this.n++;
    const i3 = i * 3;
    this.pos[i3] = p.x;
    this.pos[i3 + 1] = p.y;
    this.pos[i3 + 2] = p.z;
    this.vel[i3] = v.x;
    this.vel[i3 + 1] = v.y;
    this.vel[i3 + 2] = v.z;
    const cc = c2 ?? c;
    for (let k = 0; k < 3; k++) {
      this.col[i3 + k] = c[k];
      this.col2[i3 + k] = cc[k];
    }
    this.life[i] = this.max[i] = life * (0.85 + Math.random() * 0.3);
    this.size[i] = size;
    this.drag[i] = drag;
    this.grav[i] = grav;
    this.flags[i] = flags;
    this.trailT[i] = 0;
    return i;
  }

  #kill(i) {
    const j = --this.n;
    if (i === j) return;
    const i3 = i * 3;
    const j3 = j * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[i3 + k] = this.pos[j3 + k];
      this.vel[i3 + k] = this.vel[j3 + k];
      this.col[i3 + k] = this.col[j3 + k];
      this.col2[i3 + k] = this.col2[j3 + k];
    }
    this.life[i] = this.life[j];
    this.max[i] = this.max[j];
    this.size[i] = this.size[j];
    this.drag[i] = this.drag[j];
    this.grav[i] = this.grav[j];
    this.flags[i] = this.flags[j];
    this.trailT[i] = this.trailT[j];
  }

  // ---------------------------------------------------------------------------
  // Using an item
  // ---------------------------------------------------------------------------

  /** Called by InventorySystem.use for fw_* items. Returns true if it was set off. */
  use(id) {
    const g = this.game;
    const def = FIREWORKS[id];
    if (!g.scene?.outdoor) {
      g.hud.toast('Not indoors. Take it outside.');
      return false;
    }
    if (g.vehicle.driving) {
      g.hud.toast('Pull over first.');
      return false;
    }
    if (!g.inventory.has('lighter')) {
      g.hud.toast('You need a lighter. The Quik Mart sells them.');
      return false;
    }
    const cam = g.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    if (def.kind === 'sparkler') {
      this.#sparkler();
      g.hud.toast('Sparkler lit. Wave it around. ~45 s.', 3500);
    } else {
      const x = cam.position.x + fwd.x * 2.4;
      const z = cam.position.z + fwd.z * 2.4;
      const y = g.scene.groundHeight?.(x, z) ?? cam.position.y - 1.6;
      const seed = Math.floor(Math.random() * 1e9);
      this.light(id, { x, y, z }, seed, Math.atan2(fwd.x, fwd.z));
      g.net?.online && g.net.event('fw', { id, p: [x, y, z], seed, yaw: Math.atan2(fwd.x, fwd.z), scene: g.scene.name });
      g.hud.toast(def.kind === 'fountain' ? 'Fuse is lit — step back.' : 'Fuse is lit — step back and look up!', 3000);
    }
    g.inventory.remove(id);
    g.audio.oneShot('click', { volume: 0.5 });
    return true;
  }

  /** Aircraft flares: hot white-orange stars kicked out sideways, falling slowly with smoke trails. */
  flares(p, vel, heading) {
    this.#attach();
    const side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    for (let k = 0; k < 6; k++) {
      const s = k % 2 ? 1 : -1;
      const v = vel.clone().addScaledVector(side, s * (6 + k)).add(new THREE.Vector3(0, -2 - k * 0.5, 0));
      this.spawn(p, v, k < 2 ? PAL.white : PAL.orange, { life: 3.2, size: 1.1, drag: 0.6, grav: 0.35, flags: 1 | 16, c2: PAL.red });
    }
    this.#flash(p, 0xffc070, 0.4);
    this.#thump(p, 0.6);
    this.#loopNoise(p, 1.2, 3000, 0.12);
  }

  #remote(e) {
    if (this.game.scene?.name !== e.scene) return;
    this.light(e.id, { x: e.p[0], y: e.p[1], z: e.p[2] }, e.seed, e.yaw);
  }

  /** Set the device down at `at` and light the fuse. */
  light(id, at, seed, yaw = 0) {
    const def = FIREWORKS[id];
    this.#attach();
    const base = new THREE.Vector3(at.x, at.y, at.z);
    const tube = this.#prop(def.kind, base, yaw);
    // fuse: a little sputter of sparks + hiss for ~2.5 s
    const fuse = base.clone().add(new THREE.Vector3(0, def.kind === 'cake' ? 0.25 : 0.35, 0));
    this.emitters.push({ t: 2.4, rate: 60, fn: () => this.spawn(fuse, rv(1.4, 1.5), PAL.gold, { life: 0.35, size: 0.06, drag: 2, grav: 0.6 }) });
    this.#hiss(base, 2.4);
    const go = () => {
      if (def.kind === 'shell') this.#launch(base, def.shells[0], 0);
      else if (def.kind === 'roman') this.#roman(base);
      else if (def.kind === 'cake') this.#cake(base);
      else if (def.kind === 'fountain') this.#fountain(base);
    };
    this.after(2.5, go);
    this.after(def.kind === 'cake' ? 26 : def.kind === 'fountain' ? 26 : def.kind === 'roman' ? 14 : 8, () => tube.removeFromParent());
    void seed;
  }

  after(t, fn) {
    this.jobs.push({ t, fn });
  }

  /** A small cardboard tube / cake box sitting on the ground. */
  #prop(kind, base, yaw) {
    const scene = this.game.scene;
    const m = (c) => scene.mat({ color: c });
    let obj;
    if (kind === 'cake') {
      obj = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.4), m(0xb02020));
      obj.position.set(base.x, base.y + 0.125, base.z);
    } else if (kind === 'fountain') {
      obj = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 8), m(0x2050b0));
      obj.position.set(base.x, base.y + 0.11, base.z);
    } else {
      obj = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), m(kind === 'roman' ? 0x20a050 : 0xd0a020));
      obj.position.set(base.x, base.y + 0.175, base.z);
    }
    obj.rotation.y = yaw;
    scene.root.add(obj);
    return obj;
  }

  #attach() {
    const root = this.game.scene?.root;
    if (root && this.points.parent !== root) root.add(this.points);
  }

  // ---------------------------------------------------------------------------
  // Delivery
  // ---------------------------------------------------------------------------

  /** Send a shell up; it trails sparks and bursts near the top of its climb. */
  #launch(base, type, spread = 0, power = 1) {
    const p = base.clone().add(new THREE.Vector3(0, 0.4, 0));
    const v = new THREE.Vector3((Math.random() - 0.5) * 3 + spread, (34 + Math.random() * 8) * power, (Math.random() - 0.5) * 3);
    const fuse = (1.5 + Math.random() * 0.4) * Math.sqrt(power);
    this.#whoosh(base, type === 'willow' || type === 'palm');
    let t = 0;
    const tail = type === 'palm' || type === 'willow' ? PAL.gold : PAL.orange;
    this.emitters.push({
      t: fuse,
      rate: 70,
      step: (dt) => {
        t += dt;
        v.y -= G * dt;
        p.addScaledVector(v, dt);
      },
      fn: () => this.spawn(p, rv(1.2, -2), tail, { life: 0.7, size: 0.12, drag: 2.5, grav: 0.4, flags: 16 }),
      done: () => this.burst(p.clone(), type),
    });
  }

  #roman(base) {
    // 8 balls, one every ~1.1 s, each a coloured star that pops at the top
    for (let k = 0; k < 8; k++) {
      this.after(k * 1.1, () => {
        const c = PAL[pick(['red', 'green', 'blue', 'purple', 'gold', 'pink'])];
        const v = new THREE.Vector3((Math.random() - 0.5) * 2, 26 + Math.random() * 5, (Math.random() - 0.5) * 2);
        const i = this.spawn(base.clone().add(new THREE.Vector3(0, 0.35, 0)), v, c, { life: 2.6, size: 1.0, drag: 0.15, grav: 1, flags: 1 });
        this.#thump(base, 0.5);
        if (k % 3 === 2 && i >= 0) this.after(2.2, () => this.#crackleAt(this.#posOf(i), 40));
      });
    }
  }

  #cake(base) {
    // 25 shots: fans of comets, then mixed shells, then a fast finale
    const types = ['peony', 'chrys', 'strobe', 'ring', 'willow', 'palm', 'crossette', 'heart'];
    let t = 0;
    for (let k = 0; k < 25; k++) {
      const finale = k >= 18;
      const fan = ((k % 5) - 2) * 2.2;
      this.after(t, () => {
        if (k < 6) this.#comet(base, fan);
        else this.#launch(base, finale ? pick(['peony', 'chrys', 'crossette', 'willow']) : types[k % types.length], fan * 0.6, finale ? 0.85 : 0.75);
      });
      t += finale ? 0.28 : k < 6 ? 0.45 : 0.9;
    }
  }

  /** A single bright comet star that streaks up and fades (cake openers). */
  #comet(base, fan) {
    const c = PAL[pick(['gold', 'silver', 'cyan', 'red'])];
    const v = new THREE.Vector3(fan, 30, (Math.random() - 0.5) * 2);
    this.spawn(base.clone().add(new THREE.Vector3(0, 0.3, 0)), v, c, { life: 2.2, size: 0.9, drag: 0.1, grav: 1, flags: 1 });
    this.#thump(base, 0.6);
  }

  #fountain(base) {
    const top = base.clone().add(new THREE.Vector3(0, 0.25, 0));
    let t = 0;
    const sw = this.#loopNoise(base, 22, 3200, 0.22);
    void sw;
    this.emitters.push({
      t: 22,
      rate: 260,
      step: (dt) => (t += dt),
      fn: () => {
        const phase = Math.floor(t / 5) % 3;
        const c = phase === 0 ? PAL.gold : phase === 1 ? PAL.silver : Math.random() < 0.5 ? PAL.red : PAL.green;
        const h = 9 + Math.sin(t * 1.3) * 2;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.6;
        this.spawn(top, new THREE.Vector3(Math.cos(a) * r, h * (0.8 + Math.random() * 0.4), Math.sin(a) * r), c, {
          life: 1.4,
          size: 0.16,
          drag: 0.6,
          grav: 1,
          flags: Math.random() < 0.15 ? 16 | 4 : 16,
        });
      },
      light: { pos: top.clone().add(new THREE.Vector3(0, 1.5, 0)), color: 0xffb060, range: 14, intensity: 1.6 },
    });
  }

  /** Handheld: a fizzing point that follows your right hand. */
  #sparkler() {
    this.#attach();
    const g = this.game;
    const hand = new THREE.Vector3();
    const sw = this.#loopNoise(null, 45, 5200, 0.12);
    void sw;
    this.emitters.push({
      t: 45,
      rate: 220,
      step: () => {
        hand.set(0.28, -0.22, -0.7).applyQuaternion(g.camera.quaternion).add(g.camera.position);
      },
      fn: () => this.spawn(hand, rv(4, 0.5), Math.random() < 0.8 ? PAL.gold : PAL.white, { life: 0.35, size: 0.035, drag: 3, grav: 0.5, flags: 16 }),
      light: { pos: hand, color: 0xffc070, range: 6, intensity: 1.2 },
    });
  }

  // ---------------------------------------------------------------------------
  // Bursts
  // ---------------------------------------------------------------------------

  burst(p, type) {
    const c1 = PAL[pick(PAL_KEYS)];
    const c2 = PAL[pick(PAL_KEYS)];
    const S = (n, speed, c, opts, dirFn = sphere) => {
      for (let k = 0; k < n; k++) {
        const d = dirFn(k, n);
        this.spawn(p, d.multiplyScalar(speed * (0.92 + Math.random() * 0.16)), typeof c === 'function' ? c(k) : c, opts);
      }
    };
    let size = 1;
    switch (type) {
      case 'peony':
        S(220, 16, c1, { life: 2.2, size: 0.55, drag: 1.4, grav: 0.5, flags: 16 });
        break;
      case 'chrys': // trails + colour change
        S(200, 17, c1, { life: 2.6, size: 0.5, drag: 1.4, grav: 0.5, flags: 1, c2 });
        S(60, 8, PAL.white, { life: 1.6, size: 0.4, drag: 1.6, grav: 0.4, flags: 16 });
        break;
      case 'willow': // long drooping gold, crackle at the ends
        S(170, 13, PAL.gold, { life: 4.8, size: 0.4, drag: 2.6, grav: 0.35, flags: 1 | 4 });
        size = 1.3;
        break;
      case 'palm': // a few thick comet fronds that fall like a palm tree
        S(9, 14, PAL.gold, { life: 3.2, size: 1.1, drag: 0.9, grav: 0.7, flags: 1 }, (k, n) => {
          const a = (k / n) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8).normalize();
        });
        S(40, 5, PAL.orange, { life: 1.2, size: 0.4, drag: 2, grav: 0.4 });
        size = 1.2;
        break;
      case 'ring': {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 1.2 - 0.6, Math.random() * Math.PI, Math.random() * 0.8 - 0.4));
        S(110, 15, c1, { life: 2.2, size: 0.6, drag: 1.4, grav: 0.4 }, (k, n) => {
          const a = (k / n) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).applyQuaternion(q);
        });
        S(40, 4, c2, { life: 1.8, size: 0.5, drag: 1.3, grav: 0.4 });
        break;
      }
      case 'heart': {
        // facing whoever's looking: a heart in the camera's vertical plane
        const cam = this.game.camera;
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
        right.y = 0;
        right.normalize();
        const up = new THREE.Vector3(0, 1, 0);
        S(150, 1, PAL[pick(['pink', 'red'])], { life: 2.4, size: 0.6, drag: 1.3, grav: 0.25 }, (k, n) => {
          const t = (k / n) * Math.PI * 2;
          const x = 16 * Math.sin(t) ** 3;
          const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
          return right.clone().multiplyScalar(x * 0.9).addScaledVector(up, y * 0.9 + 2);
        });
        break;
      }
      case 'crossette': // a few stars that each split into four
        S(14, 14, c1, { life: 0.8, size: 0.8, drag: 0.8, grav: 0.5, flags: 1 | 8 });
        break;
      case 'strobe': // blinking white glitter
        S(260, 15, PAL.silver, { life: 3.0, size: 0.45, drag: 1.6, grav: 0.4, flags: 2 });
        break;
    }
    this.#flash(p, type === 'willow' || type === 'palm' ? 0xffb050 : new THREE.Color(...c1).getHex(), size);
    this.#boom(p, size);
    if (type === 'willow') this.after(2.8, () => this.#crackleAt(p, 160));
  }

  #posOf(i) {
    return new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
  }

  #flash(p, color, k = 1) {
    const L = { position: p.clone(), color: new THREE.Color(color), range: 160 * k, intensity: 2.2 * k, enabled: true, priority: 6, t: 0.6 };
    this.lights.push(L);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  update(dt) {
    for (let k = this.jobs.length - 1; k >= 0; k--) {
      const j = this.jobs[k];
      if ((j.t -= dt) <= 0) {
        this.jobs.splice(k, 1);
        j.fn();
      }
    }
    for (let k = this.emitters.length - 1; k >= 0; k--) {
      const e = this.emitters[k];
      e.step?.(dt);
      e.acc = (e.acc ?? 0) + e.rate * dt;
      while (e.acc >= 1) {
        e.acc--;
        e.fn();
      }
      if (e.light) {
        if (!e.L) this.lights.push((e.L = { position: e.light.pos, color: new THREE.Color(e.light.color), range: e.light.range, intensity: e.light.intensity, enabled: true, priority: 5, t: Infinity }));
        e.L.intensity = e.light.intensity * (0.75 + Math.random() * 0.5);
      }
      if ((e.t -= dt) <= 0) {
        this.emitters.splice(k, 1);
        if (e.L) e.L.t = 0;
        e.done?.();
      }
    }
    for (let k = this.lights.length - 1; k >= 0; k--) {
      const L = this.lights[k];
      if (L.t === Infinity) continue;
      L.t -= dt;
      L.intensity *= Math.exp(-dt * 5);
      if (L.t <= 0) this.lights.splice(k, 1);
    }

    const time = this.game.time;
    for (let i = this.n - 1; i >= 0; i--) {
      this.life[i] -= dt;
      const f = this.flags[i];
      if (this.life[i] <= 0) {
        if (f & 8) this.#split(i);
        else if (f & 4 && Math.random() < 0.5) this.#pop(i);
        this.#kill(i);
        continue;
      }
      const i3 = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= dr;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dr - G * this.grav[i] * dt;
      this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (f & 1 && (this.trailT[i] -= dt) <= 0 && this.n < MAX - 200) {
        this.trailT[i] = 0.03;
        const tc = [this.col[i3] * 0.9 + 0.1, this.col[i3 + 1] * 0.8 + 0.1, this.col[i3 + 2] * 0.6];
        this.spawn({ x: this.pos[i3], y: this.pos[i3 + 1], z: this.pos[i3 + 2] }, rv(0.4, 0), tc, { life: 0.9, size: this.size[i] * 0.45, drag: 3, grav: 0.15, flags: 16 });
      }
    }

    // upload
    const C = this.colAttr.array;
    const A = this.aAttr.array;
    const Z = this.sAttr.array;
    for (let i = 0; i < this.n; i++) {
      const k = this.life[i] / this.max[i]; // 1 → 0
      const i3 = i * 3;
      const m = 1 - k;
      C[i3] = this.col[i3] * k + this.col2[i3] * m;
      C[i3 + 1] = this.col[i3 + 1] * k + this.col2[i3 + 1] * m;
      C[i3 + 2] = this.col[i3 + 2] * k + this.col2[i3 + 2] * m;
      let a = Math.min(1, k * 2.2);
      const f = this.flags[i];
      if (f & 2) a *= Math.sin(time * 40 + i * 1.7) > 0.2 ? 1 : 0.05;
      if (f & 16) a *= 0.7 + Math.random() * 0.3;
      A[i] = a;
      Z[i] = this.size[i];
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, this.n);
    this.posAttr.needsUpdate = this.colAttr.needsUpdate = this.aAttr.needsUpdate = this.sAttr.needsUpdate = true;
    this.points.material.uniforms.uScale.value = window.innerHeight * 0.5;
    if (this.n === 0 && !this.emitters.length && !this.jobs.length) this.points.removeFromParent();
  }

  #split(i) {
    const p = this.#posOf(i);
    const c = [this.col[i * 3], this.col[i * 3 + 1], this.col[i * 3 + 2]];
    const v = new THREE.Vector3(this.vel[i * 3], this.vel[i * 3 + 1], this.vel[i * 3 + 2]);
    const side = new THREE.Vector3().crossVectors(v, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(side, v).normalize();
    for (const d of [side, side.clone().negate(), up, up.clone().negate()]) {
      this.spawn(p, d.clone().multiplyScalar(9).addScaledVector(v, 0.3), c, { life: 1.4, size: 0.5, drag: 1.3, grav: 0.5, flags: 1 });
    }
    if (Math.random() < 0.3) this.#crackleAt(p, 6, 0.4);
  }

  /** A crackle: a tiny white flash. (Sound is batched by #crackleAt.) */
  #pop(i) {
    const p = this.#posOf(i);
    this.spawn(p, rv(3, 0), PAL.white, { life: 0.12, size: 0.5, drag: 4, grav: 0 });
  }

  // ---------------------------------------------------------------------------
  // Sound (synthesised, heard late and quieter with distance)
  // ---------------------------------------------------------------------------

  #route(p, vol) {
    const ctx = this.ctx;
    const d = p ? this.game.camera.position.distanceTo(p) : 0;
    const g = ctx.createGain();
    g.gain.value = vol / (1 + d / 25);
    g.connect(this.game.audio.master);
    return { g, delay: d / 343, t: ctx.currentTime + d / 343 };
  }

  #boom(p, k = 1) {
    const ctx = this.ctx;
    const { g, t } = this.#route(p, 1.4 * k);
    const n = this.game.audio.noiseSource(false);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 1.2);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(1, t + 0.008);
    e.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    n.connect(lp).connect(e).connect(g);
    n.start(t);
    n.stop(t + 2);
    // body thud
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.9, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + 0.8);
  }

  #thump(p, k = 1) {
    const ctx = this.ctx;
    const { g, t } = this.#route(p, 0.7 * k);
    const n = this.game.audio.noiseSource(false);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 260;
    const e = ctx.createGain();
    e.gain.setValueAtTime(1, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    n.connect(bp).connect(e).connect(g);
    n.start(t);
    n.stop(t + 0.3);
  }

  #whoosh(p, quiet) {
    this.#thump(p, 0.8);
    const ctx = this.ctx;
    const { g, t } = this.#route(p, quiet ? 0.25 : 0.4);
    if (!quiet && Math.random() < 0.5) {
      // the classic whistle
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(2400, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 1.5);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.18, t + 0.1);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 1.7);
    }
    const n = this.game.audio.noiseSource(false);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.5, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    n.connect(hp).connect(e).connect(g);
    n.start(t);
    n.stop(t + 1.5);
  }

  #hiss(p, dur) {
    this.#loopNoise(p, dur, 5000, 0.15);
  }

  #loopNoise(p, dur, freq, vol) {
    const ctx = this.ctx;
    const { g, t } = this.#route(p, vol);
    const n = this.game.audio.noiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 0.7;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(1, t + 0.1);
    e.gain.setValueAtTime(1, t + dur - 0.3);
    e.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(bp).connect(e).connect(g);
    n.start(t);
    n.stop(t + dur + 0.05);
    return n;
  }

  /** Many tiny pops spread over ~1 s (and a few white flashes if `vis`). */
  #crackleAt(p, count, spread = 1.2) {
    const ctx = this.ctx;
    const { g, t } = this.#route(p, 0.5);
    for (let k = 0; k < count; k++) {
      const at = t + Math.random() * spread;
      const n = this.game.audio.noiseSource(false);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2000 + Math.random() * 3000;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.6, at);
      e.gain.exponentialRampToValueAtTime(0.001, at + 0.02);
      n.connect(hp).connect(e).connect(g);
      n.start(at, Math.random());
      n.stop(at + 0.03);
    }
    for (let k = 0; k < Math.min(count, 40); k++) {
      this.after(Math.random() * spread, () => this.spawn(p.clone().add(rv(6, 0).multiplyScalar(0.5)), rv(1, 0), PAL.white, { life: 0.1, size: 0.6, drag: 2, grav: 0 }));
    }
  }
}

/** Unit vector, uniform on the sphere. */
function sphere() {
  const u = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return new THREE.Vector3(r * Math.cos(a), u, r * Math.sin(a));
}

/** Random velocity of magnitude ~s, with an upward bias `up`. */
function rv(s, up) {
  return sphere().multiplyScalar(s * Math.random()).add(new THREE.Vector3(0, up, 0));
}
