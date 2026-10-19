import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * DayNightCycle
 * -------------
 * Game clock (starts 3:00 a.m.) + keyframed colours for fog/sky, ambient and
 * the directional sun/moon light. Outdoor scenes use the values directly;
 * interiors blend a little "window light" into their own dim palette.
 */

// minutes → colours. Fog colour doubles as the sky (scene background).
const KEYS = [
  { t: 0, fog: 0x0e0e18, amb: 0x20202e, light: 0x2c3454, far: 30 },
  { t: 180, fog: 0x101018, amb: 0x222232, light: 0x2e3658, far: 30 }, // 3:00 a.m. (spec)
  { t: 300, fog: 0x18162a, amb: 0x262438, light: 0x343658, far: 30 },
  { t: 360, fog: 0x3a2c44, amb: 0x3e3448, light: 0x8a6070, far: 34 }, // first light
  { t: 420, fog: 0x8a6a6a, amb: 0x4a3e46, light: 0xc08868, far: 42 }, // sunrise
  { t: 540, fog: 0x8a9aaa, amb: 0x5a6070, light: 0xd0c8b8, far: 55 },
  { t: 900, fog: 0x9aa8b8, amb: 0x646a78, light: 0xd8d8d0, far: 60 },
  { t: 1110, fog: 0x9a7a6a, amb: 0x54484a, light: 0xc88860, far: 45 }, // sunset
  { t: 1200, fog: 0x2a2038, amb: 0x2e2a40, light: 0x483c60, far: 34 },
  { t: 1290, fog: 0x121220, amb: 0x20202e, light: 0x2c3454, far: 30 },
  { t: 1440, fog: 0x0e0e18, amb: 0x20202e, light: 0x2c3454, far: 30 },
];

export class DayNightCycle {
  constructor(game) {
    this.game = game;
    this.minutes = CONFIG.time.startMinutes;
    this.speed = CONFIG.time.minutesPerSecond;
    this.day = 1;
    this.fog = new THREE.Color();
    this.ambient = new THREE.Color();
    this.light = new THREE.Color();
    this.far = CONFIG.fog.far;
    this.lightDir = new THREE.Vector3();
    this._a = new THREE.Color();
    this._b = new THREE.Color();
    this._c = new THREE.Color();
  }

  get hour() {
    return this.minutes / 60;
  }

  /** True between ~6:30 a.m. and ~7:30 p.m. */
  get isDaylight() {
    return this.minutes > 390 && this.minutes < 1170;
  }

  /** "3:00 a.m." — formatted like the caption in the reference shots. */
  get label() {
    const m = Math.floor(this.minutes);
    let h = Math.floor(m / 60) % 24;
    const mm = String(m % 60).padStart(2, '0');
    const suffix = h < 12 ? 'a.m.' : 'p.m.';
    h = h % 12 || 12;
    return `${h}:${mm} ${suffix}`;
  }

  advance(minutes) {
    this.minutes += minutes;
    while (this.minutes >= 1440) {
      this.minutes -= 1440;
      this.day++;
    }
  }

  update(dt, scene) {
    this.advance(dt * this.speed);
    this.#sample(this.minutes);
    this.game.weather?.apply(this, scene.outdoor);

    // Sun arc: rises east (+x) ~6:30, sets west ~19:30. At night the "moon"
    // comes from a fixed high angle so things still read.
    const sunAngle = ((this.minutes - 390) / (1170 - 390)) * Math.PI;
    if (this.isDaylight) this.lightDir.set(-Math.cos(sunAngle), -Math.max(0.25, Math.sin(sunAngle)), -0.3).normalize();
    else this.lightDir.set(0.4, -0.8, 0.45).normalize();

    const r = this.game.renderer;
    if (scene.outdoor) {
      // Always foggy outside: the wall closes in to ~30 m at night, ~45 m by day.
      r.setFog(this.fog, 2, Math.min(this.far, 45) + (this.game.farBoost ?? 0));
      r.setGroundFog(scene.groundFog ?? 0.3, scene.groundFogY ?? 0);
      r.setLight(this.lightDir, this.light, this.ambient);
    } else {
      r.setGroundFog(0);
      const ind = scene.indoor;
      const k = ind.daylight * this.#daylightAmount();
      r.setFog(this._a.set(ind.fog).lerp(this.fog, k * 0.5), ind.near, ind.far);
      this._c.set(ind.ambient).lerp(this.ambient, k);
      // Lightning through the windows.
      const fl = this.game.weather?.flashLevel ?? 0;
      if (fl > 0) this._c.add(this._a.set(0x8890b0).multiplyScalar(fl * ind.daylight * 1.6 + fl * 0.15));
      r.setLight(this.lightDir, this._b.copy(this.light).multiplyScalar(0.25 + k), this._c);
    }
  }

  /** 0 at night, 1 at noon-ish. */
  #daylightAmount() {
    const m = this.minutes;
    if (m < 360 || m > 1230) return 0;
    if (m < 480) return (m - 360) / 120;
    if (m > 1110) return 1 - (m - 1110) / 120;
    return 1;
  }

  #sample(m) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= m) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = (m - a.t) / (b.t - a.t);
    this.fog.set(a.fog).lerp(this._a.set(b.fog), t);
    this.ambient.set(a.amb).lerp(this._a.set(b.amb), t);
    this.light.set(a.light).lerp(this._a.set(b.light), t);
    this.far = a.far + (b.far - a.far) * t;
  }
}
