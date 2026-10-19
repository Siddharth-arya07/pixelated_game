import { MAP } from '../world/MapLayout.js';

/**
 * MapUI
 * -----
 * A fold-out paper map (M). The terrain is rendered once into an offscreen
 * canvas (shaded relief, sea, roads, landmarks); each frame while open we
 * draw it plus a "you are here" arrow. Indoors the arrow sits on the
 * building you're in. The game keeps running while the map is open.
 */
const INDOOR = { House: 'house', GroceryStore: 'gasStation', Lighthouse: 'lighthouse', Lake: 'lakeExit', Diner: 'diner', Studio: 'house', Cave: 'mine', Bowling: 'bowling' };
const LABELS = [
  ['house', 'HOME'],
  ['gasStation', 'QUIK MART'],
  ['harbor', 'HARBOR'],
  ['lighthouse', 'LIGHTHOUSE'],
  ['lakeExit', 'MIRROR LAKE'],
  ['playground', 'PARK'],
  ['drivein', 'DRIVE-IN'],
  ['diner', 'DINER'],
  ['airfield', 'AIRFIELD'],
  ['mine', 'OLD MINE'],
  ['funland', 'FUNLAND'],
  ['bowling', 'BOWLING'],
];

export class MapUI {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.el = document.createElement('div');
    this.el.id = 'map';
    this.el.className = 'hidden';
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = 512;
    this.el.appendChild(this.canvas);
    const hint = document.createElement('div');
    hint.className = 'map-hint';
    hint.textContent = 'M close';
    this.el.appendChild(hint);
    document.getElementById('ui').appendChild(this.el);
    this.base = null;
  }

  toggle() {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
    if (this.visible && !this.base) this.base = this.#bake();
    this.game.audio.oneShot('click');
  }

  /** world (x,z) → canvas px */
  #px(x, z) {
    const s = 512 / MAP.size;
    return [(x + MAP.size / 2) * s, (z + MAP.size / 2) * s];
  }

  #bake() {
    const world = this.game.scenes.World;
    world.ensureBuilt();
    const T = world.terrain;
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(512, 512);
    const step = MAP.size / 512;
    for (let j = 0; j < 512; j++) {
      for (let i = 0; i < 512; i++) {
        const x = -MAP.size / 2 + i * step, z = -MAP.size / 2 + j * step;
        const h = T.heightAt(x, z);
        const hl = T.heightAt(x - step, z - step);
        let r, g, b;
        if (h < -0.3) {
          const d = Math.min(1, -h / 12);
          r = 120 - 40 * d; g = 150 - 40 * d; b = 160 - 30 * d; // sea
        } else {
          const shade = Math.max(-1, Math.min(1, (h - hl) * 0.35)); // NW light
          const t = Math.min(1, h / 120);
          r = 214 - 40 * t; g = 200 - 30 * t; b = 160 - 30 * t; // paper, darker uphill
          r += shade * 40; g += shade * 40; b += shade * 34;
          if (Math.floor(h / 10) !== Math.floor(hl / 10) && h > 2) { r -= 40; g -= 40; b -= 40; } // contours
        }
        const k = (j * 512 + i) * 4;
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Roads
    for (const road of T.roads) {
      if (road.rail) {
        // railway: thin line with cross ties
        ctx.setLineDash([]);
        ctx.strokeStyle = '#2a2420';
        ctx.lineWidth = 1;
        ctx.beginPath();
        road.samples.forEach((s, k) => {
          const [px, pz] = this.#px(s.x, s.z);
          k ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz);
        });
        ctx.stroke();
        for (let k = 2; k < road.samples.length - 2; k += 4) {
          const a = road.samples[k - 1];
          const b = road.samples[k + 1];
          const [px, pz] = this.#px(road.samples[k].x, road.samples[k].z);
          const ang = Math.atan2(b.z - a.z, b.x - a.x) + Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(px - Math.cos(ang) * 2.5, pz - Math.sin(ang) * 2.5);
          ctx.lineTo(px + Math.cos(ang) * 2.5, pz + Math.sin(ang) * 2.5);
          ctx.stroke();
        }
        continue;
      }
      ctx.strokeStyle = road.surface === 'gravel' ? '#7a5a3a' : '#3a2a20';
      ctx.lineWidth = road.surface === 'gravel' ? 1.5 : 2.5;
      ctx.setLineDash(road.surface === 'gravel' ? [3, 2] : []);
      ctx.beginPath();
      road.samples.forEach((s, k) => {
        const [px, pz] = this.#px(s.x, s.z);
        k ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Landmarks
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    for (const [key, label] of LABELS) {
      const p = MAP.poi[key];
      let [px, pz] = this.#px(p.x, p.z);
      ctx.fillStyle = key === 'lighthouse' ? '#b02018' : '#2a1a10';
      if (key === 'lighthouse') {
        ctx.beginPath();
        ctx.moveTo(px, pz - 9); ctx.lineTo(px - 4, pz + 4); ctx.lineTo(px + 4, pz + 4);
        ctx.fill();
      } else ctx.fillRect(px - 3, pz - 3, 6, 6);
      const lx = Math.max(48, Math.min(464, px));
      ctx.fillStyle = '#000a';
      ctx.fillText(label, lx + 1, pz - 11);
      ctx.fillStyle = key === 'lighthouse' ? '#b02018' : '#2a1a10';
      ctx.fillText(label, lx, pz - 12);
    }
    ctx.fillStyle = '#3a4a58';
    ctx.font = 'italic 16px monospace';
    ctx.fillText('THE SEA', ...this.#px(440, 200));
    // Compass
    ctx.fillStyle = '#2a1a10';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('N', 30, 24);
    ctx.beginPath(); ctx.moveTo(30, 28); ctx.lineTo(25, 44); ctx.lineTo(35, 44); ctx.fill();
    return c;
  }

  update() {
    if (!this.visible) return;
    const g = this.game;
    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.base, 0, 0);

    let x, z, yaw;
    const name = g.scene?.name;
    if (name === 'World') {
      const v = g.vehicle.active;
      const pos = v ? v.object.position : g.player.feet;
      x = pos.x; z = pos.z;
      yaw = v ? Math.PI - v.heading : -g.player.yaw; // canvas angle, 0 = up/north
    } else {
      const p = MAP.poi[INDOOR[name]] ?? MAP.poi.house;
      x = p.x; z = p.z; yaw = null;
    }
    const [px, pz] = this.#px(x, z);
    const blink = Math.floor(g.time * 3) % 2 === 0;
    ctx.save();
    ctx.translate(px, pz);
    if (yaw !== null) {
      ctx.rotate(yaw);
      ctx.fillStyle = blink ? '#ff3020' : '#ffe040';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-6, 7); ctx.lineTo(0, 3); ctx.lineTo(6, 7); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else {
      ctx.strokeStyle = blink ? '#ff3020' : '#ffe040';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    // strays you haven't won over yet (paw prints)
    for (const m of g.pets?.mapMarkers() ?? []) {
      const [mx, mz] = this.#px(m.x, m.z);
      ctx.fillStyle = '#8a4a2a';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🐾', mx, mz + 4);
      ctx.font = '10px monospace';
      ctx.fillText(m.label, mx, mz - 8);
    }
    // friends in the room
    for (const m of g.mp?.online ? g.mp.markers() : []) {
      const at = m.scene === 'World' ? m : MAP.poi[INDOOR[m.scene]] ?? null;
      if (!at) continue;
      const [mx, mz] = this.#px(at.x, at.z);
      ctx.fillStyle = '#2a7ad8';
      ctx.beginPath();
      ctx.arc(mx, mz, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(m.name, mx, mz - 8);
    }
    ctx.fillStyle = '#2a1a10';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU ARE HERE', Math.max(48, Math.min(464, px)), pz + 22);
  }
}
