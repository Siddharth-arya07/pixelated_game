import * as THREE from 'three';
import { TetrisApp, SnakeApp, PongApp } from '../minigames/Arcade.js';
import { addMusicDevice } from './Devices.js';

/**
 * The backyard party patio, beside your house
 * -------------------------------------------
 * A deck under string lights with:
 *  - three arcade cabinets (Snake, Tetris, Pong)
 *  - beer pong: A/D aim, hold SPACE for power, let go to throw; sink all six
 *    cups in as few throws as you can (every cup = a sip)
 *  - darts: the sight drifts (more the drunker you are), SPACE/click throws;
 *    three rounds of three darts
 *  - the chug-off: mash SPACE to down a beer as fast as you can; anyone in
 *    the room standing nearby can join the same countdown
 *  - a cooler of free beers and a speaker on the shared music player
 *  - a chalkboard with the room's best scores (shared live in multiplayer)
 */
const BOARDS = {
  chug: { name: 'CHUG-OFF', unit: 's', low: true, fmt: (v) => v.toFixed(2) + 's' },
  pong: { name: 'BEER PONG', unit: 'throws', low: true, fmt: (v) => `${v} throws` },
  darts: { name: 'DARTS', low: false, fmt: (v) => `${v}` },
  snake: { name: 'SNAKE', low: false, fmt: (v) => `${v}` },
  tetris: { name: 'TETRIS', low: false, fmt: (v) => `${v}` },
  pong2: { name: 'PONG', low: false, fmt: (v) => `${v} wins` },
  bowling: { name: 'BOWLING', low: false, fmt: (v) => `${v}` },
  roulette: { name: 'ROULETTE', low: false, fmt: (v) => `${v} win${v === 1 ? '' : 's'}` },
};

export function buildBackyard(scene) {
  return new Backyard(scene);
}

class Backyard {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;
    const g = this.game;
    const h = scene.poi.house;
    const x = h.x + 17;
    const z = h.z - 1;
    const y = scene.groundHeight(x, z);
    this.c = new THREE.Vector3(x, y, z);
    this.scores = load();
    this.#ui();
    this.#deck();
    this.#board();
    this.#arcade();
    this.#pong();
    this.#darts();
    this.#chug();
    g.mp?.on('score', (e) => this.#record(e.k, e.n, e.v, true));
    g.mp?.on('chug', (e, id) => this.#remoteChug(e, id));
    scene.updaters.push((dt) => this.update(dt));
  }

  // ---------------------------------------------------------------------------
  // Deck, lights, cooler, speaker
  // ---------------------------------------------------------------------------

  #deck() {
    const s = this.scene;
    const { x, y, z } = this.c;
    const planks = s.mat({ map: s.tex('planks', 4, 3), color: 0xa08060 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 9), planks);
    deck.position.set(x, y + 0.1, z);
    s.root.add(deck);
    s.addColliderBox(x, y + 0.1, z, 12, 0.2, 9);
    // string lights between four posts
    const post = s.mat({ color: 0x4a3020 });
    const corners = [[-6, -4.5], [6, -4.5], [6, 4.5], [-6, 4.5]];
    for (const [dx, dz] of corners) s.box(0.12, 2.8, 0.12, post, x + dx, y + 1.4, z + dz);
    const bulbCols = [0xffd890, 0xff9ab0, 0x9ad8ff, 0xb8ff9a];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), s.mat({ color: bulbCols[(k + i) % 4], unlit: true }));
        b.position.set(x + ax + (bx - ax) * t, y + 2.75 - Math.sin(t * Math.PI) * 0.45, z + az + (bz - az) * t);
        s.root.add(b);
      }
    }
    s.addLight({ position: [x - 2, y + 2.5, z], color: 0xffc890, range: 11, intensity: 1.1 });
    s.addLight({ position: [x + 3, y + 2.5, z + 1], color: 0xff9ab0, range: 9, intensity: 0.7 });
    // cooler
    const cooler = s.box(0.7, 0.45, 0.45, s.mat({ color: 0x2a6ab0 }), x + 4.6, y + 0.42, z + 3.5);
    s.box(0.72, 0.08, 0.47, s.mat({ color: 0xf0f0f0 }), x + 4.6, y + 0.68, z + 3.5, { collide: false });
    s.addInteractable(cooler, {
      prompt: 'Grab a cold one from the cooler',
      action: () => {
        this.game.inventory.add('beer');
        this.game.hud.toast('Night Owl, ice cold. (It’s free. It’s a party.)', 2500);
        this.game.audio.oneShot('fridge_open', { volume: 0.4, rate: 1.4 });
      },
    });
    // speaker on the shared music player
    const spk = s.place('speaker', { x: x - 5.3, y: y + 0.2, z: z + 3.8, rotY: Math.PI * 0.75 });
    addMusicDevice(s, spk, 'the patio speaker');
    // a little sign
    s.addSpawn('party', [x, y + 0.2, z + 6], 0);
  }

  // ---------------------------------------------------------------------------
  // Leaderboard chalkboard
  // ---------------------------------------------------------------------------

  #board() {
    const s = this.scene;
    const { x, y, z } = this.c;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 320;
    this.boardCanvas = c;
    this.boardTex = new THREE.CanvasTexture(c);
    this.boardTex.userData.live = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.75), s.mat({ map: this.boardTex, affine: 0 }));
    m.position.set(x - 5.92, y + 1.35, z - 1.5);
    m.rotation.y = Math.PI / 2;
    s.root.add(m);
    s.box(0.06, 1.9, 1.55, s.mat({ color: 0x5a3a20 }), x - 5.96, y + 1.35, z - 1.5, { collide: false });
    s.addInteractable(m, {
      prompt: 'Read the high scores',
      action: () => this.game.openUI(() => this.game.note.show(this.#boardText())),
    });
    this.#drawBoard();
  }

  #boardText() {
    const rows = Object.entries(BOARDS).map(([k, b]) => {
      const list = this.scores[k] ?? [];
      return `${b.name}\n${list.length ? list.slice(0, 5).map((e, i) => `  ${i + 1}. ${e.n} — ${b.fmt(e.v)}`).join('\n') : '  (nobody yet)'}`;
    });
    return `PATIO HALL OF FAME\n\n${rows.join('\n\n')}`;
  }

  #drawBoard() {
    const c = this.boardCanvas.getContext('2d');
    c.fillStyle = '#1e2a22';
    c.fillRect(0, 0, 256, 320);
    c.fillStyle = '#f0f0e8';
    c.font = 'bold 22px "Caveat", cursive';
    c.textAlign = 'center';
    c.fillText('HALL OF FAME', 128, 28);
    c.textAlign = 'left';
    let yy = 56;
    for (const [k, b] of Object.entries(BOARDS)) {
      c.font = 'bold 17px "Caveat", cursive';
      c.fillStyle = '#ffe8a0';
      c.fillText(b.name, 14, yy);
      c.font = '16px "Caveat", cursive';
      c.fillStyle = '#e8e8e0';
      const top = (this.scores[k] ?? [])[0];
      c.fillText(top ? `${top.n}  ${b.fmt(top.v)}` : '—', 120, yy);
      yy += 36;
    }
    this.boardTex.needsUpdate = true;
  }

  #record(k, name, v, fromNet = false) {
    const b = BOARDS[k];
    const list = (this.scores[k] ??= []);
    list.push({ n: name, v });
    list.sort((a, c) => (b.low ? a.v - c.v : c.v - a.v));
    list.length = Math.min(list.length, 10);
    save(this.scores);
    this.#drawBoard();
    const g = this.game;
    if (!fromNet) {
      g.net?.online && g.net.event('score', { k, n: name, v });
      if (list[0].n === name && list[0].v === v) g.hud.toast(`NEW RECORD on the board: ${b.name} — ${b.fmt(v)}!`, 3500);
    } else if (list[0].n === name && list[0].v === v && g.scene === this.scene) g.hud.toast(`${name} set a new ${b.name} record: ${b.fmt(v)}`, 3500);
  }

  /** Other places post here too (e.g. the bowling alley). */
  recordScore(k, v) {
    this.#record(k, this.myName, v);
  }

  get myName() {
    return this.game.mp?.profile?.name || 'you';
  }

  // ---------------------------------------------------------------------------
  // Arcade cabinets
  // ---------------------------------------------------------------------------

  #arcade() {
    const s = this.scene;
    const g = this.game;
    const { x, y, z } = this.c;
    const os = { game: g };
    const games = [
      ['snake', new SnakeApp(os), 0x30a050],
      ['tetris', new TetrisApp(os), 0x6a40c0],
      ['pong2', new PongApp(os), 0xc04040],
    ];
    this.cabs = [];
    games.forEach(([k, app], i) => {
      const cx = x - 3 + i * 1.1;
      const cz = z - 3.9;
      const body = s.box(0.9, 1.8, 0.75, s.mat({ color: app && 0x1a1a22 }), cx, y + 1.1, cz);
      s.box(0.92, 0.25, 0.77, s.mat({ color: games[i][2], unlit: true }), cx, y + 1.95, cz, { collide: false });
      const cv = document.createElement('canvas');
      cv.width = 320;
      cv.height = 200;
      const tex = new THREE.CanvasTexture(cv);
      tex.userData.live = true;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.44), s.mat({ map: tex, unlit: true, affine: 0 }));
      scr.position.set(cx, y + 1.45, cz + 0.38);
      s.root.add(scr);
      const cab = { k, app, cv, tex, last: app.state, lastScore: 0 };
      this.cabs.push(cab);
      this.#drawCab(cab);
      s.addInteractable(body, {
        prompt: `Play ${BOARDS[k].name} (arcade)`,
        range: 2.4,
        action: () => {
          cab.active = true;
          g.enterFocus({
            position: new THREE.Vector3(cx, y + 1.5, cz + 1.0),
            target: new THREE.Vector3(cx, y + 1.45, cz + 0.38),
            fit: { w: 0.7, h: 0.48 },
            hiRes: true,
            hint: 'arrows / WASD play · SPACE · E step back',
            onUpdate: (dt, input) => app.key(input, dt),
            onExit: () => (cab.active = false),
          });
        },
      });
    });
  }

  #drawCab(cab) {
    const c = cab.cv.getContext('2d');
    c.fillStyle = '#000';
    c.fillRect(0, 0, 320, 200);
    cab.app.draw(c, 10, 14, cab.app.w, cab.app.h);
    c.fillStyle = '#ffd860';
    c.font = 'bold 11px monospace';
    c.fillText(`${BOARDS[cab.k].name} · BEST ${(this.scores[cab.k] ?? [])[0]?.v ?? 0}`, 10, 10);
    cab.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // Beer pong
  // ---------------------------------------------------------------------------

  #pong() {
    const s = this.scene;
    const g = this.game;
    const { x, y, z } = this.c;
    const tx = x + 1.5;
    const tz = z + 0.5;
    const top = y + 0.2 + 0.76;
    s.box(0.7, 0.76, 2.6, s.mat({ color: 0x2a5a8a }), tx, y + 0.2 + 0.38, tz);
    const cupMat = s.mat({ color: 0xd02020 });
    const cupPos = [];
    const rows = [[0], [-0.07, 0.07], [-0.14, 0, 0.14]];
    rows.forEach((r, ri) => r.forEach((dx) => cupPos.push(new THREE.Vector3(tx + dx, top, tz - 1.05 + ri * 0.12))));
    this.pongCups = cupPos.map((p) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 10), cupMat);
      m.position.copy(p).setY(top + 0.055);
      s.root.add(m);
      return { m, p, up: true };
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), s.mat({ color: 0xffffff, unlit: true }));
    ball.visible = false;
    s.root.add(ball);
    const eye = new THREE.Vector3(tx, top + 0.5, tz + 1.55);
    const aim = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), s.mat({ color: 0xffe060, unlit: true }));
    aim.rotation.x = -Math.PI / 2;
    aim.visible = false;
    s.root.add(aim);
    const P = (this.P = { ball, eye, top, tx, tz, aim, throws: 0, sunk: 0, aimX: 0, power: 0, flying: false });
    const vol = s.interactVolume(tx, top, tz, 0.8, 0.4, 2.6, {
      prompt: 'Play beer pong (sink all six cups)',
      range: 2.6,
      action: () => {
        P.throws = 0;
        P.sunk = 0;
        for (const c of this.pongCups) {
          c.up = true;
          c.m.visible = true;
        }
        P.on = true;
        aim.visible = true;
        this.#show('A/D aim · hold SPACE for power, let go to throw', '');
        g.enterFocus({
          position: eye,
          target: new THREE.Vector3(tx, top, tz - 1.0),
          fov: 50,
          hint: 'A/D aim · hold SPACE, release to throw · E quit',
          onUpdate: (dt, input) => this.#pongInput(dt, input),
          onExit: () => {
            P.on = false;
            aim.visible = false;
            ball.visible = false;
            this.#hideUI();
          },
        });
      },
    });
    void vol;
  }

  #pongInput(dt, input) {
    const P = this.P;
    const g = this.game;
    if (P.flying) return;
    const sway = (g.inventory.drunkFx ?? 0) * 0.04 * Math.sin(g.time * 2.3);
    P.aimX = THREE.MathUtils.clamp(P.aimX + input.axis('KeyA', 'KeyD') * dt * 0.25, -0.25, 0.25);
    P.aim.position.set(P.tx + P.aimX + sway, P.top + 0.02, P.tz - 1.05);
    if (input.down('Space')) {
      P.power = Math.min(1, P.power + dt * 0.8);
      this.#show(`POWER ${'▮'.repeat(Math.round(P.power * 12))}${'▯'.repeat(12 - Math.round(P.power * 12))}`, `${P.sunk}/6 cups · ${P.throws} throws`);
    } else if (P.power > 0) {
      // throw: aim at the target line, power sets the distance
      const dist = 1.2 + P.power * 1.6;
      const from = P.eye.clone().add(new THREE.Vector3(0.12, -0.25, -0.2));
      const tgt = new THREE.Vector3(P.tx + P.aimX + sway, P.top + 0.11, P.eye.z - 0.2 - dist); // aim at the cup rims
      const T = 0.75;
      P.vel = new THREE.Vector3((tgt.x - from.x) / T, (tgt.y - from.y + 0.5 * 9.8 * T * T) / T, (tgt.z - from.z) / T);
      P.ball.position.copy(from);
      P.ball.visible = true;
      P.flying = true;
      P.power = 0;
      P.throws++;
    }
  }

  #pongFly(dt) {
    const P = this.P;
    const g = this.game;
    const prev = _prev.copy(P.ball.position);
    // exact projectile step (matches the aim maths)
    P.ball.position.addScaledVector(P.vel, dt);
    P.ball.position.y -= 4.9 * dt * dt;
    P.vel.y -= 9.8 * dt;
    const b = P.ball.position;
    const rim = P.top + 0.11;
    // swept: where did the ball cross the rim height this frame?
    const crossed = prev.y >= rim && b.y < rim;
    const k = crossed ? (prev.y - rim) / (prev.y - b.y) : 0;
    const cx = prev.x + (b.x - prev.x) * k;
    const cz = prev.z + (b.z - prev.z) * k;
    for (const c of this.pongCups) {
      if (!c.up) continue;
      if (crossed && Math.hypot(cx - c.p.x, cz - c.p.z) < 0.05) {
        c.up = false;
        c.m.visible = false;
        P.flying = false;
        P.ball.visible = false;
        P.sunk++;
        g.audio.oneShot('click', { volume: 0.5, rate: 0.7 });
        g.inventory.drunk = Math.min(1.6, (g.inventory.drunk ?? 0) + 0.08);
        this.#show(P.sunk === 6 ? `ALL SIX in ${P.throws} throws!` : 'SPLASH! Drink!', `${P.sunk}/6 cups · ${P.throws} throws`);
        if (P.sunk === 6) {
          this.#record('pong', this.myName, P.throws);
          setTimeout(() => g.exitFocus(), 2500);
        }
        return;
      }
    }
    if (b.y < P.top - 0.4) {
      P.flying = false;
      P.ball.visible = false;
      this.#show('Miss.', `${P.sunk}/6 cups · ${P.throws} throws`);
    }
  }

  // ---------------------------------------------------------------------------
  // Darts
  // ---------------------------------------------------------------------------

  #darts() {
    const s = this.scene;
    const g = this.game;
    const { x, y, z } = this.c;
    const bx = x + 5.9;
    const bz = z - 1.5;
    const by = y + 0.2 + 1.73;
    // board texture: proper sectors
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    const R = 120;
    c.fillStyle = '#111';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 20; i++) {
      const a0 = ((i - 0.5) / 20) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 0.5) / 20) * Math.PI * 2 - Math.PI / 2;
      for (const [r0, r1, col] of [[0, R, i % 2 ? '#e8dcc0' : '#1a1a1a'], [R * 0.58, R * 0.64, i % 2 ? '#2a8a3a' : '#c02020'], [R * 0.94, R, i % 2 ? '#2a8a3a' : '#c02020']]) {
        c.fillStyle = col;
        c.beginPath();
        c.arc(128, 128, r1, a0, a1);
        c.arc(128, 128, r0, a1, a0, true);
        c.fill();
      }
    }
    c.fillStyle = '#2a8a3a';
    c.beginPath();
    c.arc(128, 128, R * 0.1, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#c02020';
    c.beginPath();
    c.arc(128, 128, R * 0.045, 0, Math.PI * 2);
    c.fill();
    const board = new THREE.Mesh(new THREE.CircleGeometry(0.23, 32), s.mat({ map: new THREE.CanvasTexture(cv), affine: 0 }));
    board.position.set(bx, by, bz);
    board.rotation.y = -Math.PI / 2;
    s.root.add(board);
    s.box(0.05, 0.6, 0.6, s.mat({ color: 0x3a2a1a }), bx + 0.03, by, bz, { collide: false });
    const sight = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.014, 12), s.mat({ color: 0x40ff60, unlit: true }));
    sight.rotation.y = -Math.PI / 2;
    sight.visible = false;
    s.root.add(sight);
    this.D = { bx, by, bz, sight, darts: [] };
    s.addInteractable(board, {
      prompt: 'Play darts (3 rounds of 3)',
      range: 4,
      action: () => {
        const D = this.D;
        D.round = 1;
        D.thrown = 0;
        D.total = 0;
        D.on = true;
        for (const d of D.darts) d.removeFromParent();
        D.darts = [];
        sight.visible = true;
        this.#show('Round 1 · SPACE / click to throw', 'score 0');
        g.enterFocus({
          position: new THREE.Vector3(bx - 2.4, by, bz),
          target: new THREE.Vector3(bx, by, bz),
          fov: 30,
          hint: 'SPACE / click throw · E quit',
          onUpdate: (dt, input) => this.#dartInput(dt, input),
          onExit: () => {
            D.on = false;
            sight.visible = false;
            this.#hideUI();
          },
        });
      },
    });
  }

  #dartInput(dt, input) {
    const D = this.D;
    const g = this.game;
    const t = g.time;
    const drunk = 1 + (g.inventory.drunkFx ?? 0) * 3;
    const sx = (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.1) * 0.4) * 0.07 * drunk;
    const sy = (Math.cos(t * 1.3) * 0.6 + Math.sin(t * 2.6) * 0.4) * 0.07 * drunk;
    D.sight.position.set(D.bx - 0.01, D.by + sy, D.bz + sx);
    if ((input.pressed('Space') || input.mousePressed(0)) && D.on && D.thrown < 3) {
      const r = Math.hypot(sx, sy) / 0.23; // 0..1 of the board radius
      const ang = Math.atan2(sy, -sx);
      const order = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
      const sector = order[((Math.round((Math.PI / 2 - ang) / ((Math.PI * 2) / 20)) % 20) + 20) % 20];
      const pts = r < 0.045 ? 50 : r < 0.1 ? 25 : r > 1 ? 0 : r > 0.94 ? sector * 2 : r > 0.58 && r < 0.64 ? sector * 3 : sector;
      D.total += pts;
      D.thrown++;
      const dart = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.12, 4), this.scene.mat({ color: 0xffd040 }));
      dart.rotation.z = Math.PI / 2;
      dart.position.set(D.bx - 0.06, D.by + sy, D.bz + sx);
      this.scene.root.add(dart);
      D.darts.push(dart);
      g.audio.oneShot('click', { volume: 0.5, rate: 0.6 });
      const label = pts === 50 ? 'BULLSEYE!' : pts === 0 ? 'Missed the board.' : r > 0.94 ? `Double ${sector}!` : r > 0.58 && r < 0.64 ? `TREBLE ${sector}!` : `${pts}`;
      this.#show(`Round ${D.round} · dart ${D.thrown}/3 · ${label}`, `score ${D.total}`);
      if (D.thrown === 3) {
        setTimeout(() => {
          for (const d of D.darts) d.removeFromParent();
          D.darts = [];
          if (D.round === 3) {
            this.#show(`FINAL: ${D.total}`, 'nice arm');
            this.#record('darts', this.myName, D.total);
            setTimeout(() => g.exitFocus(), 2500);
          } else {
            D.round++;
            D.thrown = 0;
            this.#show(`Round ${D.round}`, `score ${D.total}`);
          }
        }, 1200);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // The chug-off
  // ---------------------------------------------------------------------------

  #chug() {
    const s = this.scene;
    const g = this.game;
    const { x, y, z } = this.c;
    const table = s.box(1.4, 0.75, 0.8, s.mat({ map: s.tex('planks', 1, 1), color: 0x8a6a4a }), x - 1.5, y + 0.2 + 0.375, z + 2.5);
    for (let k = 0; k < 4; k++) s.place('beer_can', { x: x - 2 + k * 0.33, y: y + 0.95, z: z + 2.5 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.3), s.mat({ map: this.#signTex('CHUG-OFF'), unlit: false }));
    sign.position.set(x - 1.5, y + 1.6, z + 2.1);
    s.root.add(sign);
    s.addInteractable(table, {
      prompt: () => (this.C?.state === 'invite' ? 'Join the chug-off!' : 'Start a chug-off (mash SPACE to drink)'),
      range: 2.6,
      action: () => {
        if (this.C?.state === 'invite') return this.#joinChug();
        const t0 = Date.now() + 4000;
        g.net?.online && g.net.event('chug', { t0 });
        this.#startChug(t0);
        if (g.net?.online) g.hud.toast('Anyone near the patio can join in the next few seconds…', 3000);
      },
    });
  }

  #signTex(t) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 40;
    const x = c.getContext('2d');
    x.fillStyle = '#2a1a10';
    x.fillRect(0, 0, 128, 40);
    x.fillStyle = '#ffd860';
    x.font = 'bold 22px Impact, sans-serif';
    x.textAlign = 'center';
    x.fillText(t, 64, 29);
    return new THREE.CanvasTexture(c);
  }

  #remoteChug(e, id) {
    const g = this.game;
    if (g.scene !== this.scene || g.player.feet.distanceTo(this.c) > 18 || this.C?.state === 'go') return;
    this.C = { state: 'invite', t0: e.t0, host: id };
    g.hud.toast(`${g.mp.remotes.get(id)?.name ?? 'Someone'} started a chug-off! E at the beer table to join.`, 3500);
    setTimeout(() => this.C?.state === 'invite' && (this.C = null), Math.max(0, e.t0 - Date.now()));
  }

  #joinChug() {
    this.#startChug(this.C.t0);
  }

  #startChug(t0) {
    const g = this.game;
    this.C = { state: 'count', t0, sips: 0, need: 28 };
    g.enterFocus({
      position: g.camera.position.clone(),
      target: g.camera.position.clone().add(g.camera.getWorldDirection(new THREE.Vector3())),
      hint: 'MASH SPACE · Q give up',
      exitKey: 'KeyQ',
      onUpdate: (dt, input) => this.#chugInput(dt, input),
      onExit: () => {
        this.C = null;
        this.#hideUI();
      },
    });
  }

  #chugInput(dt, input) {
    const C = this.C;
    const g = this.game;
    if (!C) return;
    const now = Date.now();
    if (C.state === 'count') {
      const left = Math.ceil((C.t0 - now) / 1000);
      this.#show(left > 0 ? String(left) : 'DRINK!', 'mash SPACE');
      if (now >= C.t0) {
        C.state = 'go';
        C.start = now;
      }
      return;
    }
    if (C.state !== 'go') return;
    if (input.pressed('Space')) {
      C.sips++;
      g.audio.oneShot('click', { volume: 0.2, rate: 0.5 + Math.random() * 0.2 });
    }
    const pct = C.sips / C.need;
    this.#show(`${'█'.repeat(Math.round((1 - pct) * 14))}${'░'.repeat(14 - Math.round((1 - pct) * 14))}`, `${((now - C.start) / 1000).toFixed(2)}s`);
    if (C.sips >= C.need) {
      C.state = 'done';
      const tsec = Math.round((now - C.start) / 10) / 100;
      g.inventory.drunk = Math.min(1.6, (g.inventory.drunk ?? 0) + 0.45);
      this.#show(`DONE in ${tsec}s!`, tsec < 4 ? 'absolute machine' : tsec < 6 ? 'respectable' : 'you were sipping, admit it');
      this.#record('chug', this.myName, tsec);
      setTimeout(() => g.exitFocus(), 2500);
    }
  }

  // ---------------------------------------------------------------------------
  // shared HUD bits
  // ---------------------------------------------------------------------------

  #ui() {
    this.el = document.createElement('div');
    this.el.id = 'party';
    this.el.className = 'hidden';
    this.el.innerHTML = '<b></b><span></span>';
    document.getElementById('ui').appendChild(this.el);
  }

  #show(big, small) {
    this.el.classList.remove('hidden');
    this.el.querySelector('b').textContent = big;
    this.el.querySelector('span').textContent = small;
  }

  #hideUI() {
    this.el.classList.add('hidden');
  }

  update(dt) {
    if (this.P?.flying) this.#pongFly(dt);
    for (const cab of this.cabs ?? []) {
      const near = this.game.camera.position.distanceTo(this.c) < 25;
      if (!near && !cab.active) continue;
      if (cab.active || (this.frame = (this.frame ?? 0) + 1) % 6 === 0) this.#drawCab(cab);
      const st = cab.app.state;
      if (cab.active && cab.k === 'pong2' && st === 'won' && cab.last !== 'won') {
        const w = Number(localStorage.getItem('3am-pongwins') ?? 0) + 1;
        try {
          localStorage.setItem('3am-pongwins', String(w));
        } catch {}
        this.#record('pong2', this.myName, w);
      }
      if (cab.active && st === 'over' && cab.last !== 'over') {
        const sc = cab.app.score ?? cab.app.you ?? 0;
        if (sc > 0) this.#record(cab.k, this.myName, sc);
      }
      cab.last = st;
    }
  }
}

const _prev = new THREE.Vector3();

function load() {
  try {
    return JSON.parse(localStorage.getItem('3am-party') ?? '{}');
  } catch {
    return {};
  }
}
function save(s) {
  try {
    localStorage.setItem('3am-party', JSON.stringify(s));
  } catch {}
}
