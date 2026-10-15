import { oilBrushStroke, canvasGrain } from '../render/OilPaint.js';

/**
 * PaintUI
 * -------
 * The easel. Paint in oils on a 512×384 canvas:
 *   BRUSH  bristle strokes that pick up some of the wet paint underneath and
 *          run dry over a long stroke (lift and go again to reload)
 *   KNIFE  palette knife: drags and smears the paint that's there
 *   BLEND  soft brush that blends neighbouring colours
 * Palette blobs set the colour; MIX on = clicking a blob mixes it into the
 * current colour instead. Undo, fresh canvas, and "hang" onto one of the
 * frames in the house. The canvas is the easel's texture, so you see your
 * painting in the room. Everything is kept in this browser.
 */
const KEY = '3am-easel';
const OILS = [
  ['titanium white', '#f4f0e6'],
  ['ivory black', '#1c1a1a'],
  ['cadmium yellow', '#f2c41e'],
  ['yellow ochre', '#c8962e'],
  ['cadmium red', '#c8282a'],
  ['alizarin', '#7a1a2a'],
  ['burnt sienna', '#8a4422'],
  ['burnt umber', '#4a3020'],
  ['sap green', '#3e6a2a'],
  ['viridian', '#1e6a5a'],
  ['cerulean', '#3a8ac8'],
  ['ultramarine', '#2a2e8a'],
  ['payne’s grey', '#3a4450'],
  ['dioxazine violet', '#5a2a6a'],
];

export class PaintUI {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 384;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.tool = 'brush';
    this.size = 10;
    this.color = [42, 46, 138];
    this.mix = false;
    this.undo = [];
    this.onPaint = null; // easel texture refresh
    this.#load();

    this.el = document.createElement('div');
    this.el.id = 'paint';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div class="pt-wrap">
        <div class="pt-side">
          <div class="pt-tools">
            <button data-tool="brush" class="on">BRUSH</button>
            <button data-tool="knife">KNIFE</button>
            <button data-tool="blend">BLEND</button>
          </div>
          <label class="pt-size">size <input type="range" min="2" max="40" value="10" /></label>
          <div class="pt-palette"></div>
          <div class="pt-current"><i></i><button data-act="mix">MIX</button><input type="color" value="#2a2e8a" title="any colour" /></div>
        </div>
        <div class="pt-main">
          <div class="pt-easel"></div>
          <div class="pt-bar">
            <button data-act="undo">undo</button>
            <button data-act="clear">fresh canvas</button>
            <span class="pt-hang">hang on wall: <button data-hang="0">left</button><button data-hang="1">middle</button><button data-hang="2">east wall</button></span>
            <button data-act="close" class="pt-close">done</button>
          </div>
        </div>
      </div>`;
    document.getElementById('ui').appendChild(this.el);
    this.el.querySelector('.pt-easel').appendChild(this.canvas);
    this.swatch = this.el.querySelector('.pt-current i');
    const pal = this.el.querySelector('.pt-palette');
    for (const [name, hex] of OILS) {
      const b = document.createElement('button');
      b.className = 'pt-blob';
      b.style.background = hex;
      b.title = name;
      b.dataset.hex = hex;
      pal.appendChild(b);
    }
    this.#swatch();

    this.el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.dataset.tool) {
        this.tool = t.dataset.tool;
        this.el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b === t));
      } else if (t.dataset.hex) this.#pick(hex(t.dataset.hex));
      else if (t.dataset.hang) this.#hang(Number(t.dataset.hang));
      else if (t.dataset.act === 'mix') {
        this.mix = !this.mix;
        t.classList.toggle('on', this.mix);
      } else if (t.dataset.act === 'undo') this.#undo();
      else if (t.dataset.act === 'clear') this.#clear();
      else if (t.dataset.act === 'close') game.closeUI();
    });
    this.el.querySelector('.pt-size input').addEventListener('input', (e) => (this.size = Number(e.target.value)));
    this.el.querySelector('input[type=color]').addEventListener('input', (e) => this.#pick(hex(e.target.value)));

    // Painting with mouse / pen / finger.
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      this.#snapshot();
      const p = this.#pos(e);
      this.stroke = { pts: [p], dist: 0, color: this.#loaded(p), bristles: this.#bristles(), pick: 0 };
      this.#dab(p, [p[0] + 0.5, p[1] + 0.3]);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.stroke) return;
      const p = this.#pos(e);
      const last = this.stroke.pts.at(-1);
      const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
      if (d < 2) return;
      this.stroke.dist += d;
      this.stroke.pts.push(p);
      this.#dab(last, p);
    });
    const end = () => {
      if (!this.stroke) return;
      this.stroke = null;
      this.#save();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  // ---------------------------------------------------------------------------

  #pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * this.canvas.width, ((e.clientY - r.top) / r.height) * this.canvas.height];
  }

  #under(p) {
    const x = Math.max(0, Math.min(511, p[0] | 0));
    const y = Math.max(0, Math.min(383, p[1] | 0));
    const d = this.ctx.getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  /** Brush colour for this stroke: your paint, picking up a bit of what's wet below. */
  #loaded(p) {
    const u = this.#under(p);
    return this.color.map((c, i) => c * 0.82 + u[i] * 0.18);
  }

  #dab(a, b) {
    const ctx = this.ctx;
    const s = this.stroke;
    if (this.tool === 'brush') {
      this.#bristleStroke(a, b);
    } else if (this.tool === 'knife') {
      // drag a patch of existing paint along the stroke
      const r = this.size;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(this.canvas, a[0] - r, a[1] - r, r * 2, r * 2, b[0] - r, b[1] - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    } else {
      // blend: soft stroke in the averaged colour underneath
      const u1 = this.#under(a);
      const u2 = this.#under(b);
      const avg = u1.map((c, i) => (c + u2[i]) / 2);
      oilBrushStroke(ctx, [a, b], avg, this.size * 1.4, { load: 0.35, bristles: false });
    }
    this.onPaint?.();
  }

  /** A fresh brush: every bristle has its own shade and runs dry at its own time. */
  #bristles() {
    const n = Math.max(6, Math.round(this.size * 1.3));
    return Array.from({ length: n }, (_, i) => ({
      off: (i / (n - 1) - 0.5) + (Math.random() - 0.5) * 0.06,
      shade: (Math.random() - 0.5) * 34,
      dryAt: 0.15 + Math.random() * 0.75, // load below this → this bristle skips
      w: 0.7 + Math.random() * 0.8,
    }));
  }

  /**
   * Drag the bristles from a to b: stamps every ~1.2 px, each bristle leaving
   * its own streak. Paint runs out with distance (bristles drop out one by
   * one → dry-brush texture), and the brush picks up the wet colour it
   * passes over, so colours smear into each other like real oils.
   */
  #bristleStroke(a, b) {
    const ctx = this.ctx;
    const s = this.stroke;
    const size = this.size;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    const steps = Math.max(1, Math.ceil(len / 1.2));
    const dot = Math.max(1.2, (size / s.bristles.length) * 1.6);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const load = Math.max(0, 1 - (s.dist - len * (1 - t)) / (240 + size * 16));
      // wet pickup: every few px, blend a little of what's under the brush in
      if (++s.pick % 8 === 0) {
        const u = this.#under([x, y]);
        s.color = s.color.map((c, i) => c * 0.93 + u[i] * 0.07);
      }
      for (const br of s.bristles) {
        if (load < br.dryAt * 0.9) continue;
        const px = x + nx * br.off * size;
        const py = y + ny * br.off * size;
        const c = s.color;
        ctx.globalAlpha = Math.min(0.9, 0.35 + load * 0.7);
        ctx.fillStyle = `rgb(${clamp(c[0] + br.shade)},${clamp(c[1] + br.shade)},${clamp(c[2] + br.shade * 0.8)})`;
        ctx.fillRect(px - (dot * br.w) / 2, py - (dot * br.w) / 2, dot * br.w, dot * br.w);
      }
      // impasto: a faint lit ridge along the upper edge of the stroke
      if (k % 2 === 0 && load > 0.3) {
        ctx.globalAlpha = 0.12 * load;
        ctx.fillStyle = '#fff8e8';
        const ex = x - Math.abs(nx) * size * 0.5;
        const ey = y - Math.abs(ny) * size * 0.5;
        ctx.fillRect(ex, ey, dot, dot);
      }
    }
    ctx.globalAlpha = 1;
  }

  #pick(rgb) {
    this.color = this.mix ? this.color.map((c, i) => c * 0.65 + rgb[i] * 0.35) : rgb;
    this.#swatch();
  }

  #swatch() {
    this.swatch.style.background = `rgb(${this.color.map((c) => c | 0).join(',')})`;
  }

  #snapshot() {
    this.undo.push(this.ctx.getImageData(0, 0, 512, 384));
    if (this.undo.length > 15) this.undo.shift();
  }

  #undo() {
    const img = this.undo.pop();
    if (!img) return;
    this.ctx.putImageData(img, 0, 0);
    this.onPaint?.();
    this.#save();
  }

  #clear() {
    this.#snapshot();
    gesso(this.ctx);
    this.onPaint?.();
    this.#save();
  }

  #hang(slot) {
    const url = this.canvas.toDataURL('image/jpeg', 0.88);
    this.game.scenes.House.hangPainting?.(slot, url);
    this.game.hud.toast('Hung it on the wall. Not bad.', 3000);
    this.game.audio.oneShot('door', { volume: 0.3, rate: 1.8 });
  }

  #save() {
    try {
      localStorage.setItem(KEY, this.canvas.toDataURL('image/jpeg', 0.88));
    } catch {}
  }

  #load() {
    gesso(this.ctx);
    let url = null;
    try {
      url = localStorage.getItem(KEY);
    } catch {}
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      this.ctx.drawImage(img, 0, 0);
      this.onPaint?.();
    };
    img.src = url;
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  show() {
    this.visible = true;
    this.el.classList.remove('hidden');
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
    this.stroke = null;
  }
}

/** Primed canvas: off-white with linen weave. */
function gesso(ctx) {
  ctx.fillStyle = '#ece6d6';
  ctx.fillRect(0, 0, 512, 384);
  canvasGrain(ctx, 512, 384);
}

function clamp(v) {
  return Math.max(0, Math.min(255, v)) | 0;
}

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
