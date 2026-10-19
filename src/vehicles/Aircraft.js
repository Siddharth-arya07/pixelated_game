import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';

/**
 * Aircraft
 * --------
 * The old biplane at the Pine Hollow airfield. Arcade flight that still
 * feels like flying: throttle builds airspeed, lift comes in with speed,
 * bank to turn, too slow and the nose drops (stall), and the ground is hard.
 *
 *   SHIFT / CTRL   throttle up / down      W / S   nose down / nose up
 *   A / D          bank left / right (rudder on the ground)
 *   SPACE          wheel brakes            E       get out (stopped, on the ground)
 *
 * Rotation lives in `object.rotation` (order YXZ): y = heading,
 * x = -pitch (nose up = negative x), z = roll. Multiplayer sends heading +
 * [x, z] like every other vehicle, so remote planes bank and climb too.
 */
const G = 9.8;
const TAKEOFF = 19; // m/s: wings start carrying the weight
const STALL = 13;
const MAX_ALT = 420;

export class Aircraft extends Vehicle {
  constructor(system, cfg) {
    super(system, cfg);
    this.kind = 'air';
    this.throttle = 0;
    this.pitch = 0;
    this.roll = 0;
    this.vy = 0; // sink rate when not enough lift
    this.onGround = true;
    this.crashed = false;
    this.home = null;
  }

  build() {
    this.prop = this.model.getObjectByName('prop');
    if (this.prop) this.prop.material = this.prop.material?.clone?.() ?? this.prop.material;
  }

  park(sceneName, spawn) {
    super.park(sceneName, spawn);
    this.home ??= { sceneName, position: spawn.position.clone(), yaw: spawn.yaw };
    this.throttle = 0;
    this.pitch = this.roll = this.vy = 0;
    this.onGround = true;
    this.object.rotation.set(0, this.heading, 0);
  }

  get altitude() {
    const s = this.game.scene;
    const p = this.object.position;
    return p.y - Math.max(s.groundHeight(p.x, p.z), s.waterHeight?.(p.x, p.z) ?? -1e9);
  }

  onEnter() {
    super.onEnter();
    this.game.hud.toast('SHIFT throttle up · CTRL down · W/S nose down/up · A/D bank · SPACE brakes · E get out', 7000);
  }

  onExit() {
    super.onExit();
    this.throttle = 0;
    this.game.farBoost = 0;
  }

  exitPoint() {
    if (!this.onGround || Math.abs(this.speed) > 2) return null;
    return super.exitPoint();
  }

  simulate(dt, scene, input) {
    const g = this.game;
    const k = g.input;
    const o = this.object;
    const flying = !!input;

    // ---- controls ---------------------------------------------------------------
    let pitchIn = 0;
    let rollIn = 0;
    let brake = false;
    if (flying) {
      if (k.down('ShiftLeft') || k.down('ShiftRight')) this.throttle = Math.min(1, this.throttle + dt * 0.5);
      if (k.down('ControlLeft') || k.down('ControlRight')) this.throttle = Math.max(0, this.throttle - dt * 0.6);
      pitchIn = k.axis('KeyW', 'KeyS'); // S = pull up
      rollIn = -input.steer; // D = bank right
      brake = input.handbrake;
    } else this.throttle = Math.max(0, this.throttle - dt * 0.3);

    // ---- airspeed ----------------------------------------------------------------
    const thrust = this.throttle * (this.onGround ? 11 : 9);
    const drag = 0.0042 * this.speed * this.speed + (this.onGround ? 0.6 + (brake ? 7 : 0) : 0.15);
    this.speed += (thrust - drag * Math.sign(this.speed || 1) - (this.onGround ? 0 : G * Math.sin(this.pitch))) * dt;
    if (this.onGround && this.speed < 0.05 && thrust === 0) this.speed = Math.max(0, this.speed);
    this.speed = THREE.MathUtils.clamp(this.speed, -2, 62);
    const lift = THREE.MathUtils.clamp((this.speed - STALL) / (TAKEOFF - STALL), 0, 1);

    // ---- attitude ------------------------------------------------------------------
    if (this.onGround) {
      // taxi: steer with the tail wheel, lift the nose once there's airspeed
      this.heading += rollIn * -0.9 * dt * THREE.MathUtils.clamp(this.speed / 8, -1, 1);
      this.roll = THREE.MathUtils.damp(this.roll, 0, 6, dt);
      const maxNose = lift > 0.5 ? 0.35 : 0;
      this.pitch = THREE.MathUtils.clamp(this.pitch + pitchIn * 1.2 * dt, 0, maxNose);
      // rotate → airborne (she lifts off by herself at full speed, or sooner if you pull back)
      if (lift >= 1 && (this.pitch > 0.05 || this.speed > TAKEOFF + 6)) {
        this.onGround = false;
        this.pitch = Math.max(this.pitch, 0.12);
      }
    } else {
      const auth = 0.35 + 0.65 * lift;
      this.pitch += pitchIn * 0.55 * auth * dt;
      if (!pitchIn) this.pitch = THREE.MathUtils.damp(this.pitch, 0, 0.25, dt);
      this.roll += rollIn * 1.3 * dt;
      if (!rollIn) this.roll = THREE.MathUtils.damp(this.roll, 0, 0.8, dt); // she wants to fly level
      this.roll = THREE.MathUtils.clamp(this.roll, -1.0, 1.0);
      // stall: the nose falls and you sink until airspeed comes back
      if (lift < 1) this.pitch = THREE.MathUtils.damp(this.pitch, -0.35, (1 - lift) * 1.6, dt);
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.0, 0.8);
      this.heading -= (G * Math.tan(this.roll) / Math.max(this.speed, 14)) * dt * (0.4 + 0.6 * lift);
      this.vy = lift < 1 ? this.vy - G * (1 - lift) * dt : THREE.MathUtils.damp(this.vy, 0, 2, dt);
    }

    // ---- move ------------------------------------------------------------------------
    const cp = Math.cos(this.pitch);
    const fwd = _f.set(Math.sin(this.heading) * cp, Math.sin(this.pitch), Math.cos(this.heading) * cp);
    if (this.onGround) fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    o.position.addScaledVector(fwd, this.speed * dt);
    if (!this.onGround) o.position.y += this.vy * dt;
    this.vel.set(fwd.x * this.speed, fwd.z * this.speed);

    // keep inside the map (and under the clouds)
    const lim = 470;
    if (Math.abs(o.position.x) > lim || Math.abs(o.position.z) > lim) {
      o.position.x = THREE.MathUtils.clamp(o.position.x, -lim, lim);
      o.position.z = THREE.MathUtils.clamp(o.position.z, -lim, lim);
      this.heading += Math.PI * dt * 0.6;
      if (flying && !this._edgeT) g.hud.toast('Nothing out there but fog. Turning back.', 2500);
      this._edgeT = 3;
    }
    this._edgeT = Math.max(0, (this._edgeT ?? 0) - dt);
    if (o.position.y > MAX_ALT) {
      o.position.y = MAX_ALT;
      this.pitch = Math.min(this.pitch, 0);
    }

    // ---- ground contact -----------------------------------------------------------------
    const p = o.position;
    const ground = scene.groundHeight(p.x, p.z);
    const water = scene.waterHeight?.(p.x, p.z);
    const floor = Math.max(ground, water ?? -1e9);
    if (p.y <= floor + 0.02) {
      if (!this.onGround) {
        const sink = -(fwd.y * this.speed + this.vy);
        const hard = sink > 7 || Math.abs(this.roll) > 0.45 || this.pitch < -0.2 || (water != null && water >= ground);
        if (hard && flying) return this.#crash(water != null && water >= ground);
        this.onGround = true;
        this.vy = 0;
        if (flying) g.hud.toast(sink < 2.5 ? 'Greaser. Smooth as butter.' : 'Thump. You’re down.', 2500);
      }
      p.y = floor;
      if (water != null && water >= ground && flying) return this.#crash(true);
    } else if (this.onGround && p.y > floor + 0.5) this.onGround = false; // rolled off an edge
    else if (this.onGround) p.y = floor;

    // trees, buildings: only the solid bits, not the terrain
    if (flying && this.speed > 8) {
      _seg.start.copy(p).addScaledVector(fwd, 3.5).y += 1.6;
      _seg.end.copy(_seg.start).addScaledVector(fwd, 1);
      _b.copy(_seg.start);
      if (scene.collideCapsule(_seg, 0.9, { terrain: false }) && _seg.start.distanceTo(_b) > 0.05) return this.#crash(false);
    }

    o.rotation.set(-this.pitch, this.heading, this.roll, 'YXZ');

    // ---- prop, sound, view distance -------------------------------------------------------
    if (this.prop) this.prop.rotation.z += dt * (8 + this.throttle * 60);
    if (flying) {
      const alt = this.altitude;
      g.farBoost = THREE.MathUtils.damp(g.farBoost ?? 0, THREE.MathUtils.clamp(alt * 1.4, 0, 230), 1.5, dt);
      if (this.engine) this.engine.setRPM(0.25 + this.throttle * 0.75);
    }
  }

  /** Too hard, too steep, or into the water: boom, then the plane is back at the airfield. */
  #crash(water) {
    const g = this.game;
    if (this.crashed) return;
    this.crashed = true;
    const at = this.object.position.clone();
    if (water) g.vehicles.fx?.splash?.(at);
    else g.fireworks?.burst?.(at.clone().add(new THREE.Vector3(0, 1, 0)), 'palm');
    g.audio.oneShot('shotgun', { volume: 1, rate: 0.5 });
    g.hud.toast(water ? 'Into the sea. You swim out, coughing. The plane gets towed back…' : 'CRASH. You climb out, somehow fine. The plane gets dragged back to the airfield…', 5000);
    this.speed = 0;
    this.throttle = 0;
    g.vehicles.active = null;
    this.onExit();
    g.player.enabled = true;
    g.fade?.classList.add('on');
    setTimeout(() => g.fade?.classList.remove('on'), 1200);
    g.player.spawn(g.scene.spawns.airfield ?? g.scene.spawns.default);
    const h = this.home;
    this.park(h.sceneName, { position: h.position, yaw: h.yaw });
    this.crashed = false;
  }

  /** Cockpit view: the camera banks and climbs with the plane. */
  applyCamera(cam, delta, sens) {
    super.applyCamera(cam, delta, sens);
    cam.position.y += Math.sin(this.game.time * 40) * 0.004 * this.throttle;
  }
}

const _f = new THREE.Vector3();
const _seg = new THREE.Line3(new THREE.Vector3(), new THREE.Vector3());
const _b = new THREE.Vector3();
