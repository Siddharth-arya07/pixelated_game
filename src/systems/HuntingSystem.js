import * as THREE from 'three';
import { prop } from '../scenes/Props.js';

/**
 * HuntingSystem
 * -------------
 * The shotgun (Beretta A400, semi-auto, 4+1) and the deer that live in the
 * overworld's woods.
 *
 * Shotgun (equip it from the inventory):
 *   LMB fire · RMB aim down sights · R reload one shell at a time
 *   8 pellets, spread tighter when aiming, damage falls off with range,
 *   trees/terrain block pellets (BVH raycast), headshots ×3.
 *   Recoil, muzzle flash (lights the scene), ejected shells, echoing boom.
 *
 * Deer (World only): small herds graze and wander on the terrain, notice you
 * (~22 m, further if you sprint or drive), stare, then bolt and warn the herd.
 * A gunshot scatters every deer within 140 m. Dead deer can be field dressed
 * for venison. Herds respawn out of sight in the fog.
 */
const MAG = 4;
const PELLETS = 8;
const RANGE = 55;

export class HuntingSystem {
  constructor(game) {
    this.game = game;
    this.mag = 0;
    this.aim = 0; // 0 hip … 1 ADS
    this.kick = 0;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.lights = [];
    this.deer = [];
    this.respawnT = 0;
  }

  init() {
    const g = this.game;
    const ctx = { r: g.renderer, assets: g.assets };
    // ---- viewmodel --------------------------------------------------------
    this.gunRoot = new THREE.Group();
    this.gunRoot.visible = false;
    g.camera.add(this.gunRoot);
    const gun = prop(ctx, 'shotgun');
    gun.rotation.y = Math.PI; // muzzle points down -Z (camera forward)
    const holder = new THREE.Group();
    holder.add(gun);
    // Centre the model on its grip area (≈ 35% from the butt).
    const b = new THREE.Box3().setFromObject(holder);
    holder.position.set(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + (b.max.z - b.min.z) * 0.62));
    this.gunPivot = new THREE.Group();
    this.gunPivot.add(holder);
    this.gunRoot.add(this.gunPivot);
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.03, -(b.max.z - b.min.z) * 0.6);
    this.gunPivot.add(this.muzzle);

    const flashMat = g.renderer.material({ color: 0xffd080, unlit: true, additive: true, opacity: 0.95, doubleSide: true, fogScale: 0 });
    this.flash = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), flashMat);
      p.rotation.z = (i * Math.PI) / 3;
      this.flash.add(p);
    }
    this.flash.visible = false;
    this.muzzle.add(this.flash);
    this.flashLight = { position: new THREE.Vector3(), color: new THREE.Color(0xffc070), range: 10, intensity: 0, enabled: true, priority: 8 };

    // ---- particles: shells, dirt puffs, blood ------------------------------
    this.fx = new THREE.Group();
    this.parts = [];
    const shellGeo = new THREE.BoxGeometry(0.02, 0.02, 0.06);
    const puffGeo = new THREE.PlaneGeometry(0.25, 0.25);
    for (let i = 0; i < 50; i++) {
      const shell = i < 8;
      const mat = g.renderer.material({ color: shell ? 0xc03020 : 0x8a7a60, unlit: !shell, opacity: shell ? 1 : 0.7, doubleSide: true, depthWrite: shell });
      const m = new THREE.Mesh(shell ? shellGeo : puffGeo, mat);
      m.visible = false;
      m.frustumCulled = false;
      m.userData = { shell, vel: new THREE.Vector3(), life: 0, max: 1, spin: 0 };
      this.fx.add(m);
      this.parts.push(m);
    }
  }

  get equipped() {
    const g = this.game;
    return g.inventory.equipped === 'shotgun' && g.player.enabled && !g.player.seated && !g.focus;
  }

  // ===========================================================================
  // Per frame
  // ===========================================================================

  update(dt) {
    const g = this.game;
    const scene = g.scene;
    if (scene && this.fx.parent !== scene.root) scene.root.add(this.fx);
    const hands = g.viewModel.handsFree;
    const ready = this.equipped && hands;
    this.gunRoot.visible = ready;
    this.cooldown -= dt;
    this.kick = Math.max(0, this.kick - dt * 6);
    this.flashT = (this.flashT ?? 0) - dt;
    this.flash.visible = this.flashT > 0;
    this.flashLight.intensity = this.flashT > 0 ? 2.6 : 0;
    this.muzzle.getWorldPosition(this.flashLight.position);
    this.lights.length = 0;
    if (this.flashLight.intensity > 0) this.lights.push(this.flashLight);

    const input = g.input;
    const canUse = ready && !g.uiOpen && !g.fishing.active;
    const wantAim = canUse && input.down && input.mouseDown(2);
    this.aim = THREE.MathUtils.damp(this.aim, wantAim ? 1 : 0, 12, dt);

    if (canUse) {
      if (input.pressed('KeyR')) this.#startReload();
      if (input.locked && input.mousePressed(0)) {
        input.consumeMouse(0);
        if (!scene.outdoor) g.hud.toast('Not in here.');
        else if (this.reloading && this.mag > 0) (this.reloading = false), this.#fire();
        else this.#fire();
      }
      this.#updateReload(dt);
    } else this.reloading = false;

    this.#pose(dt);
    this.#updateParts(dt);
    if (scene?.name === 'World') this.#updateDeer(dt, scene);
    if (ready) g.hud.setAmmo?.(this.mag, g.inventory.count('shells'), this.reloading, this.nearest);
    else g.hud.setAmmo?.(null);
  }

  /** Called after the player camera is placed: ADS zoom + recoil kick. */
  applyCamera() {
    const cam = this.game.camera;
    const fov = this.game.fovOverride ?? 70 - this.aim * 22;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.rotation.x += this.kick * 0.06;
  }

  #pose() {
    const a = this.aim;
    const t = this.game.time;
    const moving = Math.hypot(this.game.player.velocity.x, this.game.player.velocity.z) > 0.5;
    const sway = moving ? Math.sin(t * 9) * 0.008 * (1 - a) : Math.sin(t * 1.4) * 0.003;
    // hip → sights
    const p = this.gunPivot.position;
    // ADS: barrel rib just under the crosshair, stock down out of the way.
    p.set(THREE.MathUtils.lerp(0.17, 0.01, a) + sway, THREE.MathUtils.lerp(-0.21, -0.14, a) + Math.abs(sway) * 0.5, THREE.MathUtils.lerp(-0.45, -0.42, a) + this.kick * 0.07);
    const reloadTilt = this.reloading ? 0.55 : 0;
    this.gunPivot.rotation.set(this.kick * 0.22 + reloadTilt * 0.3 + a * 0.06, THREE.MathUtils.lerp(-0.06, 0, a), THREE.MathUtils.lerp(0.04, 0, a) + reloadTilt);
  }

  // ===========================================================================
  // Shooting
  // ===========================================================================

  #fire() {
    const g = this.game;
    if (this.cooldown > 0) return;
    if (this.mag <= 0) {
      g.audio.oneShot('click', { volume: 0.6, rate: 0.7 });
      g.hud.toast(g.inventory.count('shells') ? 'Empty. R to load.' : 'Out of shells. Quik Mart, aisle 3.');
      this.cooldown = 0.3;
      return;
    }
    this.mag--;
    this.cooldown = 0.32;
    this.kick = 1;
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * 3;
    g.player.pitch = Math.min(1.45, g.player.pitch + 0.035 * (1 - this.aim * 0.5));
    g.camera.userData.shake = 0.06;
    g.audio.oneShot('shotgun', { volume: 1 });
    g.net?.online && g.net.event('shot');
    this.#ejectShell();

    // Pellets
    const cam = g.camera;
    const origin = cam.getWorldPosition(new THREE.Vector3());
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const spread = THREE.MathUtils.lerp(0.055, 0.025, this.aim);
    const ray = new THREE.Ray();
    const hits = new Map();
    for (let i = 0; i < PELLETS; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      ray.set(origin, dir);
      const wall = g.scene.raycastStatic(ray, RANGE);
      let best = null;
      for (const d of this.deer) {
        if (d.dead) continue;
        const h = d.hitTest(ray, Math.min(wall, RANGE));
        if (h && (!best || h.dist < best.dist)) best = { deer: d, ...h };
      }
      if (best) {
        const dmg = (best.part === 'head' ? 40 : 13) * THREE.MathUtils.clamp(1 - (best.dist - 12) / 45, 0.25, 1);
        hits.set(best.deer, (hits.get(best.deer) ?? 0) + dmg);
        this.#puff(origin.clone().addScaledVector(dir, best.dist), 0x7a1810);
      } else if (wall < Infinity) this.#puff(origin.clone().addScaledVector(dir, wall), 0x8a7a60);
    }
    for (const [d, dmg] of hits) d.damage(dmg, origin);
    // Everything nearby hears it.
    for (const d of this.deer) if (!d.dead && d.pos.distanceTo(origin) < 140) d.scare(origin, 1);
  }

  #startReload() {
    const g = this.game;
    if (this.reloading || this.mag >= MAG + 1) return;
    if (!g.inventory.has('shells')) return g.hud.toast('No shells.');
    this.reloading = true;
    this.reloadT = 0.55;
  }

  #updateReload(dt) {
    if (!this.reloading) return;
    const g = this.game;
    this.reloadT -= dt;
    if (this.reloadT > 0) return;
    if (this.mag >= MAG + 1 || !g.inventory.has('shells')) {
      this.reloading = false;
      g.audio.oneShot('reel', { volume: 0.5, rate: 0.6 }); // bolt release
      return;
    }
    g.inventory.remove('shells');
    this.mag++;
    g.audio.oneShot('click', { volume: 0.5, rate: 1.3 });
    this.reloadT = 0.5;
  }

  #ejectShell() {
    const p = this.parts.find((q) => !q.visible && q.userData.shell);
    if (!p) return;
    this.muzzle.getWorldPosition(p.position);
    const cam = this.game.camera;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(cam.quaternion);
    p.position.addScaledVector(back, 0.5);
    p.userData.vel.copy(right).multiplyScalar(2.2).add(new THREE.Vector3(0, 2.4, 0));
    Object.assign(p.userData, { life: 0, max: 1.4, spin: 18 });
    p.visible = true;
  }

  #puff(at, color) {
    const p = this.parts.find((q) => !q.visible && !q.userData.shell);
    if (!p) return;
    p.position.copy(at);
    p.material.uniforms.uColor.value.set(color);
    p.userData.vel.set(0, 0.6, 0);
    Object.assign(p.userData, { life: 0, max: 0.6, spin: 0 });
    p.visible = true;
  }

  #updateParts(dt) {
    const cam = this.game.camera;
    const scene = this.game.scene;
    for (const p of this.parts) {
      if (!p.visible) continue;
      const u = p.userData;
      u.life += dt;
      if (u.life >= u.max) {
        p.visible = false;
        continue;
      }
      if (u.shell) {
        u.vel.y -= 9.8 * dt;
        p.position.addScaledVector(u.vel, dt);
        const gy = scene?.groundHeight?.(p.position.x, p.position.z) ?? 0;
        if (p.position.y < gy + 0.02) {
          p.position.y = gy + 0.02;
          u.vel.multiplyScalar(0.3);
          u.vel.y = Math.abs(u.vel.y);
        }
        p.rotation.x += u.spin * dt;
      } else {
        p.position.addScaledVector(u.vel, dt);
        p.quaternion.copy(cam.quaternion);
        p.scale.setScalar(1 + u.life * 3);
        p.material.uniforms.uOpacity.value = 0.7 * (1 - u.life / u.max);
      }
    }
  }

  // ===========================================================================
  // Deer
  // ===========================================================================

  /** Called when the World is built: register herd areas. */
  setupWorld(world) {
    this.world = world;
    this.deerRoot = new THREE.Group();
    world.root.add(this.deerRoot);
    for (let i = 0; i < 9; i++) this.#spawnHerd(true);
    this.hintT = 20;
  }

  /** True while we're a guest in someone else's room (the host runs the deer). */
  get netClient() {
    const n = this.game.net;
    return !!(n?.online && !n.isHost);
  }

  /** Host → room: compact herd state. */
  netSnapshot() {
    return this.deer.filter((d) => !d.gone).map((d) => [d.id, Math.round(d.pos.x * 10) / 10, Math.round(d.pos.z * 10) / 10, Math.round(d.heading * 100) / 100, STATES.indexOf(d.state), d.dead ? 1 : 0, Math.round(d.scale * 100)]);
  }

  /** Guest: mirror the host's deer (create/remove as needed). */
  netApply(list) {
    if (!this.world) return;
    const seen = new Set();
    for (const [id, x, z, h, st, dead, sc] of list) {
      seen.add(id);
      let d = this.deer.find((q) => q.id === id && !q.gone);
      if (!d) {
        d = new Deer(this, { home: new THREE.Vector3(x, 0, z), members: [] }, x, z);
        d.id = id;
        d.heading = h;
        d.scale = sc / 100;
        d.obj.scale.setScalar(d.scale);
        this.deer.push(d);
      }
      d.net = [x, z, h, st];
      if (dead && !d.dead) d.fallOver();
    }
    for (const d of this.deer) if (!d.gone && !seen.has(d.id)) d.remove();
    this.deer = this.deer.filter((d) => !d.gone);
  }

  /** Host: a guest shot a deer / dressed one. */
  netHit(id, dmg, from) {
    const d = this.deer.find((q) => q.id === id);
    if (d && !d.dead) d.damage(dmg, new THREE.Vector3(...from));
  }

  netDressed(id) {
    const d = this.deer.find((q) => q.id === id);
    if (d && !d.gone) d.remove();
  }

  #spawnHerd(initial = false) {
    const W = this.world;
    const T = W.terrain;
    const player = this.game.player.position;
    for (let tries = 0; tries < 60; tries++) {
      // Woods: the mountain flanks and the far west.
      const x = (Math.random() * 2 - 1) * 430;
      const z = Math.random() < 0.85 ? -60 - Math.random() * 380 : (Math.random() * 2 - 1) * 430; // mostly the mountain
      const y = T.heightAt(x, z);
      if (y < 4 || T.slopeAt(x, z) > 0.35 || T.roadDistance(x, z) < 15) continue;
      if (!initial && Math.hypot(x - player.x, z - player.z) < 90) continue;
      const n = 3 + Math.floor(Math.random() * 3);
      const herd = { home: new THREE.Vector3(x, y, z), members: [] };
      for (let i = 0; i < n; i++) {
        const d = new Deer(this, herd, x + (Math.random() - 0.5) * 10, z + (Math.random() - 0.5) * 10);
        herd.members.push(d);
        this.deer.push(d);
      }
      return;
    }
  }

  #updateDeer(dt, scene) {
    const p = this.game.player;
    const v = this.game.vehicles.active;
    const me = v ? v.position : p.position;
    // Noise: sprinting and engines carry further than footsteps.
    const sprint = this.game.input.down('ShiftLeft') ? 1.8 : 1;
    const notice = v ? 34 : 16 * sprint;
    // Hint: something moving in the trees nearby.
    let near = null;
    let nd = Infinity;
    for (const d of this.deer) {
      if (d.dead) continue;
      const dd = Math.hypot(d.pos.x - me.x, d.pos.z - me.z);
      if (dd < nd) {
        nd = dd;
        near = d;
      }
    }
    this.hintT = (this.hintT ?? 0) - dt;
    if (near && nd < 50 && this.hintT <= 0) {
      this.hintT = 45;
      const dir = compass(near.pos.x - me.x, near.pos.z - me.z);
      this.game.hud.toast(`Something's moving in the trees. Deer, ~${Math.round(nd / 5) * 5} m ${dir}.`, 4000);
      this.game.audio.oneShot('snort', { volume: 0.5, object: near.obj });
    }
    this.nearest = near && nd < 80 ? { d: nd, dir: compass(near.pos.x - me.x, near.pos.z - me.z) } : null;
    if (this.netClient) {
      for (const d of this.deer) if (!d.gone) d.netStep(dt);
      return;
    }
    for (const d of this.deer) {
      if (d.pos.distanceTo(me) > 220 && !d.dead) continue; // far herds sleep
      d.update(dt, scene, me, notice);
      // Roadkill: deer don't stop vehicles, but they don't survive them either.
      if (v && !d.dead && Math.abs(v.speed) > 5 && Math.hypot(d.pos.x - me.x, d.pos.z - me.z) < v.half.x + 0.9) {
        d.damage(500, me);
        this.game.audio.oneShot('door', { volume: 0.9, rate: 0.5 });
        this.game.camera.userData.shake = 0.3;
        v.vel.multiplyScalar(0.6);
      }
    }
    // Keep ~10 deer alive; clean up harvested ones.
    this.deer = this.deer.filter((d) => !d.gone);
    this.respawnT -= dt;
    if (this.respawnT <= 0) {
      this.respawnT = 30;
      if (this.deer.filter((d) => !d.dead).length < 26) this.#spawnHerd();
    }
  }
}

// =============================================================================

class Deer {
  constructor(sys, herd, x, z) {
    this.sys = sys;
    this.herd = herd;
    this.game = sys.game;
    this.id = sys.nextDeerId = (sys.nextDeerId ?? 0) + 1;
    const W = sys.world;
    this.obj = new THREE.Group();
    this.model = prop({ r: this.game.renderer, assets: this.game.assets }, 'deer');
    this.obj.add(this.model);
    this.obj.rotation.order = 'YXZ';
    const s = 0.85 + Math.random() * 0.3;
    this.obj.scale.setScalar(s);
    this.scale = s;
    sys.deerRoot.add(this.obj);
    this.pos = new THREE.Vector3(x, W.terrain.heightAt(x, z), z);
    this.heading = Math.random() * Math.PI * 2;
    this.state = 'graze';
    this.timer = 2 + Math.random() * 6;
    this.speed = 0;
    this.hp = 100;
    this.dead = false;
    this.target = null;
    this.phase = Math.random() * 10;
    this.threat = new THREE.Vector3();
    this.obj.position.copy(this.pos);
  }

  /** Ray vs body/head spheres. Returns { dist, part } or null. */
  hitTest(ray, maxDist) {
    const f = _f.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    const s = this.scale;
    const body = _c.copy(this.pos).addScaledVector(f, 0.05 * s).setY(this.pos.y + 1.0 * s);
    const head = _h.copy(this.pos).addScaledVector(f, 0.78 * s).setY(this.pos.y + 1.45 * s);
    let best = null;
    for (const [c, r, part] of [[head, 0.22 * s, 'head'], [body, 0.55 * s, 'body']]) {
      const sph = _s.set(c, r);
      const hit = ray.intersectSphere(sph, _p);
      if (!hit) continue;
      const d = hit.distanceTo(ray.origin);
      if (d <= maxDist && (!best || d < best.dist)) best = { dist: d, part };
    }
    return best;
  }

  damage(amount, from) {
    if (this.dead) return;
    // In someone else's room the host owns the deer: report the hit.
    if (this.sys.netClient) {
      this.game.net.event('deerHit', { id: this.id, dmg: amount, from: [from.x, from.y, from.z] });
      return;
    }
    this.hp -= amount;
    if (this.hp <= 0) return this.#die(from);
    this.scare(from, 1.4); // wounded: runs harder
  }

  scare(from, strength = 1) {
    if (this.dead) return;
    this.threat.copy(from);
    if (this.state !== 'flee') this.game.audio.oneShot('snort', { volume: 0.5, object: this.obj });
    this.state = 'flee';
    this.timer = (5 + Math.random() * 3) * strength;
    this.fleeSpeed = 10 + Math.random() * 2 + (strength > 1 ? 2 : 0);
  }

  #alertHerd(from) {
    for (const m of this.herd.members) if (m !== this && !m.dead && m.pos.distanceTo(this.pos) < 25) m.scare(from);
  }

  #die(from) {
    this.dead = true;
    this.state = 'dead';
    if (from) this.#alertHerd(from);
    this.fallOver();
  }

  /** The visual death + the field-dressing volume (also used by net clients). */
  fallOver() {
    const g = this.game;
    this.dead = true;
    this.state = 'dead';
    const side = Math.random() < 0.5 ? 1 : -1;
    g.tweens.to(this.obj.rotation, { z: side * 1.45 }, 0.6, { ease: 'in' });
    g.tweens.to(this.obj.position, { y: this.pos.y + 0.12 }, 0.6);
    // A generous box around the carcass: a deer lying on a slope is a fiddly target.
    const scene = this.sys.world;
    this.vol = scene.interactVolume(this.pos.x, this.pos.y + 0.5, this.pos.z, 2.4, 1.4, 2.4, {
      prompt: 'Field dress deer',
      range: 3.2,
      enabled: () => this.dead && !this.harvested,
      action: () => this.#harvest(),
    });
  }

  /** Remove the carcass (harvested here or by another player). */
  remove() {
    this.harvested = true;
    const scene = this.sys.world;
    if (this.vol) {
      scene.interactables = scene.interactables.filter((o) => o !== this.vol);
      this.vol.removeFromParent();
    }
    this.obj.removeFromParent();
    this.gone = true;
  }

  /** Net client: glide toward the host's position, then animate. */
  netStep(dt) {
    if (!this.net) return;
    const [x, z, h, st] = this.net;
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 25) this.pos.set(x, this.pos.y, z);
    else {
      const k = 1 - Math.exp(-dt * 6);
      this.pos.x += dx * k;
      this.pos.z += dz * k;
    }
    this.speed = THREE.MathUtils.damp(this.speed, Math.min(13, d * 6), 4, dt);
    this.heading = turnToward(this.heading, h, dt * 6);
    this.state = STATES[st] ?? 'graze';
    if (!this.dead) this.#animate(dt);
  }

  async #harvest() {
    const g = this.game;
    this.harvested = true;
    g.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, 600));
    g.dayNight.advance(20);
    g.inventory.add('venison', 2);
    g.net?.event('deerDressed', { id: this.id });
    g.fade.classList.remove('on');
    g.hud.toast('Field dressed. 2× venison. (20 minutes pass.)', 3500);
    const scene = this.sys.world;
    scene.interactables = scene.interactables.filter((o) => o !== this.vol);
    this.vol.removeFromParent();
    this.obj.removeFromParent();
    this.gone = true;
  }

  update(dt, scene, threatPos, notice) {
    if (this.dead) return;
    const T = this.sys.world.terrain;
    const dist = Math.hypot(threatPos.x - this.pos.x, threatPos.z - this.pos.z);
    this.timer -= dt;

    // Senses
    if (this.state === 'graze' || this.state === 'walk') {
      if (dist < notice) {
        this.state = 'alert';
        this.timer = 1.2 + Math.random();
        this.threat.copy(threatPos);
      }
    } else if (this.state === 'alert') {
      this.heading = turnToward(this.heading, Math.atan2(threatPos.x - this.pos.x, threatPos.z - this.pos.z), dt * 4);
      if (dist < notice * 0.6 || this.timer <= 0) {
        if (dist < notice * 1.2) {
          this.scare(threatPos);
          this.#alertHerd(threatPos);
        } else this.state = 'graze';
      }
    }

    // Behaviour
    let want = 0;
    switch (this.state) {
      case 'graze':
        if (this.timer <= 0) {
          this.state = 'walk';
          this.timer = 3 + Math.random() * 5;
          const h = this.herd.home;
          this.target = new THREE.Vector3(h.x + (Math.random() - 0.5) * 30, 0, h.z + (Math.random() - 0.5) * 30);
        }
        break;
      case 'walk':
        want = 1.3;
        if (this.target) this.heading = turnToward(this.heading, Math.atan2(this.target.x - this.pos.x, this.target.z - this.pos.z), dt * 2);
        if (this.timer <= 0 || (this.target && Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) < 2)) {
          this.state = 'graze';
          this.timer = 3 + Math.random() * 7;
        }
        break;
      case 'flee': {
        want = this.fleeSpeed;
        const away = Math.atan2(this.pos.x - this.threat.x, this.pos.z - this.threat.z);
        this.heading = turnToward(this.heading, away + Math.sin(this.phase * 0.7) * 0.4, dt * 3);
        if (this.timer <= 0) {
          this.state = 'walk';
          this.timer = 2;
          this.herd.home.set(this.pos.x, 0, this.pos.z); // settle somewhere new
        }
        break;
      }
    }
    this.speed = THREE.MathUtils.damp(this.speed, want, this.state === 'flee' ? 3 : 2, dt);

    // Move on the terrain; turn back from cliffs, the sea and the map edge.
    if (this.speed > 0.05) {
      const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
      const bad = T.heightAt(nx, nz) < 3 || T.slopeAt(nx, nz) > 0.5 || Math.abs(nx) > 470 || Math.abs(nz) > 470;
      if (bad) this.heading += Math.PI * (0.6 + Math.random() * 0.4);
      else {
        this.pos.x = nx;
        this.pos.z = nz;
      }
    }
    this.#animate(dt);
  }

  #animate(dt) {
    const T = this.sys.world.terrain;
    this.pos.y = T.heightAt(this.pos.x, this.pos.z);
    // Procedural animation: graze dip, walk bob, gallop bounce.
    this.phase += dt * (this.state === 'flee' ? 11 : 6) * Math.min(1, this.speed + 0.2);
    const gallop = this.state === 'flee' ? Math.max(0, Math.sin(this.phase)) * 0.28 : 0;
    const bob = this.state === 'walk' ? Math.abs(Math.sin(this.phase)) * 0.04 : 0;
    const dip = this.state === 'graze' ? 0.16 + Math.sin(this.phase * 0.3) * 0.03 : this.state === 'alert' ? -0.08 : 0;
    const ahead = T.heightAt(this.pos.x + Math.sin(this.heading), this.pos.z + Math.cos(this.heading)) - this.pos.y;
    this.obj.position.set(this.pos.x, this.pos.y + gallop + bob, this.pos.z);
    this.obj.rotation.set(dip - Math.atan(ahead) + (this.state === 'flee' ? Math.cos(this.phase) * 0.12 : 0), this.heading, 0);
  }
}

const STATES = ['graze', 'walk', 'alert', 'flee', 'dead'];

function turnToward(h, target, maxStep) {
  let d = THREE.MathUtils.euclideanModulo(target - h + Math.PI, Math.PI * 2) - Math.PI;
  d = THREE.MathUtils.clamp(d, -maxStep, maxStep);
  return h + d;
}

const _f = new THREE.Vector3();
const _c = new THREE.Vector3();
const _h = new THREE.Vector3();
const _p = new THREE.Vector3();
const _s = new THREE.Sphere();

/** World direction (dx east, dz south) → compass word. */
function compass(dx, dz) {
  const az = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((az + 360) % 360) / 45) % 8];
}
