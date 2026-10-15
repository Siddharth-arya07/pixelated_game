import * as THREE from 'three';

/**
 * WeatherSystem
 * -------------
 * Thunderstorms that roll in off the sea and pass again.
 *
 *   storm (0..1) eases toward a target; rain and wind follow it.
 *   - rain streaks around the camera (outdoors), rain loop (muffled indoors)
 *   - fog closes in and goes grey, the sea gets rough (shared wave field, so
 *     the boat and jet ski feel it), the gravel and asphalt get slippery
 *   - lightning: the whole world flashes (interiors too, through the
 *     windows), a jagged bolt over the hills or the sea, thunder arriving
 *     later the further away it struck
 *   - sandbox sand gets wet and castles melt (scenes/Playground.js)
 *
 * mode: 'auto' (storms come and go), 'storm' (always), 'clear' (never).
 * Console: game.weather.setMode('storm'), game.weather.strike(80)
 */
const DROPS = 1600;
const BOX = { x: 26, y: 16, z: 26 };

export class WeatherSystem {
  constructor(game) {
    this.game = game;
    this.mode = 'auto';
    this.storm = 0;
    this.target = 0;
    this.flash = 0;
    this.timer = 70; // first storm about a minute in
    this.strikeTimer = 6;
    this.rainSound = null;
    this.bolt = null;
    this.boltTime = 0;
    this._dropsScene = null;
    this.#buildRain();
  }

  get rain() {
    return this.storm;
  }

  get wind() {
    return 0.2 + this.storm * 0.8;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'storm') this.target = 1;
    if (mode === 'clear') this.target = 0;
    if (mode === 'auto') this.timer = Math.min(this.timer, 60);
  }

  // ---------------------------------------------------------------------------

  #buildRain() {
    const pos = new Float32Array(DROPS * 6);
    this.drops = new Float32Array(DROPS * 3); // offsets inside the box
    for (let i = 0; i < DROPS; i++) {
      this.drops[i * 3] = Math.random() * BOX.x;
      this.drops[i * 3 + 1] = Math.random() * BOX.y;
      this.drops[i * 3 + 2] = Math.random() * BOX.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(DROPS * 6), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(DROPS * 4), 2));
    this.rainMat = this.game.renderer.material({ color: 0x8a96aa, unlit: true, opacity: 0.45, fogScale: 0.6, depthWrite: false });
    this.rainMesh = new THREE.LineSegments(geo, this.rainMat);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.renderOrder = 5;
  }

  #updateRain(dt, scene) {
    const outdoor = scene.outdoor && this.storm > 0.03;
    if (this._dropsScene !== (outdoor ? scene : null)) {
      this.rainMesh.parent?.remove(this.rainMesh);
      if (outdoor) scene.root.add(this.rainMesh);
      this._dropsScene = outdoor ? scene : null;
    }
    if (!outdoor) return;
    const cam = this.game.camera.getWorldPosition(_cam);
    const pos = this.rainMesh.geometry.attributes.position.array;
    const fall = 15 * dt;
    const wx = this.wind * 3.2; // slant
    const n = Math.floor(DROPS * Math.min(1, this.storm * 1.2));
    const ox = cam.x - BOX.x / 2;
    const oy = cam.y - BOX.y / 2;
    const oz = cam.z - BOX.z / 2;
    for (let i = 0; i < DROPS; i++) {
      const k = i * 3;
      const d = this.drops;
      d[k + 1] -= fall;
      d[k] += wx * dt;
      if (d[k + 1] < 0) d[k + 1] += BOX.y;
      if (d[k] > BOX.x) d[k] -= BOX.x;
      // Wrap relative to the camera so the box follows you without popping.
      const x = ox + ((((d[k] - ox) % BOX.x) + BOX.x) % BOX.x);
      const y = oy + ((((d[k + 1] - oy) % BOX.y) + BOX.y) % BOX.y);
      const z = oz + ((((d[k + 2] - oz) % BOX.z) + BOX.z) % BOX.z);
      const p = i * 6;
      if (i >= n) {
        pos[p + 1] = pos[p + 4] = -9999;
        continue;
      }
      pos[p] = x;
      pos[p + 1] = y;
      pos[p + 2] = z;
      pos[p + 3] = x - wx * 0.045;
      pos[p + 4] = y - 0.7;
      pos[p + 5] = z;
    }
    this.rainMesh.geometry.attributes.position.needsUpdate = true;
    this.rainMat.uniforms.uOpacity.value = 0.25 + this.storm * 0.3;
  }

  // ---------------------------------------------------------------------------

  /** Lightning at `dist` metres (random if omitted). */
  strike(dist = 60 + Math.random() * 500, a = Math.random() * Math.PI * 2, fromNet = false) {
    const g = this.game;
    if (!fromNet && g.net?.online) g.net.event('strike', { dist, a });
    this.flash = dist < 200 ? 1 : 0.55;
    this.flashT = 0;
    const scene = g.scene;
    if (scene?.outdoor && dist < 400) this.#showBolt(scene, dist, a);
    const delay = (dist / 343) * 1000;
    const vol = THREE.MathUtils.clamp(1.2 - dist / 700, 0.25, 1) * (scene?.outdoor ? 1 : 0.6);
    setTimeout(() => g.audio.oneShot('thunder', { volume: vol, rate: dist < 160 ? 1.5 : 1 }), delay);
  }

  #showBolt(scene, dist, a) {
    const g = this.game;
    const cam = g.camera.getWorldPosition(_cam);
    const x = cam.x + Math.cos(a) * dist;
    const z = cam.z + Math.sin(a) * dist;
    const ground = scene.groundHeight?.(x, z) ?? 0;
    const pts = [];
    let px = x;
    let pz = z;
    const top = ground + 140;
    for (let y = top; y > ground; y -= 9) {
      pts.push(new THREE.Vector3(px, y, pz));
      px += (Math.random() - 0.5) * 9;
      pz += (Math.random() - 0.5) * 9;
    }
    pts.push(new THREE.Vector3(px, ground, pz));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    if (!this.boltMat) this.boltMat = g.renderer.material({ color: 0xe8ecff, unlit: true, fogScale: 0.15 });
    if (this.bolt) {
      this.bolt.parent?.remove(this.bolt);
      this.bolt.geometry.dispose();
    }
    this.bolt = new THREE.Line(geo, this.boltMat);
    this.bolt.frustumCulled = false;
    scene.root.add(this.bolt);
    this.boltTime = 0.22;
  }

  // ---------------------------------------------------------------------------

  update(dt, scene) {
    const g = this.game;

    // Guests in a room follow the host's sky (storm level + strikes arrive by net).
    const guest = g.net?.online && !g.net.isHost;
    // Schedule (auto): ~3–6 min clear, ~3–4 min storm.
    if (this.mode === 'auto' && !guest) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const starting = this.target < 0.5;
        this.target = starting ? 0.75 + Math.random() * 0.25 : 0;
        this.timer = starting ? 180 + Math.random() * 80 : 180 + Math.random() * 180;
        if (starting) g.hud.toast(scene.outdoor ? 'Thunder rolls in off the sea.' : 'Rain starts drumming on the roof.', 3500);
      }
    }
    this.storm = THREE.MathUtils.damp(this.storm, this.target, 0.12, dt);

    // Lightning, more often the heavier it is.
    if (this.storm > 0.45 && !guest) {
      this.strikeTimer -= dt;
      if (this.strikeTimer <= 0) {
        this.strikeTimer = (5 + Math.random() * 14) / this.storm;
        this.strike();
      }
    }
    if (this.flash > 0) {
      this.flashT += dt;
      // Two quick pulses, then a fade.
      const t = this.flashT;
      const pulse = t < 0.06 ? 1 : t < 0.12 ? 0.25 : t < 0.2 ? 0.9 : Math.max(0, 1 - (t - 0.2) / 0.35);
      this.flashLevel = pulse * this.flash;
      if (t > 0.6) this.flash = 0;
    } else this.flashLevel = 0;
    if (this.bolt) {
      this.boltTime -= dt;
      this.bolt.visible = this.boltTime > 0 && (this.flashT < 0.06 || this.flashT > 0.12);
      if (this.boltTime <= 0) {
        this.bolt.parent?.remove(this.bolt);
        this.bolt.geometry.dispose();
        this.bolt = null;
      }
    }

    // Rough sea.
    g.renderer.water.setStorm?.(this.storm);

    // Lighthouse beam shows up more in the rain.
    const world = g.scenes.World;
    if (world.beams) world.beams.children[0].material.uniforms.uOpacity.value = 0.09 + this.storm * 0.09;

    // Rain sound.
    if (!this.rainSound && this.storm > 0.02) {
      this.rainSound = g.audio.ambient('rain', { volume: 0 });
    }
    if (this.rainSound) {
      const inside = !scene.outdoor;
      const inCab = !!g.vehicle.active && g.vehicle.active.kind === 'ground';
      this.rainSound.synth?.setMuffled?.(inside || inCab);
      this.rainSound.setVolume(this.storm * (inside ? 0.22 : inCab ? 0.35 : 0.5), 0.5);
    }

    this.#updateRain(dt, scene);
  }

  /**
   * Called by DayNightCycle after it samples the clock: darken + grey the
   * palette and pull the fog in while it storms, then add the lightning.
   */
  apply(dn, outdoor) {
    const s = this.storm;
    if (s > 0) {
      dn.fog.lerp(_c.set(0x15181e), s * 0.55);
      dn.ambient.multiplyScalar(1 - s * 0.25);
      dn.light.multiplyScalar(1 - s * 0.5);
      dn.far *= 1 - s * 0.3;
    }
    const f = this.flashLevel ?? 0;
    if (f > 0) {
      const k = outdoor ? 1 : 0.4;
      dn.ambient.add(_c.set(0x8890b0).multiplyScalar(f * k * 1.4));
      dn.light.add(_c.set(0xa0a8d0).multiplyScalar(f * k));
      if (outdoor) dn.fog.lerp(_c.set(0x6a7090), f * 0.6);
    }
  }
}

const _cam = new THREE.Vector3();
const _c = new THREE.Color();
