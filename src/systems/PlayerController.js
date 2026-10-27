import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * PlayerController
 * ----------------
 * First-person WASD + mouse-look with a capsule collider resolved against the
 * active scene's BVH (three-mesh-bvh), plus simple "dynamic obstacles" (the
 * truck) handled as oriented boxes.
 *
 * `position` is the centre of the capsule's bottom sphere, so the feet are at
 * position.y - radius.
 */
export class PlayerController {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.input = game.input;
    const p = CONFIG.player;
    this.radius = p.radius;
    this.segmentLength = p.height - p.radius * 2;
    this.position = new THREE.Vector3(0, p.radius, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.pitchOffset = 0; // animated head tilt (drinking, smoking)
    this.onGround = false;
    this.enabled = true; // false while driving
    this.movementLocked = false; // true while fishing / in menus
    this.speedBoost = 0; // seconds of energy-drink sprint left
    this.stepTimer = 0;
    this.headBob = 0;
    this.dynamicObstacles = []; // [{ pushOut(position, radius) }]
    this._segment = new THREE.Line3();
    this._old = new THREE.Vector3();
  }

  /** Teleport to a spawn point. */
  spawn({ position, yaw, pitch = 0 }) {
    this.position.set(position.x, position.y + this.radius, position.z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = pitch;
  }

  /** Mouse look — also used by the vehicle FPV camera. */
  look(delta, clampYaw = null) {
    const s = this.game.mouseSensitivity;
    this.yaw -= delta.x * s;
    this.pitch -= delta.y * s;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    if (clampYaw) this.yaw = THREE.MathUtils.clamp(this.yaw, clampYaw[0], clampYaw[1]);
  }

  /**
   * Sit down. seat = { eye: Vector3 (camera position), yaw, pitch?,
   *   yawLimit?, standAt: Vector3, onStand? }
   */
  sit(seat) {
    this.seat = seat;
    this.yaw = seat.yaw;
    this.pitch = seat.pitch ?? -0.05;
    this.velocity.set(0, 0, 0);
    this.game.audio.oneShot('door', { volume: 0.25, rate: 0.7 });
  }

  stand() {
    const s = this.seat;
    if (!s) return;
    this.seat = null;
    this.position.set(s.standAt.x, s.standAt.y + this.radius, s.standAt.z);
    this.velocity.set(0, 0, 0);
    s.onStand?.();
  }

  get seated() {
    return !!this.seat;
  }

  update(dt, scene) {
    if (!this.enabled) return;
    if (this.seat) {
      // Seated: look around (limited), no walking.
      if (this.game.input.locked) this.look(this.game.input.consumeMouseDelta());
      const lim = this.seat.yawLimit ?? 1.3;
      const d = THREE.MathUtils.euclideanModulo(this.yaw - this.seat.yaw + Math.PI, Math.PI * 2) - Math.PI;
      this.yaw = this.seat.yaw + THREE.MathUtils.clamp(d, -lim, lim);
      return;
    }
    const input = this.input;
    const cfg = CONFIG.player;
    if (input.locked) this.look(input.consumeMouseDelta());

    // ---- desired horizontal velocity --------------------------------------
    let fx = 0;
    let fz = 0;
    if (!this.movementLocked) {
      fz = input.axis('KeyS', 'KeyW');
      fx = input.axis('KeyA', 'KeyD');
    }
    const sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    this.speedBoost = Math.max(0, this.speedBoost - dt);
    let speed = sprinting ? cfg.sprintSpeed : cfg.walkSpeed;
    if (this.speedBoost > 0) speed *= 1.35;
    if (this.game.hunger?.weak) speed *= 0.72; // starving: legs like lead

    const forward = _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = _v3.set(0, 0, 0).addScaledVector(forward, fz).addScaledVector(right, fx);
    if (wish.lengthSq() > 1) wish.normalize();
    // Drunk: you drift sideways while walking.
    const drunk = this.game.inventory.drunk;
    if (drunk > 0 && wish.lengthSq() > 0) wish.addScaledVector(right, Math.sin(this.game.time * 0.9) * drunk * 0.55);
    wish.multiplyScalar(speed);

    // Snappy accel on the ground, floaty in the air.
    const accel = this.onGround ? 14 : 3;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, wish.x, accel, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, wish.z, accel, dt);

    if (this.onGround && !this.movementLocked && input.pressed('Space')) this.velocity.y = cfg.jumpSpeed;
    this.velocity.y += cfg.gravity * dt;
    if (this.onGround && this.velocity.y < 0) this.velocity.y = Math.max(this.velocity.y, -2);

    // ---- integrate + collide (sub-stepped to avoid tunnelling) ------------
    const steps = 3;
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) this.#step(sdt, scene);

    // ---- footsteps + head bob --------------------------------------------
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && hSpeed > 0.5) {
      this.headBob += dt * hSpeed * 2.2;
      this.stepTimer -= dt * hSpeed;
      if (this.stepTimer <= 0) {
        this.stepTimer = 1.6;
        const n = 1 + Math.floor(Math.random() * 4);
        this.game.audio.oneShot(`footstep_${n}`, { volume: 0.35, rate: 0.9 + Math.random() * 0.2 });
      }
    }

    // Kill-plane safety net.
    if (this.position.y < (scene.killY ?? -20)) this.game.respawn();
  }

  #step(dt, scene) {
    this._old.copy(this.position);
    this.position.addScaledVector(this.velocity, dt);

    const seg = this._segment;
    seg.start.copy(this.position);
    seg.end.copy(this.position).y += this.segmentLength;
    scene.collideCapsule(seg, this.radius);
    // Scenes can forbid walking somewhere (e.g. into the sea).
    if (scene.blocksWalk?.(seg.start.x, seg.start.z, seg.start.y - this.radius)) {
      seg.start.x = this._old.x;
      seg.start.z = this._old.z;
      seg.end.x = this._old.x;
      seg.end.z = this._old.z;
    }
    for (const ob of this.dynamicObstacles) ob.pushOut(seg, this.radius);

    // Resolve: how far did the collider push us, and was it "up" (ground)?
    const delta = _v4.copy(seg.start).sub(this.position);
    this.onGround = delta.y > Math.abs(dt * this.velocity.y * 0.25);
    const offset = Math.max(0, delta.length() - 1e-5);
    delta.normalize().multiplyScalar(offset);
    this.position.add(delta);

    if (this.onGround) this.velocity.y = 0;
    else if (offset > 0) {
      // Slide along walls/ceilings: remove velocity into the surface.
      delta.normalize();
      this.velocity.addScaledVector(delta, -delta.dot(this.velocity));
    }
  }

  /** Put the camera at eye height with a touch of PS1-era head bob. */
  applyCamera() {
    if (this.seat) {
      this.camera.position.copy(this.seat.eye);
      this.camera.rotation.set(this.pitch + this.pitchOffset, this.yaw, 0, 'YXZ');
      return;
    }
    const eye = (this.game.scene?.eyeHeight ?? CONFIG.player.eyeHeight) - this.radius;
    const bob = Math.sin(this.headBob) * 0.014;
    this.camera.position.set(this.position.x, this.position.y + eye + bob, this.position.z);
    this.camera.rotation.set(this.pitch + this.pitchOffset, this.yaw, 0, 'YXZ');
  }

  /** Feet position (for triggers). */
  get feet() {
    return _feet.set(this.position.x, this.position.y - this.radius, this.position.z);
  }
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _feet = new THREE.Vector3();
