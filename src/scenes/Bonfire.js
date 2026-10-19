import * as THREE from 'three';
import { addSeat } from './Devices.js';

/**
 * Bonfire on the beach
 * --------------------
 * South of the harbor where the sand is wide: a driftwood bonfire that's
 * always going at night, three logs to sit on, a bag of marshmallows and a
 * stick. Every other night Ray wanders down from the lighthouse, sits on the
 * far log and tells a story (same stories as at his place).
 *
 * Roasting: hold the marshmallow in the flames (hold LMB / SPACE), watch it
 * go from white to golden — pull it out (release) at the right moment.
 * Too long and it's a little torch. Eating one fills you up a bit; perfect
 * ones are worth bragging about (the room hears about it).
 */
export function buildBonfire(scene) {
  const g = scene.game;
  // find a dry patch of beach: walk out from the land at z = 150 until the
  // ground drops to beach height
  let x = 280;
  const z = 150;
  for (; x < 360; x += 0.5) {
    const h = scene.groundHeight(x, z);
    if (h < 2.4) break;
  }
  x -= 6;
  const y = scene.groundHeight(x, z);
  const c = new THREE.Vector3(x, y, z);

  // fire: logs in a teepee, stones, flames, embers
  const wood = scene.mat({ color: 0x5a3a24 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 6), wood);
    log.position.set(x + Math.cos(a) * 0.25, y + 0.5, z + Math.sin(a) * 0.25);
    log.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    scene.root.add(log);
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), scene.mat({ color: 0x6a6a70 }));
    st.position.set(x + Math.cos(a) * 0.75, y + 0.08, z + Math.sin(a) * 0.75);
    scene.root.add(st);
  }
  scene.addColliderBox(x, y + 0.5, z, 1.4, 1, 1.4);
  const flameMat = scene.mat({ color: 0xff8a2a, unlit: true, opacity: 0.85, additive: true });
  const flameMat2 = scene.mat({ color: 0xffd060, unlit: true, opacity: 0.8, additive: true });
  const flames = [];
  for (let k = 0; k < 5; k++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - k * 0.02, 0.9 + k * 0.1, 6), k % 2 ? flameMat2 : flameMat);
    f.position.set(x + (Math.random() - 0.5) * 0.2, y + 0.55, z + (Math.random() - 0.5) * 0.2);
    scene.root.add(f);
    flames.push({ f, ph: Math.random() * 6 });
  }
  const light = scene.addLight({ position: [x, y + 1.2, z], color: 0xff9040, range: 16, intensity: 1.6, flicker: 0.35, priority: 3 });
  scene.addSound('campfire', new THREE.Vector3(x, y + 0.5, z), { volume: 0.5, refDistance: 2.5 });
  // embers drifting up
  const embers = [];
  const emberMat = scene.mat({ color: 0xffa040, unlit: true });
  for (let k = 0; k < 14; k++) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), emberMat);
    scene.root.add(e);
    embers.push({ e, t: Math.random() * 3, s: 0.5 + Math.random() });
  }

  // three logs to sit on, facing the fire
  const seats = [];
  for (const [k, a] of [[0, 0.3], [1, 2.4], [2, 4.4]]) {
    const sx = x + Math.cos(a) * 2.2;
    const sz = z + Math.sin(a) * 2.2;
    const sy = scene.groundHeight(sx, sz);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.6, 8), wood);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = -a;
    log.position.set(sx, sy + 0.22, sz);
    scene.root.add(log);
    const yaw = Math.atan2(sx - x, sz - z); // look at the fire (camera looks down -Z)
    seats.push({ sx, sy, sz, yaw, a });
    if (k < 2) addSeat(scene, log, { eye: [sx, sy + 1.05, sz], yaw, pitch: -0.15, yawLimit: 1.6, standAt: [sx + Math.cos(a) * 0.9, sy, sz + Math.sin(a) * 0.9] }, 'Sit by the fire');
  }
  // marshmallows + stick on the near log
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), scene.mat({ color: 0xf0f0f8 }));
  const s0 = seats[0];
  bag.position.set(s0.sx + 0.5, s0.sy + 0.5, s0.sz);
  scene.root.add(bag);
  const roast = new Roaster(scene, c);
  scene.addInteractable(bag, { prompt: 'Roast a marshmallow', range: 3, action: () => roast.start() });

  // Ray, every other night
  const ray = g.assets.model('ray');
  const r2 = seats[2];
  if (ray) {
    ray.position.set(r2.sx, r2.sy, r2.sz);
    ray.rotation.y = Math.atan2(x - r2.sx, z - r2.sz);
    scene.root.add(ray);
    const clip = (ray.userData.animations ?? []).find((cl) => /Idle/.test(cl.name));
    if (clip) {
      const mixer = new THREE.AnimationMixer(ray);
      mixer.clipAction(clip).play();
      scene.updaters.push((dt) => ray.visible && mixer.update(dt));
    }
    scene.addInteractable(ray, {
      prompt: 'Ray’s here. Ask him for a story',
      range: 3,
      enabled: () => ray.visible,
      action: () => g.rayUI.open(),
    });
  }

  scene.addSpawn('bonfire', [x - 3.2, y, z + 1.5], -Math.PI / 2);
  scene.updaters.push((dt, t) => {
    const night = !g.dayNight.isDaylight;
    for (const fl of flames) {
      fl.f.visible = night;
      fl.f.scale.set(1 + Math.sin(t * 9 + fl.ph) * 0.15, 1 + Math.sin(t * 13 + fl.ph) * 0.25, 1);
    }
    light.enabled = night;
    for (const em of embers) {
      em.e.visible = night;
      em.t += dt * em.s;
      if (em.t > 3) em.t = 0;
      em.e.position.set(x + Math.sin(em.t * 3 + em.s) * 0.3, y + 0.6 + em.t * 1.2, z + Math.cos(em.t * 2 + em.s) * 0.3);
    }
    if (ray) ray.visible = night && g.dayNight.day % 2 === 0;
    roast.update(dt);
  });
  return { center: c };
}

/** The marshmallow minigame. */
class Roaster {
  constructor(scene, fire) {
    this.scene = scene;
    this.game = scene.game;
    this.fire = fire;
    this.on = false;
    this.el = document.createElement('div');
    this.el.id = 'roast';
    this.el.className = 'hidden';
    this.el.innerHTML = '<div class="rs-bar"><i></i><b></b></div><div class="rs-t"></div>';
    document.getElementById('ui').appendChild(this.el);
    this.fill = this.el.querySelector('i');
    this.mark = this.el.querySelector('b');
    this.txt = this.el.querySelector('.rs-t');
    // the marshmallow on its stick (first person)
    const grp = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.9, 4), scene.mat({ color: 0x6a4a2a }));
    stick.rotation.x = Math.PI / 2;
    stick.position.z = -0.35;
    this.mallowMat = scene.mat({ color: 0xffffff });
    this.mallow = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), this.mallowMat);
    this.mallow.rotation.x = Math.PI / 2;
    this.mallow.position.z = -0.78;
    grp.add(stick, this.mallow);
    grp.visible = false;
    this.game.camera.add(grp);
    this.view = grp;
  }

  start() {
    const g = this.game;
    if (g.dayNight.isDaylight) return g.hud.toast('The fire’s out in the daytime. Come back tonight.');
    this.on = true;
    this.heat = 0; // 0 raw → 1 golden → 1.6 burnt
    this.burning = false;
    this.view.visible = true;
    this.el.classList.remove('hidden');
    this.txt.textContent = 'Hold LMB / SPACE to hold it in the fire · let go when it’s golden';
  }

  stop(result) {
    const g = this.game;
    this.on = false;
    this.view.visible = false;
    this.el.classList.add('hidden');
    const lines = {
      raw: 'Basically raw. Chewy and sad. You eat it anyway.',
      light: 'Lightly toasted. Respectable.',
      golden: 'GOLDEN. Crisp outside, molten inside. Perfect marshmallow.',
      burnt: 'It caught fire. You blow it out and eat the charcoal shell like a champion.',
    };
    g.hud.toast(lines[result], 4000);
    g.hunger?.eat?.(result === 'golden' ? 12 : 6, 'marshmallow');
    if (result === 'golden') g.net?.online && g.net.event('emote', { a: 'wave' });
  }

  update(dt) {
    if (!this.on) return;
    const g = this.game;
    const holding = g.input.mouseDown(0) || g.input.down('Space');
    if (holding) {
      this.heat += dt * (0.28 + Math.random() * 0.12);
      this.held = true;
    } else if (this.held) {
      const h = this.heat;
      return this.stop(h < 0.4 ? 'raw' : h < 0.85 ? 'light' : h < 1.2 ? 'golden' : 'burnt');
    }
    if (g.input.pressed('KeyE') || g.input.pressed('Escape')) {
      g.input.consume('KeyE');
      this.on = false;
      this.view.visible = false;
      this.el.classList.add('hidden');
      return;
    }
    const h = this.heat;
    const col = h < 1 ? _c.setRGB(1, 1 - h * 0.35, 1 - h * 0.75) : _c.setRGB(Math.max(0.15, 1 - (h - 1) * 1.4), Math.max(0.1, 0.65 - (h - 1) * 1.2), Math.max(0.05, 0.25 - (h - 1) * 0.4));
    this.mallowMat.uniforms.uColor.value.copy(col);
    this.view.position.set(0.05, holding ? -0.18 : -0.25, holding ? -0.15 : -0.05);
    this.view.rotation.x = holding ? -0.25 : 0;
    this.fill.style.width = `${Math.min(100, (h / 1.6) * 100)}%`;
    this.fill.style.background = h < 0.85 ? '#f0e8d0' : h < 1.2 ? '#e8a040' : '#3a2010';
    if (h > 1.2 && !this.burning) {
      this.burning = true;
      this.txt.textContent = 'IT’S ON FIRE — let go!';
    }
  }
}

const _c = new THREE.Color();
