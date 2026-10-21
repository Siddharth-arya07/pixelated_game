import * as THREE from 'three';
import { addSeat } from './Devices.js';
import { buildPlayground } from './Playground.js';
import { buildGarden } from './Garden.js';
import { addTelescope } from './Telescope.js';
import { Railway } from './Railway.js';
import { buildDriveIn } from './DriveIn.js';
import { buildWishingWell } from './WishingWell.js';
import { buildBonfire } from './Bonfire.js';
import { buildBackyard } from './Backyard.js';
import { buildFunland } from './Funland.js';
import { buildTreehouse } from './Treehouse.js';
import { BaseScene } from './BaseScene.js';
import { Terrain } from '../world/Terrain.js';
import { MAP } from '../world/MapLayout.js';
import { signTexture } from '../core/Procedural.js';

/**
 * WorldScene (overworld)
 * ----------------------
 * A 1 km² valley, always foggy:
 *
 *   town (your house, truck + bike) ── junction ── coast road ── harbor
 *        |                               |                        |  pier: boat + jet ski
 *   lake road (west)               valley road                lighthouse on the cliff
 *                                        |
 *                     switchbacks up the mountain (paved → gravel, ~15%)
 *                                        |
 *                         Quik Mart on the summit plateau (~110 m)
 *
 * Terrain + roads come from world/Terrain.js (MapLayout.js has the data).
 */
export class WorldScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'World', label: 'route 9', outdoor: true });
    this.groundFog = 0.45; // DayNightCycle reads these
    this.groundFogY = 3;
  }

  // Vehicle/physics hooks ---------------------------------------------------------
  groundHeight(x, z) {
    return this.terrain.heightAt(x, z);
  }

  surfaceAt(x, z) {
    return this.terrain.surfaceAt(x, z);
  }

  gradientAt(x, z, out) {
    return this.terrain.gradientAt(x, z, out);
  }

  waterHeight(x, z) {
    return x > 200 ? this.game.renderer.water.height(x, z) : null;
  }

  /** Stop the player wading into the sea (unless they're up on the pier). */
  blocksWalk(x, z, feetY) {
    return feetY < 0.9 && this.terrain.heightAt(x, z) < -0.7;
  }

  build() {
    const t0 = performance.now();
    this.terrain = new Terrain().build();
    this.rand = mulberry(42);
    this.#ground();
    this.#sea();
    this.#town();
    this.#mountain();
    this.#gasStation();
    this.#harbor();
    this.#lighthouse();
    this.playground = buildPlayground(this, this.poi.playground);
    buildWishingWell(this, this.poi.playground.x - 13, this.poi.playground.z + 9);
    this.railway = new Railway(this);
    this.drivein = buildDriveIn(this, this.poi.drivein);
    this.#diner();
    this.#airfield();
    this.#mineEntrance();
    this.bonfire = buildBonfire(this);
    this.backyard = buildBackyard(this);
    this.funland = buildFunland(this);
    this.treehouse = buildTreehouse(this);
    this.#bowlingAlley();
    this.#nature();
    this.#bounds();
    console.info(`[World] built in ${(performance.now() - t0).toFixed(0)} ms`);
  }

  onEnter() {
    this.game.renderer.water.setSea('choppy');
    this.game.fishing.attachTo(this, 0);
  }

  update(dt, time) {
    super.update(dt, time);
    // The sea is a camera-following grid, snapped to its cell size so the
    // waves (computed in world space) never swim.
    const cam = this.game.camera.position;
    this.sea.position.set(Math.round(cam.x / 4) * 4, 0, Math.round(cam.z / 4) * 4);
    this.sea.visible = cam.x > 180 || (this.game.farBoost ?? 0) > 100;
    this.sea.scale.setScalar((this.game.farBoost ?? 0) > 100 ? 8 : 1);
  }

  // ---------------------------------------------------------------------------
  // Terrain, roads, sea
  // ---------------------------------------------------------------------------

  #ground() {
    const T = this.terrain;
    const mat = this.mat({ map: this.tex('grass', 1, 1), vertexColors: true });
    this.terrainMat = mat;
    for (const chunk of T.buildMeshes(mat)) {
      this.root.add(chunk);
      this.addColliderMesh(chunk, 'terrain');
    }
    const roads = T.buildRoadMeshes({
      asphalt: this.mat({ map: this.tex('road', 1, 1) }),
      gravel: this.mat({ map: this.tex('gravel', 1, 2) }),
    });
    for (const m of roads) this.root.add(m);
    this.poi = T.poi;
    for (const p of Object.values(this.poi)) p.y = T.heightAt(p.x, p.z);
  }

  #sea() {
    const geo = new THREE.PlaneGeometry(260, 260, 65, 65);
    geo.rotateX(-Math.PI / 2);
    const mat = this.mat({ map: this.tex('water', 32), color: 0x6c8a9c, water: true, scroll: [0.01, 0.006] });
    this.sea = new THREE.Mesh(geo, mat);
    this.sea.frustumCulled = false;
    this.root.add(this.sea);
    this.addInteractable(this.sea, {
      prompt: 'Cast line',
      range: 18,
      occlude: true,
      // (also: never while the camera is under the terrain, e.g. the frame of a scene change)
      enabled: () => !this.game.fishing.active && this.game.camera.position.y > this.terrain.heightAt(this.game.camera.position.x, this.game.camera.position.z),
      available: () => this.game.fishing.canFish(),
      action: () => this.game.fishing.begin(),
    });
  }

  // ---------------------------------------------------------------------------
  // Town
  // ---------------------------------------------------------------------------

  #town() {
    const g = this.game;
    const h = this.poi.house;
    const hx = h.x;
    const hz = h.z;
    const y = h.y;

    // Your house: door on the south face, looking at the road.
    const siding = this.mat({ map: this.tex('siding', 4, 1.5) });
    this.box(9, 3.2, 8, siding, hx, y + 1.6, hz, { segments: [4, 2, 4] });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 2.2, 4), this.mat({ color: 0x2a2224 }));
    roof.position.set(hx, y + 4.3, hz);
    roof.rotation.y = Math.PI / 4;
    this.root.add(roof);
    const warm = this.mat({ color: 0xd8a868, unlit: true });
    const blue = this.mat({ color: 0x5ab0b8, unlit: true });
    for (const [x, m] of [[hx - 2.6, blue], [hx + 2.6, warm]]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), m);
      w.position.set(x, y + 1.7, hz + 4.01);
      this.root.add(w);
    }
    this.addLight({ position: [hx - 2.6, y + 1.6, hz + 5], color: 0x50a0b0, range: 3, intensity: 0.6 });
    const door = this.box(1.0, 2.1, 0.06, this.mat({ color: 0x4a3426 }), hx, y + 1.05, hz + 4.03, { collide: false });
    this.addInteractable(door, { prompt: 'Go inside', action: () => g.changeScene('House', 'door') });
    this.box(2.4, 0.15, 1.6, this.mat({ map: this.tex('planks', 2, 1) }), hx, y + 0.075, hz + 4.8);
    this.box(0.25, 0.12, 0.12, this.mat({ color: 0xffe0a0, unlit: true }), hx + 0.9, y + 2.5, hz + 4.1, { collide: false });
    this.addLight({ position: [hx + 0.9, y + 2.5, hz + 5.2], color: 0xffc080, range: 7, intensity: 1, priority: 1.5 });
    this.garden = buildGarden(this, hx, y, hz);
    this.#rooftop(hx, y, hz);
    this.#shed(hx - 10, y, hz + 1);
    this.addSpawn('house_door', [hx, y, hz + 5.6], Math.PI); // on the porch facing the road
    this.addSpawn('default', [hx, y, hz + 5.6], Math.PI);
    this.addSpawn('truck_home', [hx + 7, y, hz + 12], 0);
    this.addSpawn('bike_home', [hx + 3.5, y, hz + 11], 0.25);
    this.addSpawn('skate_home', [hx - 1.0, y, hz + 8.2], 0.5);

    // A few dark neighbours along the road.
    const roofMat = this.mat({ color: 0x2c2628 });
    const wall = this.mat({ map: this.tex('siding', 3, 1.2), color: 0xb0a8a0 });
    const dark = this.mat({ color: 0x0c0e14, unlit: true });
    for (const [x, z, r] of [[-305, 160, 0], [-245, 192, 0], [-120, 222, Math.PI], [-85, 135, 0.6]]) {
      const gy = this.groundHeight(x, z);
      this.box(8, 3, 7, wall, x, gy + 1.5, z, { rotY: r, segments: [3, 2, 3] });
      const rf = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2, 4), roofMat);
      rf.position.set(x, gy + 4, z);
      rf.rotation.y = Math.PI / 4 + r;
      this.root.add(rf);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.8), dark);
      win.position.set(x + Math.sin(r) * 3.52, gy + 1.7, z + Math.cos(r) * 3.52);
      win.rotation.y = r;
      this.root.add(win);
    }

    // Power poles + sagging wires along the town and coast roads.
    this.#powerLine(this.terrain.roads.find((r) => r.name === 'town'), 8);
    this.#powerLine(this.terrain.roads.find((r) => r.name === 'coast'), -8);

    // Streetlights in town and at the junction.
    for (const [x, z] of [[-215, 199], [-150, 186], [-95, 158], [-48, 120], [40, 110]]) this.#streetlight(x, z);

    // Lake road exit (west) → Mirror Lake.
    const lx = this.poi.lakeExit;
    this.#sign(['MIRROR LAKE', '<-- 1/2 MI'], lx.x + 40, lx.z - 7, Math.PI / 2, { bg: '#2e4a2a' });
    this.addTrigger([lx.x - 40, lx.y - 5, lx.z - 20], [lx.x + 12, lx.y + 10, lx.z + 20], (game) =>
      game.changeScene('Lake', 'trail', { truckSpawn: 'truck_parking' }),
    );
    this.addSpawn('lake_road', [lx.x + 24, this.groundHeight(lx.x + 24, lx.z), lx.z], -Math.PI / 2);
    this.addSpawn('truck_lake_road', [lx.x + 30, this.groundHeight(lx.x + 30, lx.z - 1), lx.z - 1], Math.PI / 2);

    // Junction signage.
    const j = this.poi.junction;
    this.#sign(['QUIK MART', 'SUMMIT  ^ 1 MI'], j.x + 7, j.z - 16, 0);
    this.#sign(['HARBOR  >', 'LIGHTHOUSE  >'], j.x + 16, j.z + 7, -Math.PI / 2, { bg: '#1e3a5a' });
  }

  #powerLine(road, side) {
    if (!road) return;
    const S = road.samples;
    const tops = [];
    const poleMat = this.mat({ map: this.tex('bark', 1, 4), color: 0x9a8a7a });
    for (let k = 10; k < S.length - 5; k += 20) {
      const a = S[k];
      const b = S[Math.min(S.length - 1, k + 1)];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      const x = a.x + (-dz / l) * side;
      const z = a.z + (dx / l) * side;
      const y = this.groundHeight(x, z);
      this.box(0.25, 8, 0.25, poleMat, x, y + 4, z);
      this.box(1.6, 0.12, 0.12, poleMat, x, y + 7.6, z, { collide: false, rotY: Math.atan2(dx, dz) + Math.PI / 2 });
      tops.push(new THREE.Vector3(x, y + 7.6, z));
    }
    // Wires: sagging polylines between poles.
    const pts = [];
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i];
      const b = tops[i + 1];
      for (let s = 0; s <= 8; s++) {
        const t = s / 8;
        pts.push(new THREE.Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 1.2));
      }
    }
    const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x18181c }));
    this.root.add(wire);
  }

  #streetlight(x, z, rotY = 0) {
    const y = this.groundHeight(x, z);
    const sl = this.place('streetlight', { x, y, z, rotY });
    this.addColliderBox(x, y + 3, z, 0.3, 6, 0.3);
    const head = new THREE.Vector3(0, 5.4, 1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY).add(new THREE.Vector3(x, y, z));
    const light = this.addLight({ position: head, color: 0xffc890, range: 16, intensity: 1.6 });
    this.updaters.push(() => {
      const on = !this.game.dayNight.isDaylight;
      if (light.enabled === on) return;
      light.enabled = on;
      if (sl.userData.bulb) sl.userData.bulb.material = on ? sl.userData.bulbOn : sl.userData.bulbOff;
    });
    return sl;
  }

  /**
   * A ladder up the east wall to a spot on the roof: lie back and look up,
   * with a telescope set up on the slope beside you.
   */
  #rooftop(hx, y, hz) {
    const g = this.game;
    const wood = this.mat({ color: 0x7a5a3a });
    const lx = hx + 4.62;
    const lz = hz + 1.2;
    for (const dz of [-0.25, 0.25]) this.box(0.06, 4.2, 0.06, wood, lx, y + 2.1, lz + dz, { collide: false });
    for (let i = 0; i < 12; i++) this.box(0.05, 0.04, 0.5, wood, lx, y + 0.3 + i * 0.33, lz, { collide: false });
    const foot = new THREE.Vector3(lx + 0.9, y, lz);
    // The pyramid roof: apex y+5.4, eaves y+3.2 at 5.09 m out. Lie on the
    // south slope near the ridge, head toward the peak, looking up south.
    const roofY = (dx, dz) => y + 5.4 - 2.2 * (Math.max(Math.abs(dx), Math.abs(dz)) / 5.09);
    const sx = hx + 1.4;
    const sz = hz + 2.2;
    const blanket = this.box(1.0, 0.04, 1.8, this.mat({ color: 0x6a2a3a }), sx, roofY(1.4, 2.2) + 0.03, sz, { collide: false });
    blanket.rotation.x = Math.atan2(2.2, 5.09);
    const lie = {
      eye: [sx, roofY(1.4, 2.2) + 0.45, sz - 0.4],
      yaw: Math.PI, // facing south, over the road
      pitch: 0.75,
      yawLimit: 2.6,
      standAt: [foot.x, foot.y, foot.z],
    };
    const ladder = this.interactVolume(lx, y + 1.6, lz, 0.4, 3.2, 0.8, {
      prompt: 'Climb onto the roof',
      range: 2.4,
      enabled: () => !g.player.seated,
      action: () => {
        g.audio.oneShot('footstep_1', { volume: 0.5, rate: 0.7 });
        g.player.sit({ ...lie, eye: new THREE.Vector3(...lie.eye), standAt: foot.clone() });
        g.hud.toast(g.dayNight.isDaylight ? 'Up on the roof. Better at night.' : 'Lie back. Click a star to find out what it is.', 4000);
      },
    });
    void ladder;
    // Telescope on the slope next to the blanket.
    const tx = hx - 0.2;
    const tz = hz + 2.6;
    addTelescope(this, tx, roofY(-0.2, 2.6) - 0.05, tz, Math.PI, foot.clone());
  }

  /**
   * Seaview Diner: a chrome railcar diner facing the coast road, with a row
   * of warm windows and a pink/teal neon sign on the roof. Inside: DinerScene.
   */
  #diner() {
    const g = this.game;
    const p = this.poi.diner;
    const y = p.y;
    const L = 16;
    const D = 6;
    const chrome = this.mat({ color: 0xb8bcc4 });
    const band = this.mat({ color: 0xc8303a });
    const body = this.box(L, 3.2, D, chrome, p.x, y + 1.6, p.z, { segments: [6, 2, 2] });
    void body;
    // barrel roof
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(D / 2 + 0.2, D / 2 + 0.2, L + 0.4, 14, 1, false, 0, Math.PI), this.mat({ color: 0x8a8e96 }));
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = 0;
    roof.scale.set(1, 1, 0.35);
    roof.position.set(p.x, y + 3.2, p.z);
    this.root.add(roof);
    for (const h of [0.5, 2.9]) this.box(L + 0.05, 0.25, D + 0.05, band, p.x, y + h, p.z, { collide: false });
    // windows along the road side (+Z), warm
    const warm = this.mat({ color: 0xffd8a0, unlit: true });
    for (let i = 0; i < 7; i++) {
      if (i === 3) continue; // door goes here
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), warm);
      w.position.set(p.x - L / 2 + 1.4 + i * 2.2, y + 1.85, p.z + D / 2 + 0.01);
      this.root.add(w);
    }
    this.addLight({ position: [p.x, y + 1.8, p.z + D / 2 + 2.5], color: 0xffc890, range: 12, intensity: 1.2 });
    // door + OPEN 24 HRS
    const dx = p.x - L / 2 + 1.4 + 3 * 2.2;
    const door = this.box(1.2, 2.3, 0.08, this.mat({ color: 0xe8e0c8, unlit: true }), dx, y + 1.15, p.z + D / 2 + 0.05, { collide: false });
    this.addInteractable(door, { prompt: 'Go into the diner', action: () => g.changeScene('Diner', 'door') });
    this.addSpawn('diner_door', [dx, y, p.z + D / 2 + 1.8], Math.PI);
    const open = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.35), this.mat({ map: signTexture(['OPEN 24 HRS'], { bg: '#1a0a14', fg: '#ff5aa0', w: 96, h: 32 }), unlit: true }));
    open.position.set(dx + 1.4, y + 2.55, p.z + D / 2 + 0.03);
    this.root.add(open);
    // neon sign on the roof (flickers a little)
    const neonC = document.createElement('canvas');
    neonC.width = 256;
    neonC.height = 64;
    const nc = neonC.getContext('2d');
    nc.fillStyle = '#100810';
    nc.fillRect(0, 0, 256, 64);
    nc.font = 'italic bold 34px Georgia, serif';
    nc.textAlign = 'center';
    nc.shadowBlur = 12;
    nc.shadowColor = '#ff4aa0';
    nc.fillStyle = '#ff7ac0';
    nc.fillText('Seaview', 128, 32);
    nc.shadowColor = '#3affe0';
    nc.fillStyle = '#8afff0';
    nc.font = 'bold 16px Georgia, serif';
    nc.fillText('D I N E R', 128, 54);
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), this.mat({ map: new THREE.CanvasTexture(neonC), unlit: true, fogScale: 0.35, doubleSide: true }));
    neon.position.set(p.x, y + 5.0, p.z + 0.5);
    this.root.add(neon);
    this.box(0.1, 1.2, 0.1, chrome, p.x - 2.5, y + 4.1, p.z + 0.5, { collide: false });
    this.box(0.1, 1.2, 0.1, chrome, p.x + 2.5, y + 4.1, p.z + 0.5, { collide: false });
    const neonLight = this.addLight({ position: [p.x, y + 5, p.z + 3], color: 0xff6ab0, range: 16, intensity: 1.1, priority: 2 });
    this.updaters.push((dt, t) => {
      const f = Math.sin(t * 37) > 0.97 ? 0.3 : 1;
      neonLight.intensity = 1.1 * f;
      neon.visible = f > 0.5;
    });
    // a couple of parked cars' worth of empty lot + a sign at the road
    this.#sign(['SEAVIEW DINER', 'OPEN 24 HRS ->'], p.x + 12, p.z + 16, Math.PI, { bg: '#1a3a4a' });
  }

  /**
   * Pine Hollow Airfield: a mown grass strip running east–west, a tin hangar,
   * a windsock and edge lights. The biplane parks at the west end, facing
   * down the runway.
   */
  #airfield() {
    const g = this.game;
    const A = this.poi.airfield;
    const y0 = A.y;
    const L = 210;
    const W = 18;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(L, W, 26, 4), this.mat({ map: this.tex('grass', 8, 1), color: 0xb8c890 }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(A.x, y0 + 0.04, A.z);
    this.root.add(strip);
    const chalk = this.mat({ color: 0xe8e8e0 });
    for (let x = -L / 2 + 8; x < L / 2 - 6; x += 9) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.4), chalk);
      m.rotation.x = -Math.PI / 2;
      m.position.set(A.x + x, y0 + 0.06, A.z);
      this.root.add(m);
    }
    // threshold numbers 09 / 27
    for (const [x, txt, rot] of [[-L / 2 + 4, '09', -Math.PI / 2], [L / 2 - 4, '27', Math.PI / 2]]) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const k = c.getContext('2d');
      k.fillStyle = '#e8e8e0';
      k.font = 'bold 44px monospace';
      k.textAlign = 'center';
      k.fillText(txt, 32, 48);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), this.mat({ map: new THREE.CanvasTexture(c), opacity: 0.9 }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rot;
      m.position.set(A.x + x, y0 + 0.07, A.z);
      this.root.add(m);
    }
    // edge lights (glow at night)
    const lamp = this.mat({ color: 0xffe0a0, unlit: true });
    for (let x = -L / 2; x <= L / 2; x += 13) {
      for (const dz of [-W / 2, W / 2]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.18), lamp);
        b.position.set(A.x + x, y0 + 0.12, A.z + dz);
        this.root.add(b);
      }
    }
    // hangar: corrugated walls + a rounded roof, open to the runway
    const hx = A.x - 34;
    const hz = A.z - 26;
    const tin = this.mat({ map: this.tex('siding', 4, 1), color: 0x9aa0a8 });
    this.box(0.2, 5, 14, tin, hx - 9, y0 + 2.5, hz);
    this.box(0.2, 5, 14, tin, hx + 9, y0 + 2.5, hz);
    this.box(18, 5, 0.2, tin, hx, y0 + 2.5, hz - 7);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 14.2, 16, 1, true, -Math.PI / 2, Math.PI), this.mat({ color: 0x7a8088, doubleSide: true }));
    roof.rotation.x = Math.PI / 2;
    roof.rotation.z = Math.PI / 2;
    roof.scale.set(1, 1, 0.35);
    roof.position.set(hx, y0 + 5, hz);
    this.root.add(roof);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), this.mat({ map: signTexture(['PINE HOLLOW AIRFIELD'], { bg: '#1a2a4a', fg: '#f0e0a0', w: 192, h: 32 }) }));
    sign.position.set(hx, y0 + 6.3, hz + 7.15);
    this.root.add(sign);
    this.addLight({ position: [hx, y0 + 4.2, hz + 3], color: 0xffd8a0, range: 14, intensity: 1.1 });
    for (let i = 0; i < 3; i++) this.place('cardboard_box', { x: hx - 6 + i * 0.7, y: y0, z: hz - 5.5, rotY: i, collide: true });
    // windsock on a pole: swings with the wind
    const wx = A.x + 20;
    const wz = A.z - 14;
    this.box(0.12, 6, 0.12, this.mat({ color: 0xd8d8d8 }), wx, y0 + 3, wz, { collide: false });
    const sock = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 10, 1, true), this.mat({ color: 0xff7a20, doubleSide: true }));
    sock.geometry.rotateX(-Math.PI / 2);
    sock.geometry.translate(0, 0, 1.2);
    sock.position.set(wx, y0 + 5.8, wz);
    this.root.add(sock);
    this.updaters.push((dt, t) => {
      const w = g.weather.wind;
      sock.rotation.y = 0.8 + Math.sin(t * 0.3) * 0.4 * w;
      sock.rotation.x = 0.9 - w * 0.8 + Math.sin(t * 3) * 0.05;
    });
    this.#sign(['AIRFIELD', 'NO JOYRIDES', '(please)'], A.x - L / 2 - 6, A.z + 12, -Math.PI / 2, { bg: '#2a3a5a' });
    this.addSpawn('plane_park', [A.x - L / 2 + 10, y0, A.z], Math.PI / 2); // facing east, down the strip
    this.addSpawn('airfield', [A.x - L / 2 + 10, y0, A.z + 8], Math.PI); // beside the plane
  }

  /** The old silver mine: a timbered portal in the mountainside, rails running out of it. */
  #mineEntrance() {
    const g = this.game;
    const M = this.poi.mine;
    const x = M.x;
    const z = M.z - 9;
    const y = this.groundHeight(x, z);
    const timber = this.mat({ map: this.tex('planks', 1, 1), color: 0x6a4a2e });
    const rock = this.mat({ map: this.tex('rock', 3, 2), color: 0x7a7068 });
    // the hillside it's cut into + the dark hole
    this.box(16, 10, 6, rock, x, y + 4.5, z - 3.4);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.4), this.mat({ color: 0x050403, unlit: true }));
    hole.position.set(x, y + 1.7, z - 0.38);
    this.root.add(hole);
    for (const dx of [-1.8, 1.8]) this.box(0.4, 3.8, 0.4, timber, x + dx, y + 1.9, z, { collide: true });
    this.box(4.4, 0.45, 0.5, timber, x, y + 3.9, z);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.7), this.mat({ map: signTexture(['PINE HOLLOW SILVER MINE · 1891'], { bg: '#3a2414', fg: '#f0d890', w: 224, h: 40 }) }));
    sign.position.set(x, y + 4.5, z + 0.3);
    this.root.add(sign);
    // rails out of the portal, a parked cart, barrels, a lantern
    for (let k = 0; k < 8; k++) {
      const sl = this.box(1.5, 0.08, 0.22, this.mat({ color: 0x3a2a1c }), x, y + 0.04, z + 1 + k * 1.2, { collide: false });
      void sl;
    }
    for (const dx of [-0.45, 0.45]) this.box(0.07, 0.08, 9.6, this.mat({ color: 0x5a5a60 }), x + dx, y + 0.12, z + 5.2, { collide: false });
    this.place('minecart', { x, y, z: z + 7, rotY: Math.PI / 2, collide: true });
    this.place('lantern', { x: x + 1.8, y: y + 3.0, z: z + 0.35 });
    this.addLight({ position: [x + 1.8, y + 3, z + 0.8], color: 0xffa860, range: 9, intensity: 1.2, flicker: 0.12 });
    this.interactVolume(x, y + 1.7, z - 0.2, 3.2, 3.4, 1.0, {
      prompt: 'Enter the old mine',
      action: () => g.changeScene('Cave', 'entrance'),
    });
    this.addSpawn('mine_door', [x, y, z + 3], Math.PI);
    this.#sign(['OLD MINE', 'TOURS: NEVER', 'ASSAY OFFICE: OPEN'], x + 6, z + 8, 0, { bg: '#4a3420' });
  }

  /** Stardust Lanes: a flat-roofed box with a neon sign, door facing the road (north). */
  #bowlingAlley() {
    const g = this.game;
    const B = this.poi.bowling;
    const y = B.y;
    this.box(16, 5, 11, this.mat({ map: this.tex('siding', 5, 2), color: 0x6a5a7a }), B.x, y + 2.5, B.z + 1);
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.4), this.mat({ map: signTexture(['★ STARDUST LANES ★'], { bg: '#1a0a2a', fg: '#ff60d0', w: 256, h: 48 }), unlit: true }));
    neon.position.set(B.x, y + 5.6, B.z - 4.55);
    neon.rotation.y = Math.PI;
    this.root.add(neon);
    this.box(7.2, 1.6, 0.1, this.mat({ color: 0x2a1a3a }), B.x, y + 5.6, B.z - 4.5, { collide: false });
    this.addLight({ position: [B.x, y + 4, B.z - 6.5], color: 0xff60d0, range: 12, intensity: 1.2, flicker: 0.05 });
    const door = this.box(1.4, 2.3, 0.08, this.mat({ color: 0x3a1a3a }), B.x + 2.5, y + 1.15, B.z - 4.54, { collide: false });
    this.addInteractable(door, { prompt: 'Go into Stardust Lanes (bowling)', action: () => g.changeScene('Bowling', 'door') });
    this.addSpawn('bowling_door', [B.x + 2.5, y, B.z - 6.5], 0);
  }

  /** The music shed beside the house (inside: StudioScene). Door faces south. */
  #shed(x, y, z) {
    const g = this.game;
    const wall = this.mat({ map: this.tex('siding', 2, 1), color: 0x8a7a8a });
    this.box(5, 2.9, 4.2, wall, x, y + 1.45, z);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.1, 4), this.mat({ color: 0x2a2224 }));
    roof.position.set(x, y + 3.45, z);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.85;
    this.root.add(roof);
    const door = this.box(1.0, 2.0, 0.06, this.mat({ color: 0x3a2a3a }), x, y + 1.0, z + 2.13, { collide: false });
    this.addInteractable(door, { prompt: 'Go into the music shed', action: () => g.changeScene('Studio', 'door') });
    this.addSpawn('studio_door', [x, y, z + 3.1], Math.PI);
    // a lit window with coloured light, and a little sign
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), this.mat({ color: 0xff7ab8, unlit: true }));
    win.position.set(x + 1.6, y + 1.7, z + 2.11);
    this.root.add(win);
    this.addLight({ position: [x + 1.6, y + 1.6, z + 3.2], color: 0xff6ab0, range: 5, intensity: 0.8 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.35), this.mat({ map: signTexture(['MUSIC SHED'], { bg: '#2a1a3a', fg: '#ffd860', w: 96, h: 28 }) }));
    sign.position.set(x, y + 2.35, z + 2.12);
    this.root.add(sign);
  }

  #sign(lines, x, z, rotY, opts = {}) {
    const y = this.groundHeight(x, z);
    const post = this.mat({ color: 0x5a5a60 });
    this.box(0.1, 2.2, 0.1, post, x, y + 1.1, z);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), this.mat({ map: signTexture(lines, opts), doubleSide: true, affine: 0 }));
    m.position.set(x, y + 2.2, z);
    m.rotation.y = rotY;
    this.root.add(m);
  }

  // ---------------------------------------------------------------------------
  // Mountain: signs + guardrails on some hairpins (not all — it's sketchy)
  // ---------------------------------------------------------------------------

  #mountain() {
    const road = this.terrain.roads.find((r) => r.name === 'mountain');
    const S = road.samples;
    const at = (t) => S[Math.floor(t * (S.length - 1))];
    const s0 = at(0.03);
    this.#sign(['STEEP GRADE', '16%  NEXT 2 MI'], s0.x + 5, s0.z + 2, 0, { bg: '#d8b020', fg: '#101010' });
    const s1 = at(0.44);
    this.#sign(['PAVEMENT ENDS'], s1.x + 4.5, s1.z, 0.3, { bg: '#d8b020', fg: '#101010', h: 40 });
    const s2 = at(0.7);
    this.#sign(['NO GUARDRAIL', 'NEXT CURVES'], s2.x - 4.5, s2.z + 2, Math.PI, { bg: '#d8b020', fg: '#101010' });

    // Guardrails on the downhill side of a couple of early stretches only.
    const railMat = this.mat({ color: 0x9a9aa0 });
    for (const [a, b] of [
      [0.08, 0.16],
      [0.28, 0.36],
    ]) {
      const i0 = Math.floor(a * (S.length - 1));
      const i1 = Math.floor(b * (S.length - 1));
      for (let k = i0; k < i1; k += 2) {
        const p = S[k];
        const q = S[k + 2] ?? S[k + 1];
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l;
        const nz = dx / l;
        const left = this.groundHeight(p.x + nx * 5, p.z + nz * 5);
        const right = this.groundHeight(p.x - nx * 5, p.z - nz * 5);
        const sgn = left < right ? 1 : -1;
        const x = p.x + nx * sgn * (road.width / 2 + 0.4);
        const z = p.z + nz * sgn * (road.width / 2 + 0.4);
        this.box(l + 0.1, 0.3, 0.08, railMat, x + dx / 2, p.y + 0.65, z + dz / 2, { rotY: Math.atan2(dx, dz) + Math.PI / 2 });
        this.box(0.1, 0.8, 0.1, railMat, x, p.y + 0.4, z, { collide: false });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Summit gas station (exterior of the Quik Mart)
  // ---------------------------------------------------------------------------

  #gasStation() {
    const g = this.game;
    const p = this.poi.gasStation;
    const y = p.y;
    const sx = p.x;
    const sz = p.z - 18; // store at the back of the plateau, facing south (+Z)

    this.plane(46, 40, this.mat({ map: this.tex('asphalt', 12, 10) }), p.x, y + 0.04, p.z - 2, { segs: 10, collide: false });
    this.box(16, 4.5, 12, this.mat({ map: this.tex('brick', 6, 2) }), sx, y + 2.25, sz, { segments: [4, 2, 4] });
    this.box(16.4, 0.3, 12.4, this.mat({ color: 0x1e1e22 }), sx, y + 4.6, sz, { collide: false });
    const front = sz + 6.01;
    const glow = this.mat({ color: 0xd8e8e8, unlit: true });
    for (const x of [sx - 4.5, sx + 4]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.7), glow);
      win.position.set(x, y + 1.5, front);
      this.root.add(win);
    }
    this.addLight({ position: [sx, y + 1.8, front + 2], color: 0xd0f0ff, range: 8, intensity: 1.1, priority: 1.5 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), this.mat({ map: this.tex('sign_store'), unlit: true }));
    sign.position.set(sx, y + 3.6, front + 0.02);
    this.root.add(sign);
    // Tall pole sign so the glow reads through the fog on the way up.
    this.box(0.3, 9, 0.3, this.mat({ color: 0x3a3a40 }), sx + 14, y + 4.5, sz + 10);
    const pole = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.2), this.mat({ map: this.tex('sign_store'), unlit: true, fogScale: 0.5, doubleSide: true }));
    pole.position.set(sx + 14, y + 9.4, sz + 10);
    this.root.add(pole);

    const door = this.box(1.6, 2.3, 0.06, this.mat({ color: 0x9ab0b8, unlit: true }), sx - 0.5, y + 1.15, front + 0.03, { collide: false });
    this.addInteractable(door, { prompt: 'Enter Quik Mart', action: () => g.changeScene('GroceryStore', 'door') });
    this.addSpawn('store_door', [sx - 0.5, y, front + 1.6], Math.PI);

    // Canopy + pumps in front.
    const cz = p.z + 4;
    const metal = this.mat({ color: 0x8a8a90 });
    for (const [dx, dz] of [[-4, -4], [-4, 4], [4, -4], [4, 4]]) this.box(0.25, 4.2, 0.25, metal, sx + dx, y + 2.1, cz + dz);
    this.box(10, 0.5, 11, this.mat({ color: 0xd8d8d0 }), sx, y + 4.45, cz, { collide: false });
    this.box(9.6, 0.04, 10.6, this.mat({ color: 0xf0f8ff, unlit: true }), sx, y + 4.18, cz, { collide: false });
    this.box(10, 0.2, 0.05, this.mat({ color: 0xc02020, unlit: true }), sx, y + 4.45, cz + 5.51, { collide: false });

    // Scenic overlook on the west edge of the summit: rail, bench, telescope.
    const ox = p.x - 26;
    const oz = p.z + 4;
    const oy = this.groundHeight(ox, oz);
    const rail = this.mat({ color: 0x5a5a60 });
    this.box(0.08, 1.0, 9, rail, ox - 2.2, oy + 0.5, oz);
    for (let k = -4; k <= 4; k += 2) this.box(0.1, 1.0, 0.1, rail, ox - 2.2, oy + 0.5, oz + k, { collide: false });
    addTelescope(this, ox - 1.2, oy, oz, -Math.PI / 2 + 0.3, new THREE.Vector3(ox + 0.4, oy, oz));
    const bench = this.box(1.6, 0.08, 0.45, this.mat({ map: this.tex('planks', 1, 1) }), ox, oy + 0.45, oz + 3, { collide: false });
    this.box(1.6, 0.45, 0.4, this.mat({ color: 0x3a3a40 }), ox, oy + 0.22, oz + 3);
    addSeat(this, bench, { eye: [ox, oy + 1.15, oz + 3], yaw: -Math.PI / 2, pitch: 0.3, yawLimit: 2.2, standAt: [ox + 0.8, oy, oz + 3] });
    this.#sign(['SCENIC', 'OVERLOOK'], ox + 1.5, oz - 4.5, Math.PI / 2, { bg: '#5a3a1a' });
    this.addLight({ position: [sx, y + 3.8, cz], color: 0xe8f4ff, range: 12, intensity: 1.2, priority: 2 });
    this.addSound('fluorescent_hum', new THREE.Vector3(sx, y + 4, cz), { volume: 0.3, refDistance: 2 });
    for (const dx of [-2, 2]) {
      this.box(0.6, 1.6, 0.9, this.mat({ color: 0xc8c4b8 }), sx + dx, y + 0.8, cz);
      this.box(0.62, 0.3, 0.6, this.mat({ color: 0x30c040, unlit: true }), sx + dx, y + 1.3, cz, { collide: false });
    }
    // Vending machine by the door.
    const vend = this.box(0.9, 1.9, 0.8, this.mat({ map: this.tex('fridge_drinks', 1, 1), unlit: true }), sx + 3, y + 0.95, front + 0.5);
    this.addLight({ position: [sx + 3, y + 1.2, front + 1.4], color: 0x90c0ff, range: 3.5, intensity: 0.8 });
    this.addInteractable(vend, {
      prompt: 'Vending machine — Popsi $1.25',
      available: () => (g.inventory.money >= 1.25 ? true : 'Vending machine — not enough change'),
      action: () => {
        g.inventory.spend(1.25);
        g.inventory.add('soda');
        g.audio.oneShot('door', { volume: 0.3, rate: 1.8 });
        g.hud.toast('*clunk*');
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Harbor: pier, boathouse, moored boat + jet ski
  // ---------------------------------------------------------------------------

  #harbor() {
    const h = this.poi.harbor;
    const deck = 1.9;
    const z = h.z;
    const x0 = h.x + 20;
    const x1 = h.x + 72;
    const planks = this.mat({ map: this.tex('planks', 1, 12) });
    this.box(x1 - x0, 0.2, 3, planks, (x0 + x1) / 2, deck - 0.1, z, { segments: [12, 1, 2] });
    const post = this.mat({ map: this.tex('bark') });
    for (let x = x0 + 2; x <= x1; x += 5) for (const dz of [-1.6, 1.6]) this.box(0.3, 8, 0.3, post, x, deck - 4, z + dz, { collide: false });
    // Invisible rails so you don't walk off the pier.
    this.addColliderBox((x0 + x1) / 2, deck + 0.6, z - 1.65, x1 - x0, 1.2, 0.2);
    this.addColliderBox((x0 + x1) / 2, deck + 0.6, z + 1.65, x1 - x0, 1.2, 0.2);
    this.addColliderBox(x1 + 0.1, deck + 0.6, z, 0.2, 1.2, 3.4);
    // Ramp from the beach up to the deck.
    const rampY = this.groundHeight(x0 - 7, z);
    const ramp = this.box(7.2, 0.2, 3, planks, x0 - 3.5, (rampY + deck) / 2 - 0.05, z, { collide: false });
    ramp.rotation.z = Math.atan2(deck - rampY, 7);
    this.addColliderMesh(ramp);

    this.#streetlight(x0 + 2, z - 2.3, Math.PI);
    this.#streetlight(x1 - 3, z + 2.3, 0);
    this.addSound('water_lapping', new THREE.Vector3((x0 + x1) / 2, 1, z), { volume: 0.7, refDistance: 4 });

    // Boathouse shack + crates on the shore.
    const shackX = h.x - 4;
    const shackZ = h.z - 14;
    const sy = this.groundHeight(shackX, shackZ);
    this.box(7, 3, 5, this.mat({ map: this.tex('planks', 3, 1), color: 0x9a8a78 }), shackX, sy + 1.5, shackZ);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 1.6, 4), this.mat({ color: 0x3a2a24 }));
    roof.position.set(shackX, sy + 3.8, shackZ);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.75;
    this.root.add(roof);
    const lit = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.7), this.mat({ color: 0xd8a868, unlit: true }));
    lit.position.set(shackX + 1.5, sy + 1.8, shackZ + 2.51);
    this.root.add(lit);
    this.addLight({ position: [shackX + 1.5, sy + 1.8, shackZ + 3.5], color: 0xffb070, range: 5, intensity: 0.8 });
    for (let i = 0; i < 4; i++) this.place('cardboard_box', { x: shackX + 4 + (i % 2) * 0.6, y: sy + Math.floor(i / 2) * 0.5, z: shackZ + 2 + (i % 2) * 0.3, rotY: i, collide: true });
    this.#sign(['HARBOR', 'NO WAKE'], h.x - 8, h.z + 10, -Math.PI / 2, { bg: '#1e3a5a' });

    // Dive shop: a stall by the shack (rents gear, buys what you bring up), and a ladder at the pier end.
    const g = this.game;
    const dsx = h.x + 8;
    const dsz = h.z - 9;
    const dsy = this.groundHeight(dsx, dsz);
    this.box(2.4, 1.0, 0.8, this.mat({ color: 0x2a6a9a }), dsx, dsy + 0.5, dsz);
    const dsSign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), this.mat({ map: signTexture(['DIVE SHOP', 'RENTALS · NO SHARKS'], { bg: '#0a3a5a', fg: '#8af0ff' }) }));
    dsSign.position.set(dsx, dsy + 2.0, dsz - 0.2);
    this.root.add(dsSign);
    for (const dx of [-1.1, 1.1]) this.box(0.08, 2.2, 0.08, this.mat({ color: 0x5a5a5a }), dsx + dx, dsy + 1.1, dsz - 0.2, { collide: false });
    const diver = this.place('npc_worker', { x: dsx, y: dsy, z: dsz - 0.9, rotY: 0 });
    this.animate(diver, 'Idle');
    this.addInteractable(diver, {
      prompt: 'Dive shop (gear · sell shells, pearls, coins)',
      range: 3,
      action: () => {
        g.hud.toast(['“Mask, fins, tank. And breathe slow — it all lasts longer.”', '“No sharks out there. Just a very nosy octopus.”', '“The wreck’s south of the pier. The whale comes by most nights.”'][Math.floor(Math.random() * 3)], 3500);
        g.openUI(() => g.shopping.open('dive'));
      },
    });
    const ladderX = x1 - 1.2;
    this.box(0.5, 2.6, 0.1, this.mat({ color: 0x8a8a8a }), ladderX, deck - 1.1, z + 1.55, { collide: false });
    this.interactVolume(ladderX, deck + 0.5, z, 1.4, 1.2, 3, {
      prompt: () => (g.inventory.has('dive_mask') ? 'Dive in (into the bay)' : 'Too cold to swim without gear — the dive shop rents it'),
      action: () => {
        if (!g.inventory.has('dive_mask')) return g.hud.toast('You need a mask & fins from the dive shop by the shack.', 3000);
        g.audio.oneShot('splash', { volume: 0.8 });
        g.changeScene('Sea', 'pier');
      },
    });
    this.addSpawn('dive_out', [ladderX - 1.5, deck, z], -Math.PI / 2);

    // The shack is Harbor Fish Co.: the night window buys fish and venison,
    // paying 25% more than the Quik Mart clerk.
    const shopSign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), this.mat({ map: signTexture(['HARBOR FISH CO.', 'WE BUY FISH & GAME'], { bg: '#5a2a1a' }), affine: 0 }));
    shopSign.position.set(shackX + 1.2, sy + 2.6, shackZ + 2.53);
    this.root.add(shopSign);
    const inv = g.inventory;
    const RATE = 1.25;
    const haul = () => inv.list().filter((i) => i.catch && i.value > 0);
    const total = () => haul().reduce((t, i) => t + i.value * RATE * i.count, 0);
    const lines = ['"Fresh enough." The window slams.', '"Catfish again. Fine."', '"Don\'t ask where it goes."', '"Same time tomorrow."'];
    this.interactVolume(shackX + 1.5, sy + 1.5, shackZ + 2.9, 1.4, 2, 0.8, {
      prompt: () => (haul().length ? `Sell your catch ($${total().toFixed(2)})` : 'Knock on the window'),
      action: () => {
        const items = haul();
        if (!items.length) {
          g.audio.oneShot('door', { volume: 0.4, rate: 1.6 });
          g.hud.toast('"We buy fish and deer meat. Come back with some."', 3500);
          return;
        }
        const t = total();
        for (const it of items) inv.remove(it.id, it.count);
        inv.earn(t);
        g.audio.oneShot('register', { volume: 0.7 });
        g.hud.toast(`Sold ${items.reduce((n, i) => n + i.count, 0)} item(s) for $${t.toFixed(2)}. ${lines[Math.floor(Math.random() * lines.length)]}`, 4500);
      },
      secondary: () => (haul().length ? { label: 'Prices', action: () => g.hud.toast(haul().map((i) => `${i.name} $${(i.value * RATE).toFixed(2)}`).join(' · '), 5000) } : null),
    });

    // Moorings: where vessels wait, and where you can step back onto the pier.
    this.addSpawn('boat_mooring', [x1 - 8, 0, z + 5.2], Math.PI / 2);
    this.addSpawn('jetski_mooring', [x1 - 22, 0, z - 3.4], Math.PI / 2);
    for (const [x, dz] of [[x1 - 8, 1.1], [x1 - 22, -1.1], [x0 + 6, 0]]) this.game.vehicles.addMooring('World', new THREE.Vector3(x, deck, z + dz));
    this.addSpawn('pier', [x0 + 6, deck, z], -Math.PI / 2);
  }

  // ---------------------------------------------------------------------------
  // Lighthouse on the cliff
  // ---------------------------------------------------------------------------

  #lighthouse() {
    const g = this.game;
    const L = this.poi.lighthouse;
    const lx = L.x + 4;
    const lz = L.z - 4;
    this.deckH = 15.0; // gallery deck height above the base
    const tower = this.place('lighthouse', { x: lx, y: L.y, z: lz, rotY: -Math.PI / 2 });
    // The model is one baked mesh, 22 m tall. Measured from its vertices
    // (local +X ends up facing world +Z, i.e. south):
    //   - porch with the door at the base, door face 5.8 m south of the origin
    //   - plinth r≈4 m up to 2 m, tower r≈3 m, gallery deck r≈3.3 m at ~15 m,
    //     lantern room r≈2 m from the deck to the cap.
    // Collision is built from those numbers instead of one fat bounding box.
    const ax = lx;
    const az = lz - 1.0; // tower axis (the model is off-centre)
    // Round-ish solid of radius r: 8 slabs (2r × octagon side) fanned around
    // the axis. Two crossed squares would poke corners out to r·√2.
    const octa = (y0, y1, r) => {
      const side = 2 * r * Math.tan(Math.PI / 8);
      for (let i = 0; i < 8; i++) this.addColliderBox(ax, (y0 + y1) / 2, az, r * 2, y1 - y0, side, (i * Math.PI) / 8);
    };
    octa(L.y, L.y + 1.75, 3.9); // plinth (its top is the landing)
    octa(L.y, L.y + this.deckH - 0.15, 2.9); // tower body
    octa(this.deckY = L.y + this.deckH - 0.3, L.y + this.deckH, 3.4); // gallery deck
    octa(L.y + this.deckH, L.y + 22, 1.95); // lantern room
    // The model's front steps (0.5 / 0.9 / 1.3 m, landing 1.75 m), as small
    // risers so the capsule walks up them smoothly.
    for (let i = 0; i < 16; i++) {
      const top = 0.11 * (i + 1);
      const z = lz + 5.3 - i * 0.16;
      this.addColliderBox(ax, L.y + top / 2, z, 2.4, top, 0.16);
    }
    // Gallery railing (invisible: the model has its own rail).
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.addColliderBox(ax + Math.cos(a) * 3.35, L.y + this.deckH + 0.55, az + Math.sin(a) * 3.35, 0.15, 1.1, 1.4, -a);
    }
    const tb = this.bounds(tower);
    this.lantern = new THREE.Vector3(ax, tb.max.y - 1.6, az);

    // Lantern glow + rotating twin beams that sweep through the fog.
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), this.mat({ color: 0xfff2c0, unlit: true, fogScale: 0.15 }));
    glow.position.copy(this.lantern);
    this.root.add(glow);
    const beamGeo = new THREE.ConeGeometry(3.2, 60, 10, 1, true);
    beamGeo.translate(0, -30, 0);
    beamGeo.rotateZ(Math.PI / 2);
    const beamMat = this.mat({ color: 0xfff0c8, unlit: true, opacity: 0.09, additive: true, doubleSide: true, fogScale: 0.35 });
    this.beams = new THREE.Group();
    this.beams.position.copy(this.lantern);
    for (const r of [0, Math.PI]) {
      const b = new THREE.Mesh(beamGeo, beamMat);
      b.rotation.y = r;
      b.frustumCulled = false;
      this.beams.add(b);
    }
    this.root.add(this.beams);
    this.beamLight = this.addLight({ position: this.lantern.clone(), color: 0xfff0c8, range: 18, intensity: 1.0, priority: 2 });
    this.updaters.push((_dt, t) => {
      const a = t * 0.6;
      this.beams.rotation.y = a;
      // A pool of light that rides the beam across the cliff top.
      this.beamLight.position.set(ax - Math.cos(a) * 12, L.y + 2, az + Math.sin(a) * 12);
    });
    // Foghorn every so often (louder the closer you are).
    let horn = 6;
    this.updaters.push((dt) => {
      horn -= dt;
      if (horn > 0) return;
      horn = 28 + Math.random() * 20;
      const d = g.camera.position.distanceTo(this.lantern);
      if (d < 260) g.audio.oneShot('foghorn', { volume: Math.max(0.15, 1 - d / 260) });
    });

    // The model's own door, at the top of its steps (south face).
    const doorZ = lz + 2.4;
    const doorLight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), this.mat({ color: 0xffd890, unlit: true }));
    doorLight.position.set(ax, L.y + 4.1, doorZ + 0.12);
    this.root.add(doorLight);
    this.addLight({ position: new THREE.Vector3(ax, L.y + 3.6, doorZ + 1.4), color: 0xffc070, range: 8, intensity: 0.9 });
    this.interactVolume(ax, L.y + 2.8, doorZ + 0.15, 1.5, 1.9, 0.5, {
      prompt: 'Enter the lighthouse',
      action: () => g.changeScene('Lighthouse', 'door'),
    });
    this.addSpawn('lighthouse_door', [ax, L.y + 1.8, doorZ + 0.9], Math.PI); // on the landing, facing out

    // ---- the gallery up top ------------------------------------------------------
    // Reached from the stairs inside. A ring you can walk around, the lamp
    // turning over your head, and a crate to sit on facing the sea.
    const dy = L.y + this.deckH;
    this.interactVolume(ax - 2.05, dy + 1, az, 0.5, 2, 1.2, {
      prompt: 'Climb down',
      action: () => g.changeScene('Lighthouse', 'hatch'),
    });
    // Iron railing (posts + two rails) and the lamp's spill on the deck.
    const iron = this.mat({ color: 0x2a2a2e });
    const rails = new THREE.Group();
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 1) / 24) * Math.PI * 2;
      const r = 3.3;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), iron);
      post.position.set(ax + Math.cos(a0) * r, dy + 0.52, az + Math.sin(a0) * r);
      rails.add(post);
      const len = 2 * r * Math.sin(Math.PI / 24);
      for (const h of [0.5, 1.03]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), iron);
        const am = (a0 + a1) / 2;
        rail.position.set(ax + Math.cos(am) * r * Math.cos(Math.PI / 24), dy + h, az + Math.sin(am) * r * Math.cos(Math.PI / 24));
        rail.rotation.y = -am + Math.PI / 2;
        rails.add(rail);
      }
    }
    this.root.add(rails);
    this.addLight({ position: new THREE.Vector3(ax, dy + 3.2, az), color: 0xffe0a0, range: 9, intensity: 0.8, priority: 2 });
    this.addSpawn('lighthouse_gallery', [ax - 2.7, dy, az], Math.PI / 2);
    const crate = this.box(0.5, 0.45, 0.5, this.mat({ map: this.tex('planks', 1, 1), color: 0x9a8a70 }), ax + 2.65, dy + 0.225, az, { collide: false });
    addSeat(this, crate, {
      eye: [ax + 2.6, dy + 1.1, az],
      yaw: -Math.PI / 2, // east, out to sea
      yawLimit: 2.2,
      standAt: [ax + 2.5, dy, az - 0.8],
    });
    // A brass telescope on the gallery, pointed at the shipping lane.
    addTelescope(this, ax + 1.9, dy, az - 2.2, -Math.PI / 2 + 0.15, new THREE.Vector3(ax + 1.2, dy, az - 1.4), { sea: true });
    this.#sign(['KEEP OFF', 'CLIFF EDGE'], L.x + 16, L.z + 14, Math.PI * 0.75, { bg: '#d8b020', fg: '#101010' });
    this.place('log', { x: L.x + 12, y: L.y, z: L.z + 8, rotY: 0.4, scale: 0.6, collide: true });
  }

  // ---------------------------------------------------------------------------
  // Trees, grass, bushes, rocks (instanced, chunked)
  // ---------------------------------------------------------------------------

  #nature() {
    const T = this.terrain;
    const rand = this.rand;
    const keepOut = Object.values(this.poi)
      .filter((p) => p.radius)
      .concat([{ ...this.poi.house, radius: 34 }]);
    const ok = (x, z, clear) => {
      if (T.roadDistance(x, z) < clear) return false;
      for (const p of keepOut) if (Math.hypot(x - p.x, z - p.z) < p.radius + 6) return false;
      return true;
    };
    const lists = { tree_pine: [], tree_pine2: [], tree_oak: [], grass: [], bush: [], rock: [], rock2: [] };
    const half = MAP.size / 2 - 10;
    let trees = 0;
    // Trees: dense on the mountain flanks, sparse in the valley.
    for (let i = 0; i < 60000 && trees < 10500; i++) {
      const x = (rand() * 2 - 1) * half;
      const z = (rand() * 2 - 1) * half;
      const y = T.heightAt(x, z);
      if (y < 2.5 || T.slopeAt(x, z) > 0.4) continue;
      const density = z < -40 ? 0.98 : 0.72;
      if (rand() > density || !ok(x, z, 8)) continue;
      const kind = z < -60 || y > 30 ? (rand() < 0.55 ? 'tree_pine' : 'tree_pine2') : rand() < 0.5 ? 'tree_oak' : 'tree_pine2';
      const s = 0.7 + rand() * 0.6;
      lists[kind].push({ x, y: y - 0.1, z, rotY: rand() * 6, scale: s });
      this.addColliderBox(x, y + 1.5, z, 0.6 * s, 3, 0.6 * s);
      trees++;
    }
    for (let i = 0; i < 4200; i++) {
      const x = (rand() * 2 - 1) * half;
      const z = (rand() * 2 - 1) * half;
      const y = T.heightAt(x, z);
      if (y < 2 || !ok(x, z, 5)) continue;
      const kind = rand() < 0.78 ? 'grass' : 'bush';
      lists[kind].push({ x, y, z, rotY: rand() * 6, scale: 0.7 + rand() * 0.8 });
    }
    for (let i = 0; i < 380; i++) {
      const x = (rand() * 2 - 1) * half;
      const z = -40 - rand() * (half - 40);
      const y = T.heightAt(x, z);
      if (!ok(x, z, 6)) continue;
      const s = 0.6 + rand() * 1.4;
      lists[rand() < 0.5 ? 'rock' : 'rock2'].push({ x, y: y - 0.2, z, rotY: rand() * 6, scale: s });
      this.addColliderBox(x, y + 0.5, z, 1.2 * s, 1, 1.2 * s);
    }
    for (const [key, items] of Object.entries(lists)) this.scatter(key, items);
  }

  #bounds() {
    const h = MAP.size / 2 - 4;
    this.addColliderBox(-h, 60, 0, 2, 300, MAP.size);
    this.addColliderBox(h, 60, 0, 2, 300, MAP.size);
    this.addColliderBox(0, 60, h, MAP.size, 300, 2);
    this.addColliderBox(0, 60, -h, MAP.size, 300, 2);
  }
}

function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
