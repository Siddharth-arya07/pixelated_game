import * as THREE from 'three';

/**
 * DinoGame
 * --------
 * A tiny endless-runner drawn into a 160×100 canvas that is used as the
 * laptop's screen texture — you play it *on the in-world screen*.
 *
 *   const dino = new DinoGame({ onSound })
 *   laptopScreen.material = renderer.material({ map: dino.texture, unlit: true, affine: 0 })
 *   dino.update(dt, { jump, duck })   // every frame
 *
 * States: desktop (idle, shows the 2003 desktop) → ready → run → dead → ready…
 */
const W = 160;
const H = 100;
const GROUND = 82;
const LCD = '#7e8c74';

// 1 = ink. Two run frames share the body.
const DINO_BODY = [
  '......######',
  '.....##.####',
  '.....#######',
  '.....#######',
  '.....####...',
  '#...######..',
  '#..########.',
  '##########..',
  '.#########..',
  '..#######...',
];
const DINO_LEGS = [
  ['...##..#....', '...#...##...'],
  ['...#...##...', '...##..#....'],
];
const DINO_DEAD_EYE = [6, 1];
const CACTI = [
  ['..#..', '..#.#', '#.#.#', '#.###', '###..', '..#..', '..#..', '..#..', '..#..'],
  ['..#...#.', '#.#.#.#.', '#.###.#.', '###.###.', '..#...#.', '..#...#.', '..#...#.'],
  ['.#.', '.##', '##.', '.#.', '.#.'],
];
const BIRD = [
  ['.#.......', '###.....#', '.########', '....####.', '.........'],
  ['.#.......', '###......', '.########', '....####.', '...##....'],
];

export class DinoGame {
  constructor({ onSound } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.userData.live = true; // redrawn constantly: never mipmap/filter
    this.onSound = onSound ?? (() => {});
    this.state = 'desktop';
    this.hi = load();
    this.blink = 0;
    this.#reset();
    this.drawDesktop();
  }

  /** Player sat down at the laptop. */
  open() {
    this.state = 'ready';
    this.blink = 0;
    this.#reset();
  }

  /** Player got up. */
  close() {
    this.state = 'desktop';
    this.drawDesktop();
  }

  #reset() {
    this.y = 0; // height above ground (px)
    this.vy = 0;
    this.speed = 62;
    this.dist = 0;
    this.score = 0;
    this.obstacles = [];
    this.spawnIn = 60;
    this.frame = 0;
    this.clouds = [{ x: 40, y: 18 }, { x: 120, y: 30 }];
    this.specks = Array.from({ length: 14 }, () => ({ x: Math.random() * W, y: GROUND + 2 + Math.random() * 10 }));
  }

  update(dt, { jump = false, duck = false } = {}) {
    if (this.state === 'desktop') return;
    this.blink += dt;

    if (this.state === 'ready' || this.state === 'dead') {
      if (jump && this.blink > 0.4) {
        this.#reset();
        this.state = 'run';
        this.vy = 190;
        this.onSound('blip', 1.2);
      }
      this.#draw();
      return;
    }

    // --- run -----------------------------------------------------------------
    this.speed = Math.min(150, this.speed + dt * 2.2);
    const dx = this.speed * dt;
    this.dist += dx;
    const newScore = Math.floor(this.dist / 6);
    if (Math.floor(newScore / 100) > Math.floor(this.score / 100)) this.onSound('blip', 2);
    this.score = newScore;

    const onGround = this.y <= 0;
    if (jump && onGround) {
      this.vy = 190;
      this.onSound('blip', 1.4);
    }
    // Hold duck mid-air to fall faster.
    this.vy -= (duck ? 1400 : 620) * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0) this.vy = 0;
    this.frame += dt * this.speed * 0.12;

    for (const o of this.obstacles) o.x -= dx * (o.bird ? 1.15 : 1);
    this.obstacles = this.obstacles.filter((o) => o.x > -20);
    for (const c of this.clouds) {
      c.x -= dx * 0.2;
      if (c.x < -20) (c.x = W + Math.random() * 40), (c.y = 12 + Math.random() * 25);
    }
    for (const s of this.specks) {
      s.x -= dx;
      if (s.x < 0) s.x += W;
    }

    this.spawnIn -= dx;
    if (this.spawnIn <= 0) {
      const bird = this.score > 150 && Math.random() < 0.3;
      if (bird) {
        const high = Math.random() < 0.5;
        this.obstacles.push({ x: W + 4, bird: true, h: high ? 26 : 9, sprite: BIRD });
      } else {
        const sprite = CACTI[Math.floor(Math.random() * CACTI.length)];
        this.obstacles.push({ x: W + 4, bird: false, h: 0, sprite: [sprite] });
      }
      this.spawnIn = 55 + Math.random() * 70 + this.speed * 0.35;
    }

    // Collision (dino box shrunk a little to be forgiving).
    const dBox = { x: 18, y: GROUND - 12 - this.y, w: 9, h: 10 };
    for (const o of this.obstacles) {
      const spr = o.sprite[0];
      const ob = { x: o.x + 1, y: GROUND - spr.length - o.h, w: spr[0].length - 2, h: spr.length - 1 };
      if (dBox.x < ob.x + ob.w && dBox.x + dBox.w > ob.x && dBox.y < ob.y + ob.h && dBox.y + dBox.h > ob.y) {
        this.state = 'dead';
        this.blink = 0;
        if (this.score > this.hi) {
          this.hi = this.score;
          save(this.hi);
        }
        this.onSound('blip', 0.5);
        break;
      }
    }
    this.#draw();
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  #draw() {
    const c = this.ctx;
    // Old LCD: slightly green-grey, dark ink.
    // Old backlit LCD: kept fairly dark so the PSX bloom doesn't wash it out.
    c.fillStyle = LCD;
    c.fillRect(0, 0, W, H);
    const ink = '#18201a';
    const dim = '#5e6a58';

    // Window chrome (it's a .exe on a 2003 desktop after all)
    c.fillStyle = '#10247a';
    c.fillRect(0, 0, W, 7);
    c.fillStyle = '#fff';
    text(c, 'DINO.EXE', 2, 1, '#ffffff');
    c.fillStyle = '#c0c0c0';
    c.fillRect(W - 7, 1, 5, 5);

    // clouds + ground
    for (const cl of this.clouds) {
      c.fillStyle = dim;
      c.fillRect(Math.round(cl.x), cl.y, 12, 2);
      c.fillRect(Math.round(cl.x) + 3, cl.y - 2, 6, 2);
    }
    c.fillStyle = ink;
    c.fillRect(0, GROUND, W, 1);
    c.fillStyle = dim;
    for (const s of this.specks) c.fillRect(Math.round(s.x), Math.round(s.y), 2, 1);

    // obstacles
    for (const o of this.obstacles) {
      const spr = o.sprite[o.bird ? Math.floor(this.frame / 3) % 2 : 0];
      sprite(c, spr, Math.round(o.x), GROUND - spr.length - o.h, ink);
    }

    // dino
    const dy = GROUND - 12 - Math.round(this.y);
    sprite(c, DINO_BODY, 16, dy, ink);
    const legs = this.y > 0 || this.state !== 'run' ? DINO_LEGS[0] : DINO_LEGS[Math.floor(this.frame) % 2];
    sprite(c, legs, 16, dy + DINO_BODY.length, ink);
    if (this.state === 'dead') {
      c.fillStyle = LCD;
      c.fillRect(16 + DINO_DEAD_EYE[0], dy + DINO_DEAD_EYE[1], 1, 1);
    }

    // score
    text(c, `HI ${pad(this.hi)}  ${pad(this.score)}`, W - 66, 10, ink);

    if (this.state === 'ready') {
      text(c, 'PRESS SPACE TO RUN', 44, 36, ink);
      if (Math.floor(this.blink * 2) % 2 === 0) text(c, 'E TO GET UP', 58, 46, dim);
    } else if (this.state === 'dead') {
      text(c, 'G A M E   O V E R', 46, 34, ink);
      if (this.blink > 0.4) text(c, 'SPACE TO RETRY', 52, 44, dim);
    }
    this.texture.needsUpdate = true;
  }

  /** Idle screen: teal desktop with a terminal + the DINO.EXE icon (ref #1). */
  drawDesktop() {
    const c = this.ctx;
    c.fillStyle = '#3aa8a8';
    c.fillRect(0, 0, W, H);
    // explorer window
    c.fillStyle = '#d8d4cc';
    c.fillRect(10, 18, 70, 60);
    c.fillStyle = '#10247a';
    c.fillRect(10, 18, 70, 6);
    // terminal
    c.fillStyle = '#000';
    c.fillRect(56, 10, 92, 54);
    c.fillStyle = '#10247a';
    c.fillRect(56, 10, 92, 6);
    text(c, 'C:\\> dir', 59, 20, '#c8c8c8');
    text(c, 'DINO.EXE', 59, 28, '#c8c8c8');
    text(c, 'C:\\> _', 59, 36, '#c8c8c8');
    // pie chart
    c.fillStyle = '#e8a0c0';
    c.beginPath();
    c.arc(30, 60, 10, 0, Math.PI * 2);
    c.fill();
    // desktop icon
    sprite(c, DINO_BODY, 16, 2, '#ffffff');
    // taskbar
    c.fillStyle = '#c0c0c0';
    c.fillRect(0, H - 9, W, 9);
    c.fillStyle = '#208020';
    c.fillRect(1, H - 8, 18, 7);
    text(c, 'start', 3, H - 7, '#ffffff');
    text(c, '3:00 AM', W - 30, H - 7, '#000000');
    this.texture.needsUpdate = true;
  }
}

// --- tiny pixel helpers --------------------------------------------------------

function sprite(c, rows, x, y, color) {
  c.fillStyle = color;
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) if (row[i] === '#') c.fillRect(x + i, y + j, 1, 1);
  }
}

/** 3×5 pixel font so text stays crisp at 160×100. */
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', ':': '000010000010000', '.': '000000000000010', '>': '100010001010100', '\\': '100100010001001',
  _: '000000000000111', '-': '000000111000000',
};

function text(c, str, x, y, color) {
  c.fillStyle = color;
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const glyph = FONT[ch];
    if (glyph) {
      for (let i = 0; i < 15; i++) if (glyph[i] === '1') c.fillRect(cx + (i % 3), y + Math.floor(i / 3), 1, 1);
    }
    cx += 4;
  }
}

const pad = (n) => String(n).padStart(5, '0');

function load() {
  try {
    return Number(localStorage.getItem('dino-hi')) || 0;
  } catch {
    return 0;
  }
}

function save(v) {
  try {
    localStorage.setItem('dino-hi', String(v));
  } catch {}
}
