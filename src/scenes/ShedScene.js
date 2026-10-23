import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { addMusicDevice } from './Devices.js';
import { Table, TOP } from '../systems/roulette/Table.js';

/**
 * ShedScene — the back room
 * -------------------------
 * A windowless shack behind your house: concrete floor, one bulb on a cord
 * swinging over a felt table, two chairs, a radio on the shelf. Buckshot
 * roulette for two (see systems/Roulette.js); anyone else in the room can
 * lean on the walls and watch.
 */
const W = 5.4;
const D = 5.4;
const H = 2.6;

export class ShedScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Shed', label: 'the back room' });
    this.indoor = { fog: 0x040304, near: 2.5, far: 9.5, ambient: 0x120e10, daylight: 0 };
  }

  build() {
    const g = this.game;
    this.room({
      w: W,
      d: D,
      h: H,
      floorMat: this.mat({ map: this.tex('asphalt', 4, 4), color: 0x6a6660 }),
      wallMat: this.mat({ map: this.tex('planks', 4, 2), color: 0x5a4a3c }),
      ceilMat: this.mat({ map: this.tex('planks', 3, 3), color: 0x3a3028 }),
      doors: [{ wall: 's', at: -1.7, width: 1.0 }],
    });
    // the door (out to the yard)
    const door = this.box(1.0, 2.1, 0.06, this.mat({ color: 0x2a2018 }), -1.7, 1.05, D / 2 + 0.03, { collide: false });
    this.addInteractable(door, { prompt: 'Go back outside', action: () => g.changeScene('World', 'rshed_door') });
    this.addSpawn('door', [-1.7, 0, D / 2 - 0.8], 0);
    this.addSpawn('default', [-1.7, 0, D / 2 - 0.8], 0);

    // the table, in the middle of the room
    const table = new Table(this, new THREE.Vector3(0, 0, 0), { ui: g.roulette.ui });
    table.setRoom({ x: W / 2, z: D / 2, h: H });
    this.table = table;
    g.roulette.bind(this, table);
    for (const s of [0, 1]) {
      const at = table.standAt(s);
      const seat = table.seatEye(s);
      this.interactVolume(seat.x, 0.5, seat.z, 0.6, 1.0, 0.6, {
        prompt: () => g.roulette.seatPrompt(s),
        range: 2.2,
        enabled: () => g.roulette.mySeat !== s,
        action: () => g.roulette.sit(s),
      });
      void at;
    }

    // the bulb on its cord
    const swing = new THREE.Group();
    swing.position.set(0, H, 0);
    this.root.add(swing);
    const bulb = this.place('br_bulb', { parent: swing, y: -0.8 });
    void bulb;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), this.mat({ color: 0xffe8b0, unlit: true }));
    glow.position.set(0, -0.79, 0);
    swing.add(glow);
    const light = this.addLight({ position: new THREE.Vector3(0, H - 0.85, 0), color: 0xffd8a0, range: 5.2, intensity: 1.55, priority: 2 });
    // a faint red exit light by the door, and the dealer's end left dark
    this.addLight({ position: [-1.7, 2.3, D / 2 - 0.3], color: 0xff2a20, range: 2.2, intensity: 0.35 });
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), this.mat({ map: signTex('EXIT', '#ff3030', '#1a0606'), unlit: true }));
    exit.position.set(-1.7, 2.3, D / 2 - 0.02);
    exit.rotation.y = PI;
    this.root.add(exit);
    this.updaters.push((dt, time) => {
      swing.rotation.z = Math.sin(time * 0.9) * 0.05;
      swing.rotation.x = Math.sin(time * 0.63 + 1) * 0.035;
      swing.updateMatrixWorld(true);
      glow.getWorldPosition(light.position);
      light.intensity = 1.55 + Math.sin(time * 37) * 0.02 + (Math.random() < 0.004 ? -0.8 : 0);
    });

    // junk around the edges
    const crate = this.mat({ map: this.tex('planks', 1, 1), color: 0x6a5238 });
    this.box(0.7, 0.6, 0.6, crate, -2.2, 0.3, -2.2);
    this.box(0.6, 0.5, 0.6, crate, -2.25, 0.85, -2.15, { rotY: 0.3 });
    this.box(0.8, 0.7, 0.6, crate, 2.1, 0.35, -2.2, { rotY: -0.2 });
    // shelf with a radio on the shared music player
    this.box(1.4, 0.05, 0.35, crate, -2.5, 1.3, 0.4);
    const radio = this.place('radio', { x: -2.5, y: 1.33, z: 0.4, rotY: PI / 2 });
    if (radio) addMusicDevice(this, radio, 'the back-room radio');
    this.place('beer_bottle', { x: -2.5, y: 1.33, z: 0.0 });
    this.place('beer_bottle', { x: -2.45, y: 1.33, z: 0.85 });
    // a bench along the wall for whoever's watching
    this.box(1.8, 0.45, 0.4, crate, -2.45, 0.225, -1.0, { rotY: PI / 2 });
    // tally marks scratched on the wall
    const tally = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), this.mat({ map: tallyTex(), opacity: 0.85 }));
    tally.position.set(W / 2 - 0.01, 1.5, 1.2);
    tally.rotation.y = -PI / 2;
    this.root.add(tally);
    void TOP;
  }

  onEnter() {
    this.game.roulette.enter();
  }
}

const PI = Math.PI;

function signTex(text, fg, bg) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 24;
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, 64, 24);
  x.fillStyle = fg;
  x.font = 'bold 16px monospace';
  x.textAlign = 'center';
  x.fillText(text, 32, 18);
  return new THREE.CanvasTexture(c);
}

function tallyTex() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 64);
  x.strokeStyle = 'rgba(220,210,190,0.7)';
  x.lineWidth = 2;
  let px = 6;
  for (let g = 0; g < 6; g++) {
    for (let i = 0; i < 4; i++) {
      x.beginPath();
      x.moveTo(px + i * 4, 10 + (g % 2) * 26);
      x.lineTo(px + i * 4 + 1, 28 + (g % 2) * 26);
      x.stroke();
    }
    x.beginPath();
    x.moveTo(px - 2, 24 + (g % 2) * 26);
    x.lineTo(px + 16, 14 + (g % 2) * 26);
    x.stroke();
    px += g % 2 ? 26 : 0;
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}
