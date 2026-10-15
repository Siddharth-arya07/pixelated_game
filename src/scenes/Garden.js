import * as THREE from 'three';

/**
 * Garden
 * ------
 * Two raised beds in front of your house, four plots each.
 *
 *   seeds       Quik Mart, aisle 3 (sunflower, tulip, poppy, moonflower)
 *   watering    take the can from beside the porch, fill it at the spigot on
 *               the house wall (6 pours); rain waters everything for you
 *   growing     in game time, only while the soil is wet:
 *               seed → sprout → leaves → bud → bloom (~10–14 real minutes)
 *               dry soil: growth stops and the plant droops
 *   picking     a bloom gives you a flower to put in the vase inside
 *   moonflower  opens only at night and glows
 */
export const FLOWERS = {
  sunflower: { name: 'Sunflower', grow: 340, petal: 0xf0c020, center: 0x4a2a10, height: 1.25, petals: 14, size: 0.16 },
  tulip: { name: 'Tulip', grow: 280, petal: 0xd02a3a, center: 0xe0b020, height: 0.45, petals: 6, size: 0.06, cup: true },
  poppy: { name: 'Poppy', grow: 240, petal: 0xe8501e, center: 0x1a1414, height: 0.55, petals: 5, size: 0.08 },
  moonflower: { name: 'Moonflower', grow: 400, petal: 0xeef2ff, center: 0xd8e870, height: 0.7, petals: 5, size: 0.1, night: true },
};

const WATER_LASTS = 260; // in-game minutes a watering keeps the soil wet
const CAN_POURS = 6;

export function buildGarden(scene, hx, y, hz) {
  const g = scene.game;
  const inv = g.inventory;
  const soil = scene.mat({ map: scene.tex('dirt', 2, 1), color: 0x5a4030 });
  const wetSoil = scene.mat({ map: scene.tex('dirt', 2, 1), color: 0x2e2018 });
  const wood = scene.mat({ map: scene.tex('planks', 2, 1), color: 0x7a6048 });
  const plots = [];

  for (const bx of [hx - 3.3, hx + 3.3]) {
    const bz = hz + 6.0;
    // frame
    for (const [dx, dz, w, d] of [[0, -0.6, 3.6, 0.1], [0, 0.6, 3.6, 0.1], [-1.75, 0, 0.1, 1.2], [1.75, 0, 0.1, 1.2]]) {
      scene.box(w, 0.3, d, wood, bx + dx, y + 0.15, bz + dz, { collide: false });
    }
    scene.addColliderBox(bx, y + 0.15, bz, 3.6, 0.3, 1.3);
    for (let i = 0; i < 4; i++) {
      const px = bx - 1.3 + i * 0.86;
      const bed = scene.box(0.8, 0.04, 1.05, soil, px, y + 0.27, bz, { collide: false });
      const plot = new Plot(scene, px, y + 0.29, bz, bed, soil, wetSoil);
      plot.index = plots.length;
      plots.push(plot);
    }
  }

  // Watering can by the porch + spigot on the wall.
  const can = new THREE.Group();
  const canMat = scene.mat({ color: 0x4a7a5a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.26, 10), canMat);
  body.position.y = 0.13;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.3, 6), canMat);
  spout.position.set(0.18, 0.2, 0);
  spout.rotation.z = -0.9;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 4, 10, Math.PI), canMat);
  handle.position.y = 0.27;
  can.add(body, spout, handle);
  can.position.set(hx - 1.4, y + 0.15, hz + 5.1);
  scene.root.add(can);
  scene.addInteractable(can, {
    prompt: 'Take watering can',
    range: 2.4,
    enabled: () => can.visible,
    action: () => {
      can.visible = false;
      inv.add('watering_can');
      g.water = CAN_POURS;
      g.hud.toast('Watering can. Fill it at the spigot on the wall.', 3500);
    },
  });
  const spigot = scene.box(0.12, 0.12, 0.14, scene.mat({ color: 0x8a8a90 }), hx - 4.0, y + 0.6, hz + 4.08, { collide: false });
  scene.addInteractable(spigot, {
    prompt: () => (inv.has('watering_can') ? `Fill watering can (${g.water ?? 0}/${CAN_POURS})` : 'Spigot'),
    range: 2.4,
    available: () => (inv.has('watering_can') ? true : 'Need the watering can (by the porch)'),
    action: () => {
      g.water = CAN_POURS;
      g.audio.oneShot('splash', { volume: 0.4 });
      g.hud.toast('Full.');
    },
  });

  // Growth clock: in-game minutes since the last frame.
  let last = null;
  scene.updaters.push(() => {
    const now = g.dayNight.day * 1440 + g.dayNight.minutes;
    const dm = last === null ? 0 : Math.max(0, Math.min(60, now - last));
    last = now;
    const night = !g.dayNight.isDaylight;
    const rain = g.weather?.rain ?? 0;
    for (const p of plots) p.update(dm, night, rain);
  });
  // Net: replay another player's gardening.
  const applyOp = (e) => plots[e.i]?.applyRemote(e.o, e.type);
  return { plots, applyOp };
}

class Plot {
  constructor(scene, x, y, z, bed, soil, wetSoil) {
    this.scene = scene;
    this.g = scene.game;
    this.pos = new THREE.Vector3(x, y, z);
    this.bed = bed;
    this.soil = soil;
    this.wetSoil = wetSoil;
    this.type = null;
    this.progress = 0;
    this.water = 0; // in-game minutes of wet soil left
    this.plant = null;
    this.stage = -1;

    const g = this.g;
    const inv = g.inventory;
    const seeds = () => Object.keys(FLOWERS).filter((k) => inv.has(`seeds_${k}`));
    scene.addInteractable(bed, {
      range: 2.6,
      prompt: () => {
        if (!this.type) return seeds().length ? `Plant ${FLOWERS[seeds()[0]].name} seeds` : 'Empty plot';
        if (this.progress >= 1) return `Pick the ${FLOWERS[this.type].name.toLowerCase()}`;
        const pct = Math.floor(this.progress * 100);
        return `${FLOWERS[this.type].name} · ${pct}% · ${this.water > 0 ? 'soil wet' : 'dry: water it'}`;
      },
      available: () => {
        if (!this.type && !seeds().length) return 'Empty plot. Seeds at the Quik Mart, aisle 3.';
        return true;
      },
      action: () => {
        if (!this.type) return this.#plant(seeds()[0]);
        if (this.progress >= 1) return this.#pick();
        this.#water();
      },
      secondary: () => {
        if (!this.type && seeds().length > 1) {
          // Q: plant a different kind (cycles through what you carry).
          const list = seeds();
          return { label: `Plant ${FLOWERS[list[1]].name}`, action: () => this.#plant(list[1]) };
        }
        if (this.type && this.progress < 1) return { label: 'Pull it out', action: () => (this.#clear(), this.#share('clear')) };
        return null;
      },
    });
  }

  #share(o, type) {
    this.g.net?.online && this.g.net.event('garden', { i: this.index, o, type });
  }

  applyRemote(o, type) {
    if (o === 'plant') {
      this.type = type;
      this.progress = 0;
      this.stage = -1;
      this.#rebuild();
    } else if (o === 'water') this.water = WATER_LASTS;
    else if (o === 'pick' || o === 'clear') this.#clear();
  }

  #plant(type) {
    const g = this.g;
    this.#share('plant', type);
    g.inventory.remove(`seeds_${type}`);
    this.type = type;
    this.progress = 0;
    this.stage = -1;
    g.audio.oneShot('sand', { volume: 0.5, rate: 0.8 });
    g.hud.toast(`Planted ${FLOWERS[type].name.toLowerCase()} seeds. Keep the soil wet.`);
    this.#rebuild();
  }

  #water() {
    const g = this.g;
    if (!g.inventory.has('watering_can')) return g.hud.toast('Need the watering can (by the porch).');
    if ((g.water ?? 0) <= 0) return g.hud.toast('The can is empty. Spigot on the house wall.');
    g.water--;
    this.water = WATER_LASTS;
    this.#share('water');
    g.audio.oneShot('splash', { volume: 0.35, rate: 1.3 });
    g.hud.toast(`Watered. (${g.water} pours left)`);
  }

  #pick() {
    const g = this.g;
    g.inventory.add(`flower_${this.type}`);
    this.#share('pick');
    g.hud.toast(`Picked a ${FLOWERS[this.type].name.toLowerCase()}. There's a vase inside.`);
    this.#clear();
  }

  #clear() {
    this.type = null;
    this.progress = 0;
    this.stage = -1;
    if (this.plant) this.scene.root.remove(this.plant);
    this.plant = null;
  }

  update(dm, night, rain) {
    if (rain > 0.3) this.water = WATER_LASTS;
    else this.water = Math.max(0, this.water - dm);
    this.bed.material = this.water > 0 ? this.wetSoil : this.soil;
    if (!this.type) return;
    const f = FLOWERS[this.type];
    if (this.water > 0 && this.progress < 1) this.progress = Math.min(1, this.progress + dm / f.grow);
    const stage = this.progress >= 1 ? 4 : this.progress > 0.75 ? 3 : this.progress > 0.4 ? 2 : this.progress > 0.15 ? 1 : 0;
    if (stage !== this.stage) {
      this.stage = stage;
      this.#rebuild();
    }
    if (!this.plant) return;
    // Grow smoothly within a stage; droop when dry; moonflowers open at night.
    const s = 0.25 + 0.75 * Math.min(1, this.progress * 1.1);
    this.plant.scale.setScalar(s);
    const droop = this.water > 0 ? 0 : 0.35;
    this.plant.rotation.z = THREE.MathUtils.damp(this.plant.rotation.z, droop, 1, dm / 30 || 0.016);
    if (this.head) {
      const open = f.night ? (night ? 1 : 0.25) : 1;
      this.head.scale.setScalar(THREE.MathUtils.damp(this.head.scale.x, open, 2, 0.05));
      if (f.night && this.headMat) this.headMat.uniforms.uEmissive.value = night ? 1 : 0;
    }
  }

  /** Procedural plant for the current stage. */
  #rebuild() {
    if (this.plant) this.scene.root.remove(this.plant);
    this.head = null;
    const sc = this.scene;
    const f = FLOWERS[this.type];
    const p = new THREE.Group();
    p.position.copy(this.pos);
    p.rotation.y = Math.random() * Math.PI * 2;
    const green = sc.mat({ color: 0x3a7a32, doubleSide: true });
    if (this.stage === 0) {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), sc.mat({ color: 0x3a2a1c }));
      mound.scale.y = 0.4;
      p.add(mound);
    } else {
      const h = f.height * [0, 0.25, 0.6, 0.9, 1][this.stage];
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, h, 4), green);
      stem.position.y = h / 2;
      p.add(stem);
      for (let i = 0; i < Math.min(4, this.stage + 1); i++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + h * 0.08, 0.025 + h * 0.03), green);
        leaf.position.set(0, h * (0.2 + i * 0.18), 0);
        leaf.rotation.set(-0.6, (i * Math.PI * 2) / 3, 0);
        leaf.translateX(0.03);
        p.add(leaf);
      }
      if (this.stage >= 3) {
        const head = new THREE.Group();
        head.position.y = h;
        if (this.stage === 3) {
          const bud = new THREE.Mesh(new THREE.SphereGeometry(f.size * 0.45, 6, 4), sc.mat({ color: 0x4a8a3a }));
          bud.scale.y = 1.4;
          head.add(bud);
        } else {
          const petalMat = sc.mat({ color: f.petal, doubleSide: true, emissive: 0 });
          this.headMat = petalMat;
          for (let i = 0; i < f.petals; i++) {
            const petal = new THREE.Mesh(new THREE.PlaneGeometry(f.size * 0.45, f.size), petalMat);
            const a = (i / f.petals) * Math.PI * 2;
            petal.position.set(Math.cos(a) * f.size * 0.5, 0, Math.sin(a) * f.size * 0.5);
            petal.rotation.set(f.cup ? -0.3 : -Math.PI / 2 + 0.25, -a + Math.PI / 2, 0);
            if (f.cup) petal.position.y = f.size * 0.4;
            head.add(petal);
          }
          const center = new THREE.Mesh(new THREE.CylinderGeometry(f.size * 0.32, f.size * 0.32, 0.02, 8), sc.mat({ color: f.center }));
          head.add(center);
          // Big sunflowers nod toward the road.
          if (this.type === 'sunflower') head.rotation.x = 0.6;
        }
        p.add(head);
        this.head = head;
      }
    }
    sc.root.add(p);
    this.plant = p;
  }
}
