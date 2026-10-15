import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';

/**
 * GroundVehicle — the truck and the bike.
 *
 * Terrain-following arcade physics:
 *  - four contact points sample `scene.groundHeight()` → body height, pitch,
 *    roll (sprung, so it bounces over crests and can catch a little air)
 *  - gravity pulls along the slope: a weak engine crawls up the switchbacks
 *  - grip depends on the surface under the wheels (asphalt > gravel > grass >
 *    sand); low grip = slides, steep off-road slopes = you slide back down
 *  - props (trees, walls, pumps) block you via a capsule
 *
 * cfg: maxSpeed, power (m/s² at standstill), brake, steerMax, steerSpeed,
 *      wheelBase, track, grip { asphalt, gravel, grass, sand, rock }, lean
 */
const G = 9.81;

export class GroundVehicle extends Vehicle {
  constructor(system, cfg) {
    super(system, { kind: 'ground', ...cfg });
    this.steer = 0;
    this.vy = 0;
    this.pitch = 0;
    this.roll = 0;
    this.airborne = false;
    this.headlightsOn = false;
  }

  build() {
    // Wheel pivots (so wheels spin on their axles and the fronts steer).
    this.wheels = [];
    for (const name of this.cfg.wheelNodes ?? []) {
      const mesh = this.model.getObjectByName(name);
      if (!mesh) continue;
      this.object.updateMatrixWorld(true);
      const centre = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
      const pivot = new THREE.Group();
      mesh.parent.add(pivot);
      pivot.position.copy(mesh.parent.worldToLocal(centre.clone()));
      pivot.attach(mesh);
      pivot.rotation.order = 'YXZ';
      pivot.userData.front = /front/i.test(name);
      this.wheels.push(pivot);
    }
    // Headlight + tail light (point lights in the PSX shader).
    this.headLight = { position: new THREE.Vector3(), color: new THREE.Color(0xfff0d0), range: 14, intensity: 1.8, enabled: false, priority: 3 };
    this.tailLight = { position: new THREE.Vector3(), color: new THREE.Color(0xff2010), range: 3.5, intensity: 0.6, enabled: false, priority: 1 };
    this.lights = [this.headLight, this.tailLight];
    this.cfg.buildExtras?.(this);
  }

  setHeadlights(on) {
    this.headlightsOn = on;
    this.headLight.enabled = on;
    this.tailLight.enabled = on;
    this.cfg.onHeadlights?.(this, on);
  }

  onEnter() {
    super.onEnter();
    this.setHeadlights(true); // it's always foggy out here
  }

  updateLights() {
    const f = this.forward;
    const p = this.position;
    this.headLight.position.copy(p).addScaledVector(f, this.half.z + 4.5).setY(p.y + 1.2);
    this.tailLight.position.copy(p).addScaledVector(f, -this.half.z - 0.6).setY(p.y + 1.0);
    this.tailLight.intensity = this.driving && this.speed < -0.1 ? 1.2 : 0.5;
  }

  /** Heights at the four contact points (front-left, front-right, rear-left, rear-right). */
  #contacts(scene) {
    const f = this.forward;
    const l = this.left;
    const hb = this.cfg.wheelBase / 2;
    const ht = this.cfg.track / 2;
    const p = this.position;
    const h = (a, b) => scene.groundHeight(p.x + f.x * a + l.x * b, p.z + f.z * a + l.z * b);
    return [h(hb, ht), h(hb, -ht), h(-hb, ht), h(-hb, -ht)];
  }

  simulate(dt, scene, input) {
    const c = this.cfg;
    const p = this.position;
    const surface = scene.surfaceAt?.(p.x, p.z) ?? 'asphalt';
    const grip = c.grip[surface] ?? c.grip.asphalt;
    const f = this.forward;

    // ---- forces along the heading ------------------------------------------
    let along = this.vel.x * f.x + this.vel.y * f.z;
    if (input && !this.airborne) {
      const { throttle, steer, handbrake } = input;
      const power = c.power * grip.drive * Math.max(0, 1 - Math.abs(along) / c.maxSpeed);
      if (throttle > 0) along += (along < -0.3 ? c.brake : power) * dt;
      else if (throttle < 0) along -= (along > 0.3 ? c.brake : power * 0.6) * dt;
      if (along < -c.maxReverse) along = -c.maxReverse;
      if (c.ollie) {
        // Skateboard: Space pops an ollie instead of braking.
        if (handbrake && !this._ollieHeld) {
          this.vy = c.ollie;
          this.airborne = true;
          this.game.audio.oneShot('ollie', { volume: 0.7 });
        }
        this._ollieHeld = handbrake;
      } else if (handbrake) along *= Math.exp(-2.5 * dt);
      const steerTarget = steer * c.steerMax * (1 - Math.min(Math.abs(along) / c.maxSpeed, 1) * 0.5);
      this.steer = THREE.MathUtils.damp(this.steer, steerTarget, c.steerSpeed, dt);
    } else {
      this.steer = THREE.MathUtils.damp(this.steer, 0, 3, dt);
    }
    // Rolling resistance (more on grass/sand).
    const roll = (grip.rolling ?? 0.4) * dt;
    along = Math.abs(along) <= roll ? 0 : along - Math.sign(along) * roll;

    // Parked and not on a cliff: stay put (handbrake on).
    const grad = scene.gradientAt?.(p.x, p.z, _grad) ?? _grad.set(0, 0);
    const steepness = Math.hypot(grad.x, grad.y);
    const parked = !input && steepness < 0.7;
    if (parked) {
      this.vel.set(0, 0);
      along = 0;
    }

    // ---- yaw ------------------------------------------------------------------
    if (!this.airborne) this.heading += (along / c.wheelBase) * Math.tan(this.steer) * dt * grip.turn;

    // ---- rebuild velocity: grip kills sideways sliding ------------------------
    const nf = this.forward;
    const lat = _lat.set(this.vel.x - f.x * (this.vel.x * f.x + this.vel.y * f.z), this.vel.y - f.z * (this.vel.x * f.x + this.vel.y * f.z));
    // Wet roads in a storm: less sideways grip.
    const wet = 1 - 0.35 * (this.game?.weather?.rain ?? 0);
    lat.multiplyScalar(Math.exp(-grip.lateral * wet * dt));
    this.vel.set(nf.x * along + lat.x, nf.z * along + lat.y);

    // ---- gravity along the slope (this is what makes the mountain hard) -------
    if (!parked && !this.airborne) {
      const k = G / Math.sqrt(1 + steepness * steepness);
      this.vel.x -= grad.x * k * dt;
      this.vel.y -= grad.y * k * dt;
    }

    // ---- integrate x/z + collide with props ----------------------------------
    const prev = _prev.copy(p);
    p.x += this.vel.x * dt;
    p.z += this.vel.y * dt;
    const push = this.collideProps(scene, 1.0);
    if (push) {
      p.add(push);
      const impact = Math.abs(along);
      if (impact > 3) {
        this.game.audio.oneShot('door', { volume: Math.min(1, impact / 10), rate: 0.6 });
        this.game.camera.userData.shake = Math.min(0.3, impact * 0.025);
      }
      // Lose the velocity into the obstacle.
      const n = push.normalize();
      const into = this.vel.x * n.x + this.vel.y * n.z;
      if (into < 0) {
        this.vel.x -= n.x * into * 1.3;
        this.vel.y -= n.z * into * 1.3;
      }
    }
    // Don't drive into the sea.
    const water = scene.waterHeight(p.x + nf.x * this.half.z, p.z + nf.z * this.half.z);
    if (water !== null && scene.groundHeight(p.x + nf.x * this.half.z, p.z + nf.z * this.half.z) < water - 0.5) {
      p.x = prev.x;
      p.z = prev.z;
      this.vel.multiplyScalar(0.2);
      if (input && Math.random() < dt * 2) this.game.hud.toast("That's the ocean.");
    }
    this.speed = this.vel.x * nf.x + this.vel.y * nf.z;

    // ---- height, pitch, roll from the contact points (sprung) -----------------
    const [fl, fr, rl, rr] = this.#contacts(scene);
    const ground = (fl + fr + rl + rr) / 4;
    const targetPitch = Math.atan2((fl + fr) / 2 - (rl + rr) / 2, c.wheelBase);
    const targetRoll = Math.atan2((fl + rl) / 2 - (fr + rr) / 2, c.track);
    this.vy -= G * dt;
    p.y += this.vy * dt;
    if (p.y <= ground) {
      if (this.airborne && this.vy < -4) this.game.camera.userData.shake = Math.min(0.25, -this.vy * 0.03);
      if (this.airborne && c.ollie && this.vy < -1.5) this.game.audio.oneShot('land', { volume: 0.6 });
      p.y = ground;
      this.vy = Math.max(0, this.vy);
      this.airborne = false;
    } else if (p.y > ground + 0.25) this.airborne = true;
    // Crest launch: if the ground drops away faster than we fall we leave it.
    const k = 1 - Math.exp(-10 * dt);
    this.pitch += (targetPitch - this.pitch) * (this.airborne ? k * 0.2 : k);
    const lean = c.lean ? -this.steer * Math.min(1, Math.abs(this.speed) / 8) * c.lean : 0;
    const kickstand = !input && c.kickstand ? c.kickstand : 0;
    this.roll += (targetRoll + lean + kickstand - this.roll) * k;
    this.object.rotation.set(-this.pitch, this.heading, this.roll, 'YXZ');

    // ---- wheels + steering wheel ------------------------------------------------
    for (const w of this.wheels) {
      w.rotation.x += (this.speed * dt) / (c.wheelRadius ?? 0.42);
      if (w.userData.front) w.rotation.y = this.steer;
    }
    this.cfg.animate?.(this, dt);
  }
}

const _grad = new THREE.Vector2();
const _lat = new THREE.Vector2();
const _prev = new THREE.Vector3();
