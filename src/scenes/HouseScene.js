import * as THREE from 'three';
import { FLOWERS } from './Garden.js';
import { paintOil, PAINTINGS } from '../render/OilPaint.js';
import selfieUrl from '../assets/photos/photo_selfie.png?url';
import togetherUrl from '../assets/photos/photo_together.png?url';
import dinerUrl from '../assets/photos/photo_diner.png?url';
import tableUrl from '../assets/photos/photo_table.png?url';

const NOTE_TEXT =
  "i know ur going through a lot of stuff rn but from what i can see is ur future is bright and seeing u win will make me more happy than u can imagine, hard times pass and this will pass too\n\nand i like my women in stem ;)";
import { BaseScene } from './BaseScene.js';
import { signTexture } from '../core/Procedural.js';
import { FOSSILS } from './CaveScene.js';
import { ComputerOS } from '../computer/ComputerOS.js';
import { addTV, addMusicDevice, addSeat } from './Devices.js';

/**
 * HouseScene
 * ----------
 * A cramped one-room place at 3:00 a.m. (Kenney Furniture Kit models):
 *  - kitchenette: fridge with a door that swings open (light + contents),
 *    microwave whose window glows while it runs
 *  - desk corner (reference #1): laptop running DINO.EXE, hi-fi rack, VOLT can
 *  - living area: CRT with static, sofa, rug · bed, floor lamp, bookcase
 *  - the fishing rod leaning by the door
 *
 * Room spans x -4..4, z -3.5..3.5; door on the south wall at x = 2.5.
 */
const ROOM = { w: 8, d: 7, h: 2.6 };
const N = -3.5;
const S = 3.5;
const E = 4;
const W = -4;

export class HouseScene extends BaseScene {
  constructor(game) {
    super(game, { name: 'House', label: 'home' });
    this.indoor = { fog: 0x0c0b12, near: 3, far: 18, ambient: 0x1c1a26, daylight: 0.35 };
    this.microwaveTimer = 0;
    this.fridgeOpen = false;
  }

  build() {
    const g = this.game;

    // ---- shell ------------------------------------------------------------
    this.room({
      w: ROOM.w,
      d: ROOM.d,
      h: ROOM.h,
      floorMat: this.mat({ map: this.tex('wood_floor', 4, 3.5) }),
      wallMat: this.mat({ map: this.tex('wall', 4, 1.3) }),
      ceilMat: this.mat({ map: this.tex('ceiling', 4, 3.5) }),
      doors: [{ wall: 's', at: -2.5, width: 1.0 }],
    });
    // Window on the west wall: dark night-blue pane + frame.
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), this.mat({ color: 0x141c34, unlit: true }));
    pane.position.set(W + 0.02, 1.5, -0.4);
    pane.rotation.y = Math.PI / 2;
    this.root.add(pane);
    const frameMat = this.mat({ color: 0xc8c0b0 });
    this.box(0.05, 0.06, 1.4, frameMat, W + 0.03, 1.5, -0.4, { collide: false });
    this.box(0.05, 1.1, 0.06, frameMat, W + 0.03, 1.5, -0.4, { collide: false });

    const door = this.box(1.0, 2.1, 0.06, this.mat({ color: 0x4a3426 }), 2.5, 1.05, S + 0.03);
    this.addInteractable(door, { prompt: 'Go outside', action: () => g.changeScene('World', 'house_door') });
    this.addSpawn('door', [2.5, 0, 2.7], 0);
    this.addSpawn('default', [2.5, 0, 2.7], 0);
    // Standing behind the desk chair, looking at the laptop (+X).
    this.addSpawn('start', [2.35, 0, -1.2], -Math.PI / 2, -0.38);

    this.#kitchen();
    this.#desk();
    this.#living();
    this.#bedroom();
    this.#photosAndNote();
    this.#bong();
    this.#art();

    this.updaters.push((dt) => {
      this.#updateMicrowave(dt);
      this.#updateFridge();
    });
  }

  // ---------------------------------------------------------------------------
  // Kitchen
  // ---------------------------------------------------------------------------

  #kitchen() {
    const g = this.game;
    // Counter run along the north wall: cabinet · sink · cabinet.
    let x = W + 0.05;
    const run = [];
    for (const key of ['kitchen_cabinet', 'kitchen_sink', 'kitchen_cabinet']) {
      const o = this.place(key, { x, z: 0 });
      this.snapToWall(o, ['n', N]);
      const b = this.bounds(o);
      o.position.x += x - b.min.x;
      x += b.max.x - b.min.x;
      this.addColliderFromObject(o);
      run.push(o);
    }
    const top = this.bounds(run[0]).max.y;
    // Microwave on the left cabinet.
    const mw = this.place('microwave', { x: run[0].position.x, y: top, z: 0 });
    this.snapToWall(mw, ['n', N], 0.06);
    this.microwave = mw;
    // Upper cabinets, hung clear of the microwave (they used to cut into it).
    const upY = Math.max(1.55, this.bounds(mw).max.y + 0.08);
    for (const base of [run[0], run[2]]) {
      const up = this.place('kitchen_upper', { x: base.position.x, y: upY, z: 0 });
      this.snapToWall(up, ['n', N]);
    }
    const mwFront = this.bounds(mw);
    this.mwGlass = this.materialSlots(mw, 'glass');
    this.mwGlassOn = this.mat({ color: 0xffd890, unlit: true });
    this.mwGlassOff = this.mwGlass[0]?.mesh.material ?? null;
    this.mwLight = this.addLight({ position: [mw.position.x, top + 0.2, mwFront.max.z + 0.4], color: 0xffc070, range: 3.6, intensity: 1.3, enabled: false, priority: 2 });
    this.addInteractable(mw, {
      prompt: () => {
        const h = this.#heatable();
        return h ? `Heat ${g.inventory.def(h).name}` : 'Run microwave (empty)';
      },
      available: () => (this.microwaveTimer > 0 ? `Microwave running... ${Math.ceil(this.microwaveTimer)}s` : true),
      action: () => this.#startMicrowave(),
    });

    // Counter clutter (ref #4: a can next to the microwave).
    this.place('soda_can', { x: run[0].position.x + 0.42, y: top, z: N + 0.35 });
    // An empty mason jar (for fireflies).
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), this.mat({ color: 0xc8e8d8, opacity: 0.55 }));
    jar.position.set(run[0].position.x + 0.65, top + 0.07, N + 0.32);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 10), this.mat({ color: 0xc8a040 }));
    lid.position.y = 0.08;
    jar.add(lid);
    this.root.add(jar);
    this.addInteractable(jar, {
      prompt: 'Take the empty jar',
      action: () => {
        g.inventory.add('jar');
        jar.removeFromParent();
        this.interactables = this.interactables.filter((o) => o !== jar);
        g.hud.toast('A mason jar with holes poked in the lid. Fireflies come out on warm nights.', 4500);
      },
    });
    const box = this.place('pizza_box', { x: run[2].position.x, y: top, z: N + 0.32, rotY: 0.2 });
    this.place('pizza', { x: run[2].position.x + 0.05, y: this.bounds(box).max.y, z: N + 0.3, rotY: 0.8 });

    // Gas stove on the free stretch of the north wall (cooking: systems/CookingSystem).
    const stove = this.place('stove', { x: 1.5, z: 0 });
    this.snapToWall(stove, ['n', N]);
    this.addColliderFromObject(stove);
    g.cooking.setupStove(this, stove);

    // Fridge right of the counter run, door swings open.
    const fridge = this.place('fridge', { x: x + 0.5, z: 0 });
    this.snapToWall(fridge, ['n', N]);
    this.addColliderFromObject(fridge);
    this.fridge = fridge;
    this.#setupFridge(fridge);
    this.addSound('fluorescent_hum', new THREE.Vector3(fridge.position.x, 1.6, N + 0.3), { volume: 0.12, refDistance: 1 });

    this.place('trashcan', { x: x + 1.25, z: N + 0.3 });
  }

  #setupFridge(fridge) {
    const g = this.game;
    const fb = this.bounds(fridge);
    const front = fb.max.z;
    const cx = (fb.min.x + fb.max.x) / 2;
    this.fridgeDoor = fridge.getObjectByName('doorFridge');
    this.fridgeDoorClosed = this.fridgeDoor?.rotation.y ?? 0;
    this.fridgeFront = new THREE.Vector3(cx, 1.0, front);

    // Interior "glow": a lit back panel and two shelf lips, only visible open.
    this.fridgeInside = new THREE.Group();
    this.fridgeInside.visible = false;
    const w = fb.max.x - fb.min.x - 0.12;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.05), this.mat({ color: 0xa8c0cc, unlit: true }));
    glow.position.set(cx, 0.82, front + 0.005);
    this.fridgeInside.add(glow);
    const shelfMat = this.mat({ color: 0xc8d8e0, unlit: true, opacity: 0.85 });
    for (const y of [0.55, 0.95]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, 0.22), shelfMat);
      shelf.position.set(cx, y, front + 0.11);
      this.fridgeInside.add(shelf);
    }
    this.root.add(this.fridgeInside);
    this.#fridgePhotos(fb);

    // Contents (take-able while open).
    const pizza = this.place('pizza', { x: cx - 0.1, y: 0.97, z: front + 0.1, parent: this.fridgeInside });
    const beers = [0.1, 0.2].map((dx) => this.place('beer_bottle', { x: cx + dx, y: 0.57, z: front + 0.1, parent: this.fridgeInside }));
    const take = (obj, item, msg) => {
      this.addInteractable(obj, {
        prompt: `Take ${g.inventory.def(item).name}`,
        range: 2.2,
        enabled: () => this.fridgeOpen && obj.visible,
        action: () => {
          obj.visible = false;
          g.inventory.add(item);
          g.hud.toast(msg);
        },
      });
    };
    take(pizza, 'pizza', 'Cold pizza. Microwave it.');
    beers.forEach((b) => take(b, 'beer', 'Night Owl. Ice cold.'));
    // Someone (you, apparently) restocks the fridge every night.
    let stockDay = g.dayNight.day;
    this.updaters.push(() => {
      if (g.dayNight.day === stockDay) return;
      stockDay = g.dayNight.day;
      pizza.visible = true;
      beers.forEach((b) => (b.visible = true));
    });

    this.fridgeLight = this.addLight({ position: [cx, 1.0, front + 0.7], color: 0xd8f0ff, range: 3.2, intensity: 1.2, enabled: false, priority: 2 });
    this.addInteractable(fridge, {
      prompt: () => (this.fridgeOpen ? 'Close fridge' : 'Open fridge'),
      action: () => this.#toggleFridge(),
    });
  }

  /** Your newest Polaroids, stuck to the fridge door with magnets (swing with the door). */
  #fridgePhotos(fb) {
    const g = this.game;
    const front = fb.max.z + 0.012;
    const w = fb.max.x - fb.min.x;
    const cx = (fb.min.x + fb.max.x) / 2;
    const slots = [];
    const loader = new THREE.TextureLoader();
    const magnetCols = [0xff5a5a, 0xffd040, 0x5ab0ff, 0x6ad070, 0xff8ad0, 0xb08aff];
    for (let i = 0; i < 6; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.24), this.mat({ color: 0xffffff }));
      m.position.set(cx - w * 0.2 + col * w * 0.4 + (Math.random() - 0.5) * 0.04, 1.55 - row * 0.3, front);
      m.rotation.z = (Math.random() - 0.5) * 0.25;
      m.visible = false;
      const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 8), this.mat({ color: magnetCols[i] }));
      mag.rotation.x = Math.PI / 2;
      mag.position.set(0, 0.1, 0.006);
      m.add(mag);
      this.root.add(m);
      if (this.fridgeDoor) this.fridgeDoor.attach(m);
      slots.push(m);
    }
    let shown = '';
    const refresh = () => {
      const photos = g.polaroid?.photos ?? [];
      const key = photos.slice(0, 6).map((p) => p.t).join();
      if (key === shown) return;
      shown = key;
      slots.forEach((m, i) => {
        const p = photos[i];
        m.visible = !!p;
        if (!p) return;
        loader.load(p.src, (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          m.material = this.mat({ map: t });
        });
      });
    };
    refresh();
    this.updaters.push(refresh);
  }

  /** Net: someone else opened/closed the fridge. */
  setFridge(open) {
    if (open !== this.fridgeOpen) this.#toggleFridge(open, true);
  }

  #toggleFridge(open = !this.fridgeOpen, fromNet = false) {
    if (!fromNet) this.game.net?.online && this.game.net.event('fridge', { open });
    if (open === this.fridgeOpen) return;
    this.fridgeOpen = open;
    const g = this.game;
    g.audio.oneShot(open ? 'fridge_open' : 'fridge_close', { volume: 0.8, object: this.fridge });
    this.fridgeLight.enabled = open;
    if (open) this.fridgeInside.visible = true;
    if (this.fridgeDoor) {
      g.tweens
        .to(this.fridgeDoor.rotation, { y: this.fridgeDoorClosed + (open ? -1.85 : 0) }, open ? 0.55 : 0.4, { ease: open ? 'outBack' : 'in' })
        .then(() => {
          if (!this.fridgeOpen) this.fridgeInside.visible = false;
        });
    } else if (!open) this.fridgeInside.visible = false;
  }

  /** Auto-close when you walk away. */
  #updateFridge() {
    if (!this.fridgeOpen) return;
    const p = this.game.player.position;
    if (Math.hypot(p.x - this.fridgeFront.x, p.z - this.fridgeFront.z) > 3.2) this.#toggleFridge(false);
  }

  #heatable() {
    const inv = this.game.inventory;
    return ['pizza', 'frozen_pizza', 'noodles', 'venison', 'fish_catfish', 'fish_bass', 'fish_trout', 'fish_perch', 'fish_pike'].find((id) => inv.has(id)) ?? null;
  }

  #startMicrowave() {
    const g = this.game;
    this.heating = this.#heatable();
    if (this.heating) g.inventory.remove(this.heating);
    this.microwaveTimer = this.heating === 'frozen_pizza' ? 8 : 5;
    this.mwLight.enabled = true;
    this.setSlots(this.mwGlass, this.mwGlassOn);
    this.mwHum = g.audio.positional('microwave_hum', this.microwave, { volume: 0.6, refDistance: 1 });
  }

  #updateMicrowave(dt) {
    if (this.microwaveTimer <= 0) return;
    this.microwaveTimer -= dt;
    // The light breathes a little like a real turntable lamp.
    this.mwLight.intensity = 1.2 + Math.sin(this.game.time * 9) * 0.08;
    if (this.microwaveTimer > 0) return;
    const g = this.game;
    this.mwLight.enabled = false;
    if (this.mwGlassOff) this.setSlots(this.mwGlass, this.mwGlassOff);
    this.mwHum?.stop();
    g.audio.oneShot('microwave_beep', { volume: 0.7, object: this.microwave });
    if (this.heating === 'noodles') {
      g.hunger.eat(35);
      g.hud.toast('Noodles done. You eat them standing up.');
    } else if (this.heating?.startsWith('fish_')) {
      g.inventory.add('cooked_fish');
      g.hud.toast('*BEEP* Microwaved fish. Bold.');
    } else if (this.heating === 'venison') {
      g.inventory.add('cooked_venison');
      g.hud.toast('*BEEP* Microwaved deer. The smell will never leave.');
    } else if (this.heating) {
      g.inventory.add('hot_pizza');
      g.hud.toast('*BEEP BEEP BEEP* Hot pizza.');
    } else g.hud.toast('*BEEP BEEP BEEP* ...you microwaved nothing.');
    this.heating = null;
  }

  // ---------------------------------------------------------------------------
  // Desk corner — reference #1
  // ---------------------------------------------------------------------------

  #desk() {
    const g = this.game;
    const desk = this.place('desk', { x: 3.5, z: -1.2, rotY: -Math.PI / 2 });
    this.snapToWall(desk, ['e', E]);
    this.addColliderFromObject(desk);
    const db = this.bounds(desk);
    const top = db.max.y;
    const deskX = (db.min.x + db.max.x) / 2;
    this.deskTop = { x: deskX, y: top };

    // Laptop (procedural: its screen is a live canvas running the desktop OS).
    const laptop = this.place('laptop', { x: deskX - 0.05, y: top, z: -1.2, rotY: -Math.PI / 2 });
    this.os = new ComputerOS(g, laptop);
    const screen = laptop.userData.screen;
    if (screen) screen.material = this.mat({ map: this.os.texture, unlit: true, affine: 0 });
    // While you're not using it the desktop still ticks (clock, music bars).
    this.updaters.push((dt) => !this.os.active && this.os.update(dt, g.input));
    this.laptopLight = this.addLight({ position: [deskX - 0.6, top + 0.3, -1.2], color: 0x50c0c8, range: 4.2, intensity: 1.3, priority: 2 });
    this.addInteractable(laptop, {
      prompt: 'Use laptop',
      range: 2.6,
      action: () => this.#useLaptop(laptop),
    });

    // Desk clutter
    const volt = this.place('energy_drink', { x: deskX - 0.15, y: top, z: -0.65 });
    this.addInteractable(volt, {
      prompt: 'Take VOLT Energy',
      enabled: () => volt.visible,
      action: () => {
        g.inventory.add('energy_drink');
        volt.visible = false;
      },
    });
    this.place('ashtray', { x: deskX + 0.1, y: top, z: -1.75 });
    const cigs = this.place('cigarette_pack', { x: deskX - 0.05, y: top, z: -1.85, rotY: 0.4 });
    this.addInteractable(cigs, {
      prompt: 'Take cigarettes',
      enabled: () => cigs.visible,
      action: () => {
        g.inventory.add('cigarettes');
        g.inventory.add('lighter');
        cigs.visible = false;
        g.hud.toast('Pack of Marlboros + a lighter.');
      },
    });
    this.place('books', { x: deskX + 0.2, y: top, z: -0.55, rotY: 1.2 });

    // Desk chair, tucked in so it doesn't block you.
    const chair = this.place('chair', { x: deskX - 0.75, z: -1.2, rotY: Math.PI / 2 });
    this.tint(chair, { carpet: 0x2a2a34 });

    // Hi-fi rack (procedural, it's the reference's centrepiece) + floor speaker.
    const stereo = this.place('stereo', { x: 3.6, z: -2.95, rotY: -Math.PI / 2 });
    this.snapToWall(stereo, ['e', E]);
    this.addColliderFromObject(stereo);
    this.addLight({ position: [3.3, 0.8, -2.95], color: 0x3090ff, range: 1.8, intensity: 0.8 });
    const spk = this.place('speaker', { x: 3.6, z: 0.05, rotY: -Math.PI / 2 });
    this.snapToWall(spk, ['e', E]);
    this.addColliderFromObject(spk);
    addMusicDevice(this, stereo, 'stereo');
  }

  /** Sit down at the laptop: camera leans into the screen, mouse drives the cursor. */
  #useLaptop(laptop) {
    const g = this.game;
    const screen = laptop.userData.screen;
    if (!screen) return g.hud.toast('No signal.');
    screen.updateMatrixWorld(true);
    const centre = screen.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(screen.matrixWorld);
    this.os.open();
    g.enterFocus({
      position: centre.clone().addScaledVector(normal, 0.42),
      target: centre,
      fit: { w: 0.33, h: 0.21 }, // the laptop screen
      hiRes: true,
      hint: 'MOUSE move · CLICK open · SPACE jump (dino) · E get up',
      onUpdate: (dt, input) => this.os.update(dt, input),
      onExit: () => this.os.close(),
    });
  }

  // ---------------------------------------------------------------------------
  // Living area + bedroom
  // ---------------------------------------------------------------------------

  #living() {
    const g = this.game;
    this.place('rug', { x: 0.4, y: 0.005, z: 1.45 });
    const cab = this.place('tv_cabinet', { x: 0.4, z: 0.2, collide: true });
    const tv = this.place('crt_tv', { x: 0.35, y: this.bounds(cab).max.y, z: 0.25 });
    this.tv = addTV(this, tv, { channels: ['static', 'news', 'infomercial', 'aquarium', 'nightdrive'] });
    const sofa = this.place('couch', { x: 0.4, z: 2.7, rotY: Math.PI, collide: 0.1 });
    this.tint(sofa, { carpet: 0x4a4258 });
    addSeat(this, sofa, { eye: [0.4, 1.02, 2.62], yaw: 0, pitch: -0.1, yawLimit: 1.4, standAt: [1.7, 0, 2.2] }, 'Sit on the couch');
    this.place('plant', { x: -0.9, z: 3.1 });
    this.#coffeeTable();
    this.#fossilCabinet();

    // Vase on the TV cabinet for flowers from the garden.
    const cb = this.bounds(cab);
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.2, 8), this.mat({ color: 0x5a7a9a }));
    vase.position.set(cb.max.x - 0.14, cb.max.y + 0.1, (cb.min.z + cb.max.z) / 2);
    this.root.add(vase);
    const bouquet = new THREE.Group();
    bouquet.position.copy(vase.position).y += 0.1;
    this.root.add(bouquet);
    const kinds = Object.keys(FLOWERS);
    this.addInteractable(vase, {
      range: 2.4,
      prompt: () => {
        const have = kinds.find((k) => g.inventory.has(`flower_${k}`));
        return have ? `Put the ${FLOWERS[have].name.toLowerCase()} in the vase` : bouquet.children.length ? 'Flowers' : 'Empty vase';
      },
      available: () => (kinds.some((k) => g.inventory.has(`flower_${k}`)) || bouquet.children.length ? true : 'Empty vase. Grow something.'),
      action: () => {
        const have = kinds.find((k) => g.inventory.has(`flower_${k}`));
        if (!have) return g.hud.toast(bouquet.children.length > 2 ? 'They look nice.' : 'Could use a few more.');
        g.inventory.remove(`flower_${have}`);
        if (bouquet.children.length >= 7) bouquet.remove(bouquet.children[0]);
        const f = FLOWERS[have];
        const stem = new THREE.Group();
        const h = 0.22 + Math.random() * 0.12;
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, h, 3), this.mat({ color: 0x3a7a32 }));
        st.position.y = h / 2;
        const head = new THREE.Mesh(new THREE.SphereGeometry(f.size * 0.45, 6, 4), this.mat({ color: f.petal, emissive: f.night ? 0.8 : 0 }));
        head.position.y = h;
        stem.add(st, head);
        stem.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * 6, (Math.random() - 0.5) * 0.5);
        bouquet.add(stem);
        g.hud.toast(`${f.name} in the vase.`);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // The two of you (photos over the bed) + the note on the desk
  // ---------------------------------------------------------------------------

  #photosAndNote() {
    const g = this.game;
    const loader = new THREE.TextureLoader();
    const frameMat = this.mat({ color: 0x2a2018 });
    const matBoard = this.mat({ color: 0xe8e2d4 });
    // Framed photos: two on the west wall above the bed, two on the east
    // wall above the desk. [url, wall x, facing, z, height, tilt, w, h]
    const photos = [
      [selfieUrl, W + 0.03, Math.PI / 2, 1.75, 1.62, 0.03, 0.56, 0.42],
      [togetherUrl, W + 0.03, Math.PI / 2, 2.85, 1.62, -0.025, 0.56, 0.42],
      [dinerUrl, E - 0.03, -Math.PI / 2, -1.75, 1.72, -0.02, 0.52, 0.39],
      [tableUrl, E - 0.03, -Math.PI / 2, -0.85, 1.74, 0.03, 0.33, 0.44],
    ];
    for (const [url, wx, facing, z, py, tilt, pw, ph] of photos) {
      const tex = loader.load(url);
      const group = new THREE.Group();
      group.position.set(wx, py, z);
      group.rotation.set(0, facing, tilt);
      const back = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.12, ph + 0.12, 0.03), frameMat);
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.06, ph + 0.06), flat(matBoard, 1));
      mat.position.z = 0.03;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), flat(this.mat({ map: tex, affine: 0 }), 2));
      pic.position.z = 0.045;
      group.add(back, mat, pic);
      this.root.add(group);
      const centre = new THREE.Vector3(wx + Math.sin(facing) * 0.02, py, z);
      this.addInteractable(back, {
        prompt: 'Look at the photo',
        range: 3,
        action: () =>
          g.enterFocus({
            position: centre.clone().add(new THREE.Vector3(Math.sin(facing) * 0.55, 0, 0)),
            target: centre,
            fit: { w: pw + 0.14, h: ph + 0.14 },
            hint: 'E step back',
          }),
      });
    }

    // The note, folded open on the desk next to the laptop, with a pen.
    const desk = this.deskTop;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.15), this.mat({ map: noteTexture(), color: 0xffffff }));
    paper.rotation.set(-Math.PI / 2, 0, 0.35);
    paper.position.set(desk.x - 0.26, desk.y + 0.004, -1.68);
    this.root.add(paper);
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 5), this.mat({ color: 0x1a2a6a }));
    pen.rotation.set(0, 0, Math.PI / 2);
    pen.rotation.y = 0.9;
    pen.position.set(desk.x - 0.2, desk.y + 0.006, -1.55);
    this.root.add(pen);
    this.addInteractable(paper, {
      prompt: 'Read the note',
      range: 2.4,
      action: () => g.openUI(() => g.note.show(NOTE_TEXT)),
    });
  }

  // ---------------------------------------------------------------------------
  // Bong by the couch + the stash tin on the bookcase
  // ---------------------------------------------------------------------------

  #bong() {
    const g = this.game;
    const inv = g.inventory;
    const bong = this.place('bong', { x: -0.3, z: 1.95, rotY: 0.6 });
    this.addInteractable(bong, {
      range: 2.6,
      prompt: () => (inv.has('weed') ? 'Hit the bong' : 'Bong'),
      available: () => {
        if (!inv.has('weed')) return 'Bowl\'s empty. Stash tin is on the bookcase.';
        if (!inv.has('lighter')) return 'Need a lighter.';
        if (!g.viewModel.handsFree) return 'Hands are full.';
        return true;
      },
      action: () => {
        if (!g.viewModel.handsFree) return g.hud.toast('Put down what you\'re holding first.');
        inv.remove('weed');
        g.viewModel.bongHit().then((ok) => (ok ? inv.addHigh(0.55) : inv.add('weed')));
      },
    });

    const sb = this.shelfBounds;
    const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), this.mat({ color: 0x4a6a3a }));
    tin.position.set((sb.min.x + sb.max.x) / 2, sb.max.y + 0.025, 1.3);
    this.root.add(tin);
    let left = 3;
    let day = g.dayNight.day;
    this.addInteractable(tin, {
      range: 2.4,
      prompt: () => (left ? `Take from the stash (${left} left)` : 'Stash tin (empty)'),
      available: () => (left ? true : 'Empty till tomorrow night.'),
      action: () => {
        left--;
        inv.add('weed');
        g.hud.toast('A gram. The bong is by the couch.');
      },
    });
    this.updaters.push(() => {
      if (g.dayNight.day !== day) {
        day = g.dayNight.day;
        left = 3;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Oil paintings on the walls + the easel by the window
  // ---------------------------------------------------------------------------

  #art() {
    const g = this.game;
    const frameMat = this.mat({ color: 0x6a4a22 });
    const gilt = this.mat({ color: 0xa8843a });
    // slot: [painting, position, rotY]
    const slots = [
      ['lighthouse', new THREE.Vector3(-2.6, 1.65, S - 0.04), Math.PI],
      ['sunflowers', new THREE.Vector3(-0.55, 1.68, S - 0.04), Math.PI],
      ['starryroad', new THREE.Vector3(E - 0.04, 1.78, 1.65), -Math.PI / 2],
    ];
    this.frames = slots.map(([key, pos, rotY]) => {
      const canvas = paintOil(key);
      const tex = new THREE.CanvasTexture(canvas);
      tex.userData.live = true;
      const fw = 0.92;
      const fh = 0.69;
      const group = new THREE.Group();
      group.position.copy(pos);
      group.rotation.y = rotY;
      // Layers well apart (+ depth bias): the PS1 vertex wobble made them
      // z-fight and flicker when they were millimetres apart.
      const outer = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.14, fh + 0.14, 0.04), frameMat);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.05, fh + 0.05, 0.04), flat(gilt, 1));
      inner.position.z = 0.02;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), flat(this.mat({ map: tex, affine: 0 }), 2, true));
      pic.position.z = 0.055;
      group.add(outer, inner, pic);
      this.root.add(group);
      const slot = { key, canvas, tex, title: PAINTINGS[key].title, group };
      this.addInteractable(outer, {
        prompt: () => `"${slot.title}"`,
        range: 3.2,
        action: () => {
          const c = new THREE.Vector3();
          pic.getWorldPosition(c);
          const n = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion);
          g.enterFocus({ position: c.clone().addScaledVector(n, 0.8), target: c, fit: { w: fw + 0.2, h: fh + 0.2 }, hint: 'E step back' });
        },
      });
      return slot;
    });

    // Paintings you hung yourself survive reloads.
    let hung = {};
    try {
      hung = JSON.parse(localStorage.getItem('3am-hung') ?? '{}');
    } catch {}
    for (const [k, url] of Object.entries(hung)) this.hangPainting(Number(k), url, false);

    // Easel by the window: three legs, a ledge, and your canvas.
    const wood = this.mat({ color: 0x8a6a44 });
    const ex = -2.75;
    const ez = -1.75;
    const easel = new THREE.Group();
    easel.position.set(ex, 0, ez);
    easel.rotation.y = Math.PI / 2; // canvas faces +X (into the room)
    for (const [dx, rz, rx] of [[-0.32, -0.12, -0.12], [0.32, 0.12, -0.12], [0, 0, 0.35]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.75, 0.04), wood);
      leg.position.set(dx, 0.85, rx > 0 ? -0.25 : 0);
      leg.rotation.set(rx, 0, rz);
      easel.add(leg);
    }
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.08), wood);
    ledge.position.set(0, 0.88, 0.05);
    easel.add(ledge);
    const paint = g.paint;
    const etex = new THREE.CanvasTexture(paint.canvas);
    etex.userData.live = true;
    paint.onPaint = () => (etex.needsUpdate = true);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.025), this.mat({ color: 0xd8d2c2 }));
    board.position.set(0, 1.2, 0.04);
    board.rotation.x = -0.1;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.585), flat(this.mat({ map: etex, affine: 0 }), 2, true));
    face.position.z = 0.03;
    board.add(face);
    easel.add(board);
    this.root.add(easel);
    this.addColliderBox(ex, 0.8, ez, 0.6, 1.6, 0.8);
    this.addInteractable(board, {
      prompt: 'Paint',
      range: 2.6,
      action: () => g.openUI(() => g.paint.show()),
    });
  }

  /** Put a painting (data URL) into frame `slot`; saved for next time. */
  hangPainting(slot, url, persist = true, fromNet = false) {
    const f = this.frames?.[slot];
    if (!f) return;
    if (persist && !fromNet) this.game.net?.online && this.game.net.event('hang', { slot, url });
    const img = new Image();
    img.onload = () => {
      const ctx = f.canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, f.canvas.width, f.canvas.height);
      f.tex.needsUpdate = true;
      f.title = 'Untitled (yours)';
    };
    img.src = url;
    if (!persist) return;
    try {
      const hung = JSON.parse(localStorage.getItem('3am-hung') ?? '{}');
      hung[slot] = url;
      localStorage.setItem('3am-hung', JSON.stringify(hung));
    } catch {}
  }

  #bedroom() {
    const g = this.game;
    const bed = this.place('bed', { x: -3.0, z: 2.3, rotY: Math.PI / 2 });
    this.snapToWall(bed, ['w', W]);
    this.addColliderFromObject(bed);
    this.tint(bed, { carpet: 0x3a4a6a, carpetWhite: 0xb8b4ac });
    this.addInteractable(bed, {
      prompt: 'Go to sleep',
      action: async () => {
        g.fade.classList.add('on');
        await new Promise((r) => setTimeout(r, 1400));
        await g.changeScene('Dream', 'default');
        g.fade.classList.remove('on');
      },
    });

    this.addSpawn('bed', [-1.6, 0, 2.3], -Math.PI / 2);

    const lamp = this.place('lamp_floor', { x: W + 0.35, z: 0.75 });
    const lb = this.bounds(lamp);
    this.lampLight = this.addLight({ position: [lb.min.x + 0.2, lb.max.y - 0.15, 0.75], color: 0xffb070, range: 7, intensity: 1.4 });
    this.lampShade = this.materialSlots(lamp, 'lamp');
    this.lampOn = this.mat({ color: 0xffe0a8, unlit: true });
    this.lampOff = this.lampShade[0]?.mesh.material ?? null;
    this.setSlots(this.lampShade, this.lampOn);
    this.addInteractable(lamp, {
      prompt: () => (this.lampLight.enabled ? 'Turn off lamp' : 'Turn on lamp'),
      action: () => {
        this.lampLight.enabled = !this.lampLight.enabled;
        if (this.lampOff) this.setSlots(this.lampShade, this.lampLight.enabled ? this.lampOn : this.lampOff);
        g.audio.oneShot('click');
      },
    });

    // East wall between the speaker and the fishing rod (it used to overlap
    // the kitchen counter, then the bed).
    const shelf = this.place('bookcase', { x: E - 0.3, z: 1.6, rotY: -Math.PI / 2 });
    this.snapToWall(shelf, ['e', E]);
    this.addColliderFromObject(shelf);
    const sb = this.bounds(shelf);
    this.shelfBounds = sb;
    this.place('books', { x: (sb.min.x + sb.max.x) / 2, y: sb.max.y, z: 1.8, rotY: -Math.PI / 2 });
    const box1 = this.place('cardboard_box', { x: -1.55, z: 3.1, rotY: 0.2, collide: true });
    this.place('cardboard_box', { x: -1.5, y: this.bounds(box1).max.y, z: 3.05, rotY: -0.3 });

    // Grandpa's shotgun on two pegs over the door wall, with a few shells.
    const pegMat = this.mat({ color: 0x3a2a1a });
    for (const x of [0.75, 1.75]) this.box(0.05, 0.05, 0.12, pegMat, x, 1.85, S - 0.06, { collide: false });
    const gun = this.place('shotgun', { x: 1.25, y: 1.82, z: S - 0.1, rotY: Math.PI / 2 });
    const gunVol = this.interactVolume(1.25, 1.88, S - 0.15, 1.3, 0.3, 0.3, {
      prompt: 'Take the shotgun',
      action: () => {
        g.inventory.add('shotgun');
        g.inventory.add('shells', 6);
        g.inventory.equip('shotgun');
        gun.removeFromParent();
        gunVol.removeFromParent();
        this.interactables = this.interactables.filter((o) => o !== gunVol);
        g.hud.toast("Grandpa's Beretta + 6 shells. Deer come down from the mountain at night. R to load.", 5000);
      },
    });

    // Dad's fishing rod by the door (fat invisible volume: rods are thin).
    const rod = this.place('fishing_rod', { x: 3.72, z: 3.2 });
    rod.rotation.z = 0.12;
    const rodVolume = this.interactVolume(3.72, 1.0, 3.2, 0.5, 2.0, 0.5, {
      prompt: 'Take fishing rod',
      action: () => {
        g.inventory.add('fishing_rod');
        g.inventory.equip('fishing_rod');
        rod.removeFromParent();
        rodVolume.removeFromParent();
        this.interactables = this.interactables.filter((o) => o !== rodVolume);
        g.hud.toast("Dad's old rod. The lake's at the end of the road.");
      },
    });
  }

  /** A glass display cabinet for fossils dug up on level 3 of the mine. */
  #fossilCabinet() {
    const g = this.game;
    const x = W + 0.3;
    const z = -0.9;
    const wood = this.mat({ color: 0x4a3020 });
    this.box(0.5, 1.6, 1.1, wood, x, 0.8, z);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.3), this.mat({ color: 0xc8e0f0, opacity: 0.18 }));
    glass.position.set(x + 0.26, 0.95, z);
    glass.rotation.y = Math.PI / 2;
    this.root.add(glass);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.12), this.mat({ map: signTexture(['FOSSILS'], { bg: '#2a1a10', fg: '#d8c090', w: 64, h: 14 }) }));
    label.position.set(x + 0.27, 1.68, z);
    label.rotation.y = Math.PI / 2;
    this.root.add(label);
    this.addLight({ position: [x + 0.5, 1.3, z], color: 0xffe8c0, range: 2.5, intensity: 0.6 });
    const shelf = this.mat({ color: 0x6a4a30 });
    for (const y of [0.45, 0.95, 1.4]) this.box(0.42, 0.03, 1.0, shelf, x + 0.02, y, z, { collide: false });
    const KEY = '3am-fossils';
    const load = () => {
      try {
        return JSON.parse(localStorage.getItem(KEY) ?? '[]');
      } catch {
        return [];
      }
    };
    const shown = new THREE.Group();
    this.root.add(shown);
    const slots = [[0.45, -0.3], [0.45, 0.3], [0.95, -0.3], [0.95, 0.3], [1.4, -0.3], [1.4, 0.3]];
    const make = (f) => {
      const m = (c, o = {}) => this.mat({ color: c, ...o });
      const grp = new THREE.Group();
      if (f === 'ammonite') {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.03, 6, 12), m(0xb8a080));
        t.rotation.y = Math.PI / 2;
        grp.add(t);
      } else if (f === 'trilobite') {
        for (let k = 0; k < 5; k++) {
          const seg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.14 - k * 0.015), m(0x7a6a5a));
          seg.position.x = (k - 2) * 0.035;
          grp.add(seg);
        }
      } else if (f === 'fern') {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.16), m(0x5a5a58));
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 3), m(0x7a8a5a));
        leaf.rotation.z = Math.PI / 2;
        leaf.position.y = 0.02;
        grp.add(slab, leaf);
      } else if (f === 'fish') {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.12), m(0x8a7a6a));
        grp.add(slab);
        for (let k = 0; k < 6; k++) {
          const bone = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.06), m(0xe0d8c8));
          bone.position.set(-0.06 + k * 0.022, 0.015, 0);
          grp.add(bone);
        }
      } else if (f === 'tooth') {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 6), m(0xe0d0b0));
        c.position.y = 0.08;
        grp.add(c);
      } else {
        const a = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), m(0xe09030, { unlit: true, opacity: 0.85 }));
        a.position.y = 0.06;
        grp.add(a);
      }
      return grp;
    };
    const refresh = () => {
      shown.clear();
      load().forEach((f, i) => {
        const sl = slots[i];
        if (!sl) return;
        const o = make(f);
        o.position.set(x + 0.05, sl[0] + 0.03, z + sl[1]);
        shown.add(o);
      });
    };
    refresh();
    this.addInteractable(glass, {
      prompt: () => {
        const have = Object.keys(FOSSILS).filter((f) => g.inventory.has(`fossil_${f}`));
        return have.length ? `Put ${have.length} fossil${have.length > 1 ? 's' : ''} on display` : `Fossil collection (${load().length}/6)`;
      },
      range: 2.4,
      action: () => {
        const list = load();
        for (const f of Object.keys(FOSSILS)) {
          if (g.inventory.has(`fossil_${f}`)) {
            g.inventory.remove(`fossil_${f}`);
            if (!list.includes(f)) list.push(f);
          }
        }
        try {
          localStorage.setItem(KEY, JSON.stringify(list));
        } catch {}
        refresh();
        const lines = list.length ? list.map((f) => `· ${FOSSILS[f].name} — ${FOSSILS[f].desc}`).join('\n\n') : 'Empty shelves. The fossils are down on level 3 of the old mine, past the train line.';
        g.openUI(() => g.note.show(`THE COLLECTION (${list.length}/6)\n\n${lines}${list.length === 6 ? '\n\nComplete. Somewhere, a museum curator weeps.' : ''}`));
      },
    });
  }

  /** Coffee table between the couch and the TV: the quantum book, the Polaroid, and a box of leftover fireworks. */
  #coffeeTable() {
    const g = this.game;
    const table = this.place('coffee_table', { x: 0.4, z: 1.45, collide: 0.05 });
    const top = this.bounds(table).max.y;

    // The book: a paperback with a printed cover (read it as crisp HTML text).
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 180;
    const c = cv.getContext('2d');
    const grd = c.createLinearGradient(0, 0, 0, 180);
    grd.addColorStop(0, '#0d1a3a');
    grd.addColorStop(1, '#1a0d2a');
    c.fillStyle = grd;
    c.fillRect(0, 0, 128, 180);
    c.strokeStyle = '#e8c860';
    c.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.ellipse(64, 92, 40, 14, (k * Math.PI) / 3, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = '#e8c860';
    c.beginPath();
    c.arc(64, 92, 5, 0, Math.PI * 2);
    c.fill();
    c.textAlign = 'center';
    c.font = 'bold 19px Georgia, serif';
    c.fillText('SMALL', 64, 30);
    c.fillText('THINGS', 64, 50);
    c.font = '9px Georgia, serif';
    c.fillStyle = '#c8c8e0';
    c.fillText('a guide to quantum mechanics', 64, 150);
    const cover = new THREE.CanvasTexture(cv);
    const paper = this.mat({ color: 0xe8e0c8 });
    const coverMat = this.mat({ map: cover, affine: 0 });
    const spine = this.mat({ color: 0x0d1a3a });
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.21), [paper, spine, coverMat, spine, paper, paper]);
    book.position.set(0.15, top + 0.015, 1.45);
    book.rotation.y = 0.35;
    this.root.add(book);
    // BoxGeometry +Y face shows the cover; rotate its UVs to read upright from the couch
    cover.center.set(0.5, 0.5);
    cover.rotation = Math.PI;
    this.addInteractable(book, { prompt: 'Read “Small Things” (quantum mechanics)', action: () => g.openUI(() => g.book.show()) });

    // The Polaroid + a film pack.
    const cam = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.13), this.mat({ color: 0xe8e4dc }));
    body.position.y = 0.05;
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.04, 0.06), this.mat({ color: 0x1a1a1e }));
    front.position.set(0, 0.025, 0.04);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.025, 12), this.mat({ color: 0x0a0a0c }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.055, 0.075);
    const stripes = [0xd02a2a, 0xf08020, 0xf0d020, 0x30a050, 0x2a60c0].map((col, k) => {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.002), this.mat({ color: col, unlit: true }));
      st.position.set(-0.016 + k * 0.008, 0.06, 0.066);
      return st;
    });
    cam.add(body, front, lens, ...stripes);
    cam.position.set(0.7, top, 1.35);
    cam.rotation.y = Math.PI - 0.5; // lens toward the couch
    this.root.add(cam);
    const camVol = this.interactVolume(0.7, top + 0.06, 1.35, 0.25, 0.2, 0.25, {
      prompt: 'Take the Polaroid camera',
      action: () => {
        g.inventory.add('polaroid');
        g.inventory.add('polaroid_film', 2);
        g.inventory.equip('polaroid');
        cam.removeFromParent();
        camVol.removeFromParent();
        this.interactables = this.interactables.filter((o) => o !== camVol);
        g.hud.toast('Polaroid + 2 packs of film (20 shots). LMB snap · Q film stock · RMB zoom · K album.', 6000);
      },
    });

    // Box of leftover fireworks by the couch end.
    const crate = this.box(0.42, 0.24, 0.32, this.mat({ map: signTexture(['BOOM', 'BOX'], { bg: '#b01818', fg: '#ffd040', w: 64, h: 40 }) }), 1.55, 0.12, 1.2, { collide: false });
    crate.rotation.y = 0.3;
    this.addInteractable(crate, {
      prompt: 'Grab the leftover fireworks',
      action: () => {
        const inv = g.inventory;
        for (const [id, n] of [['fw_sparkler', 4], ['fw_rocket', 3], ['fw_fountain', 1], ['fw_roman', 1], ['fw_willow', 1], ['fw_heart', 1]]) inv.add(id, n);
        if (!inv.has('lighter')) inv.add('lighter');
        crate.removeFromParent();
        this.interactables = this.interactables.filter((o) => o !== crate);
        g.hud.toast('Leftovers from last summer: sparklers, rockets, a fountain, a roman candle, a willow and a heart (+ a lighter). Use them outside.', 7000);
      },
    });
  }

  onExit() {
    if (this.fridgeOpen) this.#toggleFridge(false);
  }
}

/** Tiny lined-paper texture with handwriting squiggles for the note on the desk. */
function noteTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2eee2';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#b8c8dc';
  for (let y = 14; y < 96; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#2a2a6a';
  ctx.lineWidth = 1.2;
  for (let y = 12; y < 80; y += 10) {
    ctx.beginPath();
    let x = 8;
    ctx.moveTo(x, y);
    while (x < 112) {
      x += 3 + Math.random() * 3;
      ctx.lineTo(x, y - Math.random() * 3);
    }
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

/**
 * Picture surfaces: a depth bias so they always win against the frame
 * behind them, and (for oil paintings) linear filtering so the brush strokes
 * don't sparkle. Photos keep their crunchy nearest-neighbour pixels.
 */
function flat(material, bias, smooth = false) {
  material.polygonOffset = true;
  material.polygonOffsetFactor = -bias;
  material.polygonOffsetUnits = -bias * 4;
  const map = material.uniforms.uMap?.value;
  if (map && smooth) {
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearFilter;
    map.generateMipmaps = false;
    map.needsUpdate = true;
  }
  return material;
}
