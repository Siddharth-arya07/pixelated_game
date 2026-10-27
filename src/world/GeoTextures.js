import * as THREE from 'three';

/**
 * Painted textures for real-world places (one wall tile = one bay × one floor).
 * Kept white-ish where the building colour should come through: walls are
 * tinted per building with vertex colours.
 */
function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

function noise(g, w, h, a = 0.06, n = 400) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
  }
}

/** The Ardenwood townhouses: cream stucco, dark brown trim, brown-framed windows, a balcony rail. */
export function townhouseWall() {
  return canvas(64, 64, (g, w, h) => {
    g.fillStyle = '#f2ead8';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, 0.05, 300);
    g.fillStyle = '#4a3020'; // trim band between floors
    g.fillRect(0, 60, w, 4);
    g.fillRect(0, 0, w, 2);
    // window with a dark frame
    g.fillStyle = '#3a2618';
    g.fillRect(18, 16, 28, 26);
    g.fillStyle = '#5a7088';
    g.fillRect(21, 19, 22, 20);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(22, 20, 6, 18);
    g.fillStyle = '#3a2618';
    g.fillRect(31, 19, 2, 20);
    // balcony railing under it
    g.fillStyle = '#4a3020';
    g.fillRect(12, 44, 40, 3);
    for (let x = 13; x < 52; x += 4) g.fillRect(x, 44, 2, 12);
    g.fillRect(12, 55, 40, 2);
  });
}

/** Suburban house: painted siding, a window with shutters. */
export function houseWall() {
  return canvas(64, 64, (g, w, h) => {
    g.fillStyle = '#f4f0e8';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.07)';
    for (let y = 4; y < h; y += 5) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.fillStyle = '#fafaf6';
    g.fillRect(20, 18, 24, 24);
    g.fillStyle = '#4a5a6a';
    g.fillRect(22, 20, 20, 20);
    g.fillStyle = 'rgba(255,240,200,0.2)';
    g.fillRect(23, 21, 7, 18);
    g.fillStyle = '#fafaf6';
    g.fillRect(31, 20, 2, 20);
    g.fillRect(22, 29, 20, 2);
    g.fillStyle = '#5a5048';
    g.fillRect(14, 18, 5, 24);
    g.fillRect(45, 18, 5, 24);
  });
}

export function schoolWall() {
  return canvas(64, 64, (g, w, h) => {
    g.fillStyle = '#efe6d2';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, 0.04, 200);
    g.fillStyle = '#2a6a8a';
    g.fillRect(0, 56, w, 8);
    g.fillStyle = '#3a4a5a';
    g.fillRect(8, 14, 48, 22);
    g.fillStyle = '#f0f0f0';
    for (let x = 8; x <= 56; x += 12) g.fillRect(x, 14, 2, 22);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(10, 16, 8, 18);
  });
}

export function shopWall() {
  return canvas(64, 64, (g, w, h) => {
    g.fillStyle = '#e8e2d6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a4a58';
    g.fillRect(4, 22, 56, 36);
    g.fillStyle = 'rgba(255,240,200,0.18)';
    g.fillRect(6, 24, 52, 32);
    g.fillStyle = '#e8e2d6';
    for (let x = 4; x < 60; x += 14) g.fillRect(x, 22, 2, 36);
    g.fillStyle = '#8a3a2a';
    g.fillRect(0, 12, w, 8);
  });
}

export function barnWall() {
  return canvas(64, 64, (g, w, h) => {
    g.fillStyle = '#e8e0d8';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x < w; x += 6) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
  });
}

/** Clay tile (Ardenwood townhouses) */
export function tileRoof() {
  return canvas(32, 32, (g, w, h) => {
    g.fillStyle = '#e0d0c8';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      for (let x = (y / 6) % 2 ? 0 : 3; x < w; x += 6) {
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(x, y + 4, 6, 2);
        g.fillStyle = 'rgba(255,255,255,0.1)';
        g.fillRect(x + 1, y, 3, 3);
      }
    }
  });
}

export function shingleRoof() {
  return canvas(32, 32, (g, w, h) => {
    g.fillStyle = '#d8d4d0';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      g.fillStyle = 'rgba(0,0,0,0.14)';
      g.fillRect(0, y, w, 1);
      for (let x = (y / 4) % 2 ? 0 : 4; x < w; x += 8) g.fillRect(x, y, 1, 4);
    }
    noise(g, w, h, 0.08, 120);
  });
}

/** Fallen sweetgum / maple leaves, alpha-cut. */
export function leafLitter() {
  const t = canvas(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cols = ['#b8361e', '#d4541e', '#e08a24', '#c8a028', '#9a2a1a', '#e8b030'];
    for (let i = 0; i < 70; i++) {
      const r = Math.hypot(Math.random() - 0.5, Math.random() - 0.5);
      if (r > 0.5) continue;
      const x = 32 + (Math.random() - 0.5) * 60;
      const y = 32 + (Math.random() - 0.5) * 60;
      g.fillStyle = cols[i % cols.length];
      g.save();
      g.translate(x, y);
      g.rotate(Math.random() * 6);
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.lineTo(Math.cos(a) * 3.4, Math.sin(a) * 3.4);
        g.lineTo(Math.cos(a + 0.6) * 1.4, Math.sin(a + 0.6) * 1.4);
      }
      g.fill();
      g.restore();
    }
  });
  return t;
}
