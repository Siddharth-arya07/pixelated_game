import * as THREE from 'three';

/**
 * VideoLibrary
 * ------------
 * "Prerecorded" videos for the TVs and the computer's video player:
 *  - built-in VHS tapes drawn procedurally into a canvas (camcorder beach
 *    trip, night drive, aquarium, skate tape, late news, infomercial, and a
 *    tape you probably shouldn't watch alone)
 *  - any .mp4/.webm in src/assets/videos (auto-discovered) — drawn from a
 *    <video> element; its sound is routed to the device that plays it
 *
 *   videos.list                    [{ id, title, duration }]
 *   videos.draw(ctx, id, t, x, y, w, h)   paint frame at time t (seconds)
 *   videos.fileAudio(id, speakerObject)   route a file video's sound to a device
 */
const videoFiles = import.meta.glob('../assets/videos/*.{mp4,webm}', { eager: true, query: '?url', import: 'default' });

export class VideoLibrary {
  constructor(game) {
    this.game = game;
    this.list = [
      { id: 'vacation', title: 'VACATION_96.AVI', duration: 95 },
      { id: 'nightdrive', title: 'NIGHT_DRIVE.MPG', duration: 120 },
      { id: 'aquarium', title: 'FISH_TANK.AVI', duration: 180 },
      { id: 'skate', title: 'SK8_ROUGH_CUT.MOV', duration: 60 },
      { id: 'news', title: 'NEWS11_LATE.MPG', duration: 140 },
      { id: 'infomercial', title: 'MIRACLE_MOP.AVI', duration: 75 },
      { id: 'lost', title: 'LOST_TAPE.AVI', duration: 66 },
    ];
    this.files = new Map();
    for (const [path, url] of Object.entries(videoFiles)) {
      const name = path.split('/').pop();
      const el = document.createElement('video');
      el.src = url;
      el.loop = true;
      el.playsInline = true;
      el.crossOrigin = 'anonymous';
      el.preload = 'metadata';
      const id = `file:${name}`;
      this.files.set(id, { el, source: null });
      const entry = { id, title: name.toUpperCase(), duration: 0 };
      el.addEventListener('loadedmetadata', () => (entry.duration = el.duration));
      this.list.push(entry);
    }
  }

  get(id) {
    return this.list.find((v) => v.id === id);
  }

  /** Start/stop a file video (no-op for procedural tapes). */
  setPlaying(id, playing, t = 0) {
    const f = this.files.get(id);
    if (!f) return;
    if (playing) {
      if (Math.abs(f.el.currentTime - t) > 0.5) f.el.currentTime = t;
      f.el.play().catch(() => {});
    } else f.el.pause();
  }

  /** Send a file video's audio out of a device in the world. */
  fileAudio(id, object) {
    const f = this.files.get(id);
    if (!f) return;
    const audio = this.game.audio;
    if (!f.source) f.source = audio.ctx.createMediaElementSource(f.el);
    f.positional?.parent?.remove(f.positional);
    f.positional?.disconnect();
    const p = new THREE.PositionalAudio(audio.listener);
    p.setRefDistance(2);
    object.add(p);
    const tap = audio.ctx.createGain();
    f.source.disconnect();
    f.source.connect(tap);
    p.setNodeSource(tap);
    f.positional = p;
  }

  /** Paint one frame of video `id` at time t into the given rect. */
  draw(ctx, id, t, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    const f = this.files.get(id);
    if (f) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      if (f.el.readyState >= 2) ctx.drawImage(f.el, 0, 0, w, h);
    } else (TAPES[id] ?? TAPES.static)(ctx, t, w, h);
    vhs(ctx, t, w, h, id === 'lost' ? 1 : 0.4);
    ctx.restore();
  }
}

// -----------------------------------------------------------------------------
// Procedural tapes. Each: (ctx, t, w, h) with the origin at the video's corner.
// -----------------------------------------------------------------------------

const TAPES = {
  static(c, t, w, h) {
    const img = c.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  },

  vacation(c, t, w, h) {
    // Handheld camcorder at sunset.
    const sx = Math.sin(t * 1.3) * 2;
    const sy = Math.sin(t * 1.7 + 1) * 1.5;
    c.save();
    c.translate(sx, sy);
    const sky = c.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, '#2a1a4a');
    sky.addColorStop(0.6, '#d0603a');
    sky.addColorStop(1, '#f0b060');
    c.fillStyle = sky;
    c.fillRect(-4, -4, w + 8, h * 0.6 + 4);
    c.fillStyle = '#ffd890';
    c.beginPath();
    c.arc(w * 0.62, h * 0.55, h * 0.12, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1a3050';
    c.fillRect(-4, h * 0.58, w + 8, h * 0.45);
    c.fillStyle = 'rgba(255,200,120,0.6)';
    for (let i = 0; i < 9; i++) {
      const yy = h * 0.6 + i * h * 0.04;
      const xx = w * 0.62 + Math.sin(t * 2 + i) * 6 - (8 + i * 3);
      c.fillRect(xx, yy, 16 + i * 6, 1);
    }
    // palm tree silhouette
    c.fillStyle = '#0a0a10';
    c.fillRect(w * 0.12, h * 0.25, 3, h * 0.6);
    for (let i = 0; i < 5; i++) {
      c.save();
      c.translate(w * 0.12 + 1, h * 0.25);
      c.rotate(-1.2 + i * 0.6 + Math.sin(t + i) * 0.05);
      c.fillRect(0, -1, w * 0.12, 3);
      c.restore();
    }
    // seagull
    const gx = ((t * 12) % (w + 40)) - 20;
    c.strokeStyle = '#0a0a10';
    c.beginPath();
    c.moveTo(gx - 5, h * 0.3 + Math.sin(t * 6) * 2);
    c.lineTo(gx, h * 0.32);
    c.lineTo(gx + 5, h * 0.3 + Math.sin(t * 6) * 2);
    c.stroke();
    c.restore();
    camcorder(c, t, w, h, 'JUL 14 1996');
  },

  nightdrive(c, t, w, h) {
    c.fillStyle = '#05050c';
    c.fillRect(0, 0, w, h);
    const hz = h * 0.45;
    c.fillStyle = '#10101c';
    c.fillRect(0, hz, w, h - hz);
    // road
    c.fillStyle = '#1c1c22';
    c.beginPath();
    c.moveTo(w * 0.47, hz);
    c.lineTo(w * 0.53, hz);
    c.lineTo(w * 1.1, h);
    c.lineTo(-w * 0.1, h);
    c.fill();
    // dashes rushing toward us
    c.fillStyle = '#d8c040';
    for (let i = 0; i < 8; i++) {
      const z = ((i / 8 + t * 0.6) % 1) ** 2;
      const yy = hz + z * (h - hz);
      c.fillRect(w / 2 - 1 - z * 3, yy, 2 + z * 6, 2 + z * 8);
    }
    // streetlights passing
    for (let i = 0; i < 3; i++) {
      const z = ((i / 3 + t * 0.35) % 1) ** 2;
      const xx = w / 2 + z * w * 0.7;
      const yy = hz - z * h * 0.5;
      c.fillStyle = '#ffd090';
      c.fillRect(xx, yy, 2 + z * 6, 2 + z * 3);
      c.fillStyle = 'rgba(255,208,144,0.15)';
      c.beginPath();
      c.arc(xx, yy, 6 + z * 20, 0, Math.PI * 2);
      c.fill();
    }
    // dash silhouette
    c.fillStyle = '#000';
    c.fillRect(0, h * 0.82, w, h * 0.2);
    c.beginPath();
    c.arc(w * 0.3, h * 1.02, h * 0.28, Math.PI, 0);
    c.lineWidth = 4;
    c.strokeStyle = '#111';
    c.stroke();
    c.fillStyle = '#30d0a0';
    c.fillRect(w * 0.6, h * 0.86, 18, 5);
  },

  aquarium(c, t, w, h) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a6a9a');
    g.addColorStop(1, '#0a2a4a');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8b070';
    c.fillRect(0, h * 0.85, w, h * 0.15);
    // weeds
    c.fillStyle = '#2a7a3a';
    for (let i = 0; i < 6; i++) {
      const x = 10 + i * (w / 6);
      for (let s = 0; s < 6; s++) c.fillRect(x + Math.sin(t * 1.5 + s * 0.6 + i) * 3, h * 0.85 - s * 6, 3, 6);
    }
    // fish
    const cols = ['#f08030', '#f0e040', '#e04060', '#60c0f0'];
    for (let i = 0; i < 5; i++) {
      const dir = i % 2 ? 1 : -1;
      const x = ((t * (10 + i * 3) * dir + i * 60) % (w + 30) + w + 30) % (w + 30) - 15;
      const y = h * (0.2 + i * 0.13) + Math.sin(t * 1.3 + i) * 5;
      c.fillStyle = cols[i % cols.length];
      c.beginPath();
      c.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(x - 7 * dir, y);
      c.lineTo(x - 12 * dir, y - 4);
      c.lineTo(x - 12 * dir, y + 4);
      c.fill();
    }
    // bubbles
    c.fillStyle = 'rgba(220,240,255,0.7)';
    for (let i = 0; i < 12; i++) {
      const y = h - ((t * 20 + i * 37) % h);
      c.fillRect(w * 0.82 + Math.sin(t * 3 + i) * 3, y, 2, 2);
    }
  },

  skate(c, t, w, h) {
    c.fillStyle = '#8ab0d0';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c0c0b8';
    // halfpipe
    c.beginPath();
    c.moveTo(0, h * 0.35);
    c.quadraticCurveTo(0, h * 0.85, w * 0.25, h * 0.85);
    c.lineTo(w * 0.75, h * 0.85);
    c.quadraticCurveTo(w, h * 0.85, w, h * 0.35);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    // pendulum skater
    const a = Math.sin(t * 1.4);
    const x = w / 2 + a * w * 0.38;
    const y = h * 0.82 - Math.abs(a) ** 3 * h * 0.42;
    c.fillStyle = '#202020';
    c.fillRect(x - 6, y, 12, 2); // board
    c.fillRect(x - 1, y - 14, 3, 14); // body
    c.beginPath();
    c.arc(x + 0.5, y - 17, 3, 0, Math.PI * 2);
    c.fill();
    c.fillRect(x - 6 + a * 3, y - 11, 12, 2); // arms
    camcorder(c, t, w, h, 'SK8 ROUGH CUT');
    // fisheye vignette
    const v = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.9)');
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  },

  news(c, t, w, h) {
    c.fillStyle = '#1a2a5a';
    c.fillRect(0, 0, w, h);
    // anchor desk + anchor
    c.fillStyle = '#3a4a8a';
    c.fillRect(w * 0.55, h * 0.15, w * 0.38, h * 0.35); // over-the-shoulder box
    c.fillStyle = '#9ab0d0';
    c.fillRect(w * 0.58, h * 0.2, w * 0.32, h * 0.25);
    c.fillStyle = '#5a5a6a';
    c.fillRect(w * 0.62, h * 0.32, w * 0.24, h * 0.06); // fog icon
    c.fillStyle = '#c09070';
    c.fillRect(w * 0.22, h * 0.3, w * 0.16, h * 0.2); // head
    c.fillStyle = '#2a2a3a';
    c.fillRect(w * 0.14, h * 0.5, w * 0.32, h * 0.3); // suit
    c.fillStyle = '#6a2a2a';
    c.fillRect(0, h * 0.62, w, h * 0.12); // desk
    // mouth flap
    c.fillStyle = '#5a2a20';
    c.fillRect(w * 0.27, h * 0.44, w * 0.06, Math.sin(t * 9) > 0 ? 2 : 1);
    // ticker
    c.fillStyle = '#c02020';
    c.fillRect(0, h * 0.82, w, h * 0.18);
    c.fillStyle = '#fff';
    c.font = `bold ${Math.max(7, Math.floor(h * 0.1))}px Arial`;
    c.textBaseline = 'middle';
    const msg = 'FOG ADVISORY IN EFFECT UNTIL 9 AM  ·  SUMMIT ROAD GRAVEL ABOVE 2ND HAIRPIN, TRUCKS USE LOW GEAR  ·  LIGHTHOUSE BEAM REPORTED "PAUSING" — COAST GUARD SAYS NOTHING TO SEE  ·  QUIK MART STILL OPEN  ·  ';
    const tw = c.measureText(msg).width;
    const off = (t * 40) % tw;
    c.fillText(msg + msg, -off, h * 0.91);
    c.fillStyle = '#fff';
    c.fillRect(4, 4, 30, 10);
    c.fillStyle = '#1a2a5a';
    c.font = 'bold 8px Arial';
    c.fillText('NEWS 11', 6, 9);
  },

  infomercial(c, t, w, h) {
    const flash = Math.floor(t * 2) % 2;
    c.fillStyle = flash ? '#f0e020' : '#e02080';
    c.fillRect(0, 0, w, h);
    c.fillStyle = flash ? '#e02080' : '#20a0f0';
    c.save();
    c.translate(w / 2, h * 0.4);
    c.rotate(Math.sin(t * 3) * 0.1);
    c.font = `bold ${Math.floor(h * 0.16)}px Arial Black, Arial`;
    c.textAlign = 'center';
    c.fillText('MIRACLE MOP!', 0, 0);
    c.restore();
    c.fillStyle = '#202020';
    c.font = `bold ${Math.floor(h * 0.09)}px Arial`;
    c.textAlign = 'center';
    c.fillText('ONLY $19.99', w / 2, h * 0.62);
    c.fillText('CALL 1-800-555-MOPS', w / 2, h * 0.78);
    c.textAlign = 'left';
    // spinning mop
    c.save();
    c.translate(w * 0.12, h * 0.7);
    c.rotate(t * 4);
    c.fillStyle = '#f0f0f0';
    for (let i = 0; i < 8; i++) {
      c.rotate(Math.PI / 4);
      c.fillRect(0, -1, 10, 3);
    }
    c.restore();
  },

  lost(c, t, w, h) {
    // A hallway that goes on too long. The light flickers.
    const on = Math.sin(t * 13) * Math.sin(t * 2.3) < 0.8 ? 1 : 0.2;
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    for (let i = 8; i >= 0; i--) {
      const k = i / 8;
      const ww = w * (1 - k * 0.85);
      const hh = h * (1 - k * 0.85);
      const shade = Math.floor((30 + (1 - k) * 90) * on);
      c.fillStyle = `rgb(${shade},${shade},${Math.floor(shade * 0.85)})`;
      c.fillRect((w - ww) / 2, (h - hh) / 2, ww, hh);
      c.fillStyle = '#000';
      c.fillRect((w - ww) / 2 + 2, (h - hh) / 2 + 2, ww - 4, hh - 4);
    }
    // something at the end of the hall, only sometimes
    if (Math.floor(t) % 11 === 7) {
      c.fillStyle = '#d8d8d0';
      c.fillRect(w / 2 - 1, h / 2 - 4, 3, 8);
    }
    if (t % 30 > 26) {
      c.fillStyle = '#fff';
      c.font = `bold ${Math.floor(h * 0.08)}px Courier New, monospace`;
      c.textAlign = 'center';
      c.fillText('THE KEEPER NEVER CAME BACK DOWN', w / 2, h * 0.85);
      c.textAlign = 'left';
    }
    c.fillStyle = '#fff';
    c.font = '8px Courier New, monospace';
    c.fillText('REC  03:33', 6, 12);
  },
};

/** Date stamp + PLAY overlay of a 90s camcorder. */
function camcorder(c, t, w, h, label) {
  c.fillStyle = '#fff';
  c.font = `bold ${Math.max(7, Math.floor(h * 0.08))}px Courier New, monospace`;
  c.fillText('PLAY ▶', 6, Math.floor(h * 0.12));
  c.fillText(label, 6, h - 6);
  const s = Math.floor(t);
  c.fillText(`0:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, w - Math.floor(h * 0.45), h - 6);
}

/** Scanlines + noise + the odd tracking bar. */
function vhs(c, t, w, h, amount) {
  c.fillStyle = `rgba(0,0,0,${0.18 * amount + 0.08})`;
  for (let y = 0; y < h; y += 2) c.fillRect(0, y, w, 1);
  const bar = ((t * 0.37) % 1.4) * h;
  c.fillStyle = `rgba(255,255,255,${0.08 * amount})`;
  c.fillRect(0, bar, w, 3 + amount * 4);
  if (Math.random() < 0.05 * amount) {
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.fillRect(0, Math.random() * h, w, 1);
  }
}

/**
 * TVScreen — a TV's channel lineup rendered to a texture.
 *   const tv = new TVScreen(game, { channels: ['news', 'infomercial', …] })
 *   screenMesh.material = renderer.material({ map: tv.texture, unlit: true, affine: 0 })
 *   tv.nextChannel(); tv.update(dt)
 */
export class TVScreen {
  constructor(game, { channels = ['news', 'infomercial', 'aquarium', 'static', 'vacation'], width = 128, height = 96 } = {}) {
    this.game = game;
    this.videos = game.videos;
    this.channels = channels;
    this.channel = 0;
    this.on = true;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.userData.live = true; // redrawn constantly: never mipmap/filter
    this.t = 0;
    this.switchT = 0;
    this._acc = 0;
  }

  get name() {
    return this.videos.get(this.channels[this.channel])?.title ?? 'STATIC';
  }

  nextChannel() {
    this.channel = (this.channel + 1) % this.channels.length;
    this.switchT = 0.25;
  }

  update(dt) {
    this.t += dt;
    this._acc += dt;
    // 15 fps is plenty (and very period-correct).
    if (this._acc < 1 / 15) return;
    this._acc = 0;
    const c = this.ctx;
    const { width: w, height: h } = this.canvas;
    if (!this.on) {
      c.fillStyle = '#06080a';
      c.fillRect(0, 0, w, h);
    } else if (this.switchT > 0) {
      this.switchT -= 1 / 15;
      this.videos.draw(c, 'static', this.t, 0, 0, w, h);
    } else {
      this.videos.draw(c, this.channels[this.channel], this.t, 0, 0, w, h);
      c.fillStyle = '#40ff60';
      c.font = 'bold 10px monospace';
      if (this.t % 6 < 1.5) c.fillText(`CH ${String(this.channel + 3).padStart(2, '0')}`, w - 38, 14);
    }
    this.texture.needsUpdate = true;
  }
}
