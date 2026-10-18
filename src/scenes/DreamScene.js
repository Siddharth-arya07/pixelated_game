import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { QUOTES } from './dreamQuotes.js';

/**
 * DreamScene
 * ----------
 * Where you go when you actually fall asleep in your bed: a soft, pastel,
 * kid's-drawing kind of dream. A round meadow floating in pink clouds, giant
 * alphabet blocks, crayon trees, a rainbow, a carousel turning to a music box,
 * a big friendly teddy bear, paper boats on a pond, balloons drifting up and
 * a whale swimming slowly through the sky.
 *
 * Ten little stars are hidden around; walk into them to collect them. Find
 * all ten (or walk through the door that stands on its own) to wake up.
 */
const R = 46; // meadow radius
// Every star sits at chest height on open ground (nothing built on top of them).
const STAR_SPOTS = [[-20, 12], [0, 17.5], [22, 0], [-17, -5], [27, -11], [-34, -18], [29, 24], [6, -36], [-9, 25], [39, -3]];
const clearOfStars = (x, z, r = 3) => STAR_SPOTS.every(([sx, sz]) => Math.hypot(sx - x, sz - z) > r);

const PALETTES = [
  { name: 'candy', fog: 0xf6c8dc, ground: '#c8ecc0', dot: '#fff4a8', sky: 0xffd8ea },
  { name: 'mint', fog: 0xc8f0e8, ground: '#d8f4c0', dot: '#ffd0e8', sky: 0xd8fff4 },
  { name: 'lilac', fog: 0xd8cff6, ground: '#c4e8d0', dot: '#fff0c0', sky: 0xe8e0ff },
];
const CANDY = [0xff8ab0, 0xffc870, 0xfff07a, 0x9af0a0, 0x8ad0ff, 0xc8a0ff, 0xff9a8a];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const LINES = [
  'You’re small again. Everything is very big, and very kind.',
  'It smells like crayons and warm toast here.',
  'Somebody left the sky on. It’s humming.',
  'You can’t remember falling asleep. You don’t mind.',
];

export class DreamScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Dream', label: 'a dream' });
    this.pal = pick(PALETTES);
    this.indoor = { fog: this.pal.fog, near: 18, far: 110, ambient: 0xe8dcf0, daylight: 0 };
    this.stars = [];
    this.found = 0;
  }

  build() {
    const g = this.game;
    const pal = this.pal;
    const U = (color, extra = {}) => this.mat({ color, unlit: true, ...extra });

    // ---- the meadow + cloud rim --------------------------------------------------
    const gt = document.createElement('canvas');
    gt.width = gt.height = 64;
    const c = gt.getContext('2d');
    c.fillStyle = pal.ground;
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = pal.dot;
    for (const [x, y] of [[12, 14], [44, 10], [28, 36], [54, 46], [8, 52]]) {
      c.beginPath();
      c.arc(x, y, 3, 0, Math.PI * 2);
      c.fill();
    }
    const gtex = new THREE.CanvasTexture(gt);
    gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping;
    gtex.repeat.set(30, 30);
    gtex.magFilter = THREE.NearestFilter;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 6, 48), this.mat({ map: gtex }));
    ground.rotation.x = -Math.PI / 2;
    this.root.add(ground);
    this.addColliderBox(0, -0.25, 0, (R + 6) * 2, 0.5, (R + 6) * 2);
    // invisible fence of colliders + a ring of fat clouds
    const cloud = U(0xffffff);
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const x = Math.cos(a) * (R + 3);
      const z = Math.sin(a) * (R + 3);
      this.addColliderBox(x, 2, z, 8, 4, 8, -a);
      for (let j = 0; j < 3; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 3, 10, 8), cloud);
        s.position.set(x + (Math.random() - 0.5) * 6, -1 + Math.random() * 3, z + (Math.random() - 0.5) * 6);
        this.root.add(s);
      }
    }
    // clouds floating below/around, out in the fog
    this.drift = [];
    for (let k = 0; k < 26; k++) {
      const grp = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 3, 9, 7), cloud);
        s.position.set(j * 3 - 4, Math.random() * 1.5, Math.random() * 2);
        grp.add(s);
      }
      const a = Math.random() * Math.PI * 2;
      const r = R + 16 + Math.random() * 40;
      grp.position.set(Math.cos(a) * r, -8 + Math.random() * 40, Math.sin(a) * r);
      this.root.add(grp);
      this.drift.push({ grp, a, r, s: (Math.random() < 0.5 ? -1 : 1) * (0.004 + Math.random() * 0.006) });
    }

    // ---- moon with a sleepy face --------------------------------------------------
    const mc = document.createElement('canvas');
    mc.width = mc.height = 128;
    const m = mc.getContext('2d');
    m.fillStyle = '#fff6c8';
    m.fillRect(0, 0, 128, 128);
    m.strokeStyle = '#c89a50';
    m.lineWidth = 4;
    m.lineCap = 'round';
    for (const x of [44, 84]) {
      m.beginPath();
      m.arc(x, 56, 9, 0.15 * Math.PI, 0.85 * Math.PI);
      m.stroke();
    }
    m.beginPath();
    m.arc(64, 74, 14, 0.2 * Math.PI, 0.8 * Math.PI);
    m.stroke();
    m.fillStyle = '#ffb0b0';
    m.globalAlpha = 0.6;
    for (const x of [30, 98]) {
      m.beginPath();
      m.arc(x, 76, 9, 0, Math.PI * 2);
      m.fill();
    }
    const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 32), this.mat({ map: new THREE.CanvasTexture(mc), unlit: true, fog: false }));
    moon.position.set(-30, 34, -80);
    moon.lookAt(0, 4, 0);
    this.root.add(moon);

    // ---- rainbow -----------------------------------------------------------------------
    [0xff6a6a, 0xffa860, 0xffe870, 0x8ae890, 0x7ac8ff, 0xb08aff].forEach((col, i) => {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(22 - i * 1.1, 0.55, 6, 48, Math.PI), U(col));
      arc.position.set(8, -1, -34);
      arc.rotation.y = 0.2;
      this.root.add(arc);
    });

    // ---- alphabet blocks -----------------------------------------------------------------
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const block = (x, y, z, s, rot) => {
      const ch = letters[Math.floor(Math.random() * 26)];
      const bc = document.createElement('canvas');
      bc.width = bc.height = 64;
      const b = bc.getContext('2d');
      const col = '#' + pick(CANDY).toString(16).padStart(6, '0');
      b.fillStyle = col;
      b.fillRect(0, 0, 64, 64);
      b.strokeStyle = '#ffffff';
      b.lineWidth = 5;
      b.strokeRect(4, 4, 56, 56);
      b.fillStyle = '#ffffff';
      b.font = 'bold 40px Georgia';
      b.textAlign = 'center';
      b.textBaseline = 'middle';
      b.fillText(ch, 32, 35);
      const mesh = this.box(s, s, s, this.mat({ map: new THREE.CanvasTexture(bc) }), x, y + s / 2, z, { rotY: rot });
      return mesh;
    };
    for (const [x, z] of [[-14, -8], [-12.5, -10.5], [16, 6], [-6, 20], [24, -14]]) {
      block(x, 0, z, 2.2, Math.random());
      if (Math.random() < 0.6) block(x + 0.2, 2.2, z + 0.1, 2.2, Math.random());
    }
    block(-13.2, 2.2, -9.2, 1.8, 0.4);

    // ---- crayon trees -----------------------------------------------------------------------
    for (let k = 0; k < 22; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * (R - 16);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x - 0, z - 12) < 8 || !clearOfStars(x, z)) continue;
      const h = 2.5 + Math.random() * 3;
      this.box(0.35, h, 0.35, U(0xb07a50), x, h / 2, z, { collide: true });
      const top = Math.random() < 0.5 ? new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random(), 10, 8), U(pick(CANDY))) : new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 8), U(pick(CANDY)));
      top.position.set(x, h + 1.2, z);
      this.root.add(top);
    }

    // ---- flowers (big lollipop daisies) ---------------------------------------------------------
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * (R - 6);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 4), U(0x5ac070));
      stem.position.set(x, 0.35, z);
      const head = new THREE.Mesh(new THREE.CircleGeometry(0.22, 8), U(pick(CANDY), { doubleSide: true }));
      head.position.set(x, 0.75, z);
      head.rotation.y = Math.random() * 6;
      const mid = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), U(0xfff0a0, { doubleSide: true }));
      mid.position.copy(head.position);
      mid.rotation.y = head.rotation.y;
      mid.translateZ(0.01);
      this.root.add(stem, head, mid);
    }

    // ---- pond with paper boats -------------------------------------------------------------------
    const pond = new THREE.Mesh(new THREE.CircleGeometry(6, 32), U(0x9ad8ff));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(-20, 0.02, 12);
    this.root.add(pond);
    this.boats = [];
    for (let k = 0; k < 4; k++) {
      const boat = new THREE.Group();
      const paper = U(pick([0xffffff, 0xfff0b0, 0xffd0e0]), { doubleSide: true });
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.25, 0.25, 4, 1, true), paper);
      hull.scale.z = 0.4;
      hull.rotation.y = Math.PI / 4;
      const sail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 3), paper);
      sail.position.y = 0.35;
      boat.add(hull, sail);
      this.root.add(boat);
      this.boats.push({ boat, a: Math.random() * 6, r: 1.5 + Math.random() * 3.5, s: 0.15 + Math.random() * 0.15 });
    }

    // ---- carousel ---------------------------------------------------------------------------------
    const car = new THREE.Group();
    car.position.set(0, 0, 12);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.4, 24), U(0xffd8f0));
    base.position.y = 0.2;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2, 24), U(0xff8ab0));
    roof.position.y = 4.4;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 8), U(0xfff0a0));
    pole.position.y = 2.2;
    car.add(base, roof, pole);
    this.horses = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const hg = new THREE.Group();
      const col = U(pick(CANDY));
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 1.1), col);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), col);
      neck.position.set(0, 0.45, 0.45);
      neck.rotation.x = -0.4;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.6, 6), U(0xfff0a0));
      rod.position.y = 0.6;
      hg.add(body, neck, rod);
      hg.position.set(Math.cos(a) * 3, 1.4, Math.sin(a) * 3);
      hg.rotation.y = -a;
      car.add(hg);
      this.horses.push({ hg, ph: k });
    }
    this.root.add(car);
    this.carousel = car;
    this.addColliderBox(0, 1, 12, 7.4, 2, 7.4);
    this.addLight({ position: [0, 3.5, 12], color: 0xffd0a0, range: 12, intensity: 1.2 });

    // ---- teddy bear --------------------------------------------------------------------------------
    const bear = new THREE.Group();
    const fur = this.mat({ color: 0xc89060 });
    const light = this.mat({ color: 0xf0d0a8 });
    const sph = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
      s.position.set(x, y, z);
      s.scale.set(sx, sy, sz);
      bear.add(s);
      return s;
    };
    sph(2.2, fur, 0, 2.2, 0, 1, 1.1, 0.9); // body
    sph(1.3, light, 0, 2.0, 1.1, 1, 1.2, 0.5); // tummy
    sph(1.6, fur, 0, 5.0, 0.2); // head
    sph(0.6, fur, -1.2, 6.3, 0); // ears
    sph(0.6, fur, 1.2, 6.3, 0);
    sph(0.6, light, 0, 4.7, 1.55, 1, 0.8, 0.6); // snout
    sph(0.18, this.mat({ color: 0x2a1a14 }), 0, 4.95, 1.95);
    sph(0.16, this.mat({ color: 0x1a1210 }), -0.55, 5.4, 1.45);
    sph(0.16, this.mat({ color: 0x1a1210 }), 0.55, 5.4, 1.45);
    sph(0.8, fur, -2.1, 2.6, 0.8, 1, 1.6, 1).rotation.z = 0.6; // arms
    sph(0.8, fur, 2.1, 2.6, 0.8, 1, 1.6, 1).rotation.z = -0.6;
    sph(0.9, fur, -1.2, 0.6, 1.6, 1, 0.8, 1.4); // legs
    sph(0.9, fur, 1.2, 0.6, 1.6, 1, 0.8, 1.4);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.15, 6, 10), U(0xff6a9a));
    bow.position.set(0, 3.9, 1.2);
    bear.add(bow);
    bear.position.set(18, 0, -4);
    bear.rotation.y = -1.2;
    this.root.add(bear);
    this.addColliderBox(18, 2, -4, 4.5, 4, 4.5);
    const hugs = ['The bear is warm and smells like the laundry cupboard.', 'You hug the bear. The bear hugs back, a little.', '"You’re doing fine," says the bear, without moving its mouth.', 'The bear has been keeping your spot warm.'];
    this.addInteractable(bear, { prompt: 'Hug the bear', range: 4.5, action: () => g.hud.toast(pick(hugs), 3500) });

    // ---- balloons -------------------------------------------------------------------------------
    this.balloons = [];
    for (let k = 0; k < 18; k++) {
      const bg = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), U(pick(CANDY)));
      ball.scale.y = 1.2;
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 3), U(0xffffff));
      str.position.y = -1.1;
      bg.add(ball, str);
      this.root.add(bg);
      const b = { bg, x: (Math.random() - 0.5) * 70, z: (Math.random() - 0.5) * 70, y: Math.random() * 40, s: 0.6 + Math.random() * 0.8, ph: Math.random() * 6 };
      this.balloons.push(b);
    }

    // ---- the sky whale ---------------------------------------------------------------------------
    const whale = new THREE.Group();
    const wb = this.mat({ color: 0x7aa8e8 });
    const belly = this.mat({ color: 0xe8f0ff });
    const body = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), wb);
    body.scale.set(1, 0.75, 2.2);
    const under = new THREE.Mesh(new THREE.SphereGeometry(3.6, 14, 10), belly);
    under.scale.set(0.9, 0.55, 2);
    under.position.y = -0.9;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 4), wb);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = -10;
    tail.scale.x = 2.2;
    tail.scale.z = 0.25;
    const finL = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 1.6), wb);
    finL.position.set(-4, -1, 2);
    finL.rotation.z = 0.4;
    const finR = finL.clone();
    finR.position.x = 4;
    finR.rotation.z = -0.4;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), this.mat({ color: 0x1a1a2a }));
    eye.position.set(3.2, 0.6, 5);
    const eye2 = eye.clone();
    eye2.position.x = -3.2;
    whale.add(body, under, tail, finL, finR, eye, eye2);
    this.whale = whale;
    this.whaleTail = tail;
    this.root.add(whale);

    // ---- stars to find ---------------------------------------------------------------------------------
    const starMat = U(0xfff07a);
    for (const [x, z] of STAR_SPOTS) {
      const y = 1.2;
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), starMat);
      s.position.set(x, y, z);
      s.scale.y = 1.3;
      this.root.add(s);
      this.stars.push(s);
      this.addLight({ position: [x, y, z], color: 0xfff0a0, range: 3, intensity: 0.8 });
    }

    this.#extras();

    // ---- the door that wakes you up ----------------------------------------------------------------------
    const frame = U(0xffffff);
    this.box(0.15, 2.4, 0.15, frame, -1.0, 1.2, -6, { collide: true });
    this.box(0.15, 2.4, 0.15, frame, 1.0, 1.2, -6, { collide: true });
    this.box(2.3, 0.15, 0.15, frame, 0, 2.45, -6, { collide: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 2.3), U(0xfff8e0, { doubleSide: true }));
    glow.position.set(0, 1.15, -6);
    this.root.add(glow);
    this.addInteractable(glow, { prompt: 'Wake up', action: () => this.#wake(false) });

    this.addSpawn('default', [0, 0, -1], Math.PI);
    this.addLight({ position: [0, 8, 0], color: 0xfff0f0, range: 60, intensity: 0.9 });
  }

  // ---------------------------------------------------------------------------
  // Kind words + more toys
  // ---------------------------------------------------------------------------

  #extras() {
    const g = this.game;
    const U = (color, extra = {}) => this.mat({ color, unlit: true, ...extra });
    const wood = this.mat({ color: 0xc8a070 });
    const quotes = [...QUOTES].sort(() => Math.random() - 0.5);
    let qi = 0;
    const nextQuote = () => quotes[qi++ % quotes.length];

    // ---- the little TV: a slideshow of kind words ----------------------------------
    const tx = 5;
    const tz = -3;
    this.box(1.2, 0.7, 0.7, this.mat({ color: 0xffb0c8 }), tx, 0.35, tz);
    const tv = this.box(1.0, 0.8, 0.75, this.mat({ color: 0xf0e8d8 }), tx, 1.1, tz);
    for (const dx of [-0.15, 0.15]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), U(0x8a8a90));
      ant.position.set(tx + dx, 1.75, tz);
      ant.rotation.z = dx * 3;
      this.root.add(ant);
    }
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 384;
    this.tvCanvas = cv;
    this.tvTex = new THREE.CanvasTexture(cv);
    this.tvTex.userData.live = true;
    this.tvTex.minFilter = THREE.LinearFilter;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.585), this.mat({ map: this.tvTex, unlit: true, affine: 0 }));
    screen.position.set(tx, 1.12, tz + 0.38);
    this.root.add(screen);
    this.tvQuotes = quotes;
    this.tvI = 0;
    this.tvT = 0;
    this.#drawTV();
    const look = { position: new THREE.Vector3(tx, 1.15, tz + 1.25), target: new THREE.Vector3(tx, 1.12, tz + 0.38) };
    this.addInteractable(tv, {
      prompt: 'Watch the little TV',
      action: () => {
        this.tvWatching = true;
        this.tvT = 0;
        g.enterFocus({
          ...look,
          fit: { w: 0.85, h: 0.65 },
          hiRes: true,
          hint: '← → change · E stand up',
          onUpdate: (dt, input) => {
            if (input.pressed('ArrowRight') || input.pressed('KeyD')) this.#tvStep(1);
            if (input.pressed('ArrowLeft') || input.pressed('KeyA')) this.#tvStep(-1);
          },
          onExit: () => (this.tvWatching = false),
        });
      },
    });
    const beanbag = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), this.mat({ color: 0x8ad0ff }));
    beanbag.scale.y = 0.55;
    beanbag.position.set(tx, 0.3, tz + 2.2);
    this.root.add(beanbag);

    // ---- signposts with kind notes (E: read it on a little paper) ----------------------
    const signSpots = [[-4, 4], [9, 9], [-10, -14], [14, -18], [-25, 2], [33, 10], [-28, 26], [18, 30], [-40, -6], [2, -26], [-15, 36], [24, -28], [38, -18], [-32, -32]];
    for (const [x, z] of signSpots) {
      this.box(0.08, 1.1, 0.08, wood, x, 0.55, z, { collide: false });
      const board = this.box(0.7, 0.4, 0.05, this.mat({ color: 0xfff4d8 }), x, 1.15, z, { collide: false, rotY: Math.atan2(-x, -z) });
      const heart = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), U(0xff7aa0, { doubleSide: true }));
      heart.position.set(x, 1.15, z);
      heart.rotation.y = Math.atan2(-x, -z);
      heart.translateZ(0.03);
      this.root.add(heart);
      const q = nextQuote();
      this.addInteractable(board, { prompt: 'Read the little sign', action: () => g.openUI(() => g.note.show(q)) });
    }

    // ---- paper lanterns floating up, each with a kind word ------------------------------
    this.lanterns = [];
    for (let k = 0; k < 16; k++) {
      const col = pick([0xffd890, 0xffb0c0, 0xd8c0ff, 0xb0ffd8]);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 8), U(col, { opacity: 0.9 }));
      this.root.add(l);
      this.lanterns.push({ l, x: (Math.random() - 0.5) * 80, z: (Math.random() - 0.5) * 80, y: Math.random() * 30, s: 0.4 + Math.random() * 0.4, ph: Math.random() * 6 });
    }

    // ---- chalk writing on the grass -------------------------------------------------------
    const chalk = (text, x, z, rot, col = '#ffffff') => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 96;
      const x2 = c.getContext('2d');
      x2.fillStyle = col;
      x2.font = 'bold 54px "Caveat", "Comic Sans MS", cursive';
      x2.textAlign = 'center';
      x2.fillText(text, 256, 66);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), this.mat({ map: new THREE.CanvasTexture(c), unlit: true, opacity: 0.95 }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rot;
      m.position.set(x, 0.03, z);
      this.root.add(m);
    };
    chalk('you are loved', 0, 2.5, Math.PI, '#ffffff');
    chalk('you are enough ♥', -8, -18, 0.6, '#fff4a0');
    chalk('keep going', 14, 16, -0.4, '#c8f0ff');
    chalk('it’s okay to rest', -26, 14, 1.2, '#ffd0e8');

    // ---- toy train going round and round ----------------------------------------------------
    const TC = new THREE.Vector3(-24, 0, -24);
    const track = new THREE.Mesh(new THREE.TorusGeometry(7, 0.12, 4, 48), U(0x8a6a50));
    track.rotation.x = -Math.PI / 2;
    track.position.set(TC.x, 0.08, TC.z);
    this.root.add(track);
    this.train = [];
    const cols = [0xff6a6a, 0x6ab0ff, 0xffd060, 0x8ae890];
    for (let k = 0; k < 4; k++) {
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), U(cols[k]));
      body.position.y = 0.45;
      car.add(body);
      if (k === 0) {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.35, 8), U(0x3a3a4a));
        stack.position.set(0.25, 0.9, 0);
        car.add(stack);
      }
      for (const dx of [-0.3, 0.3]) for (const dz of [-0.32, 0.32]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 10), U(0x2a2a3a));
        w.rotation.x = Math.PI / 2;
        w.position.set(dx, 0.15, dz);
        car.add(w);
      }
      this.root.add(car);
      this.train.push(car);
    }
    this.trainC = TC;

    // ---- bubbles --------------------------------------------------------------------------------
    this.bubbles = [];
    const bubMat = this.mat({ color: 0xe8f4ff, unlit: true, opacity: 0.35 });
    for (let k = 0; k < 40; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 8, 6), bubMat);
      this.root.add(b);
      this.bubbles.push({ b, x: (Math.random() - 0.5) * 60, z: (Math.random() - 0.5) * 60, y: Math.random() * 8, s: 0.3 + Math.random() * 0.5, ph: Math.random() * 6 });
    }

    // ---- a kite, a hot air balloon, paper airplanes ---------------------------------------------
    this.kite = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), U(0xff8ab0, { doubleSide: true }));
    this.kite.scale.set(1, 1.4, 0.1);
    this.root.add(this.kite);
    this.kiteString = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 3), U(0xffffff));
    this.root.add(this.kiteString);
    const hab = new THREE.Group();
    const env = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 10), U(0xffc060));
    env.scale.y = 1.2;
    const stripe = new THREE.Mesh(new THREE.SphereGeometry(3.02, 12, 10, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.2), U(0xff6a8a));
    stripe.scale.y = 1.2;
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), this.mat({ color: 0xa07040 }));
    basket.position.y = -4.6;
    hab.add(env, stripe, basket);
    this.root.add(hab);
    this.hotair = hab;
    this.planes = [];
    for (let k = 0; k < 5; k++) {
      const pl = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 3), U(0xffffff, { doubleSide: true }));
      pl.rotation.x = Math.PI / 2;
      const grp = new THREE.Group();
      grp.add(pl);
      this.root.add(grp);
      this.planes.push({ grp, a: Math.random() * 6, r: 8 + Math.random() * 20, h: 3 + Math.random() * 5, s: 0.15 + Math.random() * 0.2 });
    }

    // ---- a swing hanging from a cloud -------------------------------------------------------------
    const sx = 10;
    const sz = 22;
    const swingCloud = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random(), 10, 8), U(0xffffff));
      c.position.set(j * 1.6 - 2.4, 0, Math.random());
      swingCloud.add(c);
    }
    swingCloud.position.set(sx, 7, sz);
    this.root.add(swingCloud);
    this.swing = new THREE.Group();
    this.swing.position.set(sx, 6.5, sz);
    for (const dx of [-0.5, 0.5]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5.8, 4), U(0xf0e0c0));
      rope.position.set(dx, -2.9, 0);
      this.swing.add(rope);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.4), this.mat({ color: 0xff8ab0 }));
    seat.position.y = -5.8;
    this.swing.add(seat);
    this.root.add(this.swing);

    // ---- giant sunflowers, mushrooms, a blanket fort with fairy lights ------------------------
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.3;
      const x = Math.cos(a) * 41;
      const z = Math.sin(a) * 41;
      if (!clearOfStars(x, z, 4)) continue;
      const h = 4 + Math.random() * 2;
      this.box(0.15, h, 0.15, U(0x5ac070), x, h / 2, z, { collide: false });
      const head = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 14), U(0xffd030));
      head.rotation.x = Math.PI / 2;
      head.position.set(x, h + 0.4, z);
      head.lookAt(0, h, 0);
      head.rotateX(Math.PI / 2);
      const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 12), U(0x6a4020));
      mid.position.copy(head.position);
      mid.quaternion.copy(head.quaternion);
      this.root.add(head, mid);
    }
    for (const [x, z, s, col] of [[-31, -8, 1.2, 0xff6a6a], [-33, -6, 0.8, 0xffb0e0], [35, 18, 1.4, 0xb08aff], [8, 38, 1, 0xff8a6a]]) {
      if (!clearOfStars(x, z, 2.5)) continue;
      this.box(0.4 * s, 1.2 * s, 0.4 * s, U(0xfff4e8), x, 0.6 * s, z);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), U(col));
      cap.position.set(x, 1.15 * s, z);
      this.root.add(cap);
      for (let d = 0; d < 5; d++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 6, 4), U(0xffffff));
        const a = d * 1.3;
        dot.position.set(x + Math.cos(a) * 0.7 * s, 1.15 * s + 0.75 * s, z + Math.sin(a) * 0.7 * s);
        this.root.add(dot);
      }
    }
    const fx = -34;
    const fz = 4;
    const fort = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3, 4, 1, true), this.mat({ color: 0xd8c0ff, doubleSide: true }));
    fort.position.set(fx, 1.5, fz);
    fort.rotation.y = Math.PI / 4;
    this.root.add(fort);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), U(pick([0xfff0a0, 0xffb0c0, 0xb0e0ff])));
      bulb.position.set(fx + Math.cos(a) * 2.0, 0.6 + (k % 2) * 0.1, fz + Math.sin(a) * 2.0);
      this.root.add(bulb);
    }
    this.addLight({ position: [fx, 1, fz], color: 0xffd0a0, range: 6, intensity: 1.1 });
    const pillow = this.box(0.8, 0.25, 0.5, this.mat({ color: 0xfff0f8 }), fx, 0.15, fz, { collide: false });
    this.addInteractable(pillow, {
      prompt: 'Crawl into the blanket fort',
      action: () => g.openUI(() => g.note.show(`In the fort it’s quiet and warm. Someone left a note on the pillow:\n\n“${nextQuote()}”`)),
    });
  }

  #drawTV() {
    const c = this.tvCanvas.getContext('2d');
    const W = 512;
    const H = 384;
    const pals = [['#ffd8e8', '#ff8ab0'], ['#d8f4ff', '#6ab0e0'], ['#fff4c8', '#e0a030'], ['#e0ffe8', '#5ab070'], ['#ece0ff', '#9a7ad8']];
    const [bg, fg] = pals[this.tvI % pals.length];
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    // little stars + a heart in the corners
    c.fillStyle = fg;
    c.globalAlpha = 0.35;
    for (let k = 0; k < 18; k++) c.fillRect((k * 97) % W, (k * 53) % H, 5, 5);
    c.globalAlpha = 1;
    c.font = '34px serif';
    c.fillText('♥', 20, 50);
    c.fillText('☆', W - 50, H - 22);
    // the words
    const text = this.tvQuotes[this.tvI % this.tvQuotes.length];
    c.fillStyle = '#3a2a4a';
    c.textAlign = 'center';
    let size = 44;
    let lines;
    for (;;) {
      c.font = `600 ${size}px "Caveat", "Comic Sans MS", cursive`;
      lines = [];
      let line = '';
      for (const w of text.split(' ')) {
        const t = line ? line + ' ' + w : w;
        if (c.measureText(t).width > W - 70 && line) {
          lines.push(line);
          line = w;
        } else line = t;
      }
      lines.push(line);
      if (lines.length * size * 1.15 < H - 90 || size < 24) break;
      size -= 4;
    }
    const y0 = H / 2 - ((lines.length - 1) * size * 1.15) / 2 + size * 0.3;
    lines.forEach((l, i) => c.fillText(l, W / 2, y0 + i * size * 1.15));
    c.font = '18px monospace';
    c.fillStyle = fg;
    c.fillText(`${(this.tvI % this.tvQuotes.length) + 1} / ${this.tvQuotes.length}`, W / 2, H - 18);
    c.textAlign = 'left';
    this.tvTex.needsUpdate = true;
  }

  #tvStep(d) {
    this.tvI = (this.tvI + d + this.tvQuotes.length) % this.tvQuotes.length;
    this.tvT = 0;
    this.#drawTV();
    this.game.audio.oneShot('click', { volume: 0.2, rate: 1.6 });
  }

  onEnter() {
    const g = this.game;
    this.found = 0;
    for (const s of this.stars) s.visible = true;
    this.waking = false;
    setTimeout(() => g.hud.toast(pick(LINES), 5000), 800);
    setTimeout(() => g.hud.toast('There are little stars hidden around. Find all ten.', 4000), 6500);
    this.#musicBox(true);
  }

  onExit() {
    this.#musicBox(false);
  }

  update(dt, time) {
    super.update(dt, time);
    const g = this.game;
    this.carousel.rotation.y += dt * 0.35;
    for (const h of this.horses) h.hg.position.y = 1.4 + Math.sin(time * 1.6 + h.ph) * 0.35;
    for (const b of this.boats) {
      b.a += dt * b.s;
      b.boat.position.set(-20 + Math.cos(b.a) * b.r, 0.08 + Math.sin(time * 2 + b.r) * 0.03, 12 + Math.sin(b.a) * b.r);
      b.boat.rotation.y = -b.a;
    }
    for (const b of this.balloons) {
      b.y += dt * b.s;
      if (b.y > 45) b.y = -2;
      b.bg.position.set(b.x + Math.sin(time * 0.5 + b.ph) * 1.2, b.y, b.z);
      b.bg.rotation.z = Math.sin(time + b.ph) * 0.15;
    }
    for (const d of this.drift) {
      d.a += d.s * dt * 3;
      d.grp.position.x = Math.cos(d.a) * d.r;
      d.grp.position.z = Math.sin(d.a) * d.r;
    }
    const wa = time * 0.05;
    this.whale.position.set(Math.cos(wa) * 34, 20 + Math.sin(time * 0.3) * 2, Math.sin(wa) * 34);
    this.whale.rotation.y = -wa + Math.PI;
    this.whale.rotation.z = Math.sin(time * 0.3) * 0.06;
    this.whaleTail.rotation.y = Math.sin(time * 0.8) * 0.3;

    // TV slideshow: a new card every 7 s
    this.tvT += dt;
    if (this.tvT > 7) this.#tvStep(1);
    for (const l of this.lanterns) {
      l.y += dt * l.s;
      if (l.y > 40) l.y = 0;
      l.l.position.set(l.x + Math.sin(time * 0.4 + l.ph) * 1.5, l.y + 2, l.z);
    }
    const TC = this.trainC;
    this.train.forEach((car, k) => {
      const a = time * 0.35 - k * 0.15;
      car.position.set(TC.x + Math.cos(a) * 7, 0.1, TC.z + Math.sin(a) * 7);
      car.rotation.y = -a;
    });
    for (const b of this.bubbles) {
      b.y += dt * b.s;
      if (b.y > 12) b.y = 0;
      b.b.position.set(b.x + Math.sin(time + b.ph) * 0.6, b.y + 0.3, b.z + Math.cos(time * 0.8 + b.ph) * 0.6);
    }
    const kp = new THREE.Vector3(-8 + Math.sin(time * 0.5) * 3, 16 + Math.sin(time * 0.9) * 1.5, -30);
    this.kite.position.copy(kp);
    this.kite.rotation.z = Math.sin(time * 0.7) * 0.3;
    const anchor = new THREE.Vector3(-8, 0.5, -16);
    this.kiteString.position.copy(anchor).lerp(kp, 0.5);
    this.kiteString.scale.y = anchor.distanceTo(kp);
    this.kiteString.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), kp.clone().sub(anchor).normalize());
    const ha = time * 0.02;
    this.hotair.position.set(Math.cos(ha) * 60, 26 + Math.sin(time * 0.2) * 2, Math.sin(ha) * 60);
    for (const pl of this.planes) {
      pl.a += dt * pl.s;
      pl.grp.position.set(Math.cos(pl.a) * pl.r, pl.h + Math.sin(pl.a * 3) * 0.6, Math.sin(pl.a) * pl.r);
      pl.grp.rotation.y = -pl.a;
    }
    this.swing.rotation.x = Math.sin(time * 1.1) * 0.35;

    const p = g.player.position;
    for (const s of this.stars) {
      if (!s.visible) continue;
      s.rotation.y += dt * 2;
      s.position.y += Math.sin(time * 2 + s.position.x) * 0.003;
      if (Math.hypot(s.position.x - p.x, s.position.z - p.z) < 1.4 && Math.abs(s.position.y - (p.y + 1)) < 2.6) {
        s.visible = false;
        this.found++;
        this.#chime(this.found);
        if (this.found < 10) g.hud.toast(`★ ${this.found} / 10`, 1500);
        else {
          g.hud.toast('All ten! They hum together like a little song…', 4000);
          setTimeout(() => this.#wake(true), 3500);
        }
      }
    }
  }

  async #wake(allStars) {
    if (this.waking) return;
    this.waking = true;
    const g = this.game;
    g.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, 1200));
    g.dayNight.advance(240);
    await g.changeScene('House', 'bed');
    g.fade.classList.remove('on');
    const morn = allStars ? 'You wake up smiling, holding the pillow like it’s a teddy bear.' : 'You wake up. For a second you could swear you still hear the music box.';
    g.hud.toast(`${morn} It’s ${g.dayNight.label}.`, 5500);
  }

  // ---- sound -------------------------------------------------------------------------------------

  #chime(n) {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const f = 660 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16, 19, 21][n - 1] / 12);
    for (const [mul, v] of [[1, 0.18], [2, 0.06], [3, 0.03]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * mul;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(v, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(gn).connect(this.game.audio.master);
      o.start(t);
      o.stop(t + 1.7);
    }
  }

  /** A little music box melody that loops while you dream (original tune). */
  #musicBox(on) {
    clearInterval(this.mbTimer);
    if (!on) return;
    const ctx = this.game.audio.ctx;
    const tune = [12, 16, 19, 24, 19, 16, 14, 17, 21, 26, 21, 17, 12, 16, 19, 23, 24, 19, 16, 12, 9, 12, 14, 16, 17, 16, 14, 12, 11, 7, 11, 12];
    let i = 0;
    const base = 523.25;
    const play = () => {
      const t = ctx.currentTime + 0.02;
      const f = base * Math.pow(2, (tune[i % tune.length] - 12) / 12);
      for (const [mul, v, d] of [[1, 0.07, 1.8], [4.01, 0.015, 0.4], [2, 0.02, 1]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mul;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(v, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(gn).connect(this.game.audio.master);
        o.start(t);
        o.stop(t + d + 0.05);
      }
      i++;
    };
    this.mbTimer = setInterval(play, 420);
  }
}
