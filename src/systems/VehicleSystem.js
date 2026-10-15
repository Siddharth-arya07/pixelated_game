import * as THREE from 'three';
import { buildTruckCab } from '../vehicles/TruckCab.js';
import { GroundVehicle } from '../vehicles/GroundVehicle.js';
import { Watercraft } from '../vehicles/Watercraft.js';

/**
 * VehicleSystem
 * -------------
 * Owns every vehicle (truck, bike, fishing boat, jet ski), which one you're
 * driving, getting in/out, the always-first-person driving camera, and the
 * water particle effects (wake, spray, splashes).
 *
 * Controls while driving: W/S throttle/brake+reverse, A/D steer,
 * SPACE handbrake, F lights (land), mouse to look around, E get out.
 */

// Grip per surface: drive = share of engine power that reaches the ground,
// lateral = how fast sideways sliding dies, turn = steering authority,
// rolling = rolling resistance (m/s²).
const TRUCK_GRIP = {
  asphalt: { drive: 1, lateral: 9, turn: 1, rolling: 0.35 },
  gravel: { drive: 0.8, lateral: 3, turn: 0.85, rolling: 0.6 },
  grass: { drive: 0.6, lateral: 2.6, turn: 0.8, rolling: 1.1 },
  sand: { drive: 0.4, lateral: 2, turn: 0.7, rolling: 2.2 },
  rock: { drive: 0.45, lateral: 1.6, turn: 0.7, rolling: 0.9 },
};
const BIKE_GRIP = {
  asphalt: { drive: 1, lateral: 10, turn: 1.15, rolling: 0.3 },
  gravel: { drive: 0.6, lateral: 2.4, turn: 0.9, rolling: 0.6 },
  grass: { drive: 0.55, lateral: 2.2, turn: 0.9, rolling: 1.0 },
  sand: { drive: 0.35, lateral: 1.6, turn: 0.8, rolling: 2.5 },
  rock: { drive: 0.4, lateral: 1.5, turn: 0.8, rolling: 0.9 },
};

export const VEHICLES = [
  {
    id: 'truck',
    type: GroundVehicle,
    model: 'pickup_truck',
    label: 'truck',
    prompt: 'Get in the truck',
    // Old, heavy, tired: tops out around 27 mph and crawls up the mountain.
    maxSpeed: 12,
    maxReverse: 3.5,
    power: 3.6,
    brake: 7,
    steerMax: 0.55,
    steerSpeed: 2.2,
    wheelBase: 3.2,
    track: 1.8,
    wheelRadius: 0.42,
    grip: TRUCK_GRIP,
    wheelNodes: ['FrontWheel_L', 'FrontWheel_R', 'BackWheels'],
    seat: new THREE.Vector3(0.43, 1.6, 0.02),
    passengers: [new THREE.Vector3(-0.43, 1.6, 0.02), new THREE.Vector3(-0.55, 1.95, -1.45), new THREE.Vector3(0.55, 1.95, -1.45)],
    engine: { base: 0, range: 0.9 },
    buildExtras: buildTruckCab,
    animate: (v) => v.steeringWheel && (v.steeringWheel.rotation.z = v.steer * 2.6),
    onHeadlights: swapHeadlightMaterial,
  },
  {
    id: 'bike',
    type: GroundVehicle,
    model: 'bike',
    label: 'bike',
    prompt: 'Get on the bike',
    maxSpeed: 22,
    maxReverse: 2,
    power: 6,
    brake: 9,
    steerMax: 0.5,
    steerSpeed: 4,
    wheelBase: 1.5,
    track: 0.35,
    lean: 0.5,
    kickstand: 0.12,
    grip: BIKE_GRIP,
    seat: new THREE.Vector3(0, 1.32, -0.15),
    passengers: [new THREE.Vector3(0, 1.45, -0.72)],
    engine: { base: 0.5, range: 1.6 },
    lookLimit: 2.2,
  },
  {
    id: 'skateboard',
    type: GroundVehicle,
    model: 'skateboard',
    label: 'skateboard',
    prompt: 'Ride the skateboard',
    // Push with W (each push is a kick), carve with A/D, SPACE = ollie.
    maxSpeed: 9.5,
    maxReverse: 0.5,
    power: 3.2,
    brake: 3.2,
    steerMax: 0.5,
    steerSpeed: 3.2,
    wheelBase: 0.55,
    track: 0.2,
    lean: 0.35,
    ollie: 3.4, // ~0.6 m pop
    grip: {
      asphalt: { drive: 1, lateral: 7, turn: 1, rolling: 0.12 },
      gravel: { drive: 0.35, lateral: 3, turn: 0.6, rolling: 2.4 },
      grass: { drive: 0.5, lateral: 3, turn: 0.6, rolling: 0.8 }, // slow going, but it rolls
      sand: { drive: 0.3, lateral: 2, turn: 0.4, rolling: 1.2 },
      rock: { drive: 0.4, lateral: 3, turn: 0.6, rolling: 1.5 },
    },
    seat: new THREE.Vector3(0, 1.68, -0.05), // standing on it
    engine: { key: 'skate_roll', base: 0, range: 1, volume: 0.6 },
    lookLimit: 2.6,
    animate: (v, dt) => {
      // kick-push sound in rhythm while you hold W and aren't at full speed
      const g = v.game;
      if (g.vehicle.active !== v) return;
      v._kick = (v._kick ?? 0) - dt;
      if (g.input.down('KeyW') && !v.airborne && Math.abs(v.speed) < v.cfg.maxSpeed * 0.9 && v._kick <= 0) {
        v._kick = 0.75;
        g.audio.oneShot('kick', { volume: 0.5 });
      }
    },
  },
  {
    id: 'boat',
    type: Watercraft,
    model: 'fishing_boat',
    modelRotY: Math.PI / 2, // modelled along X
    label: 'fishing boat',
    prompt: 'Board the fishing boat',
    maxSpeed: 7,
    thrust: 1.6,
    reverse: 0.8,
    drag: 0.02,
    turn: 0.45,
    lateral: 1.5,
    draft: 0.75,
    length: 8,
    beam: 2.6,
    bob: { k: 14, damp: 4 },
    seat: new THREE.Vector3(0, 2.6, -0.4),
    passengers: [new THREE.Vector3(1.0, 2.6, -1.4), new THREE.Vector3(-1.0, 2.6, -1.4), new THREE.Vector3(0, 2.6, -2.7)],
    lightAt: new THREE.Vector3(0, 4.5, 0.5),
    lightColor: 0xffe0b0,
    alwaysLit: true,
    engine: { base: 0, range: 0.7 },
    interactRange: 5,
  },
  {
    id: 'jetski',
    type: Watercraft,
    model: 'jetski',
    label: 'jet ski',
    prompt: 'Get on the jet ski',
    maxSpeed: 19,
    thrust: 7,
    reverse: 1.5,
    drag: 0.012,
    turn: 1.6,
    lateral: 2.2,
    draft: 0.28,
    length: 2.8,
    beam: 1.1,
    bob: { k: 30, damp: 6 },
    airborne: true,
    lean: 0.45,
    seat: new THREE.Vector3(0, 1.45, -0.35),
    passengers: [new THREE.Vector3(0, 1.55, -0.95)],
    lightAt: new THREE.Vector3(0, 1.1, 1.3),
    lightRange: 6,
    engine: { base: 0.8, range: 2.0 },
  },
];

export class VehicleSystem {
  constructor(game) {
    this.game = game;
    this.vehicles = [];
    this.active = null;
    this.moorings = []; // { scene, position } where you can step off a boat
    this.fx = null;
  }

  init() {
    for (const cfg of VEHICLES) {
      const v = new cfg.type(this, cfg);
      v.init();
      this.vehicles.push(v);
    }
    this.fx = new WaterFX(this.game);
  }

  get(id) {
    return this.vehicles.find((v) => v.id === id);
  }

  get driving() {
    return !!this.active;
  }

  get speed() {
    return this.active?.speed ?? 0;
  }

  get object() {
    return this.active?.object ?? null;
  }

  addMooring(scene, position) {
    this.moorings.push({ scene, position: position.clone() });
  }

  onSceneEnter(scene) {
    for (const v of this.vehicles) {
      v.detach();
      if (v.sceneName === scene.name) v.attach(scene);
    }
    this.fx.attach(scene);
  }

  /** Bring the vehicle you're driving into another scene (road triggers). */
  carryActive(sceneName, spawn) {
    if (!this.active || !spawn) return false;
    this.active.park(sceneName, spawn);
    return true;
  }

  enter(v) {
    if (this.active) return;
    if (v.remoteDriver) return this.game.mp?.rideAlong(v);
    const g = this.game;
    this.active = v;
    g.player.enabled = false;
    v.onEnter();
    g.audio.oneShot('door', { volume: 0.6 });
  }

  exit() {
    const v = this.active;
    if (!v) return;
    const g = this.game;
    if (Math.abs(v.speed) > 2) return g.hud.toast('Slow down first.');
    const pt = v.exitPoint();
    if (!pt) return g.hud.toast('Get closer to the dock.');
    v.onExit();
    this.active = null;
    g.audio.oneShot('door', { volume: 0.6 });
    const scene = g.scene;
    const y = Math.max(pt.y ?? 0, scene.groundHeight(pt.x, pt.z));
    // Face the way the vehicle faces (camera looks down -Z).
    g.player.spawn({ position: new THREE.Vector3(pt.x, y, pt.z), yaw: Math.atan2(-v.forward.x, -v.forward.z) });
    g.player.enabled = true;
  }

  update(dt, scene) {
    const g = this.game;
    const input = g.input;
    let drive = null;
    const v = this.active;
    if (v) {
      if (input.pressed('KeyE')) {
        input.consume('KeyE');
        this.exit();
      }
      if (v.kind === 'ground' && input.pressed('KeyF')) v.setHeadlights(!v.headlightsOn);
      if (v.radioToggle && input.pressed('KeyQ')) v.radioToggle();
      if (v.radioNext && input.pressed('KeyN')) v.radioNext();
      v.cabUpdate?.(dt);
      if (this.active) drive = { throttle: input.axis('KeyS', 'KeyW'), steer: input.axis('KeyD', 'KeyA'), handbrake: input.down('Space') };
    }
    for (const veh of this.vehicles) {
      if (veh.sceneName !== scene.name) continue;
      if (veh.remoteDriver) continue; // someone else is driving: their state moves it
      // Parked land vehicles settle then sleep; boats always bob.
      if (veh !== this.active && veh.kind === 'ground' && veh._settled) continue;
      veh.update(dt, scene, veh === this.active ? drive : null);
      if (veh === this.active || veh.kind !== 'ground') veh._settleT = 0;
      else veh._settled = (veh._settleT = (veh._settleT ?? 0) + dt) > 1.5;
    }
    this.fx.update(dt);
  }

  /** Wake any parked vehicle (e.g. after it was moved). */
  wake(v) {
    v._settled = false;
    v._settleT = 0;
  }

  /** Always first person while driving. */
  applyCamera(dt) {
    const g = this.game;
    const delta = g.input.locked ? g.input.consumeMouseDelta() : { x: 0, y: 0 };
    const cam = g.camera;
    this.active.applyCamera(cam, delta, g.mouseSensitivity);
    const shake = cam.userData.shake ?? 0;
    if (shake > 0) {
      cam.position.x += (Math.random() - 0.5) * shake;
      cam.position.y += (Math.random() - 0.5) * shake;
      cam.userData.shake = Math.max(0, shake - dt);
    }
  }

  activeLights(scene) {
    const out = [];
    for (const v of this.vehicles) if (v.sceneName === scene.name) out.push(...v.lights);
    return out;
  }
}

// -----------------------------------------------------------------------------
// Vehicle extras
// -----------------------------------------------------------------------------

function swapHeadlightMaterial(v, on) {
  const r = v.game.renderer;
  if (!v._headSlots) {
    v._headSlots = [];
    v.model.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m, index) => m?.name === 'Headlights' && v._headSlots.push({ mesh: o, index, off: m }));
    });
    v._headOn = r.material({ color: 0xfff4c8, unlit: true });
  }
  for (const s of v._headSlots) {
    const mat = on ? v._headOn : s.off;
    if (Array.isArray(s.mesh.material)) {
      s.mesh.material = s.mesh.material.slice();
      s.mesh.material[s.index] = mat;
    } else s.mesh.material = mat;
  }
}

// -----------------------------------------------------------------------------
// Water particles: wake foam, spray, landing splashes
// -----------------------------------------------------------------------------

class WaterFX {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.parts = [];
    const r = game.renderer;
    const foamGeo = new THREE.PlaneGeometry(1, 1);
    foamGeo.rotateX(-Math.PI / 2);
    const dropGeo = new THREE.PlaneGeometry(0.18, 0.18);
    for (let i = 0; i < 90; i++) {
      const flat = i < 60;
      const m = r.material({ color: 0xdfe8ee, unlit: true, opacity: 0.6, doubleSide: true, depthWrite: false });
      const mesh = new THREE.Mesh(flat ? foamGeo : dropGeo, m);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.userData = { flat, life: 0, max: 1, vel: new THREE.Vector3(), size: 1, grow: 1 };
      this.root.add(mesh);
      this.parts.push(mesh);
    }
  }

  attach(scene) {
    scene.root.add(this.root);
  }

  #take(flat) {
    return this.parts.find((p) => !p.visible && p.userData.flat === flat);
  }

  foam(pos, size, life) {
    const p = this.#take(true);
    if (!p) return;
    p.position.copy(pos);
    Object.assign(p.userData, { life: 0, max: life, size, grow: 1.8 });
    p.rotation.y = Math.random() * 6;
    p.visible = true;
  }

  spray(pos, vel) {
    const p = this.#take(false);
    if (!p) return;
    p.position.copy(pos);
    p.userData.vel.copy(vel);
    Object.assign(p.userData, { life: 0, max: 0.9, size: 1, grow: 0.5 });
    p.visible = true;
  }

  splash(pos) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.spray(pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6)), new THREE.Vector3(Math.cos(a) * 2, 3 + Math.random() * 2, Math.sin(a) * 2));
    }
    this.foam(pos, 2.5, 2);
  }

  update(dt) {
    const cam = this.game.camera;
    const water = this.game.renderer.water;
    for (const p of this.parts) {
      if (!p.visible) continue;
      const u = p.userData;
      u.life += dt;
      const k = u.life / u.max;
      if (k >= 1) {
        p.visible = false;
        continue;
      }
      if (u.flat) {
        p.position.y = water.height(p.position.x, p.position.z) + 0.04;
        p.scale.setScalar(u.size * (1 + k * u.grow));
      } else {
        u.vel.y -= 9.81 * dt;
        p.position.addScaledVector(u.vel, dt);
        p.quaternion.copy(cam.quaternion);
        p.scale.setScalar(u.size * (1 + k * u.grow));
      }
      p.material.uniforms.uOpacity.value = 0.6 * (1 - k);
    }
  }
}
