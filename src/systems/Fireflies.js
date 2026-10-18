import * as THREE from 'three';

/**
 * Fireflies
 * ---------
 * On warm dark nights a few dozen fireflies drift around you whenever you're
 * outside (more of them by the lake). Each one wanders on its own lazy path
 * and blinks in its own rhythm.
 *
 * With the mason jar equipped, LMB catches one that's in front of you
 * (within arm's reach). A jar of them is a lantern: it lights your way,
 * brighter the more you've caught (up to 20). "Let them go" in the
 * inventory releases them in a little upward swirl.
 */
const N = 70;
const MAX_JAR = 20;

export class Fireflies {
  constructor(game) {
    this.game = game;
    this.jar = 0;
    this.flies = [];
    this.released = [];
    this.lights = [];
    this.jarLight = { position: new THREE.Vector3(), color: new THREE.Color(0xd8ff70), range: 6, intensity: 0, enabled: true, priority: 6 };
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array((N + 60) * 3);
    this.a = new Float32Array(N + 60);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uScale: { value: 400 } },
        vertexShader: `attribute float alpha; varying float vA; uniform float uScale;
          void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = clamp(0.16 * uScale / -mv.z, 2.0, 24.0); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying float vA;
          void main(){ float r = length(gl_PointCoord - 0.5); float c = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vec3(0.85, 1.0, 0.35) * c + smoothstep(0.15, 0.0, r) * 0.5, c * vA); }`,
      }),
    );
    this.points.frustumCulled = false;
  }

  get active() {
    const g = this.game;
    const m = g.dayNight.minutes;
    return g.scene?.outdoor && (m < 320 || m > 1220) && !(g.weather?.rain > 0.2);
  }

  #place(f, near) {
    const g = this.game;
    const c = g.camera.position;
    const a = Math.random() * Math.PI * 2;
    const r = near ? 3 + Math.random() * 10 : 8 + Math.random() * 30;
    f.home.set(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
    const gy = g.scene.groundHeight?.(f.home.x, f.home.z) ?? c.y - 1.6;
    const wy = g.scene.waterHeight?.(f.home.x, f.home.z);
    f.home.y = Math.max(gy, wy ?? -1e9) + 0.4 + Math.random() * 2;
    f.p.copy(f.home);
    f.ph = Math.random() * 100;
    f.rate = 0.3 + Math.random() * 0.5;
  }

  update(dt) {
    const g = this.game;
    const on = this.active;
    const root = g.scene?.root;
    if (on && this.points.parent !== root) {
      root.add(this.points);
      this.flies = [];
      const count = g.scene.name === 'Lake' ? N : 45;
      for (let i = 0; i < count; i++) {
        const f = { home: new THREE.Vector3(), p: new THREE.Vector3() };
        this.#place(f, i < 12);
        this.flies.push(f);
      }
    } else if (!on && this.points.parent && !this.released.length) this.points.removeFromParent();

    const t = g.time;
    const cam = g.camera.position;
    let n = 0;
    if (on) {
      for (const f of this.flies) {
        if (f.p.distanceTo(cam) > 45) this.#place(f, false);
        f.ph += dt * f.rate;
        f.p.set(f.home.x + Math.sin(f.ph * 1.3) * 1.6 + Math.sin(f.ph * 3.1) * 0.3, f.home.y + Math.sin(f.ph * 0.9) * 0.5, f.home.z + Math.cos(f.ph * 1.1) * 1.6);
        this.pos.set([f.p.x, f.p.y, f.p.z], n * 3);
        const blink = Math.sin(t * (1.2 + f.rate) + f.ph * 7);
        this.a[n++] = blink > 0.3 ? (blink - 0.3) * 1.4 : 0.03;
      }
    }
    for (let i = this.released.length - 1; i >= 0; i--) {
      const r = this.released[i];
      r.t += dt;
      if (r.t > 6) {
        this.released.splice(i, 1);
        continue;
      }
      r.p.addScaledVector(r.v, dt);
      r.v.x += Math.sin(t * 2 + i) * dt * 1.5;
      r.v.z += Math.cos(t * 2 + i) * dt * 1.5;
      this.pos.set([r.p.x, r.p.y, r.p.z], n * 3);
      this.a[n++] = (0.6 + Math.sin(t * 6 + i) * 0.4) * Math.min(1, 6 - r.t);
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = geo.attributes.alpha.needsUpdate = true;
    this.points.material.uniforms.uScale.value = window.innerHeight * 0.6;

    // the jar
    const holding = g.inventory.equipped === 'jar' && !g.vehicle.driving;
    this.lights.length = 0;
    if (holding && this.jar > 0) {
      this.jarLight.position.set(0.25, -0.3, -0.6).applyQuaternion(g.camera.quaternion).add(cam);
      this.jarLight.intensity = (0.4 + (this.jar / MAX_JAR) * 1.4) * (0.85 + Math.sin(t * 3) * 0.15);
      this.jarLight.range = 3 + this.jar * 0.35;
      this.lights.push(this.jarLight);
    }
    if (holding && on && g.input.locked && g.input.mousePressed(0) && !g.uiOpen && !g.focus) {
      g.input.consumeMouse(0);
      this.#catch();
    }
  }

  #catch() {
    const g = this.game;
    if (this.jar >= MAX_JAR) {
      g.hud.toast('The jar is full. Glowing like a little moon.');
      return;
    }
    const cam = g.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    let best = null;
    let bd = 2.2;
    for (const f of this.flies) {
      const to = f.p.clone().sub(cam.position);
      const d = to.length();
      if (d < bd && to.normalize().dot(dir) > 0.75) {
        best = f;
        bd = d;
      }
    }
    if (!best) {
      g.hud.toast(['Missed. It blinks somewhere else.', 'Too far — get closer.', 'Swish. Nothing.'][Math.floor(Math.random() * 3)], 1500);
      return;
    }
    this.jar++;
    this.#place(best, false);
    g.audio.oneShot('click', { volume: 0.3, rate: 1.8 });
    g.hud.toast(this.jar === 1 ? 'Caught one! It glows on and off in the jar.' : `${this.jar} fireflies in the jar.`, 1800);
  }

  release() {
    const g = this.game;
    if (!this.jar) return;
    const c = g.camera.position.clone().add(new THREE.Vector3(0, -0.4, 0));
    for (let i = 0; i < this.jar; i++) this.released.push({ p: c.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 2, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 2), t: 0 });
    if (this.points.parent !== g.scene.root) g.scene.root.add(this.points);
    g.hud.toast(`You unscrew the lid. ${this.jar} little lights drift up and away.`, 3500);
    this.jar = 0;
  }
}
