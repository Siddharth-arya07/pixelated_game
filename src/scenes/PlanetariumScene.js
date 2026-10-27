import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';

/**
 * PlanetariumScene — the dome theater inside Griffith Observatory
 * --------------------------------------------------------------
 * Rows of reclining seats under a dome, the projector in the middle like a
 * big dark dumbbell. Sit down and the show starts: the lights fade, the
 * sky fills with stars and turns, constellations draw themselves, shooting
 * stars, the Milky Way, and a narrator with something kind to say.
 */
const R = 14;
const SHOW = [
  [0, 'The lights go down. Somewhere a kid whispers "whoa".'],
  [5, '"Every one of these stars is a sun. Some of them have been shining since before Earth was born."'],
  [13, '"Their light has been travelling for years — hundreds, thousands of years — just to reach your eyes tonight."'],
  [21, '"That\'s Orion, the hunter. Three stars make his belt. Find them once and you\'ll find them every winter for the rest of your life."'],
  [30, '"And the Big Dipper. Follow the two stars at the end of its cup, and they point you to the North Star. It\'s how people found their way home."'],
  [40, '"Look — a shooting star. Go on. Make a wish. No one\'s checking."'],
  [48, '"The Milky Way: four hundred billion stars, and we\'re in there somewhere, on the edge of one arm."'],
  [57, '"Out of all of that, out of all that time and space — here you are. That\'s not small. That\'s a miracle."'],
  [66, 'The stars fade, slowly. The lights come up warm. Nobody moves for a moment.'],
];

export class PlanetariumScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Planetarium', label: 'the planetarium' });
    this.indoor = { fog: 0x05060a, near: 30, far: 60, ambient: 0x2a2620, daylight: 0 };
    this.eyeHeight = 1.12;
    this.memory = true;
    this.noDog = true;
  }

  build() {
    const g = this.game;
    // floor + low wall + dome
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 32), this.mat({ map: this.tex('fabric', 8, 8), color: 0x6a2a3a }));
    floor.rotation.x = -Math.PI / 2;
    this.root.add(floor);
    this.addColliderMesh(floor, 'terrain');
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 2.4, 32, 1, true), this.mat({ color: 0x2a1a1a, doubleSide: true }));
    wall.position.y = 1.2;
    this.root.add(wall);
    this.addColliderMesh(wall);
    this.domeMat = this.mat({ color: 0x1a1c24, doubleSide: true });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), this.domeMat);
    dome.position.y = 2.4;
    this.root.add(dome);
    // the projector
    const p = new THREE.Group();
    const dark = this.mat({ color: 0x1a1a20 });
    for (const sy of [-1, 1]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), dark);
      ball.position.set(sy * 1.3, 0, 0);
      p.add(ball);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.6, 8), dark);
    bar.rotation.z = Math.PI / 2;
    p.add(bar);
    p.position.set(0, 1.8, 0);
    p.rotation.z = 0.4;
    this.root.add(p);
    this.box(0.6, 1.6, 0.6, dark, 0, 0.8, 0);
    // seats in rings, facing in
    this.seats = [];
    const seatMat = this.mat({ color: 0x8a2a3a });
    for (const [r, n] of [[5, 14], [7.5, 20], [10, 26]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const s = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), seatMat);
        seat.position.y = 0.45;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.12), seatMat);
        back.position.set(0, 0.85, -0.32);
        back.rotation.x = -0.5;
        s.add(seat, back);
        s.position.set(x, 0, z);
        s.rotation.y = Math.atan2(-x, -z) + Math.PI;
        this.root.add(s);
        this.seats.push({ x, z, a });
      }
    }
    // stars
    const N = 2400;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // the Milky Way: a band of extra stars
      const band = i < 900;
      const u = Math.random() * Math.PI * 2;
      let v = Math.acos(Math.random());
      if (band) v = Math.PI / 2 - 0.25 + (Math.random() - 0.5) * 0.35 + Math.sin(u * 2) * 0.1;
      const d = R - 0.3;
      pos.set([Math.cos(u) * Math.sin(v) * d, Math.cos(v) * d, Math.sin(u) * Math.sin(v) * d], i * 3);
      const c = 0.6 + Math.random() * 0.4;
      col.set(Math.random() < 0.15 ? [c, c * 0.85, c * 0.6] : Math.random() < 0.1 ? [c * 0.7, c * 0.85, c] : [c, c, c], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.starMat = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
    this.sky = new THREE.Group();
    this.sky.position.y = 2.4;
    this.sky.add(new THREE.Points(geo, this.starMat));
    this.root.add(this.sky);
    // constellations: Orion and the Big Dipper
    this.lines = [];
    const con = (pts) => {
      const v = pts.map(([az, el]) => new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(R - 0.4));
      const lg = new THREE.BufferGeometry().setFromPoints(v);
      const lm = new THREE.LineBasicMaterial({ color: 0x8ab8ff, transparent: true, opacity: 0 });
      const l = new THREE.Line(lg, lm);
      this.sky.add(l);
      this.lines.push(lm);
      const sg = new THREE.BufferGeometry().setFromPoints(v);
      this.sky.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, color: 0xffffff })));
    };
    con([[0.2, 0.9], [0.32, 0.8], [0.3, 0.62], [0.36, 0.56], [0.42, 0.5], [0.4, 0.34], [0.26, 0.4], [0.3, 0.62]]); // Orion-ish
    con([[2.1, 0.9], [2.28, 0.95], [2.45, 0.97], [2.62, 0.95], [2.7, 0.8], [2.95, 0.82], [2.92, 0.98], [2.62, 0.95]]); // Big Dipper
    this.meteor = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    this.root.add(this.meteor);
    this.houseLight = this.addLight({ position: [0, 3, 0], color: 0xffe0b0, range: 20, intensity: 1 });
    // exit door
    const door = this.box(1.6, 2.2, 0.2, this.mat({ color: 0x3a2a2a }), 0, 1.1, R - 0.2, { collide: false });
    this.addInteractable(door, { prompt: 'Leave the planetarium', action: () => g.changeScene('Griffith', 'door') });
    this.addSpawn('door', [0, 0, R - 1.5], Math.PI);
    this.addSpawn('default', [0, 0, R - 1.5], Math.PI);
    this.addSpawn('seat', [0, 0, R - 1.5], Math.PI);
    // sit in any seat to start the show
    for (const s of this.seats) {
      const v = this.interactVolume(s.x, 0.6, s.z, 0.7, 1.2, 0.7, { prompt: 'Lean back in a seat (the show starts)', range: 2.2, action: () => this.#sit(s) });
      void v;
    }
  }

  #sit(s) {
    const g = this.game;
    g.player.sit({
      eye: new THREE.Vector3(s.x * 0.97, 0.95, s.z * 0.97),
      yaw: Math.atan2(s.x, s.z) + Math.PI,
      pitch: 0.75,
      yawLimit: Math.PI,
      standAt: new THREE.Vector3(s.x * 0.85, 0, s.z * 0.85),
      onStand: () => (this.show = null),
    });
    this.show = { t: 0, line: 0 };
  }

  update(dt, time) {
    super.update(dt, time);
    const g = this.game;
    const sh = this.show;
    const dark = sh ? THREE.MathUtils.clamp(sh.t / 4, 0, 1) * (sh.t > 68 ? Math.max(0, 1 - (sh.t - 68) / 4) : 1) : 0;
    this.starMat.opacity = dark;
    this.houseLight.intensity = 1 - dark * 0.95;
    this.domeMat.uniforms.uColor.value.setScalar(0.1 * (1 - dark) + 0.01);
    this.sky.rotation.y = time * 0.02;
    for (const l of this.lines) l.opacity = sh && sh.t > 21 && sh.t < 46 ? Math.min(1, (sh.t - 21) / 3) * 0.8 : Math.max(0, l.opacity - dt);
    if (!sh) return;
    sh.t += dt;
    while (sh.line < SHOW.length && sh.t >= SHOW[sh.line][0]) {
      g.hud.toast(SHOW[sh.line][1], 7500);
      sh.line++;
    }
    // shooting stars after the wish line
    if (sh.t > 40 && sh.t < 62 && Math.random() < dt * 0.6 && this.meteor.material.opacity <= 0) {
      const a = Math.random() * Math.PI * 2;
      this.meteor.position.set(Math.cos(a) * 9, 9, Math.sin(a) * 9);
      this.meteor.lookAt(0, 2, 0);
      this.meteor.material.opacity = 1;
      this.meteorV = new THREE.Vector3(-Math.sin(a), -0.4, Math.cos(a)).multiplyScalar(8);
    }
    if (this.meteor.material.opacity > 0) {
      this.meteor.position.addScaledVector(this.meteorV, dt);
      this.meteor.material.opacity -= dt * 1.6;
    }
    if (sh.t > 74) {
      this.show = null;
      g.hud.toast('(Stay as long as you like. Sit again to watch it again.)', 4000);
    }
  }
}
