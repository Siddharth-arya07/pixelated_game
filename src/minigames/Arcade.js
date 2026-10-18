/**
 * Arcade
 * ------
 * Small games for the laptop (ComputerOS windows). Each app follows the OS
 * app shape: { title, w, h, onOpen?, onClose?, key(input, dt), click?(x, y),
 * draw(c, x, y, w, h) } and draws straight into the 320×200 desktop.
 *
 *   TETRIS.EXE   A/D or ←/→ move · W/↑ rotate · S/↓ soft drop · SPACE hard drop
 *   SNAKE.EXE    WASD / arrows
 *   PONG.EXE     W/S or ↑/↓ — first to 7 against the computer
 *   MINES.EXE    click to dig · hold F and click to flag · R new game
 * High scores are kept on this device.
 */
const FONT = '"VT323", "Courier New", monospace';
const LCD_BG = '#10141c';
const INK = '#d8e0c8';

const hi = {
  get(k) {
    try {
      return Number(localStorage.getItem(`3am-hi-${k}`) ?? 0);
    } catch {
      return 0;
    }
  },
  set(k, v) {
    try {
      if (v > hi.get(k)) localStorage.setItem(`3am-hi-${k}`, String(v));
    } catch {}
  },
};

function txt(c, s, x, y, color = INK, size = 10, align = 'left') {
  c.fillStyle = color;
  c.font = `${size}px ${FONT}`;
  c.textBaseline = 'top';
  c.textAlign = align;
  c.fillText(s, Math.round(x), Math.round(y));
  c.textAlign = 'left';
}

/** Key repeat helper: true on press, then every `rate` s while held. */
function repeat(state, input, codes, dt, delay = 0.18, rate = 0.06) {
  const down = codes.some((k) => input.down(k));
  const pressed = codes.some((k) => input.pressed(k));
  if (pressed) {
    state.t = delay;
    return true;
  }
  if (!down) return false;
  state.t -= dt;
  if (state.t <= 0) {
    state.t = rate;
    return true;
  }
  return false;
}

// =============================================================================
// TETRIS
// =============================================================================

const PIECES = {
  I: { c: '#4ad8e8', s: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { c: '#f0d040', s: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  T: { c: '#b060e0', s: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { c: '#60d060', s: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { c: '#e05050', s: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { c: '#5070e8', s: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { c: '#f09040', s: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};
const BW = 10;
const BH = 20;
const CELL = 7;

export class TetrisApp {
  constructor(os) {
    this.os = os;
    this.title = 'TETRIS.EXE';
    this.w = 150;
    this.h = 160;
    this.reset();
    this.state = 'ready';
  }

  reset() {
    this.board = Array.from({ length: BH }, () => new Array(BW).fill(null));
    this.bag = [];
    this.next = this.#draw();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.fall = 0;
    this.kr = {};
    this.#spawn();
  }

  #draw() {
    if (!this.bag.length) this.bag = Object.keys(PIECES).sort(() => Math.random() - 0.5);
    return this.bag.pop();
  }

  #spawn() {
    this.type = this.next;
    this.next = this.#draw();
    this.cells = PIECES[this.type].s.map(([x, y]) => [x, y]);
    this.px = 3;
    this.py = 0;
    if (this.#hits(this.cells, this.px, this.py)) {
      this.state = 'over';
      hi.set('tetris', this.score);
      this.os.game.audio.oneShot('blip', { rate: 0.4, volume: 0.5 });
    }
  }

  #hits(cells, px, py) {
    return cells.some(([x, y]) => {
      const bx = x + px;
      const by = y + py;
      return bx < 0 || bx >= BW || by >= BH || (by >= 0 && this.board[by][bx]);
    });
  }

  #rotate() {
    if (this.type === 'O') return;
    const size = this.type === 'I' ? 4 : 3;
    const rot = this.cells.map(([x, y]) => [size - 1 - y, x]);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!this.#hits(rot, this.px + kick, this.py)) {
        this.cells = rot;
        this.px += kick;
        this.os.game.audio.oneShot('blip', { rate: 1.6, volume: 0.25 });
        return;
      }
    }
  }

  #lock() {
    const col = PIECES[this.type].c;
    for (const [x, y] of this.cells) if (y + this.py >= 0) this.board[y + this.py][x + this.px] = col;
    let cleared = 0;
    this.board = this.board.filter((row) => {
      const full = row.every(Boolean);
      if (full) cleared++;
      return !full;
    });
    while (this.board.length < BH) this.board.unshift(new Array(BW).fill(null));
    if (cleared) {
      this.lines += cleared;
      this.score += [0, 40, 100, 300, 1200][cleared] * this.level;
      this.level = 1 + Math.floor(this.lines / 10);
      this.os.game.audio.oneShot('blip', { rate: 2 + cleared * 0.3, volume: 0.5 });
    } else this.os.game.audio.oneShot('click', { volume: 0.3 });
    this.#spawn();
  }

  click() {
    if (this.state !== 'play') {
      this.reset();
      this.state = 'play';
    }
  }

  key(input, dt) {
    if (this.state !== 'play') {
      if (input.pressed('Space') || input.pressed('Enter')) this.click();
      return;
    }
    if (repeat((this.kr.l ??= {}), input, ['KeyA', 'ArrowLeft'], dt) && !this.#hits(this.cells, this.px - 1, this.py)) this.px--;
    if (repeat((this.kr.r ??= {}), input, ['KeyD', 'ArrowRight'], dt) && !this.#hits(this.cells, this.px + 1, this.py)) this.px++;
    if (input.pressed('KeyW') || input.pressed('ArrowUp')) this.#rotate();
    if (input.pressed('Space')) {
      while (!this.#hits(this.cells, this.px, this.py + 1)) {
        this.py++;
        this.score += 2;
      }
      return this.#lock();
    }
    const soft = input.down('KeyS') || input.down('ArrowDown');
    this.fall += dt * (soft ? 20 : Math.min(18, 1.2 + this.level * 0.8));
    while (this.fall >= 1) {
      this.fall -= 1;
      if (this.#hits(this.cells, this.px, this.py + 1)) return this.#lock();
      this.py++;
      if (soft) this.score += 1;
    }
  }

  draw(c, x, y) {
    c.fillStyle = LCD_BG;
    c.fillRect(x, y, this.w - 4, this.h - 14);
    const ox = x + 4;
    const oy = y + 3;
    c.strokeStyle = '#3a4458';
    c.strokeRect(ox - 1.5, oy - 1.5, BW * CELL + 3, BH * CELL + 3);
    const cell = (cx, cy, col, ghost = false) => {
      if (ghost) {
        c.strokeStyle = col;
        c.strokeRect(ox + cx * CELL + 0.5, oy + cy * CELL + 0.5, CELL - 2, CELL - 2);
        return;
      }
      c.fillStyle = col;
      c.fillRect(ox + cx * CELL, oy + cy * CELL, CELL - 1, CELL - 1);
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(ox + cx * CELL, oy + cy * CELL, CELL - 1, 1);
    };
    for (let r = 0; r < BH; r++) for (let q = 0; q < BW; q++) if (this.board[r][q]) cell(q, r, this.board[r][q]);
    if (this.state === 'play') {
      let gy = this.py;
      while (!this.#hits(this.cells, this.px, gy + 1)) gy++;
      for (const [cx, cy] of this.cells) cell(cx + this.px, cy + gy, '#5a6478', true);
      for (const [cx, cy] of this.cells) if (cy + this.py >= 0) cell(cx + this.px, cy + this.py, PIECES[this.type].c);
    }
    const sx = ox + BW * CELL + 8;
    txt(c, 'NEXT', sx, oy, '#8a94a8');
    for (const [cx, cy] of PIECES[this.next].s) {
      c.fillStyle = PIECES[this.next].c;
      c.fillRect(sx + cx * 6, oy + 14 + cy * 6, 5, 5);
    }
    txt(c, 'SCORE', sx, oy + 34, '#8a94a8');
    txt(c, String(this.score), sx, oy + 44);
    txt(c, 'LINES', sx, oy + 58, '#8a94a8');
    txt(c, String(this.lines), sx, oy + 68);
    txt(c, 'LEVEL', sx, oy + 82, '#8a94a8');
    txt(c, String(this.level), sx, oy + 92);
    txt(c, 'BEST', sx, oy + 106, '#8a94a8');
    txt(c, String(Math.max(hi.get('tetris'), this.score)), sx, oy + 116);
    if (this.state !== 'play') {
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(ox, oy + 55, BW * CELL, 30);
      txt(c, this.state === 'over' ? 'GAME OVER' : 'TETRIS', ox + (BW * CELL) / 2, oy + 58, '#f0d040', 11, 'center');
      txt(c, 'SPACE / click', ox + (BW * CELL) / 2, oy + 71, INK, 9, 'center');
    }
  }
}

// =============================================================================
// SNAKE
// =============================================================================

const SG = 6;
const SW = 24;
const SH = 17;

export class SnakeApp {
  constructor(os) {
    this.os = os;
    this.title = 'SNAKE.EXE';
    this.w = 150;
    this.h = 132;
    this.state = 'ready';
    this.reset();
  }

  reset() {
    this.body = [[8, 8], [7, 8], [6, 8]];
    this.dir = [1, 0];
    this.queue = [];
    this.t = 0;
    this.score = 0;
    this.#food();
  }

  #food() {
    do this.food = [Math.floor(Math.random() * SW), Math.floor(Math.random() * SH)];
    while (this.body.some(([x, y]) => x === this.food[0] && y === this.food[1]));
  }

  click() {
    if (this.state !== 'play') {
      this.reset();
      this.state = 'play';
    }
  }

  key(input, dt) {
    if (this.state !== 'play') {
      if (input.pressed('Space') || input.pressed('Enter')) this.click();
      return;
    }
    const turns = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
    for (const [k, d] of Object.entries(turns)) if (input.pressed(k)) this.queue.push(d);
    this.t += dt;
    const step = Math.max(0.055, 0.13 - this.score * 0.002);
    while (this.t >= step) {
      this.t -= step;
      while (this.queue.length) {
        const d = this.queue.shift();
        if (d[0] !== -this.dir[0] || d[1] !== -this.dir[1]) {
          this.dir = d;
          break;
        }
      }
      const head = [(this.body[0][0] + this.dir[0] + SW) % SW, (this.body[0][1] + this.dir[1] + SH) % SH];
      if (this.body.some(([x, y]) => x === head[0] && y === head[1])) {
        this.state = 'over';
        hi.set('snake', this.score);
        this.os.game.audio.oneShot('blip', { rate: 0.4, volume: 0.5 });
        return;
      }
      this.body.unshift(head);
      if (head[0] === this.food[0] && head[1] === this.food[1]) {
        this.score++;
        this.#food();
        this.os.game.audio.oneShot('blip', { rate: 1.8, volume: 0.4 });
      } else this.body.pop();
    }
  }

  draw(c, x, y) {
    c.fillStyle = '#16200e';
    c.fillRect(x, y, this.w - 4, this.h - 14);
    const ox = x + 1;
    const oy = y + 12;
    c.fillStyle = '#1e2c14';
    c.fillRect(ox, oy, SW * SG, SH * SG);
    c.fillStyle = '#e05040';
    c.fillRect(ox + this.food[0] * SG + 1, oy + this.food[1] * SG + 1, SG - 2, SG - 2);
    this.body.forEach(([bx, by], i) => {
      c.fillStyle = i === 0 ? '#c8f080' : '#7ab848';
      c.fillRect(ox + bx * SG, oy + by * SG, SG - 1, SG - 1);
    });
    txt(c, `SCORE ${this.score}`, x + 3, y + 1, '#c8f080');
    txt(c, `BEST ${Math.max(hi.get('snake'), this.score)}`, x + this.w - 8, y + 1, '#8aa070', 10, 'right');
    if (this.state !== 'play') {
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(ox + 20, oy + 34, SW * SG - 40, 30);
      txt(c, this.state === 'over' ? 'GAME OVER' : 'SNAKE', ox + (SW * SG) / 2, oy + 37, '#c8f080', 11, 'center');
      txt(c, 'SPACE / click', ox + (SW * SG) / 2, oy + 50, INK, 9, 'center');
    }
  }
}

// =============================================================================
// PONG
// =============================================================================

export class PongApp {
  constructor(os) {
    this.os = os;
    this.title = 'PONG.EXE';
    this.w = 170;
    this.h = 124;
    this.state = 'ready';
    this.fw = 162;
    this.fh = 98;
    this.reset();
  }

  reset() {
    this.me = this.fh / 2;
    this.cpu = this.fh / 2;
    this.sMe = 0;
    this.sCpu = 0;
    this.#serve(1);
  }

  #serve(dir) {
    this.bx = this.fw / 2;
    this.by = this.fh / 2;
    const a = (Math.random() - 0.5) * 0.8;
    this.vx = Math.cos(a) * 70 * dir;
    this.vy = Math.sin(a) * 70;
  }

  click() {
    if (this.state !== 'play') {
      this.reset();
      this.state = 'play';
    }
  }

  key(input, dt) {
    if (this.state !== 'play') {
      if (input.pressed('Space') || input.pressed('Enter')) this.click();
      return;
    }
    const PH = 18;
    const up = input.down('KeyW') || input.down('ArrowUp');
    const dn = input.down('KeyS') || input.down('ArrowDown');
    this.me = Math.max(PH / 2, Math.min(this.fh - PH / 2, this.me + ((dn ? 1 : 0) - (up ? 1 : 0)) * 110 * dt));
    // CPU: follows the ball, a little slow and a little late
    const target = this.vx > 0 ? this.by : this.fh / 2;
    this.cpu += Math.max(-75 * dt, Math.min(75 * dt, (target - this.cpu) * 0.9));
    this.bx += this.vx * dt;
    this.by += this.vy * dt;
    if (this.by < 2 || this.by > this.fh - 2) {
      this.vy *= -1;
      this.by = Math.max(2, Math.min(this.fh - 2, this.by));
    }
    const hit = (py, side) => {
      if (Math.abs(this.by - py) < PH / 2 + 2) {
        this.vx = -this.vx * 1.06;
        this.vy += (this.by - py) * 4;
        this.bx = side;
        this.os.game.audio.oneShot('blip', { rate: 1.3, volume: 0.35 });
        return true;
      }
      return false;
    };
    if (this.bx < 6 && this.vx < 0 && !hit(this.me, 6)) {
      if (this.bx < 0) {
        this.sCpu++;
        this.#point(1);
      }
    }
    if (this.bx > this.fw - 6 && this.vx > 0 && !hit(this.cpu, this.fw - 6)) {
      if (this.bx > this.fw) {
        this.sMe++;
        this.#point(-1);
      }
    }
  }

  #point(dir) {
    this.os.game.audio.oneShot('blip', { rate: 0.7, volume: 0.4 });
    if (this.sMe >= 7 || this.sCpu >= 7) {
      this.state = this.sMe > this.sCpu ? 'won' : 'lost';
      if (this.sMe > this.sCpu) hi.set('pong', hi.get('pong') + 1);
    } else this.#serve(dir);
  }

  draw(c, x, y) {
    c.fillStyle = '#060608';
    c.fillRect(x, y, this.w - 4, this.h - 14);
    const ox = x + 1;
    const oy = y + 10;
    c.fillStyle = '#e8e8e8';
    for (let i = 0; i < this.fh; i += 6) c.fillRect(ox + this.fw / 2 - 0.5, oy + i, 1, 3);
    const PH = 18;
    c.fillRect(ox + 2, oy + this.me - PH / 2, 3, PH);
    c.fillRect(ox + this.fw - 5, oy + this.cpu - PH / 2, 3, PH);
    c.fillRect(ox + this.bx - 1.5, oy + this.by - 1.5, 3, 3);
    txt(c, String(this.sMe), x + this.w / 2 - 22, y, '#e8e8e8', 11);
    txt(c, String(this.sCpu), x + this.w / 2 + 14, y, '#e8e8e8', 11);
    txt(c, `wins ${hi.get('pong')}`, x + 3, y, '#6a6a70', 9);
    if (this.state !== 'play') {
      txt(c, this.state === 'won' ? 'YOU WIN' : this.state === 'lost' ? 'CPU WINS' : 'PONG', ox + this.fw / 2, oy + 36, '#e8e8e8', 12, 'center');
      txt(c, 'W/S · SPACE / click', ox + this.fw / 2, oy + 52, '#8a8a90', 9, 'center');
    }
  }
}

// =============================================================================
// MINESWEEPER
// =============================================================================

const MN = 9;
const MINES = 10;
const MC = 11;

export class MinesApp {
  constructor(os) {
    this.os = os;
    this.title = 'MINES.EXE';
    this.w = MN * MC + 10;
    this.h = MN * MC + 30;
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: MN * MN }, () => ({ mine: false, open: false, flag: false, n: 0 }));
    this.state = 'play';
    this.placed = false;
    this.t0 = 0;
    this.time = 0;
  }

  #place(safe) {
    let n = 0;
    while (n < MINES) {
      const i = Math.floor(Math.random() * MN * MN);
      if (i === safe || this.grid[i].mine) continue;
      this.grid[i].mine = true;
      n++;
    }
    for (let i = 0; i < MN * MN; i++) this.grid[i].n = this.#around(i).filter((j) => this.grid[j].mine).length;
    this.placed = true;
  }

  #around(i) {
    const x = i % MN;
    const y = Math.floor(i / MN);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < MN && ny >= 0 && ny < MN) out.push(ny * MN + nx);
      }
    }
    return out;
  }

  #open(i) {
    const c = this.grid[i];
    if (c.open || c.flag) return;
    c.open = true;
    if (c.mine) {
      this.state = 'lost';
      for (const q of this.grid) if (q.mine) q.open = true;
      this.os.game.audio.oneShot('blip', { rate: 0.35, volume: 0.6 });
      return;
    }
    if (c.n === 0) for (const j of this.#around(i)) this.#open(j);
  }

  click(x, y) {
    const g = this.os.game;
    if (this.state !== 'play') return this.reset();
    const cx = Math.floor((x - 3) / MC);
    const cy = Math.floor((y - 14) / MC);
    if (cx < 0 || cy < 0 || cx >= MN || cy >= MN) {
      if (y < 12) this.reset(); // the smiley
      return;
    }
    const i = cy * MN + cx;
    if (g.input.down('KeyF')) {
      if (!this.grid[i].open) this.grid[i].flag = !this.grid[i].flag;
      return;
    }
    if (!this.placed) this.#place(i);
    this.#open(i);
    g.audio.oneShot('click', { volume: 0.3 });
    if (this.state === 'play' && this.grid.every((q) => q.mine || q.open)) {
      this.state = 'won';
      hi.set('mines', -Math.floor(this.time)); // stored negated: lower time = better
      g.audio.oneShot('blip', { rate: 2.2, volume: 0.5 });
    }
  }

  key(input, dt) {
    if (input.pressed('KeyR')) this.reset();
    if (this.placed && this.state === 'play') this.time += dt;
  }

  draw(c, x, y) {
    c.fillStyle = '#b8b8b8';
    c.fillRect(x, y, this.w - 4, this.h - 14);
    const mines = MINES - this.grid.filter((q) => q.flag).length;
    txt(c, String(mines).padStart(3, '0'), x + 4, y + 1, '#c01010', 11);
    txt(c, String(Math.floor(this.time)).padStart(3, '0'), x + this.w - 10, y + 1, '#c01010', 11, 'right');
    txt(c, this.state === 'lost' ? 'X(' : this.state === 'won' ? 'B)' : ':)', x + this.w / 2 - 2, y + 1, '#202020', 11, 'center');
    const NUM = ['', '#1a30d0', '#108010', '#d01010', '#10106a', '#801010', '#108080', '#000', '#606060'];
    for (let i = 0; i < MN * MN; i++) {
      const q = this.grid[i];
      const px = x + 3 + (i % MN) * MC;
      const py = y + 14 + Math.floor(i / MN) * MC;
      if (q.open) {
        c.fillStyle = q.mine ? '#e04030' : '#d0d0d0';
        c.fillRect(px, py, MC - 1, MC - 1);
        if (q.mine) {
          c.fillStyle = '#101010';
          c.beginPath();
          c.arc(px + 5, py + 5, 3, 0, Math.PI * 2);
          c.fill();
        } else if (q.n) txt(c, String(q.n), px + 5, py, NUM[q.n], 11, 'center');
      } else {
        c.fillStyle = '#9a9a9a';
        c.fillRect(px, py, MC - 1, MC - 1);
        c.fillStyle = '#e8e8e8';
        c.fillRect(px, py, MC - 1, 1);
        c.fillRect(px, py, 1, MC - 1);
        if (q.flag) {
          c.fillStyle = '#d01010';
          c.fillRect(px + 4, py + 2, 4, 3);
          c.fillStyle = '#101010';
          c.fillRect(px + 4, py + 2, 1, 7);
        }
      }
    }
  }
}

// =============================================================================
// POKER — Texas Hold'em vs three locals, with real (in-game) money
// =============================================================================

const RANKS = '23456789TJQKA';
const SUITS = ['♠', '♥', '♦', '♣']; // ♠ ♥ ♦ ♣
const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
const BUY_IN = 20;
const SB = 0.5;
const BB = 1;

/** Best 5-card hand of up to 7 cards → comparable score array [cat, ...kickers]. */
function evaluate(cards) {
  const counts = new Map();
  const suits = new Map();
  for (const c of cards) {
    counts.set(c.r, (counts.get(c.r) ?? 0) + 1);
    if (!suits.has(c.s)) suits.set(c.s, []);
    suits.get(c.s).push(c.r);
  }
  const straightHigh = (ranks) => {
    const u = [...new Set(ranks)].sort((a, b) => b - a);
    if (u.includes(12)) u.push(-1); // wheel A-2-3-4-5
    for (let i = 0; i + 4 < u.length; i++) if (u[i] - u[i + 4] === 4) return u[i];
    return -2;
  };
  let flush = null;
  for (const rs of suits.values()) if (rs.length >= 5) flush = rs;
  if (flush) {
    const sh = straightHigh(flush);
    if (sh > -2) return [8, sh];
  }
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ranksDesc = cards.map((c) => c.r).sort((a, b) => b - a);
  if (groups[0][1] === 4) return [7, groups[0][0], ...ranksDesc.filter((r) => r !== groups[0][0]).slice(0, 1)];
  if (groups[0][1] === 3 && groups[1]?.[1] >= 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...flush.sort((a, b) => b - a).slice(0, 5)];
  const sh = straightHigh(ranksDesc);
  if (sh > -2) return [4, sh];
  if (groups[0][1] === 3) return [3, groups[0][0], ...ranksDesc.filter((r) => r !== groups[0][0]).slice(0, 2)];
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) return [2, groups[0][0], groups[1][0], ...ranksDesc.filter((r) => r !== groups[0][0] && r !== groups[1][0]).slice(0, 1)];
  if (groups[0][1] === 2) return [1, groups[0][0], ...ranksDesc.filter((r) => r !== groups[0][0]).slice(0, 3)];
  return [0, ...ranksDesc.slice(0, 5)];
}
function cmp(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? -1) !== (b[i] ?? -1)) return (a[i] ?? -1) - (b[i] ?? -1);
  return 0;
}

export class PokerApp {
  constructor(os) {
    this.os = os;
    this.title = 'POKER.EXE';
    this.w = 300;
    this.h = 172;
    this.players = [
      { name: 'you', chips: 0, me: true },
      { name: 'Ray', chips: 30, style: 0.45 },
      { name: 'Dolores', chips: 30, style: 0.6 },
      { name: 'Jensen', chips: 30, style: 0.3 },
    ];
    this.dealer = 0;
    this.phase = 'lobby'; // lobby | betting | showdown
    this.msg = `Buy in for $${BUY_IN} to sit down.`;
    this.buttons = [];
    this.botT = 0;
  }

  get me() {
    return this.players[0];
  }

  #inv() {
    return this.os.game.inventory;
  }

  #buyIn() {
    if (!this.#inv().spend(BUY_IN)) {
      this.msg = `You need $${BUY_IN}.`;
      return;
    }
    this.me.chips += BUY_IN;
    this.os.game.audio.oneShot('register', { volume: 0.4 });
    this.#newHand();
  }

  #cashOut() {
    const c = Math.round(this.me.chips * 100) / 100;
    if (c <= 0) return;
    this.#inv().earn(c);
    this.me.chips = 0;
    this.phase = 'lobby';
    this.msg = `Cashed out $${c.toFixed(2)}. Ray grunts.`;
    this.os.game.audio.oneShot('register', { volume: 0.4 });
  }

  #newHand() {
    // busted locals rebuy
    for (const p of this.players) if (!p.me && p.chips < BB * 2) p.chips = 30;
    if (this.me.chips < BB) {
      this.phase = 'lobby';
      this.msg = 'Out of chips. Buy in again?';
      return;
    }
    const deck = [];
    for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) deck.push({ r, s });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.deck = deck;
    this.board = [];
    this.pot = 0;
    this.dealer = (this.dealer + 1) % 4;
    for (const p of this.players) {
      p.hand = [deck.pop(), deck.pop()];
      p.folded = false;
      p.bet = 0;
      p.acted = false;
      p.last = '';
      p.allIn = false;
    }
    this.street = 0;
    this.#post((this.dealer + 1) % 4, SB, 'SB');
    this.#post((this.dealer + 2) % 4, BB, 'BB');
    this.toCall = BB;
    this.raises = 0;
    this.turn = (this.dealer + 3) % 4;
    this.phase = 'betting';
    this.msg = '';
    this.winners = null;
    this.botT = 0.5;
    this.#skipDone();
  }

  #post(i, amt, label) {
    const p = this.players[i];
    const a = Math.min(amt, p.chips);
    p.chips -= a;
    p.bet += a;
    this.pot += a;
    p.last = label;
    if (p.chips <= 0) p.allIn = true;
  }

  #active() {
    return this.players.filter((p) => !p.folded);
  }

  /** Apply an action for the player whose turn it is. */
  #act(kind) {
    const p = this.players[this.turn];
    const owe = Math.max(0, this.toCall - p.bet);
    if (kind === 'fold') {
      p.folded = true;
      p.last = 'fold';
    } else if (kind === 'call') {
      this.#post(this.turn, owe, owe ? 'call' : 'check');
    } else if (kind === 'raise') {
      const size = (this.street < 2 ? BB : BB * 2) * 2;
      if (this.raises >= 3 || p.chips <= owe) return this.#act('call');
      this.toCall += size;
      this.raises++;
      this.#post(this.turn, this.toCall - p.bet, 'raise');
      for (const q of this.players) if (q !== p) q.acted = false;
    }
    p.acted = true;
    this.os.game.audio.oneShot('click', { volume: 0.25 });
    if (this.#active().length === 1) return this.#finish();
    this.#advance();
  }

  #advance() {
    // round over when every live, non-all-in player has acted and matched
    const live = this.players.filter((q) => !q.folded && !q.allIn);
    const done = live.every((q) => q.acted && q.bet === this.toCall) || live.length === 0;
    if (done) return this.#nextStreet();
    do this.turn = (this.turn + 1) % 4;
    while (this.players[this.turn].folded || this.players[this.turn].allIn);
    this.botT = 0.6;
  }

  #skipDone() {
    while (this.players[this.turn].folded || this.players[this.turn].allIn) this.turn = (this.turn + 1) % 4;
  }

  #nextStreet() {
    for (const p of this.players) {
      p.bet = 0;
      p.acted = false;
    }
    this.toCall = 0;
    this.raises = 0;
    this.street++;
    if (this.street === 1) this.board.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
    else if (this.street <= 3) this.board.push(this.deck.pop());
    else return this.#finish();
    this.os.game.audio.oneShot('blip', { rate: 1.4, volume: 0.25 });
    this.turn = (this.dealer + 1) % 4;
    this.#skipDone();
    this.botT = 0.7;
    // everyone all in / only one can act: run it out
    if (this.players.filter((q) => !q.folded && !q.allIn).length <= 1) this.#nextStreet();
  }

  #finish() {
    const live = this.#active();
    let winners;
    if (live.length === 1) winners = live;
    else {
      while (this.board.length < 5) this.board.push(this.deck.pop());
      for (const p of live) p.score = evaluate([...p.hand, ...this.board]);
      const best = live.reduce((a, b) => (cmp(a.score, b.score) >= 0 ? a : b)).score;
      winners = live.filter((p) => cmp(p.score, best) === 0);
    }
    const share = Math.floor((this.pot / winners.length) * 100) / 100;
    for (const w of winners) w.chips += share;
    this.winners = winners;
    const how = live.length > 1 ? ` with ${HAND_NAMES[winners[0].score[0]].toLowerCase()}` : '';
    this.msg = `${winners.map((w) => (w.me ? 'You' : w.name)).join(' & ')} win${winners.length > 1 || winners[0].me ? '' : 's'} $${this.pot.toFixed(2)}${how}.`;
    this.phase = 'showdown';
    this.os.game.audio.oneShot(winners.some((w) => w.me) ? 'register' : 'blip', { volume: 0.4, rate: 0.8 });
  }

  /** Locals: hand strength + a little nerve + a little bluff. */
  #botDecide(p) {
    const owe = Math.max(0, this.toCall - p.bet);
    let strength;
    if (this.board.length === 0) {
      const [a, b] = p.hand;
      strength = (a.r + b.r) / 24 + (a.r === b.r ? 0.35 : 0) + (a.s === b.s ? 0.06 : 0) + (Math.abs(a.r - b.r) === 1 ? 0.04 : 0);
    } else {
      const sc = evaluate([...p.hand, ...this.board]);
      strength = sc[0] / 4 + (sc[1] ?? 0) / 60;
    }
    strength += (Math.random() - 0.5) * 0.25;
    const bluff = Math.random() < 0.06;
    if ((strength > 0.75 - p.style * 0.2 || bluff) && this.raises < 3) return 'raise';
    if (owe === 0) return 'call';
    if (strength > 0.35 - p.style * 0.15 || owe <= BB * 0.5) return 'call';
    return 'fold';
  }

  click(x, y) {
    for (const b of this.buttons) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b.fn();
  }

  key(input, dt) {
    const myTurn = this.phase === 'betting' && this.turn === 0;
    if (myTurn) {
      if (input.pressed('KeyF')) this.#act('fold');
      else if (input.pressed('KeyC')) this.#act('call');
      else if (input.pressed('KeyR')) this.#act('raise');
    } else if (this.phase === 'showdown' && (input.pressed('Space') || input.pressed('KeyN'))) this.#newHand();
    else if (this.phase === 'lobby' && input.pressed('KeyB')) this.#buyIn();
    if (this.phase === 'betting' && this.turn !== 0) {
      this.botT -= dt;
      if (this.botT <= 0) this.#act(this.#botDecide(this.players[this.turn]));
    }
  }

  draw(c, x, y) {
    const W = this.w - 4;
    const H = this.h - 14;
    c.fillStyle = '#0a2a14';
    c.fillRect(x, y, W, H);
    c.fillStyle = '#145a2a';
    c.beginPath();
    c.ellipse(x + W / 2, y + 62, 120, 46, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#6a4a20';
    c.lineWidth = 3;
    c.stroke();
    const card = (cx, cy, cd, hidden) => {
      c.fillStyle = hidden ? '#7a1a2a' : '#f4f0e6';
      c.fillRect(cx, cy, 15, 21);
      c.strokeStyle = '#000';
      c.lineWidth = 1;
      c.strokeRect(cx + 0.5, cy + 0.5, 14, 20);
      if (hidden) return;
      const red = cd.s === 1 || cd.s === 2;
      txt(c, RANKS[cd.r].replace('T', '10'), cx + 2, cy, red ? '#c01818' : '#101010', 10);
      txt(c, SUITS[cd.s], cx + 4, cy + 9, red ? '#c01818' : '#101010', 11);
    };
    // board + pot
    for (let i = 0; i < 5; i++) {
      if (this.board?.[i]) card(x + W / 2 - 42 + i * 17, y + 50, this.board[i]);
      else {
        c.strokeStyle = '#2a7a44';
        c.strokeRect(x + W / 2 - 42 + i * 17 + 0.5, y + 50.5, 14, 20);
      }
    }
    if (this.phase !== 'lobby') txt(c, `pot $${this.pot.toFixed(2)}`, x + W / 2, y + 73, '#f0e070', 10, 'center');
    // seats: you bottom, Ray left, Dolores top, Jensen right
    const seats = [[W / 2 - 16, 95], [8, 46], [W / 2 - 16, 2], [W - 46, 46]];
    this.players.forEach((p, i) => {
      const [sx, sy] = seats[i];
      const turn = this.phase === 'betting' && this.turn === i;
      const show = p.me || (this.phase === 'showdown' && !p.folded && this.#active().length > 1);
      if (this.phase !== 'lobby' && p.hand && !p.folded) {
        card(x + sx, y + sy, p.hand[0], !show);
        card(x + sx + 16, y + sy, p.hand[1], !show);
      }
      const lab = `${p.me ? 'YOU' : p.name} $${p.chips.toFixed(2)}`;
      const ly = i === 0 ? sy + 22 : i === 2 ? sy + 22 : sy + 23;
      txt(c, lab, x + sx + 16, y + ly, turn ? '#ffe070' : p.folded ? '#5a7a60' : '#d8e8d0', 9, 'center');
      if (p.last && this.phase !== 'lobby') txt(c, p.last, x + sx + 16, y + ly + 8, '#8ab890', 8, 'center');
      if (this.winners?.includes(p)) txt(c, '★', x + sx - 6, y + sy + 6, '#ffe070', 11);
    });
    if (this.msg) txt(c, this.msg, x + W / 2, y + H - 40, '#ffe8a0', 9, 'center');
    // buttons
    this.buttons = [];
    const btn = (label, bx, fn, on = true) => {
      const bw = Math.max(36, label.length * 5 + 8);
      c.fillStyle = on ? '#2a2a34' : '#1a1a20';
      c.fillRect(x + bx, y + H - 16, bw, 13);
      c.strokeStyle = on ? '#8a8aa0' : '#3a3a44';
      c.strokeRect(x + bx + 0.5, y + H - 15.5, bw - 1, 12);
      txt(c, label, x + bx + bw / 2, y + H - 16, on ? '#f0f0f0' : '#5a5a6a', 9, 'center');
      if (on) this.buttons.push({ x: bx + 2, y: H - 16 + 12, w: bw, h: 13, fn });
      return bx + bw + 4;
    };
    let bx = 4;
    if (this.phase === 'lobby') {
      bx = btn(`BUY IN $${BUY_IN} (B)`, bx, () => this.#buyIn());
      txt(c, `wallet $${this.#inv().money.toFixed(2)}`, x + W - 4, y + H - 15, '#8ab890', 9, 'right');
    } else {
      const myTurn = this.phase === 'betting' && this.turn === 0;
      const owe = Math.max(0, (this.toCall ?? 0) - this.me.bet);
      bx = btn('FOLD (F)', bx, () => this.#act('fold'), myTurn);
      bx = btn(owe ? `CALL $${owe.toFixed(2)} (C)` : 'CHECK (C)', bx, () => this.#act('call'), myTurn);
      bx = btn('RAISE (R)', bx, () => this.#act('raise'), myTurn && this.raises < 3);
      if (this.phase === 'showdown') bx = btn('DEAL (SPACE)', bx, () => this.#newHand());
      btn('CASH OUT', W - 52, () => this.#cashOut(), this.phase !== 'betting');
    }
  }
}
