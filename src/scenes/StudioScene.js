import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { signTexture } from '../core/Procedural.js';

/**
 * StudioScene
 * -----------
 * The music shed next to your house: a small, cluttered practice room.
 * Drum kit against the back wall, the piano on the left, the guitar on its
 * stand in the corner, a mic in the middle and the karaoke lyrics on a
 * screen over the door. Posters, an amp, egg-crate foam, coloured lights.
 * (Playing them: systems/Instruments.js.)
 *
 * Room: 6 × 5 m, door in the south wall (+Z).
 */
const W = 6;
const D = 5;
const H = 2.8;

export class StudioScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'Studio', label: 'the music shed' });
    this.indoor = { fog: 0x120c14, near: 6, far: 22, ambient: 0x4a3a46, daylight: 0.15 };
  }

  build() {
    const g = this.game;
    const I = g.instruments;
    this.room({
      w: W,
      d: D,
      h: H,
      floorMat: this.mat({ map: this.tex('wood_floor', 3, 2.5), color: 0xa08870 }),
      wallMat: this.mat({ map: this.tex('wall', 3, 1), color: 0x6a5a6a }),
      ceilMat: this.mat({ map: this.tex('ceiling', 3, 2.5), color: 0x5a5058 }),
      doors: [{ wall: 's', at: 0, width: 1.0 }],
    });

    // ---- door ----------------------------------------------------------------
    const door = this.box(1.0, 2.1, 0.06, this.mat({ color: 0x4a3426 }), 0, 1.05, D / 2 - 0.03, { collide: false });
    this.addInteractable(door, { prompt: 'Go outside', action: () => g.changeScene('World', 'studio_door') });
    this.addSpawn('door', [0, 0, D / 2 - 0.9], 0);
    this.addSpawn('default', [0, 0, D / 2 - 0.9], 0);

    // ---- rug + egg-crate foam on the back wall -------------------------------------
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.9, 18), this.mat({ color: 0x5a2030 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.01, -0.3);
    this.root.add(rug);
    const foam = this.mat({ color: 0x2a2a30 });
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) this.box(0.42, 0.42, 0.05, foam, -1.25 + i * 0.5, 1.2 + j * 0.5, -D / 2 + 0.03, { collide: false }).rotation.z = (i + j) % 2 ? 0 : Math.PI / 2;

    // ---- instruments -----------------------------------------------------------------
    const fwd = new THREE.Vector3(0, 0, 1); // everything faces the door side
    const drums = this.place('drum_kit', { x: 0, y: 0, z: -1.25, rotY: 0 });
    this.addColliderFromObject(drums, 0.3);
    I.add(this, drums, 'drums', { position: new THREE.Vector3(0, 1.35, -2.25), target: new THREE.Vector3(0, 0.6, -1.0), fov: 64 });

    const piano = this.place('piano', { x: -2.1, y: 0, z: -0.3, rotY: Math.PI / 2 });
    this.snapToWall(piano, ['w', -W / 2]);
    this.addColliderFromObject(piano, 0.2);
    const pc = piano.position;
    I.add(this, piano, 'piano', { position: new THREE.Vector3(pc.x + 1.15, 1.45, pc.z), target: new THREE.Vector3(pc.x + 0.1, 0.85, pc.z), fov: 55 });

    const guitar = this.place('guitar', { x: 2.35, y: 0, z: -1.5, rotY: -0.6 });
    guitar.rotation.x = -0.18; // leaning on its stand
    this.box(0.3, 0.08, 0.3, this.mat({ color: 0x1a1a1e }), 2.35, 0.04, -1.5, { collide: false });
    I.add(this, guitar, 'guitar', { position: new THREE.Vector3(1.75, 1.4, -0.9), target: new THREE.Vector3(2.35, 0.75, -1.5), fov: 60 });

    const mic = this.place('mic_stand', { x: 0, y: 0, z: 0.5, rotY: Math.PI });
    // the singer stands behind the mic, looking at the lyrics over the door
    I.add(this, mic, 'karaoke', { position: new THREE.Vector3(0, 1.62, 0.0), target: new THREE.Vector3(0, 2.0, D / 2), fov: 62 });

    // ---- lyrics screen above the door -----------------------------------------------
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    tex.userData.live = true;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.76), this.mat({ map: tex, unlit: true, affine: 0 }));
    scr.position.set(0, 2.32, D / 2 - 0.04);
    scr.rotation.y = Math.PI;
    this.root.add(scr);
    this.box(2.0, 0.84, 0.04, this.mat({ color: 0x0a0a0c }), 0, 2.32, D / 2 - 0.02, { collide: false });
    const speaker = new THREE.Object3D();
    speaker.position.set(0, 1.6, -0.5);
    this.root.add(speaker);
    I.setScreen(canvas, tex, speaker);

    // ---- amp, posters, a chair, lights -----------------------------------------------------
    const amp = this.box(0.55, 0.5, 0.3, this.mat({ color: 0x1c1c20 }), 2.3, 0.25, 0.6);
    const grill = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.32), this.mat({ color: 0x3a3a40 }));
    grill.position.set(2.3, 0.22, 0.756);
    this.root.add(grill);
    void amp;
    const posters = [
      [['THE FOGHORNS', 'LIVE AT RAY’S'], '#2a1a4a', '#ffd860', -2.98, 1.7, 1.4, Math.PI / 2],
      [['NIGHT SHIFT', 'TAPES'], '#4a1a1a', '#f0e0c0', 2.98, 1.7, -0.2, -Math.PI / 2],
      [['3 A.M.', 'WORLD TOUR'], '#1a3a3a', '#8afff0', 2.98, 1.6, 1.4, -Math.PI / 2],
    ];
    for (const [lines, bg, fg, x, y, z, ry] of posters) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.95), this.mat({ map: signTexture(lines, { bg, fg, w: 96, h: 128 }) }));
      p.position.set(x, y, z);
      p.rotation.y = ry;
      this.root.add(p);
    }
    this.place('chair', { x: -1.2, z: 1.6, rotY: 2.6, collide: 0.1 });
    for (const [x, z, col] of [[-1.8, -1.6, 0xff5ab0], [1.8, -1.6, 0x5ae0e0], [0, 1.2, 0xffc880]]) {
      this.addLight({ position: [x, 2.5, z], color: col, range: 5, intensity: 1.0 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), this.mat({ color: col, unlit: true }));
      bulb.position.set(x, 2.7, z);
      this.root.add(bulb);
    }
    void fwd;
  }
}
