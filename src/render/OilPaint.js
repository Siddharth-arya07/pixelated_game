/**
 * OilPaint
 * --------
 * Procedural oil paintings, painted the way a person would: a blocky
 * underpainting, then layers of directional brush strokes from big to small.
 * Each stroke follows a flow field, carries bristle streaks and a thin
 * impasto highlight, and the canvas weave shows through at the end.
 *
 * A painting is a recipe: ref(u, v) -> [r, g, b] (what's there) and
 * flow(u, v) -> angle (which way the brush moves). u, v in 0..1.
 *
 *   paintOil('lighthouse' | 'sunflowers' | 'starryroad')  -> HTMLCanvasElement
 *   oilBrushStroke(ctx, pts, color, size, opts)           used by the easel too
 */
const W = 512;
const H = 384;

export const PAINTINGS = {
  lighthouse: { title: 'Lighthouse in a Storm', ref: lighthouseRef, flow: lighthouseFlow },
  sunflowers: { title: 'Sunflowers, 3 a.m.', ref: sunflowerRef, flow: sunflowerFlow },
  starryroad: { title: 'Starry Night over Route 9', ref: starryRef, flow: starryFlow },
};

export function paintOil(key, w = W, h = H) {
  const recipe = PAINTINGS[key];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const rnd = mulberry(key.length * 9301 + key.charCodeAt(0));

  // Underpainting: blocky, slightly muted.
  const B = 16;
  for (let y = 0; y < h; y += B) {
    for (let x = 0; x < w; x += B) {
      const [r, g, b] = recipe.ref((x + B / 2) / w, (y + B / 2) / h);
      ctx.fillStyle = rgb(r * 0.85, g * 0.85, b * 0.85);
      ctx.fillRect(x, y, B, B);
    }
  }

  // Strokes, coarse to fine.
  for (const [size, density] of [[18, 0.5], [10, 0.9], [5, 1.3], [3, 0.6]]) {
    const n = Math.floor(((w * h) / (size * size)) * density);
    for (let i = 0; i < n; i++) {
      const u = rnd();
      const v = rnd();
      const [r, g, b] = recipe.ref(u, v);
      const j = (rnd() - 0.5) * 26;
      const color = [r + j, g + j, b + j * 0.8];
      const pts = [[u * w, v * h]];
      let x = u * w;
      let y = v * h;
      const steps = 3 + Math.floor(rnd() * 3);
      for (let s = 0; s < steps; s++) {
        const a = recipe.flow(x / w, y / h) + (rnd() - 0.5) * 0.35;
        x += Math.cos(a) * size * 0.9;
        y += Math.sin(a) * size * 0.9;
        pts.push([x, y]);
      }
      oilBrushStroke(ctx, pts, color, size, { rnd, load: 1 });
    }
  }
  canvasGrain(ctx, w, h, rnd);
  return c;
}

/**
 * One loaded-brush stroke along `pts`: a body of paint, bristle streaks in
 * lighter/darker shades, and an impasto highlight on the upper-left edge.
 * opts.load (0..1) fades the paint as the brush runs dry.
 */
export function oilBrushStroke(ctx, pts, color, size, { rnd = Math.random, load = 1, bristles = true } = {}) {
  if (pts.length < 2) pts = [pts[0], [pts[0][0] + 0.5, pts[0][1] + 0.5]];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  // body
  ctx.globalAlpha = 0.85 * load;
  ctx.strokeStyle = rgb(...color);
  ctx.lineWidth = size;
  path();
  ctx.stroke();
  if (bristles) {
    // bristle streaks: thin parallel lines offset across the stroke
    const n = Math.max(3, Math.floor(size / 2));
    for (let k = 0; k < n; k++) {
      const off = (k / (n - 1) - 0.5) * size * 0.9;
      const shade = (rnd() - 0.5) * 40;
      ctx.globalAlpha = (0.25 + rnd() * 0.3) * load;
      ctx.strokeStyle = rgb(color[0] + shade, color[1] + shade, color[2] + shade);
      ctx.lineWidth = Math.max(0.8, size / n * 0.6);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const a = i < pts.length - 1 ? Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) : Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
        const px = pts[i][0] - Math.sin(a) * off;
        const py = pts[i][1] + Math.cos(a) * off;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    // impasto: a lit ridge up-left, a shadowed one down-right
    ctx.globalAlpha = 0.18 * load;
    ctx.lineWidth = Math.max(1, size * 0.18);
    ctx.strokeStyle = 'rgb(255,250,235)';
    ctx.save();
    ctx.translate(-size * 0.28, -size * 0.28);
    path();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.14 * load;
    ctx.strokeStyle = 'rgb(20,14,10)';
    ctx.save();
    ctx.translate(size * 0.3, size * 0.3);
    path();
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Linen weave + a little varnish yellowing. */
export function canvasGrain(ctx, w, h, rnd = Math.random) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const weave = ((x % 3 === 0) !== (y % 3 === 0) ? 7 : -4) + (rnd() - 0.5) * 8;
      d[k] = clamp(d[k] + weave + 4);
      d[k + 1] = clamp(d[k + 1] + weave + 2);
      d[k + 2] = clamp(d[k + 2] + weave - 4);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// -----------------------------------------------------------------------------
// Recipes
// -----------------------------------------------------------------------------

function lighthouseRef(u, v) {
  const horizon = 0.58 + Math.sin(u * 9) * 0.01;
  // cliff on the right
  const cliffTop = 0.48 + (1 - u) * 0.35 + Math.sin(u * 23) * 0.015;
  const inCliff = u > 0.55 && v > cliffTop;
  // tower
  const tx = 0.74;
  const inTower = Math.abs(u - tx) < 0.035 - (0.48 - v) * 0.02 && v > 0.2 && v < cliffTop + 0.01;
  // beam: a wedge from the lantern toward the upper left
  const ly = 0.22;
  const ang = Math.atan2(v - ly, u - tx);
  const beam = Math.abs(ang - -2.75) < 0.12 && u < tx ? 1 - Math.abs(ang + 2.75) / 0.12 : 0;
  if (inTower) {
    if (Math.abs(v - 0.22) < 0.025) return [255, 236, 160];
    const stripe = Math.floor((v - 0.2) * 22) % 2 === 0;
    return stripe ? [228, 224, 214] : [170, 46, 40];
  }
  if (inCliff) return [70 + v * 30, 52 + v * 20, 42];
  if (v > horizon) {
    // sea: dark green-blue, foam streaks
    const foam = Math.sin(u * 40 + v * 90) > 0.93 ? 70 : 0;
    return [24 + foam, 50 + v * 20 + foam, 62 + v * 18 + foam];
  }
  // sky: stormy, a glow around the beam
  const swirl = Math.sin(u * 7 + v * 11) * 12;
  const base = [36 + swirl, 44 + swirl, 72 + v * 30 + swirl];
  return [base[0] + beam * 200, base[1] + beam * 180, base[2] + beam * 90];
}
function lighthouseFlow(u, v) {
  if (v > 0.58) return Math.sin(u * 12) * 0.25; // sea: horizontal chop
  return Math.sin(u * 6 + v * 9) * 1.2 + 0.4; // sky: churning
}

const SUNS = [
  [0.38, 0.32, 0.09],
  [0.55, 0.26, 0.1],
  [0.66, 0.4, 0.08],
  [0.46, 0.46, 0.08],
  [0.3, 0.5, 0.07],
];
function sunflowerRef(u, v) {
  for (const [x, y, r] of SUNS) {
    const d = Math.hypot(u - x, (v - y) * 0.75);
    if (d < r * 0.38) return [96, 58, 24]; // seed head
    if (d < r) {
      const a = Math.atan2(v - y, u - x);
      const petal = Math.cos(a * 13) > -0.3 ? 1 : 0.6;
      return [236 * petal, 176 * petal, 34];
    }
  }
  // stems
  if (v > 0.45 && v < 0.62 && Math.abs(u - 0.48 - Math.sin(v * 20) * 0.02) < 0.012) return [70, 110, 50];
  // vase
  if (v > 0.6 && v < 0.88 && Math.abs(u - 0.48) < 0.13 - (v - 0.74) ** 2 * 1.5) return [214, 170, 60];
  // table
  if (v > 0.84) return [70, 92, 130];
  // wall: warm ochre with a lamp glow
  const glow = 1 - Math.min(1, Math.hypot(u - 0.2, v - 0.2) * 1.6);
  return [150 + glow * 70, 128 + glow * 50, 74 + glow * 20];
}
function sunflowerFlow(u, v) {
  for (const [x, y, r] of SUNS) {
    if (Math.hypot(u - x, (v - y) * 0.75) < r * 1.05) return Math.atan2(v - y, u - x); // petals radiate
  }
  if (v > 0.84) return 0;
  return Math.PI / 2 + Math.sin(u * 8) * 0.3;
}

const SWIRLS = [
  [0.3, 0.22, 0.12],
  [0.62, 0.3, 0.09],
  [0.82, 0.15, 0.07],
];
function starryRef(u, v) {
  // moon
  if (Math.hypot(u - 0.86, v - 0.16) < 0.06) return [250, 220, 110];
  // stars
  for (const [x, y] of [[0.12, 0.12], [0.2, 0.36], [0.47, 0.1], [0.55, 0.42], [0.72, 0.4], [0.4, 0.3]]) {
    const d = Math.hypot(u - x, v - y);
    if (d < 0.025) return [252, 236, 140];
    if (d < 0.05) return [180, 190, 140];
  }
  // mountains
  const ridge = 0.62 - Math.abs(Math.sin(u * 4.2)) * 0.12 - Math.sin(u * 13) * 0.02;
  if (v > ridge) {
    // road winding up the mountain
    const roadX = 0.5 + Math.sin(v * 18) * (1 - v) * 0.35;
    if (Math.abs(u - roadX) < 0.012 + (v - ridge) * 0.06 && v > ridge + 0.03) return [150, 140, 120];
    // two headlights
    if (Math.hypot(u - 0.47, v - 0.86) < 0.012 || Math.hypot(u - 0.51, v - 0.86) < 0.012) return [255, 240, 180];
    return [26 + v * 20, 42 + v * 30, 40 + v * 10];
  }
  // sky: deep blue swirls
  const s = Math.sin(u * 14 + Math.sin(v * 9) * 2) * 22;
  return [40 + s * 0.4, 70 + s, 150 + s];
}
function starryFlow(u, v) {
  for (const [x, y, r] of SWIRLS) {
    const d = Math.hypot(u - x, v - y);
    if (d < r * 2) return Math.atan2(v - y, u - x) + Math.PI / 2; // circle round
  }
  if (v > 0.6) return -Math.PI / 2 + Math.sin(u * 9) * 0.5; // trees/hills: upward
  return Math.sin(v * 12 + u * 4) * 0.6; // rolling sky
}

// -----------------------------------------------------------------------------

function rgb(r, g, b) {
  return `rgb(${clamp(r) | 0},${clamp(g) | 0},${clamp(b) | 0})`;
}
function clamp(x) {
  return Math.max(0, Math.min(255, x));
}
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
