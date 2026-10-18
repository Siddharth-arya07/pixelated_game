import * as THREE from 'three';
import { prop } from '../scenes/Props.js';

/**
 * Vehicle (base)
 * --------------
 * Shared by the truck, bike, fishing boat and jet ski:
 *  - lives in exactly one scene (`sceneName`), attached when it's active
 *  - interactable ("Get in"), oriented-box obstacle for the player on foot
 *  - first-person camera at `cfg.seat` with free look (always FPV)
 *  - engine sound with per-vehicle voice, point lights (headlights etc.)
 *
 * Subclasses implement `simulate(dt, scene, input)` (input is null when
 * nobody is driving — boats still bob on the waves).
 */
export class Vehicle {
  constructor(system, cfg) {
    this.system = system;
    this.game = system.game;
    this.cfg = cfg;
    this.id = cfg.id;
    this.label = cfg.label;
    this.kind = cfg.kind; // 'ground' | 'water'
    this.sceneName = cfg.scene ?? 'World';
    this.heading = 0;
    this.speed = 0; // signed, along the heading (m/s)
    this.vel = new THREE.Vector2(); // world-space x/z velocity
    this.driving = false;
    this.lights = [];
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.engine = null;
    this._attached = null;
  }

  /** Build `this.object` (GLB or procedural) + extras. */
  init() {
    const ctx = { r: this.game.renderer, assets: this.game.assets };
    const model = prop(ctx, this.cfg.model);
    if (this.cfg.modelRotY) model.rotation.y = this.cfg.modelRotY;
    if (this.cfg.modelScale) model.scale.setScalar(this.cfg.modelScale);
    this.model = model;
    // `object` = yaw/pitch/roll root; the model sits inside so it can be offset.
    this.object = new THREE.Group();
    this.object.name = this.id;
    this.object.add(model);
    this.object.rotation.order = 'YXZ';
    this.half = this.cfg.half ?? this.#measureHalfExtents();
    this.obstacle = { pushOut: (seg, r) => this.#pushOut(seg, r) };
    this.build?.();
  }

  #measureHalfExtents() {
    this.object.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(this.model);
    const s = b.getSize(new THREE.Vector3());
    return new THREE.Vector3(s.x / 2, s.y, s.z / 2);
  }

  get position() {
    return this.object.position;
  }

  get forward() {
    return _fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  /** Left of the vehicle (+X in its local frame). */
  get left() {
    return _left.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
  }

  park(sceneName, { position, yaw }) {
    this.sceneName = sceneName;
    this.heading = yaw ?? 0;
    this.speed = 0;
    this.vel.set(0, 0);
    this.object.position.set(position.x, position.y ?? 0, position.z);
    this.object.rotation.set(0, this.heading, 0);
    this.onPark?.();
  }

  // ---------------------------------------------------------------------------
  // Scene attachment
  // ---------------------------------------------------------------------------

  attach(scene) {
    scene.root.add(this.object);
    scene.addInteractable(this.object, {
      prompt: () => (this.remoteDriver ? `Ride along with ${this.remoteName}` : this.cfg.prompt ?? `Get on the ${this.label}`),
      available: () => (this.remoteDriver && !(this.cfg.passengers ?? []).length ? `${this.remoteName}'s ${this.label}` : true),
      range: this.cfg.interactRange ?? 3.5,
      action: () => this.system.enter(this),
      secondary: () => (this.cfg.secondary && !this.remoteDriver ? this.cfg.secondary(this) : null),
      enabled: () => !this.driving && !this.system.active && !this.game.mp?.ride,
    });
    this.game.player.dynamicObstacles.push(this.obstacle);
    this._attached = scene;
  }

  detach() {
    const s = this._attached;
    if (!s) return;
    s.root.remove(this.object);
    s.interactables = s.interactables.filter((o) => o !== this.object);
    const obs = this.game.player.dynamicObstacles;
    const i = obs.indexOf(this.obstacle);
    if (i >= 0) obs.splice(i, 1);
    this._attached = null;
  }

  // ---------------------------------------------------------------------------
  // Driving
  // ---------------------------------------------------------------------------

  onEnter() {
    this.driving = true;
    this.lookYaw = 0;
    this.lookPitch = -0.05;
    const v = this.cfg.engine ?? {};
    this.engine = this.game.audio.engine(this.object, v);
  }

  onExit() {
    this.driving = false;
    this.engine?.stop();
    this.engine = null;
  }

  /** Where the player ends up when getting out (null = can't get out here). */
  exitPoint() {
    return this.position.clone().addScaledVector(this.left, this.half.x + 0.7);
  }

  update(dt, scene, input) {
    this.simulate(dt, scene, input);
    this.object.updateMatrixWorld();
    this.updateLights?.();
    if (this.engine) this.engine.setRPM(Math.min(1, Math.abs(this.speed) / this.cfg.maxSpeed + (input?.throttle ? 0.12 : 0)));
  }

  /** First-person camera: seat offset in vehicle space + free look. */
  applyCamera(cam, delta, sens) {
    const lim = this.cfg.lookLimit ?? 1.9;
    this.lookYaw = THREE.MathUtils.clamp(this.lookYaw - delta.x * sens, -lim, lim);
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - delta.y * sens, -0.9, 0.7);
    cam.position.copy(this.cfg.seat).applyMatrix4(this.object.matrixWorld);
    _q.setFromEuler(_e.set(this.lookPitch, Math.PI + this.lookYaw, 0, 'YXZ'));
    cam.quaternion.copy(this.object.quaternion).multiply(_q);
  }

  /** Keep a capsule out of the vehicle's oriented box (x/z only). */
  #pushOut(seg, r) {
    if (!this.object.parent || this.driving) return;
    const p = this.position;
    if (seg.start.y - r > p.y + this.half.y + 0.2 || seg.end.y + r < p.y) return;
    const lx0 = seg.start.x - p.x;
    const lz0 = seg.start.z - p.z;
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    const lx = lx0 * c - lz0 * s;
    const lz = lx0 * s + lz0 * c;
    const hx = this.half.x + r;
    const hz = this.half.z + r;
    if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) return;
    const px = hx - Math.abs(lx);
    const pz = hz - Math.abs(lz);
    let dx = 0;
    let dz = 0;
    if (px < pz) dx = Math.sign(lx) * px;
    else dz = Math.sign(lz) * pz;
    const wx = dx * c + dz * s;
    const wz = -dx * s + dz * c;
    seg.start.x += wx;
    seg.start.z += wz;
    seg.end.x += wx;
    seg.end.z += wz;
  }

  /** Capsule vs props (not terrain) along the hull; returns push vector or null. */
  collideProps(scene, height = 1.0) {
    const f = this.forward;
    const seg = _seg;
    const reach = Math.max(0.1, this.half.z - this.half.x * 0.6);
    seg.start.copy(this.position).addScaledVector(f, -reach);
    seg.end.copy(this.position).addScaledVector(f, reach);
    seg.start.y = seg.end.y = this.position.y + height;
    const before = _before.copy(seg.start);
    if (!scene.collideCapsule(seg, this.half.x * 0.95, { terrain: false })) return null;
    return before.sub(seg.start).negate().setY(0);
  }
}

const _fwd = new THREE.Vector3();
const _left = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _seg = new THREE.Line3();
const _before = new THREE.Vector3();
