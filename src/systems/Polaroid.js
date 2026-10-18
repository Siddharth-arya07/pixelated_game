import * as THREE from 'three';

/**
 * Polaroid
 * --------
 * An instant camera. Equip it from the inventory and you look through the
 * viewfinder: LMB takes a picture, Q / scroll switches film stock, RMB holds
 * a zoom, K opens the album.
 *
 * A shot grabs the frame straight off the WebGL canvas (right after it's
 * rendered, so no preserveDrawingBuffer), crops it square, runs it through
 * the film stock's look (colour curves, fade, grain, vignette, light leaks,
 * bloom), drops it into a white instant-film frame with a handwritten
 * caption, then ejects it and lets it develop in front of you.
 * Each pack of film is 10 shots. Photos are kept in this browser
 * (localStorage, newest 36) and can be saved as PNG from the album.
 */
const KEY = '3am-polaroids';
const KEEP = 36;
const PX = 360; // image square
const FRAME = { w: 400, h: 480, side: 20, top: 20 };

export const FILMS = [
  { id: 'classic', name: 'Classic 600', note: 'warm, soft, a bit faded' },
  { id: 'bw', name: 'B&W Impulse', note: 'contrasty black & white' },
  { id: 'faded', name: "Faded '79", note: 'washed-out, magenta-yellow' },
  { id: 'expired', name: 'Expired Film', note: 'colour shifts, leaks, chemistry blotches' },
  { id: 'flash', name: 'Night Flash', note: 'hot flash, crushed shadows' },
  { id: 'dream', name: 'Dreamy', note: 'glow and pink haze' },
  { id: 'xpro', name: 'Cross-Process', note: 'green highlights, blue shadows' },
  { id: 'sepia', name: 'Sepia', note: 'old brown photograph' },
  { id: 'vhs', name: 'Camcorder', note: 'scanlines, colour bleed, date stamp' },
];

export class Polaroid {
  constructor(game) {
    this.game = game;
    this.film = 0;
    this.zoom = 0;
    this.lights = [];
    this.busy = false;
    this.photos = this.#load();
    this.#ui();
  }

  get equipped() {
    const g = this.game;
    return g.inventory.equipped === 'polaroid' && !g.focus && !g.uiOpen && !g.vehicle.driving && g.player.enabled;
  }

  get shotsLeft() {
    return this.game.inventory.count('polaroid_film') * 10 - (this.used ?? 0);
  }

  // ---------------------------------------------------------------------------
  // UI: viewfinder, developing print, album
  // ---------------------------------------------------------------------------

  #ui() {
    const ui = document.getElementById('ui');
    this.vf = document.createElement('div');
    this.vf.id = 'viewfinder';
    this.vf.className = 'hidden';
    this.vf.innerHTML = `<div class="vf-box"><i></i><i></i><i></i><i></i></div><div class="vf-info"><b></b><span></span></div><div class="vf-flash"></div>`;
    ui.appendChild(this.vf);
    this.vfName = this.vf.querySelector('b');
    this.vfInfo = this.vf.querySelector('.vf-info span');
    this.flashEl = this.vf.querySelector('.vf-flash');

    this.print = document.createElement('div');
    this.print.id = 'print';
    this.print.className = 'hidden';
    ui.appendChild(this.print);

    this.album = document.createElement('div');
    this.album.id = 'album';
    this.album.className = 'hidden';
    ui.appendChild(this.album);
    this.album.addEventListener('click', (e) => e.target === this.album && this.game.closeUI());
    this.album.addEventListener('wheel', (e) => e.stopPropagation());
    this.visible = false;
    window.addEventListener('wheel', (e) => this.equipped && this.game.input.locked && this.#cycle(Math.sign(e.deltaY)));
  }

  #cycle(d) {
    this.film = (this.film + d + FILMS.length) % FILMS.length;
    this.game.audio.oneShot('click', { volume: 0.25, rate: 1.6 });
  }

  show() {
    this.visible = true;
    this.#renderAlbum();
    this.album.classList.remove('hidden');
  }

  hide() {
    this.visible = false;
    this.album.classList.add('hidden');
  }

  #renderAlbum(big = null) {
    const a = this.album;
    if (big !== null) {
      const p = this.photos[big];
      a.innerHTML = `<div class="al-big"><img src="${p.src}"><div class="al-actions"><button data-a="back">← back</button><button data-a="save">save image</button><button data-a="del">throw away</button></div></div>`;
      a.querySelector('[data-a=back]').onclick = () => this.#renderAlbum();
      a.querySelector('[data-a=save]').onclick = () => {
        const l = document.createElement('a');
        l.href = p.src;
        l.download = `polaroid-${p.t}.jpg`;
        l.click();
      };
      a.querySelector('[data-a=del]').onclick = () => {
        this.photos.splice(big, 1);
        this.#save();
        this.#renderAlbum();
      };
      return;
    }
    a.innerHTML = `<div class="al-head"><b>PHOTO ALBUM</b><span>${this.photos.length ? `${this.photos.length} photo${this.photos.length > 1 ? 's' : ''} · click one to look closer` : 'Empty. Equip the Polaroid and take some.'}</span></div><div class="al-grid"></div><div class="al-hint">K / Esc to close</div>`;
    const grid = a.querySelector('.al-grid');
    this.photos.forEach((p, i) => {
      const im = document.createElement('img');
      im.src = p.src;
      im.style.transform = `rotate(${((i * 37) % 9) - 4}deg)`;
      im.onclick = () => this.#renderAlbum(i);
      grid.appendChild(im);
    });
  }

  // ---------------------------------------------------------------------------
  // Per frame
  // ---------------------------------------------------------------------------

  update(dt) {
    const g = this.game;
    const input = g.input;
    if (input.pressed('KeyK') && !g.focus && (this.visible || !g.uiOpen) && g.inventory.has('polaroid')) {
      if (this.visible) g.closeUI();
      else g.openUI(() => this.show());
    }
    const on = this.equipped;
    this.vf.classList.toggle('hidden', !on);
    if (!on) {
      if (this.zoom) this.#setZoom(0);
      return;
    }
    if (input.pressed('KeyQ')) this.#cycle(1);
    const want = input.mouseDown(2) ? 1 : 0;
    if (want !== this.zoom) this.#setZoom(want);
    const f = FILMS[this.film];
    this.vfName.textContent = f.name;
    this.vfInfo.textContent = `${f.note} · ${Math.max(0, this.shotsLeft)} shots left`;
    if (input.locked && input.mousePressed(0) && !this.busy) {
      input.consumeMouse(0);
      this.#shoot();
    }
    for (let k = this.lights.length - 1; k >= 0; k--) if ((this.lights[k].t -= dt) <= 0) this.lights.splice(k, 1);
  }

  #setZoom(z) {
    this.zoom = z;
    this.game.zoomFov = z ? 32 : null;
  }

  // ---------------------------------------------------------------------------
  // Taking a picture
  // ---------------------------------------------------------------------------

  #shoot() {
    const g = this.game;
    if (this.shotsLeft <= 0) {
      g.hud.toast('Out of film. Instant film packs at the Quik Mart (aisle 3).');
      g.audio.oneShot('click', { volume: 0.4, rate: 0.6 });
      return;
    }
    this.busy = true;
    // flash: one bright light at the lens for the captured frame
    const L = { position: g.camera.position.clone(), color: new THREE.Color(0xf4f6ff), range: 9, intensity: 1.2, enabled: true, priority: 9, t: 0.12 };
    this.lights.push(L);
    this.#shutterSound();
    g.captureNext = (canvas) => {
      const film = FILMS[this.film];
      const img = this.#develop(canvas, film.id);
      this.flashEl.classList.remove('go');
      void this.flashEl.offsetWidth;
      this.flashEl.classList.add('go');
      this.used = (this.used ?? 0) + 1;
      if (this.used >= 10) {
        this.used = 0;
        g.inventory.remove('polaroid_film');
      }
      const src = img.toDataURL('image/jpeg', 0.86);
      this.photos.unshift({ src, t: Date.now(), film: film.id });
      if (this.photos.length > KEEP) this.photos.length = KEEP;
      this.#save();
      this.#eject(src);
    };
  }

  #shutterSound() {
    const ctx = this.game.audio.ctx;
    const out = this.game.audio.master;
    const t = ctx.currentTime;
    // clack
    const n = this.game.audio.noiseSource(false);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.5, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    n.connect(bp).connect(e).connect(out);
    n.start(t);
    n.stop(t + 0.08);
    // motor whirr pushing the print out
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t + 0.25);
    o.frequency.linearRampToValueAtTime(170, t + 1.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t + 0.25);
    og.gain.linearRampToValueAtTime(0.07, t + 0.3);
    og.gain.setValueAtTime(0.07, t + 1.35);
    og.gain.linearRampToValueAtTime(0, t + 1.45);
    o.connect(lp).connect(og).connect(out);
    o.start(t + 0.25);
    o.stop(t + 1.5);
  }

  /** The print slides out, then the image surfaces from murky brown. */
  #eject(src) {
    const p = this.print;
    p.innerHTML = `<div class="pr-card"><img src="${src}"><div class="pr-mask"></div></div>`;
    p.classList.remove('hidden', 'out', 'dev', 'away');
    void p.offsetWidth;
    p.classList.add('out');
    setTimeout(() => p.classList.add('dev'), 1500);
    setTimeout(() => p.classList.add('away'), 9000);
    setTimeout(() => {
      p.classList.add('hidden');
      this.busy = false;
    }, 9800);
    setTimeout(() => (this.busy = false), 1600); // you can keep shooting while it develops
    this.game.hud.toast('Shake it like a Polaroid picture. (K: album)', 3000);
  }

  // ---------------------------------------------------------------------------
  // The look
  // ---------------------------------------------------------------------------

  #develop(src, film) {
    // square crop from the middle of the frame
    const s = Math.min(src.width, src.height);
    const raw = document.createElement('canvas');
    raw.width = raw.height = PX;
    const r = raw.getContext('2d', { willReadFrequently: true });
    r.imageSmoothingEnabled = true;
    const zoomCrop = s * 0.92;
    r.drawImage(src, (src.width - zoomCrop) / 2, (src.height - zoomCrop) / 2, zoomCrop, zoomCrop, 0, 0, PX, PX);

    // bloom-ish glow for some stocks (blurred copy screened over)
    if (film === 'dream' || film === 'classic' || film === 'flash' || film === 'expired') {
      const glow = document.createElement('canvas');
      glow.width = glow.height = PX;
      const gc = glow.getContext('2d');
      gc.filter = `blur(${film === 'dream' ? 10 : 5}px) brightness(${film === 'dream' ? 1.3 : 1.1})`;
      gc.drawImage(raw, 0, 0);
      r.globalCompositeOperation = 'screen';
      r.globalAlpha = film === 'dream' ? 0.6 : 0.28;
      r.drawImage(glow, 0, 0);
      r.globalAlpha = 1;
      r.globalCompositeOperation = 'source-over';
    }

    const im = r.getImageData(0, 0, PX, PX);
    const d = im.data;
    const shift = film === 'expired' ? [Math.random() * 0.25 - 0.12, Math.random() * 0.25 - 0.12, Math.random() * 0.25 - 0.12] : [0, 0, 0];
    const grainAmt = { classic: 10, bw: 22, faded: 12, expired: 26, flash: 14, dream: 8, xpro: 12, sepia: 18, vhs: 10 }[film];
    const cx = PX / 2;
    for (let y = 0; y < PX; y++) {
      for (let x = 0; x < PX; x++) {
        const i = (y * PX + x) * 4;
        let R = d[i] / 255;
        let Gg = d[i + 1] / 255;
        let B = d[i + 2] / 255;
        const L = 0.3 * R + 0.59 * Gg + 0.11 * B;
        const dx = (x - cx) / cx;
        const dy = (y - cx) / cx;
        const rr = dx * dx + dy * dy;
        switch (film) {
          case 'classic':
            R = lift(curve(R, 1.05), 0.08) * 1.06;
            Gg = lift(curve(Gg, 1.0), 0.07) * 1.0;
            B = lift(curve(B, 0.95), 0.12) * 0.9 + 0.03 * (1 - L);
            break;
          case 'bw': {
            const v = curve(L, 1.45) * 1.05;
            R = Gg = B = lift(v, 0.04);
            break;
          }
          case 'faded':
            R = lift(R, 0.18) * 1.05 + 0.03;
            Gg = lift(Gg, 0.16) * 0.97 + 0.01;
            B = lift(B, 0.2) * 0.85 + 0.05;
            [R, Gg, B] = sat(R, Gg, B, 0.55);
            break;
          case 'expired':
            R = lift(curve(R + shift[0], 1.15), 0.1);
            Gg = lift(curve(Gg + shift[1], 1.1), 0.08);
            B = lift(curve(B + shift[2], 1.2), 0.14);
            [R, Gg, B] = sat(R, Gg, B, 0.8);
            break;
          case 'flash': {
            const hot = Math.max(0, 1 - rr * 1.4) * 0.35;
            R = curve(R + hot, 1.5);
            Gg = curve(Gg + hot, 1.5);
            B = curve(B + hot * 1.1, 1.45);
            break;
          }
          case 'dream':
            R = lift(R, 0.12) * 1.06 + 0.04;
            Gg = lift(Gg, 0.1) * 0.95;
            B = lift(B, 0.14) * 1.02 + 0.03;
            [R, Gg, B] = sat(R, Gg, B, 0.8);
            break;
          case 'xpro':
            R = curve(R, 1.3) * 1.02;
            Gg = curve(Gg, 1.25) * 1.08 + 0.02;
            B = lift(B * 0.8, 0.12) + 0.06 * (1 - L);
            [R, Gg, B] = sat(R, Gg, B, 1.3);
            break;
          case 'sepia': {
            const v = lift(curve(L, 1.2), 0.08);
            R = v * 1.07 + 0.06;
            Gg = v * 0.88 + 0.04;
            B = v * 0.66 + 0.02;
            break;
          }
          case 'vhs':
            [R, Gg, B] = sat(curve(R, 1.1), curve(Gg, 1.1), curve(B, 1.1) * 1.05, 1.25);
            if (y % 3 === 0) (R *= 0.86), (Gg *= 0.86), (B *= 0.86);
            break;
        }
        // vignette
        const vig = film === 'vhs' ? 0 : film === 'flash' ? 0.75 : film === 'expired' ? 0.6 : 0.42;
        const v = 1 - vig * Math.max(0, rr - 0.25) * 0.75;
        const n = (Math.random() - 0.5) * grainAmt;
        d[i] = clamp(R * v * 255 + n);
        d[i + 1] = clamp(Gg * v * 255 + n);
        d[i + 2] = clamp(B * v * 255 + n);
      }
    }
    if (film === 'vhs') {
      // colour bleed: smear red to the right
      const c = new Uint8ClampedArray(d);
      for (let i = 0; i < d.length; i += 4) d[i] = (c[i] + (c[i - 12] ?? c[i]) + (c[i - 24] ?? c[i])) / 3;
    }
    r.putImageData(im, 0, 0);

    // light leaks / chemistry
    if (film === 'expired' || film === 'faded' || (film === 'classic' && Math.random() < 0.35)) {
      const side = Math.random() < 0.5 ? 0 : PX;
      const lg = r.createRadialGradient(side, Math.random() * PX, 0, side, Math.random() * PX, PX * 0.7);
      lg.addColorStop(0, `rgba(255,${120 + Math.random() * 80},40,${film === 'classic' ? 0.35 : 0.55})`);
      lg.addColorStop(1, 'rgba(255,80,40,0)');
      r.globalCompositeOperation = 'screen';
      r.fillStyle = lg;
      r.fillRect(0, 0, PX, PX);
      r.globalCompositeOperation = 'source-over';
    }
    if (film === 'expired') {
      for (let k = 0; k < 3 + Math.random() * 4; k++) {
        const bx = Math.random() * PX;
        const by = Math.random() < 0.6 ? (Math.random() < 0.5 ? 6 : PX - 6) : Math.random() * PX;
        const br = 6 + Math.random() * 22;
        const bg = r.createRadialGradient(bx, by, 0, bx, by, br);
        bg.addColorStop(0, 'rgba(240,230,200,0.7)');
        bg.addColorStop(1, 'rgba(240,230,200,0)');
        r.fillStyle = bg;
        r.fillRect(bx - br, by - br, br * 2, br * 2);
      }
    }
    if (film === 'dream') {
      const hz = r.createLinearGradient(0, 0, 0, PX);
      hz.addColorStop(0, 'rgba(255,150,200,0.18)');
      hz.addColorStop(1, 'rgba(150,120,255,0.12)');
      r.fillStyle = hz;
      r.fillRect(0, 0, PX, PX);
    }

    // the frame
    const out = document.createElement('canvas');
    out.width = FRAME.w;
    out.height = FRAME.h;
    const o = out.getContext('2d');
    const paper = film === 'vhs' ? '#1a1a1e' : film === 'sepia' || film === 'expired' ? '#efe6d2' : '#f7f5ee';
    o.fillStyle = paper;
    o.fillRect(0, 0, FRAME.w, FRAME.h);
    // paper texture
    for (let k = 0; k < 1400; k++) {
      o.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`;
      o.fillRect(Math.random() * FRAME.w, Math.random() * FRAME.h, 1.5, 1.5);
    }
    o.drawImage(raw, FRAME.side, FRAME.top, PX, PX);
    o.strokeStyle = 'rgba(0,0,0,0.25)';
    o.strokeRect(FRAME.side + 0.5, FRAME.top + 0.5, PX - 1, PX - 1);

    const g = this.game;
    const where = g.scene?.label ?? '';
    const time = g.dayNight?.label ?? '';
    if (film === 'vhs') {
      const date = new Date();
      o.font = 'bold 18px "VT323", "Courier New", monospace';
      o.fillStyle = '#ffb030';
      o.shadowColor = '#000';
      o.shadowBlur = 3;
      o.fillText(`${time || 'AM 3:00'}`, FRAME.side + 12, FRAME.top + PX - 34);
      o.fillText(`${date.toLocaleString('en', { month: 'short' }).toUpperCase()}.${String(date.getDate()).padStart(2, '0')} ${date.getFullYear()}`, FRAME.side + 12, FRAME.top + PX - 12);
      o.fillText('▶ PLAY', FRAME.side + PX - 92, FRAME.top + 26);
      o.shadowBlur = 0;
      o.fillStyle = '#d8d8d8';
      o.font = '22px "Caveat", "Bradley Hand", "Segoe Print", cursive';
      o.fillText(where, FRAME.side + 6, FRAME.h - 30);
    } else {
      o.fillStyle = '#2a2a5a';
      o.font = '26px "Caveat", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive';
      o.save();
      o.translate(FRAME.side + 8, FRAME.h - 34);
      o.rotate(-0.025);
      o.fillText(`${where}${time ? ' — ' + time : ''}`, 0, 0);
      o.restore();
    }
    return out;
  }

  // ---------------------------------------------------------------------------

  #load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  #save() {
    // localStorage is ~5 MB: drop the oldest until it fits
    for (;;) {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.photos));
        return;
      } catch {
        if (!this.photos.length) return;
        this.photos.pop();
      }
    }
  }
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
/** S-curve contrast around mid grey. */
const curve = (v, k) => {
  v = Math.min(1, Math.max(0, v));
  return 0.5 + (v - 0.5) * k + (k - 1) * 0.0;
};
/** Lift the blacks (matte fade). */
const lift = (v, a) => a + v * (1 - a);
const sat = (r, g, b, s) => {
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return [l + (r - l) * s, l + (g - l) * s, l + (b - l) * s];
};
