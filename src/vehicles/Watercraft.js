import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';

/**
 * Watercraft — the fishing boat and the jet ski.
 *
 * Buoyancy against the same wave field the water shader draws
 * (renderer.water.height):
 *  - four hull points (bow, stern, port, starboard) sample the waves; the hull
 *    is sprung toward their average height with pitch + roll following them
 *  - thrust along the heading, quadratic drag, a rudder that only bites when
 *    you're moving, and weak sideways grip so hulls drift and carve
 *  - the jet ski leaves the water off crests at speed (gravity takes over)
 *  - running into shallows (ground above the hull bottom) grounds you
 *  - idle boats keep bobbing at their moorings
 *
 * cfg: maxSpeed, thrust, reverse, drag, turn, lateral, draft, length, beam,
 *      bob { k, damp }, airborne (bool), lean
 */
const G = 9.81;

export class Watercraft extends Vehicle {
  constructor(system, cfg) {
    super(system, { kind: 'water', ...cfg });
    this.vy = 0;
    this.pitch = 0;
    this.roll = 0;
    this.pitchVel = 0;
    this.rollVel = 0;
    this.rudder = 0;
    this.airborne = false;
    this.wakeTimer = 0;
  }

  build() {
    this.navLight = { position: new THREE.Vector3(), color: new THREE.Color(this.cfg.lightColor ?? 0xfff0c0), range: this.cfg.lightRange ?? 9, intensity: 1.2, enabled: true, priority: 2 };
    this.lights = [this.navLight];
  }

  updateLights() {
    this.navLight.position.copy(this.cfg.lightAt ?? new THREE.Vector3(0, 2, 0)).applyMatrix4(this.object.matrixWorld);
    this.navLight.enabled = this.driving || this.cfg.alwaysLit;
  }

  onPark() {
    this.mooring = this.position.clone();
  }

  /** Only get off next to a dock/shore (or where you boarded). */
  exitPoint() {
    const spots = this.system.moorings.filter((m) => m.scene === this.sceneName);
    let best = null;
    let bestD = 9;
    for (const m of spots) {
      const d = Math.hypot(m.position.x - this.position.x, m.position.z - this.position.z);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best ? best.position.clone() : null;
  }

  simulate(dt, scene, input) {
    const c = this.cfg;
    const water = this.game.renderer.water;
    const p = this.position;
    const f = this.forward;
    const l = this.left;

    // ---- wave samples ----------------------------------------------------------
    const hl = c.length / 2;
    const hb = c.beam / 2;
    const bow = water.height(p.x + f.x * hl, p.z + f.z * hl);
    const stern = water.height(p.x - f.x * hl, p.z - f.z * hl);
    const port = water.height(p.x + l.x * hb, p.z + l.z * hb);
    const star = water.height(p.x - l.x * hb, p.z - l.z * hb);
    const surface = (bow + stern + port + star) / 4;
    // The model's origin is its keel: at rest it sits `draft` below the waves.
    const rest = surface - c.draft;

    // ---- vertical: buoyancy spring, or ballistic when airborne ----------------
    const sub = rest - p.y; // > 0: pushed under, buoyancy pushes up
    if (sub > -0.15) {
      this.airborne = false;
      this.vy += (sub * c.bob.k - this.vy * c.bob.damp) * dt;
    } else {
      this.airborne = true;
      this.vy -= G * dt;
    }
    // Jet ski: hitting a rising wave face at speed throws you up.
    if (c.airborne && !this.airborne && this.speed > 9) {
      const slope = water.slope(p.x, p.z, _sl);
      const rise = -(slope.x * f.x + slope.z * f.z) * this.speed;
      if (rise > 2.2) this.vy = Math.max(this.vy, rise * 0.55);
    }
    p.y += this.vy * dt;

    // ---- pitch/roll springs toward the wave shape ------------------------------
    const tPitch = Math.atan2(bow - stern, c.length) + (input?.throttle > 0 ? Math.min(0.12, this.speed * 0.01) : 0);
    const lean = c.lean ? -this.rudder * Math.min(1, this.speed / 10) * c.lean : 0;
    const tRoll = Math.atan2(port - star, c.beam) + lean;
    const ks = this.airborne ? 2 : 18;
    this.pitchVel += ((tPitch - this.pitch) * ks - this.pitchVel * 5) * dt;
    this.rollVel += ((tRoll - this.roll) * ks - this.rollVel * 5) * dt;
    this.pitch += this.pitchVel * dt;
    this.roll += this.rollVel * dt;

    // ---- thrust, rudder, drag ----------------------------------------------------
    let along = this.vel.x * f.x + this.vel.y * f.z;
    if (input) {
      if (!this.airborne) {
        if (input.throttle > 0) along += c.thrust * Math.max(0, 1 - along / c.maxSpeed) * dt;
        else if (input.throttle < 0) along -= c.reverse * dt;
      }
      this.rudder = THREE.MathUtils.damp(this.rudder, input.steer, 4, dt);
    } else this.rudder = THREE.MathUtils.damp(this.rudder, 0, 2, dt);
    along -= along * Math.abs(along) * c.drag * dt + along * 0.15 * dt;
    if (!this.airborne) this.heading += this.rudder * c.turn * THREE.MathUtils.clamp(along / 4, -1, 1) * dt;
    const nf = this.forward;
    const lat = _lat.set(this.vel.x - f.x * (this.vel.x * f.x + this.vel.y * f.z), this.vel.y - f.z * (this.vel.x * f.x + this.vel.y * f.z));
    lat.multiplyScalar(Math.exp(-c.lateral * dt));
    this.vel.set(nf.x * along + lat.x, nf.z * along + lat.y);
    // Idle hulls drift back toward their mooring (stand-in for a rope).
    if (!input && this.mooring) {
      this.vel.x += (this.mooring.x - p.x) * 0.3 * dt;
      this.vel.y += (this.mooring.z - p.z) * 0.3 * dt;
      this.vel.multiplyScalar(Math.exp(-1.5 * dt));
    }

    // ---- integrate + shallows + props -----------------------------------------
    const prev = _prev.copy(p);
    p.x += this.vel.x * dt;
    p.z += this.vel.y * dt;
    const ground = scene.groundHeight(p.x + nf.x * hl * 0.8, p.z + nf.z * hl * 0.8);
    if (ground > rest + 0.1) {
      p.x = prev.x;
      p.z = prev.z;
      if (Math.abs(along) > 2) {
        this.game.audio.oneShot('door', { volume: 0.5, rate: 0.5 });
        this.game.camera.userData.shake = 0.15;
      }
      this.vel.set(-nf.x * 0.8, -nf.z * 0.8);
    }
    const push = this.collideProps(scene, 0.6);
    if (push) {
      p.add(push);
      this.vel.multiplyScalar(0.3);
    }
    this.speed = this.vel.x * nf.x + this.vel.y * nf.z;
    this.object.rotation.set(-this.pitch, this.heading, this.roll, 'YXZ');

    // ---- wake + spray ------------------------------------------------------------
    const fx = this.system.fx;
    this.wakeTimer -= dt;
    if (fx && Math.abs(this.speed) > 1.2 && !this.airborne && this.wakeTimer <= 0) {
      this.wakeTimer = 0.09;
      const back = p.clone().addScaledVector(nf, -hl);
      back.y = water.height(back.x, back.z) + 0.05;
      fx.foam(back, 0.6 + Math.abs(this.speed) * 0.08, 2.5);
      if (c.airborne && this.speed > 6) {
        const side = Math.random() < 0.5 ? 1 : -1;
        const sp = p.clone().addScaledVector(nf, hl * 0.6).addScaledVector(l, side * hb);
        sp.y = surface + 0.2;
        fx.spray(sp, new THREE.Vector3(l.x * side * 2 + nf.x, 2.5 + Math.random(), l.z * side * 2 + nf.z));
      }
    }
    if (this.airborne === false && this._wasAir && fx) {
      fx.splash(p.clone().setY(surface));
      this.game.audio.oneShot('splash', { volume: 0.5, object: this.object });
    }
    this._wasAir = this.airborne;
    this.cfg.animate?.(this, dt);
  }
}

const _lat = new THREE.Vector2();
const _prev = new THREE.Vector3();
const _sl = { x: 0, z: 0 };
