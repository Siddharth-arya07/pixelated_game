import * as THREE from 'three';

/**
 * DinerJob
 * --------
 * The HELP WANTED card by the Seaview's register: work a night shift.
 *
 *   regulars wander in and sit down (a "!" over their head) → E takes the
 *   order → it goes up on the ticket rail, Dolores's cook puts it in the
 *   window a few seconds later (ding) → pick it up at the pass → E serves.
 *
 * Pay: $2 per table + tips. Tips shrink the longer people wait; wait too
 * long and they leave. Clock out at the card any time; the shift also ends
 * after 8 tables. Each regular has their own order habits and lines.
 */
const MENU = { coffee: 1.25, pancakes: 4.5, burger: 6.75, pie: 3.0, milkshake: 3.75 };
const NAMES = { coffee: 'coffee', pancakes: 'pancakes', burger: 'burger', pie: 'cherry pie', milkshake: 'strawberry shake' };

const REGULARS = [
  { name: 'Earl', look: { shirt: 0x8a3a2a, hat: 0x2a4a8a }, orders: [['coffee', 'pie'], ['coffee', 'burger']], hi: '"Coffee, black. Like my mood. And whatever pie survived."', thanks: '"You’re alright, kid."' },
  { name: 'Marguerite', look: { shirt: 0x7a5a9a, hair: 0xd8d8d8 }, orders: [['coffee'], ['pie', 'coffee']], hi: '"Seven letters, ‘a long night’… Oh — coffee, dear. And pie."', thanks: '"Insomnia! That’s the word. Thank you, sweetheart."' },
  { name: 'Officer Pete', look: { shirt: 0x1a2a4a, hat: 0x1a1a2a }, orders: [['coffee', 'pancakes']], hi: '"Stack of pancakes and the coffee, please. Quiet night."', thanks: '"Don’t tell the sergeant about the syrup."' },
  { name: 'Joyce', look: { shirt: 0x6ab0a0, hair: 0x3a2418 }, orders: [['burger', 'milkshake'], ['pancakes']], hi: '"Twelve-hour shift at the hospital. Burger. Shake. Don’t judge me."', thanks: '"Bless you. Truly."' },
  { name: 'The Okafor twins', look: { shirt: 0xd8a030, hair: 0x1a1210 }, orders: [['milkshake', 'milkshake']], hi: '"Two strawberry shakes! We’re celebrating!" "We’re not celebrating." "We ARE."', thanks: '"Best shakes in the county. Officially."' },
  { name: 'Ray', look: { shirt: 0x3a4a3a, hat: 0x2a2a2a }, orders: [['coffee'], ['coffee', 'pie']], hi: '"Lighthouse is lonely tonight. Just a coffee."', thanks: '"Keep the lamp on, kid."' },
  { name: 'Lou the trucker', look: { shirt: 0x5a6a2a, hat: 0xc02020 }, orders: [['burger', 'coffee'], ['burger', 'pie']], hi: '"Four hundred miles to go. Burger. Coffee. Speed."', thanks: '"See ya next run."' },
  { name: 'June', look: { shirt: 0xe890b0, hair: 0xc89040 }, orders: [['pancakes', 'milkshake'], ['pie']], hi: '"Couldn’t sleep, so I’m having breakfast. Pancakes and a shake?"', thanks: '"This is the best decision I’ve made all week."' },
];

export class DinerJob {
  constructor(scene, { tables, floorY, center, passAt, cardAt }) {
    this.scene = scene;
    this.game = scene.game;
    this.tables = tables.slice(0, 8).map((t) => {
      const toC = new THREE.Vector3(center.x - t.x, 0, center.z - t.z).normalize();
      return { ...t, seat: new THREE.Vector3(t.x, floorY, t.z).addScaledVector(toC, 0.8), face: Math.atan2(-toC.x, -toC.z), cust: null };
    });
    this.fy = floorY;
    this.on = false;
    this.customers = [];
    this.#ui();
    this.#props(passAt, cardAt);
    scene.updaters.push((dt) => this.update(dt));
    // friends' customers show up at their tables too (they serve them, not you)
    this.ghosts = new Map();
    this.game.mp?.on('diner', (e) => this.#remote(e));
  }

  #remote(e) {
    const t = this.tables[e.t];
    if (!t) return;
    if (e.op === 'arrive' && !t.cust && !this.ghosts.has(e.t)) {
      const fig = person(this.scene, REGULARS[e.r].look);
      fig.position.set(t.seat.x, this.fy, t.seat.z);
      fig.rotation.y = t.face;
      this.scene.root.add(fig);
      this.ghosts.set(e.t, fig);
    } else if (e.op === 'leave') {
      this.ghosts.get(e.t)?.removeFromParent();
      this.ghosts.delete(e.t);
    }
  }

  // ---- props: the HELP WANTED card and the pick-up window -------------------------------------

  #props(passAt, cardAt) {
    const s = this.scene;
    const g = this.game;
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 48;
    const c = cv.getContext('2d');
    c.fillStyle = '#f4ecd8';
    c.fillRect(0, 0, 64, 48);
    c.fillStyle = '#b02020';
    c.font = 'bold 11px Georgia';
    c.textAlign = 'center';
    c.fillText('HELP', 32, 16);
    c.fillText('WANTED', 32, 29);
    c.fillStyle = '#333';
    c.font = '8px monospace';
    c.fillText('night shift', 32, 41);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), s.mat({ map: new THREE.CanvasTexture(cv) }));
    card.position.copy(cardAt);
    card.rotation.y = Math.PI / 2;
    s.root.add(card);
    s.addInteractable(card, {
      prompt: () => (this.on ? 'Clock out' : 'Work a night shift (pay + tips)'),
      range: 2.6,
      action: () => (this.on ? this.#end() : this.#start()),
    });

    // the pass: a bell + a shelf of plates at the end of the counter
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), s.mat({ color: 0xd8c070 }));
    bell.position.copy(passAt);
    s.root.add(bell);
    this.plates = new THREE.Group();
    this.plates.position.copy(passAt).add(new THREE.Vector3(0, 0, 0.35));
    s.root.add(this.plates);
    const vol = s.interactVolume(passAt.x, passAt.y + 0.1, passAt.z + 0.2, 0.9, 0.5, 1.1, {
      prompt: () => {
        const r = this.customers.filter((cu) => cu.state === 'ready');
        return r.length ? `Pick up ${r.map((cu) => cu.def.name).join(' & ')}’s order` : 'Ring the bell';
      },
      enabled: () => this.on,
      action: () => {
        const r = this.customers.filter((cu) => cu.state === 'ready');
        if (!r.length) {
          this.#ding();
          g.hud.toast('"Nothing up yet, hon," calls the cook.', 2000);
          return;
        }
        for (const cu of r) cu.state = 'carrying';
        this.#platesVisual();
        g.audio.oneShot('click', { volume: 0.3 });
        g.hud.toast(`Got it. Take it to ${r.map((cu) => cu.def.name).join(' & ')}.`, 2500);
        this.#render();
      },
    });
    void vol;
  }

  #ui() {
    this.el = document.createElement('div');
    this.el.id = 'job';
    this.el.className = 'hidden';
    document.getElementById('ui').appendChild(this.el);
  }

  #render() {
    if (!this.on) return;
    const st = { order: 'waiting to order', cooking: 'cooking…', ready: 'READY in the window', carrying: 'on your tray', eating: 'eating' };
    const rows = this.customers.map((cu) => {
      const w = cu.state === 'eating' ? '' : `<i style="width:${Math.max(0, cu.patience / cu.maxPatience) * 100}%"></i>`;
      const items = cu.order ? ` — ${cu.order.map((o) => NAMES[o]).join(', ')}` : '';
      return `<div class="jb-row ${cu.state}"><b>${cu.def.name}</b>${items}<span>${st[cu.state]}</span><em>${w}</em></div>`;
    });
    this.el.innerHTML = `<div class="jb-head">SEAVIEW · NIGHT SHIFT</div>${rows.join('') || '<div class="jb-row">Quiet. Wipe a counter.</div>'}<div class="jb-foot">tables ${this.served}/8 · earned $${this.earned.toFixed(2)}</div>`;
  }

  // ---- shift ------------------------------------------------------------------------------------

  #start() {
    const g = this.game;
    this.on = true;
    this.served = 0;
    this.walkouts = 0;
    this.earned = 0;
    this.spawnT = 3;
    this.queue = [...REGULARS].sort(() => Math.random() - 0.5);
    this.el.classList.remove('hidden');
    g.hud.toast('"Apron’s on the hook. Tables are yours, hon. Take orders, grab plates at the bell, smile." — Dolores', 5000);
    this.#render();
  }

  #end() {
    const g = this.game;
    this.on = false;
    for (const cu of [...this.customers]) this.#leave(cu, true);
    this.el.classList.add('hidden');
    const pay = this.earned;
    if (pay > 0) g.inventory.earn(pay);
    g.hud.toast(`Shift over. ${this.served} table${this.served === 1 ? '' : 's'} served${this.walkouts ? `, ${this.walkouts} walked out` : ''}. You made $${pay.toFixed(2)}.`, 5500);
  }

  update(dt) {
    if (!this.on) return;
    const g = this.game;
    if (g.scene !== this.scene) return this.#end();
    this.spawnT -= dt;
    const free = this.tables.filter((t) => !t.cust && !this.ghosts.has(this.tables.indexOf(t)));
    if (this.spawnT <= 0 && free.length && this.customers.length < 3 && this.served + this.customers.length < 8) {
      this.spawnT = 14 + Math.random() * 16;
      this.#arrive(free[Math.floor(Math.random() * free.length)]);
    }
    let dirty = false;
    for (const cu of [...this.customers]) {
      cu.bob += dt;
      cu.fig.position.y = this.fy + Math.sin(cu.bob * 2) * 0.01;
      if (cu.state === 'cooking' && (cu.cook -= dt) <= 0) {
        cu.state = 'ready';
        this.#ding();
        g.hud.toast(`*ding* ${cu.def.name}’s order is up.`, 2200);
        dirty = true;
      }
      if (cu.state === 'eating') {
        if ((cu.eat -= dt) <= 0) {
          this.#leave(cu);
          dirty = true;
        }
        continue;
      }
      cu.patience -= dt;
      if (cu.patience <= 0) {
        this.walkouts++;
        g.hud.toast(`${cu.def.name} gives up and leaves. Dolores sighs from the counter.`, 3500);
        this.#leave(cu);
        dirty = true;
      }
      this.bubbleMats ??= [0xffe070, 0x80ff90, 0xc0c0c0].map((color) => this.scene.mat({ color, unlit: true }));
      cu.bubble.material = this.bubbleMats[cu.state === 'order' ? 0 : cu.state === 'ready' || cu.state === 'carrying' ? 1 : 2];
      cu.bubble.visible = cu.state !== 'cooking' || Math.sin(cu.bob * 3) > 0;
    }
    this.uiT = (this.uiT ?? 0) - dt;
    if (dirty || this.uiT <= 0) {
      this.uiT = 0.5;
      this.#render();
    }
    if (this.served >= 8 && !this.customers.length) this.#end();
  }

  #arrive(t) {
    const s = this.scene;
    const def = this.queue.shift() ?? REGULARS[Math.floor(Math.random() * REGULARS.length)];
    this.queue.push(def);
    const fig = person(s, def.look);
    fig.position.set(t.seat.x, this.fy, t.seat.z);
    fig.rotation.y = t.face;
    s.root.add(fig);
    const bubble = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), s.mat({ color: 0xffe070, unlit: true }));
    bubble.position.set(0, 1.75, 0);
    fig.add(bubble);
    const cu = { def, fig, bubble, table: t, state: 'order', patience: 60, maxPatience: 60, bob: Math.random() * 6 };
    t.cust = cu;
    this.customers.push(cu);
    this.game.net?.online && this.game.net.event('diner', { op: 'arrive', t: this.tables.indexOf(t), r: REGULARS.indexOf(def) });
    s.addInteractable(fig, {
      prompt: () => ({ order: `Take ${def.name}’s order`, cooking: `${def.name} is waiting on the kitchen`, ready: `${def.name}’s food is in the window`, carrying: `Serve ${def.name}`, eating: `${def.name} is eating` })[cu.state],
      range: 2.4,
      action: () => this.#interact(cu),
    });
    this.game.audio.oneShot('door', { volume: 0.2, rate: 1.3 });
    this.game.hud.toast(`${def.name} sits down.`, 2000);
  }

  #interact(cu) {
    const g = this.game;
    if (cu.state === 'order') {
      cu.order = cu.def.orders[Math.floor(Math.random() * cu.def.orders.length)];
      cu.state = 'cooking';
      cu.cook = 6 + cu.order.length * 3 + Math.random() * 3;
      cu.patience = cu.maxPatience = 90;
      g.hud.toast(`${cu.def.name}: ${cu.def.hi}`, 5000);
      g.audio.oneShot('click', { volume: 0.25, rate: 1.4 });
    } else if (cu.state === 'carrying') {
      const bill = cu.order.reduce((a, o) => a + MENU[o], 0);
      const k = Math.max(0, cu.patience / cu.maxPatience);
      const tip = Math.round(bill * (0.08 + k * 0.32) * 100) / 100 + (cu.def.name === 'Earl' && k > 0.6 ? 1 : 0);
      const pay = 2 + tip;
      this.earned += pay;
      this.served++;
      cu.state = 'eating';
      cu.eat = 12 + Math.random() * 8;
      cu.bubble.visible = false;
      this.#platesVisual();
      g.hud.toast(`${cu.def.name}: ${cu.def.thanks}  (+$2.00 · tip $${tip.toFixed(2)})`, 4500);
      g.audio.oneShot('register', { volume: 0.35 });
    } else if (cu.state === 'cooking') g.hud.toast(`${cu.def.name} taps the table. "No rush. Some rush."`, 2200);
    else if (cu.state === 'ready') g.hud.toast('It’s up in the window by the bell.', 2000);
    this.#render();
  }

  #leave(cu, quiet = false) {
    const s = this.scene;
    cu.fig.removeFromParent();
    s.interactables = s.interactables.filter((o) => o !== cu.fig);
    cu.table.cust = null;
    this.game.net?.online && this.game.net.event('diner', { op: 'leave', t: this.tables.indexOf(cu.table) });
    this.customers = this.customers.filter((c) => c !== cu);
    this.#platesVisual();
    if (!quiet) this.game.audio.oneShot('door', { volume: 0.15, rate: 1.2 });
  }

  #platesVisual() {
    this.plates.clear();
    const ready = this.customers.filter((cu) => cu.state === 'ready');
    ready.forEach((cu, i) =>
      cu.order.forEach((o, j) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.02, 10), this.scene.mat({ color: 0xf0f0f0 }));
        p.position.set(0, i * 0.04, j * 0.25 - 0.1);
        const food = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 5), this.scene.mat({ color: { coffee: 0x3a2418, pancakes: 0xd8a050, burger: 0x8a5a2a, pie: 0xb02a3a, milkshake: 0xf0a0b8 }[o] }));
        food.position.copy(p.position).add(new THREE.Vector3(0, 0.05, 0));
        food.scale.y = 0.6;
        this.plates.add(p, food);
      }),
    );
  }

  #ding() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    for (const [f, v] of [[2093, 0.12], [4186, 0.04], [3140, 0.03]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(v, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      o.connect(gn).connect(this.game.audio.master);
      o.start(t);
      o.stop(t + 1.6);
    }
  }
}

/** A simple seated diner regular (PS1 low-poly). */
function person(s, look) {
  const g = new THREE.Group();
  const shirt = s.mat({ color: look.shirt });
  const skin = s.mat({ color: [0xe8c0a0, 0xc08860, 0x8a5a3a, 0xf0d0b8][Math.floor(Math.random() * 4)] });
  const pants = s.mat({ color: 0x2a2a3a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.24), shirt);
  torso.position.y = 0.98;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin);
  head.position.y = 1.4;
  const lap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.45), pants);
  lap.position.set(0, 0.65, 0.12);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.14), pants);
  legs.position.set(0, 0.32, 0.32);
  for (const dx of [-0.26, 0.26]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), shirt);
    arm.position.set(dx, 0.95, 0.12);
    arm.rotation.x = -0.7;
    g.add(arm);
  }
  g.add(torso, head, lap, legs);
  if (look.hat) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 10), s.mat({ color: look.hat }));
    hat.position.y = 1.52;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), s.mat({ color: look.hat }));
    brim.position.set(0, 1.49, 0.14);
    g.add(hat, brim);
  }
  if (look.hair) {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), s.mat({ color: look.hair }));
    hair.position.y = 1.42;
    g.add(hair);
  }
  return g;
}
