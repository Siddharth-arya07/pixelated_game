import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { signTexture } from '../core/Procedural.js';
import { addMusicDevice } from './Devices.js';

/**
 * HomeScene — the townhouse on Duffy Terrace
 * ------------------------------------------
 * Small, warm, lived-in. A living room with the couch and the TV, the
 * kitchen with a birthday cake waiting (blow the candles out), balloons,
 * her room down the hall, Sophie's bed and bowl, rain on the windows.
 * And notes, everywhere, the kind you leave for someone you love.
 */
const NOTES = {
  fridge: "I'm glad you're alive\nand didn't give up.\n\nI mean it. Every single day you stayed made the world better. ♥",
  card: 'Happy birthday!\n\nI am so glad you were born.\nThe world got a little warmer that day.',
  mirror: 'Look who it is.\n\nYou are loved more than you know.',
  pillow: "Goodnight, little one.\n\nTomorrow's yours too.\nAnd the one after that.",
  desk: 'A drawing in crayon: a girl, a small white dog, a sun with a face.\n\nAt the bottom, in a grown-up\'s handwriting:\n"The kid you were would be so proud of who you are now."',
  window: 'Rain on the glass. The streetlights are on.\n\nThe rain always stops. It always, always does.',
  sophie: "Sophie's bed. It smells like her.\n\nShe'd want you to know: you're her favourite person. Always were.",
  photos: 'Picture frames: birthdays, a beach, a kid with a gap-toothed grin and a white fluffy dog.\n\nYou look so happy in every one.',
  tv: 'Saturday morning cartoons. A blanket. Cereal. Nowhere to be.',
};

export class HomeScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Home', label: 'home, duffy terrace' });
    this.indoor = { fog: 0x1a1410, near: 6, far: 26, ambient: 0x5a4a3c, daylight: 0.35 };
    this.eyeHeight = 1.12;
    this.memory = true;
  }

  build() {
    const g = this.game;
    const carpet = this.mat({ map: this.tex('planks', 6, 5), color: 0xd8a878 });
    const wall = this.mat({ map: this.tex('wall', 4, 1), color: 0xf2e8d4 });
    const ceil = this.mat({ map: this.tex('ceiling', 4, 4), color: 0xf4efe6 });
    // main room: living (west) + kitchen (east); front door on the south wall
    this.room({ w: 10, d: 7, h: 2.7, x: 0, z: 0, floorMat: carpet, wallMat: wall, ceilMat: ceil, doors: [{ wall: 's', at: -3, width: 1.1 }, { wall: 'n', at: -3.2, width: 1.0 }] });
    // her room, through the north door
    this.room({ w: 4.6, d: 4.2, h: 2.7, x: -3.2, z: -5.6, floorMat: this.mat({ map: this.tex('fabric', 3, 3), color: 0xe8c8d0 }), wallMat: this.mat({ map: this.tex('wall', 2, 1), color: 0xf0dce4 }), ceilMat: ceil, doors: [{ wall: 's', at: 0, width: 1.0 }] });
    const front = this.box(1.1, 2.15, 0.06, this.mat({ color: 0x5a3a24 }), -3, 1.08, 3.53, { collide: false });
    this.addInteractable(front, { prompt: 'Go outside', action: () => g.changeScene('Fremont', 'home_door') });
    this.addSpawn('door', [-3, 0, 2.6], Math.PI);
    this.addSpawn('default', [-3, 0, 2.6], Math.PI);
    // kitchen tiles under the east half
    const tiles = this.plane(4.6, 7, this.mat({ map: this.tex('checker_tiles', 5, 7), color: 0xf0ece0 }), 2.7, 0.01, 0, { collide: false });
    void tiles;

    this.#living();
    this.#kitchen();
    this.#bedroom();
    this.#windows();
    // warm lights
    this.addLight({ position: [-2.5, 2.2, 0.5], color: 0xffd8a0, range: 8, intensity: 1.2 });
    this.addLight({ position: [2.8, 2.3, -0.5], color: 0xfff0d0, range: 7, intensity: 1.0 });
    this.addLight({ position: [-3.2, 2.1, -5.6], color: 0xffc0d0, range: 5, intensity: 0.9 });
    this.addSound('rain', new THREE.Vector3(0, 1.5, 3.4), { volume: 0.2 });
  }

  #note(obj, key, label) {
    this.addInteractable(obj, { prompt: label, range: 2.6, action: () => this.game.openUI(() => this.game.note.show(NOTES[key])) });
  }

  /** A little paper note stuck on something. */
  #paper(x, y, z, rotY, color = 0xfff6a8, w = 0.22, h = 0.18) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat({ map: noteTex(color), doubleSide: true }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.rotation.z = (Math.random() - 0.5) * 0.15;
    this.root.add(m);
    return m;
  }

  #living() {
    const g = this.game;
    this.place('rug', { x: -2.6, y: 0.01, z: 0.4 });
    const couch = this.place('couch', { x: -2.6, y: 0, z: 2.4, rotY: Math.PI, collide: true });
    this.place('coffee_table', { x: -2.6, y: 0, z: 0.8 });
    this.place('tv_cabinet', { x: -2.6, y: 0, z: -3.1, collide: true });
    const tv = this.place('crt_tv', { x: -2.6, y: 0.55, z: -3.1 });
    this.place('lamp_floor', { x: -4.4, y: 0, z: 2.6 });
    this.place('plant', { x: -4.5, y: 0, z: -3 });
    this.place('bookcase', { x: -4.75, y: 0, z: -0.5, rotY: Math.PI / 2, collide: true });
    // the TV glows with cartoons
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.32), this.mat({ map: cartoonTex(), unlit: true }));
    scr.position.set(-2.6, 0.83, -2.84);
    this.root.add(scr);
    this.addLight({ position: [-2.6, 0.9, -2.4], color: 0x8ab8ff, range: 3.5, intensity: 0.7, flicker: 0.25 });
    addMusicDevice(this, tv, 'the living-room TV');
    this.#note(scr, 'tv', 'Watch cartoons for a bit');
    // sit on the couch
    this.addInteractable(couch, {
      prompt: 'Sit on the couch',
      action: () => g.player.sit({ eye: new THREE.Vector3(-2.6, 0.95, 2.3), yaw: 0, pitch: -0.05, standAt: new THREE.Vector3(-2.6, 0, 1.4) }),
    });
    // family photos on the west wall
    const frames = [[-4.98, 1.6, -1.6], [-4.98, 1.3, -2.2], [-4.98, 1.75, -2.6], [-4.98, 1.4, 1.2]];
    const cols = [0xd88a6a, 0x8ab8d8, 0xe8c070, 0xa8d090];
    frames.forEach(([x, y, z], i) => {
      const f = this.box(0.04, 0.32, 0.26, this.mat({ color: 0x3a2a1a }), x, y, z, { collide: false });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.27), this.mat({ map: photoTex(cols[i], i) }));
      p.position.set(x + 0.025, y, z);
      p.rotation.y = Math.PI / 2;
      this.root.add(p);
      if (i === 0) this.#note(f, 'photos', 'Look at the photos');
    });
  }

  #kitchen() {
    const g = this.game;
    this.place('fridge', { x: 4.55, y: 0, z: -2.9, rotY: -Math.PI / 2, collide: true });
    for (let i = 0; i < 3; i++) this.place('kitchen_cabinet', { x: 4.6, y: 0, z: -1.6 + i * 0.6, rotY: -Math.PI / 2, collide: true });
    this.place('kitchen_sink', { x: 4.6, y: 0, z: 0.2, rotY: -Math.PI / 2, collide: true });
    this.place('stove', { x: 4.6, y: 0, z: 1.0, rotY: -Math.PI / 2, collide: true });
    // notes and drawings on the fridge door
    const fn = this.#paper(4.12, 1.25, -2.9, -Math.PI / 2, 0xfff2a0, 0.26, 0.2);
    this.#paper(4.12, 1.5, -2.65, -Math.PI / 2, 0xf8c8d8, 0.2, 0.24);
    this.#paper(4.12, 0.95, -3.1, -Math.PI / 2, 0xc8e0f8, 0.24, 0.18);
    this.#note(fn, 'fridge', 'Read the note on the fridge');
    // the table, the cake, the balloons
    const table = this.box(1.4, 0.06, 0.9, this.mat({ map: this.tex('planks', 1, 1), color: 0xb08860 }), 2.2, 0.74, 0.6);
    for (const [dx, dz] of [[-0.6, -0.38], [0.6, -0.38], [-0.6, 0.38], [0.6, 0.38]]) this.box(0.06, 0.74, 0.06, this.mat({ color: 0x8a6a48 }), 2.2 + dx, 0.37, 0.6 + dz, { collide: false });
    this.addColliderBox(2.2, 0.4, 0.6, 1.4, 0.8, 0.9);
    // wooden dining chairs
    const wood = this.mat({ color: 0x9a7048 });
    for (const [dx, dz, r] of [[-0.95, 0, Math.PI / 2], [0.95, 0, -Math.PI / 2], [0, 0.8, Math.PI]]) {
      const c = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), wood);
      seat.position.y = 0.45;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.05), wood);
      back.position.set(0, 0.72, -0.19);
      c.add(seat, back);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), wood);
        l.position.set(lx, 0.225, lz);
        c.add(l);
      }
      c.position.set(2.2 + dx, 0, 0.6 + dz);
      c.rotation.y = r + Math.PI;
      this.root.add(c);
    }
    const cake = this.place('cake', { x: 2.2, y: 0.77, z: 0.55, scale: 1.35 });
    this.place('balloons', { x: 3.4, y: 0, z: 1.8 });
    this.place('balloons', { x: 0.9, y: 0, z: -2.8, rotY: 2 });
    // candle flames on top of the cake
    this.flames = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.035, 5), this.mat({ color: 0xffc040, unlit: true, additive: true }));
      f.position.set(2.2 + Math.cos(a) * 0.1, 0.77 + 0.27, 0.55 + Math.sin(a) * 0.1);
      this.root.add(f);
      this.flames.push(f);
    }
    this.candleLight = this.addLight({ position: [2.2, 1.05, 0.55], color: 0xffb050, range: 3, intensity: 0.9, flicker: 0.3 });
    const card = this.#paper(2.55, 0.78, 0.85, 0, 0xfff0f0, 0.16, 0.12);
    card.rotation.x = -Math.PI / 2 + 0.3;
    this.#note(card, 'card', 'Read the birthday card');
    this.addInteractable(cake ?? table, {
      prompt: () => (this.blown ? 'Light the candles again' : 'Make a wish and blow out the candles'),
      range: 2.4,
      action: () => this.#candles(),
    });
    // banner across the kitchen
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.42), this.mat({ map: signTexture(['HAPPY BIRTHDAY!'], { bg: '#f8d8e8', fg: '#c83a6a', w: 160, h: 22 }), doubleSide: true }));
    banner.position.set(2.4, 2.25, -3.45);
    this.root.add(banner);
    // Sophie's bowl and bed by the kitchen
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.07, 10), this.mat({ color: 0xc83a3a }));
    bowl.position.set(3.6, 0.035, 2.9);
    this.root.add(bowl);
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.14, 12), this.mat({ map: this.tex('fabric', 2, 1), color: 0xd8a8b8 }));
    bed.position.set(0.8, 0.07, 2.9);
    this.root.add(bed);
    const name = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.12), this.mat({ map: signTexture(['SOPHIE'], { bg: '#f8f0e0', fg: '#c83a3a', w: 64, h: 18 }), doubleSide: true }));
    name.position.set(0.8, 0.3, 3.45);
    name.rotation.y = Math.PI;
    this.root.add(name);
    this.#note(bed, 'sophie', "Sophie's bed");
  }

  #candles() {
    const g = this.game;
    this.blown = !this.blown;
    for (const f of this.flames) f.visible = !this.blown;
    this.candleLight.enabled = !this.blown;
    if (this.blown) {
      g.audio.oneShot('exhale', { volume: 0.7 });
      g.hud.toast('You make a wish… and blow. Every candle, one breath. 🎉', 3500);
      this.#confetti(new THREE.Vector3(2.2, 1.1, 0.55));
      setTimeout(() => g.hud.toast("(Whatever you wished for — I hope it's on its way.)", 3500), 3600);
    } else g.audio.oneShot('lighter', { volume: 0.5 });
  }

  #confetti(at) {
    const cols = [0xff5a8a, 0xffd040, 0x5ac8ff, 0x8aff7a, 0xc88aff];
    this.bits ??= [];
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.022), this.mat({ color: cols[i % 5], unlit: true, doubleSide: true }));
      m.position.copy(at);
      this.root.add(m);
      const a = Math.random() * Math.PI * 2;
      this.bits.push({ m, v: new THREE.Vector3(Math.cos(a) * (0.6 + Math.random()), 2 + Math.random() * 1.5, Math.sin(a) * (0.6 + Math.random())), s: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0), life: 6 });
    }
    this.game.audio.oneShot('bubble', { volume: 0.4 });
  }

  #bedroom() {
    const cx = -3.2;
    const cz = -5.6;
    this.place('bed', { x: cx - 1.0, y: 0, z: cz - 0.7, rotY: Math.PI / 2, collide: true });
    this.place('desk', { x: cx + 1.6, y: 0, z: cz - 1.5, rotY: -Math.PI / 2, collide: true });
    this.place('chair', { x: cx + 1.0, y: 0, z: cz - 1.5, rotY: Math.PI / 2 });
    this.place('lamp_table', { x: cx + 1.75, y: 0.75, z: cz - 0.9 });
    // stuffed animals on the bed
    const plush = [[0xc89a6a, -1.6, -1.3], [0xf0f0f0, -1.4, -1.0], [0xe8a0c0, -1.7, -0.9]];
    for (const [c, dx, dz] of plush) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), this.mat({ color: c }));
      b.position.set(cx + dx + 0.6, 0.62, cz + dz + 0.3);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), this.mat({ color: c }));
      h.position.set(cx + dx + 0.6, 0.76, cz + dz + 0.3);
      this.root.add(b, h);
    }
    // the note on her pillow
    const pn = this.#paper(cx - 1.75, 0.62, cz - 0.7, Math.PI / 2, 0xf8e0f0, 0.2, 0.15);
    pn.rotation.x = -Math.PI / 2;
    this.#note(pn, 'pillow', 'Read the note on the pillow');
    // a crayon drawing on the desk
    const dr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), this.mat({ map: drawingTex() }));
    dr.rotation.x = -Math.PI / 2;
    dr.rotation.z = 0.2;
    dr.position.set(cx + 1.6, 0.77, cz - 1.5);
    this.root.add(dr);
    this.#note(dr, 'desk', 'Look at the drawing');
    // a mirror
    const mirror = this.box(0.04, 0.9, 0.5, this.mat({ color: 0xc8d8e8, emissive: 0.4 }), cx + 2.27, 1.35, cz + 0.8, { collide: false });
    this.#note(mirror, 'mirror', 'Look in the mirror');
    // glow-in-the-dark stars on the ceiling
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.04 + (i % 3) * 0.015, 5), this.mat({ color: 0xc8ffb8, unlit: true }));
      s.rotation.x = Math.PI / 2;
      s.position.set(cx + ((i * 37) % 40) / 10 - 2, 2.69, cz + ((i * 53) % 36) / 10 - 1.8);
      this.root.add(s);
    }
  }

  #windows() {
    // rainy evening windows: the front, the kitchen, her room
    const win = (x, y, z, rotY, w = 1.4, h = 1.0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat({ map: rainTex(), unlit: true, scroll: [0, -0.15] }));
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      this.root.add(m);
      this.box(w + 0.1, 0.06, 0.12, this.mat({ color: 0xf8f4ec }), x, y - h / 2 - 0.03, z, { collide: false, rotY });
      return m;
    };
    const w1 = win(0.5, 1.5, 3.48, Math.PI);
    win(-3.2, 1.5, -7.68, 0, 1.2, 0.9);
    win(4.98, 1.6, 2.4, -Math.PI / 2, 1.0, 0.9);
    this.#note(w1, 'window', 'Look out the window');
  }

  update(dt, time) {
    super.update(dt, time);
    if (this.flames && !this.blown) for (const [i, f] of this.flames.entries()) f.scale.y = 1 + Math.sin(time * 18 + i * 2) * 0.25;
    for (const b of this.bits ?? []) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.v.y = Math.max(-0.7, b.v.y - 6 * dt);
      b.v.x *= 1 - dt * 1.5;
      b.v.z *= 1 - dt * 1.5;
      b.m.position.addScaledVector(b.v, dt);
      if (b.m.position.y < 0.01) {
        b.m.position.y = 0.01;
        b.m.rotation.set(-Math.PI / 2, 0, b.s.x);
        b.v.set(0, 0, 0);
      } else b.m.rotation.set(b.s.x += dt * 9, b.s.y += dt * 7, 0);
      if (b.life <= 0) b.m.removeFromParent();
    }
  }
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function noteTex(color) {
  return canvasTex(32, 32, (g) => {
    g.fillStyle = '#' + color.toString(16).padStart(6, '0');
    g.fillRect(0, 0, 32, 32);
    g.strokeStyle = 'rgba(60,40,80,0.6)';
    for (let y = 8; y < 30; y += 5) {
      g.beginPath();
      g.moveTo(4, y);
      g.lineTo(6 + Math.random() * 22, y);
      g.stroke();
    }
    g.fillStyle = '#d83a5a';
    g.font = '10px sans-serif';
    g.fillText('♥', 22, 28);
  });
}

function cartoonTex() {
  return canvasTex(64, 48, (g) => {
    g.fillStyle = '#7ac8f8';
    g.fillRect(0, 0, 64, 48);
    g.fillStyle = '#6ad86a';
    g.fillRect(0, 34, 64, 14);
    g.fillStyle = '#ffe040';
    g.beginPath();
    g.arc(50, 10, 6, 0, 7);
    g.fill();
    g.fillStyle = '#f87ab0';
    g.beginPath();
    g.arc(26, 28, 9, 0, 7);
    g.fill();
    g.fillStyle = '#000';
    g.fillRect(22, 25, 2, 2);
    g.fillRect(29, 25, 2, 2);
  });
}

function photoTex(color, i) {
  return canvasTex(32, 40, (g) => {
    g.fillStyle = '#' + color.toString(16).padStart(6, '0');
    g.fillRect(0, 0, 32, 40);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, 24, 32, 16);
    // a kid and a little white dog, smiling, in every one
    g.fillStyle = '#5a3a28';
    g.beginPath();
    g.arc(12 + (i % 2) * 6, 14, 5, 0, 7);
    g.fill();
    g.fillStyle = '#c88a62';
    g.beginPath();
    g.arc(12 + (i % 2) * 6, 16, 4, 0, 7);
    g.fill();
    g.fillStyle = '#1a1a1a';
    g.fillRect(8 + (i % 2) * 6, 21, 8, 10);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(23 - (i % 2) * 10, 30, 4, 0, 7);
    g.fill();
  });
}

function drawingTex() {
  return canvasTex(64, 48, (g) => {
    g.fillStyle = '#fffef6';
    g.fillRect(0, 0, 64, 48);
    g.lineWidth = 2;
    g.strokeStyle = '#f0b020';
    g.beginPath();
    g.arc(52, 10, 6, 0, 7);
    g.stroke();
    for (let a = 0; a < 7; a += 0.8) {
      g.beginPath();
      g.moveTo(52 + Math.cos(a) * 8, 10 + Math.sin(a) * 8);
      g.lineTo(52 + Math.cos(a) * 11, 10 + Math.sin(a) * 11);
      g.stroke();
    }
    g.strokeStyle = '#3a2a1a';
    g.beginPath();
    g.arc(18, 18, 5, 0, 7);
    g.stroke();
    g.beginPath();
    g.moveTo(18, 23);
    g.lineTo(18, 35);
    g.moveTo(18, 35);
    g.lineTo(13, 44);
    g.moveTo(18, 35);
    g.lineTo(23, 44);
    g.moveTo(11, 28);
    g.lineTo(25, 28);
    g.stroke();
    g.strokeStyle = '#aaaaaa';
    g.beginPath();
    g.arc(34, 38, 5, 0, 7);
    g.stroke();
    g.strokeStyle = '#d83a3a';
    g.beginPath();
    g.moveTo(25, 28);
    g.lineTo(33, 36);
    g.stroke();
    g.strokeStyle = '#3a8a3a';
    g.beginPath();
    g.moveTo(0, 46);
    g.lineTo(64, 46);
    g.stroke();
  });
}

function rainTex() {
  return canvasTex(32, 32, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 32);
    gr.addColorStop(0, '#2a3448');
    gr.addColorStop(1, '#4a4038');
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#ffd890';
    g.fillRect(6, 20, 2, 2);
    g.fillRect(24, 18, 2, 2);
    g.fillStyle = 'rgba(200,220,255,0.5)';
    for (let i = 0; i < 18; i++) g.fillRect(Math.random() * 32, Math.random() * 32, 1, 2 + Math.random() * 3);
  });
}
