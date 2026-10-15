import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { addMusicDevice, addSeat } from './Devices.js';
import { signTexture } from '../core/Procedural.js';

/**
 * DinerScene
 * ----------
 * Inside the Seaview Diner (off the coast road): your restaurant model, lit
 * warm and low. A counter by the door where Dolores takes your order
 * (coffee, pancakes, burger, pie, strawberry milkshake), a jukebox on the
 * shared music player, and tables you can sit at — found automatically by
 * probing the model for table tops.
 */
export class DinerScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Diner', label: 'seaview diner' });
    this.indoor = { fog: 0x2a1e18, near: 10, far: 55, ambient: 0x8a7a6e, daylight: 0.35 };
  }

  build() {
    const g = this.game;
    const model = this.place('diner', { x: 0, y: 0, z: 0 });
    // Everything in the model collides (walls, columns, tables, chairs).
    model.updateMatrixWorld(true);
    model.traverse((o) => o.isMesh && this.addColliderMesh(o));
    const b = this.bounds(model);
    this.b = b;

    // Find the floor and the table tops by probing straight down.
    const ray = new THREE.Raycaster();
    const meshes = [];
    model.traverse((o) => o.isMesh && meshes.push(o));
    const down = new THREE.Vector3(0, -1, 0);
    const probe = (x, z) => {
      ray.set(new THREE.Vector3(x, b.max.y - 0.3, z), down);
      ray.far = b.max.y - b.min.y + 1;
      return ray.intersectObjects(meshes, false);
    };
    // floor = most common lowest hit height near the middle
    const lows = [];
    for (let i = 0; i < 40; i++) {
      const hits = probe(THREE.MathUtils.lerp(b.min.x + 2, b.max.x - 2, Math.random()), THREE.MathUtils.lerp(b.min.z + 2, b.max.z - 2, Math.random()));
      if (hits.length) lows.push(hits.at(-1).point.y);
    }
    lows.sort((a, c) => a - c);
    this.floorY = lows[Math.floor(lows.length / 2)] ?? b.min.y;
    const tables = [];
    for (let x = b.min.x + 1; x < b.max.x - 1; x += 0.6) {
      for (let z = b.min.z + 1; z < b.max.z - 1; z += 0.6) {
        const hits = probe(x, z);
        const top = hits.find((h) => h.point.y > this.floorY + 0.6 && h.point.y < this.floorY + 0.9);
        if (!top) continue;
        const near = tables.find((t) => Math.hypot(t.x - x, t.z - z) < 1.6);
        if (near) {
          near.n++;
          near.x += (x - near.x) / near.n;
          near.z += (z - near.z) / near.n;
        } else tables.push({ x, z, y: top.point.y, n: 1 });
      }
    }
    this.tables = tables.filter((t) => t.n >= 2);

    // Probe helpers: the floor under a point (first surface below 2.5 m,
    // ignoring table tops) and the distance to a wall along a direction.
    const floorAt = (x, z) => {
      const hits = probe(x, z).filter((h) => h.point.y < 0.9 + b.min.y);
      return hits.length ? hits[0].point.y : null;
    };
    const wallDist = (from, dir) => {
      ray.set(from, dir);
      ray.far = 40;
      return ray.intersectObjects(meshes, false)[0]?.distance ?? 40;
    };
    // Entrance: the walkable floor nearest the +Z wall on the west side.
    let ex = b.min.x + (b.max.x - b.min.x) * 0.25;
    let ez = b.max.z - 3;
    for (let z = b.max.z - 1; z > b.min.z; z -= 0.5) {
      if (floorAt(ex, z) !== null) {
        ez = z - 1.5;
        break;
      }
    }
    const fy = floorAt(ex, ez) ?? this.floorY;
    const wallZ = ez + wallDist(new THREE.Vector3(ex, fy + 1.2, ez), new THREE.Vector3(0, 0, 1));
    this.addSpawn('door', [ex, fy + 0.05, ez], 0);
    this.addSpawn('default', [ex, fy + 0.05, ez], 0);
    const door = this.box(1.6, 2.4, 0.1, this.mat({ color: 0x8a6a4a }), ex, fy + 1.2, wallZ - 0.06, { collide: false });
    const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.2), this.mat({ map: signTexture(['EXIT'], { bg: '#1a6a2a', w: 64, h: 24 }), unlit: true }));
    exitSign.position.set(ex, fy + 2.65, wallZ - 0.12);
    exitSign.rotation.y = Math.PI;
    this.root.add(exitSign);
    this.addInteractable(door, { prompt: 'Leave', action: () => g.changeScene('World', 'diner_door') });

    // Counter + Dolores, just inside, against the west wall.
    const westWall = ex - wallDist(new THREE.Vector3(ex, fy + 1.2, ez - 2.5), new THREE.Vector3(-1, 0, 0));
    const cx = Math.max(westWall + 1.6, ex - 3.2);
    const cz = ez - 2.5;
    const counterMat = this.mat({ color: 0xc8b8a8 });
    const counter = this.box(0.6, 1.05, 3, counterMat, cx, fy + 0.52, cz);
    this.box(0.8, 0.06, 3.2, this.mat({ color: 0x8a2a2a }), cx, fy + 1.07, cz, { collide: false });
    const register = this.place('cash_register', { x: cx, y: fy + 1.1, z: cz - 0.9, rotY: Math.PI / 2 });
    void register;
    const clerk = this.place('clerk', { x: cx - 0.8, y: fy, z: cz, rotY: Math.PI / 2 });
    this.animate(clerk, 'idle');
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1), this.mat({ map: menuTexture(), unlit: true }));
    menu.position.set(cx - 1.4, fy + 2.1, cz);
    menu.rotation.y = Math.PI / 2;
    this.root.add(menu);
    const lines = ['"What can I get you, hon?"', '"Coffee’s fresh. Fresh-ish."', '"Another one who can’t sleep, huh."', '"Pie’s on the house if you don’t tell anybody."'];
    this.addInteractable(counter, {
      prompt: 'Order at the counter',
      range: 2.6,
      action: () => {
        g.hud.toast(lines[Math.floor(Math.random() * lines.length)], 3000);
        g.openUI(() => g.shopping.open('diner'));
      },
    });

    // Jukebox by the counter.
    const jbx = cx + 0.4;
    const jbz = cz + 2.6;
    const juke = this.box(0.9, 1.5, 0.6, this.mat({ color: 0x8a2a5a }), jbx, fy + 0.75, jbz);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.62, 12, 1, true, -Math.PI / 2, Math.PI), this.mat({ color: 0xffb860, unlit: true, doubleSide: true }));
    glow.rotation.z = Math.PI / 2;
    glow.rotation.y = Math.PI / 2;
    glow.position.set(jbx, fy + 1.5, jbz);
    this.root.add(glow);
    this.addLight({ position: [jbx, fy + 1.4, jbz - 0.8], color: 0xff7aa0, range: 4, intensity: 0.9, flicker: 0.1 });
    addMusicDevice(this, juke, 'the jukebox');

    // Warm lamps over the tables, and seats at a few of them.
    for (const t of this.tables) this.addLight({ position: [t.x, fy + 2.4, t.z], color: 0xffc890, range: 7, intensity: 1.1 });
    this.addLight({ position: [cx - 0.5, fy + 2.4, cz], color: 0xffd8a0, range: 7, intensity: 1.1 });
    this.addLight({ position: [ex, fy + 2.4, ez], color: 0xffd0a0, range: 7, intensity: 0.9 });
    const center = new THREE.Vector3((b.min.x + b.max.x) / 2, 0, (b.min.z + b.max.z) / 2);
    for (const t of this.tables.slice(0, 10)) {
      // sit on the side of the table facing the room's centre
      const toC = new THREE.Vector3(center.x - t.x, 0, center.z - t.z).normalize();
      const seatPos = new THREE.Vector3(t.x, fy, t.z).addScaledVector(toC, -0.85);
      const vol = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1));
      vol.visible = false;
      vol.position.set(t.x, t.y - 0.1, t.z);
      this.root.add(vol);
      const yaw = Math.atan2(-(t.x - seatPos.x), -(t.z - seatPos.z));
      addSeat(this, vol, { eye: [seatPos.x, fy + 1.2, seatPos.z], yaw, pitch: -0.2, yawLimit: 1.5, standAt: [seatPos.x + toC.x * -0.6, fy, seatPos.z + toC.z * -0.6] }, 'Sit at the table');
    }
  }
}

function menuTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1210';
  x.fillRect(0, 0, 128, 96);
  x.fillStyle = '#ffd890';
  x.font = 'bold 12px Georgia';
  x.textAlign = 'center';
  x.fillText('SEAVIEW DINER', 64, 14);
  x.font = '10px monospace';
  x.textAlign = 'left';
  const items = [['Coffee', '1.25'], ['Pancakes', '4.50'], ['Burger', '6.75'], ['Pie', '3.00'], ['Milkshake', '3.75']];
  items.forEach(([n, p], i) => {
    x.fillStyle = '#f0e8d8';
    x.fillText(n, 10, 32 + i * 13);
    x.textAlign = 'right';
    x.fillText(p, 118, 32 + i * 13);
    x.textAlign = 'left';
  });
  return new THREE.CanvasTexture(c);
}
