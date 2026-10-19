import * as THREE from 'three';

/**
 * Ships
 * -----
 * Big ships passing far out at sea, beyond the lighthouse: a tall ship, a
 * cruise liner lit up like a little town, and a container ship stacked to
 * the sky. Too far to see through the fog with your eyes (except their lights,
 * faintly, from up on the gallery) — use the telescope on the lighthouse
 * gallery, or fly out to them.
 *
 * Positions are a function of the shared game clock, so everyone in a room
 * sees the same ship in the same place.
 */
const SHIPS = [
  { model: 'sail_ship', name: 'The Wandering Albatross', note: 'tall ship · three masts · sail-training voyage, 40 cadets aboard', x: 500, speed: 3.2, off: 0.1, dir: 1, sink: 2.5 },
  { model: 'cruise_ship', name: 'MS Aurora', note: 'cruise liner · 1,900 passengers, most of them asleep · bound for the islands', x: 570, speed: 7, off: 0.55, dir: -1, sink: 6, windows: true },
  { model: 'container_ship', name: 'MV Northern Lark', note: 'container ship · 4,000 boxes of who-knows-what · next port in 3 days', x: 650, speed: 6, off: 0.8, dir: 1, sink: 8 },
];
const RANGE = 650;

export class Ships {
  constructor(game) {
    this.game = game;
    this.ships = [];
  }

  setupWorld(world) {
    this.world = world;
    for (const def of SHIPS) {
      const grp = new THREE.Group();
      const m = world.game.assets.model(def.model);
      if (m) grp.add(m);
      const b = new THREE.Box3().setFromObject(grp);
      const size = b.getSize(new THREE.Vector3());
      // lights: red (port) / green (starboard) / white masthead + lit portholes
      const lamp = (col, x, y, z, s = 0.8) => {
        const l = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), world.mat({ color: col, unlit: true, fogScale: 0.12 }));
        l.position.set(x, y, z);
        grp.add(l);
      };
      const L = Math.max(2, size.z / 40); // lamps big enough to read at a few hundred metres
      lamp(0xff3020, size.x / 2 + 0.4, size.y * 0.55, size.z * 0.15, L);
      lamp(0x30ff60, -size.x / 2 - 0.4, size.y * 0.55, size.z * 0.15, L);
      lamp(0xfff4d8, 0, size.y + 1, size.z * 0.3, L * 1.2);
      lamp(0xfff4d8, 0, size.y * 0.7, -size.z * 0.45, L * 1.2);
      // a string of deck lights stem to stern
      for (let k = 0; k <= 10; k++) lamp(0xffe8b0, 0, size.y * 0.42, -size.z * 0.48 + (k / 10) * size.z * 0.96, L * 0.7);
      if (def.windows) {
        const win = world.mat({ color: 0xffd890, unlit: true, fogScale: 0.15 });
        for (let deck = 0; deck < 4; deck++) {
          for (const side of [-1, 1]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, size.z * 0.62), win);
            strip.position.set(side * (size.x / 2 + 0.1), size.y * (0.3 + deck * 0.09), -size.z * 0.02);
            grp.add(strip);
          }
        }
      }
      grp.userData.def = def;
      world.root.add(grp);
      this.ships.push({ def, grp, size });
    }
    this.label = document.createElement('div');
    this.label.id = 'shiplabel';
    this.label.className = 'hidden';
    document.getElementById('ui').appendChild(this.label);
  }

  update() {
    const g = this.game;
    if (!this.world) return;
    const T = g.dayNight.minutes * 60 + g.dayNight.day * 86400; // game seconds, shared
    for (const s of this.ships) {
      const d = s.def;
      const span = RANGE * 2;
      let z = ((T * d.speed * 0.02 + d.off * span) % span) - RANGE; // (game clock runs fast: slow them down)
      if (d.dir < 0) z = -z;
      const bob = Math.sin(g.time * 0.4 + d.x) * 0.4;
      s.grp.position.set(d.x, -d.sink + bob, z);
      s.grp.rotation.y = d.dir > 0 ? 0 : Math.PI;
      s.grp.rotation.z = Math.sin(g.time * 0.3 + d.x) * 0.012;
    }
    // looking through the gallery telescope: name the ship in the crosshair
    const scoping = g.stargazing?.scope?.sea && g.scene === this.world;
    let hit = null;
    if (scoping) {
      for (const s of this.ships) {
        _v.copy(s.grp.position).setY(s.size.y * 0.4).project(g.camera);
        if (_v.z < 1 && Math.abs(_v.x) < 0.25 && Math.abs(_v.y) < 0.3) hit = s;
      }
    }
    if (hit) {
      const dist = Math.round(g.camera.position.distanceTo(hit.grp.position));
      this.label.innerHTML = `<b>${hit.def.name}</b><span>${hit.def.note}</span><i>${(dist / 1852).toFixed(1)} nautical miles · heading ${hit.def.dir > 0 ? 'south' : 'north'}</i>`;
      this.label.classList.remove('hidden');
    } else this.label.classList.add('hidden');
  }

  /** Is any ship's light worth drawing far away? (camera out on the headland or gallery) */
  get wantFar() {
    const c = this.game.camera.position;
    return this.game.scene === this.world && c.x > 330 && c.y > 28;
  }
}

const _v = new THREE.Vector3();
