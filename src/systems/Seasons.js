import * as THREE from 'three';

/**
 * Seasons
 * -------
 * Pine Hollow turns through the year: you start in the real season (by your
 * calendar), and it moves on every two in-game days. The day counter is
 * shared in a room, so everyone is in the same season.
 *
 *  winter  snow falls (heavier in storms), the ground turns white, trees go
 *          frosty, Mirror Lake freezes — step onto the ice and skate — and
 *          there's a sled on the porch: ride it down the mountain
 *  spring  oaks blossom pink, petals drift, more rain
 *  summer  deep green, fireflies come out at night
 *  autumn  oaks go red and gold, leaves fall
 *
 * Skating:  W push · A/D turn · SPACE brake · E step off
 * Sledding: A/D steer · S drag your feet · E get off. Gravity does the rest.
 */
export const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const NAMES = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn' };
const ARRIVE = {
  winter: 'Winter has come to Pine Hollow. Snow on everything. Mirror Lake has frozen over — and there’s an old sled on your porch.',
  spring: 'Spring. The oaks are in blossom and everything smells like rain.',
  summer: 'Summer. Warm nights, and the fireflies are back.',
  autumn: 'Autumn. The oaks have gone red and gold, and the leaves are coming down.',
};
// colour multipliers for the oaks / grass+bushes / pines per season
const TINT = {
  winter: { oak: [1.7, 1.75, 1.85], low: [1.7, 1.75, 1.85], pine: [1.25, 1.35, 1.45] },
  spring: { oak: [1.45, 1.0, 1.2], low: [1.05, 1.15, 1.0], pine: [1, 1, 1] },
  summer: { oak: [1, 1, 1], low: [1, 1, 1], pine: [1, 1, 1] },
  autumn: { oak: [1.6, 0.85, 0.35], low: [1.25, 1.0, 0.6], pine: [0.95, 0.95, 0.85] },
};
const N = 900;

export class Seasons {
  constructor(game) {
    this.game = game;
    const m = new Date().getMonth();
    this.base = m === 11 || m <= 1 ? 0 : m <= 4 ? 1 : m <= 7 ? 2 : 3;
    this.applied = null;
    this.mode = null; // 'skate' | 'sled'
    this.vel = new THREE.Vector3();
    this.#particles();
    this.#snowTex();
  }

  get index() {
    if (this.game.holidays?.current === 'christmas') return 0; // always a white Christmas
    const day = this.game.dayNight.day;
    return (this.base + Math.floor((day - 1) / 2)) % 4;
  }

  get name() {
    return SEASONS[this.index];
  }

  get label() {
    return NAMES[this.name];
  }

  /** Console helper: game.seasons.set('winter') */
  set(name) {
    this.base = (SEASONS.indexOf(name) - Math.floor((this.game.dayNight.day - 1) / 2) + 400) % 4;
  }

  // ---------------------------------------------------------------------------

  #snowTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d');
    x.fillStyle = '#e8eef4';
    x.fillRect(0, 0, 32, 32);
    for (let k = 0; k < 60; k++) {
      x.fillStyle = Math.random() < 0.5 ? '#d0dae6' : '#ffffff';
      x.fillRect(Math.random() * 32, Math.random() * 32, 2, 2);
    }
    this.snow = new THREE.CanvasTexture(c);
    this.snow.wrapS = this.snow.wrapT = THREE.RepeatWrapping;
    this.snow.magFilter = THREE.NearestFilter;
    this.snow.minFilter = THREE.NearestFilter;
  }

  #particles() {
    const geo = new THREE.BufferGeometry();
    this.pp = new Float32Array(N * 3);
    this.pv = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.pp[i * 3] = (Math.random() - 0.5) * 40;
      this.pp[i * 3 + 1] = Math.random() * 18;
      this.pp[i * 3 + 2] = (Math.random() - 0.5) * 40;
      this.pv[i * 3] = Math.random() * 6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.pmat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0xffffff) }, uSize: { value: 2 }, uScale: { value: 400 } },
      vertexShader: `uniform float uSize; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(uSize * 0.05 * uScale / -mv.z, 1.0, 10.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; void main(){ vec2 d = gl_PointCoord - 0.5; if (dot(d,d) > 0.25) discard; gl_FragColor = vec4(uColor, 0.9); }`,
    });
    this.points = new THREE.Points(geo, this.pmat);
    this.points.frustumCulled = false;
  }

  // ---------------------------------------------------------------------------
  // Applying a season to the World / Lake
  // ---------------------------------------------------------------------------

  #applyWorld(world) {
    const s = this.name;
    // remember the originals once
    if (!this.orig) {
      this.orig = new Map();
      world.root.traverse((o) => {
        if (!o.isMesh || !o.material?.uniforms?.uColor) return;
        const n = o.name || '';
        const kind = /tree_oak/.test(n) ? 'oak' : /tree_pine/.test(n) ? 'pine' : /scatter_(grass|bush)/.test(n) ? 'low' : null;
        if (!kind) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (!this.orig.has(m)) this.orig.set(m, { kind, c: m.uniforms.uColor.value.clone() });
      });
      this.terrainMats = [world.terrainMat].filter(Boolean).map((m) => ({ m, map: m.uniforms.uMap.value, c: m.uniforms.uColor.value.clone() }));
    }
    for (const [m, o] of this.orig) {
      const t = TINT[s][o.kind];
      m.uniforms.uColor.value.setRGB(o.c.r * t[0], o.c.g * t[1], o.c.b * t[2]);
    }
    for (const t of this.terrainMats) {
      if (s === 'winter') {
        t.m.uniforms.uMap.value = this.snow;
        t.m.uniforms.uColor.value.setRGB(1, 1, 1);
      } else {
        t.m.uniforms.uMap.value = t.map;
        t.m.uniforms.uColor.value.copy(t.c).multiplyScalar(s === 'autumn' ? 1 : 1).multiply(_c.setRGB(...(s === 'autumn' ? [1.15, 1.0, 0.75] : s === 'spring' ? [0.95, 1.08, 0.95] : [1, 1, 1])));
      }
    }
    // the sled on the porch, only in winter
    if (!this.sledProp) {
      const h = world.poi.house;
      const y = world.groundHeight(h.x + 3, h.z + 6);
      const grp = new THREE.Group();
      const red = world.mat({ color: 0xb02a20 });
      const wood = world.mat({ color: 0x8a5a30 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 1.3), wood);
      deck.position.y = 0.22;
      grp.add(deck);
      for (const dx of [-0.22, 0.22]) {
        const run = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.5), red);
        run.position.set(dx, 0.04, 0.05);
        grp.add(run);
        const curl = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 4, 8, Math.PI), red);
        curl.position.set(dx, 0.16, 0.8);
        curl.rotation.y = Math.PI / 2;
        grp.add(curl);
      }
      grp.position.set(h.x + 3, y, h.z + 6);
      grp.rotation.y = 0.5;
      world.root.add(grp);
      this.sledProp = grp;
      world.addInteractable(grp, {
        prompt: () => (this.game.inventory.has('sled') ? 'Sled hook (empty)' : 'Take the old sled'),
        enabled: () => this.name === 'winter',
        action: () => {
          if (this.game.inventory.has('sled')) return;
          this.game.inventory.add('sled');
          grp.visible = false;
          this.game.hud.toast('An old wooden sled. Use it (inventory) on a snowy slope — the mountain switchbacks are perfect.', 5500);
        },
      });
    }
    this.sledProp.visible = s === 'winter' && !this.game.inventory.has('sled');
  }

  #applyLake(lake) {
    const s = this.name;
    if (!lake.water) return;
    lake.waterMat ??= lake.water.material;
    lake.iceMat ??= lake.mat({ color: 0xc8dcec });
    lake.water.material = s === 'winter' ? lake.iceMat : lake.waterMat;
    if (!lake.iceVol) {
      lake.iceVol = lake.interactVolume(0, 0.4, -21.2, 2, 1, 1.2, {
        prompt: 'Step onto the ice',
        enabled: () => this.name === 'winter' && !this.mode,
        action: () => this.#startSkate(lake),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Skating + sledding
  // ---------------------------------------------------------------------------

  #startSkate(lake) {
    const g = this.game;
    this.mode = 'skate';
    this.lake = lake;
    this.vel.set(0, 0, 0);
    this.pos = new THREE.Vector3(0, -0.07, -22);
    g.player.enabled = false;
    g.hud.toast('On the ice. W push · A/D turn · SPACE brake · E step off', 5000);
    this.#scrape(true);
  }

  useSled() {
    const g = this.game;
    if (this.name !== 'winter') return g.hud.toast('No snow. The sled will have to wait for winter.');
    if (!g.scene?.outdoor || g.scene.name !== 'World') return g.hud.toast('Take it outside, somewhere with a hill.');
    if (g.vehicle.driving || this.mode) return;
    this.mode = 'sled';
    this.pos = g.player.feet.clone();
    this.vel.set(0, 0, 0);
    this.heading = g.player.yaw + Math.PI;
    g.player.enabled = false;
    g.hud.toast('On the sled. Point it downhill. A/D steer · S brake · E get off', 5000);
    this.#scrape(true);
  }

  #stop() {
    const g = this.game;
    const exit = this.mode === 'skate' ? new THREE.Vector3(0, 0, -14) : this.pos.clone();
    this.mode = null;
    g.player.enabled = true;
    g.player.spawn({ position: exit, yaw: g.player.yaw });
    this.#scrape(false);
  }

  #skate(dt) {
    const g = this.game;
    const k = g.input;
    if (k.pressed('KeyE') || g.scene !== this.lake) {
      k.consume('KeyE');
      return this.#stop();
    }
    const yaw = g.player.yaw;
    if (g.input.locked) g.player.look(g.input.consumeMouseDelta());
    const fwd = _v.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    if (k.down('KeyW')) this.vel.addScaledVector(fwd, 5 * dt);
    if (k.down('KeyA')) g.player.yaw += dt * 1.6;
    if (k.down('KeyD')) g.player.yaw -= dt * 1.6;
    const drag = k.down('Space') ? 2.5 : 0.25;
    this.vel.multiplyScalar(Math.exp(-drag * dt));
    if (this.vel.length() > 9) this.vel.setLength(9);
    this.pos.addScaledVector(this.vel, dt);
    // the shore: bounce off gently
    const dx = this.pos.x;
    const dz = this.pos.z + 25;
    const r = Math.hypot(dx, dz);
    if (r > 15.6) {
      const n = _n.set(dx / r, 0, dz / r);
      this.pos.x = n.x * 15.6;
      this.pos.z = n.z * 15.6 - 25;
      this.vel.addScaledVector(n, -1.6 * this.vel.dot(n));
    }
    g.player.position.copy(this.pos);
    this.speed = this.vel.length();
  }

  #sled(dt) {
    const g = this.game;
    const k = g.input;
    const scene = g.scene;
    if (k.pressed('KeyE') || scene.name !== 'World') {
      k.consume('KeyE');
      return this.#stop();
    }
    if (g.input.locked) g.player.look(g.input.consumeMouseDelta());
    // slope from the terrain gradient
    const p = this.pos;
    const e = 1.5;
    const gx = (scene.groundHeight(p.x + e, p.z) - scene.groundHeight(p.x - e, p.z)) / (2 * e);
    const gz = (scene.groundHeight(p.x, p.z + e) - scene.groundHeight(p.x, p.z - e)) / (2 * e);
    this.vel.x -= gx * 9.8 * dt;
    this.vel.z -= gz * 9.8 * dt;
    // runners: steer, and sideways slip is resisted
    if (k.down('KeyA')) this.heading += dt * 1.4;
    if (k.down('KeyD')) this.heading -= dt * 1.4;
    const f = _v.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    const along = this.vel.dot(f);
    const side = this.vel.clone().addScaledVector(f, -along);
    this.vel.copy(f.multiplyScalar(along)).addScaledVector(side, Math.exp(-4 * dt));
    this.vel.multiplyScalar(Math.exp(-(k.down('KeyS') ? 2.2 : 0.12) * dt));
    if (this.vel.length() > 20) this.vel.setLength(20);
    if (along < -0.5) this.heading += Math.PI; // spun round
    p.addScaledVector(this.vel, dt);
    p.y = scene.groundHeight(p.x, p.z);
    // trees and rocks stop you dead
    _seg.start.set(p.x, p.y + 0.4, p.z);
    _seg.end.set(p.x, p.y + 0.9, p.z);
    _b.copy(_seg.start);
    if (scene.collideCapsule(_seg, 0.35, { terrain: false }) && _seg.start.distanceTo(_b) > 0.02) {
      if (this.vel.length() > 6) g.hud.toast('Oof. Face full of tree.', 2000);
      p.x = _seg.start.x;
      p.z = _seg.start.z;
      this.vel.multiplyScalar(0.1);
    }
    g.player.position.set(p.x, p.y - 0.6, p.z);
    this.speed = this.vel.length();
  }

  /** Runner/blade hiss that follows your speed. */
  #scrape(on) {
    const ctx = this.game.audio.ctx;
    if (on && !this.noise) {
      this.noise = this.game.audio.noiseSource(true);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2400;
      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.value = 0;
      this.noise.connect(f).connect(this.noiseGain).connect(this.game.audio.master);
      this.noise.start();
    } else if (!on && this.noise) {
      this.noise.stop();
      this.noise = null;
    }
  }

  // ---------------------------------------------------------------------------

  update(dt) {
    const g = this.game;
    const scene = g.scene;
    if (!scene) return;
    const s = this.name;
    // season changes (or a new scene to dress)
    const key = `${s}:${scene.name}`;
    if (key !== this.applied) {
      const changed = this.applied && !this.applied.startsWith(s);
      this.applied = key;
      if (scene.name === 'World') this.#applyWorld(scene);
      if (scene.name === 'Lake') this.#applyLake(scene);
      if (changed || this.first === undefined) {
        this.first = true;
        setTimeout(() => g.hud.toast(ARRIVE[s], 6000), changed ? 500 : 9000);
      }
    }
    if (this.mode === 'skate') this.#skate(dt);
    else if (this.mode === 'sled') this.#sled(dt);
    if (this.noiseGain) this.noiseGain.gain.setTargetAtTime(Math.min(0.25, (this.speed ?? 0) * 0.025), g.audio.ctx.currentTime, 0.1);

    // falling snow / petals / leaves around the camera
    // memory places keep their own season (Fremont is always late autumn)
    const want = scene.outdoor && (!scene.memory || scene.name === 'Fremont') && (s === 'winter' || s === 'autumn' || (s === 'spring' && Math.sin(g.time * 0.05) > -0.3));
    if (want && this.points.parent !== scene.root) scene.root.add(this.points);
    if (!want) {
      this.points.removeFromParent();
      return;
    }
    const cam = g.camera.position;
    const storm = g.weather.storm;
    const n = s === 'winter' ? Math.floor(N * (0.35 + storm * 0.65)) : Math.floor(N * 0.12);
    const fall = s === 'winter' ? 1.4 + storm * 2 : 0.9;
    const wind = g.weather.wind * (s === 'winter' ? 2 : 3);
    const arr = this.points.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      if (i >= n) {
        arr[k + 1] = -9999;
        continue;
      }
      this.pv[k] += dt;
      this.pp[k + 1] -= fall * dt;
      this.pp[k] += (wind + Math.sin(this.pv[k] * 1.3 + i) * (s === 'winter' ? 0.4 : 1.2)) * dt;
      this.pp[k + 2] += Math.cos(this.pv[k] * 1.1 + i) * 0.4 * dt;
      if (this.pp[k + 1] < 0) this.pp[k + 1] += 18;
      arr[k] = cam.x + (((this.pp[k] % 40) + 60) % 40) - 20;
      arr[k + 1] = cam.y - 4 + this.pp[k + 1];
      arr[k + 2] = cam.z + (((this.pp[k + 2] % 40) + 60) % 40) - 20;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.pmat.uniforms.uColor.value.setHex(s === 'winter' ? 0xf4f8ff : s === 'spring' ? 0xffc0d8 : i3(g.time) ? 0xd8701a : 0xc0401a);
    this.pmat.uniforms.uSize.value = s === 'winter' ? 2.2 : 3;
    this.pmat.uniforms.uScale.value = window.innerHeight;
  }
}

const i3 = (t) => Math.sin(t * 0.7) > 0;
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _seg = new THREE.Line3(new THREE.Vector3(), new THREE.Vector3());
const _b = new THREE.Vector3();
