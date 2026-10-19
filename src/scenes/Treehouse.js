import * as THREE from 'three';

/**
 * The treehouse — in the woods behind your house
 * ----------------------------------------------
 * A huge old oak with a few nails already in it. Build a treehouse plank by
 * plank: ladder → floor → railings → walls → roof → fairy lights & a rope
 * swing. Planks come from the lumber pile at the foot of the tree (free,
 * a few per night) or the Quik Mart outdoor aisle (bundles of 10).
 *
 * Up top there's a corkboard: leave a note for whoever comes up next.
 * Building progress and notes are shared with the room (events 'tree',
 * 'treenote'), and remembered in this browser.
 */
const STAGES = [
  { name: 'ladder', need: 4, done: 'A ladder up the trunk. Wobbly, but it holds.' },
  { name: 'floor', need: 10, done: 'A floor up in the branches! You can stand on it.' },
  { name: 'railings', need: 8, done: 'Railings. Nobody’s falling out now.' },
  { name: 'walls', need: 12, done: 'Walls, with a little window looking at the stars.' },
  { name: 'roof', need: 10, done: 'A roof! It’s a real treehouse.' },
  { name: 'lights', need: 6, done: 'Fairy lights and a rope swing. It’s perfect.' },
];
const KEY = '3am-treehouse';

export function buildTreehouse(scene) {
  return new Treehouse(scene);
}

class Treehouse {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;
    const h = scene.poi.house;
    this.x = h.x - 40;
    this.z = h.z - 26;
    this.y = scene.groundHeight(this.x, this.z);
    const saved = load();
    this.stage = saved.stage ?? 0;
    this.n = saved.n ?? 0;
    this.notes = saved.notes ?? [];
    this.parts = [];
    this.#tree();
    this.#lumber();
    this.#show();
    this.game.mp?.on('tree', (e) => this.#merge(e.stage, e.n));
    this.game.mp?.on('treenote', (e) => this.#addNote(e.t, e.by, true));
    scene.updaters.push((dt, t) => this.#tick(dt, t));
  }

  get floorY() {
    return this.y + 4.2;
  }

  #tree() {
    const s = this.scene;
    const { x, y, z } = this;
    const bark = s.mat({ map: s.tex('planks', 1, 4), color: 0x5a4030 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 9, 10), bark);
    trunk.position.set(x, y + 4.5, z);
    s.root.add(trunk);
    s.addColliderBox(x, y + 4.5, z, 1.5, 9, 1.5);
    const leaf = s.mat({ color: 0x3a6a2a });
    for (const [dx, dy, dz, r] of [[0, 9, 0, 4.5], [2.5, 7.5, 1, 3.2], [-2.5, 8, -1, 3.4], [1, 8.5, -2.6, 3], [-1.5, 7.2, 2.4, 3]]) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), leaf);
      c.position.set(x + dx, y + dy, z + dz);
      s.root.add(c);
    }
    // the "nails already in it" sign
    this.signMesh = s.box(0.5, 0.35, 0.05, s.mat({ color: 0xc8b088 }), x, y + 1.6, z + 0.78, { collide: false });
    s.addInteractable(this.signMesh, {
      prompt: () => (this.stage >= STAGES.length ? 'The treehouse (finished!)' : `Build the treehouse: ${STAGES[this.stage].name} (${this.n}/${STAGES[this.stage].need} planks)`),
      range: 3,
      action: () => this.#build(),
    });
  }

  #lumber() {
    const s = this.scene;
    const g = this.game;
    const lx = this.x + 3;
    const lz = this.z + 3;
    const wood = s.mat({ map: s.tex('planks', 1, 1), color: 0xb08a5a });
    for (let k = 0; k < 6; k++) s.box(2, 0.1, 0.25, wood, lx, this.y + 0.06 + k * 0.1, lz + (k % 3) * 0.28 - 0.28, { collide: false, rotY: (k % 2) * 0.1 });
    let lastDay = -1;
    s.interactVolume(lx, this.y + 0.4, lz, 2.2, 0.8, 1.2, {
      prompt: () => (lastDay === g.dayNight.day ? 'Lumber pile (picked over for tonight)' : 'Take planks from the lumber pile'),
      action: () => {
        if (lastDay === g.dayNight.day) return g.hud.toast('That’s all the good wood for tonight. The Quik Mart sells bundles.', 3000);
        lastDay = g.dayNight.day;
        g.inventory.add('planks', 8);
        g.hud.toast('+8 planks. Some have nails sticking out. Character.', 2500);
      },
    });
  }

  #build() {
    const g = this.game;
    if (this.stage >= STAGES.length) return g.hud.toast('It’s finished. Climb up!', 2000);
    const st = STAGES[this.stage];
    const have = g.inventory.count('planks');
    if (!have) return g.hud.toast('You need planks: the lumber pile right here, or a bundle from the Quik Mart.', 3000);
    const use = Math.min(have, st.need - this.n);
    g.inventory.remove('planks', use);
    this.n += use;
    this.#hammer(use);
    if (this.n >= st.need) {
      this.stage++;
      this.n = 0;
      g.hud.toast(st.done, 4500);
    } else g.hud.toast(`${this.n}/${st.need} planks on the ${st.name}.`, 2000);
    this.#save();
    this.#show();
    g.net?.online && g.net.event('tree', { stage: this.stage, n: this.n });
  }

  #merge(stage, n) {
    if (stage > this.stage || (stage === this.stage && n > this.n)) {
      this.stage = stage;
      this.n = n;
      this.#save();
      this.#show();
    }
  }

  /** Rebuild the visible parts for the current stage. */
  #show() {
    const s = this.scene;
    for (const p of this.parts) p.removeFromParent();
    this.parts = [];
    const { x, y, z } = this;
    const fy = this.floorY;
    const wood = s.mat({ map: s.tex('planks', 2, 2), color: 0xb08a5a });
    const add = (m) => {
      s.root.add(m);
      this.parts.push(m);
      return m;
    };
    const box = (w, h, d, px, py, pz, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
      m.position.set(px, py, pz);
      m.rotation.y = ry;
      return add(m);
    };
    if (this.stage >= 1) {
      for (let k = 0; k < 9; k++) box(0.6, 0.06, 0.12, x, y + 0.4 + k * 0.45, z + 0.85);
      if (!this.ladderVol) {
        this.ladderVol = s.interactVolume(x, y + 1.2, z + 1.0, 0.8, 2.4, 0.4, {
          prompt: () => (this.stage >= 2 ? 'Climb up into the treehouse' : 'A ladder to nowhere (yet)'),
          enabled: () => this.stage >= 1,
          action: () => {
            if (this.stage < 2) return this.game.hud.toast('Needs a floor up there first.', 2000);
            this.game.player.spawn({ position: new THREE.Vector3(x + 1.3, fy, z + 1.3), yaw: Math.PI * 0.75 });
          },
        });
      }
    }
    if (this.stage >= 2) {
      box(4.4, 0.15, 4.4, x, fy - 0.08, z);
      if (!this.floorCol) {
        this.floorCol = true;
        s.addColliderBox(x + 1.4, fy - 0.08, z, 1.6, 0.15, 4.4);
        s.addColliderBox(x - 1.4, fy - 0.08, z, 1.6, 0.15, 4.4);
        s.addColliderBox(x, fy - 0.08, z + 1.4, 1.2, 0.15, 1.6);
        s.addColliderBox(x, fy - 0.08, z - 1.4, 1.2, 0.15, 1.6);
        // down again
        s.interactVolume(x + 2.0, fy + 0.5, z + 2.0, 0.6, 1, 0.6, { prompt: 'Climb down', action: () => this.game.player.spawn({ position: new THREE.Vector3(x + 0.4, y, z + 2.2), yaw: 0 }) });
      }
    }
    if (this.stage >= 3) {
      for (const [dx, dz, w, d] of [[0, -2.15, 4.4, 0.08], [0, 2.15, 4.4, 0.08], [-2.15, 0, 0.08, 4.4], [2.15, 0, 0.08, 4.4]]) box(w, 0.08, d, x + dx, fy + 0.9, z + dz);
      if (!this.railCol) {
        this.railCol = true;
        for (const [dx, dz, w, d] of [[0, -2.15, 4.4, 0.1], [-2.15, 0, 0.1, 4.4], [2.15, -0.6, 0.1, 3.2], [-0.6, 2.15, 3.2, 0.1]]) s.addColliderBox(x + dx, fy + 0.5, z + dz, w, 1, d);
      }
    }
    if (this.stage >= 4) {
      box(4.4, 1.8, 0.08, x, fy + 1.0, z - 2.15);
      box(0.08, 1.8, 4.4, x - 2.15, fy + 1.0, z);
      const win = add(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), s.mat({ color: 0x9ab8d8, unlit: true, opacity: 0.4 })));
      win.position.set(x, fy + 1.3, z - 2.1);
    }
    if (this.stage >= 5) {
      const roof = add(new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 4), s.mat({ color: 0x6a3a2a })));
      roof.position.set(x, fy + 2.7, z);
      roof.rotation.y = Math.PI / 4;
    }
    if (this.stage >= 6) {
      const cols = [0xffd890, 0xff9ab0, 0x9ad8ff];
      for (let k = 0; k < 18; k++) {
        const b = add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), s.mat({ color: cols[k % 3], unlit: true })));
        const a = (k / 18) * Math.PI * 2;
        b.position.set(x + Math.cos(a) * 2.1, fy + 1.85 - Math.abs(Math.sin(a * 2)) * 0.2, z + Math.sin(a) * 2.1);
      }
      if (!this.light) this.light = s.addLight({ position: [x, fy + 1.4, z], color: 0xffc890, range: 7, intensity: 1.1 });
      // rope swing from the big branch
      this.swing = new THREE.Group();
      this.swing.position.set(x + 4.2, y + 7.2, z + 1);
      for (const dx of [-0.25, 0.25]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, 5.6, 0.03), s.mat({ color: 0xc8b088 }));
        r.position.set(dx, -2.8, 0);
        this.swing.add(r);
      }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.25), wood);
      seat.position.y = -5.6;
      this.swing.add(seat);
      add(this.swing);
    }
    // corkboard + notes (from the walls stage)
    if (this.stage >= 4 && !this.board) {
      this.board = s.box(0.9, 0.7, 0.04, s.mat({ color: 0xa8784a }), x - 2.08, fy + 1.3, z + 0.6, { collide: false, rotY: Math.PI / 2 });
      s.addInteractable(this.board, {
        prompt: () => `Corkboard (${this.notes.length} note${this.notes.length === 1 ? '' : 's'}) · Q leave a note`,
        range: 2.4,
        action: () => this.game.openUI(() => this.game.note.show(this.notes.length ? this.notes.map((n) => `“${n.t}”\n— ${n.by}`).join('\n\n') : 'Nothing pinned yet. Press Q to leave the first note.')),
        secondary: () => ({ label: 'Leave a note', action: () => this.#write() }),
      });
    }
    this.#drawNotes();
  }

  async #write() {
    const g = this.game;
    const t = await g.prompt.ask('Leave a note on the treehouse corkboard:', 'was here at 3 a.m.…', 120);
    if (t) this.#addNote(t, g.mp?.profile?.name || 'someone');
  }

  #addNote(t, by, fromNet = false) {
    this.notes.push({ t, by });
    if (this.notes.length > 12) this.notes.shift();
    this.#save();
    this.#drawNotes();
    if (!fromNet) {
      this.game.net?.online && this.game.net.event('treenote', { t, by });
      this.game.hud.toast('Pinned.', 1500);
    }
  }

  #drawNotes() {
    for (const n of this.noteMeshes ?? []) n.removeFromParent();
    this.noteMeshes = [];
    if (!this.board) return;
    const s = this.scene;
    this.notes.slice(-6).forEach((_, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.14), s.mat({ color: [0xfff4b0, 0xffd0e0, 0xd0f0ff][i % 3] }));
      m.position.set(this.x - 2.05, this.floorY + 1.45 - Math.floor(i / 3) * 0.22, this.z + 0.35 + (i % 3) * 0.25);
      m.rotation.y = Math.PI / 2;
      m.rotation.z = (Math.random() - 0.5) * 0.3;
      s.root.add(m);
      this.noteMeshes.push(m);
    });
  }

  #tick(dt, t) {
    if (this.swing) this.swing.rotation.x = Math.sin(t * 1.2) * 0.25;
  }

  #hammer(n) {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    for (let k = 0; k < Math.min(6, n); k++) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 180 + Math.random() * 60;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.18, t + k * 0.22);
      e.gain.exponentialRampToValueAtTime(0.001, t + k * 0.22 + 0.08);
      o.connect(e).connect(this.game.audio.master);
      o.start(t + k * 0.22);
      o.stop(t + k * 0.22 + 0.1);
    }
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ stage: this.stage, n: this.n, notes: this.notes }));
    } catch {}
  }

  netSnapshot() {
    return { stage: this.stage, n: this.n, notes: this.notes };
  }

  netApply(w) {
    if (!w) return;
    this.#merge(w.stage, w.n);
    for (const n of w.notes ?? []) if (!this.notes.some((m) => m.t === n.t && m.by === n.by)) this.notes.push(n);
    this.#save();
    this.#drawNotes();
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
