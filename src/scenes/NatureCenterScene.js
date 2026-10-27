import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { signTexture } from '../core/Procedural.js';

/**
 * NatureCenterScene — inside the Coyote Hills Visitor Center
 * ---------------------------------------------------------
 * Wood floors, big windows onto the marsh, a tule-reed boat, bird
 * displays — and the reptile corner: glass terrariums with snakes, and a
 * ranger who lets you hold one. Gently. Two hands. There you go.
 */
const SNAKES = [
  { key: 'snake', name: 'Noodle the gopher snake', fact: 'Gopher snakes are shy and gentle. They hiss like a rattlesnake to bluff, but they are all bluff and no bite.', tint: 0xc8a050 },
  { key: 'snake_corn', name: 'Pumpkin the corn snake', fact: 'Corn snakes are named after the old corn cribs where they hunted mice. She likes warm hands.', tint: null },
  { key: 'snake', name: 'Sprout the garter snake', fact: 'Garter snakes live all around the marsh here. They love the sun on the boardwalk in the morning.', tint: null },
];

export class NatureCenterScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'NatureCenter', label: 'coyote hills visitor center' });
    this.indoor = { fog: 0x2a2418, near: 8, far: 30, ambient: 0x6a5a48, daylight: 0.6 };
    this.eyeHeight = 1.12;
    this.memory = true;
  }

  build() {
    const g = this.game;
    this.room({
      w: 14,
      d: 10,
      h: 3.6,
      floorMat: this.mat({ map: this.tex('planks', 6, 5), color: 0xb89870 }),
      wallMat: this.mat({ map: this.tex('planks', 6, 2), color: 0xa88a68 }),
      ceilMat: this.mat({ map: this.tex('planks', 6, 6), color: 0x8a6a4a }),
      doors: [{ wall: 's', at: 0, width: 1.6 }],
    });
    const door = this.box(1.6, 2.3, 0.08, this.mat({ color: 0x3a2a1c }), 0, 1.15, 5.04, { collide: false });
    this.addInteractable(door, { prompt: 'Go back outside', action: () => g.changeScene('Fremont', 'visitor_center') });
    this.addSpawn('door', [0, 0, 4.0], Math.PI);
    this.addSpawn('default', [0, 0, 4.0], Math.PI);
    // big windows onto the marsh (north wall)
    for (const x of [-4, 0, 4]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), this.mat({ map: marshTex(), unlit: true }));
      w.position.set(x, 2.0, -4.97);
      this.root.add(w);
    }
    this.addLight({ position: [0, 3, -3.5], color: 0xfff0d0, range: 10, intensity: 1.1 });
    this.addLight({ position: [-4, 3, 2], color: 0xffd8a0, range: 8, intensity: 0.9 });
    this.addLight({ position: [4.5, 2.5, 1], color: 0xffc070, range: 6, intensity: 0.9 });
    // the tule boat the Ohlone built here, and a sign
    const tule = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 3.2, 4, 8), this.mat({ color: 0xb8a060 }));
    tule.rotation.z = Math.PI / 2;
    tule.scale.set(1, 1, 0.6);
    tule.position.set(-4.2, 0.5, 2.6);
    this.root.add(tule);
    this.addColliderBox(-4.2, 0.5, 2.6, 4, 1, 1);
    this.#sign(-4.2, 1.5, 3.4, 0, ['TULE BOAT', 'woven by hand from marsh reeds']);
    // bird display
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), this.mat({ color: [0x6a8aaa, 0xe8e0d0, 0x8a6a4a, 0x2a2a2a][i] }));
      b.position.set(-6.4 + i * 0.6, 1.6, -2);
      this.root.add(b);
    }
    this.#sign(-5.5, 2.3, -2, Math.PI / 2, ['BIRDS OF THE MARSH']);
    this.#reptiles();
    this.#ranger();
  }

  #sign(x, y, z, rotY, lines) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), this.mat({ map: signTexture(lines, { bg: '#3a2a18', fg: '#f0e0b0', w: 128, h: 36 }), doubleSide: true }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.root.add(m);
  }

  #reptiles() {
    const g = this.game;
    this.#sign(5.5, 2.6, -1.5, -Math.PI / 2, ['REPTILE CORNER', 'gentle hands, please']);
    const glass = this.mat({ color: 0xc8e8f0, opacity: 0.22, doubleSide: true });
    const wood = this.mat({ color: 0x5a3a24 });
    this.tanks = [];
    SNAKES.forEach((sn, i) => {
      const z = -3 + i * 2.2;
      const x = 6.2;
      this.box(1.0, 0.8, 1.8, wood, x, 0.4, z);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.7), glass);
      t.position.set(x, 1.1, z);
      this.root.add(t);
      const sand = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.06, 1.68), this.mat({ color: 0xc8a878 }));
      sand.position.set(x, 0.83, z);
      this.root.add(sand);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), this.mat({ color: 0x8a8070 }));
      rock.position.set(x + 0.15, 0.92, z + 0.5);
      this.root.add(rock);
      const lamp = this.box(0.5, 0.05, 0.3, this.mat({ color: 0xffd890, unlit: true }), x, 1.42, z, { collide: false });
      void lamp;
      const snake = this.place(sn.key, { x: x - 0.05, y: 0.86, z, rotY: i * 1.3 });
      if (sn.tint) snake.traverse((o) => o.isMesh && ((o.material = this.r.cloneMaterial(o.material)), o.material.uniforms.uColor.value.set(sn.tint)));
      if (snake.userData.animations?.length) this.animate(snake, snake.userData.animations.find((a) => /Idle/.test(a.name))?.name ?? snake.userData.animations[0].name);
      this.tanks.push({ snake, sn, home: snake.position.clone(), rot: snake.rotation.y });
      this.addInteractable(t, {
        prompt: () => (this.holding ? `Put ${this.holding.sn.name.split(' ')[0]} back first` : `Look at ${sn.name}`),
        range: 2.4,
        action: () => !this.holding && g.openUI(() => g.note.show(`${sn.name.toUpperCase()}\n\n${sn.fact}`)),
        secondary: () => (this.holding ? null : { label: 'Ask the ranger to hold her', action: () => this.#hold(i) }),
      });
      this.addLight({ position: [x, 1.35, z], color: 0xffc880, range: 1.6, intensity: 0.8 });
    });
  }

  #ranger() {
    const g = this.game;
    const r = this.place('npc_worker', { x: 4.4, y: 0, z: 0.6, rotY: -Math.PI / 2 });
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 10), this.mat({ color: 0x6a5a3a }));
    hat.position.set(0, 1.86, 0);
    r.add(hat);
    this.box(0.8, 1.8, 0.8, this.mat({ color: 0 }), 4.4, 0.9, 0.6, { collide: true }).visible = false;
    const lines = [
      'Ranger Lupe: "Hi there! Want to meet one of our snakes? Ask at any tank."',
      'Ranger Lupe: "Hold her like a garden hose that\'s also your friend. Support the middle."',
      'Ranger Lupe: "See her tongue? She\'s smelling you. You smell like a nice kid."',
      'Ranger Lupe: "Snakes aren\'t slimy. Everyone\'s always surprised. Smooth, right?"',
    ];
    let k = 0;
    this.interactVolume(4.4, 1, 0.6, 0.9, 2, 0.9, { prompt: 'Talk to the ranger', action: () => g.hud.toast(lines[k++ % lines.length], 4500) });
  }

  /** The ranger lifts a snake out and lays her across your hands. */
  #hold(i) {
    const g = this.game;
    const t = this.tanks[i];
    this.holding = t;
    const cam = g.camera;
    cam.attach(t.snake);
    t.snake.position.set(0.0, -0.32, -0.5);
    t.snake.rotation.set(0.15, Math.PI / 2, 0);
    // a pair of small hands under her
    this.hands = new THREE.Group();
    for (const sx of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), this.mat({ color: 0xc48a62 }));
      h.scale.set(1.2, 0.6, 1.5);
      h.position.set(sx * 0.12, -0.38, -0.48);
      this.hands.add(h);
    }
    cam.add(this.hands);
    g.audio.oneShot('bubble', { volume: 0.2 });
    g.hud.toast(`You're holding ${t.sn.name}! She's warm and smooth and slowly curling around your wrist. (E to give her back)`, 5000);
    this.holdT = 0;
  }

  #release() {
    const t = this.holding;
    this.root.attach(t.snake);
    t.snake.position.copy(t.home);
    t.snake.rotation.set(0, t.rot, 0);
    this.hands?.removeFromParent();
    this.holding = null;
    this.game.hud.toast(`${t.sn.name.split(' ')[0]} slides back onto her warm rock. "Thank you," says the ranger. "She liked you."`, 3500);
  }

  update(dt, time) {
    super.update(dt, time);
    const g = this.game;
    if (this.holding) {
      this.holdT += dt;
      const s = this.holding.snake;
      s.rotation.z = Math.sin(time * 1.3) * 0.25;
      s.position.x = Math.sin(time * 0.8) * 0.05;
      if (this.holdT > 0.3 && g.input.pressed('KeyE')) {
        g.input.consume('KeyE');
        this.#release();
      }
    }
  }

  onExit() {
    if (this.holding) this.#release();
  }
}

function marshTex() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 32);
  gr.addColorStop(0, '#b8d0e0');
  gr.addColorStop(0.5, '#e8e0c8');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 32);
  g.fillStyle = '#c8a860';
  g.beginPath();
  g.moveTo(0, 18);
  g.quadraticCurveTo(20, 6, 40, 14);
  g.quadraticCurveTo(54, 10, 64, 16);
  g.lineTo(64, 32);
  g.lineTo(0, 32);
  g.fill();
  g.fillStyle = '#5a7a68';
  g.fillRect(0, 24, 64, 8);
  g.fillStyle = '#7a8a40';
  for (let x = 0; x < 64; x += 2) g.fillRect(x, 20 + Math.random() * 4, 1, 6);
  return new THREE.CanvasTexture(c);
}
