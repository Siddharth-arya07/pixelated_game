import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { texture } from '../core/Procedural.js';
import { prop } from './Props.js';

/**
 * BaseScene
 * ---------
 * Shared plumbing for House / GroceryStore / Lake / World:
 *  - a THREE.Scene root, built lazily on first visit (`ensureBuilt`)
 *  - static collision: boxes/meshes merged into one BVH (three-mesh-bvh)
 *  - point-light registry (fed to the Renderer's multi-light PSX shader)
 *  - interactables (raycast targets) and trigger volumes
 *  - named spawn points for scene transitions
 *
 * Subclasses implement `build()` and optionally `onEnter()`, `onExit()`, `update()`.
 */
export class BaseScene {
  constructor(game, { name, label, outdoor = false }) {
    this.game = game;
    this.name = name;
    this.label = label ?? name;
    this.outdoor = outdoor;
    this.r = game.renderer;
    this.assets = game.assets;
    this.root = new THREE.Scene();
    this.lights = [];
    this.interactables = [];
    this.triggers = [];
    this.spawns = {};
    this.sounds = [];
    this.updaters = [];
    this.built = false;
    this._colliderGeos = []; // props, walls, buildings
    this._terrainGeos = []; // ground the player walks on (vehicles use heightAt instead)
    this.bvh = null;
    this.terrainBvh = null;
    // Interior defaults (outdoor scenes follow the day/night cycle fully).
    this.indoor = { fog: 0x0c0b12, near: 3, far: 22, ambient: 0x1e1c28, daylight: 0.3 };
  }

  /** Build geometry + collider once. */
  ensureBuilt() {
    if (this.built) return;
    this.build();
    this.root.updateMatrixWorld(true);
    this.#buildCollider();
    this.built = true;
  }

  build() {}
  onEnter(_spawn) {}
  onExit() {}

  update(dt, time) {
    for (const fn of this.updaters) fn(dt, time);
  }

  // ---------------------------------------------------------------------------
  // Building helpers
  // ---------------------------------------------------------------------------

  mat(opts) {
    return this.r.material(opts);
  }

  tex(key, rx = 1, ry = rx) {
    return texture(this.assets, key, rx, ry);
  }

  /** Place a prop (GLB or procedural) and optionally give it a box collider. */
  place(key, { x = 0, y = 0, z = 0, rotY = 0, scale = 1, collide = false, opts, parent } = {}) {
    const obj = prop(this, key, opts);
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    obj.scale.setScalar(scale);
    (parent ?? this.root).add(obj);
    if (collide) this.addColliderFromObject(obj, typeof collide === 'number' ? collide : 0);
    return obj;
  }

  /**
   * Push a placed object flush against a wall.
   * wall: ['n', z] back touches z from the +Z side · ['s', z] from -Z ·
   *       ['w', x] from +X · ['e', x] from -X
   */
  snapToWall(obj, [side, c], gap = 0.02) {
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    if (side === 'n') obj.position.z += c + gap - b.min.z;
    if (side === 's') obj.position.z += c - gap - b.max.z;
    if (side === 'w') obj.position.x += c + gap - b.min.x;
    if (side === 'e') obj.position.x += c - gap - b.max.x;
    obj.updateMatrixWorld(true);
    return obj;
  }

  /** World-space bounds of an object (handy for stacking things on top). */
  bounds(obj) {
    obj.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(obj);
  }

  /** Every mesh slot using a material with this name: [{ mesh, index }]. */
  materialSlots(obj, name) {
    const out = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m, index) => m?.name === name && out.push({ mesh: o, index }));
    });
    return out;
  }

  /** Swap the material in slots returned by materialSlots(). */
  setSlots(slots, material) {
    for (const { mesh, index } of slots) {
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.slice();
        mesh.material[index] = material;
      } else mesh.material = material;
    }
  }

  /**
   * Recolour named materials on one object only (GLB materials are shared
   * across instances, so this clones them). tint(sofa, { carpet: 0x4a4258 })
   */
  tint(obj, colors) {
    for (const [name, hex] of Object.entries(colors)) {
      const slots = this.materialSlots(obj, name);
      if (!slots.length) continue;
      const m = slots[0].mesh.material[slots[0].index] ?? slots[0].mesh.material;
      const c = this.r.cloneMaterial(m);
      c.uniforms.uColor.value.set(hex);
      c.name = name;
      this.setSlots(slots, c);
    }
    return obj;
  }

  /**
   * Instanced scatter of a model: one InstancedMesh per sub-mesh per `cell`
   * metres, so far-away groups get frustum/far-plane culled.
   * items: [{ x, y, z, rotY, scale }]
   */
  scatter(key, items, { cell = 100 } = {}) {
    const tpl = prop(this, key);
    tpl.updateMatrixWorld(true);
    const parts = [];
    tpl.traverse((o) => o.isMesh && parts.push({ geo: o.geometry, mat: o.material, local: o.matrixWorld.clone() }));
    if (!parts.length) return;
    const groups = new Map();
    for (const it of items) {
      const k = `${Math.floor(it.x / cell)},${Math.floor(it.z / cell)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const list of groups.values()) {
      for (const part of parts) {
        const inst = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        list.forEach((it, i) => {
          q.setFromAxisAngle(up, it.rotY ?? 0);
          s.setScalar(it.scale ?? 1);
          p.set(it.x, it.y, it.z);
          m.compose(p, q, s).multiply(part.local);
          inst.setMatrixAt(i, m);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        inst.name = `scatter_${key}`;
        this.root.add(inst);
      }
    }
  }

  /** Play a GLB animation clip by name on a placed model. Returns the action. */
  animate(obj, clipName, { loop = true, timeScale = 1 } = {}) {
    const clips = obj.userData.animations ?? [];
    const clip = THREE.AnimationClip.findByName(clips, clipName);
    if (!clip) return null;
    obj.userData.mixer ??= this.#mixer(obj);
    const action = obj.userData.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.timeScale = timeScale;
    action.reset().play();
    return action;
  }

  #mixer(obj) {
    const mixer = new THREE.AnimationMixer(obj);
    this.updaters.push((dt) => mixer.update(dt));
    return mixer;
  }

  /** Box mesh (centre-positioned) that also collides by default. */
  box(w, h, d, material, x, y, z, { collide = true, rotY = 0, segments } = {}) {
    const geo = segments ? new THREE.BoxGeometry(w, h, d, ...segments) : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.root.add(m);
    if (collide) this.addColliderMesh(m);
    return m;
  }

  /**
   * Horizontal subdivided plane. Subdivision matters: affine texture warping
   * scales with triangle size, so big floors need extra vertices.
   */
  plane(w, d, material, x = 0, y = 0, z = 0, { segs = 8, collide = true, rotY = 0 } = {}) {
    // segs: number, or [x, z] for long thin planes
    const [sx, sz] = Array.isArray(segs) ? segs : [segs, segs];
    const geo = new THREE.PlaneGeometry(w, d, sx, sz);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.root.add(m);
    if (collide) {
      // Floors collide as a thin slab so nothing tunnels through.
      this.addColliderBox(x, y - 0.25, z, w, 0.5, d, rotY);
    }
    return m;
  }

  /**
   * Room shell: floor, ceiling and four walls (inward facing), with optional
   * door gaps. `doors` = [{ wall: 'n'|'s'|'e'|'w', at: offset, width }].
   */
  room({ w, d, h, floorMat, wallMat, ceilMat, doors = [], x = 0, z = 0 }) {
    this.plane(w, d, floorMat, x, 0, z, { segs: Math.ceil(Math.max(w, d) / 1.5) });
    const ceil = this.plane(w, d, ceilMat, x, h, z, { segs: Math.ceil(Math.max(w, d) / 2), collide: false });
    ceil.rotation.x = Math.PI;
    ceil.position.y = h;

    const walls = {
      n: { len: w, cx: x, cz: z - d / 2, rot: 0 },
      s: { len: w, cx: x, cz: z + d / 2, rot: Math.PI },
      w: { len: d, cx: x - w / 2, cz: z, rot: Math.PI / 2 },
      e: { len: d, cx: x + w / 2, cz: z, rot: -Math.PI / 2 },
    };
    for (const [key, wall] of Object.entries(walls)) {
      const gaps = doors.filter((dr) => dr.wall === key).sort((a, b) => a.at - b.at);
      // Split the wall into segments around the gaps (offsets along the wall).
      let cursor = -wall.len / 2;
      const segs = [];
      for (const g of gaps) {
        segs.push([cursor, g.at - g.width / 2, 0, h]);
        segs.push([g.at - g.width / 2, g.at + g.width / 2, g.height ?? 2.1, h]); // lintel
        cursor = g.at + g.width / 2;
      }
      segs.push([cursor, wall.len / 2, 0, h]);
      for (const [a, b, y0, y1] of segs) {
        const len = b - a;
        if (len <= 0.01 || y1 - y0 <= 0.01) continue;
        const geo = new THREE.PlaneGeometry(len, y1 - y0, Math.max(1, Math.round(len)), Math.max(1, Math.round(y1 - y0)));
        const m = new THREE.Mesh(geo, wallMat);
        const mid = (a + b) / 2;
        // Local wall axis: plane faces +Z, we rotate it to face the room centre.
        const dir = new THREE.Vector3(Math.cos(wall.rot), 0, -Math.sin(wall.rot));
        m.position.set(wall.cx + dir.x * mid, (y0 + y1) / 2, wall.cz + dir.z * mid);
        m.rotation.y = wall.rot;
        this.root.add(m);
        if (y0 < 1.8) this.addColliderBox(m.position.x, (y0 + y1) / 2, m.position.z, len, y1 - y0, 0.2, wall.rot);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Collision
  // ---------------------------------------------------------------------------

  /** layer 'props' (default) or 'terrain' (player-only; vehicles sample groundHeight). */
  addColliderMesh(mesh, layer = 'props') {
    mesh.updateMatrixWorld(true);
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.clearGroups();
    g.applyMatrix4(mesh.matrixWorld);
    (layer === 'terrain' ? this._terrainGeos : this._colliderGeos).push(g);
  }

  /** Invisible collision box (centre + size, optional Y rotation). */
  addColliderBox(cx, cy, cz, sx, sy, sz, rotY = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.clearGroups();
    g.rotateY(rotY);
    g.translate(cx, cy, cz);
    this._colliderGeos.push(g);
  }

  /** World-space AABB of an object as a collision box (shrunk by `inset`). */
  addColliderFromObject(obj, inset = 0) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    this.addColliderBox(c.x, c.y, c.z, Math.max(0.05, s.x - inset), s.y, Math.max(0.05, s.z - inset));
  }

  #buildCollider() {
    if (this._colliderGeos.length) this.bvh = new MeshBVH(mergeGeometries(this._colliderGeos, false));
    if (this._terrainGeos.length) this.terrainBvh = new MeshBVH(mergeGeometries(this._terrainGeos, false));
    this._colliderGeos.length = 0;
    this._terrainGeos.length = 0;
  }

  /** Distance along a ray to the first static surface (props or terrain), or Infinity. */
  raycastStatic(ray, far = 100) {
    let best = Infinity;
    for (const bvh of [this.bvh, this.terrainBvh]) {
      const hit = bvh?.raycastFirst(ray, THREE.DoubleSide);
      if (hit && hit.distance < best) best = hit.distance;
    }
    return best <= far ? best : Infinity;
  }

  /** Ground height under a point for vehicles (scenes with terrain override). */
  groundHeight(_x, _z) {
    return 0;
  }

  /** Water surface height at a point, or null if there's no water there. */
  waterHeight(_x, _z) {
    return null;
  }

  /**
   * Push a capsule (segment + radius) out of the static collider.
   * Mutates `segment` in place. Returns true if anything was hit.
   * (Adapted from the three-mesh-bvh character-movement example.)
   */
  collideCapsule(segment, radius, { terrain = true } = {}) {
    let hit = this.#collideWith(this.bvh, segment, radius);
    if (terrain) hit = this.#collideWith(this.terrainBvh, segment, radius) || hit;
    return hit;
  }

  #collideWith(bvh, segment, radius) {
    if (!bvh) return false;
    const box = _box.makeEmpty();
    box.expandByPoint(segment.start).expandByPoint(segment.end);
    box.min.addScalar(-radius);
    box.max.addScalar(radius);
    let hit = false;
    bvh.shapecast({
      intersectsBounds: (b) => b.intersectsBox(box),
      intersectsTriangle: (tri) => {
        const distance = tri.closestPointToSegment(segment, _triPoint, _capPoint);
        if (distance < radius) {
          const depth = radius - distance;
          const dir = _capPoint.sub(_triPoint).normalize();
          segment.start.addScaledVector(dir, depth);
          segment.end.addScaledVector(dir, depth);
          hit = true;
        }
      },
    });
    return hit;
  }

  // ---------------------------------------------------------------------------
  // Lights / interactables / triggers / audio
  // ---------------------------------------------------------------------------

  /**
   * Register a point light for the PSX shader.
   * { position: Vector3 | [x,y,z], color, range, intensity, enabled, flicker, priority }
   */
  addLight(def) {
    const light = {
      enabled: true,
      intensity: 1,
      range: 6,
      ...def,
      position: Array.isArray(def.position) ? new THREE.Vector3(...def.position) : def.position,
      color: new THREE.Color(def.color ?? 0xffffff),
      flickerSeed: Math.random() * 100,
    };
    this.lights.push(light);
    return light;
  }

  /**
   * Make an object interactable.
   * def = { prompt: string | () => string, action: () => void, range?: number,
   *         enabled?: () => boolean }
   */
  addInteractable(obj, def) {
    obj.userData.interact = def;
    this.interactables.push(obj);
    return obj;
  }

  /** Invisible box used purely as an interaction target. */
  interactVolume(x, y, z, sx, sy, sz, def) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), _invisible);
    m.visible = false;
    m.position.set(x, y, z);
    this.root.add(m);
    return this.addInteractable(m, def);
  }

  /** Trigger volume: fires `onEnter(game)` when the player/vehicle enters it. */
  addTrigger(min, max, onEnter, { vehicleOnly = false } = {}) {
    const t = { box: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)), onEnter, inside: false, vehicleOnly };
    this.triggers.push(t);
    return t;
  }

  addSpawn(name, [x, y, z], yaw = 0, pitch = 0) {
    this.spawns[name] = { position: new THREE.Vector3(x, y, z), yaw, pitch };
  }

  /** Looping positional sound; started on enter, stopped on exit. */
  addSound(key, position, opts) {
    const anchor = new THREE.Object3D();
    anchor.position.copy(position);
    this.root.add(anchor);
    const s = { key, anchor, opts, handle: null };
    this.sounds.push(s);
    return s;
  }

  startSounds() {
    for (const s of this.sounds) if (!s.handle) s.handle = this.game.audio.positional(s.key, s.anchor, s.opts);
  }

  stopSounds() {
    for (const s of this.sounds) {
      s.handle?.stop();
      s.handle = null;
    }
  }
}

const _box = new THREE.Box3();
const _triPoint = new THREE.Vector3();
const _capPoint = new THREE.Vector3();
const _invisible = new THREE.MeshBasicMaterial({ visible: false });
