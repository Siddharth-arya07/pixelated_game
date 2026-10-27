import * as THREE from 'three';
import { signTexture } from '../core/Procedural.js';

/**
 * Memories — the trip to California (and one to Niagara Falls)
 * ------------------------------------------------------------
 *  - The bus: a stop on Pine Hollow's plaza and one in every memory place.
 *    Pick where to go; the bus pulls up, you get on, the screen fades.
 *  - Being a kid: memory scenes set `eyeHeight` (your camera) and, for
 *    everyone else, your avatar becomes the kid (see kidAvatar()).
 *  - Sophie: a small white curly dog with a red collar who trots after you in
 *    every memory place. Each player has their own Sophie; other players'
 *    Sophies follow their avatars on your screen, so she needs no syncing.
 */
export const DESTINATIONS = [
  { scene: 'World', spawn: 'bus_stop_ph', name: 'Pine Hollow', blurb: 'home, now' },
  { scene: 'Fremont', spawn: 'bus_stop', name: 'Ardenwood, Fremont', blurb: 'the townhouses on Duffy Terrace' },
  { scene: 'Fremont', spawn: 'school', name: 'Ardenwood Elementary', blurb: 'the walk to school' },
  { scene: 'Fremont', spawn: 'visitor_center', name: 'Coyote Hills', blurb: 'golden hills, fog, the snakes' },
  { scene: 'Pier39', spawn: 'bus_stop', name: 'Pier 39', blurb: 'sea lions, the carousel, the aquarium' },
  { scene: 'GoldenGate', spawn: 'bus_stop', name: 'Golden Gate', blurb: 'the bridge in the fog' },
  { scene: 'Griffith', spawn: 'bus_stop', name: 'Griffith Observatory', blurb: 'the stars over Los Angeles' },
  { scene: 'Niagara', spawn: 'bus_stop', name: 'Niagara Falls', blurb: 'the special trip' },
];

export class Memories {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.sophies = new Map(); // owner id ('me' or remote id) → Sophie
    this.#ui();
  }

  // ---------------------------------------------------------------------------
  // Pine Hollow's bus stop
  // ---------------------------------------------------------------------------

  setupWorld(world) {
    const p = world.mainStreet?.plaza;
    if (!p) return;
    const x = p.x + 11.5;
    const z = p.z;
    const y = world.groundHeight(x, z);
    world.place('bus_stop_shelter', { x, y, z, rotY: -Math.PI / 2 });
    const pole = world.box(0.08, 2.8, 0.08, world.mat({ color: 0x6a6a6a }), x, y + 1.4, z - 2.4, { collide: false });
    void pole;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), world.mat({ map: signTexture(['BUS', 'to California'], { bg: '#1a5a2a', fg: '#ffffff', w: 64, h: 48 }), doubleSide: true }));
    sign.position.set(x, y + 2.6, z - 2.4);
    sign.rotation.y = -Math.PI / 2;
    world.root.add(sign);
    world.interactVolume(x, y + 1, z, 2.5, 2, 3.6, { prompt: 'Wait for the bus (to California…)', range: 3, action: () => this.openBus(world) });
    world.addSpawn('bus_stop_ph', [x + 1.6, y, z], -Math.PI / 2);
    this.phStop = new THREE.Vector3(x, y, z);
  }

  // ---------------------------------------------------------------------------
  // The bus
  // ---------------------------------------------------------------------------

  #ui() {
    this.el = document.createElement('div');
    this.el.id = 'busmenu';
    this.el.className = 'hidden';
    document.getElementById('ui')?.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) this.#go(Number(b.dataset.i));
      else if (e.target.closest('.bm-close')) this.game.closeUI();
    });
  }

  openBus(fromScene) {
    const g = this.game;
    this.from = fromScene;
    const here = g.scene?.name;
    const rows = DESTINATIONS.map((d, i) => {
      const built = !!g.scenes[d.scene];
      const isHere = d.scene === here && (d.scene !== 'Fremont' || d.spawn === 'bus_stop');
      return `<button data-i="${i}" ${built && !isHere ? '' : 'disabled'}><b>${i + 1}</b> ${d.name}<i>${isHere ? 'you are here' : built ? d.blurb : 'not yet…'}</i></button>`;
    }).join('');
    this.el.innerHTML = `<div class="bm-box"><h3>THE BUS</h3><p>Where to?</p>${rows}<button class="bm-close">stay here (Esc)</button></div>`;
    g.openUI(() => {
      this.visible = true;
      this.el.classList.remove('hidden');
    });
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
  }

  update(dt) {
    const g = this.game;
    if (this.visible) {
      for (let i = 0; i < DESTINATIONS.length; i++) if (g.input.pressed(`Digit${i + 1}`)) this.#go(i);
    }
    this.#sophies(dt);
  }

  async #go(i) {
    const g = this.game;
    const d = DESTINATIONS[i];
    if (!g.scenes[d.scene]) return;
    g.closeUI();
    g.audio.oneShot('horn', { volume: 0.25 });
    g.hud.toast(d.scene === 'World' ? 'The bus rumbles back to Pine Hollow…' : `The bus to ${d.name}…`, 2500);
    await g.changeScene(d.scene, d.spawn);
    if (g.scene?.memory && !this.welcomed?.has(d.name)) {
      (this.welcomed ??= new Set()).add(d.name);
      g.hud.toast(`${d.name}. ${d.blurb}.`, 3500);
    }
  }

  // ---------------------------------------------------------------------------
  // Sophie
  // ---------------------------------------------------------------------------

  #sophies(dt) {
    const g = this.game;
    const sc = g.scene;
    const on = !!sc?.memory && !sc.noDog;
    // who needs a Sophie here: me, plus every remote player in this scene
    const want = new Map();
    if (on) {
      want.set('me', () => g.player.feet);
      for (const [id, r] of g.mp?.remotes ?? []) if (r.inMyScene) want.set(id, () => r.avatar.group.position);
    }
    for (const [id, s] of this.sophies) {
      if (!want.has(id) || s.scene !== sc) {
        s.dispose();
        this.sophies.delete(id);
      }
    }
    for (const [id, getPos] of want) {
      let s = this.sophies.get(id);
      if (!s) {
        s = new Sophie(g, sc, id === 'me');
        s.place(getPos());
        this.sophies.set(id, s);
      }
      s.update(dt, getPos());
    }
  }
}

/**
 * Sophie: a fluffy white dog built from curls (icosahedra), so she can look
 * like her: round white face, dark eyes, pink tongue, red collar.
 */
class Sophie {
  constructor(game, scene, mine) {
    this.game = game;
    this.scene = scene;
    this.mine = mine;
    this.g = new THREE.Group();
    this.g.name = 'sophie';
    this.t = Math.random() * 10;
    this.mode = 'follow';
    this.wag = 0;
    this.#build();
    scene.root.add(this.g);
    if (mine) {
      this.hit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
      this.hit.position.y = 0.3;
      this.g.add(this.hit);
      scene.addInteractable(this.hit, {
        prompt: 'Pet Sophie',
        range: 2,
        action: () => this.pet(),
        secondary: () => ({ label: 'Tell her to sit', action: () => this.sit() }),
      });
    }
  }

  #build() {
    const s = this.scene;
    const white = s.mat({ color: 0xf6f2ea });
    const cream = s.mat({ color: 0xe8e0d0 });
    const curl = (r, x, y, z, m = white) => {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), m);
      c.position.set(x, y, z);
      c.rotation.set(x * 9, y * 7, z * 5);
      return c;
    };
    // body: a fluffy loaf of curls
    this.body = new THREE.Group();
    this.body.position.y = 0.26;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.body.add(curl(0.07 + (i % 3) * 0.01, Math.cos(a) * 0.09, Math.sin(a * 2) * 0.03 + 0.02, -0.14 + (i / 16) * 0.3, i % 4 ? white : cream));
    }
    this.body.add(curl(0.13, 0, 0.02, 0.0));
    this.body.add(curl(0.12, 0, 0.03, -0.12));
    this.body.add(curl(0.12, 0, 0.0, 0.12));
    this.g.add(this.body);
    // head
    this.head = new THREE.Group();
    this.head.position.set(0, 0.42, 0.2);
    this.head.add(curl(0.11, 0, 0, 0));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      this.head.add(curl(0.05, Math.cos(a) * 0.08, Math.sin(a) * 0.07 + 0.02, -0.02, i % 3 ? white : cream));
    }
    // floppy ears
    for (const sx of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(sx * 0.1, 0.02, -0.02);
      ear.add(curl(0.045, 0, -0.03, 0), curl(0.04, sx * 0.01, -0.08, 0.01));
      ear.name = sx < 0 ? 'earL' : 'earR';
      this.head.add(ear);
    }
    // face
    const black = s.mat({ color: 0x141010 });
    const muzzle = curl(0.06, 0, -0.03, 0.09);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), s.mat({ color: 0x5a3a3a }));
    nose.position.set(0, -0.01, 0.15);
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.04), s.mat({ color: 0xe88a96 }));
    tongue.position.set(0, -0.075, 0.12);
    tongue.rotation.x = 0.4;
    this.tongue = tongue;
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 4), black);
      eye.position.set(sx * 0.045, 0.03, 0.1);
      this.head.add(eye);
    }
    this.head.add(muzzle, nose, tongue);
    this.g.add(this.head);
    // red collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 4, 12), s.mat({ color: 0xc81e1e }));
    collar.position.set(0, 0.36, 0.15);
    collar.rotation.x = Math.PI / 2 + 0.5;
    const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.005, 8), s.mat({ color: 0x2a3a6a }));
    tag.rotation.x = Math.PI / 2;
    tag.position.set(0, 0.3, 0.22);
    this.g.add(collar, tag);
    // legs: short fluffy columns
    this.legs = [];
    for (const [x, z] of [[-0.06, 0.12], [0.06, 0.12], [-0.06, -0.12], [0.06, -0.12]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.18, z);
      leg.add(curl(0.04, 0, -0.06, 0), curl(0.038, 0, -0.13, 0.005));
      this.legs.push(leg);
      this.g.add(leg);
    }
    // tail: a pom of curls
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.36, -0.2);
    this.tail.add(curl(0.05, 0, 0.04, -0.01), curl(0.04, 0, 0.08, 0.0));
    this.g.add(this.tail);
    this.g.traverse((o) => o.isMesh && (o.frustumCulled = false));
  }

  place(p) {
    this.g.position.set(p.x + 1, this.scene.groundHeight(p.x + 1, p.z), p.z + 1);
  }

  pet() {
    const g = this.game;
    this.happy = 2.5;
    this.mode = 'follow';
    g.audio.oneShot('bark_small', { volume: 0.5, object: this.g });
    const lines = ['Sophie leans into your hand.', 'Sophie closes her eyes. Best girl.', 'Sophie wiggles her whole back end.', "Sophie's tongue comes out. She's smiling, you're sure of it."];
    g.hud.toast(lines[Math.floor(Math.random() * lines.length)], 2500);
  }

  sit() {
    this.mode = this.mode === 'sit' ? 'follow' : 'sit';
    this.game.hud.toast(this.mode === 'sit' ? 'Sophie sits. Good girl.' : 'Sophie bounces back to your side.', 1800);
  }

  update(dt, owner) {
    this.t += dt;
    const g = this.g;
    const sc = this.scene;
    const dx = owner.x - g.position.x;
    const dz = owner.z - g.position.z;
    const d = Math.hypot(dx, dz);
    let speed = 0;
    if (this.mode === 'follow' && d > 1.6) {
      // trot or run to catch up; teleport if left far behind (scene change, bus)
      if (d > 30) this.place(owner);
      else {
        speed = d > 6 ? 6.5 : d > 3 ? 3.6 : 1.8;
        const step = Math.min(speed * dt, d - 1.4);
        g.position.x += (dx / d) * step;
        g.position.z += (dz / d) * step;
        const yaw = Math.atan2(dx, dz);
        g.rotation.y = lerpAngle(g.rotation.y, yaw, Math.min(1, dt * 8));
      }
    } else if (d < 3 && this.mode === 'follow') {
      // look up at you
      g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 3));
    }
    g.position.y = THREE.MathUtils.damp(g.position.y, sc.groundHeight(g.position.x, g.position.z), 12, dt);
    // animation: trot, sit, wag, head tilt
    const moving = speed > 0;
    const ph = this.t * (speed > 4 ? 16 : 11);
    this.legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 : 0));
    this.body.position.y = 0.26 + (moving ? Math.abs(Math.sin(ph)) * 0.025 : 0) - (this.mode === 'sit' ? 0.05 : 0);
    this.body.rotation.x = this.mode === 'sit' ? -0.35 : 0;
    this.legs[2].position.y = this.legs[3].position.y = this.mode === 'sit' ? 0.12 : 0.18;
    this.happy = Math.max(0, (this.happy ?? 0) - dt);
    const wagSpeed = this.happy > 0 ? 26 : moving ? 14 : 7;
    this.tail.rotation.z = Math.sin(this.t * wagSpeed) * (this.happy > 0 ? 0.8 : 0.45);
    this.head.rotation.z = Math.sin(this.t * 0.7) * 0.18 * (moving ? 0.2 : 1); // the head tilt
    this.head.rotation.x = this.happy > 0 ? -0.2 : moving ? 0.1 : -0.1 + Math.sin(this.t * 0.4) * 0.05;
    this.tongue.visible = moving || this.happy > 0 || Math.sin(this.t * 0.3) > 0;
    // now and then: a sniff of the ground, or a little hop when you stop
    if (!moving && this.mode === 'follow' && Math.sin(this.t * 0.23) > 0.97) this.head.rotation.x = 0.5;
  }

  dispose() {
    this.g.removeFromParent();
    if (this.hit) this.scene.interactables = this.scene.interactables.filter((o) => o !== this.hit);
  }
}

function lerpAngle(a, b, k) {
  const d = THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
  return a + d * k;
}
