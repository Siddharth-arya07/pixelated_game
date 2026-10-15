import * as THREE from 'three';

/**
 * Procedural textures
 * -------------------
 * Tiny (mostly 64x64) canvas textures painted at startup so the game looks
 * right before any texture files are added. A file in /src/assets/textures
 * with the same key always wins (see `texture()` below).
 *
 *   texture(assets, 'wood_floor', 4, 4)  -> repeated THREE.Texture
 */

/** Deterministic PRNG so textures are identical every run. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

/** Sprinkle per-pixel brightness noise over the whole canvas. */
function grain(ctx, w, h, amount, rand) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] = clamp(d[i] + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
}
const clamp = (v) => Math.max(0, Math.min(255, v));

const PAINTERS = {
  wood_floor(ctx, r) {
    const w = 64;
    const tones = ['#6b4a2f', '#5e4029', '#74513a', '#654528'];
    for (let y = 0; y < 8; y++) {
      ctx.fillStyle = tones[y % tones.length];
      ctx.fillRect(0, y * 8, w, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, y * 8 + 7, w, 1);
      const seam = Math.floor(r() * w);
      ctx.fillRect(seam, y * 8, 1, 8);
      ctx.fillStyle = 'rgba(255,220,170,0.08)';
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(r() * w), y * 8 + 1 + Math.floor(r() * 5), 6 + r() * 14, 1);
    }
    grain(ctx, w, w, 18, r);
  },

  checker_tiles(ctx, r) {
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#1c1c22' : '#9c9a94';
        ctx.fillRect(x * 16, y * 16, 16, 16);
      }
    grain(ctx, 64, 64, 26, r);
  },

  store_floor(ctx, r) {
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#8a8e88' : '#c9c6b8';
        ctx.fillRect(x * 16, y * 16, 16, 16);
      }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i <= 4; i++) {
      ctx.fillRect(i * 16, 0, 1, 64);
      ctx.fillRect(0, i * 16, 64, 1);
    }
    grain(ctx, 64, 64, 20, r);
  },

  wall(ctx, r) {
    ctx.fillStyle = '#8c8574';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(60,50,40,0.18)';
    for (let x = 0; x < 64; x += 8) ctx.fillRect(x, 0, 2, 64);
    grain(ctx, 64, 64, 16, r);
  },

  ceiling(ctx, r) {
    ctx.fillStyle = '#9a988f';
    ctx.fillRect(0, 0, 64, 64);
    grain(ctx, 64, 64, 34, r);
    ctx.fillStyle = '#55534d';
    ctx.fillRect(0, 0, 64, 1);
    ctx.fillRect(0, 0, 1, 64);
  },

  asphalt(ctx, r) {
    ctx.fillStyle = '#4a4a50';
    ctx.fillRect(0, 0, 64, 64);
    grain(ctx, 64, 64, 40, r);
  },

  road(ctx, r) {
    PAINTERS.asphalt(ctx, r);
    ctx.fillStyle = '#b89a3a';
    ctx.fillRect(31, 4, 2, 26); // center dash (road runs along V)
    ctx.fillStyle = '#8a8a86';
    ctx.fillRect(2, 0, 2, 64);
    ctx.fillRect(60, 0, 2, 64);
  },

  grass(ctx, r) {
    ctx.fillStyle = '#3e5a30';
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = r() > 0.5 ? '#557a3c' : '#2e4424';
      ctx.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 2 + Math.floor(r() * 3));
    }
    grain(ctx, 64, 64, 16, r);
  },

  dirt(ctx, r) {
    ctx.fillStyle = '#6a5640';
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = r() > 0.5 ? '#7d6a50' : '#4e3e2c';
      ctx.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 2, 2);
    }
    grain(ctx, 64, 64, 22, r);
  },

  water(ctx, r) {
    ctx.fillStyle = '#1e3a52';
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = r() > 0.6 ? 'rgba(170,200,230,0.45)' : 'rgba(60,110,150,0.6)';
      ctx.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 4 + Math.floor(r() * 10), 1);
    }
  },

  planks(ctx, r) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = ['#8a7660', '#7a6852', '#94805f', '#806c56'][x];
      ctx.fillRect(x * 16, 0, 16, 64);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x * 16 + 15, 0, 1, 64);
      ctx.fillStyle = '#2a241e';
      ctx.fillRect(x * 16 + 3, 6, 1, 1);
      ctx.fillRect(x * 16 + 12, 6, 1, 1);
    }
    grain(ctx, 64, 64, 22, r);
  },

  siding(ctx, r) {
    for (let y = 0; y < 8; y++) {
      ctx.fillStyle = y % 2 ? '#5d6a72' : '#66737a';
      ctx.fillRect(0, y * 8, 64, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, y * 8 + 7, 64, 1);
    }
    grain(ctx, 64, 64, 14, r);
  },

  store_wall(ctx, r) {
    ctx.fillStyle = '#b8b6a8';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#7a3a34';
    ctx.fillRect(0, 52, 64, 6);
    grain(ctx, 64, 64, 12, r);
  },

  counter_tile(ctx, r) {
    ctx.fillStyle = '#c8bfa8';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#7d705a';
    for (let i = 0; i < 64; i += 16) {
      ctx.fillRect(i, 0, 1, 64);
      ctx.fillRect(0, i, 64, 1);
    }
    grain(ctx, 64, 64, 18, r);
  },

  brick(ctx, r) {
    ctx.fillStyle = '#3a3330';
    ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 8; y++)
      for (let x = -1; x < 4; x++) {
        const off = y % 2 ? 8 : 0;
        ctx.fillStyle = ['#6e3b2e', '#7a4434', '#62352a'][Math.floor(r() * 3)];
        ctx.fillRect(x * 16 + off + 1, y * 8 + 1, 14, 6);
      }
    grain(ctx, 64, 64, 18, r);
  },

  /** Shelf front full of anonymous colourful products. */
  products(ctx, r) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 64, 64);
    const cols = ['#c83c2c', '#e8c040', '#3c6cc8', '#e8e0d0', '#40a050', '#d87830', '#8040a0', '#202020'];
    for (let row = 0; row < 4; row++) {
      let x = 0;
      while (x < 64) {
        const w = 3 + Math.floor(r() * 5);
        const h = 9 + Math.floor(r() * 5);
        ctx.fillStyle = cols[Math.floor(r() * cols.length)];
        ctx.fillRect(x, row * 16 + (15 - h), w - 1, h);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x + 1, row * 16 + (15 - h) + 2, Math.max(1, w - 3), 1);
        x += w;
      }
      ctx.fillStyle = '#6a6a6a';
      ctx.fillRect(0, row * 16 + 15, 64, 1);
    }
  },

  gravel(ctx, r) {
    ctx.fillStyle = '#6a645c';
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = ['#8a8478', '#4a453e', '#7a7062', '#5a5550'][Math.floor(r() * 4)];
      ctx.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2));
    }
  },

  /** Behind-the-counter cigarette rack: rows of packs + price strips. */
  smokes_rack(ctx, r) {
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(0, 0, 64, 64);
    const packs = [
      ['#f2f0ea', '#c42020'],
      ['#f2f0ea', '#2050b0'],
      ['#e8d070', '#7a2a1a'],
      ['#202020', '#c8a040'],
      ['#3a7a3a', '#f2f0ea'],
      ['#c42020', '#f2f0ea'],
    ];
    for (let row = 0; row < 4; row++) {
      for (let x = 1; x < 63; x += 6) {
        const [body, band] = packs[Math.floor(r() * packs.length)];
        ctx.fillStyle = body;
        ctx.fillRect(x, row * 16 + 3, 5, 9);
        ctx.fillStyle = band;
        ctx.fillRect(x, row * 16 + 3, 5, 3);
      }
      ctx.fillStyle = '#e8e4c8';
      ctx.fillRect(0, row * 16 + 13, 64, 2);
      ctx.fillStyle = '#c02020';
      for (let x = 3; x < 64; x += 12) ctx.fillRect(x, row * 16 + 13, 4, 2);
    }
  },

  /** Rows of cans/bottles behind fridge glass. */
  fridge_drinks(ctx, r) {
    ctx.fillStyle = '#d8e8f0';
    ctx.fillRect(0, 0, 64, 64);
    const cols = ['#c02020', '#2040a0', '#e0c020', '#20a040', '#f0f0f0', '#6a3a1a', '#3060d0'];
    for (let row = 0; row < 4; row++) {
      for (let x = 0; x < 64; x += 5) {
        ctx.fillStyle = cols[Math.floor(r() * cols.length)];
        ctx.fillRect(x + 1, row * 16 + 4, 3, 11);
        ctx.fillStyle = '#9aa';
        ctx.fillRect(x + 1, row * 16 + 3, 3, 1);
      }
      ctx.fillStyle = '#7a8a90';
      ctx.fillRect(0, row * 16 + 15, 64, 1);
    }
  },

  /** Teal desktop + black terminal window — straight from reference #1. */
  screen_desktop(ctx, r) {
    ctx.fillStyle = '#3aa8a8';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#d8d4cc';
    ctx.fillRect(6, 10, 34, 40);
    ctx.fillStyle = '#10247a';
    ctx.fillRect(6, 10, 34, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(22, 6, 38, 28);
    ctx.fillStyle = '#c8c8c8';
    for (let y = 0; y < 6; y++) ctx.fillRect(25, 10 + y * 4, 6 + Math.floor(r() * 26), 1);
    ctx.fillStyle = '#e8a0c0';
    ctx.beginPath();
    ctx.arc(14, 44, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(0, 58, 64, 6);
    ctx.fillStyle = '#208020';
    ctx.fillRect(1, 59, 8, 4);
  },

  tv_static(ctx, r) {
    ctx.fillStyle = '#202830';
    ctx.fillRect(0, 0, 32, 32);
    grain(ctx, 32, 32, 160, r);
  },

  sign_store(ctx) {
    ctx.fillStyle = '#c8281e';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#ffe9a0';
    ctx.font = 'bold 22px Arial Black, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QUIK MART', 64, 17);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 2);
    ctx.fillRect(0, 30, 128, 2);
  },

  sign_open(ctx) {
    ctx.fillStyle = '#100808';
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#ff4060';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OPEN', 32, 13);
    ctx.fillStyle = '#40c0ff';
    ctx.font = '8px Arial, sans-serif';
    ctx.fillText('24 HOURS', 32, 26);
  },

  sign_lake(ctx) {
    ctx.fillStyle = '#2e4a2a';
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#e8e0c8';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MIRROR LAKE', 32, 14);
    ctx.fillText('→ 1/2 MI', 32, 27);
  },

  // --- Branded-ish props (parody names, nothing trademarked) ---------------
  label_beer(ctx) {
    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#1e2a5a';
    ctx.font = 'bold 9px serif';
    ctx.textAlign = 'center';
    ctx.fillText('Night', 16, 12);
    ctx.fillText('Owl', 16, 22);
    ctx.fillStyle = '#b8902a';
    ctx.fillRect(0, 26, 32, 3);
  },

  label_energy(ctx) {
    for (let x = 0; x < 32; x += 8) {
      ctx.fillStyle = (x / 8) % 2 ? '#c0c4cc' : '#2850b0';
      ctx.fillRect(x, 0, 8, 32);
    }
    ctx.fillStyle = '#d82828';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('VOLT', 16, 20);
  },

  label_cigs(ctx) {
    ctx.fillStyle = '#f2f0ea';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#c42020';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(32, 0);
    ctx.lineTo(32, 10);
    ctx.lineTo(16, 16);
    ctx.lineTo(0, 10);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px serif';
    ctx.textAlign = 'center';
    ctx.fillText('MARLOWE', 16, 26);
  },

  label_soda(ctx) {
    ctx.fillStyle = '#1a3a9a';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 14, 32, 4);
    ctx.fillStyle = '#d02020';
    ctx.fillRect(0, 18, 32, 3);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('POPSI', 16, 10);
  },

  pizza(ctx, r) {
    ctx.fillStyle = '#e0a040';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#c84020';
    ctx.fillRect(2, 2, 28, 28);
    ctx.fillStyle = '#f0d070';
    for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(r() * 30), Math.floor(r() * 30), 3, 2);
    ctx.fillStyle = '#902818';
    for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(r() * 26) + 2, Math.floor(r() * 26) + 2, 4, 4);
  },

  truck_paint(ctx, r) {
    ctx.fillStyle = '#2a4a8a';
    ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = r() > 0.5 ? '#6a5040' : '#1e3870';
      ctx.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 2, 1);
    }
    grain(ctx, 32, 32, 18, r);
  },

  bark(ctx, r) {
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#24180f';
    for (let x = 0; x < 32; x += 4) ctx.fillRect(x + Math.floor(r() * 2), 0, 1, 32);
    grain(ctx, 32, 32, 20, r);
  },

  pine(ctx, r) {
    ctx.fillStyle = '#244a30';
    ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = r() > 0.5 ? '#2f5a36' : '#163222';
      ctx.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 2, 1);
    }
  },

  rock(ctx, r) {
    ctx.fillStyle = '#4a4a4c';
    ctx.fillRect(0, 0, 32, 32);
    grain(ctx, 32, 32, 50, r);
  },

  fabric(ctx, r) {
    ctx.fillStyle = '#3e3a5a';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 32; i += 4) ctx.fillRect(0, i, 32, 1);
    grain(ctx, 32, 32, 14, r);
  },

  stereo_front(ctx, r) {
    ctx.fillStyle = '#141418';
    ctx.fillRect(0, 0, 64, 64);
    for (let row = 0; row < 6; row++) {
      const y = row * 10 + 2;
      ctx.fillStyle = '#26262c';
      ctx.fillRect(2, y, 60, 8);
      ctx.fillStyle = ['#30d0ff', '#ff6030', '#40ff80'][row % 3];
      ctx.fillRect(14 + Math.floor(r() * 10), y + 2, 14, 3);
      ctx.fillStyle = '#8a8a90';
      ctx.fillRect(50, y + 2, 4, 4);
    }
  },
};

/**
 * Road-sign style texture with a few lines of text.
 * signTexture(['QUIK MART', 'SUMMIT 2 MI ^'], { bg: '#1e5a2a', fg: '#f0ead8' })
 */
export function signTexture(lines, { bg = '#1e5a2a', fg = '#f0ead8', w = 128, h = 64, border = true } = {}) {
  const key = `sign:${lines.join('|')}:${bg}:${fg}:${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (border) {
    ctx.strokeStyle = fg;
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.floor((h - 14) / lines.length);
  ctx.font = `bold ${Math.min(18, size)}px Arial, sans-serif`;
  lines.forEach((t, i) => ctx.fillText(t, w / 2, 8 + size * (i + 0.5)));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  cache.set(key, tex);
  return tex;
}

const cache = new Map();

/** Raw procedural texture (shared). */
export function proceduralTexture(key) {
  if (cache.has(key)) return cache.get(key);
  const painter = PAINTERS[key];
  if (!painter) return null;
  const size = ['sign_store'].includes(key) ? [128, 32] : ['sign_open', 'sign_lake'].includes(key) ? [64, 32] : null;
  const small = ['label_beer', 'label_energy', 'label_cigs', 'label_soda', 'pizza', 'truck_paint', 'bark', 'pine', 'rock', 'fabric', 'tv_static'];
  const [w, h] = size ?? (small.includes(key) ? [32, 32] : [64, 64]);
  const [c, ctx] = canvas(w, h);
  painter(ctx, rng(hash(key)));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

/**
 * Get a texture by key with its own repeat setting. Prefers a file from
 * /src/assets/textures (via AssetLoader), falls back to the procedural one.
 */
export function texture(assets, key, repeatX = 1, repeatY = repeatX) {
  const base = assets?.texture(key) ?? proceduralTexture(key);
  if (!base) return null;
  const t = base.clone();
  t.repeat.set(repeatX, repeatY);
  t.needsUpdate = true;
  return t;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
