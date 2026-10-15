import * as THREE from 'three';
import { WAVE_COUNT } from './PSXMaterial.js';

/**
 * Water
 * -----
 * Wave field shared by the GPU (PSX shader, WATER define) and the CPU
 * (buoyancy for boats / jet ski, bobbers, splashes). Both evaluate the same
 * sum of directional sines, so hulls sit exactly on the waves you see.
 *
 *   water.setSea('calm' | 'choppy')
 *   water.height(x, z)       surface height at a world point (incl. seaLevel)
 *   water.slope(x, z)        surface gradient {x, z}
 */
export class Water {
  constructor(shared) {
    this.shared = shared;
    this.seaLevel = 0;
    this.time = 0;
    this.waves = [];
    this.setSea('choppy');
  }

  setSea(kind) {
    this.stormK = -1;
    // [direction angle, amplitude m, wavelength m, speed rad/s]
    const presets = {
      calm: [
        [0.3, 0.12, 22, 0.9],
        [1.4, 0.06, 9, 1.4],
        [2.6, 0.04, 5, 2.1],
        [4.0, 0.02, 3, 2.8],
      ],
      choppy: [
        [0.2, 0.45, 34, 0.75],
        [1.1, 0.22, 15, 1.2],
        [2.3, 0.1, 7, 1.9],
        [3.8, 0.05, 3.5, 2.7],
      ],
    };
    const p = presets[kind] ?? presets.calm;
    this.waves = p.slice(0, WAVE_COUNT).map(([a, amp, len, speed]) => ({
      dir: new THREE.Vector2(Math.cos(a), Math.sin(a)),
      amp,
      k: (Math.PI * 2) / len,
      speed,
    }));
    this.baseAmps = this.waves.map((w) => w.amp);
    this.stormK = -1;
    const s = this.shared;
    this.waves.forEach((w, i) => {
      s.uWaveDir.value[i].copy(w.dir);
      s.uWaveAmp.value[i] = w.amp;
      s.uWaveK.value[i] = w.k;
      s.uWaveSpeed.value[i] = w.speed;
    });
  }

  /** Storms (0..1) pile the waves up to ~2.3× (GPU and CPU stay in sync). */
  setStorm(k) {
    if (Math.abs(k - this.stormK) < 0.01) return;
    this.stormK = k;
    this.waves.forEach((w, i) => {
      w.amp = this.baseAmps[i] * (1 + 1.3 * k);
      this.shared.uWaveAmp.value[i] = w.amp;
    });
  }

  /** Must match the shader: displacement is added to the mesh's y (seaLevel). */
  height(x, z) {
    const t = this.shared.uTime.value;
    let h = 0;
    for (const w of this.waves) h += w.amp * Math.sin((w.dir.x * x + w.dir.y * z) * w.k + t * w.speed);
    return this.seaLevel + h;
  }

  slope(x, z, out = { x: 0, z: 0 }) {
    const t = this.shared.uTime.value;
    out.x = 0;
    out.z = 0;
    for (const w of this.waves) {
      const c = w.amp * w.k * Math.cos((w.dir.x * x + w.dir.y * z) * w.k + t * w.speed);
      out.x += c * w.dir.x;
      out.z += c * w.dir.y;
    }
    return out;
  }
}
