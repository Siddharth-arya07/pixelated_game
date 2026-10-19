import * as THREE from 'three';

/**
 * Holidays — by the real calendar (or previewed from the phone's Calendar)
 * -----------------------------------------------------------------------
 *  HALLOWEEN  (Oct 15 – Nov 1)  jack-o'-lanterns on every porch, bats round
 *             your house, orange lights — and trick-or-treat: knock on the
 *             neighbours' doors (once a night each) for candy… or a trick
 *  CHRISTMAS  (Dec 10 – 26)     it's winter whatever the season, lights on
 *             your house, a wreath on the door, a tree in the living room with
 *             presents under it (open them once)
 *  NEW YEAR   (Dec 30 – Jan 2)  at midnight (game clock) everyone gets a
 *             countdown and a fireworks show over the harbor
 */
const KEY = '3am-holiday-preview';

export class Holidays {
  constructor(game) {
    this.game = game;
    this.groups = {};
    this.refresh();
    this.lastMin = 0;
  }

  refresh() {
    let pv = null;
    try {
      pv = localStorage.getItem(KEY);
    } catch {}
    const d = new Date();
    const m = d.getMonth();
    const day = d.getDate();
    const real = (m === 9 && day >= 15) || (m === 10 && day <= 1) ? 'halloween' : m === 11 && day >= 10 && day <= 26 ? 'christmas' : (m === 11 && day >= 30) || (m === 0 && day <= 2) ? 'newyear' : null;
    this.current = pv || real;
    this.applied = null;
  }

  get label() {
    return { halloween: 'Halloween 🎃', christmas: 'Christmas 🎄', newyear: 'New Year’s Eve 🎆' }[this.current] ?? '';
  }

  update(dt) {
    const g = this.game;
    const W = g.scenes.World;
    if (!W?.built) return;
    if (this.applied !== this.current) {
      this.applied = this.current;
      for (const [k, grp] of Object.entries(this.groups)) grp.visible = k === this.current;
      if (this.current && !this.groups[this.current]) this.groups[this.current] = this[`build_${this.current}`]?.(W) ?? new THREE.Group();
      if (this.current === 'christmas' && g.scenes.House?.built) this.#xmasTree(g.scenes.House);
      if (this.current) setTimeout(() => g.hud.toast(`It’s ${this.label} in Pine Hollow.`, 4000), 3000);
    }
    if (this.current === 'christmas' && g.scenes.House?.built && !this.tree) this.#xmasTree(g.scenes.House);
    if (this.tree) this.tree.visible = this.current === 'christmas';
    if (this.current === 'halloween') this.#bats(dt);
    if (this.current === 'newyear') this.#newYear();
  }

  // ===========================================================================
  // Halloween
  // ===========================================================================

  #pumpkin(scene, x, y, z, yaw = 0, s = 1) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), scene.mat({ color: 0xe0701a }));
    body.scale.y = 0.8;
    body.position.y = 0.22;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 5), scene.mat({ color: 0x3a6a2a }));
    stem.position.y = 0.48;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x2 = c.getContext('2d');
    x2.fillStyle = '#000';
    x2.fillRect(0, 0, 64, 64);
    x2.fillStyle = '#ffc040';
    x2.beginPath();
    x2.moveTo(14, 26);
    x2.lineTo(24, 14);
    x2.lineTo(28, 28);
    x2.fill();
    x2.beginPath();
    x2.moveTo(50, 26);
    x2.lineTo(40, 14);
    x2.lineTo(36, 28);
    x2.fill();
    x2.beginPath();
    x2.moveTo(12, 38);
    for (let k = 0; k <= 8; k++) x2.lineTo(12 + k * 5, k % 2 ? 50 : 42);
    x2.lineTo(52, 38);
    x2.quadraticCurveTo(32, 60, 12, 38);
    x2.fill();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), scene.mat({ map: new THREE.CanvasTexture(c), unlit: true, additive: true }));
    face.position.set(0, 0.24, 0.27);
    grp.add(body, stem, face);
    grp.position.set(x, y, z);
    grp.rotation.y = yaw;
    grp.scale.setScalar(s);
    return grp;
  }

  build_halloween(W) {
    const g = this.game;
    const grp = new THREE.Group();
    W.root.add(grp);
    const h = W.poi.house;
    const hy = h.y;
    // your porch
    for (const [dx, s] of [[-1.3, 1], [1.3, 1.2], [1.8, 0.7]]) grp.add(this.#pumpkin(W, h.x + dx, hy, h.z + 4.6, 0, s));
    W.addLight({ position: [h.x, hy + 0.6, h.z + 5], color: 0xff8020, range: 5, intensity: 0.9 });
    // orange + purple porch lights
    for (let k = 0; k <= 16; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), W.mat({ color: k % 2 ? 0xff7a1a : 0xa040ff, unlit: true }));
      b.position.set(h.x - 4.4 + k * 0.55, hy + 3.05 - Math.sin((k / 16) * Math.PI) * 0.15, h.z + 4.08);
      grp.add(b);
    }
    // neighbours: pumpkins + trick-or-treat at the door
    const homes = [[-305, 160, 0, 'the Hales'], [-245, 192, 0, 'old Mrs. Ortega'], [-120, 222, Math.PI, 'the Nakamuras'], [-85, 135, 0.6, 'a guy called Doug']];
    const treats = [['candy', 2, 'A whole handful of candy bars!'], ['candy_corn', 1, 'Candy corn. The divisive classic.'], ['caramel_apple', 1, 'A homemade caramel apple. Incredible.'], ['candy', 1, 'One (1) fun-size bar. Fun for whom?']];
    const tricks = ['The door creaks open… nobody there… then a rubber skeleton drops from the porch roof. AAAH.', '“TRICK!” A kid in a ghost sheet sprays you with silly string and runs off.', 'A recording of an evil laugh plays. The porch light flickers. Nobody comes.'];
    for (const [nx, nz, r, who] of homes) {
      const dx = nx + Math.sin(r) * 4.2;
      const dz = nz + Math.cos(r) * 4.2;
      const y = W.groundHeight(dx, dz);
      grp.add(this.#pumpkin(W, dx + Math.cos(r) * 1.2, y, dz - Math.sin(r) * 1.2, r, 1.1));
      W.addLight({ position: [dx, y + 0.8, dz], color: 0xff8020, range: 5, intensity: 0.7 });
      let night = -1;
      const vol = W.interactVolume(dx, y + 1, dz, 1.6, 2, 0.8, {
        prompt: () => (this.current !== 'halloween' ? 'A front door' : night === g.dayNight.day ? `${who} already gave you something tonight` : `Knock: “Trick or treat!” (${who})`),
        enabled: () => this.current === 'halloween',
        action: () => {
          if (night === g.dayNight.day) return;
          night = g.dayNight.day;
          g.audio.oneShot('door', { volume: 0.5, rate: 0.8 });
          setTimeout(() => {
            if (Math.random() < 0.72) {
              const [item, n, text] = treats[Math.floor(Math.random() * treats.length)];
              g.inventory.add(item, n);
              g.hud.toast(`${who}: ${text}`, 4000);
            } else {
              g.hud.toast(tricks[Math.floor(Math.random() * tricks.length)], 4500);
              this.#scream();
            }
          }, 1200);
        },
      });
      void vol;
    }
    // pumpkins at the diner + the park
    const dn = W.poi.diner;
    grp.add(this.#pumpkin(W, dn.x - 3, W.groundHeight(dn.x - 3, dn.z + 12), dn.z + 12, 0, 1.4));
    const pk = W.poi.playground;
    grp.add(this.#pumpkin(W, pk.x + 2, W.groundHeight(pk.x + 2, pk.z), pk.z, 0.5, 1.8));
    // bats around your house
    this.batList = [];
    for (let k = 0; k < 7; k++) {
      const b = g.assets.model('bat');
      if (!b) break;
      grp.add(b);
      const mixer = new THREE.AnimationMixer(b);
      const clip = (b.userData.animations ?? []).find((c) => /Flying/.test(c.name));
      if (clip) mixer.clipAction(clip).play();
      this.batList.push({ b, mixer, ph: Math.random() * 6, r: 5 + Math.random() * 6, h: 5 + Math.random() * 3 });
    }
    this.batCenter = new THREE.Vector3(h.x, hy, h.z);
    return grp;
  }

  #bats(dt) {
    const t = this.game.time;
    for (const b of this.batList ?? []) {
      b.mixer.update(dt);
      const a = t * 0.8 + b.ph;
      b.b.position.set(this.batCenter.x + Math.cos(a) * b.r, this.batCenter.y + b.h + Math.sin(a * 3) * 0.6, this.batCenter.z + Math.sin(a) * b.r);
      b.b.rotation.y = -a;
    }
  }

  #scream() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(400, t + 0.8);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.08, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(e).connect(this.game.audio.master);
    o.start(t);
    o.stop(t + 0.95);
  }

  // ===========================================================================
  // Christmas
  // ===========================================================================

  build_christmas(W) {
    const grp = new THREE.Group();
    W.root.add(grp);
    const h = W.poi.house;
    const y = h.y;
    const cols = [0xff3030, 0x30ff60, 0x4080ff, 0xffd030];
    // bulbs along the front and the sides under the eaves
    const runs = [[[-4.5, 4.05], [4.5, 4.05]], [[4.55, 4], [4.55, -4]], [[-4.55, 4], [-4.55, -4]]];
    let k = 0;
    for (const [[ax, az], [bx, bz]] of runs) {
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), W.mat({ color: cols[k++ % 4], unlit: true }));
        b.position.set(h.x + ax + (bx - ax) * t, y + 3.15 - Math.sin(t * Math.PI * 3) * 0.06, h.z + az + (bz - az) * t);
        grp.add(b);
      }
    }
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 14), W.mat({ color: 0x2a6a2a }));
    wreath.position.set(h.x, y + 1.8, h.z + 4.1);
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.05), W.mat({ color: 0xd02020 }));
    bow.position.set(h.x, y + 1.55, h.z + 4.12);
    grp.add(wreath, bow);
    W.addLight({ position: [h.x, y + 3, h.z + 5], color: 0xff6060, range: 7, intensity: 0.7 });
    return grp;
  }

  #xmasTree(H) {
    if (this.tree) return;
    const g = this.game;
    const tree = new THREE.Group();
    const green = H.mat({ color: 0x1f5a2a });
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.75 - k * 0.2, 0.9, 8), green);
      c.position.y = 0.6 + k * 0.5;
      tree.add(c);
    }
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 6), H.mat({ color: 0x5a3a20 }));
    trunk.position.y = 0.15;
    tree.add(trunk);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), H.mat({ color: 0xffe060, unlit: true }));
    star.position.y = 2.0;
    tree.add(star);
    const cols = [0xff3030, 0xffd030, 0x40a0ff, 0xffffff];
    for (let k = 0; k < 30; k++) {
      const a = k * 2.4;
      const yy = 0.4 + (k / 30) * 1.4;
      const r = 0.7 * (1 - (yy - 0.3) / 1.7) + 0.05;
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), H.mat({ color: cols[k % 4], unlit: true }));
      o.position.set(Math.cos(a) * r, yy, Math.sin(a) * r);
      tree.add(o);
    }
    tree.position.set(-1.6, 0, 0.6);
    H.root.add(tree);
    H.addLight({ position: [-1.6, 1.4, 0.6], color: 0xffc070, range: 4, intensity: 0.9 });
    this.tree = tree;
    // presents
    const year = new Date().getFullYear();
    const KEYP = `3am-xmas-${year}`;
    const opened = new Set(JSON.parse(localStorage.getItem(KEYP) ?? '[]'));
    const gifts = [
      ['polaroid_film', 3, 'Three packs of instant film. Someone knows you.'],
      ['fw_cake', 1, 'A 25-shot firework cake. Save it for New Year’s.'],
      ['ugly_sweater', 1, 'A hand-knitted sweater with a reindeer on it. It’s hideous. You love it.'],
    ];
    gifts.forEach(([item, n, text], i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.3), H.mat({ color: [0xd02020, 0x2060d0, 0x20a040][i] }));
      box.position.set(-1.6 + (i - 1) * 0.4, 0.11, 1.2 + (i % 2) * 0.15);
      box.visible = !opened.has(i);
      tree.parent.add(box);
      H.addInteractable(box, {
        prompt: 'Open a present',
        enabled: () => box.visible && this.current === 'christmas',
        action: () => {
          box.visible = false;
          opened.add(i);
          try {
            localStorage.setItem(KEYP, JSON.stringify([...opened]));
          } catch {}
          g.inventory.add(item, n);
          g.hud.toast(`🎁 ${text}`, 4500);
        },
      });
    });
  }

  // ===========================================================================
  // New Year
  // ===========================================================================

  #newYear() {
    const g = this.game;
    const m = g.dayNight.minutes;
    // ten (real) seconds before midnight on the game clock: count down, then the show
    if (m > 1440 - 5.2 && this.lastMin <= 1440 - 5.2 && !this.counting) {
      this.counting = true;
      for (let k = 10; k >= 1; k--) setTimeout(() => g.hud.toast(`🎆 ${k}…`, 900), (10 - k) * 1000);
      setTimeout(() => {
        g.hud.toast('🎆 HAPPY NEW YEAR, PINE HOLLOW! 🎆', 6000);
        this.#show();
        this.counting = false;
      }, 10000);
    }
    this.lastMin = m;
  }

  #show() {
    const g = this.game;
    const W = g.scenes.World;
    const H = W.poi.harbor;
    const types = ['fw_chrys', 'fw_willow', 'fw_ring', 'fw_palm', 'fw_crossette', 'fw_strobe', 'fw_heart', 'fw_rocket'];
    for (let k = 0; k < 46; k++) {
      setTimeout(() => {
        if (g.scene !== W) return;
        const x = H.x + 30 + (Math.random() - 0.5) * 40;
        const z = H.z + (Math.random() - 0.5) * 60;
        g.fireworks.light(types[k % types.length], { x, y: 0.5, z }, k);
      }, k * (k > 36 ? 220 : 700));
    }
  }
}
