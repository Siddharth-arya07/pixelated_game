import * as THREE from 'three';
import { DinoGame } from '../minigames/DinoGame.js';
import { TetrisApp, SnakeApp, PongApp, MinesApp, PokerApp } from '../minigames/Arcade.js';
import { EMAILS } from './emails.js';

/**
 * ComputerOS
 * ----------
 * A tiny late-90s desktop drawn into the laptop screen's texture (320×200).
 * While you're sat at the laptop the mouse moves an on-screen cursor.
 *
 *   Mail     inbox with story emails; attachments open in Videos
 *   Videos   prerecorded tapes + any files in src/assets/videos
 *   Music    Winamp-style player (shared MusicSystem, plays from the laptop)
 *   DINO.EXE the endless runner
 *
 * Windows can be dragged by the title bar, closed with [x], focused by click.
 */
const W = 320;
const H = 200;
const FONT = '"VT323", "Courier New", monospace';
const TASKBAR = 14;

export class ComputerOS {
  constructor(game, speaker) {
    this.game = game;
    this.speaker = speaker; // the laptop object (sound comes from here)
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.c = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.userData.live = true; // redrawn constantly: never mipmap/filter
    this.cursor = { x: W / 2, y: H / 2 };
    this.windows = [];
    this.active = false;
    this.t = 0;
    this._idle = 0;
    this.drag = null;
    this.read = loadRead();
    this.dino = new DinoGame({ onSound: (_k, rate) => game.audio.oneShot('blip', { rate, volume: 0.5 }) });

    this.apps = {
      mail: new MailApp(this),
      videos: new VideoApp(this),
      music: new MusicApp(this),
      dino: new DinoApp(this),
      tetris: new TetrisApp(this),
      snake: new SnakeApp(this),
      pong: new PongApp(this),
      mines: new MinesApp(this),
      poker: new PokerApp(this),
    };
    this.icons = [
      { app: 'mail', label: 'Mail', x: 10, y: 10 },
      { app: 'videos', label: 'Videos', x: 10, y: 52 },
      { app: 'music', label: 'Music', x: 10, y: 94 },
      { app: 'dino', label: 'DINO.EXE', x: 10, y: 136 },
      { app: 'tetris', label: 'TETRIS', x: 58, y: 10 },
      { app: 'snake', label: 'SNAKE', x: 58, y: 52 },
      { app: 'pong', label: 'PONG', x: 58, y: 94 },
      { app: 'mines', label: 'MINES', x: 58, y: 136 },
      { app: 'poker', label: 'POKER', x: 106, y: 10 },
    ];
    this.draw();
  }

  get unread() {
    return EMAILS.filter((e) => !this.read.has(e.id)).length;
  }

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  open() {
    this.active = true;
    this.game.audio.oneShot('click');
  }

  close() {
    this.active = false;
    this.drag = null;
    this.apps.videos.pause();
    this.dino.close();
  }

  openApp(id, arg) {
    const app = this.apps[id];
    let win = this.windows.find((w) => w.app === app);
    if (!win) {
      const n = this.windows.length;
      win = { app, x: 40 + n * 12, y: 8 + n * 8, w: app.w, h: app.h };
      win.x = Math.min(win.x, W - win.w - 2);
      win.y = Math.min(win.y, H - TASKBAR - win.h - 2);
      this.windows.push(win);
    }
    this.focus(win);
    app.onOpen?.(arg);
    this.game.audio.oneShot('blip', { rate: 1.5, volume: 0.4 });
  }

  focus(win) {
    this.windows = this.windows.filter((w) => w !== win).concat(win);
  }

  closeWin(win) {
    win.app.onClose?.();
    this.windows = this.windows.filter((w) => w !== win);
  }

  get top() {
    return this.windows.at(-1) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  update(dt, input) {
    this.t += dt;
    this.apps.videos.tick(dt);
    if (!this.active) {
      // Idle: repaint now and then (clock, music visualizer).
      this._idle += dt;
      if (this._idle > 0.5) {
        this._idle = 0;
        this.draw();
      }
      return;
    }
    const d = input.consumeMouseDelta();
    const k = 0.45 * (this.game.settings?.sensitivity ?? 1);
    this.cursor.x = THREE.MathUtils.clamp(this.cursor.x + d.x * k, 0, W - 1);
    this.cursor.y = THREE.MathUtils.clamp(this.cursor.y + d.y * k, 0, H - 1);
    const { x, y } = this.cursor;

    if (input.mousePressed(0)) this.#click(x, y);
    if (!input.mouseDown(0)) this.drag = null;
    if (this.drag) {
      const w = this.drag.win;
      w.x = THREE.MathUtils.clamp(x - this.drag.dx, -w.w + 30, W - 30);
      w.y = THREE.MathUtils.clamp(y - this.drag.dy, 0, H - TASKBAR - 10);
    }
    const wheel = input.consumeWheel?.() ?? 0;
    const top = this.top;
    if (wheel && top) top.app.wheel?.(Math.sign(wheel));
    if (top) top.app.key?.(input, dt);
    this.draw();
  }

  #click(x, y) {
    this.game.audio.oneShot('click', { volume: 0.3 });
    // taskbar
    if (y >= H - TASKBAR) {
      let bx = 46;
      for (const w of this.windows) {
        if (x >= bx && x < bx + 60) return this.focus(w);
        bx += 62;
      }
      return;
    }
    // windows, top-most first
    for (let i = this.windows.length - 1; i >= 0; i--) {
      const w = this.windows[i];
      if (x < w.x || x >= w.x + w.w || y < w.y || y >= w.y + w.h) continue;
      this.focus(w);
      if (y < w.y + 11) {
        if (x >= w.x + w.w - 11) return this.closeWin(w);
        this.drag = { win: w, dx: x - w.x, dy: y - w.y };
        return;
      }
      w.app.click?.(x - w.x - 2, y - w.y - 12);
      return;
    }
    // desktop icons
    for (const ic of this.icons) {
      if (x >= ic.x - 2 && x < ic.x + 40 && y >= ic.y && y < ic.y + 38) return this.openApp(ic.app);
    }
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  draw() {
    const c = this.c;
    c.fillStyle = '#2f8f8f';
    c.fillRect(0, 0, W, H);
    // desktop icons
    for (const ic of this.icons) {
      drawIcon(c, ic.app, ic.x + 8, ic.y);
      if (ic.app === 'mail' && this.unread) {
        c.fillStyle = '#d02020';
        c.fillRect(ic.x + 26, ic.y - 2, 9, 9);
        text(c, String(this.unread), ic.x + 28, ic.y - 3, '#fff', 9);
      }
      text(c, ic.label, ic.x, ic.y + 24, '#ffffff', 10, true);
    }
    for (const w of this.windows) this.#window(w, w === this.top);
    this.#taskbar();
    if (this.active) drawCursor(c, Math.round(this.cursor.x), Math.round(this.cursor.y));
    this.texture.needsUpdate = true;
  }

  #window(w, focused) {
    const c = this.c;
    c.fillStyle = '#c0c0c0';
    c.fillRect(w.x, w.y, w.w, w.h);
    bevel(c, w.x, w.y, w.w, w.h);
    c.fillStyle = focused ? '#10247a' : '#7a7a8a';
    c.fillRect(w.x + 2, w.y + 2, w.w - 4, 9);
    text(c, w.app.title, w.x + 4, w.y + 1, '#ffffff', 10, true);
    c.fillStyle = '#c0c0c0';
    c.fillRect(w.x + w.w - 11, w.y + 3, 8, 7);
    text(c, 'x', w.x + w.w - 9, w.y + 1, '#000', 10, true);
    c.save();
    c.beginPath();
    c.rect(w.x + 2, w.y + 12, w.w - 4, w.h - 14);
    c.clip();
    w.app.draw(c, w.x + 2, w.y + 12, w.w - 4, w.h - 14);
    c.restore();
  }

  #taskbar() {
    const c = this.c;
    c.fillStyle = '#c0c0c0';
    c.fillRect(0, H - TASKBAR, W, TASKBAR);
    c.fillStyle = '#ffffff';
    c.fillRect(0, H - TASKBAR, W, 1);
    c.fillStyle = '#208020';
    c.fillRect(2, H - TASKBAR + 2, 40, TASKBAR - 4);
    text(c, 'start', 8, H - TASKBAR + 1, '#ffffff', 11, true);
    let bx = 46;
    for (const w of this.windows) {
      c.fillStyle = w === this.top ? '#a8a8b0' : '#d0d0d0';
      c.fillRect(bx, H - TASKBAR + 2, 60, TASKBAR - 4);
      text(c, w.app.title.slice(0, 11), bx + 3, H - TASKBAR + 1, '#000', 10);
      bx += 62;
    }
    const clock = this.game.dayNight?.label ?? '3:00 a.m.';
    text(c, clock, W - 52, H - TASKBAR + 1, '#000', 10);
  }
}

// =============================================================================
// Apps
// =============================================================================

class MailApp {
  constructor(os) {
    this.os = os;
    this.title = 'Mail';
    this.w = 290;
    this.h = 168;
    this.sel = 0;
    this.scroll = 0;
  }

  onOpen() {
    this.#markRead();
  }

  #markRead() {
    const e = EMAILS[this.sel];
    if (!this.os.read.has(e.id)) {
      this.os.read.add(e.id);
      saveRead(this.os.read);
    }
  }

  click(x, y) {
    if (x < 100) {
      const i = Math.floor(y / 15);
      if (i >= 0 && i < EMAILS.length) {
        this.sel = i;
        this.scroll = 0;
        this.#markRead();
      }
      return;
    }
    const e = EMAILS[this.sel];
    if (e.attachment && this._attach && y >= this._attach.y && y < this._attach.y + 11 && x >= 104) this.os.openApp('videos', e.attachment);
  }

  wheel(d) {
    this.scroll = Math.max(0, this.scroll + d * 10);
  }

  key(input) {
    if (input.pressed('ArrowDown')) this.sel = Math.min(EMAILS.length - 1, this.sel + 1);
    if (input.pressed('ArrowUp')) this.sel = Math.max(0, this.sel - 1);
  }

  draw(c, x, y, w, h) {
    c.fillStyle = '#ffffff';
    c.fillRect(x, y, 98, h);
    EMAILS.forEach((e, i) => {
      const ry = y + i * 15;
      if (i === this.sel) {
        c.fillStyle = '#10247a';
        c.fillRect(x, ry, 98, 15);
      }
      const unread = !this.os.read.has(e.id);
      const col = i === this.sel ? '#fff' : '#000';
      if (unread) {
        c.fillStyle = '#d02020';
        c.fillRect(x + 2, ry + 5, 3, 3);
      }
      text(c, e.from.slice(0, 16), x + 7, ry - 1, col, 10, unread);
      text(c, e.subject.slice(0, 18), x + 7, ry + 6, i === this.sel ? '#c8d0ff' : '#555', 9);
    });
    // reading pane
    const e = EMAILS[this.sel];
    const px = x + 101;
    const pw = w - 101;
    c.fillStyle = '#f4f4ec';
    c.fillRect(px, y, pw, h);
    text(c, `From: ${e.from}`, px + 3, y + 1, '#000', 10, true);
    text(c, e.subject, px + 3, y + 10, '#000', 10);
    text(c, e.date, px + 3, y + 19, '#666', 9);
    c.fillStyle = '#999';
    c.fillRect(px + 2, y + 30, pw - 4, 1);
    c.save();
    c.beginPath();
    c.rect(px, y + 32, pw, h - 46);
    c.clip();
    const lines = wrap(c, e.body, pw - 8, 10);
    lines.forEach((l, i) => text(c, l, px + 3, y + 33 + i * 9 - this.scroll, '#111', 10));
    c.restore();
    this._attach = null;
    if (e.attachment) {
      const vid = this.os.game.videos.get(e.attachment);
      const ay = y + h - 13;
      c.fillStyle = '#d8d8d0';
      c.fillRect(px + 2, ay, pw - 4, 11);
      text(c, `▶ ${vid?.title ?? e.attachment}`, px + 5, ay, '#10247a', 10, true);
      this._attach = { y: ay - y };
    }
  }
}

class VideoApp {
  constructor(os) {
    this.os = os;
    this.title = 'Videos';
    this.w = 250;
    this.h = 176;
    this.current = null;
    this.time = 0;
    this.playing = false;
  }

  onOpen(id) {
    if (id) this.load(id);
  }

  onClose() {
    this.pause();
    this.current = null;
  }

  load(id) {
    this.pause();
    this.current = id;
    this.time = 0;
    this.play();
  }

  play() {
    if (!this.current) return;
    this.playing = true;
    const lib = this.os.game.videos;
    lib.setPlaying(this.current, true, this.time);
    if (this.current.startsWith('file:')) lib.fileAudio(this.current, this.os.speaker);
    if (this.os.game.music.playing) this.os.game.music.pause();
  }

  pause() {
    this.playing = false;
    if (this.current) this.os.game.videos.setPlaying(this.current, false);
  }

  tick(dt) {
    if (!this.playing || !this.current) return;
    this.time += dt;
    const dur = this.os.game.videos.get(this.current)?.duration || 0;
    if (dur && this.time > dur) {
      this.time = 0;
      this.pause();
    }
  }

  click(x, y) {
    const lib = this.os.game.videos;
    if (!this.current) {
      const i = Math.floor((y - 12) / 12);
      if (i >= 0 && i < lib.list.length) this.load(lib.list[i].id);
      return;
    }
    const cy = this.h - 14 - 15;
    if (y >= cy) {
      if (x < 18) this.playing ? this.pause() : this.play();
      else if (x < 36) {
        this.pause();
        this.time = 0;
      } else if (x > this.w - 34) {
        this.pause();
        this.current = null;
      } else {
        // seek bar
        const dur = lib.get(this.current)?.duration || 1;
        this.time = ((x - 40) / (this.w - 80)) * dur;
        if (this.playing) lib.setPlaying(this.current, true, this.time);
      }
    }
  }

  draw(c, x, y, w, h) {
    const lib = this.os.game.videos;
    c.fillStyle = '#000';
    c.fillRect(x, y, w, h);
    if (!this.current) {
      text(c, 'MY VIDEOS', x + 4, y, '#40ff60', 10, true);
      lib.list.forEach((v, i) => {
        text(c, `▶ ${v.title}`, x + 6, y + 12 + i * 12, '#c8c8c8', 10);
        text(c, fmt(v.duration), x + w - 30, y + 12 + i * 12, '#888', 10);
      });
      return;
    }
    const vh = h - 15;
    lib.draw(c, this.current, this.time, x, y, w, vh);
    if (!this.playing) {
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(x, y, w, vh);
      text(c, '❚❚ PAUSED', x + w / 2 - 22, y + vh / 2 - 5, '#fff', 11, true);
    }
    // controls
    const cy = y + vh;
    c.fillStyle = '#c0c0c0';
    c.fillRect(x, cy, w, 15);
    text(c, this.playing ? '❚❚' : '▶', x + 4, cy + 2, '#000', 10, true);
    text(c, '■', x + 22, cy + 2, '#000', 10, true);
    const dur = lib.get(this.current)?.duration || 1;
    c.fillStyle = '#808080';
    c.fillRect(x + 40, cy + 6, w - 80, 3);
    c.fillStyle = '#10247a';
    c.fillRect(x + 40, cy + 6, (w - 80) * Math.min(1, this.time / dur), 3);
    text(c, 'LIST', x + w - 30, cy + 2, '#000', 10, true);
  }
}

class MusicApp {
  constructor(os) {
    this.os = os;
    this.title = 'Music';
    this.w = 220;
    this.h = 160;
    this.scroll = 0;
  }

  get music() {
    return this.os.game.music;
  }

  onOpen() {
    this.music.useSpeaker(this.os.speaker);
  }

  click(x, y) {
    const m = this.music;
    m.useSpeaker(this.os.speaker);
    // buttons row at y 36..48
    if (y >= 36 && y < 48) {
      const b = Math.floor((x - 4) / 22);
      if (b === 0) m.prev();
      else if (b === 1) m.play();
      else if (b === 2) m.pause();
      else if (b === 3) {
        m.pause();
        m.seek(0);
      } else if (b === 4) m.next();
      else if (x > 120) m.volume = (x - 124) / (this.w - 134);
      return;
    }
    if (y >= 28 && y < 34) {
      m.seek(((x - 4) / (this.w - 12)) * m.duration);
      return;
    }
    if (y >= 52) {
      const i = Math.floor((y - 52) / 10) + this.scroll;
      if (i >= 0 && i < m.tracks.length) m.play(i);
    }
  }

  wheel(d) {
    this.scroll = THREE.MathUtils.clamp(this.scroll + d, 0, Math.max(0, this.music.tracks.length - 8));
  }

  draw(c, x, y, w, h) {
    const m = this.music;
    c.fillStyle = '#23232e';
    c.fillRect(x, y, w, h);
    // LCD
    c.fillStyle = '#000';
    c.fillRect(x + 2, y + 2, w - 4, 24);
    const t = m.current;
    const title = `${t.artist} - ${t.title}   ***   `;
    const off = Math.floor(this.os.t * 8) % title.length;
    text(c, (title + title).slice(off, off + 26), x + 52, y + 2, '#40ff60', 10);
    text(c, fmt(m.position), x + 6, y + 4, '#40ff60', 14, true);
    // spectrum
    const s = m.spectrum();
    for (let i = 0; i < 16; i++) {
      const v = m.playing ? s[i + 1] / 255 : 0;
      const bh = Math.max(1, Math.round(v * 10));
      c.fillStyle = v > 0.75 ? '#e0c040' : '#40c060';
      c.fillRect(x + 52 + i * 9, y + 24 - bh, 7, bh);
    }
    // seek
    c.fillStyle = '#444';
    c.fillRect(x + 2, y + 28, w - 8, 4);
    c.fillStyle = '#e0c040';
    c.fillRect(x + 2, y + 28, (w - 8) * (m.duration ? Math.min(1, m.position / m.duration) : 0), 4);
    // buttons
    ['|◀', '▶', '❚❚', '■', '▶|'].forEach((label, i) => {
      c.fillStyle = '#c0c0c0';
      c.fillRect(x + 4 + i * 22, y + 36, 20, 11);
      text(c, label, x + 8 + i * 22, y + 36, '#000', 10, true);
    });
    text(c, 'VOL', x + 116, y + 36, '#c8c8c8', 9);
    c.fillStyle = '#444';
    c.fillRect(x + 132, y + 40, w - 140, 3);
    c.fillStyle = '#40ff60';
    c.fillRect(x + 132, y + 40, (w - 140) * m.volume, 3);
    // playlist
    c.fillStyle = '#000';
    c.fillRect(x + 2, y + 52, w - 4, h - 54);
    m.tracks.slice(this.scroll, this.scroll + 8).forEach((tr, i) => {
      const idx = i + this.scroll;
      const col = idx === m.index ? '#ffffff' : '#40c060';
      text(c, `${idx + 1}. ${tr.title}`.slice(0, 30), x + 4, y + 52 + i * 10, col, 10);
      if (tr.duration) text(c, fmt(tr.duration), x + w - 30, y + 52 + i * 10, col, 10);
    });
  }
}

class DinoApp {
  constructor(os) {
    this.os = os;
    this.title = 'DINO.EXE';
    this.w = 164;
    this.h = 116;
  }

  onOpen() {
    this.os.dino.open();
  }

  onClose() {
    this.os.dino.close();
  }

  click() {
    this._clickJump = true;
  }

  key(input, dt) {
    const jump = input.pressed('Space') || input.pressed('KeyW') || input.pressed('ArrowUp') || this._clickJump;
    this._clickJump = false;
    this.os.dino.update(dt, { jump, duck: input.down('KeyS') || input.down('ArrowDown') });
  }

  draw(c, x, y) {
    c.drawImage(this.os.dino.canvas, x, y);
  }
}

// =============================================================================
// Drawing helpers
// =============================================================================

function text(c, s, x, y, color, size = 10, bold = false) {
  c.fillStyle = color;
  c.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  c.textBaseline = 'top';
  c.fillText(s, Math.round(x), Math.round(y));
}

function wrap(c, body, maxW, size) {
  c.font = `${size}px ${FONT}`;
  const out = [];
  for (const para of body.split('\n')) {
    if (!para) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (c.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

function bevel(c, x, y, w, h) {
  c.fillStyle = '#ffffff';
  c.fillRect(x, y, w, 1);
  c.fillRect(x, y, 1, h);
  c.fillStyle = '#404040';
  c.fillRect(x, y + h - 1, w, 1);
  c.fillRect(x + w - 1, y, 1, h);
}

function drawCursor(c, x, y) {
  const shape = ['X', 'XX', 'X.X', 'X..X', 'X...X', 'X....X', 'X.....X', 'X..XXXX', 'X.X', 'XX'];
  shape.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === ' ') continue;
      c.fillStyle = row[i] === 'X' ? '#000' : '#fff';
      c.fillRect(x + i, y + j, 1, 1);
    }
  });
}

function drawIcon(c, kind, x, y) {
  switch (kind) {
    case 'mail':
      c.fillStyle = '#f0f0e0';
      c.fillRect(x, y + 4, 22, 15);
      c.strokeStyle = '#806040';
      c.beginPath();
      c.moveTo(x, y + 4);
      c.lineTo(x + 11, y + 12);
      c.lineTo(x + 22, y + 4);
      c.stroke();
      break;
    case 'videos':
      c.fillStyle = '#202020';
      c.fillRect(x, y + 3, 22, 17);
      c.fillStyle = '#e0e0e0';
      for (let i = 0; i < 4; i++) {
        c.fillRect(x + 2 + i * 5, y + 4, 3, 2);
        c.fillRect(x + 2 + i * 5, y + 17, 3, 2);
      }
      c.fillStyle = '#40a0e0';
      c.fillRect(x + 3, y + 7, 16, 9);
      break;
    case 'music':
      c.fillStyle = '#e0c040';
      c.fillRect(x + 6, y + 14, 6, 5);
      c.fillRect(x + 16, y + 12, 6, 5);
      c.fillRect(x + 10, y + 2, 2, 14);
      c.fillRect(x + 20, y + 0, 2, 14);
      c.fillRect(x + 10, y + 1, 12, 3);
      break;
    case 'poker':
      c.fillStyle = '#f4f0e6';
      c.fillRect(x + 2, y + 3, 11, 16);
      c.fillRect(x + 9, y + 1, 11, 16);
      c.fillStyle = '#c01818';
      c.font = '10px monospace';
      c.fillText('\u2665', x + 11, y + 12);
      c.fillStyle = '#101010';
      c.fillText('A', x + 3, y + 12);
      break;
    case 'tetris':
      for (const [cx, cy, col] of [[0, 1, '#4ad8e8'], [1, 1, '#4ad8e8'], [2, 1, '#4ad8e8'], [1, 0, '#b060e0'], [3, 2, '#f0d040'], [3, 3, '#f0d040'], [2, 3, '#e05050'], [1, 3, '#e05050']]) {
        c.fillStyle = col;
        c.fillRect(x + 1 + cx * 5, y + 2 + cy * 5, 4, 4);
      }
      break;
    case 'snake':
      c.fillStyle = '#7ab848';
      c.fillRect(x + 2, y + 14, 14, 3);
      c.fillRect(x + 13, y + 6, 3, 9);
      c.fillRect(x + 13, y + 6, 8, 3);
      c.fillStyle = '#e05040';
      c.fillRect(x + 4, y + 4, 3, 3);
      break;
    case 'pong':
      c.fillStyle = '#101010';
      c.fillRect(x, y + 2, 22, 18);
      c.fillStyle = '#e8e8e8';
      c.fillRect(x + 2, y + 6, 2, 8);
      c.fillRect(x + 18, y + 9, 2, 8);
      c.fillRect(x + 10, y + 10, 2, 2);
      break;
    case 'mines':
      c.fillStyle = '#b8b8b8';
      c.fillRect(x, y + 2, 22, 18);
      c.fillStyle = '#101010';
      c.beginPath();
      c.arc(x + 11, y + 11, 5, 0, Math.PI * 2);
      c.fill();
      c.fillRect(x + 10, y + 3, 2, 16);
      c.fillRect(x + 3, y + 10, 16, 2);
      break;
    case 'dino':
      c.fillStyle = '#e0e0e0';
      c.fillRect(x + 8, y + 2, 12, 7);
      c.fillRect(x + 4, y + 8, 12, 9);
      c.fillRect(x, y + 10, 4, 3);
      c.fillRect(x + 6, y + 17, 3, 4);
      c.fillRect(x + 12, y + 17, 3, 4);
      c.fillStyle = '#2f8f8f';
      c.fillRect(x + 11, y + 3, 2, 2);
      break;
  }
}

function fmt(s) {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function loadRead() {
  try {
    return new Set(JSON.parse(localStorage.getItem('3am-mail-read') ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveRead(set) {
  try {
    localStorage.setItem('3am-mail-read', JSON.stringify([...set]));
  } catch {}
}
